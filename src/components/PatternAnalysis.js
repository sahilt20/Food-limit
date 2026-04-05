'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend } from 'chart.js';
import { Line, Bar, Pie } from 'react-chartjs-2';
import './pattern-analysis.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend);

export default function PatternAnalysis() {
  const supabase = createClient();
  const [patterns, setPatterns] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(30); // days

  useEffect(() => {
    analyzePatterns();
  }, [timeRange]);

  const analyzePatterns = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - timeRange);

      // Fetch all data
      const [weightData, nutritionData, mealsData] = await Promise.all([
        fetchWeightData(user.id, startDate),
        fetchNutritionData(user.id, startDate),
        fetchMealsData(user.id, startDate)
      ]);

      const analysis = {
        bestDays: findBestDays(nutritionData),
        worstDays: findWorstDays(nutritionData),
        correlations: findCorrelations(weightData, nutritionData),
        mealTiming: analyzeMealTiming(mealsData),
        weekdayVsWeekend: analyzeWeekdayVsWeekend(nutritionData),
        successFactors: identifySuccessFactors(weightData, nutritionData),
        charts: generateCharts(weightData, nutritionData, mealsData)
      };

      setPatterns(analysis);
    } catch (error) {
      console.error('Error analyzing patterns:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWeightData = async (userId, startDate) => {
    const { data } = await supabase
      .from('weight_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('logged_at', startDate.toISOString())
      .order('logged_at', { ascending: true });
    return data || [];
  };

  const fetchNutritionData = async (userId, startDate) => {
    const { data } = await supabase
      .from('daily_nutrition_summary')
      .select('*')
      .eq('user_id', userId)
      .gte('summary_date', startDate.toISOString().split('T')[0])
      .order('summary_date', { ascending: true });
    return data || [];
  };

  const fetchMealsData = async (userId, startDate) => {
    const { data } = await supabase
      .from('consumed_items')
      .select('*')
      .eq('user_id', userId)
      .gte('consumed_at', startDate.toISOString())
      .order('consumed_at', { ascending: true });
    return data || [];
  };

  const findBestDays = (nutritionData) => {
    const dayStats = {};
    
    nutritionData.forEach(day => {
      const dayName = new Date(day.summary_date).toLocaleDateString('en-US', { weekday: 'long' });
      if (!dayStats[dayName]) {
        dayStats[dayName] = { total: 0, goalMetCount: 0, count: 0 };
      }
      dayStats[dayName].count++;
      dayStats[dayName].total += day.total_calories || 0;
      if (day.met_calorie_goal) dayStats[dayName].goalMetCount++;
    });

    return Object.entries(dayStats)
      .map(([day, stats]) => ({
        day,
        avgCalories: Math.round(stats.total / stats.count),
        successRate: Math.round((stats.goalMetCount / stats.count) * 100)
      }))
      .sort((a, b) => b.successRate - a.successRate);
  };

  const findWorstDays = (nutritionData) => {
    const days = findBestDays(nutritionData);
    return days.reverse();
  };

  const findCorrelations = (weightData, nutritionData) => {
    const correlations = [];

    // High protein days vs weight loss
    const highProteinDays = nutritionData.filter(d => d.met_protein_goal).length;
    if (highProteinDays > 0) {
      correlations.push({
        factor: 'High Protein Intake',
        description: `On ${highProteinDays} days you hit protein goals`,
        impact: highProteinDays > nutritionData.length * 0.7 ? 'strong' : 'moderate',
        icon: '💪'
      });
    }

    // Consistent tracking vs weight loss
    const consistentDays = nutritionData.filter(d => d.meals_logged >= 3).length;
    if (consistentDays > 0) {
      correlations.push({
        factor: 'Consistent Tracking',
        description: `${consistentDays} days with all meals logged`,
        impact: consistentDays > nutritionData.length * 0.8 ? 'strong' : 'moderate',
        icon: '📝'
      });
    }

    // Calorie deficit vs weight loss
    const deficitDays = nutritionData.filter(d => d.calorie_deficit_surplus < 0).length;
    if (deficitDays > 0) {
      correlations.push({
        factor: 'Calorie Deficit',
        description: `${deficitDays} days in calorie deficit`,
        impact: deficitDays > nutritionData.length * 0.75 ? 'strong' : 'moderate',
        icon: '🔥'
      });
    }

    return correlations;
  };

  const analyzeMealTiming = (mealsData) => {
    const hourCounts = Array(24).fill(0);
    
    mealsData.forEach(meal => {
      const hour = new Date(meal.consumed_at).getHours();
      hourCounts[hour]++;
    });

    const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
    const quietHour = hourCounts.indexOf(Math.min(...hourCounts.filter(c => c > 0)));

    return {
      peakHour: `${peakHour}:00`,
      quietHour: `${quietHour}:00`,
      hourCounts
    };
  };

  const analyzeWeekdayVsWeekend = (nutritionData) => {
    const weekdayStats = { calories: [], mealsLogged: [] };
    const weekendStats = { calories: [], mealsLogged: [] };

    nutritionData.forEach(day => {
      const date = new Date(day.summary_date);
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      
      if (isWeekend) {
        weekendStats.calories.push(day.total_calories || 0);
        weekendStats.mealsLogged.push(day.meals_logged || 0);
      } else {
        weekdayStats.calories.push(day.total_calories || 0);
        weekdayStats.mealsLogged.push(day.meals_logged || 0);
      }
    });

    const avgWeekdayCalories = weekdayStats.calories.length > 0
      ? Math.round(weekdayStats.calories.reduce((a, b) => a + b, 0) / weekdayStats.calories.length)
      : 0;
    
    const avgWeekendCalories = weekendStats.calories.length > 0
      ? Math.round(weekendStats.calories.reduce((a, b) => a + b, 0) / weekendStats.calories.length)
      : 0;

    return {
      weekdayAvgCalories: avgWeekdayCalories,
      weekendAvgCalories: avgWeekendCalories,
      difference: avgWeekendCalories - avgWeekdayCalories,
      weekdayConsistency: weekdayStats.mealsLogged.filter(m => m >= 3).length / weekdayStats.mealsLogged.length * 100,
      weekendConsistency: weekendStats.mealsLogged.filter(m => m >= 3).length / weekendStats.mealsLogged.length * 100
    };
  };

  const identifySuccessFactors = (weightData, nutritionData) => {
    const factors = [];

    if (weightData.length >= 2) {
      const weightLoss = (weightData[0].weight_kg - weightData[weightData.length - 1].weight_kg) * 2.20462;
      
      if (weightLoss > 0) {
        factors.push({
          icon: '📉',
          title: 'Weight Loss Achieved',
          value: `${weightLoss.toFixed(1)} lbs`,
          description: 'Keep doing what you\'re doing!'
        });
      }
    }

    const avgMealsPerDay = nutritionData.reduce((sum, d) => sum + (d.meals_logged || 0), 0) / nutritionData.length;
    if (avgMealsPerDay >= 2.5) {
      factors.push({
        icon: '✅',
        title: 'Great Tracking',
        value: `${avgMealsPerDay.toFixed(1)} meals/day`,
        description: 'Consistency is your strength'
      });
    }

    const avgCalorieDeficit = nutritionData.reduce((sum, d) => sum + Math.abs(d.calorie_deficit_surplus || 0), 0) / nutritionData.length;
    if (avgCalorieDeficit > 200) {
      factors.push({
        icon: '🔥',
        title: 'Calorie Control',
        value: `${Math.round(avgCalorieDeficit)} cal deficit`,
        description: 'Effective deficit management'
      });
    }

    return factors;
  };

  const generateCharts = (weightData, nutritionData, mealsData) => {
    const charts = {};

    // Day of week performance
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayPerformance = Array(7).fill(0).map(() => ({ total: 0, count: 0 }));
    
    nutritionData.forEach(day => {
      const dayIndex = new Date(day.summary_date).getDay();
      dayPerformance[dayIndex].total += day.total_calories || 0;
      dayPerformance[dayIndex].count++;
    });

    charts.dayOfWeek = {
      labels: dayNames,
      datasets: [{
        label: 'Avg Calories',
        data: dayPerformance.map(d => d.count > 0 ? Math.round(d.total / d.count) : 0),
        backgroundColor: '#10b981',
        borderRadius: 8
      }]
    };

    // Weight trend
    if (weightData.length > 0) {
      charts.weightTrend = {
        labels: weightData.map(w => new Date(w.logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
        datasets: [{
          label: 'Weight (lbs)',
          data: weightData.map(w => (w.weight_kg * 2.20462).toFixed(1)),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4,
          fill: true
        }]
      };
    }

    // Meal timing heatmap data
    const hourCounts = Array(24).fill(0);
    mealsData.forEach(meal => {
      const hour = new Date(meal.consumed_at).getHours();
      hourCounts[hour]++;
    });

    charts.mealTiming = {
      labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
      datasets: [{
        label: 'Meals Logged',
        data: hourCounts,
        backgroundColor: '#f59e0b',
        borderRadius: 4
      }]
    };

    return charts;
  };

  if (loading) {
    return (
      <div className="pattern-analysis-loading">
        <div className="loader"></div>
        <p>Analyzing your patterns...</p>
      </div>
    );
  }

  if (!patterns) {
    return <div className="pattern-analysis-empty">Not enough data to analyze patterns</div>;
  }

  return (
    <div className="pattern-analysis">
      <div className="analysis-header">
        <h2>📊 Pattern Analysis</h2>
        <div className="time-range-selector">
          <button 
            className={timeRange === 7 ? 'active' : ''}
            onClick={() => setTimeRange(7)}
          >
            7 Days
          </button>
          <button 
            className={timeRange === 30 ? 'active' : ''}
            onClick={() => setTimeRange(30)}
          >
            30 Days
          </button>
          <button 
            className={timeRange === 90 ? 'active' : ''}
            onClick={() => setTimeRange(90)}
          >
            90 Days
          </button>
        </div>
      </div>

      {/* Success Factors */}
      {patterns.successFactors.length > 0 && (
        <div className="analysis-section">
          <h3>🌟 Success Factors</h3>
          <div className="success-factors-grid">
            {patterns.successFactors.map((factor, index) => (
              <div key={index} className="success-factor-card">
                <div className="factor-icon">{factor.icon}</div>
                <div className="factor-title">{factor.title}</div>
                <div className="factor-value">{factor.value}</div>
                <div className="factor-description">{factor.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Best/Worst Days */}
      <div className="analysis-section">
        <h3>📅 Best & Worst Days</h3>
        <div className="days-comparison">
          <div className="best-days">
            <h4>✅ Best Days</h4>
            {patterns.bestDays.slice(0, 3).map((day, index) => (
              <div key={index} className="day-stat">
                <span className="day-name">{day.day}</span>
                <span className="day-success">{day.successRate}% success rate</span>
              </div>
            ))}
          </div>
          <div className="worst-days">
            <h4>⚠️ Challenge Days</h4>
            {patterns.worstDays.slice(0, 3).map((day, index) => (
              <div key={index} className="day-stat">
                <span className="day-name">{day.day}</span>
                <span className="day-success">{day.successRate}% success rate</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Correlations */}
      {patterns.correlations.length > 0 && (
        <div className="analysis-section">
          <h3>🔗 Key Correlations</h3>
          <div className="correlations-list">
            {patterns.correlations.map((corr, index) => (
              <div key={index} className={`correlation-card ${corr.impact}`}>
                <span className="correlation-icon">{corr.icon}</span>
                <div className="correlation-content">
                  <div className="correlation-factor">{corr.factor}</div>
                  <div className="correlation-description">{corr.description}</div>
                </div>
                <div className={`correlation-impact ${corr.impact}`}>
                  {corr.impact} impact
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weekday vs Weekend */}
      <div className="analysis-section">
        <h3>📆 Weekday vs Weekend</h3>
        <div className="weekday-weekend-comparison">
          <div className="comparison-stat">
            <div className="stat-label">Weekday Avg</div>
            <div className="stat-value">{patterns.weekdayVsWeekend.weekdayAvgCalories} cal</div>
          </div>
          <div className="comparison-arrow">
            {patterns.weekdayVsWeekend.difference > 0 ? '→ +' : '→ '}
            {Math.abs(patterns.weekdayVsWeekend.difference)} cal
          </div>
          <div className="comparison-stat">
            <div className="stat-label">Weekend Avg</div>
            <div className="stat-value">{patterns.weekdayVsWeekend.weekendAvgCalories} cal</div>
          </div>
        </div>
      </div>

      {/* Charts */}
      {patterns.charts.dayOfWeek && (
        <div className="analysis-section chart">
          <h3>📊 Calories by Day of Week</h3>
          <div className="chart-container">
            <Bar data={patterns.charts.dayOfWeek} options={{ responsive: true, maintainAspectRatio: false }} />
          </div>
        </div>
      )}

      {patterns.charts.weightTrend && (
        <div className="analysis-section chart">
          <h3>📈 Weight Trend</h3>
          <div className="chart-container">
            <Line data={patterns.charts.weightTrend} options={{ responsive: true, maintainAspectRatio: false }} />
          </div>
        </div>
      )}

      {patterns.charts.mealTiming && (
        <div className="analysis-section chart">
          <h3>🕐 Meal Timing Pattern</h3>
          <div className="chart-container">
            <Bar data={patterns.charts.mealTiming} options={{ responsive: true, maintainAspectRatio: false }} />
          </div>
        </div>
      )}
    </div>
  );
}
