'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabaseClient';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import './friend-comparison.css';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, Title, Tooltip, Legend, Filler
);

const CHART_COLORS = {
  me:     { line: '#10b981', fill: 'rgba(16,185,129,0.12)' },
  friend: { line: '#6366f1', fill: 'rgba(99,102,241,0.12)' },
};

export default function FriendComparison() {
  const supabase = createClient();
  const [friends, setFriends] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [myData, setMyData] = useState(null);
  const [friendData, setFriendData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeChart, setActiveChart] = useState('weight');
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    loadFriends();
  }, []);

  useEffect(() => {
    if (selectedFriend && currentUser) {
      loadComparisonData();
    }
  }, [selectedFriend, currentUser]);

  const loadFriends = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUser(user);

    const { data: friendships } = await supabase
      .from('friendships')
      .select('id, friend_id')
      .eq('user_id', user.id)
      .eq('status', 'accepted');

    if (!friendships?.length) { setFriends([]); return; }

    const ids = friendships.map(f => f.friend_id);
    const { data: profiles } = await supabase
      .from('profiles').select('id, full_name, avatar_url').in('id', ids);
    const map = Object.fromEntries((profiles || []).map(p => [p.id, p]));

    setFriends(friendships.map(f => ({
      id: f.friend_id,
      ...map[f.friend_id]
    })));
  };

  const loadComparisonData = async () => {
    setLoading(true);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const since = thirtyDaysAgo.toISOString().split('T')[0];

    const [myWeight, friendWeight, myNutrition, friendNutrition, myStats, friendStats] =
      await Promise.all([
        supabase.from('weight_logs').select('weight_kg, logged_at')
          .eq('user_id', currentUser.id)
          .gte('logged_at', since)
          .order('logged_at', { ascending: true }),
        supabase.from('weight_logs').select('weight_kg, logged_at')
          .eq('user_id', selectedFriend.id)
          .gte('logged_at', since)
          .order('logged_at', { ascending: true }),
        supabase.from('daily_nutrition_summary').select('summary_date, total_calories, total_protein_g, total_carbs_g, total_fat_g')
          .eq('user_id', currentUser.id)
          .gte('summary_date', since)
          .order('summary_date', { ascending: true }),
        supabase.from('daily_nutrition_summary').select('summary_date, total_calories, total_protein_g, total_carbs_g, total_fat_g')
          .eq('user_id', selectedFriend.id)
          .gte('summary_date', since)
          .order('summary_date', { ascending: true }),
        supabase.from('user_stats').select('*').eq('user_id', currentUser.id).single(),
        supabase.from('user_stats').select('*').eq('user_id', selectedFriend.id).single(),
      ]);

    setMyData({
      weight: myWeight.data || [],
      nutrition: myNutrition.data || [],
      stats: myStats.data || {},
    });
    setFriendData({
      weight: friendWeight.data || [],
      nutrition: friendNutrition.data || [],
      stats: friendStats.data || {},
    });
    setLoading(false);
  };

  // Build unified date axis for weight chart
  const buildWeightChart = () => {
    const allDates = [...new Set([
      ...(myData?.weight || []).map(w => w.logged_at.split('T')[0]),
      ...(friendData?.weight || []).map(w => w.logged_at.split('T')[0]),
    ])].sort();

    const myMap = Object.fromEntries((myData?.weight || []).map(w => [w.logged_at.split('T')[0], w.weight_kg]));
    const friendMap = Object.fromEntries((friendData?.weight || []).map(w => [w.logged_at.split('T')[0], w.weight_kg]));

    return {
      labels: allDates.map(d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
      datasets: [
        {
          label: 'You',
          data: allDates.map(d => myMap[d] ?? null),
          borderColor: CHART_COLORS.me.line,
          backgroundColor: CHART_COLORS.me.fill,
          tension: 0.4, fill: true, spanGaps: true,
          pointRadius: 3, borderWidth: 2,
        },
        {
          label: selectedFriend?.full_name || 'Friend',
          data: allDates.map(d => friendMap[d] ?? null),
          borderColor: CHART_COLORS.friend.line,
          backgroundColor: CHART_COLORS.friend.fill,
          tension: 0.4, fill: true, spanGaps: true,
          pointRadius: 3, borderWidth: 2,
        },
      ],
    };
  };

  const buildCaloriesChart = () => {
    const allDates = [...new Set([
      ...(myData?.nutrition || []).map(n => n.summary_date),
      ...(friendData?.nutrition || []).map(n => n.summary_date),
    ])].sort();

    const myMap = Object.fromEntries((myData?.nutrition || []).map(n => [n.summary_date, n.total_calories]));
    const friendMap = Object.fromEntries((friendData?.nutrition || []).map(n => [n.summary_date, n.total_calories]));

    return {
      labels: allDates.map(d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
      datasets: [
        {
          label: 'You',
          data: allDates.map(d => myMap[d] ?? null),
          borderColor: CHART_COLORS.me.line,
          backgroundColor: CHART_COLORS.me.fill,
          tension: 0.3, fill: true, spanGaps: true,
          pointRadius: 2, borderWidth: 2,
        },
        {
          label: selectedFriend?.full_name || 'Friend',
          data: allDates.map(d => friendMap[d] ?? null),
          borderColor: CHART_COLORS.friend.line,
          backgroundColor: CHART_COLORS.friend.fill,
          tension: 0.3, fill: true, spanGaps: true,
          pointRadius: 2, borderWidth: 2,
        },
      ],
    };
  };

  const buildMacrosChart = () => {
    const avg = (arr, key) => arr.length
      ? +(arr.reduce((s, d) => s + (d[key] || 0), 0) / arr.length).toFixed(1)
      : 0;

    return {
      labels: ['Protein (g)', 'Carbs (g)', 'Fat (g)'],
      datasets: [
        {
          label: 'You',
          data: [
            avg(myData?.nutrition || [], 'total_protein_g'),
            avg(myData?.nutrition || [], 'total_carbs_g'),
            avg(myData?.nutrition || [], 'total_fat_g'),
          ],
          backgroundColor: CHART_COLORS.me.line,
          borderRadius: 6,
        },
        {
          label: selectedFriend?.full_name || 'Friend',
          data: [
            avg(friendData?.nutrition || [], 'total_protein_g'),
            avg(friendData?.nutrition || [], 'total_carbs_g'),
            avg(friendData?.nutrition || [], 'total_fat_g'),
          ],
          backgroundColor: CHART_COLORS.friend.line,
          borderRadius: 6,
        },
      ],
    };
  };

  const chartOpts = (yLabel) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: 'var(--text-primary)', font: { size: 12 } } },
      tooltip: { mode: 'index', intersect: false },
    },
    scales: {
      x: { ticks: { color: 'var(--text-tertiary)', maxTicksLimit: 8 }, grid: { color: 'var(--border-glass)' } },
      y: { ticks: { color: 'var(--text-tertiary)' }, grid: { color: 'var(--border-glass)' }, title: { display: true, text: yLabel, color: 'var(--text-secondary)' } },
    },
  });

  if (friends.length === 0) {
    return (
      <div id="friend-comparison" className="friend-comparison-container">
        <div className="comparison-header">
          <h2>📊 Compare with Friends</h2>
        </div>
        <div className="comparison-empty">
          <div className="empty-icon">👥</div>
          <p>Add friends to compare your progress together!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="friend-comparison-container">
      <div className="comparison-header">
        <h2>📊 Compare with Friends</h2>
        <p className="comparison-subtitle">See how your journey stacks up — last 30 days</p>
      </div>

      {/* Friend selector */}
      <div className="friend-selector">
        {friends.map(f => (
          <button
            key={f.id}
            className={`friend-pill ${selectedFriend?.id === f.id ? 'active' : ''}`}
            onClick={() => setSelectedFriend(f)}
          >
            {f.avatar_url
              ? <img src={f.avatar_url} alt={f.full_name} className="pill-avatar" />
              : <span className="pill-avatar-placeholder">{(f.full_name || '?')[0].toUpperCase()}</span>
            }
            {f.full_name || 'Unknown'}
          </button>
        ))}
      </div>

      {!selectedFriend && (
        <div className="comparison-prompt">
          <p>Select a friend above to compare your stats</p>
        </div>
      )}

      {selectedFriend && loading && (
        <div className="comparison-loading">
          <div className="loading-spinner" />
          <p>Loading comparison data...</p>
        </div>
      )}

      {selectedFriend && !loading && myData && friendData && (
        <>
          {/* Stat cards */}
          <div className="stat-cards">
            {[
              { label: 'Streak', myVal: myData.stats?.tracking_streak_current || 0, friendVal: friendData.stats?.tracking_streak_current || 0, unit: 'days', icon: '🔥' },
              { label: 'Total XP', myVal: myData.stats?.total_xp || 0, friendVal: friendData.stats?.total_xp || 0, unit: 'XP', icon: '⭐' },
              { label: 'Level', myVal: myData.stats?.level || 1, friendVal: friendData.stats?.level || 1, unit: '', icon: '🏅' },
              { label: 'Weigh-ins', myVal: myData.weight.length, friendVal: friendData.weight.length, unit: '', icon: '⚖️' },
            ].map(s => (
              <div key={s.label} className="comparison-stat-card">
                <div className="stat-icon-label">{s.icon} {s.label}</div>
                <div className="stat-row">
                  <div className={`stat-col me ${s.myVal >= s.friendVal ? 'winning' : ''}`}>
                    <span className="stat-name">You</span>
                    <span className="stat-num">{s.myVal}{s.unit && ` ${s.unit}`}</span>
                    {s.myVal > s.friendVal && <span className="crown">👑</span>}
                  </div>
                  <div className="stat-vs">VS</div>
                  <div className={`stat-col friend ${s.friendVal > s.myVal ? 'winning' : ''}`}>
                    <span className="stat-name">{selectedFriend.full_name?.split(' ')[0] || 'Friend'}</span>
                    <span className="stat-num">{s.friendVal}{s.unit && ` ${s.unit}`}</span>
                    {s.friendVal > s.myVal && <span className="crown">👑</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Chart tabs */}
          <div className="chart-tabs">
            {[
              { id: 'weight', label: '⚖️ Weight' },
              { id: 'calories', label: '🔥 Calories' },
              { id: 'macros', label: '🥗 Macros Avg' },
            ].map(t => (
              <button
                key={t.id}
                className={`chart-tab ${activeChart === t.id ? 'active' : ''}`}
                onClick={() => setActiveChart(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="chart-area">
            {activeChart === 'weight' && (
              <Line data={buildWeightChart()} options={chartOpts('Weight (kg)')} />
            )}
            {activeChart === 'calories' && (
              <Line data={buildCaloriesChart()} options={chartOpts('Calories (kcal)')} />
            )}
            {activeChart === 'macros' && (
              <Bar data={buildMacrosChart()} options={chartOpts('Grams (g)')} />
            )}
          </div>

          {(myData.weight.length === 0 && friendData.weight.length === 0) && (
            <div className="no-data-note">
              No weight data logged yet in the last 30 days.
            </div>
          )}
        </>
      )}
    </div>
  );
}
