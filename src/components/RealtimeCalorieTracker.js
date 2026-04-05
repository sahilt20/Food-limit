'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import './realtime-tracker.css';

export default function RealtimeCalorieTracker() {
  const [todayData, setTodayData] = useState(null);
  const [goal, setGoal] = useState(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    loadTodayData();
    
    // Refresh every 30 seconds
    const interval = setInterval(loadTodayData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadTodayData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date().toISOString().split('T')[0];

      // Load active goal
      const { data: goalData } = await supabase
        .from('weight_goals')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();
      
      setGoal(goalData);

      // Get today's consumed items
      const { data: consumedItems } = await supabase
        .from('consumed_items')
        .select(`
          *,
          consumed_item_nutrition (*)
        `)
        .eq('user_id', user.id)
        .eq('consumed_on', today);

      // Calculate totals
      let totalCalories = 0;
      let totalProtein = 0;
      let totalCarbs = 0;
      let totalFat = 0;

      consumedItems?.forEach(item => {
        const nutrition = item.consumed_item_nutrition;
        if (nutrition) {
          totalCalories += parseFloat(nutrition.calories || 0) * parseFloat(item.quantity || 1);
          totalProtein += parseFloat(nutrition.protein_g || 0) * parseFloat(item.quantity || 1);
          totalCarbs += parseFloat(nutrition.carbs_g || 0) * parseFloat(item.quantity || 1);
          totalFat += parseFloat(nutrition.fat_g || 0) * parseFloat(item.quantity || 1);
        }
      });

      // Group by meal type
      const mealGroups = {
        breakfast: consumedItems?.filter(i => i.meal_type === 'breakfast') || [],
        lunch: consumedItems?.filter(i => i.meal_type === 'lunch') || [],
        dinner: consumedItems?.filter(i => i.meal_type === 'dinner') || [],
        snack: consumedItems?.filter(i => i.meal_type === 'snack') || []
      };

      setTodayData({
        totalCalories: totalCalories.toFixed(0),
        totalProtein: totalProtein.toFixed(1),
        totalCarbs: totalCarbs.toFixed(1),
        totalFat: totalFat.toFixed(1),
        meals: mealGroups,
        itemCount: consumedItems?.length || 0
      });

      // Update daily summary in database
      await updateDailySummary(user.id, today, {
        totalCalories,
        totalProtein,
        totalCarbs,
        totalFat,
        mealsLogged: Object.values(mealGroups).filter(m => m.length > 0).length
      }, goalData);

    } catch (error) {
      console.error('Error loading today data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateDailySummary = async (userId, date, totals, goalData) => {
    if (!goalData) return;

    const calorieGoal = goalData.daily_calorie_goal;
    const proteinGoal = goalData.daily_protein_goal_g;
    const deficitSurplus = totals.totalCalories - calorieGoal;
    const metCalorieGoal = totals.totalCalories <= calorieGoal;
    const metProteinGoal = totals.totalProtein >= proteinGoal;

    await supabase
      .from('daily_nutrition_summary')
      .upsert({
        user_id: userId,
        summary_date: date,
        total_calories: totals.totalCalories,
        total_protein_g: totals.totalProtein,
        total_carbs_g: totals.totalCarbs,
        total_fat_g: totals.totalFat,
        calorie_goal: calorieGoal,
        protein_goal_g: proteinGoal,
        carbs_goal_g: goalData.daily_carbs_goal_g,
        fat_goal_g: goalData.daily_fat_goal_g,
        calorie_deficit_surplus: deficitSurplus,
        met_calorie_goal: metCalorieGoal,
        met_protein_goal: metProteinGoal,
        meals_logged: totals.mealsLogged,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,summary_date'
      });

    // Update streak if met goal
    if (metCalorieGoal) {
      await fetch('/api/streaks/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          streakType: 'calorie_goal',
          success: true,
          date
        })
      });
    }
  };

  const getMealCalories = (mealItems) => {
    return mealItems.reduce((sum, item) => {
      const nutrition = item.consumed_item_nutrition;
      return sum + (parseFloat(nutrition?.calories || 0) * parseFloat(item.quantity || 1));
    }, 0);
  };

  if (loading) {
    return <div className="tracker-loading">Loading...</div>;
  }

  if (!goal || !todayData) {
    return (
      <div className="tracker-empty">
        <p>Set up your weight goal to start tracking!</p>
      </div>
    );
  }

  const calorieGoal = goal.daily_calorie_goal;
  const proteinGoal = goal.daily_protein_goal_g;
  const carbsGoal = goal.daily_carbs_goal_g;
  const fatGoal = goal.daily_fat_goal_g;

  const caloriesRemaining = calorieGoal - parseFloat(todayData.totalCalories);
  const caloriePercent = Math.min(100, (parseFloat(todayData.totalCalories) / calorieGoal) * 100);
  const proteinPercent = Math.min(100, (parseFloat(todayData.totalProtein) / proteinGoal) * 100);
  const carbsPercent = Math.min(100, (parseFloat(todayData.totalCarbs) / carbsGoal) * 100);
  const fatPercent = Math.min(100, (parseFloat(todayData.totalFat) / fatGoal) * 100);

  return (
    <div className="realtime-tracker">
      <div className="tracker-header">
        <h2>🍽️ Today's Nutrition</h2>
        <button onClick={loadTodayData} className="refresh-btn">🔄</button>
      </div>

      {/* Main Calorie Display */}
      <div className="calorie-display">
        <div className="calorie-numbers">
          <span className="current">{todayData.totalCalories}</span>
          <span className="separator">/</span>
          <span className="goal">{calorieGoal}</span>
          <span className="unit">cal</span>
        </div>
        <div className="progress-ring">
          <svg width="200" height="200">
            <circle
              cx="100"
              cy="100"
              r="90"
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="12"
            />
            <circle
              cx="100"
              cy="100"
              r="90"
              fill="none"
              stroke={caloriesRemaining >= 0 ? '#10b981' : '#ef4444'}
              strokeWidth="12"
              strokeDasharray={`${(caloriePercent / 100) * 565} 565`}
              strokeLinecap="round"
              transform="rotate(-90 100 100)"
            />
          </svg>
          <div className="ring-center">
            <div className="percent">{caloriePercent.toFixed(0)}%</div>
          </div>
        </div>
        <div className="calorie-status">
          {caloriesRemaining >= 0 ? (
            <p className="positive">✓ {Math.abs(caloriesRemaining).toFixed(0)} calories remaining</p>
          ) : (
            <p className="negative">⚠️ {Math.abs(caloriesRemaining).toFixed(0)} calories over</p>
          )}
          <p className="encouragement">
            {caloriePercent < 50 ? "💡 Great start! Keep going!" : 
             caloriePercent < 85 ? "👍 You're on track!" :
             caloriesRemaining >= 0 ? "🎯 Almost there!" : 
             "⚠️ Be mindful of portions"}
          </p>
        </div>
      </div>

      {/* Macros */}
      <div className="macros-grid">
        <div className="macro-item">
          <div className="macro-header">
            <span className="macro-name">Protein</span>
            <span className="macro-values">{todayData.totalProtein}g / {proteinGoal}g</span>
          </div>
          <div className="macro-bar">
            <div className="macro-fill protein" style={{ width: `${proteinPercent}%` }}></div>
          </div>
          <span className="macro-percent">{proteinPercent.toFixed(0)}%</span>
        </div>

        <div className="macro-item">
          <div className="macro-header">
            <span className="macro-name">Carbs</span>
            <span className="macro-values">{todayData.totalCarbs}g / {carbsGoal}g</span>
          </div>
          <div className="macro-bar">
            <div className="macro-fill carbs" style={{ width: `${carbsPercent}%` }}></div>
          </div>
          <span className="macro-percent">{carbsPercent.toFixed(0)}%</span>
        </div>

        <div className="macro-item">
          <div className="macro-header">
            <span className="macro-name">Fat</span>
            <span className="macro-values">{todayData.totalFat}g / {fatGoal}g</span>
          </div>
          <div className="macro-bar">
            <div className="macro-fill fat" style={{ width: `${fatPercent}%` }}></div>
          </div>
          <span className="macro-percent">{fatPercent.toFixed(0)}%</span>
        </div>
      </div>

      {/* Meals Today */}
      <div className="meals-today">
        <h3>📊 Meals Today</h3>
        <div className="meal-list">
          {Object.entries(todayData.meals).map(([mealType, items]) => (
            <div key={mealType} className="meal-item">
              <div className="meal-icon">
                {mealType === 'breakfast' && '🌅'}
                {mealType === 'lunch' && '🌞'}
                {mealType === 'dinner' && '🌙'}
                {mealType === 'snack' && '🍪'}
              </div>
              <div className="meal-info">
                <span className="meal-name">{mealType.charAt(0).toUpperCase() + mealType.slice(1)}</span>
                {items.length > 0 ? (
                  <span className="meal-calories">{getMealCalories(items).toFixed(0)} cal ✓</span>
                ) : (
                  <span className="meal-not-logged">Not logged</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Add Button */}
      <a href="/dashboard/add" className="quick-add-btn">
        + Log Meal
      </a>
    </div>
  );
}
