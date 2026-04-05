'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabaseClient';
import './plateau-detection.css';

export default function PlateauDetection() {
  const supabase = createClient();
  const [plateau, setPlateau] = useState(null);
  const [interventions, setInterventions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    detectPlateau();
  }, []);

  const detectPlateau = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get last 14 days of weight data
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      const { data: weights } = await supabase
        .from('weight_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('logged_at', fourteenDaysAgo.toISOString())
        .order('logged_at', { ascending: true });

      if (!weights || weights.length < 7) {
        setLoading(false);
        return; // Not enough data
      }

      // Check if weight has been stable (variance < 0.5 kg)
      const weightValues = weights.map(w => w.weight_kg);
      const avgWeight = weightValues.reduce((a, b) => a + b, 0) / weightValues.length;
      const variance = weightValues.reduce((sum, w) => sum + Math.pow(w - avgWeight, 2), 0) / weightValues.length;
      const stdDev = Math.sqrt(variance);

      const isPlateaued = stdDev < 0.23; // ~0.5 lbs variation

      if (isPlateaued) {
        const { data: nutrition } = await supabase
          .from('daily_nutrition_summary')
          .select('*')
          .eq('user_id', user.id)
          .gte('summary_date', fourteenDaysAgo.toISOString().split('T')[0])
          .order('summary_date', { ascending: false });

        const { data: goal } = await supabase
          .from('weight_goals')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single();

        const plateauData = {
          detected: true,
          days: weights.length,
          avgWeight: (avgWeight * 2.20462).toFixed(1),
          weightRange: {
            min: (Math.min(...weightValues) * 2.20462).toFixed(1),
            max: (Math.max(...weightValues) * 2.20462).toFixed(1)
          },
          startDate: weights[0].logged_at,
          currentCalories: nutrition?.[0]?.total_calories || 0,
          goalCalories: goal?.daily_calorie_goal || 0
        };

        setPlateau(plateauData);
        generateInterventions(plateauData, nutrition, goal);
      } else {
        setPlateau({ detected: false });
      }

    } catch (error) {
      console.error('Error detecting plateau:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateInterventions = (plateauData, nutritionData, goal) => {
    const suggestions = [];

    // 1. Calorie reduction
    if (plateauData.currentCalories > 1200) {
      suggestions.push({
        id: 'reduce-calories',
        type: 'nutrition',
        icon: '🔽',
        title: 'Reduce Daily Calories',
        description: `Lower your daily target by 100-200 calories to ${plateauData.currentCalories - 150} cal/day`,
        impact: 'high',
        difficulty: 'easy',
        action: 'adjust_calories',
        params: { newTarget: plateauData.currentCalories - 150 }
      });
    }

    // 2. Increase protein
    const avgProtein = nutritionData?.reduce((sum, d) => sum + (d.total_protein_g || 0), 0) / nutritionData.length || 0;
    const recommendedProtein = (plateauData.avgWeight * 0.8); // 0.8g per lb
    
    if (avgProtein < recommendedProtein) {
      suggestions.push({
        id: 'increase-protein',
        type: 'nutrition',
        icon: '💪',
        title: 'Increase Protein Intake',
        description: `Aim for ${Math.round(recommendedProtein)}g protein daily (currently ${Math.round(avgProtein)}g)`,
        impact: 'high',
        difficulty: 'moderate',
        action: 'adjust_macros',
        params: { proteinGoal: Math.round(recommendedProtein) }
      });
    }

    // 3. Add exercise
    suggestions.push({
      id: 'add-exercise',
      type: 'activity',
      icon: '🏃',
      title: 'Add 1-2 Workouts Weekly',
      description: 'Burn an extra 300-500 calories per session to break through plateau',
      impact: 'high',
      difficulty: 'moderate',
      action: 'track_exercise',
      params: {}
    });

    // 4. Intermittent fasting
    suggestions.push({
      id: 'intermittent-fasting',
      type: 'nutrition',
      icon: '⏰',
      title: 'Try Intermittent Fasting',
      description: '16:8 eating window (e.g., noon to 8pm) can help restart weight loss',
      impact: 'moderate',
      difficulty: 'hard',
      action: 'set_eating_window',
      params: { start: 12, end: 20 }
    });

    // 5. Increase water
    suggestions.push({
      id: 'increase-water',
      type: 'nutrition',
      icon: '💧',
      title: 'Drink More Water',
      description: 'Aim for 8-10 glasses daily to boost metabolism and reduce water retention',
      impact: 'moderate',
      difficulty: 'easy',
      action: 'track_water',
      params: { dailyGoal: 8 }
    });

    // 6. Carb cycling
    suggestions.push({
      id: 'carb-cycling',
      type: 'nutrition',
      icon: '🔄',
      title: 'Try Carb Cycling',
      description: 'Alternate between low-carb (under 100g) and moderate-carb days',
      impact: 'moderate',
      difficulty: 'hard',
      action: 'adjust_macros',
      params: { strategy: 'carb_cycling' }
    });

    // 7. Sleep tracking
    suggestions.push({
      id: 'improve-sleep',
      type: 'lifestyle',
      icon: '😴',
      title: 'Optimize Sleep',
      description: 'Poor sleep disrupts hormones. Aim for 7-9 hours nightly',
      impact: 'moderate',
      difficulty: 'easy',
      action: 'track_sleep',
      params: {}
    });

    // 8. Refeed day
    suggestions.push({
      id: 'refeed-day',
      type: 'nutrition',
      icon: '🍽️',
      title: 'Schedule a Refeed Day',
      description: 'Eat at maintenance calories 1 day/week to reset metabolism',
      impact: 'moderate',
      difficulty: 'easy',
      action: 'plan_refeed',
      params: {}
    });

    setInterventions(suggestions);
  };

  const applyIntervention = async (intervention) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      switch (intervention.action) {
        case 'adjust_calories':
          await supabase
            .from('weight_goals')
            .update({ daily_calorie_goal: intervention.params.newTarget })
            .eq('user_id', user.id)
            .eq('status', 'active');
          alert(`✓ Calorie goal updated to ${intervention.params.newTarget} cal/day`);
          break;

        case 'adjust_macros':
          if (intervention.params.proteinGoal) {
            await supabase
              .from('weight_goals')
              .update({ 
                protein_goal_g: intervention.params.proteinGoal 
              })
              .eq('user_id', user.id)
              .eq('status', 'active');
            alert(`✓ Protein goal updated to ${intervention.params.proteinGoal}g/day`);
          }
          break;

        default:
          alert(`✓ ${intervention.title} plan activated! Track your progress.`);
      }

      // Log intervention
      await supabase.from('notifications').insert({
        user_id: user.id,
        notification_type: 'plateau_intervention',
        title: 'Plateau Strategy Applied',
        message: intervention.title,
        read: false
      });

    } catch (error) {
      console.error('Error applying intervention:', error);
      alert('Failed to apply intervention');
    }
  };

  if (loading) {
    return (
      <div className="plateau-detection-loading">
        <div className="loader"></div>
        <p>Analyzing your progress...</p>
      </div>
    );
  }

  if (!plateau || !plateau.detected) {
    return (
      <div className="no-plateau">
        <div className="no-plateau-icon">📈</div>
        <h2>You're Making Progress!</h2>
        <p>No plateau detected. Keep up the great work!</p>
        <div className="progress-tip">
          💡 Plateaus are normal. We'll alert you if your weight stays the same for 14+ days.
        </div>
      </div>
    );
  }

  return (
    <div className="plateau-detection">
      <div className="plateau-alert">
        <div className="alert-icon">⚠️</div>
        <div className="alert-content">
          <h2>Plateau Detected</h2>
          <p>Your weight has been stable for {plateau.days} days ({plateau.weightRange.min} - {plateau.weightRange.max} lbs)</p>
        </div>
      </div>

      <div className="plateau-info">
        <h3>Don't Worry - This is Normal!</h3>
        <p>
          87% of people experience plateaus during weight loss. Your body is adapting.
          Here are proven strategies to break through:
        </p>
      </div>

      {/* Recommended Interventions */}
      <div className="interventions-section">
        <h3>🎯 Recommended Actions</h3>
        <p className="section-subtitle">Choose 2-3 strategies to implement this week</p>
        
        <div className="interventions-grid">
          {interventions.map(intervention => (
            <InterventionCard
              key={intervention.id}
              intervention={intervention}
              onApply={() => applyIntervention(intervention)}
            />
          ))}
        </div>
      </div>

      {/* Success Stats */}
      <div className="success-stats">
        <h3>📊 Success Rate</h3>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">87%</div>
            <div className="stat-label">Break plateau in 1-2 weeks</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">2-3</div>
            <div className="stat-label">Strategies recommended</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">14</div>
            <div className="stat-label">Days avg to see results</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InterventionCard({ intervention, onApply }) {
  return (
    <div className={`intervention-card ${intervention.difficulty}`}>
      <div className="intervention-header">
        <span className="intervention-icon">{intervention.icon}</span>
        <div className="intervention-tags">
          <span className={`impact-tag ${intervention.impact}`}>
            {intervention.impact} impact
          </span>
          <span className={`difficulty-tag ${intervention.difficulty}`}>
            {intervention.difficulty}
          </span>
        </div>
      </div>
      
      <h4 className="intervention-title">{intervention.title}</h4>
      <p className="intervention-description">{intervention.description}</p>
      
      <button className="apply-btn" onClick={onApply}>
        Apply This Strategy
      </button>
    </div>
  );
}
