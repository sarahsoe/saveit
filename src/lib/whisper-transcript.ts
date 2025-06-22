import OpenAI from 'openai';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

interface WhisperResult {
  success: boolean;
  transcript?: string;
  title?: string;
  duration?: number;
  error?: string;
  cost?: number;
  source: string;
}

export async function getWhisperTranscript(videoUrl: string): Promise<WhisperResult> {
  try {
    // Check if OpenAI is available
    if (!openai || !process.env.OPENAI_API_KEY) {
      return {
        success: false,
        error: 'OpenAI API key not configured',
        source: 'whisper_config_error'
      };
    }

    console.log('🎵 Starting Whisper transcription (Vercel compatible)...');
    
    // Step 1: Get video metadata and audio URL using youtube-dl-exec
    const { title, audioUrl, duration } = await getVideoDataWithAudio(videoUrl);
    console.log(`📹 Video: ${title}`);
    
    // Step 2: Fetch audio file
    console.log('🎵 Fetching audio stream...');
    const audioFile = await fetchAudioStream(audioUrl);
    
    // Step 3: Estimate cost
    const estimatedMinutes = duration ? duration / 60 : 10; // Default 10 minutes
    const estimatedCost = estimatedMinutes * 0.006;
    
    console.log(`💰 Estimated cost: $${estimatedCost.toFixed(3)} (${estimatedMinutes.toFixed(1)} minutes)`);
    
    // Step 4: Transcribe with Whisper
    console.log('🎤 Transcribing with Whisper API...');
    
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'en',
      response_format: 'verbose_json',
      prompt: 'This is a YouTube video transcript. Please provide accurate transcription with proper punctuation.'
    });
    
    if (!transcription.text || transcription.text.trim().length < 50) {
      return {
        success: false,
        error: 'Whisper returned insufficient transcript content',
        cost: estimatedCost,
        source: 'whisper_insufficient_content'
      };
    }
    
    console.log(`✅ Whisper transcription complete! Length: ${transcription.text.length} chars`);
    
    return {
      success: true,
      transcript: transcription.text.trim(),
      title: title,
      duration: duration,
      cost: estimatedCost,
      source: 'whisper_api_vercel'
    };
    
  } catch (error: any) {
    console.error('❌ Whisper transcription failed:', error);
    
    let errorMessage = 'Whisper transcription failed';
    
    if (error.code === 'insufficient_quota') {
      errorMessage = 'OpenAI API quota exceeded. Please check your OpenAI account billing.';
    } else if (error.code === 'invalid_api_key') {
      errorMessage = 'Invalid OpenAI API key. Please check your configuration.';
    } else if (error.message) {
      errorMessage = `Whisper error: ${error.message}`;
    }
    
    return {
      success: false,
      error: errorMessage,
      cost: 0,
      source: 'whisper_api_error'
    };
  }
}

async function getVideoDataWithAudio(videoUrl: string) {
  try {
    // Use youtube-dl-exec (works in Vercel)
    const youtubeDl = await import('youtube-dl-exec');
    
    console.log('📋 Getting video metadata and audio URL...');
    
    const info = await youtubeDl.default(videoUrl, {
      dumpJson: true,
      format: 'bestaudio[ext=m4a]/bestaudio/best[height<=480]',
      getUrl: true
    });
    
    // Cast info to any to access dynamic properties
    const infoAny = info as any;
    
    // Get audio URL
    const audioUrls = await youtubeDl.default(videoUrl, {
      getUrl: true,
      format: 'bestaudio[ext=m4a]/bestaudio/best[height<=480]',
      noWarnings: true
    });
    
    const audioUrl = Array.isArray(audioUrls) ? audioUrls[0] : audioUrls;
    
    return {
      title: infoAny.title || 'YouTube Video',
      duration: infoAny.duration || 600,
      audioUrl: audioUrl
    };
    
  } catch (error) {
    throw new Error(`Failed to get video data: ${error}`);
  }
}

async function fetchAudioStream(audioUrl: string): Promise<File> {
  try {
    console.log('🌐 Fetching audio stream...');
    
    const response = await fetch(audioUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WhisperTranscript/1.0)'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    
    // Check file size (limit to 25MB to prevent excessive costs)
    const fileSizeMB = arrayBuffer.byteLength / (1024 * 1024);
    console.log(`📊 Audio file size: ${fileSizeMB.toFixed(1)}MB`);
    
    if (fileSizeMB > 25) {
      throw new Error(`Audio file too large (${fileSizeMB.toFixed(1)}MB). Maximum: 25MB to prevent excessive costs.`);
    }
    
    // Create File object for OpenAI API
    const file = new File([arrayBuffer], 'audio.m4a', { 
      type: 'audio/m4a' 
    });
    
    return file;
    
  } catch (error) {
    throw new Error(`Failed to fetch audio stream: ${error}`);
  }
}

// Helper function to check if youtube-dl-exec is available
export async function checkYoutubeDlAvailable(): Promise<boolean> {
  try {
    const youtubeDl = await import('youtube-dl-exec');
    // Try a simple version check
    await youtubeDl.default('--version');
    return true;
  } catch (_error) {
    return false;
  }
} 