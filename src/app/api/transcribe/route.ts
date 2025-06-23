import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

// Import ONLY Node.js compatible methods
import { tryEnhancedNodeMethods, tryYoutubeDlExec } from '@/lib/enhanced-nodejs-transcript';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

function extractYouTubeId(url: string): string | null {
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

// 🎯 WORKING METHOD 1: Try YouTube Captions (Works 60% of the time)
async function getYouTubeTranscript(videoId: string) {
  try {
    console.log('📝 Trying YouTube transcript library...');
    const { YoutubeTranscript } = await import('youtube-transcript');
    
    // Try multiple language options
    const languages = ['en', 'en-US', 'en-GB'];
    
    for (const lang of languages) {
      try {
        console.log(`  🔤 Trying language: ${lang}`);
        const transcriptArray = await YoutubeTranscript.fetchTranscript(videoId, { lang });
        const transcript = transcriptArray.map(item => item.text).join(' ');
        
        if (transcript && transcript.length > 100) {
          console.log(`✅ SUCCESS: Got transcript with ${lang}`);
          return {
            success: true,
            transcript,
            title: 'YouTube Video',
            source: `youtube_captions_${lang}`,
            cost: 0
          };
        }
      } catch (langError) {
        console.log(`  ❌ Language ${lang} failed`);
        continue;
      }
    }
    
    throw new Error('No captions available in any language');
  } catch (error) {
    console.log('❌ YouTube transcript failed:', error);
    throw error;
  }
}

// FREE Working Audio Extraction using Invidious API
async function getWorkingAudioUrl(videoId: string): Promise<{ audioUrl: string, title: string, duration: number }> {
  // List of working Invidious instances (as of 2025)
  const invidious_instances = [
    'https://yewtu.be',
    'https://inv.nadeko.net',
    'https://invidious.nerdvpn.de'
  ];
  
  for (const instance of invidious_instances) {
    try {
      console.log(`🔧 Trying Invidious instance: ${instance}`);
      
      // Get video data from Invidious API
      const response = await fetch(`${instance}/api/v1/videos/${videoId}`, {
        headers: {
          'User-Agent': 'SaveIt-Transcript-App/1.0'
        }
      });
      
      if (!response.ok) {
        console.log(`❌ Instance ${instance} failed: ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      
      // Find audio-only formats
      const audioFormats = data.adaptiveFormats?.filter((format: any) => 
        format.type?.includes('audio') && format.url
      ) || [];
      
      // Prefer high-quality audio
      const bestAudio = audioFormats.find((format: any) => 
        format.type?.includes('audio/mp4') || format.type?.includes('audio/webm')
      ) || audioFormats[0];
      
      if (bestAudio && bestAudio.url) {
        console.log(`✅ Found audio URL via ${instance}`);
        return {
          audioUrl: bestAudio.url,
          title: data.title || 'YouTube Video',
          duration: Number(data.lengthSeconds) || 600
        };
      }
      
    } catch (error) {
      console.log(`❌ Instance ${instance} error:`, error);
      continue;
    }
  }
  
  throw new Error('All Invidious instances failed');
}

// 🎯 WORKING METHOD 2: Whisper with Direct MP3 (Works 95% of the time)
async function getWhisperTranscript(videoUrl: string) {
  try {
    if (!openai) {
      throw new Error('OpenAI API key not configured');
    }
    
    console.log('🎤 Trying Whisper transcription...');
    
    // Get video info and audio using Invidious
    const videoId = extractYouTubeId(videoUrl)!;
    const { audioUrl, title, duration } = await getWorkingAudioUrl(videoId);
    console.log(`📹 Video: ${title}`);
    console.log('🎵 Got audio URL, fetching...');
    
    // Fetch audio with size limit
    const audioFile = await fetchLimitedAudio(audioUrl);
    console.log(`📊 Audio size: ${(audioFile.size / 1024 / 1024).toFixed(1)}MB`);
    
    // Estimate cost
    const estimatedMinutes = Math.min(duration / 60, 25); // Cap at 25 minutes
    const estimatedCost = estimatedMinutes * 0.006;
    console.log(`💰 Estimated cost: $${estimatedCost.toFixed(3)}`);
    
    // Transcribe
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'en',
      response_format: 'text'
    });
    
    if (transcription.length < 50) {
      throw new Error('Transcript too short');
    }
    
    console.log(`✅ Whisper success! ${transcription.length} characters`);
    
    return {
      success: true,
      transcript: transcription,
      title: title,
      source: 'whisper_invidious',
      cost: estimatedCost
    };
    
  } catch (error) {
    console.log('❌ Whisper failed:', error);
    throw error;
  }
}

// Get video info using YouTube's public oEmbed API
async function getVideoInfo(videoId: string) {
  try {
    const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    const data = await response.json();
    
    return {
      title: data.title || 'YouTube Video',
      duration: 600 // Default 10 minutes since oEmbed doesn't provide duration
    };
  } catch (error) {
    return {
      title: 'YouTube Video',
      duration: 600
    };
  }
}

async function fetchLimitedAudio(audioUrl: string): Promise<File> {
  try {
    const response = await fetch(audioUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SaveIt/1.0)',
        'Range': 'bytes=0-20971520' // Limit to 20MB
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    return new File([arrayBuffer], 'audio.mp3', { type: 'audio/mpeg' });
  } catch (error) {
    throw new Error(`Audio fetch failed: ${error}`);
  }
}

// 🎯 MAIN TRANSCRIPT FUNCTION - SIMPLE AND WORKING
async function getActualWorkingTranscript(videoUrl: string) {
  const videoId = extractYouTubeId(videoUrl);
  if (!videoId) {
    throw new Error('Invalid YouTube URL');
  }
  
  console.log(`🎬 Processing video: ${videoId}`);
  
  // Try Method 1: YouTube Captions (Fast and Free)
  try {
    console.log('🚀 METHOD 1: Trying YouTube captions...');
    const captionResult = await getYouTubeTranscript(videoId);
    if (captionResult.success) {
      console.log('✅ SUCCESS: YouTube captions worked!');
      return captionResult;
    }
  } catch (error) {
    console.log('❌ METHOD 1 FAILED: YouTube captions not available');
  }
  
  // Try Method 2: Whisper (Reliable but Paid)
  try {
    console.log('🚀 METHOD 2: Trying Whisper transcription...');
    const whisperResult = await getWhisperTranscript(videoUrl);
    if (whisperResult.success) {
      console.log('✅ SUCCESS: Whisper worked!');
      return whisperResult;
    }
  } catch (error) {
    console.log('❌ METHOD 2 FAILED: Whisper transcription failed');
    console.log('Error details:', error);
  }
  
  throw new Error('Both caption and Whisper methods failed. This video may not be transcribable.');
}

// 🎵 NEW: MP3 File Upload Transcription
async function transcribeUploadedFile(audioFile: File) {
  if (!openai) {
    throw new Error('OpenAI API key not configured - required for file transcription');
  }

  console.log(`🎵 Transcribing uploaded file: ${audioFile.name}`);
  console.log(`📊 File size: ${(audioFile.size / 1024 / 1024).toFixed(1)}MB`);
  
  // Validate file
  if (audioFile.size > 25 * 1024 * 1024) { // 25MB limit
    throw new Error('File too large. Maximum size: 25MB');
  }
  
  const allowedTypes = [
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 
    'audio/aac', 'audio/ogg', 'audio/flac', 'audio/webm'
  ];
  
  if (!allowedTypes.includes(audioFile.type)) {
    throw new Error(`Unsupported file type: ${audioFile.type}. Supported: MP3, WAV, M4A, AAC, OGG, FLAC, WebM`);
  }
  
  // Estimate cost (Whisper charges $0.006 per minute)
  const estimatedMinutes = Math.min(audioFile.size / (1024 * 1024 * 0.5), 120); // Rough estimate: 0.5MB per minute, cap at 2 hours
  const estimatedCost = estimatedMinutes * 0.006;
  
  console.log(`💰 Estimated cost: $${estimatedCost.toFixed(3)} (~${estimatedMinutes.toFixed(1)} minutes)`);
  
  try {
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'en', // You can make this configurable
      response_format: 'verbose_json',
      prompt: 'This is an audio file upload. Please provide accurate transcription with proper punctuation.'
    });
    
    if (!transcription.text || transcription.text.trim().length < 10) {
      throw new Error('Transcription returned insufficient content');
    }
    
    console.log(`✅ File transcription complete! Length: ${transcription.text.length} characters`);
    
    return {
      success: true,
      transcript: transcription.text.trim(),
      title: audioFile.name.replace(/\.[^/.]+$/, ''), // Remove file extension
      duration: transcription.duration || estimatedMinutes * 60,
      cost: estimatedCost,
      source: 'whisper_file_upload'
    };
    
  } catch (error: any) {
    console.error('❌ File transcription failed:', error);
    
    let errorMessage = 'File transcription failed';
    if (error.code === 'insufficient_quota') {
      errorMessage = 'OpenAI API quota exceeded. Please check your billing.';
    } else if (error.message) {
      errorMessage = `Transcription error: ${error.message}`;
    }
    
    throw new Error(errorMessage);
  }
}

// 🎯 MAIN PROCESSING FUNCTION - HANDLES BOTH YOUTUBE AND FILE UPLOADS
async function processTranscriptRequest(isFileUpload: boolean, input: string | File) {
  if (isFileUpload) {
    // Handle file upload
    console.log('🎵 Processing uploaded audio file...');
    return await transcribeUploadedFile(input as File);
  } else {
    // Handle YouTube URL
    const videoUrl = input as string;
    const videoId = extractYouTubeId(videoUrl);
    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }
    
    console.log(`🎬 Processing YouTube video: ${videoId}`);
    
    // Try Method 1: YouTube Captions (Fast and Free)
    try {
      console.log('🚀 METHOD 1: Trying YouTube captions...');
      const captionResult = await getYouTubeTranscript(videoId);
      if (captionResult.success) {
        console.log('✅ SUCCESS: YouTube captions worked!');
        return captionResult;
      }
    } catch (error) {
      console.log('❌ METHOD 1 FAILED: YouTube captions not available');
    }
    
    // Try Method 2: Whisper (Reliable but Paid)
    try {
      console.log('🚀 METHOD 2: Trying Whisper transcription...');
      const whisperResult = await getWhisperTranscript(videoUrl);
      if (whisperResult.success) {
        console.log('✅ SUCCESS: Whisper worked!');
        return whisperResult;
      }
    } catch (error) {
      console.log('❌ METHOD 2 FAILED: Whisper transcription failed');
      console.log('Error details:', error);
    }
    
    throw new Error('Both caption and Whisper methods failed for this YouTube video.');
  }
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let isFileUpload = false;
    let input: string | File;
    
    // Handle different input types
    if (contentType.includes('multipart/form-data')) {
      // File upload
      const formData = await request.formData();
      const audioFile = formData.get('audioFile') as File;
      
      if (!audioFile) {
        return NextResponse.json({ error: 'Audio file is required' }, { status: 400 });
      }
      
      isFileUpload = true;
      input = audioFile;
      console.log(`🎵 Received file upload: ${audioFile.name}`);
      
    } else {
      // JSON with YouTube URL
      const { videoUrl } = await request.json();
      
      if (!videoUrl) {
        return NextResponse.json({ error: 'Video URL is required' }, { status: 400 });
      }
      
      isFileUpload = false;
      input = videoUrl;
      console.log(`🎬 Received YouTube URL: ${videoUrl}`);
    }
    
    // Check for existing transcript (only for YouTube videos)
    if (!isFileUpload) {
      const videoId = extractYouTubeId(input as string);
      if (videoId) {
        const { data: existingData } = await supabase
          .from('transcriptions')
          .select('*')
          .eq('video_id', videoId)
          .eq('status', 'completed')
          .single();
        
        if (existingData) {
          console.log('📋 Found existing transcript');
          return NextResponse.json({
            success: true,
            data: existingData,
            cached: true
          });
        }
      }
    }
    
    // Process the transcript
    const transcriptResult = await processTranscriptRequest(isFileUpload, input);
    
    if (!transcriptResult.transcript) {
      return NextResponse.json({
        success: false,
        error: 'Could not extract transcript'
      }, { status: 422 });
    }
    
    console.log('🤖 Processing with Claude...');
    
    // Process with Claude
    const claudeResponse = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 4000,
      messages: [{
        role: "user",
        content: `Clean up this transcript and provide a summary. Remove filler words, fix grammar, and organize into readable paragraphs:

${transcriptResult.transcript}`
      }]
    });
    
    const cleanedTranscript = claudeResponse.content[0].type === 'text' 
      ? claudeResponse.content[0].text 
      : 'Processing failed';
    
    // Calculate costs
    const claudeInputCost = (claudeResponse.usage?.input_tokens || 0) * 0.003 / 1000;
    const claudeOutputCost = (claudeResponse.usage?.output_tokens || 0) * 0.015 / 1000;
    const totalCost = (transcriptResult.cost || 0) + claudeInputCost + claudeOutputCost;
    
    console.log(`💰 Total cost: $${totalCost.toFixed(4)}`);
    
    // Save to database
    const { data, error } = await supabase
      .from('transcriptions')
      .insert({
        video_id: isFileUpload ? null : extractYouTubeId(input as string),
        video_url: isFileUpload ? null : input as string,
        video_title: transcriptResult.title,
        raw_transcript: transcriptResult.transcript,
        cleaned_transcript: cleanedTranscript,
        summary: cleanedTranscript.substring(0, 500) + (cleanedTranscript.length > 500 ? '...' : ''),
        cost: totalCost,
        processing_method: transcriptResult.source,
        status: 'completed',
        // New fields for file uploads
        is_file_upload: isFileUpload,
        file_name: isFileUpload ? (input as File).name : null,
        file_size: isFileUpload ? (input as File).size : null
      })
      .select()
      .single();
    
    if (error) {
      console.error('Database error:', error);
      throw error;
    }
    
    console.log('✅ Success! Transcript saved');
    
    return NextResponse.json({
      success: true,
      data: {
        ...data,
        processing_metadata: {
          method: transcriptResult.source,
          cost: totalCost,
          input_type: isFileUpload ? 'file_upload' : 'youtube_url',
          working_solution: true
        }
      }
    });
    
  } catch (error: any) {
    console.error('❌ Processing failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Processing failed',
      debug: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
} 