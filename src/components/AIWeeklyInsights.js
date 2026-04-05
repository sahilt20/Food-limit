'use client';
import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import './ai-insights.css';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function AIWeeklyInsights() {
  const supabase = createClientComponentClient();
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [weekRange, setWeekRange] = useState('current');

  useEffect(() => {
    generateInsights();
  }, [weekRange]);

  const generateInsights = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Calculate date range
      const endDate = weekRange === 'current' ? new Date() : new Date(new Date().setDate(new Date().getDate() - 7));
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 7);

      // Fetch all relevant data
      const [weightData, nutritionData, statsData, goalData] = await Promise.all([
        fetchWeightData(user.id, startDate, endDate),
        fetchNutritionData(user.id, startDate, endDate),
        fetchUserStats(user.id),
        fetchGoalData(user.id)
      ]);

      // Generate AI insights
      const analysis = analyzeWeeklyData(weightData, nutritionData, statsData, goalData);
      setInsights(analysis);

    } catch (error) {
      console.error('Error generating insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWeightData = async (userId, startDate, endDate) => {
    const { data } = await supabase
      .from('weight_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('logged_at', startDate.toISOString())
      .lte('logged_at', endDate.toISOString())
      .order('logged_at', { ascending: true });
    return data || [];
  };

  const fetchNutritionData = async (userId, startDate, endDate) => {
    const { data } = await supabase
      .from('daily_nutrition_summary')
      .select('*')
      .eq('user_id', userId)
      .gte('summary_date', startDate.toISOString().split('T')[0])
      .lte('summary_date', endDate.toISOString().split('T')[0])
      .order('summary_date', { ascending: true });
    return data || [];
  };

  const fetchUserStats = async (userId) => {
    const { data } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', userId)
      .single();
    return data || {};
  };

  const fetchGoalData = async (userId) => {
    const { data } = await supabase
      .from('weight_goals')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();
    return data || {};
  };

  const analyzeWeeklyData = (weights, nutrition, stats, goal) => {
    const analysis = {
      weekRange: '',
      summary: {},
      wins: [],
      opportunities: [],
      predictions: {},
      patterns: {},
      chartData: null
    };

    // Week range
    const start = new Date();
    start.setDate(start.getDate() - 7);
    analysis.weekRange = `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

    // Summary stats
    if (weights.length >= 2) {
      const weightChange = weights[weights.length - 1].weight_kg - weights[0].weight_kg;
      const weightChangeLbs = (weightChange * 2.20462).toFixed(1);
      analysis.summary.weightChange = weightChangeLbs;
      analysis.summary.weightDirection = weightChange < 0 ? 'lost' : 'gained';
    }

    const mealsLogged = nutrition.reduce((sum, day) => sum + (day.meals_logged || 0), 0);
    const totalDays = nutrition.length;
    const avgCalories = nutrition.length > 0 
      ? Math.round(nutrition.reduce((sum, day) => sum + (day.total_calories || 0), 0) / nutrition.length)
      : 0;
    
    analysis.summary.mealsLogged = mealsLogged;
    analysis.summary.totalMealsPossible = totalDays * 3;
    analysis.summary.trackingRate = totalDays > 0 ? Math.round((mealsLogged / (totalDays * 3)) * 100) : 0;
    analysis.summary.avgCalories = avgCalories;

    // What worked (Wins)
    const proteinDays = nutrition.filter(day => 
      day.met_protein_goal === true || (day.protein_goal_g && day.total_protein_g >= day.protein_goal_g)
    ).length;
    
    if (proteinDays >= 5) {
      analysis.wins.push({
        icon: '💪',
        title: 'Protein Champion',
        description: `Hit protein goals ${proteinDays} out of ${totalDays} days`
      });
    }

    if (stats.tracking_streak_current >= 7) {
      analysis.wins.push({
        icon: '🔥',
        title: 'Consistency Master',
        description: `Maintained ${stats.tracking_streak_current}-day tracking streak`
      });
    }

    if (analysis.summary.weightChange && parseFloat(analysis.summary.weightChange) < 0) {
      analysis.wins.push({
        icon: '📉',
        title: 'Progress Made',
        description: `Lost ${Math.abs(analysis.summary.weightChange)} lbs this week`
      });
    }

    const calorieDaysUnder = nutrition.filter(day => day.met_calorie_goal === true).length;
    if (calorieDaysUnder >= 5) {
      analysis.wins.push({
        icon: '✅',
        title: 'Calorie Control',
        description: `Stayed under goal ${calorieDaysUnder} out of ${totalDays} days`
      });
    }

    // Opportunities for improvement
    if (analysis.summary.trackingRate < 80) {
      analysis.opportunities.push({
        icon: '📝',
        title: 'Improve Tracking',
        tip: `You logged ${analysis.summary.trackingRate}% of meals. Aim for 90%+ for better insights.`,
        action: 'Set daily meal reminders'
      });
    }

    // Check for weekend drop-off
    const weekendNutrition = nutrition.filter(day => {
      const date = new Date(day.summary_date);
      return date.getDay() === 0 || date.getDay() === 6;
    });
    const weekendMeals = weekendNutrition.reduce((sum, day) => sum + (day.meals_logged || 0), 0);
    const weekendPossible = weekendNutrition.length * 3;
    
    if (weekendMeals < weekendPossible * 0.6) {
      analysis.opportunities.push({
        icon: '📅',
        title: 'Weekend Consistency',
        tip: 'Your weekend tracking drops by 40%. Weekends are key to success!',
        action: 'Meal prep on Sunday evenings'
      });
    }

    // Check calorie variance
    if (nutrition.length > 3) {
      const calories = nutrition.map(d => d.total_calories);
      const avgCal = calories.reduce((a, b) => a + b, 0) / calories.length;
      const variance = calories.reduce((sum, cal) => sum + Math.pow(cal - avgCal, 2), 0) / calories.length;
      const stdDev = Math.sqrt(variance);
      
      if (stdDev > 400) {
        analysis.opportunities.push({
          icon: '🎯',
          title: 'Calorie Consistency',
          tip: 'Your daily calories vary by 400+ cal. More consistency = better results.',
          action: 'Plan meals in advance'
        });
      }
    }

    // Predictions
    if (goal && weights.length >= 2) {
      const weightChangeKg = weights[weights.length - 1].weight_kg - weights[0].weight_kg;
      const weeklyRate = weightChangeKg * 2.20462; // lbs per week
      const currentWeightLbs = weights[weights.length - 1].weight_kg * 2.20462;
      const targetWeightLbs = goal.target_weight_kg * 2.20462;
      const remainingLbs = currentWeightLbs - targetWeightLbs;
      
      if (weeklyRate < 0) {
        const weeksToGoal = Math.ceil(Math.abs(remainingLbs / weeklyRate));
        analysis.predictions.weeksToGoal = weeksToGoal;
        analysis.predictions.targetDate = new Date(new Date().setDate(new Date().getDate() + weeksToGoal * 7)).toLocaleDateString();
        analysis.predictions.totalLoss = Math.abs(weeklyRate * weeksToGoal).toFixed(1);
      }
    }

    // Patterns
    if (nutrition.length >= 5) {
      const avgByDay = {};
      nutrition.forEach(day => {
        const dayName = new Date(day.summary_date).toLocaleDateString('en-US', { weekday: 'long' });
        if (!avgByDay[dayName]) avgByDay[dayName] = [];
        avgByDay[dayName].push(day.total_calories);
      });

      const dayAverages = Object.entries(avgByDay).map(([day, cals]) => ({
        day,
        avg: cals.reduce((a, b) => a + b, 0) / cals.length
      }));

      const bestDay = dayAverages.reduce((best, curr) => 
        curr.avg < best.avg ? curr : best
      , dayAverages[0]);

      const worstDay = dayAverages.reduce((worst, curr) => 
        curr.avg > worst.avg ? curr : worst
      , dayAverages[0]);

      analysis.patterns.bestDay = bestDay?.day;
      analysis.patterns.worstDay = worstDay?.day;
    }

    // Chart data for macro distribution
    if (nutrition.length > 0) {
      const totalProtein = nutrition.reduce((sum, day) => sum + (day.total_protein_g || 0), 0);
      const totalCarbs = nutrition.reduce((sum, day) => sum + (day.total_carbs_g || 0), 0);
      const totalFat = nutrition.reduce((sum, day) => sum + (day.total_fat_g || 0), 0);

      analysis.chartData = {
        labels: ['Protein', 'Carbs', 'Fat'],
        datasets: [{
          data: [totalProtein, totalCarbs, totalFat],
          backgroundColor: ['#10b981', '#3b82f6', '#f59e0b'],
          borderWidth: 0
        }]
      };
    }

    return analysis;
  };

  if (loading) {
    return (
      <div className="ai-insights-loading">
        <div className="loader"></div>
        <p>Analyzing your week...</p>
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="ai-insights-empty">
        <p>Not enough data yet. Track for at least 3 days to see insights.</p>
      </div>
    );
  }

  return (
    <div className="ai-insights">
      <div className="insights-header">
        <h2>🤖 AI Weekly Insights</h2>
        <div className="week-selector">
          <button 
            className={weekRange === 'previous' ? 'active' : ''}
            onClick={() => setWeekRange('previous')}
          >
            Last Week
          </button>
          <button 
            className={weekRange === 'current' ? 'active' : ''}
            onClick={() => setWeekRange('current')}
          >
            This Week
          </button>
        </div>
      </div>

      <div className="insights-date-range">
        Week of {insights.weekRange}
      </div>

      {/* Summary */}
      <div className="insights-summary">
        <div className="summary-card">
          <div className="summary-icon">⚖️</div>
          <div className="summary-value">
            {insights.summary.weightChange 
              ? `${insights.summary.weightDirection === 'lost' ? '-' : '+'}${Math.abs(insights.summary.weightChange)} lbs`
              : 'No data'
            }
          </div>
          <div className="summary-label">Weight Change</div>
        </div>
        
        <div className="summary-card">
          <div className="summary-icon">📝</div>
          <div className="summary-value">
            {insights.summary.mealsLogged}/{insights.summary.totalMealsPossible}
          </div>
          <div className="summary-label">Meals Logged</div>
        </div>
        
        <div className="summary-card">
          <div className="summary-icon">🔥</div>
          <div className="summary-value">{insights.summary.avgCalories}</div>
          <div className="summary-label">Avg Daily Calories</div>
        </div>
        
        <div className="summary-card">
          <div className="summary-icon">✅</div>
          <div className="summary-value">{insights.summary.trackingRate}%</div>
          <div className="summary-label">Tracking Rate</div>
        </div>
      </div>

      {/* What Worked */}
      {insights.wins.length > 0 && (
        <div className="insights-section wins">
          <h3>✅ What Worked</h3>
          <div className="insights-list">
            {insights.wins.map((win, index) => (
              <div key={index} className="insight-item win">
                <span className="insight-icon">{win.icon}</span>
                <div className="insight-content">
                  <div className="insight-title">{win.title}</div>
                  <div className="insight-description">{win.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Opportunities */}
      {insights.opportunities.length > 0 && (
        <div className="insights-section opportunities">
          <h3>🎯 Opportunities to Improve</h3>
          <div className="insights-list">
            {insights.opportunities.map((opp, index) => (
              <div key={index} className="insight-item opportunity">
                <span className="insight-icon">{opp.icon}</span>
                <div className="insight-content">
                  <div className="insight-title">{opp.title}</div>
                  <div className="insight-description">{opp.tip}</div>
                  <button className="insight-action">{opp.action}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Predictions */}
      {insights.predictions.weeksToGoal && (
        <div className="insights-section predictions">
          <h3>🔮 Predictions</h3>
          <div className="prediction-card">
            <p className="prediction-text">
              If you continue this pace, you'll reach your goal weight in approximately{' '}
              <strong>{insights.predictions.weeksToGoal} weeks</strong> (around {insights.predictions.targetDate}).
            </p>
            <p className="prediction-details">
              Estimated total loss: <strong>{insights.predictions.totalLoss} lbs</strong>
            </p>
          </div>
        </div>
      )}

      {/* Patterns */}
      {insights.patterns.bestDay && (
        <div className="insights-section patterns">
          <h3>📊 Patterns Detected</h3>
          <div className="pattern-grid">
            <div className="pattern-item">
              <div className="pattern-label">Best Day</div>
              <div className="pattern-value">{insights.patterns.bestDay}</div>
              <div className="pattern-hint">Lowest average calories</div>
            </div>
            <div className="pattern-item">
              <div className="pattern-label">Challenge Day</div>
              <div className="pattern-value">{insights.patterns.worstDay}</div>
              <div className="pattern-hint">Highest average calories</div>
            </div>
          </div>
        </div>
      )}

      {/* Macro Distribution Chart */}
      {insights.chartData && (
        <div className="insights-section chart">
          <h3>🥗 Weekly Macro Distribution</h3>
          <div className="chart-container">
            <Pie data={insights.chartData} options={{ responsive: true, maintainAspectRatio: false }} />
          </div>
        </div>
      )}
    </div>
  );
}
