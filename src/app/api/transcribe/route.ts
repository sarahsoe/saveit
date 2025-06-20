import { NextRequest, NextResponse } from 'next/server';
import { processVideo } from '@/lib/video-processor';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { videoUrl } = await request.json();

    if (!videoUrl) {
      return NextResponse.json({ error: 'Video URL is required', status: 400 });
    }

    // Validate URL
    if (!isValidUrl(videoUrl)) {
      return NextResponse.json({ error: 'Invalid video URL', status: 400 });
    }

    // Process the video using the unified function
    const result = await processVideo(videoUrl);
    const {
      video_title: videoTitle,
      video_duration: duration,
      raw_transcript: rawTranscript,
      cleaned_transcript: cleanedTranscript,
      summary,
      key_points: keyPoints,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost,
      processing_time_seconds: processingTime,
      status
    } = result;

    // Save to database
    const { data, error } = await supabase
      .from('transcriptions')
      .insert({
        video_url: videoUrl,
        video_title: videoTitle || '',
        video_duration: duration || 0,
        raw_transcript: rawTranscript || '',
        cleaned_transcript: cleanedTranscript || '',
        summary: summary || '',
        key_points: keyPoints || [],
        input_tokens: inputTokens || 0,
        output_tokens: outputTokens || 0,
        cost: cost || 0,
        processing_time_seconds: processingTime || 0,
        status: status || 'completed'
      })
      .select()
      .single();

    if (error) {
      console.error('Database insert error:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to save transcription'
      }, { status: 500 });
    }

    // Return the same safe format
    const safeResponse = {
      ...data,
      key_points: data.key_points || [],
      video_title: data.video_title || '',
      raw_transcript: data.raw_transcript || '',
      cleaned_transcript: data.cleaned_transcript || '',
      summary: data.summary || '',
      status: data.status || 'completed',
      video_duration: data.video_duration || 0,
      input_tokens: data.input_tokens || 0,
      output_tokens: data.output_tokens || 0,
      processing_time_seconds: data.processing_time_seconds || 0,
      cost: data.cost || 0,
    };

    return NextResponse.json({
      success: true,
      data: safeResponse
    });

  } catch (error: unknown) {
    console.error('Transcribe error:', error);
    
    // Return appropriate error based on error type
    if (error instanceof Error) {
      if (error.message.includes('transcript')) {
        return NextResponse.json({ error: 'Failed to extract transcript from video', status: 422 });
      }
      if (error.message.includes('Claude')) {
        return NextResponse.json({ error: 'Text processing failed', status: 503 });
      }
    }

    return NextResponse.json({ error: 'Internal server error', status: 500 });
  }
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    // Add specific validation for supported platforms
    return url.includes('youtube.com') || 
           url.includes('youtu.be') || 
           url.includes('podcast') ||
           url.includes('spotify.com');
  } catch {
    return false;
  }
} 