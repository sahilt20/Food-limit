'use client';
import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import './daily-challenges.css';

// Pre-defined challenge templates
const CHALLENGE_TEMPLATES = {
  daily: [
    { id: 'log_all_meals', title: '🍽️ Log All Meals', description: 'Track breakfast, lunch, and dinner today', xp: 50, points: 25 },
    { id: 'hit_calorie_goal', title: '🎯 Hit Calorie Goal', description: 'Stay within your calorie target', xp: 75, points: 35 },
    { id: 'hit_protein_target', title: '💪 Protein Power', description: 'Meet your protein goal for the day', xp: 60, points: 30 },
    { id: 'log_weight', title: '⚖️ Morning Weigh-In', description: 'Log your weight today', xp: 40, points: 20 },
    { id: 'no_late_snacks', title: '🌙 No Late Snacking', description: 'Avoid eating after 8 PM', xp: 80, points: 40 },
    { id: 'drink_water', title: '💧 Hydration Hero', description: 'Drink 8 glasses of water', xp: 50, points: 25 },
  ],
  weekly: [
    { id: 'track_5_days', title: '📅 Consistency Champion', description: 'Log meals for 5+ days this week', xp: 200, points: 100 },
    { id: 'calorie_goal_7_days', title: '🔥 Week Perfect', description: 'Hit calorie goal all 7 days', xp: 350, points: 175 },
    { id: 'weigh_in_3_times', title: '⚖️ Weekly Check-in', description: 'Weigh yourself 3+ times this week', xp: 150, points: 75 },
    { id: 'protein_5_days', title: '💪 Protein Warrior', description: 'Hit protein target 5+ days', xp: 250, points: 125 },
    { id: 'no_missed_days', title: '🎯 Perfect Week', description: 'No missed tracking days', xp: 300, points: 150 },
  ]
};

