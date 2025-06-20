import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getTranscriptWithFallback } from '@/lib/python-transcript';

// --- YouTube URL extraction and normalization helpers ---
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function validateYouTubeUrl(input: string): string {
  const videoId = extractYouTubeId(input);
  if (!videoId) {
    throw new Error('Invalid YouTube URL. Please provide a valid YouTube video URL.');
  }
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export async function POST(request: NextRequest) {
  try {
    const { videoUrl } = await request.json();
    
    if (!videoUrl) {
      return NextResponse.json({
        success: false,
        error: 'Video URL is required'
      }, { status: 400 });
    }
    
    console.log(`🎬 Processing video: ${videoUrl}`);
    
    // Use enhanced transcript fetching with Python fallback
    let videoContent;
    try {
      videoContent = await getTranscriptWithFallback(videoUrl);
      console.log(`📝 Content source: ${videoContent.source}, length: ${videoContent.transcript.length}`);
    } catch (error) {
      console.error('All transcript methods failed:', error);
      return NextResponse.json({
        success: false,
        error: 'Unable to extract transcript from this video. This may be due to privacy settings, lack of captions, or regional restrictions. Please try a different video.'
      }, { status: 422 });
    }
    
    // Ensure we have enough content
    if (videoContent.transcript.length < 50) {
      return NextResponse.json({
        success: false,
        error: 'Video content is too short to process meaningfully. Please try a video with more substantial content.'
      }, { status: 422 });
    }
    
    // Process with Claude AI (your existing logic)
    const startTime = Date.now();
    let cleanedTranscript = '';
    let summary = '';
    let keyPoints: string[] = [];
    let inputTokens = 0;
    let outputTokens = 0;
    let cost = 0;
    
    try {
      const anthropic = new (await import('@anthropic-ai/sdk')).default({
        apiKey: process.env.ANTHROPIC_API_KEY!,
      });
      
      const prompt = `Please analyze this video content and provide:
1. A cleaned, well-formatted transcript
2. A concise summary (2-3 paragraphs)
3. Key points (5-7 bullet points)

Content source: ${videoContent.source}
Video title: ${videoContent.title}

Original content:
${videoContent.transcript}

Please format your response as JSON:
{
  "cleaned_transcript": "...",
  "summary": "...",
  "key_points": ["...", "...", "..."]
}`;
      
      const message = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 4000,
        messages: [{
          role: "user",
          content: prompt
        }]
      });
      
      // Type guard for Claude response
      const contentBlock = message.content[0];
      let response = '';
      if (typeof contentBlock === 'object' && 'text' in contentBlock && typeof contentBlock.text === 'string') {
        response = contentBlock.text;
      } else {
        throw new Error('Claude API did not return text content');
      }
      
      try {
        const parsed = JSON.parse(response);
        cleanedTranscript = parsed.cleaned_transcript || response;
        summary = parsed.summary || '';
        keyPoints = parsed.key_points || [];
      } catch (parseError) {
        // Fallback if JSON parsing fails
        cleanedTranscript = response;
        summary = response.split('\n').slice(0, 3).join('\n');
        keyPoints = response.split('\n').filter((line: string) => 
          line.trim().startsWith('•') || 
          line.trim().startsWith('-') ||
          line.trim().startsWith('*')
        ).slice(0, 7);
      }
      
      inputTokens = message.usage.input_tokens;
      outputTokens = message.usage.output_tokens;
      cost = (inputTokens * 0.003 + outputTokens * 0.015) / 1000;
      
    } catch (error) {
      console.error('Error processing with Claude:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to process content with AI. Please try again.'
      }, { status: 500 });
    }
    
    const processingTime = Math.round((Date.now() - startTime) / 1000);
    
    // Extract video ID for normalized URL
    const videoId = extractYouTubeId(videoUrl);
    const normalizedUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : videoUrl;
    
    // Save to database with null-safe values
    try {
      const { data, error } = await supabase
        .from('transcriptions')
        .insert({
          video_url: normalizedUrl,
          video_title: videoContent.title || 'YouTube Video',
          video_duration: 0, // Could be enhanced to get actual duration
          raw_transcript: videoContent.transcript,
          cleaned_transcript: cleanedTranscript || '',
          summary: summary || '',
          key_points: keyPoints || [],
          input_tokens: inputTokens || 0,
          output_tokens: outputTokens || 0,
          cost: cost || 0,
          processing_time_seconds: processingTime || 0,
          status: 'completed'
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
      
      // Return safe response
      const safeResponse = {
        ...data,
        key_points: data.key_points || [],
        video_title: data.video_title || '',
        raw_transcript: data.raw_transcript || '',
        cleaned_transcript: data.cleaned_transcript || '',
        summary: data.summary || '',
      };
      
      return NextResponse.json({
        success: true,
        data: safeResponse
      });
      
    } catch (error) {
      console.error('Database error:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to save transcription'
      }, { status: 500 });
    }
    
  } catch (error: unknown) {
    console.error('Transcribe error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process transcription'
    }, { status: 500 });
  }
} 