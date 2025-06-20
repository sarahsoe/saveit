import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('transcriptions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch transcriptions'
      }, { status: 500 });
    }

    // CRITICAL: Convert all null values to safe defaults
    const safeData = (data || []).map(item => ({
      ...item,
      key_points: item.key_points || [],
      video_title: item.video_title || '',
      raw_transcript: item.raw_transcript || '',
      cleaned_transcript: item.cleaned_transcript || '',
      summary: item.summary || '',
      status: item.status || 'processing',
      video_duration: item.video_duration || 0,
      input_tokens: item.input_tokens || 0,
      output_tokens: item.output_tokens || 0,
      processing_time_seconds: item.processing_time_seconds || 0,
      cost: item.cost || 0,
    }));

    console.log('Cleaned data sample:', safeData[0]);

    return NextResponse.json({
      success: true,
      data: safeData
    });
  } catch (error: unknown) {
    console.error('API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
} 