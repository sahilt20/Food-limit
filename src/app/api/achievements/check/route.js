import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// Achievement definitions
const ACHIEVEMENTS = {
  getting_started: { id: 'getting_started', name: 'Getting Started', category: 'special', tier: 'bronze', points: 10, xp: 25 },
  first_pound: { id: 'first_pound', name: 'First Victory', category: 'weight_loss', tier: 'bronze', points: 10, xp: 50 },
  five_pounds: { id: 'five_pounds', name: 'Strong Start', category: 'weight_loss', tier: 'silver', points: 50, xp: 150 },
  ten_pounds: { id: 'ten_pounds', name: 'Double Digits', category: 'weight_loss', tier: 'gold', points: 100, xp: 300 },
  week_warrior: { id: 'week_warrior', name: 'Week Warrior', category: 'streaks', tier: 'bronze', points: 50, xp: 100 },
  monthly_master: { id: 'monthly_master', name: 'Monthly Master', category: 'streaks', tier: 'gold', points: 200, xp: 500 },
  first_friend: { id: 'first_friend', name: 'Social Butterfly', category: 'social', tier: 'bronze', points: 20, xp: 50 },
  challenge_winner: { id: 'challenge_winner', name: 'Challenge Champion', category: 'challenges', tier: 'gold', points: 100, xp: 250 }
};

export async function POST(request) {
  try {
    const supabase = createClient();
    const { userId, event, data } = await request.json();
    const unlocked = [];

    if (event === 'onboarding_complete') {
      await awardAchievement(supabase, userId, 'getting_started');
      unlocked.push(ACHIEVEMENTS.getting_started);
    } else if (event === 'weight_logged' && data?.weightLost) {
      const lbs = data.weightLost * 2.20462;
      if (lbs >= 1) await awardAchievement(supabase, userId, 'first_pound');
      if (lbs >= 5) await awardAchievement(supabase, userId, 'five_pounds');
      if (lbs >= 10) await awardAchievement(supabase, userId, 'ten_pounds');
    }

    return NextResponse.json({ success: true, unlocked });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function awardAchievement(supabase, userId, achievementId) {
  const ach = ACHIEVEMENTS[achievementId];
  await supabase.rpc('award_achievement', {
    p_user_id: userId,
    p_achievement_id: ach.id,
    p_category: ach.category,
    p_tier: ach.tier,
    p_points: ach.points,
    p_xp: ach.xp,
    p_metadata: {}
  });
}