export default function DailyChallenges() {
  const supabase = createClientComponentClient();
  const [activeChallenges, setActiveChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => {
    loadChallenges();
    checkAndGenerateDailyChallenges();
  }, []);

  const loadChallenges = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('challenges')
        .select('*')
        .eq('challenge_type', 'daily')
        .in('status', ['active', 'pending'])
        .gte('end_date', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Enrich with progress
      const enrichedChallenges = await Promise.all(
        data.map(async (challenge) => {
          const progress = await calculateProgress(challenge);
          return { ...challenge, progress };
        })
      );

      setActiveChallenges(enrichedChallenges);
    } catch (error) {
      console.error('Error loading challenges:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkAndGenerateDailyChallenges = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date().toISOString().split('T')[0];

      // Check if daily challenges already exist for today
      const { data: existing } = await supabase
        .from('challenges')
        .select('id')
        .eq('creator_id', user.id)
        .eq('challenge_type', 'daily')
        .gte('start_date', today + 'T00:00:00')
        .lte('start_date', today + 'T23:59:59');

      if (existing && existing.length > 0) return; // Already generated

      // Generate 3 random daily challenges
      const templates = [...CHALLENGE_TEMPLATES.daily];
      const selectedTemplates = [];
      for (let i = 0; i < 3; i++) {
        const randomIndex = Math.floor(Math.random() * templates.length);
        selectedTemplates.push(templates.splice(randomIndex, 1)[0]);
      }

      // Create challenges
      for (const template of selectedTemplates) {
        await supabase.from('challenges').insert({
          name: template.title,
          description: template.description,
          challenge_type: 'daily',
          creator_id: user.id,
          start_date: new Date(today + 'T00:00:00').toISOString(),
          end_date: new Date(today + 'T23:59:59').toISOString(),
          status: 'active',
          metadata: {
            template_id: template.id,
            xp_reward: template.xp,
            points_reward: template.points
          }
        });
      }

      loadChallenges();
    } catch (error) {
      console.error('Error generating daily challenges:', error);
    }
  };

  const calculateProgress = async (challenge) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    const templateId = challenge.metadata?.template_id;
    const today = new Date().toISOString().split('T')[0];

    switch (templateId) {
      case 'log_all_meals':
        const { data: meals } = await supabase
          .from('consumed_items')
          .select('meal_type')
          .eq('user_id', user.id)
          .gte('consumed_at', today + 'T00:00:00')
          .lte('consumed_at', today + 'T23:59:59');
        
        const mealTypes = new Set(meals?.map(m => m.meal_type) || []);
        return Math.min(100, (mealTypes.size / 3) * 100); // breakfast, lunch, dinner

      case 'hit_calorie_goal':
        const { data: summary } = await supabase
          .from('daily_nutrition_summary')
          .select('total_calories')
          .eq('user_id', user.id)
          .eq('summary_date', today)
          .single();

        const { data: goal } = await supabase
          .from('weight_goals')
          .select('daily_calorie_target')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single();

        if (!summary || !goal) return 0;
        const calorieProgress = (summary.total_calories / goal.daily_calorie_target) * 100;
        return Math.abs(100 - calorieProgress) < 10 ? 100 : Math.min(calorieProgress, 90);

      case 'log_weight':
        const { data: weightLog } = await supabase
          .from('weight_logs')
          .select('id')
          .eq('user_id', user.id)
          .gte('logged_at', today + 'T00:00:00')
          .lte('logged_at', today + 'T23:59:59')
          .limit(1);

        return weightLog && weightLog.length > 0 ? 100 : 0;

      case 'hit_protein_target':
        const { data: proteinSummary } = await supabase
          .from('daily_nutrition_summary')
          .select('total_protein_g')
          .eq('user_id', user.id)
          .eq('summary_date', today)
          .single();

        const { data: proteinGoal } = await supabase
          .from('weight_goals')
          .select('protein_target_g')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single();

        if (!proteinSummary || !proteinGoal) return 0;
        return Math.min(100, (proteinSummary.total_protein_g / proteinGoal.protein_target_g) * 100);

      default:
        return 0;
    }
  };

  const completeChallenge = async (challenge) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Mark as completed
      await supabase
        .from('challenges')
        .update({ status: 'completed' })
        .eq('id', challenge.id);

      // Award XP and points
      const xpReward = challenge.metadata?.xp_reward || 0;
      const pointsReward = challenge.metadata?.points_reward || 0;

      await supabase.rpc('increment_user_stats', {
        p_user_id: user.id,
        p_xp: xpReward,
        p_points: pointsReward
      });

      // Award achievement if first challenge completed
      await fetch('/api/achievements/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'daily_challenge_complete', data: { challenge_id: challenge.id } })
      });

      // Show celebration
      showCelebration(challenge);

      loadChallenges();
    } catch (error) {
      console.error('Error completing challenge:', error);
    }
  };

  const showCelebration = (challenge) => {
    const celebration = document.createElement('div');
    celebration.className = 'challenge-celebration';
    celebration.innerHTML = `
      <div class="celebration-content">
        <div class="celebration-icon">🎉</div>
        <h3>Challenge Complete!</h3>
        <p>${challenge.name}</p>
        <div class="celebration-rewards">
          +${challenge.metadata?.xp_reward || 0} XP • +${challenge.metadata?.points_reward || 0} Points
        </div>
      </div>
    `;
    document.body.appendChild(celebration);
    setTimeout(() => celebration.remove(), 4000);
  };

  if (loading) {
    return (
      <div className="challenges-container">
        <div className="loading">Loading challenges...</div>
      </div>
    );
  }

  return (
    <div className="challenges-container">
      <div className="challenges-header">
        <h2>🎯 Daily Challenges</h2>
        <p className="challenges-subtitle">
          Complete challenges to earn bonus XP and points
        </p>
      </div>

      {/* Active Challenges */}
      <div className="challenges-section">
        <h3>Today's Challenges</h3>
        {activeChallenges.filter(c => c.challenge_type === 'daily').length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🎯</div>
            <p>No active challenges today. Check back tomorrow!</p>
          </div>
        ) : (
          <div className="challenges-grid">
            {activeChallenges
              .filter(c => c.challenge_type === 'daily')
              .map(challenge => (
                <ChallengeCard
                  key={challenge.id}
                  challenge={challenge}
                  onComplete={() => completeChallenge(challenge)}
                />
              ))}
          </div>
        )}
      </div>

      {/* Weekly Challenges */}
      <div className="challenges-section">
        <h3>Weekly Challenges</h3>
        {activeChallenges.filter(c => c.challenge_type === 'weekly').length === 0 ? (
          <div className="weekly-empty">
            <p>Weekly challenges coming soon!</p>
          </div>
        ) : (
          <div className="challenges-grid">
            {activeChallenges
              .filter(c => c.challenge_type === 'weekly')
              .map(challenge => (
                <ChallengeCard
                  key={challenge.id}
                  challenge={challenge}
                  onComplete={() => completeChallenge(challenge)}
                />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ChallengeCard({ challenge, onComplete }) {
  const progress = challenge.progress || 0;
  const isComplete = progress >= 100;

  return (
    <div className={`challenge-card ${isComplete ? 'complete' : ''}`}>
      <div className="challenge-card-header">
        <h4>{challenge.name}</h4>
        {isComplete && <div className="complete-badge">✓ Done!</div>}
      </div>
      
      <p className="challenge-description">{challenge.description}</p>

      <div className="challenge-progress">
        <div className="progress-bar-challenge">
          <div 
            className="progress-fill-challenge"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <div className="progress-text-challenge">{Math.round(progress)}%</div>
      </div>

      <div className="challenge-rewards">
        <div className="reward-item">
          <span className="reward-icon">⭐</span>
          <span className="reward-value">+{challenge.metadata?.xp_reward || 0} XP</span>
        </div>
        <div className="reward-item">
          <span className="reward-icon">💎</span>
          <span className="reward-value">+{challenge.metadata?.points_reward || 0} Points</span>
        </div>
      </div>

      {isComplete && challenge.status !== 'completed' && (
        <button className="complete-btn" onClick={onComplete}>
          Claim Rewards
        </button>
      )}
    </div>
  );
}
