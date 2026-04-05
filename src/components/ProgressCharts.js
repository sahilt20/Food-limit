'use client';
import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend } from 'chart.js';
import { Line, Bar, Pie } from 'react-chartjs-2';
import './progress-charts.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend);

export default function ProgressCharts() {
  const supabase = createClientComponentClient();
  const [timeRange, setTimeRange] = useState('month'); // week, month, 3month, all
  const [weightData, setWeightData] = useState([]);
  const [calorieData, setCalorieData] = useState([]);
  const [macroData, setMacroData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChartData();
  }, [timeRange]);

  const loadChartData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const dateRange = getDateRange(timeRange);

      // Load weight logs
      const { data: weights } = await supabase
        .from('weight_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('logged_at', dateRange.start)
        .lte('logged_at', dateRange.end)
        .order('logged_at', { ascending: true });

      setWeightData(weights || []);

      // Load calorie data
      const { data: calories } = await supabase
        .from('daily_nutrition_summary')
        .select('*')
        .eq('user_id', user.id)
        .gte('summary_date', dateRange.start.split('T')[0])
        .lte('summary_date', dateRange.end.split('T')[0])
        .order('summary_date', { ascending: true });

      setCalorieData(calories || []);

      // Calculate macro averages
      if (calories && calories.length > 0) {
        const avgProtein = calories.reduce((sum, day) => sum + (day.total_protein_g || 0), 0) / calories.length;
        const avgCarbs = calories.reduce((sum, day) => sum + (day.total_carbs_g || 0), 0) / calories.length;
        const avgFat = calories.reduce((sum, day) => sum + (day.total_fat_g || 0), 0) / calories.length;
        
        setMacroData({ protein: avgProtein, carbs: avgCarbs, fat: avgFat });
      }

    } catch (error) {
      console.error('Error loading chart data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDateRange = (range) => {
    const now = new Date();
    const start = new Date();

    switch (range) {
      case 'week':
        start.setDate(now.getDate() - 7);
        break;
      case 'month':
        start.setMonth(now.getMonth() - 1);
        break;
      case '3month':
        start.setMonth(now.getMonth() - 3);
        break;
      case 'all':
        start.setFullYear(now.getFullYear() - 10); // Effectively all time
        break;
    }

    return {
      start: start.toISOString(),
      end: now.toISOString()
    };
  };

  // Weight Trend Chart Data
  const weightChartData = {
    labels: weightData.map(w => new Date(w.logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
    datasets: [
      {
        label: 'Weight (kg)',
        data: weightData.map(w => w.weight_kg),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 4,
        pointHoverRadius: 6
      }
    ]
  };

  // Weekly Weight Change Chart Data
  const weeklyChangeData = calculateWeeklyChanges(weightData);
  const weeklyChangeChartData = {
    labels: weeklyChangeData.map(w => w.week),
    datasets: [
      {
        label: 'Weekly Change (kg)',
        data: weeklyChangeData.map(w => w.change),
        backgroundColor: weeklyChangeData.map(w => w.change < 0 ? '#10b981' : '#f59e0b'),
      }
    ]
  };

  // Calorie Intake Chart Data
  const calorieChartData = {
    labels: calorieData.map(c => new Date(c.summary_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
    datasets: [
      {
        label: 'Calories Consumed',
        data: calorieData.map(c => c.total_calories),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: true
      }
    ]
  };

  // Macro Distribution Chart Data
  const macroChartData = macroData ? {
    labels: ['Protein', 'Carbs', 'Fat'],
    datasets: [
      {
        data: [
          macroData.protein * 4, // Convert to calories
          macroData.carbs * 4,
          macroData.fat * 9
        ],
        backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
        borderWidth: 0
      }
    ]
  } : null;

  if (loading) {
    return (
      <div className="progress-charts-container">
        <div className="loading">Loading charts...</div>
      </div>
    );
  }

  return (
    <div className="progress-charts-container">
      <div className="charts-header">
        <h2>📊 Progress Charts</h2>
        <p className="charts-subtitle">Visualize your journey over time</p>
      </div>

      {/* Time Range Selector */}
      <div className="time-range-selector">
        {[
          { value: 'week', label: '7 Days' },
          { value: 'month', label: '1 Month' },
          { value: '3month', label: '3 Months' },
          { value: 'all', label: 'All Time' }
        ].map(option => (
          <button
            key={option.value}
            className={`range-btn ${timeRange === option.value ? 'active' : ''}`}
            onClick={() => setTimeRange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="charts-grid">
        {/* Weight Trend */}
        <div className="chart-card large">
          <h3>⚖️ Weight Trend</h3>
          {weightData.length > 0 ? (
            <Line data={weightChartData} options={lineChartOptions} />
          ) : (
            <div className="empty-chart">No weight data for this period</div>
          )}
        </div>

        {/* Weekly Weight Change */}
        <div className="chart-card">
          <h3>📉 Weekly Change</h3>
          {weeklyChangeData.length > 0 ? (
            <Bar data={weeklyChangeChartData} options={barChartOptions} />
          ) : (
            <div className="empty-chart">Not enough data</div>
          )}
        </div>

        {/* Calorie Intake */}
        <div className="chart-card">
          <h3>🔥 Calorie Intake</h3>
          {calorieData.length > 0 ? (
            <Line data={calorieChartData} options={lineChartOptions} />
          ) : (
            <div className="empty-chart">No calorie data</div>
          )}
        </div>

        {/* Macro Distribution */}
        <div className="chart-card">
          <h3>🍎 Macro Distribution</h3>
          {macroChartData ? (
            <div className="pie-chart-wrapper">
              <Pie data={macroChartData} options={pieChartOptions} />
            </div>
          ) : (
            <div className="empty-chart">No macro data</div>
          )}
        </div>
      </div>

      {/* Stats Summary */}
      <div className="stats-summary">
        <StatCard
          icon="📉"
          label="Total Weight Lost"
          value={calculateTotalWeightLoss(weightData)}
          unit="kg"
        />
        <StatCard
          icon="📅"
          label="Days Tracked"
          value={calorieData.length}
          unit="days"
        />
        <StatCard
          icon="🔥"
          label="Avg Daily Calories"
          value={calculateAvgCalories(calorieData)}
          unit="kcal"
        />
        <StatCard
          icon="💪"
          label="Avg Protein"
          value={macroData ? Math.round(macroData.protein) : 0}
          unit="g"
        />
      </div>
    </div>
  );
}

function calculateWeeklyChanges(weightData) {
  if (weightData.length < 2) return [];

  const weeks = [];
  const sortedData = [...weightData].sort((a, b) => new Date(a.logged_at) - new Date(b.logged_at));

  for (let i = 7; i < sortedData.length; i += 7) {
    const thisWeek = sortedData[i];
    const lastWeek = sortedData[i - 7];
    const change = thisWeek.weight_kg - lastWeek.weight_kg;
    
    weeks.push({
      week: `Week ${Math.floor(i / 7)}`,
      change: change
    });
  }

  return weeks;
}

function calculateTotalWeightLoss(weightData) {
  if (weightData.length < 2) return '0.0';
  const first = weightData[0].weight_kg;
  const last = weightData[weightData.length - 1].weight_kg;
  return (first - last).toFixed(1);
}

function calculateAvgCalories(calorieData) {
  if (calorieData.length === 0) return 0;
  const total = calorieData.reduce((sum, day) => sum + day.total_calories, 0);
  return Math.round(total / calorieData.length);
}

function StatCard({ icon, label, value, unit }) {
  return (
    <div className="stat-card-chart">
      <div className="stat-icon-chart">{icon}</div>
      <div className="stat-value-chart">{value}<span className="stat-unit">{unit}</span></div>
      <div className="stat-label-chart">{label}</div>
    </div>
  );
}

// Chart Options
const lineChartOptions = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      padding: 12,
      titleFont: { size: 14 },
      bodyFont: { size: 13 }
    }
  },
  scales: {
    y: {
      beginAtZero: false,
      grid: {
        color: 'rgba(0, 0, 0, 0.05)'
      }
    },
    x: {
      grid: {
        display: false
      }
    }
  }
};

const barChartOptions = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: {
    legend: {
      display: false
    }
  },
  scales: {
    y: {
      beginAtZero: true
    }
  }
};

const pieChartOptions = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: {
    legend: {
      position: 'bottom'
    }
  }
};
