import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { TranscriptionData, ApiResponse } from '@/types';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('transcriptions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json<ApiResponse<null>>({ 
        success: false, 
        error: 'Failed to load transcriptions' 
      }, { status: 500 });
    }

    return NextResponse.json<ApiResponse<TranscriptionData[]>>({ 
      success: true,
      data
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