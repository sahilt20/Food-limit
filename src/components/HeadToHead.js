'use client';
import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import './head-to-head.css';

export default function HeadToHead({ friendId }) {
  const supabase = createClientComponentClient();
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (friendId) {
      loadComparison();
    }
  }, [friendId]);

  const loadComparison = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load data for both users
      const [myData, friendData] = await Promise.all([
        loadUserData(user.id),
        loadUserData(friendId)
      ]);

      setComparison({
        me: myData,
        friend: friendData
      });

    } catch (error) {
      console.error('Error loading comparison:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserData = async (userId) => {
    // Profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    // Weight goal & progress
    const { data: goal } = await supabase
      .from('weight_goals')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    // Latest weight
    const { data: latestWeight } = await supabase
      .from('weight_logs')
      .select('*')
      .eq('user_id', userId)
      .order('logged_at', { ascending: false })
      .limit(1)
      .single();

    // Stats
    const { data: stats } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Recent calorie data (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: calorieData } = await supabase
      .from('daily_nutrition_summary')
      .select('*')
      .eq('user_id', userId)
      .gte('summary_date', thirtyDaysAgo.toISOString().split('T')[0])
      .order('summary_date', { ascending: false });

    // Calculate averages
    const avgCalories = calorieData && calorieData.length > 0
      ? Math.round(calorieData.reduce((sum, day) => sum + day.total_calories, 0) / calorieData.length)
      : 0;

    // Count meal logs
    const { count: mealCount } = await supabase
      .from('consumed_items')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('consumed_at', thirtyDaysAgo.toISOString());

    const weightLost = goal ? (goal.start_weight_kg - (latestWeight?.weight_kg || goal.start_weight_kg)) : 0;

    return {
      profile,
      goal,
      latestWeight,
      stats,
      weightLost,
      avgCalories,
      mealCount: mealCount || 0
    };
  };

  if (loading) {
    return (
      <div className="head-to-head-container">
        <div className="loading">Loading comparison...</div>
      </div>
    );
  }

  if (!comparison) {
    return (
      <div className="head-to-head-container">
        <div className="error">Unable to load comparison data</div>
      </div>
    );
  }

  const metrics = [
    {
      id: 'weight_lost',
      icon: '⚖️',
      label: 'Weight Lost',
      meValue: comparison.me.weightLost,
      friendValue: comparison.friend.weightLost,
      unit: 'kg',
      higherIsBetter: true
    },
    {
      id: 'streak',
      icon: '🔥',
      label: 'Current Streak',
      meValue: comparison.me.stats?.tracking_streak || 0,
      friendValue: comparison.friend.stats?.tracking_streak || 0,
      unit: 'days',
      higherIsBetter: true
    },
    {
      id: 'calories',
      icon: '🍽️',
      label: 'Avg Calories (30d)',
      meValue: comparison.me.avgCalories,
      friendValue: comparison.friend.avgCalories,
      unit: 'kcal',
      higherIsBetter: false
    },
    {
      id: 'meals',
      icon: '📝',
      label: 'Meals Logged (30d)',
      meValue: comparison.me.mealCount,
      friendValue: comparison.friend.mealCount,
      unit: 'meals',
      higherIsBetter: true
    },
    {
      id: 'achievements',
      icon: '🏆',
      label: 'Achievements',
      meValue: comparison.me.stats?.achievements_count || 0,
      friendValue: comparison.friend.stats?.achievements_count || 0,
      unit: 'unlocked',
      higherIsBetter: true
    },
    {
      id: 'xp',
      icon: '⭐',
      label: 'Total XP',
      meValue: comparison.me.stats?.total_xp || 0,
      friendValue: comparison.friend.stats?.total_xp || 0,
      unit: 'XP',
      higherIsBetter: true
    }
  ];

  // Calculate overall score
  const myWins = metrics.filter(m => {
    if (m.higherIsBetter) {
      return m.meValue > m.friendValue;
    } else {
      return m.meValue < m.friendValue && m.meValue > 0;
    }
  }).length;

  const friendWins = metrics.filter(m => {
    if (m.higherIsBetter) {
      return m.friendValue > m.meValue;
    } else {
      return m.friendValue < m.meValue && m.friendValue > 0;
    }
  }).length;

  return (
    <div className="head-to-head-container">
      <div className="h2h-header">
        <h2>⚔️ Head-to-Head Comparison</h2>
      </div>

      {/* User Cards */}
      <div className="users-comparison">
        <UserCard user={comparison.me} label="You" wins={myWins} />
        <div className="vs-divider">VS</div>
        <UserCard user={comparison.friend} label={comparison.friend.profile.full_name} wins={friendWins} />
      </div>

      {/* Overall Score */}
      <div className="overall-score">
        <div className="score-bar">
          <div 
            className="score-fill-me"
            style={{ width: `${(myWins / metrics.length) * 100}%` }}
          ></div>
          <div 
            className="score-fill-friend"
            style={{ width: `${(friendWins / metrics.length) * 100}%` }}
          ></div>
        </div>
        <div className="score-labels">
          <span>{myWins} wins</span>
          <span>{friendWins} wins</span>
        </div>
      </div>

      {/* Metrics Comparison */}
      <div className="metrics-grid">
        {metrics.map(metric => (
          <MetricComparison
            key={metric.id}
            metric={metric}
            meValue={metric.meValue}
            friendValue={metric.friendValue}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="h2h-actions">
        <button className="action-button challenge">
          ⚔️ Challenge {comparison.friend.profile.full_name}
        </button>
        <button className="action-button message">
          💬 Send Message
        </button>
        <button className="action-button share">
          📤 Share Comparison
        </button>
      </div>
    </div>
  );
}

function UserCard({ user, label, wins }) {
  return (
    <div className="user-card-h2h">
      <img 
        src={user.profile.avatar_url || '/placeholder-avatar.png'}
        alt={user.profile.full_name}
        className="user-avatar-h2h"
      />
      <h3>{label}</h3>
      <div className="user-level">
        Level {user.stats?.current_level || 1}
      </div>
      <div className="user-wins">
        {wins > 0 && <span className="wins-badge">🏆 {wins} categories leading</span>}
      </div>
    </div>
  );
}

function MetricComparison({ metric, meValue, friendValue }) {
  const getWinner = () => {
    if (metric.higherIsBetter) {
      if (meValue > friendValue) return 'me';
      if (friendValue > meValue) return 'friend';
    } else {
      if (meValue < friendValue && meValue > 0) return 'me';
      if (friendValue < meValue && friendValue > 0) return 'friend';
    }
    return 'tie';
  };

  const winner = getWinner();

  return (
    <div className="metric-comparison">
      <div className="metric-header">
        <span className="metric-icon">{metric.icon}</span>
        <span className="metric-label">{metric.label}</span>
      </div>

      <div className="metric-values">
        <div className={`value-box ${winner === 'me' ? 'winner' : ''}`}>
          <div className="value-number">{formatValue(meValue)}</div>
          <div className="value-unit">{metric.unit}</div>
          {winner === 'me' && <div className="winner-badge">👑</div>}
        </div>

        <div className={`value-box ${winner === 'friend' ? 'winner' : ''}`}>
          <div className="value-number">{formatValue(friendValue)}</div>
          <div className="value-unit">{metric.unit}</div>
          {winner === 'friend' && <div className="winner-badge">👑</div>}
        </div>
      </div>

      {winner !== 'tie' && (
        <div className="metric-difference">
          Difference: {Math.abs(meValue - friendValue).toFixed(1)} {metric.unit}
        </div>
      )}
    </div>
  );
}

function formatValue(value) {
  if (typeof value === 'number') {
    return value % 1 === 0 ? value : value.toFixed(1);
  }
  return value;
}
