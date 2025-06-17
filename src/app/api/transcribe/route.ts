import { NextRequest, NextResponse } from 'next/server';
import { anthropic, CLAUDE_MODEL } from '@/lib/anthropic';
import { supabase } from '@/lib/supabase';
import { getVideoTranscript, getTranscriptionCost } from '@/lib/video-processor';
import { TranscriptionData } from '@/types';

export async function POST(request: NextRequest) {
  try {
    console.log('1. Starting transcription request...');
    
    // Step 1: Get request body
    const { videoUrl } = await request.json();
    console.log('2. Request body:', { videoUrl });
    
    if (!videoUrl) {
      console.error('3. Missing videoUrl in request');
      return NextResponse.json({ 
        success: false, 
        error: 'Missing videoUrl parameter' 
      }, { status: 400 });
    }

    // Step 2: Get video transcript
    console.log('4. Getting video transcript...');
    const rawTranscript = await getVideoTranscript(videoUrl);
    console.log('5. Got transcript, length:', rawTranscript?.length);
    
    if (!rawTranscript) {
      console.error('6. No transcript returned');
      return NextResponse.json({ 
        success: false, 
        error: 'No transcript available for this video' 
      }, { status: 400 });
    }

    // Step 3: Process with Claude
    console.log('7. Processing with Claude...');
    const startTime = Date.now();
    
    const cleaningResponse = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: `Please clean up and format this transcript, then provide a summary and key points. Here's the transcript:\n\n${rawTranscript}`
      }]
    });
    
    console.log('8. Claude response received');
    const processingTime = (Date.now() - startTime) / 1000;
    
    // Parse Claude's response
    console.log('9. Parsing Claude response...');
    const content = cleaningResponse.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }
    const result = JSON.parse(content.text);
    console.log('10. Response parsed successfully');
    
    // Calculate costs
    const inputTokens = cleaningResponse.usage.input_tokens;
    const outputTokens = cleaningResponse.usage.output_tokens;
    const claudeCost = (inputTokens * 0.000003) + (outputTokens * 0.000015);
    const transcriptCost = getTranscriptionCost(videoUrl, 5); // Estimate 5 min
    const totalCost = claudeCost + transcriptCost;

    // Step 4: Save to database
    console.log('11. Saving to database...');
    const transcriptionData: TranscriptionData = {
      video_url: videoUrl,
      video_title: 'YouTube Video', // TODO: Get actual title
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
      console.error('12. Database error:', error);
      return NextResponse.json({ 
        success: false, 
        error: `Database error: ${error.message}` 
      }, { status: 500 });
    }

    console.log('13. Successfully saved to database');
    return NextResponse.json({ 
      success: true, 
      data 
    });

  } catch (error: any) {
    console.error('❌ Transcription error:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      cause: error.cause
    });
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