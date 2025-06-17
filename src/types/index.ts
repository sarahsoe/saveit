export interface TranscriptionData {
  id?: string;
  created_at?: string;
  video_url: string;
  video_title?: string;
  video_duration?: number;
  raw_transcript?: string;
  cleaned_transcript?: string;
  summary?: string;
  key_points?: string[];
  input_tokens?: number;
  output_tokens?: number;
  cost?: number;
  processing_time_seconds?: number;
  status?: 'processing' | 'completed' | 'failed';
}

export interface TranscriptionResponse {
  success: boolean;
  data?: TranscriptionData;
  error?: string;
}

export interface TranscriptionListResponse {
  transcriptions: TranscriptionData[];
  total: number;
} 