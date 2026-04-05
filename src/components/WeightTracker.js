'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import './weight-tracker.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function WeightTracker() {
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [mood, setMood] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [weightLogs, setWeightLogs] = useState([]);
  const [goal, setGoal] = useState(null);
  const [progress, setProgress] = useState(null);
  const [weightUnit, setWeightUnit] = useState('lbs');

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load user profile for weight unit
      const { data: profile } = await supabase
        .from('profiles')
        .select('weight_unit')
        .eq('id', user.id)
        .single();
      
      if (profile) setWeightUnit(profile.weight_unit || 'lbs');

      // Load weight logs
      const { data: logs } = await supabase
        .from('weight_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('logged_at', { ascending: false })
        .limit(30);
      
      setWeightLogs(logs || []);

      // Load active goal
      const { data: goalData } = await supabase
        .from('weight_goals')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();
      
      if (goalData) {
        setGoal(goalData);
        calculateProgress(goalData);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const calculateProgress = (goalData) => {
    const startWeight = goalData.start_weight_kg;
    const currentWeight = goalData.current_weight_kg || startWeight;
    const targetWeight = goalData.target_weight_kg;
    
    const weightLost = startWeight - currentWeight;
    const weightToGo = currentWeight - targetWeight;
    const totalToLose = startWeight - targetWeight;
    const progressPercent = (weightLost / totalToLose) * 100;

    setProgress({
      startWeight,
      currentWeight,
      targetWeight,
      weightLost,
      weightToGo,
      progressPercent: Math.max(0, Math.min(100, progressPercent))
    });
  };

  const handleLogWeight = async () => {
    if (!weight) return;
    
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const weightKg = weightUnit === 'lbs' ? parseFloat(weight) * 0.453592 : parseFloat(weight);
      const bodyFatNum = bodyFat ? parseFloat(bodyFat) : null;

      // Insert weight log
      const { error } = await supabase.from('weight_logs').insert({
        user_id: user.id,
        weight_kg: weightKg,
        body_fat_percentage: bodyFatNum,
        mood: mood || null,
        notes: notes || null
      });

      if (error) throw error;

      // Update streak
      await fetch('/api/streaks/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: user.id, 
          streakType: 'weigh_in',
          success: true
        })
      });

      // Check for achievements
      await fetch('/api/achievements/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: user.id, 
          event: 'weight_logged',
          data: { weightKg, weightLost: progress?.weightLost }
        })
      });

      // Clear form
      setWeight('');
      setBodyFat('');
      setMood('');
      setNotes('');

      // Reload data
      await loadData();
      
      alert('✅ Weight logged successfully!');
    } catch (error) {
      console.error('Error logging weight:', error);
      alert('Failed to log weight. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toDisplayUnit = (kg) => {
    if (weightUnit === 'lbs') return (kg * 2.20462).toFixed(1);
    return kg.toFixed(1);
  };

  const getChartData = () => {
    if (!weightLogs.length) return null;

    const sortedLogs = [...weightLogs].reverse();
    const labels = sortedLogs.map(log => new Date(log.logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    const weights = sortedLogs.map(log => weightUnit === 'lbs' ? log.weight_kg * 2.20462 : log.weight_kg);

    return {
      labels,
      datasets: [
        {
          label: 'Your Weight',
          data: weights,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6
        },
        ...(goal ? [{
          label: 'Goal',
          data: Array(labels.length).fill(weightUnit === 'lbs' ? goal.target_weight_kg * 2.20462 : goal.target_weight_kg),
          borderColor: '#f59e0b',
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false
        }] : [])
      ]
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      tooltip: {
        callbacks: {
          label: (context) => `${context.dataset.label}: ${context.parsed.y.toFixed(1)} ${weightUnit}`
        }
      }
    },
    scales: {
      y: {
        beginAtZero: false
      }
    }
  };

  const chartData = getChartData();

  return (
    <div className="weight-tracker">
      {/* Daily Check-in Widget */}
      <div className="check-in-card">
        <h2>⚖️ Daily Weigh-In</h2>
        
        <div className="weight-input-group">
          <label>Today's Weight</label>
          <div className="input-with-unit">
            <input
              type="number"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder={weightUnit === 'lbs' ? '178.4' : '81.0'}
            />
            <span className="unit">{weightUnit}</span>
          </div>
        </div>

        <div className="optional-inputs">
          <div className="input-group">
            <label>Body Fat % (optional)</label>
            <input
              type="number"
              step="0.1"
              value={bodyFat}
              onChange={(e) => setBodyFat(e.target.value)}
              placeholder="18.5"
            />
          </div>
        </div>

        <div className="mood-selector">
          <label>How do you feel today?</label>
          <div className="mood-buttons">
            <button
              className={`mood-btn ${mood === 'great' ? 'selected' : ''}`}
              onClick={() => setMood('great')}
            >
              😊 Great
            </button>
            <button
              className={`mood-btn ${mood === 'good' ? 'selected' : ''}`}
              onClick={() => setMood('good')}
            >
              🙂 Good
            </button>
            <button
              className={`mood-btn ${mood === 'okay' ? 'selected' : ''}`}
              onClick={() => setMood('okay')}
            >
              😐 Okay
            </button>
            <button
              className={`mood-btn ${mood === 'struggling' ? 'selected' : ''}`}
              onClick={() => setMood('struggling')}
            >
              😔 Struggling
            </button>
          </div>
        </div>

        <div className="notes-input">
          <label>Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="How are you feeling? Any insights?"
            rows="3"
          />
        </div>

        <button 
          className="log-btn"
          onClick={handleLogWeight}
          disabled={!weight || loading}
        >
          {loading ? 'Logging...' : 'Log Weight'}
        </button>
      </div>

      {/* Progress Card */}
      {progress && (
        <div className="progress-card">
          <h3>📊 Your Progress</h3>
          
          <div className="progress-bar-container">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${progress.progressPercent}%` }}
              >
                <span className="progress-text">{progress.progressPercent.toFixed(1)}%</span>
              </div>
            </div>
          </div>

          <div className="progress-stats">
            <div className="stat">
              <span className="stat-label">Lost</span>
              <span className="stat-value">{toDisplayUnit(progress.weightLost)} {weightUnit}</span>
            </div>
            <div className="stat">
              <span className="stat-label">To Go</span>
              <span className="stat-value">{toDisplayUnit(progress.weightToGo)} {weightUnit}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Goal</span>
              <span className="stat-value">{toDisplayUnit(progress.targetWeight)} {weightUnit}</span>
            </div>
          </div>

          {progress.progressPercent > 0 ? (
            <p className="encouragement">✓ Great progress! Keep it up!</p>
          ) : (
            <p className="encouragement">💪 Let's get started on your journey!</p>
          )}
        </div>
      )}

      {/* Weight Chart */}
      {chartData && (
        <div className="chart-card">
          <h3>📈 Weight Journey</h3>
          <div className="chart-container">
            <Line data={chartData} options={chartOptions} />
          </div>
          
          {weightLogs.length > 0 && (
            <div className="chart-stats">
              <p>Total weigh-ins: {weightLogs.length}</p>
              {weightLogs.length >= 2 && (
                <p>
                  This week: {
                    weightLogs[0] && weightLogs.length > 6 
                      ? (toDisplayUnit(weightLogs[6]?.weight_kg - weightLogs[0].weight_kg)) 
                      : '—'
                  } {weightUnit}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Recent Logs */}
      {weightLogs.length > 0 && (
        <div className="recent-logs">
          <h3>Recent Weigh-Ins</h3>
          <div className="logs-list">
            {weightLogs.slice(0, 5).map(log => (
              <div key={log.id} className="log-item">
                <div className="log-date">
                  {new Date(log.logged_at).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </div>
                <div className="log-weight">
                  {toDisplayUnit(log.weight_kg)} {weightUnit}
                </div>
                {log.mood && (
                  <div className="log-mood">
                    {log.mood === 'great' && '😊'}
                    {log.mood === 'good' && '🙂'}
                    {log.mood === 'okay' && '😐'}
                    {log.mood === 'struggling' && '😔'}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
