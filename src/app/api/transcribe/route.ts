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
    const transcriptionData = await processVideo(videoUrl);

    // Save to database
    const { error } = await supabase
      .from('transcriptions')
      .insert([transcriptionData])
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to save transcription', status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: transcriptionData,
    });

  } catch (error: unknown) {
    console.error('Transcription error:', error);
    
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