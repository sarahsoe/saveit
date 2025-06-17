import { NextRequest, NextResponse } from 'next/server';
import { anthropic, CLAUDE_MODEL } from '@/lib/anthropic';
import { supabase } from '@/lib/supabase';
import { getVideoTranscript, getTranscriptionCost } from '@/lib/video-processor';
import { TranscriptionData } from '@/types';

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Environment check:');
    console.log('- ANTHROPIC_API_KEY exists:', !!process.env.ANTHROPIC_API_KEY);
    console.log('- ANTHROPIC_API_KEY length:', process.env.ANTHROPIC_API_KEY?.length || 0);
    console.log('- ANTHROPIC_API_KEY starts with sk-ant:', process.env.ANTHROPIC_API_KEY?.startsWith('sk-ant'));
    console.log('- Claude model:', CLAUDE_MODEL);

    const startTime = Date.now();
    const { videoUrl } = await request.json();
    
    if (!videoUrl) {
      return NextResponse.json({ 
        success: false, 
        error: 'Video URL is required' 
      }, { status: 400 });
    }

    console.log('1. Starting transcription for:', videoUrl);

    // Check if API key exists before making Anthropic call
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }

    // Step 1: Get transcript
    const rawTranscript = await getVideoTranscript(videoUrl);
    console.log('2. Got transcript, length:', rawTranscript?.length);
    
    // Step 2: Extract video title
    const videoTitle = extractVideoTitle(videoUrl);
    
    // Step 3: Clean transcript with Claude
    console.log('3. Calling Claude API...');
    const cleaningResponse = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: `Please clean up this video transcript and make it more readable. Remove filler words, fix grammar, and organize it into proper paragraphs. Keep the meaning and content intact.

Original transcript:
${rawTranscript}

IMPORTANT: Respond ONLY with valid JSON in this exact format:
{
  "cleaned_transcript": "your cleaned transcript here",
  "summary": "your summary here", 
  "key_points": ["point 1", "point 2", "point 3"]
}`
      }]
    });

    console.log('4. Claude responded successfully');

    const result = JSON.parse(cleaningResponse.content[0].text);
    console.log('5. Parsed Claude response');
    
    const processingTime = Math.round((Date.now() - startTime) / 1000);
    
    // Calculate costs
    const inputTokens = cleaningResponse.usage.input_tokens;
    const outputTokens = cleaningResponse.usage.output_tokens;
    const claudeCost = (inputTokens * 0.000003) + (outputTokens * 0.000015);
    const transcriptCost = getTranscriptionCost(videoUrl, 5);
    const totalCost = claudeCost + transcriptCost;

    // Step 4: Save to database
    const transcriptionData: TranscriptionData = {
      video_url: videoUrl,
      video_title: videoTitle,
      transcript: rawTranscript,
      cleaned_transcript: result.cleaned_transcript,
      summary: result.summary,
      key_points: result.key_points,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost: totalCost,
      processing_time_seconds: processingTime,
      status: 'completed'
    };

    console.log('6. Inserting into database...');
    const { data, error } = await supabase
      .from('transcriptions')
      .insert([transcriptionData])
      .select()
      .single();

    if (error) {
      console.error('❌ Database error:', error);
      return NextResponse.json({ 
        success: false, 
        error: `Database error: ${error.message}` 
      }, { status: 500 });
    }

    console.log('✅ Success! Data saved:', !!data);
    return NextResponse.json({ 
      success: true, 
      data 
    });

  } catch (error: unknown) {
    const err = error as Error;
    console.error('❌ DETAILED ERROR:', {
      message: err.message,
      stack: err.stack,
      name: err.name
    });
    
    return NextResponse.json({ 
      success: false, 
      error: `Internal server error: ${err.message}` 
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