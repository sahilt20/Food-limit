'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import './onboarding.css';

export default function WeightOnboarding() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Form data
  const [goalType, setGoalType] = useState('');
  const [currentWeight, setCurrentWeight] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [height, setHeight] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('male');
  const [targetDate, setTargetDate] = useState('');
  const [strategy, setStrategy] = useState('');
  const [activityLevel, setActivityLevel] = useState('moderately_active');
  const [weightUnit, setWeightUnit] = useState('lbs');

  // Helper to convert lbs to kg
  const toKg = (value, unit) => {
    if (unit === 'lbs') return parseFloat(value) * 0.453592;
    return parseFloat(value);
  };

  // Calculate BMR using Mifflin-St Jeor Equation
  const calculateBMR = (weightKg, heightCm, age, gender) => {
    if (gender === 'male') {
      return (10 * weightKg) + (6.25 * heightCm) - (5 * age) + 5;
    } else {
      return (10 * weightKg) + (6.25 * heightCm) - (5 * age) - 161;
    }
  };

  // Calculate TDEE (Total Daily Energy Expenditure)
  const calculateTDEE = (bmr, activityLevel) => {
    const multipliers = {
      sedentary: 1.2,
      lightly_active: 1.375,
      moderately_active: 1.55,
      very_active: 1.725,
      extremely_active: 1.9
    };
    return bmr * (multipliers[activityLevel] || 1.55);
  };

  // Calculate recommended calories based on goal
  const calculateDailyCalories = () => {
    const weightKg = toKg(currentWeight, weightUnit);
    const heightCm = weightUnit === 'lbs' ? parseFloat(height) * 2.54 : parseFloat(height);
    
    const bmr = calculateBMR(weightKg, heightCm, parseInt(age), gender);
    const tdee = calculateTDEE(bmr, activityLevel);
    
    let calorieGoal = tdee;
    
    if (goalType === 'lose') {
      calorieGoal = tdee - 500; // 500 cal deficit = ~1 lb/week
    } else if (goalType === 'gain') {
      calorieGoal = tdee + 300; // 300 cal surplus
    }
    
    return Math.round(calorieGoal);
  };

  // Calculate macros
  const calculateMacros = (calories, strategy) => {
    let protein, carbs, fat;
    
    switch (strategy) {
      case 'high_protein':
        protein = Math.round(calories * 0.35 / 4); // 35% protein
        carbs = Math.round(calories * 0.35 / 4);
        fat = Math.round(calories * 0.30 / 9);
        break;
      case 'low_carb':
      case 'keto':
        protein = Math.round(calories * 0.30 / 4);
        carbs = Math.round(calories * 0.15 / 4);
        fat = Math.round(calories * 0.55 / 9);
        break;
      default: // balanced
        protein = Math.round(calories * 0.30 / 4);
        carbs = Math.round(calories * 0.40 / 4);
        fat = Math.round(calories * 0.30 / 9);
    }
    
    return { protein, carbs, fat };
  };

  const handleComplete = async () => {
    setLoading(true);
    const supabase = createClient();
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error('Not authenticated');
      
      const weightKg = toKg(currentWeight, weightUnit);
      const targetWeightKg = toKg(targetWeight, weightUnit);
      const heightCm = weightUnit === 'lbs' ? parseFloat(height) * 2.54 : parseFloat(height);
      const dailyCalories = calculateDailyCalories();
      const macros = calculateMacros(dailyCalories, strategy);
      
      // Calculate weekly goal
      const weightDiff = Math.abs(weightKg - targetWeightKg);
      let weeklyGoalKg = 0.45; // Default ~1 lb/week
      if (goalType === 'gain') weeklyGoalKg = 0.23; // ~0.5 lb/week
      
      // Update profile
      await supabase.from('profiles').update({
        height_cm: heightCm,
        gender: gender,
        weight_unit: weightUnit,
        daily_calorie_goal: dailyCalories,
        updated_at: new Date().toISOString()
      }).eq('id', user.id);
      
      // Create weight goal
      const { error: goalError } = await supabase.from('weight_goals').insert({
        user_id: user.id,
        goal_type: goalType,
        start_weight_kg: weightKg,
        current_weight_kg: weightKg,
        target_weight_kg: targetWeightKg,
        target_date: targetDate || null,
        weekly_goal_kg: weeklyGoalKg,
        daily_calorie_goal: dailyCalories,
        daily_protein_goal_g: macros.protein,
        daily_carbs_goal_g: macros.carbs,
        daily_fat_goal_g: macros.fat,
        strategy: strategy,
        activity_level: activityLevel,
        status: 'active'
      });
      
      if (goalError) throw goalError;
      
      // Log initial weight
      await supabase.from('weight_logs').insert({
        user_id: user.id,
        weight_kg: weightKg,
        notes: 'Starting weight'
      });
      
      // Award first achievement
      await fetch('/api/achievements/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, event: 'onboarding_complete' })
      });
      
      router.push('/dashboard');
    } catch (error) {
      console.error('Error completing onboarding:', error);
      alert('Failed to save your goals. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <div className="onboarding-step">
      <h2>🎯 What's your goal?</h2>
      <p>Select what you want to achieve</p>
      
      <div className="goal-options">
        <div 
          className={`goal-card ${goalType === 'lose' ? 'selected' : ''}`}
          onClick={() => setGoalType('lose')}
        >
          <div className="goal-icon">📉</div>
          <h3>Lose Weight</h3>
          <p>Shed pounds and feel great</p>
        </div>
        
        <div 
          className={`goal-card ${goalType === 'gain' ? 'selected' : ''}`}
          onClick={() => setGoalType('gain')}
        >
          <div className="goal-icon">💪</div>
          <h3>Build Muscle</h3>
          <p>Gain lean mass</p>
        </div>
        
        <div 
          className={`goal-card ${goalType === 'maintain' ? 'selected' : ''}`}
          onClick={() => setGoalType('maintain')}
        >
          <div className="goal-icon">⚖️</div>
          <h3>Maintain Health</h3>
          <p>Stay on track</p>
        </div>
        
        <div 
          className={`goal-card ${goalType === 'recomposition' ? 'selected' : ''}`}
          onClick={() => setGoalType('recomposition')}
        >
          <div className="goal-icon">🔄</div>
          <h3>Body Recomposition</h3>
          <p>Lose fat, gain muscle</p>
        </div>
      </div>
      
      <button 
        className="continue-btn" 
        onClick={() => setStep(2)}
        disabled={!goalType}
      >
        Continue
      </button>
    </div>
  );

  const renderStep2 = () => (
    <div className="onboarding-step">
      <h2>📊 Let's get your baseline</h2>
      <p>Tell us about yourself</p>
      
      <div className="form-grid">
        <div className="form-group">
          <label>Weight Unit</label>
          <select value={weightUnit} onChange={(e) => setWeightUnit(e.target.value)}>
            <option value="lbs">Pounds (lbs)</option>
            <option value="kg">Kilograms (kg)</option>
          </select>
        </div>
        
        <div className="form-group">
          <label>Current Weight</label>
          <input
            type="number"
            value={currentWeight}
            onChange={(e) => setCurrentWeight(e.target.value)}
            placeholder={weightUnit === 'lbs' ? '180' : '82'}
          />
          <span className="unit">{weightUnit}</span>
        </div>
        
        <div className="form-group">
          <label>Target Weight</label>
          <input
            type="number"
            value={targetWeight}
            onChange={(e) => setTargetWeight(e.target.value)}
            placeholder={weightUnit === 'lbs' ? '160' : '73'}
          />
          <span className="unit">{weightUnit}</span>
        </div>
        
        <div className="form-group">
          <label>Height</label>
          <input
            type="number"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            placeholder={weightUnit === 'lbs' ? '70' : '178'}
          />
          <span className="unit">{weightUnit === 'lbs' ? 'inches' : 'cm'}</span>
        </div>
        
        <div className="form-group">
          <label>Age</label>
          <input
            type="number"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="32"
          />
        </div>
        
        <div className="form-group">
          <label>Gender</label>
          <select value={gender} onChange={(e) => setGender(e.target.value)}>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
            <option value="prefer_not_to_say">Prefer not to say</option>
          </select>
        </div>
        
        <div className="form-group full-width">
          <label>Target Date (Optional)</label>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
          />
        </div>
        
        <div className="form-group full-width">
          <label>Activity Level</label>
          <select value={activityLevel} onChange={(e) => setActivityLevel(e.target.value)}>
            <option value="sedentary">Sedentary (little to no exercise)</option>
            <option value="lightly_active">Lightly Active (1-3 days/week)</option>
            <option value="moderately_active">Moderately Active (3-5 days/week)</option>
            <option value="very_active">Very Active (6-7 days/week)</option>
            <option value="extremely_active">Extremely Active (athlete level)</option>
          </select>
        </div>
      </div>
      
      {currentWeight && targetWeight && (
        <div className="info-box">
          <p>💡 Goal: {goalType === 'lose' ? 'Lose' : goalType === 'gain' ? 'Gain' : 'Maintain'} {Math.abs(parseFloat(currentWeight) - parseFloat(targetWeight)).toFixed(1)} {weightUnit}</p>
          <p>Recommended: {goalType === 'lose' ? '1-2' : '0.5-1'} {weightUnit}/week (Healthy, sustainable pace)</p>
        </div>
      )}
      
      <div className="button-group">
        <button className="back-btn" onClick={() => setStep(1)}>Back</button>
        <button 
          className="continue-btn" 
          onClick={() => setStep(3)}
          disabled={!currentWeight || !targetWeight || !height || !age}
        >
          Continue
        </button>
      </div>
    </div>
  );

  const renderStep3 = () => {
    const recommendedCalories = calculateDailyCalories();
    const macros = calculateMacros(recommendedCalories, strategy || 'balanced');
    
    return (
      <div className="onboarding-step">
        <h2>🎨 Choose your approach</h2>
        <p>Select a nutrition strategy</p>
        
        <div className="strategy-options">
          <div 
            className={`strategy-card ${strategy === 'calorie_deficit' ? 'selected' : ''}`}
            onClick={() => setStrategy('calorie_deficit')}
          >
            <h3>⚡ Calorie Deficit</h3>
            <p className="recommended">Recommended</p>
            <p>Daily target: {recommendedCalories} cal</p>
            <p className="detail">Deficit: -500 cal/day</p>
          </div>
          
          <div 
            className={`strategy-card ${strategy === 'low_carb' ? 'selected' : ''}`}
            onClick={() => setStrategy('low_carb')}
          >
            <h3>🥑 Low Carb</h3>
            <p>Reduce carbohydrate intake</p>
            <p className="detail">&lt;100g carbs/day</p>
          </div>
          
          <div 
            className={`strategy-card ${strategy === 'keto' ? 'selected' : ''}`}
            onClick={() => setStrategy('keto')}
          >
            <h3>🥓 Keto</h3>
            <p>Very low carb, high fat</p>
            <p className="detail">&lt;50g carbs, high fat</p>
          </div>
          
          <div 
            className={`strategy-card ${strategy === 'balanced' ? 'selected' : ''}`}
            onClick={() => setStrategy('balanced')}
          >
            <h3>⚖️ Balanced Macros</h3>
            <p>Moderate everything</p>
            <p className="detail">40% carbs, 30% protein, 30% fat</p>
          </div>
          
          <div 
            className={`strategy-card ${strategy === 'high_protein' ? 'selected' : ''}`}
            onClick={() => setStrategy('high_protein')}
          >
            <h3>💪 High Protein</h3>
            <p>Maximize protein intake</p>
            <p className="detail">35% protein, preserve muscle</p>
          </div>
          
          <div 
            className={`strategy-card ${strategy === 'intermittent_fasting' ? 'selected' : ''}`}
            onClick={() => setStrategy('intermittent_fasting')}
          >
            <h3>🔄 Intermittent Fasting</h3>
            <p>Time-restricted eating</p>
            <p className="detail">16:8 eating window</p>
          </div>
        </div>
        
        {strategy && (
          <div className="macro-preview">
            <h4>Your Daily Targets</h4>
            <div className="macro-grid">
              <div className="macro-item">
                <span className="macro-label">Calories</span>
                <span className="macro-value">{recommendedCalories}</span>
              </div>
              <div className="macro-item">
                <span className="macro-label">Protein</span>
                <span className="macro-value">{macros.protein}g</span>
              </div>
              <div className="macro-item">
                <span className="macro-label">Carbs</span>
                <span className="macro-value">{macros.carbs}g</span>
              </div>
              <div className="macro-item">
                <span className="macro-label">Fat</span>
                <span className="macro-value">{macros.fat}g</span>
              </div>
            </div>
          </div>
        )}
        
        <div className="button-group">
          <button className="back-btn" onClick={() => setStep(2)}>Back</button>
          <button 
            className="complete-btn" 
            onClick={handleComplete}
            disabled={!strategy || loading}
          >
            {loading ? 'Setting up...' : 'Start My Journey 🚀'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="onboarding-container">
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${(step / 3) * 100}%` }}></div>
      </div>
      
      <div className="step-indicator">
        Step {step} of 3
      </div>
      
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
    </div>
  );
}
