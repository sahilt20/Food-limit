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

// Inline registration happens after racePlugin is defined in component scope —
// we register it per-chart via the plugins option instead of globally.

const CHART_COLORS = {
  me:     { line: '#10b981', fill: 'rgba(16,185,129,0.08)', glow: 'rgba(16,185,129,0.6)' },
  friend: { line: '#f59e0b', fill: 'rgba(245,158,11,0.08)', glow: 'rgba(245,158,11,0.6)' },
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

    const myVals = allDates.map(d => myMap[d] ?? null);
    const friendVals = allDates.map(d => friendMap[d] ?? null);
    const allVals = [...myVals, ...friendVals].filter(v => v != null);

    return {
      labels: allDates.map(d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
      datasets: [
        {
          label: 'You',
          data: myVals,
          borderColor: CHART_COLORS.me.line,
          backgroundColor: CHART_COLORS.me.fill,
          tension: 0.35, fill: true, spanGaps: true,
          pointRadius: 5, pointHoverRadius: 9, borderWidth: 3,
          pointBackgroundColor: CHART_COLORS.me.line,
          pointBorderColor: '#0f0f19',
          pointBorderWidth: 2,
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: CHART_COLORS.me.line,
          pointHoverBorderWidth: 3,
          borderCapStyle: 'round',
          borderJoinStyle: 'round',
        },
        {
          label: selectedFriend?.full_name || 'Friend',
          data: friendVals,
          borderColor: CHART_COLORS.friend.line,
          backgroundColor: CHART_COLORS.friend.fill,
          tension: 0.35, fill: true, spanGaps: true,
          pointRadius: 5, pointHoverRadius: 9, borderWidth: 3,
          pointBackgroundColor: CHART_COLORS.friend.line,
          pointBorderColor: '#0f0f19',
          pointBorderWidth: 2,
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: CHART_COLORS.friend.line,
          pointHoverBorderWidth: 3,
          borderCapStyle: 'round',
          borderJoinStyle: 'round',
        },
      ],
      _allVals: allVals,
    };
  };

  const buildCaloriesChart = () => {
    const allDates = [...new Set([
      ...(myData?.nutrition || []).map(n => n.summary_date),
      ...(friendData?.nutrition || []).map(n => n.summary_date),
    ])].sort();

    const myMap = Object.fromEntries((myData?.nutrition || []).map(n => [n.summary_date, n.total_calories]));
    const friendMap = Object.fromEntries((friendData?.nutrition || []).map(n => [n.summary_date, n.total_calories]));

    const myVals = allDates.map(d => myMap[d] ?? null);
    const friendVals = allDates.map(d => friendMap[d] ?? null);
    const allVals = [...myVals, ...friendVals].filter(v => v != null);

    return {
      labels: allDates.map(d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
      datasets: [
        {
          label: 'You',
          data: myVals,
          borderColor: CHART_COLORS.me.line,
          backgroundColor: CHART_COLORS.me.fill,
          tension: 0.3, fill: true, spanGaps: true,
          pointRadius: 4, pointHoverRadius: 9, borderWidth: 3,
          pointBackgroundColor: CHART_COLORS.me.line,
          pointBorderColor: '#0f0f19',
          pointBorderWidth: 2,
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: CHART_COLORS.me.line,
          pointHoverBorderWidth: 3,
        },
        {
          label: selectedFriend?.full_name || 'Friend',
          data: friendVals,
          borderColor: CHART_COLORS.friend.line,
          backgroundColor: CHART_COLORS.friend.fill,
          tension: 0.3, fill: true, spanGaps: true,
          pointRadius: 4, pointHoverRadius: 9, borderWidth: 3,
          pointBackgroundColor: CHART_COLORS.friend.line,
          pointBorderColor: '#0f0f19',
          pointBorderWidth: 2,
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: CHART_COLORS.friend.line,
          pointHoverBorderWidth: 3,
        },
      ],
      _allVals: allVals,
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
          borderRadius: 8,
          borderSkipped: false,
          hoverBackgroundColor: '#34d399',
        },
        {
          label: selectedFriend?.full_name || 'Friend',
          data: [
            avg(friendData?.nutrition || [], 'total_protein_g'),
            avg(friendData?.nutrition || [], 'total_carbs_g'),
            avg(friendData?.nutrition || [], 'total_fat_g'),
          ],
          backgroundColor: CHART_COLORS.friend.line,
          borderRadius: 8,
          borderSkipped: false,
          hoverBackgroundColor: '#fcd34d',
        },
      ],
    };
  };

  // Race-style custom plugin: draws "LEADING" badge on the winning line's last point
  const racePlugin = {
    id: 'racePlugin',
    afterDraw(chart) {
      const { ctx, data, chartArea } = chart;
      if (!chartArea) return;
      const datasets = data.datasets;
      if (datasets.length < 2) return;

      // Find last non-null values for each dataset
      const lastVal = (ds) => {
        for (let i = ds.data.length - 1; i >= 0; i--) {
          if (ds.data[i] != null) return { val: ds.data[i], idx: i };
        }
        return null;
      };

      const a = lastVal(datasets[0]);
      const b = lastVal(datasets[1]);
      if (!a || !b) return;

      // Determine who's "leading" based on chart type
      // For weight loss, lower is winning; for calories/macros, higher may vary —
      // we'll show a flag for whichever has the more recent data point closest to goal
      // Simple approach: just show gap between last values
      const gap = Math.abs(a.val - b.val).toFixed(1);
      if (gap === '0.0') return;

      const unit = chart.options.scales.y?.title?.text?.includes('kg') ? 'kg'
        : chart.options.scales.y?.title?.text?.includes('kcal') ? 'kcal' : 'g';

      // Draw gap badge at center top of chart
      const cx = (chartArea.left + chartArea.right) / 2;
      const cy = chartArea.top + 16;

      ctx.save();
      const label = `GAP: ${gap} ${unit}`;
      ctx.font = 'bold 11px monospace';
      const tw = ctx.measureText(label).width;
      const bw = tw + 20, bh = 22;

      ctx.fillStyle = 'rgba(15,15,25,0.85)';
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(cx - bw / 2, cy - 11, bw, bh, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#e2e8f0';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, cx, cy);
      ctx.restore();
    },
  };

  const chartOpts = (yLabel, allValues = []) => {
    const nums = allValues.filter(v => v != null && !isNaN(v));
    const min = nums.length ? Math.min(...nums) : 0;
    const max = nums.length ? Math.max(...nums) : 100;
    const range = max - min || 10;
    const pad = range * 0.28;

    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 800, easing: 'easeInOutQuart' },
      plugins: {
        racePlugin,
        legend: {
          labels: {
            color: '#e2e8f0',
            font: { size: 12, weight: '700', family: 'monospace' },
            padding: 20,
            usePointStyle: true,
            pointStyle: 'rectRounded',
          },
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: 'rgba(8,8,16,0.96)',
          titleColor: '#e2e8f0',
          bodyColor: '#94a3b8',
          borderColor: 'rgba(255,255,255,0.12)',
          borderWidth: 1,
          padding: 14,
          titleFont: { family: 'monospace', size: 11, weight: '700' },
          bodyFont: { family: 'monospace', size: 11 },
          callbacks: {
            title: items => `📅 ${items[0]?.label}`,
            label: ctx => {
              const val = ctx.parsed.y != null ? ctx.parsed.y : '—';
              const prefix = ctx.datasetIndex === 0 ? '🟢' : '🟡';
              return ` ${prefix} ${ctx.dataset.label}: ${val} ${yLabel.split(' ')[0]}`;
            },
            afterBody: items => {
              const vals = items.filter(i => i.parsed.y != null).map(i => i.parsed.y);
              if (vals.length < 2) return [];
              const diff = (vals[0] - vals[1]).toFixed(1);
              const sign = diff > 0 ? '+' : '';
              return [``, ` ⚡ Difference: ${sign}${diff}`];
            },
          },
        },
      },
      scales: {
        x: {
          ticks: { color: '#64748b', maxTicksLimit: 10, font: { size: 10, family: 'monospace' } },
          grid: { color: 'rgba(255,255,255,0.04)' },
          border: { color: 'rgba(255,255,255,0.08)' },
        },
        y: {
          min: nums.length ? Math.floor(min - pad) : undefined,
          max: nums.length ? Math.ceil(max + pad) : undefined,
          ticks: { color: '#64748b', font: { size: 10, family: 'monospace' } },
          grid: { color: 'rgba(255,255,255,0.04)' },
          border: { color: 'rgba(255,255,255,0.08)' },
          title: { display: true, text: yLabel, color: '#64748b', font: { size: 10, family: 'monospace' } },
        },
      },
    };
  };

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
            ].map(s => {
              const tied = s.myVal === s.friendVal;
              return (
                <div key={s.label} className="comparison-stat-card">
                  <div className="stat-icon-label">{s.icon} {s.label}</div>
                  <div className="stat-row">
                    <div className={`stat-col me ${s.myVal >= s.friendVal ? 'winning' : ''}`}>
                      {s.myVal > s.friendVal && <span className="crown">👑</span>}
                      <span className="stat-name">You</span>
                      <span className="stat-num">{s.myVal}{s.unit && ` ${s.unit}`}</span>
                    </div>
                    <div className="stat-vs">{tied ? '=' : 'VS'}</div>
                    <div className={`stat-col friend ${s.friendVal > s.myVal ? 'winning' : ''}`}>
                      {s.friendVal > s.myVal && <span className="crown">👑</span>}
                      <span className="stat-name">{selectedFriend.full_name?.split(' ')[0] || 'Friend'}</span>
                      <span className="stat-num">{s.friendVal}{s.unit && ` ${s.unit}`}</span>
                    </div>
                  </div>
                </div>
              );
            })}
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
            {activeChart === 'weight' && (() => { const d = buildWeightChart(); return <Line data={d} options={chartOpts('Weight (kg)', d._allVals)} />; })()}
            {activeChart === 'calories' && (() => { const d = buildCaloriesChart(); return <Line data={d} options={chartOpts('Calories (kcal)', d._allVals)} />; })()}
            {activeChart === 'macros' && <Bar data={buildMacrosChart()} options={chartOpts('Grams (g)')} />}
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
