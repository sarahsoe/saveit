import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { ApiResponse } from '@/types';

export async function DELETE(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    const { id } = context.params;
    
    const { error } = await supabase
      .from('transcriptions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Failed to delete transcription'
      }, { status: 500 });
    }

    return NextResponse.json<ApiResponse<null>>({ success: true });

  } catch (error: unknown) {
    const err = error as Error;
    console.error('API error:', err);
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
} 