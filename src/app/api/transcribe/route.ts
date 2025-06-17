import { NextRequest, NextResponse } from 'next/server';
import { anthropic, CLAUDE_MODEL } from '@/lib/anthropic';
import { supabase } from '@/lib/supabase';
import { getVideoTranscript, getTranscriptionCost } from '@/lib/video-processor';
import { TranscriptionData } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const startTime = Date.now();
    const { videoUrl } = await request.json(); // Now matches frontend!
    
    if (!videoUrl) {
      return NextResponse.json({ 
        success: false, 
        error: 'Video URL is required' 
      }, { status: 400 });
    }

    console.log('Processing video:', videoUrl);

    // Step 1: Get transcript using our smart routing
    const rawTranscript = await getVideoTranscript(videoUrl);
    
    // Step 2: Extract video title
    const videoTitle = extractVideoTitle(videoUrl);
    
    // Step 3: Clean transcript with Claude
    const cleaningResponse = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: `You are a JSON API. You must respond with valid JSON only, no other text.

Clean up this video transcript and make it more readable. Remove filler words, fix grammar, and organize it into proper paragraphs. Keep the meaning and content intact.

Original transcript:
${rawTranscript}

Return a JSON object with exactly these fields:
{
  "cleaned_transcript": "The cleaned, readable transcript",
  "summary": "A brief summary (2-3 sentences)",
  "key_points": ["Point 1", "Point 2", "Point 3"]
}

Do not include any text outside the JSON object.`
      }]
    });

    const content = cleaningResponse.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }
    const result = JSON.parse(content.text);
    const processingTime = Math.round((Date.now() - startTime) / 1000);
    
    // Calculate costs
    const inputTokens = cleaningResponse.usage.input_tokens;
    const outputTokens = cleaningResponse.usage.output_tokens;
    const claudeCost = (inputTokens * 0.000003) + (outputTokens * 0.000015);
    const transcriptCost = getTranscriptionCost(videoUrl, 5); // Estimate 5 min
    const totalCost = claudeCost + transcriptCost;

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
      cost: totalCost,
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
        error: `Database error: ${error.message}` 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      data 
    });

  } catch (error: any) {
    console.error('Transcription error:', error);
    return NextResponse.json({ 
      success: false, 
      error: `Internal server error: ${error.message}` 
    }, { status: 500 });
  }
}

function extractVideoTitle(url: string): string {
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return 'YouTube Video';
  }
  if (url.includes('spotify.com') || url.includes('anchor.fm')) {
    return 'Podcast Episode';
  }
  return `Video from ${new URL(url).hostname}`;
} 