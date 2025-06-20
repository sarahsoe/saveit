import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { ApiResponse } from '@/types';

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'No transcription ID provided'
      }, { status: 400 });
    }
    
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
    console.error('Error deleting transcription:', error);
    return NextResponse.json(
      { error: 'Failed to delete transcription' },
      { status: 500 }
    );
  }
} 