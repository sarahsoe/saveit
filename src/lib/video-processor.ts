import { YoutubeTranscript } from 'youtube-transcript';
import OpenAI from 'openai';

// Only initialize OpenAI if we have an API key
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

export async function getVideoTranscript(url: string): Promise<string> {
  try {
    console.log('🎬 Processing URL:', url);
    
    // Check if it's a YouTube URL
    if (isYouTubeURL(url)) {
      console.log('📺 Detected YouTube URL, fetching transcript...');
      return await getYouTubeTranscript(url);
    }
    
    // Check if it's a podcast URL
    if (isPodcastURL(url)) {
      console.log('🎧 Detected podcast URL, using Whisper...');
      return await getWhisperTranscript(url);
    }
    
    // Default to Whisper for other videos
    console.log('🎬 Using Whisper for unknown video type...');
    return await getWhisperTranscript(url);
    
  } catch (error: any) {
    console.error('❌ Transcription failed:', error);
    throw new Error(`Failed to transcribe video: ${error.message}`);
  }
}

function isYouTubeURL(url: string): boolean {
  const isYT = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)/.test(url);
  console.log('🔍 Is YouTube URL?', isYT);
  return isYT;
}

function isPodcastURL(url: string): boolean {
  // Common podcast domains and file extensions
  const podcastDomains = [
    'anchor.fm', 'spotify.com', 'apple.com/podcasts', 'podcasts.google.com',
    'soundcloud.com', 'buzzsprout.com', 'libsyn.com', 'simplecast.com'
  ];
  
  const audioExtensions = ['.mp3', '.wav', '.m4a', '.aac', '.ogg'];
  
  const isPodcast = podcastDomains.some(domain => url.includes(domain)) ||
         audioExtensions.some(ext => url.includes(ext));
  
  console.log('🔍 Is Podcast URL?', isPodcast);
  return isPodcast;
}

async function getYouTubeTranscript(url: string): Promise<string> {
  try {
    console.log('📥 Fetching YouTube transcript for:', url);
    const transcript = await YoutubeTranscript.fetchTranscript(url);
    console.log('✅ Got transcript with', transcript.length, 'segments');
    
    if (!transcript || transcript.length === 0) {
      console.log('⚠️ No transcript segments found');
      return 'No transcript available for this video.';
    }
    
    const fullText = transcript.map((item: { text: string }) => item.text).join(' ');
    console.log('📝 Full transcript length:', fullText.length, 'characters');
    
    return fullText;
  } catch (error) {
    console.error('❌ YouTube transcript error:', error);
    console.log('🔄 Falling back to Whisper...');
    return await getWhisperTranscript(url);
  }
}

async function getWhisperTranscript(url: string): Promise<string> {
  console.log('🎤 Whisper transcription for:', url);
  // TODO: Implement actual Whisper transcription
  return `[Whisper transcription would go here for: ${url}]`;
}

export function getTranscriptionCost(url: string, durationMinutes: number): number {
  if (isYouTubeURL(url)) {
    console.log('💰 YouTube transcript cost: $0 (free)');
    return 0; // YouTube is free
  }
  const cost = durationMinutes * 0.006;
  console.log('💰 Whisper cost for', durationMinutes, 'minutes:', cost);
  return cost;
} 