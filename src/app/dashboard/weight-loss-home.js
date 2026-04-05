'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabaseClient';
import Link from 'next/link';
import './weight-dashboard.css';

export default function WeightLossDashboard() {
  const supabase = createClient();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [weightGoal, setWeightGoal] = useState(null);
  const [recentWeight, setRecentWeight] = useState(null);
  const [achievements, setAchievements] = useState([]);
  const [activeChallenges, setActiveChallenges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      
      setUser(authUser);

      // Load user stats
      const { data: userStats } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', authUser.id)
        .single();
      
      setStats(userStats);

      // Load weight goal
      const { data: goal } = await supabase
        .from('weight_goals')
        .select('*')
        .eq('user_id', authUser.id)
        .eq('status', 'active')
        .single();
      
      setWeightGoal(goal);

      // Load recent weight
      const { data: weight } = await supabase
        .from('weight_logs')
        .select('*')
        .eq('user_id', authUser.id)
        .order('logged_at', { ascending: false })
        .limit(1)
        .single();
      
      setRecentWeight(weight);

      // Load recent achievements
      const { data: userAchievements } = await supabase
        .from('gamification_achievements')
        .select('*')
        .eq('user_id', authUser.id)
        .order('unlocked_at', { ascending: false })
        .limit(3);
      
      setAchievements(userAchievements || []);

      // Load active challenges
      const { data: challenges } = await supabase
        .from('challenge_participants')
        .select(`
          *,
          challenges:challenge_id (
            id,
            name,
            goal_metric,
            end_date,
            status
          )
        `)
        .eq('user_id', authUser.id)
        .eq('invitation_status', 'accepted')
        .limit(3);
      
      setActiveChallenges(challenges || []);

    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="weight-dashboard-loading">
        <div className="loader"></div>
        <p>Loading your wellness journey...</p>
      </div>
    );
  }

  // Calculate progress
  const currentWeight = recentWeight ? recentWeight.weight_kg : 0;
  const startWeight = weightGoal?.start_weight_kg || 0;
  const targetWeight = weightGoal?.target_weight_kg || 0;
  const weightLost = startWeight - currentWeight;
  const totalToLose = startWeight - targetWeight;
  const progressPercent = totalToLose > 0 ? Math.min((weightLost / totalToLose) * 100, 100) : 0;

  return (
    <div className="weight-loss-dashboard">
      {/* Hero Section */}
      <div className="dashboard-hero">
        <div className="hero-content">
          <h1>🌟 Your Weight Loss Journey</h1>
          <p className="hero-subtitle">Track, compete, and achieve your wellness goals</p>
        </div>
        
        {stats && (
          <div className="hero-stats">
            <div className="hero-stat-card">
              <div className="stat-icon">⚡</div>
              <div className="stat-value">Level {stats.level}</div>
              <div className="stat-label">{stats.level_title}</div>
            </div>
            <div className="hero-stat-card">
              <div className="stat-icon">🔥</div>
              <div className="stat-value">{stats.tracking_streak_current}</div>
              <div className="stat-label">Day Streak</div>
            </div>
            <div className="hero-stat-card">
              <div className="stat-icon">🏆</div>
              <div className="stat-value">{achievements.length}</div>
              <div className="stat-label">Achievements</div>
            </div>
          </div>
        )}
      </div>

      {/* Weight Progress Card */}
      {weightGoal && (
        <div className="progress-card">
          <div className="progress-header">
            <h2>📉 Weight Progress</h2>
            <Link href="/dashboard/weight" className="view-more">View Details →</Link>
          </div>
          
          <div className="weight-stats">
            <div className="weight-stat">
              <span className="label">Current</span>
              <span className="value">{currentWeight.toFixed(1)} kg</span>
            </div>
            <div className="weight-stat">
              <span className="label">Lost</span>
              <span className="value success">{weightLost.toFixed(1)} kg</span>
            </div>
            <div className="weight-stat">
              <span className="label">Target</span>
              <span className="value">{targetWeight.toFixed(1)} kg</span>
            </div>
            <div className="weight-stat">
              <span className="label">To Go</span>
              <span className="value">{(totalToLose - weightLost).toFixed(1)} kg</span>
            </div>
          </div>

          <div className="progress-bar-container">
            <div className="progress-bar-track">
              <div 
                className="progress-bar-fill"
                style={{ width: `${progressPercent}%` }}
              >
                <span className="progress-text">{progressPercent.toFixed(0)}%</span>
              </div>
            </div>
          </div>

          <div className="quick-actions">
            <Link href="/dashboard/weight" className="action-btn primary">
              📊 Log Weight
            </Link>
            <Link href="/dashboard/add" className="action-btn secondary">
              🍽️ Log Meal
            </Link>
          </div>
        </div>
      )}

      {/* Quick Access Grid */}
      <div className="feature-grid">
        {/* Achievements */}
        <Link href="/dashboard/achievements" className="feature-card">
          <div className="feature-icon">🏆</div>
          <h3>Achievements</h3>
          <p>{achievements.length} unlocked</p>
          <div className="achievement-preview">
            {achievements.slice(0, 3).map(achievement => (
              <div key={achievement.id} className="mini-badge" title={achievement.achievement_id}>
                {achievement.tier === 'gold' ? '🥇' : achievement.tier === 'silver' ? '🥈' : '🥉'}
              </div>
            ))}
          </div>
        </Link>

        {/* Challenges */}
        <Link href="/dashboard/challenges" className="feature-card">
          <div className="feature-icon">⚔️</div>
          <h3>Challenges</h3>
          <p>{activeChallenges.length} active</p>
          {activeChallenges.length > 0 ? (
            <div className="challenge-preview">
              <span className="preview-text">{activeChallenges[0].challenges?.name}</span>
            </div>
          ) : (
            <div className="challenge-preview">
              <span className="preview-text">Start your first challenge!</span>
            </div>
          )}
        </Link>

        {/* Social */}
        <Link href="/dashboard/social" className="feature-card">
          <div className="feature-icon">👥</div>
          <h3>Friends</h3>
          <p>Connect & compete</p>
          <div className="social-preview">
            <span className="preview-text">Compare progress with friends</span>
          </div>
        </Link>

        {/* Streaks */}
        <div className="feature-card streak-card">
          <div className="feature-icon">🔥</div>
          <h3>Streaks</h3>
          {stats && (
            <div className="streak-stats">
              <div className="streak-item">
                <span className="streak-label">Tracking:</span>
                <span className="streak-value">{stats.tracking_streak_current} days</span>
              </div>
              <div className="streak-item">
                <span className="streak-label">Best:</span>
                <span className="streak-value">{stats.tracking_streak_best} days</span>
              </div>
            </div>
          )}
        </div>

        {/* AI Insights */}
        <Link href="/dashboard/insights" className="feature-card ai-card">
          <div className="feature-icon">🤖</div>
          <h3>AI Insights</h3>
          <p>Weekly analysis</p>
          <div className="ai-preview">
            <span className="preview-text">Get personalized recommendations</span>
          </div>
        </Link>

        {/* Leaderboards */}
        <Link href="/dashboard/leaderboards" className="feature-card leaderboard-card">
          <div className="feature-icon">📊</div>
          <h3>Leaderboards</h3>
          <p>See your ranking</p>
          <div className="rank-preview">
            <span className="preview-text">Compete globally</span>
          </div>
        </Link>
      </div>

      {/* Daily Goals Section */}
      {weightGoal && (
        <div className="daily-goals-card">
          <h2>🎯 Today's Goals</h2>
          <div className="goals-grid">
            <div className="goal-item">
              <div className="goal-icon">🍽️</div>
              <div className="goal-content">
                <div className="goal-label">Calories</div>
                <div className="goal-target">{weightGoal.daily_calorie_goal} cal</div>
              </div>
            </div>
            <div className="goal-item">
              <div className="goal-icon">💪</div>
              <div className="goal-content">
                <div className="goal-label">Protein</div>
                <div className="goal-target">{weightGoal.protein_goal_g}g</div>
              </div>
            </div>
            <div className="goal-item">
              <div className="goal-icon">📝</div>
              <div className="goal-content">
                <div className="goal-label">Log Meals</div>
                <div className="goal-target">3 meals</div>
              </div>
            </div>
            <div className="goal-item">
              <div className="goal-icon">⚖️</div>
              <div className="goal-content">
                <div className="goal-label">Weigh In</div>
                <div className="goal-target">Daily</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Getting Started (if new user) */}
      {!weightGoal && (
        <div className="onboarding-card">
          <div className="onboarding-icon">🎉</div>
          <h2>Welcome to Your Weight Loss Journey!</h2>
          <p>Let's get you started with a personalized plan</p>
          <Link href="/dashboard/weight" className="onboarding-btn">
            Set Up Your Goals →
          </Link>
        </div>
      )}
    </div>
  );
}
