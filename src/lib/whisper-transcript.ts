import OpenAI from 'openai';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
  let tempAudioFile = '';
  
  try {
    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      return {
        success: false,
        error: 'OpenAI API key not configured',
        source: 'whisper_config_error'
      };
    }

    console.log('🎵 Starting Whisper transcription process...');
    
    // Step 1: Extract audio using yt-dlp
    console.log('🎵 Extracting audio from video...');
    tempAudioFile = await extractAudio(videoUrl);
    
    // Step 2: Check file size and estimate cost
    const stats = fs.statSync(tempAudioFile);
    const fileSizeMB = stats.size / (1024 * 1024);
    
    // Whisper API costs $0.006 per minute
    // Rough estimate: ~1MB per minute of audio
    const estimatedMinutes = fileSizeMB;
    const estimatedCost = estimatedMinutes * 0.006;
    
    console.log(`📊 Audio file: ${fileSizeMB.toFixed(1)}MB, estimated cost: $${estimatedCost.toFixed(3)}`);
    
    // Limit file size to prevent excessive costs (max 25MB = ~$0.15)
    if (fileSizeMB > 25) {
      fs.unlinkSync(tempAudioFile);
      return {
        success: false,
        error: `Audio file too large (${fileSizeMB.toFixed(1)}MB). Maximum supported: 25MB to prevent excessive costs.`,
        source: 'whisper_file_too_large'
      };
    }
    
    // Step 3: Transcribe with Whisper
    console.log('🎤 Transcribing with Whisper API...');
    
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempAudioFile),
      model: 'whisper-1',
      language: 'en', // Can be changed to 'auto' for auto-detection
      response_format: 'verbose_json', // Includes timestamps and metadata
      prompt: 'This is a YouTube video transcript. Please provide accurate transcription with proper punctuation.' // Helps with accuracy
    });
    
    // Step 4: Get video metadata
    let title = 'YouTube Video';
    let duration = 0;
    
    try {
      const metadata = await getVideoMetadata(videoUrl);
      title = metadata.title || title;
      duration = metadata.duration || duration;
    } catch (error) {
      console.log('⚠️ Could not get video metadata, using defaults');
    }
    
    // Step 5: Validate transcript quality
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
      source: 'whisper_api'
    };
    
  } catch (error: any) {
    console.error('❌ Whisper transcription failed:', error);
    
    // Handle specific OpenAI API errors
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
    
  } finally {
    // Always clean up temporary file
    if (tempAudioFile && fs.existsSync(tempAudioFile)) {
      try {
        fs.unlinkSync(tempAudioFile);
        console.log('🧹 Cleaned up temporary audio file');
      } catch (cleanupError) {
        console.error('⚠️ Failed to cleanup temp file:', cleanupError);
      }
    }
  }
}

async function extractAudio(videoUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Ensure temp directory exists
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Generate unique temporary file path
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const tempFile = path.join(tempDir, `audio_${timestamp}_${randomId}.mp3`);
    
    console.log(`🎵 Extracting audio to: ${tempFile}`);
    
    // Use yt-dlp to extract audio
    const ytdlpArgs = [
      '-x', // Extract audio only
      '--audio-format', 'mp3',
      '--audio-quality', '3', // Good quality but reasonable file size
      '--max-filesize', '25M', // Prevent huge files
      '-o', tempFile.replace('.mp3', '.%(ext)s'),
      '--no-playlist', // Only download single video
      '--ignore-errors', // Continue on minor errors
      videoUrl
    ];
    
    const ytdlp = spawn('yt-dlp', ytdlpArgs);
    
    let stderr = '';
    let stdout = '';
    
    ytdlp.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    ytdlp.stdout.on('data', (data) => {
      stdout += data.toString();
      // Show progress
      if (data.toString().includes('%')) {
        process.stdout.write('.');
      }
    });
    
    ytdlp.on('close', (code) => {
      console.log(''); // New line after progress dots
      
      if (code === 0) {
        // Check if file was created successfully
        if (fs.existsSync(tempFile)) {
          const stats = fs.statSync(tempFile);
          console.log(`✅ Audio extracted successfully: ${(stats.size / 1024 / 1024).toFixed(1)}MB`);
          resolve(tempFile);
        } else {
          reject(new Error('Audio file was not created by yt-dlp'));
        }
      } else {
        reject(new Error(`yt-dlp failed with code ${code}. Error: ${stderr.slice(-500)}`)); // Last 500 chars of error
      }
    });
    
    ytdlp.on('error', (error) => {
      reject(new Error(`Failed to start yt-dlp: ${error.message}. Make sure yt-dlp is installed: pip install yt-dlp`));
    });
    
    // Timeout after 5 minutes (some videos are long)
    setTimeout(() => {
      ytdlp.kill('SIGTERM');
      reject(new Error('Audio extraction timeout (5 minutes). Video may be too long or download too slow.'));
    }, 300000);
  });
}

async function getVideoMetadata(videoUrl: string): Promise<{title: string, duration: number}> {
  return new Promise((resolve, reject) => {
    const ytdlp = spawn('yt-dlp', [
      '--print', '%(title)s|||%(duration)s',
      '--no-download',
      '--ignore-errors',
      videoUrl
    ]);
    
    let stdout = '';
    let stderr = '';
    
    ytdlp.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    ytdlp.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    ytdlp.on('close', (code) => {
      if (code === 0 && stdout.trim()) {
        try {
          const [title, durationStr] = stdout.trim().split('|||');
          const duration = parseInt(durationStr) || 0;
          resolve({ 
            title: title?.trim() || 'YouTube Video', 
            duration 
          });
        } catch (error) {
          resolve({ title: 'YouTube Video', duration: 0 });
        }
      } else {
        // Don't reject, just return defaults
        resolve({ title: 'YouTube Video', duration: 0 });
      }
    });
    
    ytdlp.on('error', (error) => {
      // Don't reject, just return defaults
      resolve({ title: 'YouTube Video', duration: 0 });
    });
    
    // Shorter timeout for metadata
    setTimeout(() => {
      ytdlp.kill('SIGTERM');
      resolve({ title: 'YouTube Video', duration: 0 });
    }, 30000);
  });
}

// Helper function to check if yt-dlp is available
export async function checkYtDlpAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const ytdlp = spawn('yt-dlp', ['--version']);
    
    ytdlp.on('close', (code) => {
      resolve(code === 0);
    });
    
    ytdlp.on('error', () => {
      resolve(false);
    });
    
    setTimeout(() => {
      ytdlp.kill();
      resolve(false);
    }, 5000);
  });
} 