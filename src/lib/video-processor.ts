import { YoutubeTranscript } from 'youtube-transcript';
import { TranscriptionData } from '../types';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export interface ProcessingOptions {}

export async function processVideo(
  video_url: string,
  options: ProcessingOptions = {}
): Promise<TranscriptionData> {
  const startTime = Date.now();
  let status: 'processing' | 'completed' | 'failed' = 'processing';

  try {
    // 1. Get video metadata
    const { video_title, video_duration } = await getVideoMetadata(video_url);

    // 2. Get transcript (YouTube only)
    const raw_transcript = await getVideoTranscript(video_url);
    if (!raw_transcript) {
      status = 'failed';
      throw new Error('Failed to get transcript from YouTube');
    }

    // 3. Process with Claude
    const processedData = await processWithClaude(raw_transcript, video_title);

    // 4. Calculate processing time and costs
    const processing_time_seconds = (Date.now() - startTime) / 1000;
    const costs = calculateCosts(raw_transcript, processedData.cleaned_transcript);
    status = 'completed';

    const result: TranscriptionData = {
      video_url,
      video_title,
      video_duration,
      raw_transcript,
      cleaned_transcript: processedData.cleaned_transcript,
      summary: processedData.summary,
      key_points: processedData.key_points,
      input_tokens: costs.input_tokens,
      output_tokens: costs.output_tokens,
      cost: costs.total_cost,
      processing_time_seconds,
      status,
    };
    return result;
  } catch (error) {
    status = 'failed';
    console.error('Error processing video:', error);
    throw error;
  }
}

export async function getVideoTranscript(url: string): Promise<string | null> {
  try {
    if (isYouTubeUrl(url)) {
      const transcript = await YoutubeTranscript.fetchTranscript(url);
      return transcript.map(item => item.text).join(' ');
    }
    throw new Error('Only YouTube videos are currently supported');
  } catch (error) {
    console.error('Error getting transcript:', error);
    return null;
  }
}

async function getVideoMetadata(url: string): Promise<{ video_title: string; video_duration: number }> {
  try {
    if (isYouTubeUrl(url)) {
      const videoId = extractYouTubeVideoId(url);
      if (!videoId) throw new Error('Invalid YouTube URL');
      // Use oEmbed for title (no API key needed)
      const oEmbedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
      const res = await fetch(oEmbedUrl);
      const data = await res.json();
      return {
        video_title: data.title,
        video_duration: 0, // Duration not available without YouTube Data API
      };
    }
    return {
      video_title: 'Unknown Video',
      video_duration: 0,
    };
  } catch (error) {
    console.error('Error getting video metadata:', error);
    return {
      video_title: 'Unknown Video',
      video_duration: 0,
    };
  }
}

async function processWithClaude(raw_transcript: string, video_title: string) {
  const prompt = `\nPlease clean up and process this video transcript. The video title is: "${video_title}"\n\nRaw transcript:\n${raw_transcript}\n\nPlease provide:\n1. A cleaned up version of the transcript (fix grammar, remove filler words, proper punctuation)\n2. A concise summary (2-3 paragraphs)\n3. Key points (5-7 bullet points of main takeaways)\n\nFormat your response as JSON:\n{\n  "cleaned_transcript": "...",\n  "summary": "...",\n  "key_points": ["...", "...", "..."]\n}\n`;
  const response = await anthropic.messages.create({
    model: 'claude-3-sonnet-20240229',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  });
  const contentBlock = response.content[0];
  if ('text' in contentBlock) {
    try {
      return JSON.parse(contentBlock.text);
    } catch (error) {
      console.error('Error parsing Claude response:', error);
      throw new Error('Failed to process transcript with Claude');
    }
  } else {
    throw new Error('Claude API did not return text content');
  }
}

function calculateCosts(inputText: string, outputText: string) {
  const input_tokens = Math.ceil(inputText.length / 4);
  const output_tokens = Math.ceil(outputText.length / 4);
  const inputCostPerToken = 0.000003;
  const outputCostPerToken = 0.000015;
  const total_cost = (input_tokens * inputCostPerToken) + (output_tokens * outputCostPerToken);
  return {
    input_tokens,
    output_tokens,
    total_cost,
  };
}

function isYouTubeUrl(url: string): boolean {
  return url.includes('youtube.com') || url.includes('youtu.be');
}

function extractYouTubeVideoId(url: string): string | null {
  const match = url.match(/[?&]v=([^&#]+)/) || url.match(/youtu\.be\/([^?&#]+)/);
  return match ? match[1] : null;
}

export function getTranscriptionCost(url: string, durationMinutes: number): number {
  if (isYouTubeUrl(url)) {
    console.log('💰 YouTube transcript cost: $0 (free)');
    return 0; // YouTube is free
  }
  const cost = durationMinutes * 0.006;
  console.log('💰 Whisper cost for', durationMinutes, 'minutes:', cost);
  return cost;
}

export function extractVideoTitle(url: string): string {
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return 'YouTube Video';
  }
  if (url.includes('spotify.com') || url.includes('anchor.fm')) {
    return 'Podcast Episode';
  }
  return `Video from ${new URL(url).hostname}`;
}

async function getVideoTitle(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    const html = await response.text();
    const titleMatch = html.match(/<title>(.*?)<\/title>/);
    return titleMatch ? titleMatch[1] : 'Untitled Video';
  } catch (error) {
    console.error('Error getting video title:', error);
    return 'Untitled Video';
  }
}

async function getVideoDuration(url: string): Promise<number> {
  // This is a placeholder - you'll need to implement actual duration fetching
  return 0;
}

async function getTranscript(url: string): Promise<string> {
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(url);
    return transcript.map(item => item.text).join(' ');
  } catch (error) {
    console.error('Error fetching transcript:', error);
    throw error;
  }
}

function calculateCost(inputTokens: number, outputTokens: number): number {
  // This is a placeholder - implement your cost calculation logic
  return (inputTokens * 0.0001) + (outputTokens * 0.0002);
}

async function processVideo(videoUrl: string): Promise<TranscriptionData> {
  const startTime = Date.now();
  let inputTokens = 0;
  let outputTokens = 0;
  let cost = 0;

  try {
    // Get video metadata
    const videoTitle = await getVideoTitle(videoUrl);
    const videoDuration = await getVideoDuration(videoUrl);

    // Get transcript
    const transcript = await getTranscript(videoUrl);
    inputTokens = transcript.length / 4; // Rough estimate

    // Process with Claude
    const claudeResponse = await processWithClaude(transcript, videoTitle);
    outputTokens = claudeResponse.cleaned_transcript.length / 4; // Rough estimate
    cost = calculateCost(inputTokens, outputTokens);

    const processingTime = (Date.now() - startTime) / 1000;

    const transcriptionData: TranscriptionData = {
      video_url: videoUrl,
      video_title: videoTitle,
      video_duration: videoDuration,
      raw_transcript: transcript,
      cleaned_transcript: claudeResponse.cleaned_transcript,
      summary: claudeResponse.summary,
      key_points: claudeResponse.key_points,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost: cost,
      processing_time_seconds: processingTime,
      status: 'completed'
    };

    return transcriptionData;
  } catch (error) {
    console.error('Error processing video:', error);
    throw error;
  }
} 