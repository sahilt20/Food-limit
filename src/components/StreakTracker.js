'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import './streak-tracker.css';

export default function StreakTracker() {
  const [streaks, setStreaks] = useState({
    tracking: { current: 0, best: 0, lastDate: null },
    calorieGoal: { current: 0, best: 0, lastDate: null },
    weighIn: { current: 0, best: 0, lastDate: null }
  });
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    loadStreaks();
  }, []);

  const loadStreaks = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: stats } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (stats) {
        setStreaks({
          tracking: {
            current: stats.tracking_streak_current || 0,
            best: stats.tracking_streak_best || 0,
            lastDate: stats.tracking_streak_last_date
          },
          calorieGoal: {
            current: stats.calorie_goal_streak_current || 0,
            best: stats.calorie_goal_streak_best || 0,
            lastDate: stats.calorie_goal_streak_last_date
          },
          weighIn: {
            current: stats.weigh_in_streak_current || 0,
            best: stats.weigh_in_streak_best || 0,
            lastDate: stats.weigh_in_streak_last_date
          }
        });
      }
    } catch (error) {
      console.error('Error loading streaks:', error);
    } finally {
      setLoading(false);
    }
  };

  const getNextMilestone = (current) => {
    const milestones = [7, 14, 30, 60, 90, 100];
    return milestones.find(m => m > current) || current + 30;
  };

  const getMilestoneProgress = (current) => {
    const next = getNextMilestone(current);
    return ((current / next) * 100).toFixed(0);
  };

  const isStreakActive = (lastDate) => {
    if (!lastDate) return false;
    const last = new Date(lastDate);
    const today = new Date();
    const diffDays = Math.floor((today - last) / (1000 * 60 * 60 * 24));
    return diffDays <= 1;
  };

  if (loading) {
    return <div className="streak-loading">Loading streaks...</div>;
  }

  return (
    <div className="streak-tracker-container">
      <h2>🔥 Your Streaks</h2>
      <p className="streak-subtitle">Build momentum by staying consistent!</p>

      <div className="streaks-grid">
        {/* Tracking Streak */}
        <div className={`streak-card ${isStreakActive(streaks.tracking.lastDate) ? 'active' : 'inactive'}`}>
          <div className="streak-header">
            <div className="streak-icon">
              <span className="flame">🔥</span>
              <span className="streak-count">{streaks.tracking.current}</span>
            </div>
            <div className="streak-title">
              <h3>Tracking Streak</h3>
              <p>Days logging activity</p>
            </div>
          </div>

          <div className="streak-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill tracking"
                style={{ width: `${getMilestoneProgress(streaks.tracking.current)}%` }}
              ></div>
            </div>
            <div className="progress-text">
              {streaks.tracking.current > 0 ? (
                <>
                  {getNextMilestone(streaks.tracking.current) - streaks.tracking.current} days to {getNextMilestone(streaks.tracking.current)}-day streak!
                </>
              ) : (
                'Start your streak today!'
              )}
            </div>
          </div>

          <div className="streak-stats">
            <div className="stat">
              <span className="stat-label">Personal Best</span>
              <span className="stat-value">🏆 {streaks.tracking.best} days</span>
            </div>
            {streaks.tracking.lastDate && (
              <div className="stat">
                <span className="stat-label">Last Activity</span>
                <span className="stat-value">
                  {new Date(streaks.tracking.lastDate).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>

          {!isStreakActive(streaks.tracking.lastDate) && streaks.tracking.current > 0 && (
            <div className="streak-warning">
              ⚠️ Streak will reset if no activity today!
            </div>
          )}
        </div>

        {/* Calorie Goal Streak */}
        <div className={`streak-card ${isStreakActive(streaks.calorieGoal.lastDate) ? 'active' : 'inactive'}`}>
          <div className="streak-header">
            <div className="streak-icon">
              <span className="flame">🔥</span>
              <span className="streak-count">{streaks.calorieGoal.current}</span>
            </div>
            <div className="streak-title">
              <h3>Calorie Goal Streak</h3>
              <p>Days under goal</p>
            </div>
          </div>

          <div className="streak-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill calorie"
                style={{ width: `${getMilestoneProgress(streaks.calorieGoal.current)}%` }}
              ></div>
            </div>
            <div className="progress-text">
              {streaks.calorieGoal.current > 0 ? (
                <>
                  {getNextMilestone(streaks.calorieGoal.current) - streaks.calorieGoal.current} days to {getNextMilestone(streaks.calorieGoal.current)}-day streak!
                </>
              ) : (
                'Hit your calorie goal today!'
              )}
            </div>
          </div>

          <div className="streak-stats">
            <div className="stat">
              <span className="stat-label">Personal Best</span>
              <span className="stat-value">🏆 {streaks.calorieGoal.best} days</span>
            </div>
            {streaks.calorieGoal.lastDate && (
              <div className="stat">
                <span className="stat-label">Last Success</span>
                <span className="stat-value">
                  {new Date(streaks.calorieGoal.lastDate).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>

          {streaks.calorieGoal.current >= 7 && (
            <div className="streak-achievement">
              ✨ Perfect Week achieved!
            </div>
          )}
        </div>

        {/* Weigh-In Streak */}
        <div className={`streak-card ${isStreakActive(streaks.weighIn.lastDate) ? 'active' : 'inactive'}`}>
          <div className="streak-header">
            <div className="streak-icon">
              <span className="flame">🔥</span>
              <span className="streak-count">{streaks.weighIn.current}</span>
            </div>
            <div className="streak-title">
              <h3>Weigh-In Streak</h3>
              <p>Consecutive days</p>
            </div>
          </div>

          <div className="streak-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill weighin"
                style={{ width: `${getMilestoneProgress(streaks.weighIn.current)}%` }}
              ></div>
            </div>
            <div className="progress-text">
              {streaks.weighIn.current > 0 ? (
                <>
                  {getNextMilestone(streaks.weighIn.current) - streaks.weighIn.current} days to {getNextMilestone(streaks.weighIn.current)}-day streak!
                </>
              ) : (
                'Weigh in daily for best results!'
              )}
            </div>
          </div>

          <div className="streak-stats">
            <div className="stat">
              <span className="stat-label">Personal Best</span>
              <span className="stat-value">🏆 {streaks.weighIn.best} days</span>
            </div>
            {streaks.weighIn.lastDate && (
              <div className="stat">
                <span className="stat-label">Last Weigh-In</span>
                <span className="stat-value">
                  {new Date(streaks.weighIn.lastDate).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Motivation Section */}
      <div className="streak-motivation">
        <h3>💪 Keep Your Streaks Alive!</h3>
        <div className="tips">
          <div className="tip">
            <span className="tip-icon">⏰</span>
            <span>Set daily reminders for consistency</span>
          </div>
          <div className="tip">
            <span className="tip-icon">📅</span>
            <span>Check in every morning</span>
          </div>
          <div className="tip">
            <span className="tip-icon">🎯</span>
            <span>Focus on one streak at a time</span>
          </div>
        </div>
      </div>

      {/* Milestones */}
      <div className="milestones-section">
        <h3>🎯 Streak Milestones</h3>
        <div className="milestones-grid">
          <div className="milestone">
            <div className="milestone-icon">🥉</div>
            <div className="milestone-label">7 Days</div>
            <div className="milestone-reward">Week Warrior</div>
          </div>
          <div className="milestone">
            <div className="milestone-icon">🥈</div>
            <div className="milestone-label">30 Days</div>
            <div className="milestone-reward">Monthly Master</div>
          </div>
          <div className="milestone">
            <div className="milestone-icon">🥇</div>
            <div className="milestone-label">90 Days</div>
            <div className="milestone-reward">Streak Legend</div>
          </div>
          <div className="milestone">
            <div className="milestone-icon">💎</div>
            <div className="milestone-label">100 Days</div>
            <div className="milestone-reward">Centennial</div>
          </div>
        </div>
      </div>
    </div>
  );
}
