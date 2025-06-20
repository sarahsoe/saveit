import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { TranscriptionData, ApiResponse } from '@/types';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('transcriptions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Clean up the data to handle nulls
    const cleanedData = data?.map(item => ({
      ...item,
      key_points: item.key_points || [],           // ← Convert null to empty array
      video_title: item.video_title || 'Untitled',
      raw_transcript: item.raw_transcript || '',
      cleaned_transcript: item.cleaned_transcript || '',
      summary: item.summary || ''
    })) || [];

    return NextResponse.json({
      success: true,
      data: cleanedData
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('API error:', err);
    return NextResponse.json<ApiResponse<null>>({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 