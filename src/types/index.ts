export interface TranscriptionData {
  id?: string;
  created_at?: string;
  video_url: string;
  video_title: string;
  video_duration?: number;
  raw_transcript: string;  // Changed from transcript to match DB
  cleaned_transcript: string;
  summary: string;
  key_points: string[];
  input_tokens: number;
  output_tokens: number;
  cost: number;
  processing_time_seconds: number;
  status: 'processing' | 'completed' | 'failed';
}

// YouTube transcript response type
export interface TranscriptItem {
  text: string;
  duration: number;
  offset: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Claude API response types
export interface ClaudeResponse {
  cleaned_transcript: string;
  summary: string;
  key_points: string[];
}

export interface TranscriptionListResponse {
  transcriptions: TranscriptionData[];
  total: number;
} 