import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const supabase = createClient();
    const { userId, streakType, success, date } = await request.json();
    
    const checkDate = date || new Date().toISOString().split('T')[0];

    await supabase.rpc('update_streak', {
      p_user_id: userId,
      p_streak_type: streakType,
      p_success: success,
      p_date: checkDate
    });

    const { data: stats } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', userId)
      .single();

    return NextResponse.json({ success: true, stats });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
