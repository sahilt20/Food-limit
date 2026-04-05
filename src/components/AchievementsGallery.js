'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import './achievements.css';

const ACHIEVEMENT_CATEGORIES = {
  weight_loss: { name: 'Weight Loss', icon: '📉', color: '#10b981' },
  streaks: { name: 'Streaks', icon: '🔥', color: '#f59e0b' },
  nutrition: { name: 'Nutrition', icon: '🥗', color: '#3b82f6' },
  social: { name: 'Social', icon: '👥', color: '#8b5cf6' },
  challenges: { name: 'Challenges', icon: '🏆', color: '#ef4444' },
  special: { name: 'Special', icon: '⭐', color: '#f59e0b' }
};

const TIER_COLORS = {
  bronze: '#B45309',
  silver: '#94A3B8',
  gold: '#F59E0B',
  platinum: '#8B5CF6',
  diamond: '#3B82F6'
};

export default function AchievementsGallery() {
  const [achievements, setAchievements] = useState([]);
  const [userAchievements, setUserAchievements] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedAchievement, setSelectedAchievement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  const supabase = createClient();

  useEffect(() => {
    loadAchievements();
    loadUserStats();
  }, []);

  const loadAchievements = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's unlocked achievements
      const { data: unlocked } = await supabase
        .from('gamification_achievements')
        .select('*')
        .eq('user_id', user.id)
        .order('unlocked_at', { ascending: false });

      setUserAchievements(unlocked || []);

      // Get all possible achievements (from API or define here)
      const allAchievements = [
        {
          id: 'getting_started',
          name: 'Getting Started',
          description: 'Completed onboarding',
          category: 'special',
          tier: 'bronze',
          icon: '🎯'
        },
        {
          id: 'first_pound',
          name: 'First Victory',
          description: 'Lost your first pound',
          category: 'weight_loss',
          tier: 'bronze',
          icon: '🎯'
        },
        {
          id: 'five_pounds',
          name: 'Strong Start',
          description: 'Lost 5 pounds',
          category: 'weight_loss',
          tier: 'silver',
          icon: '💪'
        },
        {
          id: 'ten_pounds',
          name: 'Double Digits',
          description: 'Lost 10 pounds',
          category: 'weight_loss',
          tier: 'gold',
          icon: '⭐'
        },
        {
          id: 'twenty_pounds',
          name: 'Major Milestone',
          description: 'Lost 20 pounds',
          category: 'weight_loss',
          tier: 'platinum',
          icon: '🏆'
        },
        {
          id: 'goal_reached',
          name: 'Goal Crusher',
          description: 'Reached your weight goal',
          category: 'weight_loss',
          tier: 'diamond',
          icon: '💎'
        },
        {
          id: 'week_warrior',
          name: 'Week Warrior',
          description: '7 days tracking streak',
          category: 'streaks',
          tier: 'bronze',
          icon: '🔥'
        },
        {
          id: 'monthly_master',
          name: 'Monthly Master',
          description: '30 days tracking streak',
          category: 'streaks',
          tier: 'gold',
          icon: '🌟'
        },
        {
          id: 'perfect_week',
          name: 'Perfect Week',
          description: '7 days under calorie goal',
          category: 'streaks',
          tier: 'silver',
          icon: '✨'
        },
        {
          id: 'protein_power',
          name: 'Protein Power',
          description: 'Hit protein goal 7 days straight',
          category: 'nutrition',
          tier: 'silver',
          icon: '🥩'
        },
        {
          id: 'hydration_hero',
          name: 'Hydration Hero',
          description: 'Drank 8 glasses of water daily for a week',
          category: 'nutrition',
          tier: 'bronze',
          icon: '💧'
        },
        {
          id: 'first_friend',
          name: 'Social Butterfly',
          description: 'Connected with your first friend',
          category: 'social',
          tier: 'bronze',
          icon: '👋'
        },
        {
          id: 'friend_circle',
          name: 'Friend Circle',
          description: 'Have 5 friends',
          category: 'social',
          tier: 'silver',
          icon: '👥'
        },
        {
          id: 'challenge_winner',
          name: 'Challenge Champion',
          description: 'Won your first head-to-head challenge',
          category: 'challenges',
          tier: 'gold',
          icon: '🥇'
        },
        {
          id: 'challenge_streak',
          name: 'Win Streak',
          description: 'Won 5 challenges in a row',
          category: 'challenges',
          tier: 'platinum',
          icon: '🔥'
        }
      ];

      // Merge with unlock status
      const merged = allAchievements.map(ach => {
        const unlock = unlocked?.find(u => u.achievement_id === ach.id);
        return {
          ...ach,
          unlocked: !!unlock,
          unlockedAt: unlock?.unlocked_at,
          metadata: unlock?.metadata
        };
      });

      setAchievements(merged);
    } catch (error) {
      console.error('Error loading achievements:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', user.id)
        .single();

      setStats(data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const filteredAchievements = selectedCategory === 'all'
    ? achievements
    : achievements.filter(a => a.category === selectedCategory);

  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const totalPoints = userAchievements.reduce((sum, a) => sum + (a.points_awarded || 0), 0);
  const totalXP = userAchievements.reduce((sum, a) => sum + (a.xp_awarded || 0), 0);

  if (loading) {
    return <div className="achievements-loading">Loading achievements...</div>;
  }

  return (
    <div className="achievements-container">
      <div className="achievements-header">
        <h2>🏆 Achievements</h2>
        <div className="achievements-stats">
          <div className="stat-badge">
            <span className="stat-value">{unlockedCount}/{achievements.length}</span>
            <span className="stat-label">Unlocked</span>
          </div>
          <div className="stat-badge">
            <span className="stat-value">{totalPoints}</span>
            <span className="stat-label">Points</span>
          </div>
          <div className="stat-badge">
            <span className="stat-value">{totalXP}</span>
            <span className="stat-label">XP</span>
          </div>
        </div>
      </div>

      {/* Recent Unlocks */}
      {userAchievements.length > 0 && (
        <div className="recent-unlocks">
          <h3>Recently Unlocked</h3>
          <div className="recent-list">
            {userAchievements.slice(0, 3).map(unlock => {
              const ach = achievements.find(a => a.id === unlock.achievement_id);
              if (!ach) return null;
              
              return (
                <div key={unlock.id} className="recent-achievement">
                  <div className="achievement-icon">{ach.icon}</div>
                  <div>
                    <div className="achievement-name">{ach.name}</div>
                    <div className="achievement-date">
                      {new Date(unlock.unlocked_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Category Filter */}
      <div className="category-filter">
        <button
          className={`category-btn ${selectedCategory === 'all' ? 'active' : ''}`}
          onClick={() => setSelectedCategory('all')}
        >
          All
        </button>
        {Object.entries(ACHIEVEMENT_CATEGORIES).map(([key, cat]) => (
          <button
            key={key}
            className={`category-btn ${selectedCategory === key ? 'active' : ''}`}
            onClick={() => setSelectedCategory(key)}
          >
            {cat.icon} {cat.name}
          </button>
        ))}
      </div>

      {/* Achievements Grid */}
      <div className="achievements-grid">
        {filteredAchievements.map(achievement => (
          <div
            key={achievement.id}
            className={`achievement-card ${achievement.unlocked ? 'unlocked' : 'locked'} tier-${achievement.tier}`}
            onClick={() => setSelectedAchievement(achievement)}
          >
            <div className="achievement-icon-large">
              {achievement.unlocked ? achievement.icon : '🔒'}
            </div>
            <div className="achievement-tier" style={{ color: TIER_COLORS[achievement.tier] }}>
              {achievement.tier.charAt(0).toUpperCase() + achievement.tier.slice(1)}
            </div>
            <h4>{achievement.name}</h4>
            <p>{achievement.description}</p>
            {achievement.unlocked && (
              <div className="unlocked-badge">
                ✓ Unlocked
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Achievement Modal */}
      {selectedAchievement && (
        <div className="achievement-modal" onClick={() => setSelectedAchievement(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedAchievement(null)}>×</button>
            <div className="modal-icon">{selectedAchievement.unlocked ? selectedAchievement.icon : '🔒'}</div>
            <h3>{selectedAchievement.name}</h3>
            <div className="modal-tier" style={{ color: TIER_COLORS[selectedAchievement.tier] }}>
              {selectedAchievement.tier.toUpperCase()}
            </div>
            <p className="modal-description">{selectedAchievement.description}</p>
            {selectedAchievement.unlocked ? (
              <div className="modal-unlocked">
                <div className="unlocked-icon">✓</div>
                <div>Unlocked on {new Date(selectedAchievement.unlockedAt).toLocaleDateString()}</div>
                {selectedAchievement.metadata && Object.keys(selectedAchievement.metadata).length > 0 && (
                  <div className="metadata">
                    {JSON.stringify(selectedAchievement.metadata)}
                  </div>
                )}
              </div>
            ) : (
              <div className="modal-locked">
                <div className="locked-icon">🔒</div>
                <div>Keep going! You'll unlock this soon.</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
