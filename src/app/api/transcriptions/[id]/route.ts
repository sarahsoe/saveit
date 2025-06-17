import { supabase } from '@/lib/supabase';

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    
    const { error } = await supabase
      .from('transcriptions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Database error:', error);
      return Response.json({
        success: false,
        error: 'Failed to delete transcription'
      }, { status: 500 });
    }

    return Response.json({ success: true });

  } catch (error) {
    console.error('API error:', error);
    return Response.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
} 