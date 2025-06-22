import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

// Import ONLY Node.js compatible methods
import { getWhisperTranscript } from '@/lib/whisper-transcript';
import { tryEnhancedNodeMethods, tryYoutubeDlExec } from '@/lib/enhanced-nodejs-transcript';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

function extractYouTubeId(url: string): string | null {
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

// 🚀 UNIVERSAL TRANSCRIPT FUNCTION - VERCEL COMPATIBLE
async function getUniversalTranscript(videoUrl: string) {
  const videoId = extractYouTubeId(videoUrl);
  if (!videoId) {
    throw new Error('Invalid YouTube URL');
  }
  
  const normalizedUrl = `https://www.youtube.com/watch?v=${videoId}`;
  console.log(`🎬 Starting 3-tier transcript extraction for: ${videoId}`);
  
  const errors: string[] = [];
  
  // 🥇 TIER 1: Enhanced Node.js Methods (Fastest, Free)
  console.log('🚀 TIER 1: Trying enhanced Node.js transcript methods...');
  try {
    const nodeResult = await tryEnhancedNodeMethods(videoId);
    if (nodeResult.success && nodeResult.transcript && nodeResult.transcript.length > 100) {
      console.log('✅ TIER 1 SUCCESS: Enhanced Node.js method worked!');
      return {
        transcript: nodeResult.transcript,
        title: nodeResult.title || 'YouTube Video',
        source: `tier1_${nodeResult.source}`,
        cost: 0,
        tier: 1
      };
    } else {
      throw new Error(nodeResult.error || 'Enhanced Node.js methods failed');
    }
  } catch (error) {
    const errorMsg = `Tier 1 (Enhanced Node.js): ${error}`;
    console.log('❌ TIER 1 FAILED:', errorMsg);
    errors.push(errorMsg);
  }
  
  // 🥈 TIER 2: youtube-dl-exec Subtitles (Medium Speed, Free, Vercel Compatible)
  console.log('🔧 TIER 2: Trying youtube-dl-exec subtitle extraction...');
  try {
    const youtubeDlResult = await tryYoutubeDlExec(normalizedUrl);
    if (youtubeDlResult.success && youtubeDlResult.transcript && youtubeDlResult.transcript.length > 100) {
      console.log('✅ TIER 2 SUCCESS: youtube-dl-exec subtitle method worked!');
      return {
        transcript: youtubeDlResult.transcript,
        title: youtubeDlResult.title || 'YouTube Video',
        source: `tier2_${youtubeDlResult.source}`,
        cost: 0,
        tier: 2
      };
    } else {
      throw new Error(youtubeDlResult.error || 'youtube-dl-exec subtitle method failed');
    }
  } catch (error) {
    const errorMsg = `Tier 2 (youtube-dl-exec subtitles): ${error}`;
    console.log('❌ TIER 2 FAILED:', errorMsg);
    errors.push(errorMsg);
  }
  
  // 🥉 TIER 3: Whisper AI with youtube-dl-exec (Universal, Paid, Always Works)
  console.log('🎤 TIER 3: Trying Whisper AI transcription (Vercel compatible)...');
  try {
    const whisperResult = await getWhisperTranscript(normalizedUrl);
    if (whisperResult.success && whisperResult.transcript) {
      console.log(`✅ TIER 3 SUCCESS: Whisper AI worked! Cost: $${whisperResult.cost?.toFixed(3)}`);
      return {
        transcript: whisperResult.transcript,
        title: whisperResult.title || 'YouTube Video',
        source: whisperResult.source,
        cost: whisperResult.cost || 0,
        tier: 3
      };
    } else {
      throw new Error(whisperResult.error || 'Whisper method failed');
    }
  } catch (error) {
    const errorMsg = `Tier 3 (Whisper): ${error}`;
    console.log('❌ TIER 3 FAILED:', errorMsg);
    errors.push(errorMsg);
  }
  
  // 💥 ALL TIERS FAILED
  console.log('💥 ALL TIERS FAILED - No transcript available');
  throw new Error(`All transcript methods failed:\n${errors.join('\n')}`);
}

export async function POST(request: NextRequest) {
  try {
    const { videoUrl } = await request.json();
    
    if (!videoUrl) {
      return NextResponse.json({ error: 'Video URL is required' }, { status: 400 });
    }
    
    console.log(`🎬 Processing video: ${videoUrl}`);
    
    // Check if we already have this transcript
    const videoId = extractYouTubeId(videoUrl);
    if (videoId) {
      const { data: existingData } = await supabase
        .from('transcriptions')
        .select('*')
        .eq('video_id', videoId)
        .eq('status', 'completed')
        .single();
      
      if (existingData) {
        console.log('📋 Found existing transcript in database');
        return NextResponse.json({
          success: true,
          data: existingData,
          cached: true
        });
      }
    }
    
    // Get transcript using 3-tier system (VERCEL COMPATIBLE)
    const transcriptResult = await getUniversalTranscript(videoUrl);
    
    if (!transcriptResult.transcript) {
      return NextResponse.json({
        success: false,
        error: 'No transcript could be extracted from this video'
      }, { status: 422 });
    }
    
    console.log('🤖 Processing transcript with Claude...');
    
    // Process with Claude
    const claudeResponse = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 4000,
      messages: [{
        role: "user",
        content: `Please clean up this transcript and provide a concise summary. Remove filler words, fix grammar, and organize it into readable paragraphs:

${transcriptResult.transcript}`
      }]
    });
    
    const cleanedTranscript = claudeResponse.content[0].type === 'text' 
      ? claudeResponse.content[0].text 
      : 'Processing failed';
    
    // Calculate total cost
    const claudeInputCost = (claudeResponse.usage?.input_tokens || 0) * 0.003 / 1000;
    const claudeOutputCost = (claudeResponse.usage?.output_tokens || 0) * 0.015 / 1000;
    const totalCost = (transcriptResult.cost || 0) + claudeInputCost + claudeOutputCost;
    
    console.log(`💰 Total processing cost: $${totalCost.toFixed(4)}`);
    
    // Save to database
    const { data, error } = await supabase
      .from('transcriptions')
      .insert({
        video_id: videoId,
        video_url: videoUrl,
        video_title: transcriptResult.title,
        raw_transcript: transcriptResult.transcript,
        cleaned_transcript: cleanedTranscript,
        summary: cleanedTranscript.substring(0, 500) + (cleanedTranscript.length > 500 ? '...' : ''),
        cost: totalCost,
        processing_method: transcriptResult.source,
        tier_used: transcriptResult.tier,
        status: 'completed'
      })
      .select()
      .single();
    
    if (error) {
      console.error('Database error:', error);
      throw error;
    }
    
    console.log('✅ Transcript saved to database successfully');
    
    return NextResponse.json({
      success: true,
      data: {
        ...data,
        processing_metadata: {
          tier_used: transcriptResult.tier,
          method: transcriptResult.source,
          cost: totalCost,
          vercel_compatible: true
        }
      }
    });
    
  } catch (error: any) {
    console.error('❌ Processing failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message || 'An unexpected error occurred while processing the video.',
      debug: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
} 