import { NextRequest, NextResponse } from 'next/server';
import { anthropic, CLAUDE_MODEL } from '@/lib/anthropic';
import { supabase } from '@/lib/supabase';
import { TranscriptionData } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const startTime = Date.now();
    const { videoUrl } = await request.json();
    
    if (!videoUrl) {
      return NextResponse.json({ 
        success: false, 
        error: 'Video URL is required' 
      }, { status: 400 });
    }

    // Step 1: Extract video metadata
    const videoTitle = await extractVideoTitle(videoUrl);
    
    // Step 2: Get transcript (mock for now)
    const rawTranscript = await getRawTranscript(videoUrl);
    
    // Step 3: Clean transcript with Claude
    const cleaningResponse = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: `Please clean up this video transcript and make it more readable. Remove filler words, fix grammar, and organize it into proper paragraphs. Keep the meaning and content intact.

Original transcript:
${rawTranscript}

Please provide:
1. A cleaned, readable transcript
2. A brief summary (2-3 sentences)
3. Key points (3-5 bullet points)

Format your response as JSON:
{
  "cleaned_transcript": "...",
  "summary": "...",
  "key_points": ["...", "..."]
}`
      }]
    });

    const content = cleaningResponse.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }
    const result = JSON.parse(content.text);
    const processingTime = Math.round((Date.now() - startTime) / 1000);
    
    // Calculate costs (rough estimate)
    const inputTokens = cleaningResponse.usage.input_tokens;
    const outputTokens = cleaningResponse.usage.output_tokens;
    const cost = calculateCost(inputTokens, outputTokens);

    // Step 4: Save to database
    const transcriptionData: TranscriptionData = {
      video_url: videoUrl,
      video_title: videoTitle,
      raw_transcript: rawTranscript,
      cleaned_transcript: result.cleaned_transcript,
      summary: result.summary,
      key_points: result.key_points,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost,
      processing_time_seconds: processingTime,
      status: 'completed'
    };

    const { data, error } = await supabase
      .from('transcriptions')
      .insert([transcriptionData])
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to save transcription' 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      data 
    });

  } catch (error) {
    console.error('Transcription error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// Helper functions
async function extractVideoTitle(url: string): Promise<string> {
  // TODO: Implement proper video metadata extraction
  // For now, return a simple title
  return `Video from ${new URL(url).hostname}`;
}

async function getRawTranscript(url: string): Promise<string> {
  // TODO: Implement actual transcript extraction
  // This could use youtube-dl, whisper, or other services
  
  // Mock transcript for now
  return `This is a mock transcript for the video at ${url}. In a real implementation, this would be extracted from the video audio using a speech-to-text service like Whisper or similar. The transcript would contain the actual spoken content from the video, including filler words, pauses, and natural speech patterns that would then be cleaned up by Claude AI.`;
}

function calculateCost(inputTokens: number, outputTokens: number): number {
  // Claude 3 Sonnet pricing (approximate)
  const inputCostPerToken = 0.000003; // $3 per million input tokens
  const outputCostPerToken = 0.000015; // $15 per million output tokens
  
  return (inputTokens * inputCostPerToken) + (outputTokens * outputCostPerToken);
} 