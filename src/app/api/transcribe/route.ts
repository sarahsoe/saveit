import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getPythonTranscript } from '@/lib/python-transcript';
import { getWhisperTranscript, checkYtDlpAvailable } from '@/lib/whisper-transcript';

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

async function getTranscriptViaLibrary(videoId: string) {
  // Your existing Node.js transcript code
  try {
    const { YoutubeTranscript } = await import('youtube-transcript');
    const transcriptArray = await YoutubeTranscript.fetchTranscript(videoId);
    const transcript = transcriptArray.map(item => item.text).join(' ');
    
    if (transcript && transcript.length > 50) {
      return {
        transcript: transcript,
        title: null,
        source: 'youtube_transcript_nodejs'
      };
    }
    throw new Error('Insufficient transcript content');
  } catch (error) {
    throw new Error(`Node.js transcript library failed: ${error}`);
  }
}

// Enhanced version of your existing system - keeps everything but makes it Vercel-compatible
async function getUniversalTranscript(videoUrl: string) {
  const videoId = extractYouTubeId(videoUrl);
  if (!videoId) {
    throw new Error('Invalid YouTube URL');
  }
  
  const normalizedUrl = `https://www.youtube.com/watch?v=${videoId}`;
  console.log(`🎬 Starting enhanced 3-tier transcript extraction for: ${videoId}`);
  
  let errors: string[] = [];
  
  // 🥇 TIER 1: Enhanced Node.js Methods (Fastest, Free)
  console.log('🚀 TIER 1: Enhanced Node.js transcript methods...');
  try {
    const nodeResult = await tryEnhancedNodeMethods(videoId);
    if (nodeResult.transcript && nodeResult.transcript.length > 100) {
      console.log('✅ TIER 1 SUCCESS: Enhanced Node.js method worked!');
      return {
        transcript: nodeResult.transcript,
        title: nodeResult.title || 'YouTube Video',
        source: 'tier1_enhanced_nodejs',
        cost: 0,
        tier: 1
      };
    }
  } catch (error) {
    const errorMsg = `Tier 1 (Enhanced Node.js): ${error}`;
    console.log('❌ TIER 1 FAILED:', errorMsg);
    errors.push(errorMsg);
  }
  
  // 🥈 TIER 2: Node.js youtube-dl-exec (Medium Speed, Free, Vercel Compatible)
  console.log('🔧 TIER 2: Node.js youtube-dl-exec method...');
  try {
    const youtubeDlResult = await tryYoutubeDlExec(videoUrl);
    if (youtubeDlResult.transcript && youtubeDlResult.transcript.length > 100) {
      console.log('✅ TIER 2 SUCCESS: youtube-dl-exec method worked!');
      return {
        transcript: youtubeDlResult.transcript,
        title: youtubeDlResult.title || 'YouTube Video',
        source: 'tier2_youtubedl_exec',
        cost: 0,
        tier: 2
      };
    }
  } catch (error) {
    const errorMsg = `Tier 2 (youtube-dl-exec): ${error}`;
    console.log('❌ TIER 2 FAILED:', errorMsg);
    errors.push(errorMsg);
  }
  
  // 🥉 TIER 3: Whisper AI (Universal, Paid, Always Works)
  console.log('🎤 TIER 3: Whisper AI transcription...');
  try {
    const whisperResult = await getWhisperTranscript(normalizedUrl);
    if (whisperResult.success && whisperResult.transcript) {
      console.log(`✅ TIER 3 SUCCESS: Whisper AI worked! Cost: $${whisperResult.cost?.toFixed(3)}`);
      return {
        transcript: whisperResult.transcript,
        title: whisperResult.title || 'YouTube Video',
        source: 'tier3_whisper_ai',
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

// Enhanced Tier 1: Multiple Node.js approaches
async function tryEnhancedNodeMethods(videoId: string) {
  // Method 1.1: Standard youtube-transcript
  try {
    const { YoutubeTranscript } = await import('youtube-transcript');
    const transcriptArray = await YoutubeTranscript.fetchTranscript(videoId);
    const transcript = transcriptArray.map(item => item.text).join(' ');
    
    if (transcript && transcript.length > 50) {
      return { transcript, title: null, source: 'youtube_transcript_standard' };
    }
  } catch (error) {
    console.log('Method 1.1 failed:', error);
  }

  // Method 1.2: Try different language codes
  try {
    const { YoutubeTranscript } = await import('youtube-transcript');
    const languages = ['en', 'en-US', 'en-GB', 'auto'];
    
    for (const lang of languages) {
      try {
        const transcriptArray = await YoutubeTranscript.fetchTranscript(videoId, { lang });
        const transcript = transcriptArray.map(item => item.text).join(' ');
        
        if (transcript && transcript.length > 50) {
          return { transcript, title: null, source: `youtube_transcript_${lang}` };
        }
      } catch (langError) {
        continue;
      }
    }
  } catch (error) {
    console.log('Method 1.2 failed:', error);
  }

  throw new Error('All enhanced Node.js methods failed');
}

// New Tier 2: youtube-dl-exec (Vercel compatible)
async function tryYoutubeDlExec(videoUrl: string) {
  try {
    // This package works in Vercel without system dependencies
    const youtubeDl = await import('youtube-dl-exec');
    
    // Try to get subtitle information
    const info = await youtubeDl.default(videoUrl, {
      dumpJson: true,
      writeAutoSub: true,
      subLang: 'en',
      skipDownload: true
    });
    
    // Cast info to any to access dynamic properties
    const infoAny = info as any;
    // Extract any available subtitle text from the info
    if (infoAny.requested_subtitles && infoAny.requested_subtitles.en) {
      // Try to get subtitle content
      const subUrl = infoAny.requested_subtitles.en.url;
      const response = await fetch(subUrl);
      const subContent = await response.text();
      
      // Parse subtitle content (VTT or SRT format)
      const transcript = parseSubtitleContent(subContent);
      
      if (transcript && transcript.length > 50) {
        return {
          transcript,
          title: infoAny.title || 'YouTube Video',
          source: 'youtubedl_subtitles'
        };
      }
    }
    
    throw new Error('No subtitles found via youtube-dl-exec');
  } catch (error) {
    throw new Error(`youtube-dl-exec failed: ${error}`);
  }
}

function parseSubtitleContent(content: string): string {
  // Simple parser for VTT/SRT subtitle formats
  try {
    // Remove timestamps and formatting
    const lines = content.split('\n');
    const textLines = lines.filter(line => {
      // Filter out timestamp lines and empty lines
      return line.trim() && 
             !line.includes('-->') && 
             !line.match(/^\d+$/) &&
             !line.startsWith('WEBVTT') &&
             !line.startsWith('NOTE');
    });
    
    return textLines.join(' ').trim();
  } catch (error) {
    return '';
  }
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
    
    // Get transcript using 3-tier system
    let transcriptResult;
    try {
      transcriptResult = await getUniversalTranscript(videoUrl);
      console.log(`📝 Success via ${transcriptResult.source} (Tier ${transcriptResult.tier})`);
      console.log(`💰 Cost: $${transcriptResult.cost?.toFixed(3) || '0.000'}`);
    } catch (_error) {
      const errorMsg = _error instanceof Error ? _error.message : String(_error);
      console.error('All transcript methods failed:', errorMsg);
      return NextResponse.json({
        success: false,
        error: 'Unable to extract transcript from this video. This video may not have accessible audio content, may be private, or may have technical restrictions. Please try a different video.',
        details: process.env.NODE_ENV === 'development' ? errorMsg : undefined
      }, { status: 422 });
    }
    
    // Validate content quality
    if (transcriptResult.transcript.length < 50) {
      return NextResponse.json({
        success: false,
        error: 'Video content is too short to process meaningfully. Please try a video with more substantial spoken content.'
      }, { status: 422 });
    }
    
    // Process with Claude AI
    const startTime = Date.now();
    let cleanedTranscript = '';
    let summary = '';
    let keyPoints: string[] = [];
    let inputTokens = 0;
    let outputTokens = 0;
    let claudeCost = 0;
    
    try {
      console.log('🤖 Processing with Claude AI...');
      
      const anthropic = new (await import('@anthropic-ai/sdk')).default({
        apiKey: process.env.ANTHROPIC_API_KEY!,
      });
      
      const prompt = `Please analyze this video transcript and provide:

1. A cleaned, well-formatted transcript with proper punctuation and paragraphs
2. A concise summary (2-3 paragraphs)
3. Key points (5-7 bullet points highlighting the main insights)

Video Title: ${transcriptResult.title}
Transcript Source: ${transcriptResult.source}
Content Length: ${transcriptResult.transcript.length} characters

Please format your response as JSON:
{
  "cleaned_transcript": "...",
  "summary": "...",
  "key_points": ["point 1", "point 2", ...]
}

Original transcript:
${transcriptResult.transcript}`;
      
      const message = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 4000,
        messages: [{
          role: "user",
          content: prompt
        }]
      });
      
      // Parse Claude's response
      let response = '';
      const contentBlock = message.content[0];
      if (typeof contentBlock === 'object' && 'text' in contentBlock && typeof contentBlock.text === 'string') {
        response = contentBlock.text;
      } else {
        throw new Error('Claude API did not return text content');
      }
      
      try {
        // Try to parse as JSON first
        const parsed = JSON.parse(response);
        cleanedTranscript = parsed.cleaned_transcript || response;
        summary = parsed.summary || '';
        keyPoints = Array.isArray(parsed.key_points) ? parsed.key_points : [];
      } catch {
        console.log('⚠️ Claude response not JSON, using fallback parsing');
        // Fallback: use entire response as cleaned transcript
        cleanedTranscript = response;
        
        // Try to extract summary and key points from response
        const lines = response.split('\n').filter((line: string) => line.trim());
        summary = lines.slice(0, 3).join('\n');
        keyPoints = lines
          .filter((line: string) => line.trim().match(/^[•\-\*\d\.]/))
          .slice(0, 7)
          .map((line: string) => line.replace(/^[•\-\*\d\.]\s*/, '').trim());
      }
      
      inputTokens = message.usage.input_tokens;
      outputTokens = message.usage.output_tokens;
      claudeCost = (inputTokens * 0.003 + outputTokens * 0.015) / 1000;
      
      console.log(`✅ Claude processing complete. Tokens: ${inputTokens}+${outputTokens}, Cost: $${claudeCost.toFixed(4)}`);
      
    } catch (error: unknown) {
      console.error('Error processing with Claude:', error);
      let errorMsg = 'Failed to process transcript with AI. Please try again.';
      if (error instanceof Error) errorMsg = error.message;
      return NextResponse.json({
        success: false,
        error: errorMsg,
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : String(error)) : undefined
      }, { status: 500 });
    }
    
    const processingTime = Math.round((Date.now() - startTime) / 1000);
    const totalCost = (transcriptResult.cost || 0) + claudeCost;
    
    // Save to database with enhanced metadata
    try {
      const videoId = extractYouTubeId(videoUrl);
      const normalizedUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : videoUrl;
      
      const { data, error } = await supabase
        .from('transcriptions')
        .insert({
          video_url: normalizedUrl,
          video_title: transcriptResult.title || 'YouTube Video',
          video_duration: 0, // Could be enhanced to get actual duration
          raw_transcript: transcriptResult.transcript,
          cleaned_transcript: cleanedTranscript || '',
          summary: summary || '',
          key_points: keyPoints || [],
          input_tokens: inputTokens || 0,
          output_tokens: outputTokens || 0,
          cost: totalCost || 0, // Combined Whisper + Claude cost
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
      
      // Return safe response with metadata
      const safeResponse = {
        ...data,
        key_points: data.key_points || [],
        video_title: data.video_title || '',
        raw_transcript: data.raw_transcript || '',
        cleaned_transcript: data.cleaned_transcript || '',
        summary: data.summary || '',
        // Add processing metadata
        processing_metadata: {
          tier_used: transcriptResult.tier,
          source: transcriptResult.source,
          transcript_cost: transcriptResult.cost || 0,
          claude_cost: claudeCost,
          total_cost: totalCost,
          processing_time: processingTime
        }
      };
      
      console.log(`🎉 Transcription complete! Tier ${transcriptResult.tier}, Total cost: $${totalCost.toFixed(4)}`);
      
      return NextResponse.json({
        success: true,
        data: safeResponse
      });
      
    } catch (error: unknown) {
      console.error('Database error:', error);
      let errorMsg = 'Failed to save transcription';
      if (error instanceof Error) errorMsg = error.message;
      return NextResponse.json({
        success: false,
        error: errorMsg
      }, { status: 500 });
    }
    
  } catch (error: unknown) {
    console.error('Transcribe error:', error);
    let errorMsg = 'Failed to process transcription';
    if (error instanceof Error) errorMsg = error.message;
    return NextResponse.json({
      success: false,
      error: errorMsg,
      details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : String(error)) : undefined
    }, { status: 500 });
  }
} 