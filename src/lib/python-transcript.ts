// Node.js transcript fetcher for fallback logic
import { YoutubeTranscript } from 'youtube-transcript';
import { spawn } from 'child_process';
import path from 'path';
import { getWhisperTranscript } from './whisper-transcript';

interface PythonTranscriptResult {
  success: boolean;
  transcript?: string;
  title?: string;
  duration?: number;
  method?: string;
  type?: string;
  error?: string;
}

export async function getPythonTranscript(videoUrl: string): Promise<PythonTranscriptResult> {
  return new Promise((resolve, _reject) => {
    const scriptPath = path.join(process.cwd(), 'scripts', 'transcript_service.py');
    const python = spawn('python3', [scriptPath, videoUrl]);
    let stdout = '';
    let stderr = '';
    python.stdout.on('data', (data) => { stdout += data.toString(); });
    python.stderr.on('data', (data) => { stderr += data.toString(); });
    python.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout.trim());
          resolve(result);
        } catch (error) {
          resolve({ success: false, error: `Failed to parse Python output: ${stdout}` });
        }
      } else {
        resolve({ success: false, error: `Python script failed with code ${code}: ${stderr}` });
      }
    });
    python.on('error', (error) => {
      resolve({ success: false, error: `Failed to start Python process: ${error.message}` });
    });
    setTimeout(() => {
      python.kill();
      resolve({ success: false, error: 'Python script timeout (30s)' });
    }, 30000);
  });
}

export async function getTranscriptViaLibrary(videoId: string): Promise<{ transcript: string; title?: string; source: string }> {
  try {
    const transcriptArray = await YoutubeTranscript.fetchTranscript(videoId);
    const transcript = transcriptArray.map(item => item.text).join(' ');
    // Title fetching is not supported directly here; leave as undefined or fetch separately if needed
    return {
      transcript,
      title: undefined,
      source: 'youtube-transcript',
    };
  } catch (error) {
    throw new Error('Node.js transcript fetch failed: ' + (error instanceof Error ? error.message : String(error)));
  }
}

export async function getTranscriptWithFallback(videoUrl: string) {
  const videoId = extractYouTubeId(videoUrl);
  if (!videoId) {
    throw new Error('Invalid YouTube URL');
  }
  console.log('🔄 Trying Node.js methods first...');
  try {
    const nodeResult = await getTranscriptViaLibrary(videoId);
    console.log('✅ Node.js method succeeded');
    return {
      transcript: nodeResult.transcript,
      title: nodeResult.title || 'YouTube Video',
      source: 'nodejs_' + nodeResult.source,
      success: true
    };
  } catch (_nodeError) {
    console.log('❌ Node.js methods failed, trying Python...');
  }
  try {
    const pythonResult = await getPythonTranscript(videoUrl);
    if (pythonResult.success && pythonResult.transcript) {
      console.log(`✅ Python method succeeded: ${pythonResult.method}`);
      return {
        transcript: pythonResult.transcript,
        title: pythonResult.title || 'YouTube Video',
        source: `python_${pythonResult.method}`,
        success: true
      };
    } else {
      throw new Error(pythonResult.error || 'Python method failed');
    }
  } catch (_pythonError) {
    console.log('❌ Python method also failed, trying Whisper...');
  }
  try {
    const whisperResult = await getWhisperTranscript(videoUrl);
    if (whisperResult.success && whisperResult.transcript) {
      console.log('✅ Whisper method succeeded');
      return {
        transcript: whisperResult.transcript,
        title: whisperResult.title || 'YouTube Video',
        source: 'whisper',
        success: true
      };
    } else {
      throw new Error(whisperResult.error || 'Whisper method failed');
    }
  } catch (_whisperError) {
    console.log('❌ Whisper method also failed');
    throw new Error('All methods failed. Node.js, Python, and Whisper.');
  }
}

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