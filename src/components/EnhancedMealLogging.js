'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabaseClient';
import './enhanced-meal-logging.css';

export default function EnhancedMealLogging() {
  const supabase = createClient();
  const [mealType, setMealType] = useState('breakfast');
  const [recentMeals, setRecentMeals] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [portion, setPortion] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadRecentMeals();
    loadFavorites();
  }, []);

  const loadRecentMeals = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data } = await supabase
        .from('consumed_items')
        .select('*')
        .eq('user_id', user.id)
        .gte('consumed_at', thirtyDaysAgo.toISOString())
        .order('consumed_at', { ascending: false })
        .limit(20);

      // Group by unique items
      const uniqueMeals = [];
      const seen = new Set();
      
      data?.forEach(item => {
        const key = `${item.item_name}-${item.calories}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueMeals.push(item);
        }
      });

      setRecentMeals(uniqueMeals.slice(0, 10));
    } catch (error) {
      console.error('Error loading recent meals:', error);
    }
  };

  const loadFavorites = async () => {
    // Load user's favorite meals (most logged items)
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('consumed_items')
        .select('item_name, calories, protein_g, carbs_g, fat_g, COUNT(*) as frequency')
        .eq('user_id', user.id)
        .group('item_name, calories, protein_g, carbs_g, fat_g')
        .order('frequency', { ascending: false })
        .limit(5);

      setFavorites(data || []);
    } catch (error) {
      console.error('Error loading favorites:', error);
    }
  };

  const quickAddMeal = async (meal) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const adjustedMeal = {
        user_id: user.id,
        item_name: meal.item_name,
        calories: Math.round(meal.calories * portion),
        protein_g: meal.protein_g ? Math.round(meal.protein_g * portion) : null,
        carbs_g: meal.carbs_g ? Math.round(meal.carbs_g * portion) : null,
        fat_g: meal.fat_g ? Math.round(meal.fat_g * portion) : null,
        meal_type: mealType,
        consumed_at: new Date().toISOString(),
        quantity: portion
      };

      const { error } = await supabase
        .from('consumed_items')
        .insert(adjustedMeal);

      if (error) throw error;

      // Show success
      alert(`✓ Added ${meal.item_name} to ${mealType}!`);
      setPortion(1); // Reset portion

    } catch (error) {
      console.error('Error adding meal:', error);
      alert('Failed to add meal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="enhanced-meal-logging">
      <div className="meal-header">
        <h2>🍽️ Quick Meal Logging</h2>
        <p className="meal-subtitle">Fast and easy meal tracking</p>
      </div>

      {/* Meal Type Selector */}
      <div className="meal-type-selector">
        <h3>Select Meal Type</h3>
        <div className="meal-types">
          {[
            { value: 'breakfast', icon: '🌅', label: 'Breakfast' },
            { value: 'lunch', icon: '☀️', label: 'Lunch' },
            { value: 'dinner', icon: '🌙', label: 'Dinner' },
            { value: 'snack', icon: '🍎', label: 'Snack' }
          ].map(type => (
            <button
              key={type.value}
              className={`meal-type-btn ${mealType === type.value ? 'active' : ''}`}
              onClick={() => setMealType(type.value)}
            >
              <span className="meal-type-icon">{type.icon}</span>
              <span className="meal-type-label">{type.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Portion Adjuster */}
      <div className="portion-adjuster">
        <h3>Portion Size</h3>
        <div className="portion-controls">
          <button 
            className="portion-btn"
            onClick={() => setPortion(Math.max(0.25, portion - 0.25))}
          >
            -
          </button>
          <span className="portion-display">{portion}x</span>
          <button 
            className="portion-btn"
            onClick={() => setPortion(portion + 0.25)}
          >
            +
          </button>
        </div>
        <div className="portion-presets">
          {[0.5, 1, 1.5, 2].map(p => (
            <button
              key={p}
              className={`preset-btn ${portion === p ? 'active' : ''}`}
              onClick={() => setPortion(p)}
            >
              {p}x
            </button>
          ))}
        </div>
      </div>

      {/* Recent Meals */}
      <div className="meals-section">
        <h3>⏱️ Recently Logged</h3>
        {recentMeals.length === 0 ? (
          <div className="empty-meals">No recent meals yet</div>
        ) : (
          <div className="meals-grid">
            {recentMeals.map((meal, index) => (
              <MealCard
                key={index}
                meal={meal}
                portion={portion}
                onAdd={() => quickAddMeal(meal)}
                loading={loading}
              />
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <h3>🚀 Quick Actions</h3>
        <div className="action-buttons">
          <button className="action-btn barcode">
            📷 Scan Barcode
            <span className="coming-soon">Coming Soon</span>
          </button>
          <button className="action-btn photo">
            📸 Photo Recognition
            <span className="coming-soon">Coming Soon</span>
          </button>
          <button className="action-btn receipt">
            🧾 Scan Receipt
            <span className="coming-soon">Coming Soon</span>
          </button>
          <button className="action-btn manual" onClick={() => window.location.href = '/dashboard/add'}>
            ✏️ Manual Entry
          </button>
        </div>
      </div>
    </div>
  );
}

function MealCard({ meal, portion, onAdd, loading }) {
  const adjustedCalories = Math.round(meal.calories * portion);
  const adjustedProtein = meal.protein_g ? Math.round(meal.protein_g * portion) : 0;

  return (
    <div className="meal-card-quick">
      <div className="meal-card-header">
        <div className="meal-name">{meal.item_name}</div>
        <div className="meal-calories">{adjustedCalories} cal</div>
      </div>
      
      {adjustedProtein > 0 && (
        <div className="meal-macros">
          💪 {adjustedProtein}g protein
        </div>
      )}
      
      <button 
        className="add-meal-btn"
        onClick={onAdd}
        disabled={loading}
      >
        {loading ? 'Adding...' : `+ Add ${portion}x`}
      </button>
    </div>
  );
}
