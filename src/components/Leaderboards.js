'use client';
import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import './leaderboards.css';

export default function Leaderboards() {
  const supabase = createClientComponentClient();
  const [category, setCategory] = useState('weight_loss'); // weight_loss, streaks, xp, challenges
  const [scope, setScope] = useState('friends'); // friends, global
  const [leaderboard, setLeaderboard] = useState([]);
  const [currentUserRank, setCurrentUserRank] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLeaderboard();
  }, [category, scope]);

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let leaderboardData = [];

      if (scope === 'friends') {
        leaderboardData = await loadFriendsLeaderboard(user.id);
      } else {
        leaderboardData = await loadGlobalLeaderboard();
      }

      setLeaderboard(leaderboardData);

      // Find current user's rank
      const userRank = leaderboardData.findIndex(item => item.user_id === user.id);
      setCurrentUserRank(userRank >= 0 ? userRank + 1 : null);

    } catch (error) {
      console.error('Error loading leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFriendsLeaderboard = async (userId) => {
    // Get friend IDs
    const { data: friendships } = await supabase
      .from('friendships')
      .select('friend_id')
      .eq('user_id', userId)
      .eq('status', 'accepted');

    const friendIds = friendships?.map(f => f.friend_id) || [];
    friendIds.push(userId); // Include current user

    return await loadLeaderboardForUsers(friendIds);
  };

  const loadGlobalLeaderboard = async () => {
    // Get all users (limited to top 100)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id')
      .limit(100);

    const userIds = profiles?.map(p => p.id) || [];
    return await loadLeaderboardForUsers(userIds);
  };

  const loadLeaderboardForUsers = async (userIds) => {
    const data = [];

    for (const userId of userIds) {
      // Get user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (!profile) continue;

      // Get user stats
      const { data: stats } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', userId)
        .single();

      // Get weight progress
      const { data: goal } = await supabase
        .from('weight_goals')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      // Calculate score based on category
      let score = 0;
      let scoreLabel = '';

      switch (category) {
        case 'weight_loss':
          score = goal ? (goal.start_weight_kg - (goal.current_weight_kg || goal.start_weight_kg)) : 0;
          scoreLabel = `${score.toFixed(1)}kg lost`;
          break;
        case 'streaks':
          score = stats?.tracking_streak || 0;
          scoreLabel = `${score} day streak`;
          break;
        case 'xp':
          score = stats?.total_xp || 0;
          scoreLabel = `${score} XP`;
          break;
        case 'challenges':
          score = stats?.challenges_won || 0;
          scoreLabel = `${score} won`;
          break;
      }

      data.push({
        user_id: userId,
        profile,
        stats,
        goal,
        score,
        scoreLabel
      });
    }

    // Sort by score descending
    return data.sort((a, b) => b.score - a.score);
  };

  if (loading) {
    return (
      <div className="leaderboards-container">
        <div className="loading">Loading leaderboards...</div>
      </div>
    );
  }

  return (
    <div className="leaderboards-container">
      <div className="leaderboards-header">
        <h2>🏆 Leaderboards</h2>
        <p className="leaderboards-subtitle">Compete with friends and the community</p>
      </div>

      {/* Category Selection */}
      <div className="category-selector">
        {[
          { id: 'weight_loss', icon: '📉', label: 'Weight Loss' },
          { id: 'streaks', icon: '🔥', label: 'Streaks' },
          { id: 'xp', icon: '⭐', label: 'Total XP' },
          { id: 'challenges', icon: '⚔️', label: 'Challenges Won' },
        ].map(cat => (
          <button
            key={cat.id}
            className={`category-btn ${category === cat.id ? 'active' : ''}`}
            onClick={() => setCategory(cat.id)}
          >
            <span className="category-icon">{cat.icon}</span>
            <span className="category-label">{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Scope Toggle */}
      <div className="scope-toggle">
        <button
          className={`scope-btn ${scope === 'friends' ? 'active' : ''}`}
          onClick={() => setScope('friends')}
        >
          👥 Friends Only
        </button>
        <button
          className={`scope-btn ${scope === 'global' ? 'active' : ''}`}
          onClick={() => setScope('global')}
        >
          🌍 Global
        </button>
      </div>

      {/* Current User Rank Badge */}
      {currentUserRank && (
        <div className="user-rank-badge">
          Your current rank: #{currentUserRank}
        </div>
      )}

      {/* Leaderboard */}
      <div className="leaderboard-list">
        {leaderboard.length === 0 ? (
          <div className="empty-leaderboard">
            <div className="empty-icon">🏆</div>
            <h3>No data yet</h3>
            <p>
              {scope === 'friends'
                ? 'Add friends to see rankings!'
                : 'Be the first to set a record!'}
            </p>
          </div>
        ) : (
          leaderboard.map((entry, index) => (
            <LeaderboardEntry
              key={entry.user_id}
              entry={entry}
              rank={index + 1}
              isCurrentUser={currentUserRank === index + 1}
            />
          ))
        )}
      </div>
    </div>
  );
}

function LeaderboardEntry({ entry, rank, isCurrentUser }) {
  const getRankBadge = () => {
    if (rank === 1) return { emoji: '🥇', color: '#FFD700' };
    if (rank === 2) return { emoji: '🥈', color: '#C0C0C0' };
    if (rank === 3) return { emoji: '🥉', color: '#CD7F32' };
    return { emoji: `#${rank}`, color: '#6b7280' };
  };

  const badge = getRankBadge();

  return (
    <div className={`leaderboard-entry ${isCurrentUser ? 'current-user' : ''}`}>
      <div className="entry-rank" style={{ color: badge.color }}>
        {badge.emoji}
      </div>

      <img
        src={entry.profile.avatar_url || '/placeholder-avatar.png'}
        alt={entry.profile.full_name}
        className="entry-avatar"
      />

      <div className="entry-info">
        <div className="entry-name">
          {entry.profile.full_name}
          {isCurrentUser && <span className="you-badge">You</span>}
        </div>
        <div className="entry-stats">
          Level {entry.stats?.current_level || 1} • 
          {entry.stats?.achievements_count || 0} achievements
        </div>
      </div>

      <div className="entry-score">
        <div className="score-value">{entry.scoreLabel}</div>
      </div>
    </div>
  );
}
