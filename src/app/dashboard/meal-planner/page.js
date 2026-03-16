'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { useAiOperations } from '@/lib/AiOperationsContext';
import {
    CalendarDays, Loader, UtensilsCrossed, Clock, Flame,
    ShoppingBag, Lightbulb, ChevronDown, ChevronUp,
} from 'lucide-react';

export default function MealPlannerPage() {
    const [pantryItems, setPantryItems] = useState([]);
    const [selectedItems, setSelectedItems] = useState([]);
    const [dietary, setDietary] = useState('None');
    const [days, setDays] = useState(3);
    const [calorieTarget, setCalorieTarget] = useState(2000);

    const [mealPlan, setMealPlan] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [fetchingPantry, setFetchingPantry] = useState(true);
    const [expandedDay, setExpandedDay] = useState(null);
    const [progress, setProgress] = useState(0);
    const [progressText, setProgressText] = useState('');

    const { startOperation, getCompleted, clearCompleted, isRunning } = useAiOperations();

    // Load saved meal plan from DB + check context for background-completed results
    useEffect(() => {
        const completed = getCompleted('meal_plan');
        if (completed?.content) {
            setMealPlan(completed.content);
            setExpandedDay(0);
            clearCompleted('meal_plan');
            return;
        }

        const loadSaved = async () => {
            try {
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;
                const { data } = await supabase
                    .from('ai_generated_content')
                    .select('content, updated_at')
                    .eq('user_id', user.id)
                    .eq('content_type', 'meal_plan')
                    .single();
                if (data?.content?.meal_plan) {
                    setMealPlan(data.content);
                    setExpandedDay(0);
                }
            } catch {}
        };
        loadSaved();
    }, [getCompleted, clearCompleted]);

    // If a background op is running, show loading state
    useEffect(() => {
        if (isRunning('meal_plan') && !loading) {
            setLoading(true);
            setProgressText('Generating meal plan in background...');
            setProgress(50);
        }
    }, [isRunning, loading]);

    useEffect(() => {
        const fetchPantry = async () => {
            try {
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const [{ data: sessionData }, { data: profData }] = await Promise.all([
                        supabase.from('grocery_sessions')
                            .select('grocery_items(name)')
                            .order('session_date', { ascending: false })
                            .limit(5),
                        supabase.from('profiles')
                            .select('daily_calorie_goal')
                            .eq('id', user.id)
                            .single(),
                    ]);

                    if (sessionData) {
                        const items = new Set();
                        sessionData.forEach(s => s.grocery_items?.forEach(i => { if (i.name) items.add(i.name); }));
                        const arr = Array.from(items).sort();
                        setPantryItems(arr);
                        setSelectedItems(arr);
                    }
                    if (profData?.daily_calorie_goal) {
                        setCalorieTarget(profData.daily_calorie_goal);
                    }
                }
            } catch (err) {
                console.error('Error fetching pantry:', err);
            } finally {
                setFetchingPantry(false);
            }
        };
        fetchPantry();
    }, []);

    const toggleItem = (item) => {
        setSelectedItems(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);
    };

    const generatePlan = async () => {
        if (selectedItems.length === 0) { setError('Select at least one ingredient'); return; }
        setLoading(true);
        setError('');
        setMealPlan(null);
        setProgress(10);
        setProgressText('Gathering ingredients...');

        const progressInterval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 85) return 85;
                const increment = prev < 40 ? Math.random() * 12 : Math.random() * 7;
                return Math.min(prev + increment, 85);
            });
        }, 800);

        const inputParams = { pantryItems: selectedItems, dietary, days, calorieTarget };

        try {
            setProgressText('AI is designing your meal plan...');
            const result = await startOperation('meal_plan', async () => {
                const res = await fetch('/api/generate-meal-plan', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(inputParams),
                });
                const data = await res.json();
                if (data.data) {
                    return { data: data.data, provider: data.provider };
                }
                throw new Error(data.error || 'Failed to generate meal plan');
            }, inputParams);

            setProgress(95);
            if (result?.data) {
                setMealPlan(result.data);
                setExpandedDay(0);
            }
        } catch (err) {
            setError(err.message || 'Network error. Please try again.');
        } finally {
            clearInterval(progressInterval);
            setProgress(100);
            setProgressText('Done!');
            setTimeout(() => { setLoading(false); setProgress(0); }, 400);
        }
    };

    const mealColors = {
        breakfast: { bg: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24', icon: '🌅' },
        lunch: { bg: 'rgba(0, 212, 170, 0.1)', color: '#00d4aa', icon: '☀️' },
        dinner: { bg: 'rgba(77, 141, 255, 0.1)', color: '#4d8dff', icon: '🌙' },
        snack: { bg: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', icon: '🍎' },
    };

    return (
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ marginBottom: 'var(--space-xl)' }}>
                <h1 style={{ fontSize: '1.8rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                    <CalendarDays size={28} style={{ color: 'var(--accent-green)' }} /> AI Meal Planner
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    Generate personalized meal plans from your recent grocery purchases
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 'var(--space-xl)' }}>
                {/* Controls */}
                <div style={{ background: 'var(--bg-card)', padding: 'var(--space-lg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-glass)', height: 'fit-content' }}>
                    <h3 style={{ fontSize: '1rem', marginBottom: 'var(--space-md)' }}>Plan Settings</h3>

                    <div style={{ marginBottom: 'var(--space-md)' }}>
                        <label className="input-label">Days</label>
                        <select className="input-field" value={days} onChange={e => setDays(Number(e.target.value))}>
                            {[1, 2, 3, 5, 7].map(d => <option key={d} value={d}>{d} day{d > 1 ? 's' : ''}</option>)}
                        </select>
                    </div>

                    <div style={{ marginBottom: 'var(--space-md)' }}>
                        <label className="input-label">Daily Calorie Target</label>
                        <input className="input-field" type="number" value={calorieTarget} onChange={e => setCalorieTarget(Number(e.target.value))} min={800} max={5000} step={100} />
                    </div>

                    <div style={{ marginBottom: 'var(--space-md)' }}>
                        <label className="input-label">Dietary Restriction</label>
                        <select className="input-field" value={dietary} onChange={e => setDietary(e.target.value)}>
                            {['None', 'Vegetarian', 'Vegan', 'Keto', 'Paleo', 'Gluten-Free', 'High Protein'].map(d => (
                                <option key={d} value={d}>{d}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ marginBottom: 'var(--space-md)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <label className="input-label" style={{ margin: 0 }}>Ingredients ({selectedItems.length})</label>
                            <button onClick={() => setSelectedItems(selectedItems.length === pantryItems.length ? [] : [...pantryItems])}
                                style={{ fontSize: '0.72rem', padding: '3px 8px', background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', borderRadius: 4, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                {selectedItems.length === pantryItems.length ? 'Clear' : 'All'}
                            </button>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                            {fetchingPantry ? (
                                <span style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>Loading...</span>
                            ) : pantryItems.length > 0 ? pantryItems.map(item => (
                                <button key={item} onClick={() => toggleItem(item)}
                                    style={{
                                        padding: '4px 10px', borderRadius: 99, fontSize: '0.8rem', cursor: 'pointer',
                                        border: selectedItems.includes(item) ? '1px solid var(--accent-green)' : '1px solid var(--border-glass)',
                                        background: selectedItems.includes(item) ? 'var(--accent-green-dim)' : 'transparent',
                                        color: selectedItems.includes(item) ? 'var(--accent-green)' : 'var(--text-secondary)',
                                    }}>
                                    {item}
                                </button>
                            )) : (
                                <span style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>No recent groceries found</span>
                            )}
                        </div>
                    </div>

                    <button onClick={generatePlan} className="btn-primary" style={{ width: '100%', padding: 14 }} disabled={loading || selectedItems.length === 0}>
                        {loading ? <><Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Generating...</> : <><UtensilsCrossed size={16} /> Generate Meal Plan</>}
                    </button>
                    {error && <p style={{ color: 'var(--accent-red)', fontSize: '0.82rem', marginTop: 8, textAlign: 'center' }}>{error}</p>}
                </div>

                {/* Results */}
                <div>
                    {!loading && !mealPlan && (
                        <div style={{ textAlign: 'center', padding: '80px 20px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border-glass)' }}>
                            <CalendarDays size={48} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
                            <h3 style={{ color: 'var(--text-secondary)', margin: '0 0 8px' }}>Plan Your Meals</h3>
                            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>Select ingredients and generate an AI-powered meal plan</p>
                        </div>
                    )}

                    {loading && (
                        <div style={{ textAlign: 'center', padding: '80px 20px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-glass)' }}>
                            <CalendarDays size={40} style={{ color: 'var(--accent-green)', marginBottom: 16, animation: 'pulse 1.5s ease-in-out infinite' }} />
                            <h3 style={{ margin: '0 0 8px' }}>{progressText}</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 'var(--space-lg)' }}>Balancing nutrition across {days} day{days > 1 ? 's' : ''}</p>
                            <div style={{ maxWidth: 360, margin: '0 auto' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.78rem' }}>
                                    <span style={{ color: 'var(--text-tertiary)' }}>Progress</span>
                                    <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>{Math.round(progress)}%</span>
                                </div>
                                <div style={{ height: 8, background: 'var(--bg-glass)', borderRadius: 99, overflow: 'hidden' }}>
                                    <div style={{
                                        height: '100%', borderRadius: 99,
                                        background: 'linear-gradient(90deg, var(--accent-green), var(--accent-blue))',
                                        width: `${progress}%`,
                                        transition: 'width 0.5s ease-out',
                                    }} />
                                </div>
                            </div>
                        </div>
                    )}

                    {mealPlan && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                            {/* Summary */}
                            {mealPlan.weekly_summary && (
                                <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-glass)', padding: 'var(--space-lg)' }}>
                                    <h3 style={{ fontSize: '1rem', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <Lightbulb size={18} style={{ color: 'var(--accent-yellow)' }} /> Plan Summary
                                    </h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
                                        <div style={{ padding: 12, background: 'var(--bg-glass)', borderRadius: 8, textAlign: 'center' }}>
                                            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-green)' }}>{mealPlan.weekly_summary.avg_daily_calories}</div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>Avg Daily Cal</div>
                                        </div>
                                        <div style={{ padding: 12, background: 'var(--bg-glass)', borderRadius: 8, textAlign: 'center' }}>
                                            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-blue)' }}>{mealPlan.weekly_summary.avg_daily_protein_g}g</div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>Avg Daily Protein</div>
                                        </div>
                                        <div style={{ padding: 12, background: 'var(--bg-glass)', borderRadius: 8, textAlign: 'center' }}>
                                            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--accent-orange)' }}>{mealPlan.weekly_summary.nutrition_balance}</div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>Balance</div>
                                        </div>
                                    </div>
                                    {mealPlan.weekly_summary.tips?.map((tip, i) => (
                                        <p key={i} style={{ fontSize: '0.82rem', color: 'var(--accent-green)', margin: '4px 0' }}>💡 {tip}</p>
                                    ))}
                                    {mealPlan.weekly_summary.estimated_cost_savings && (
                                        <p style={{ fontSize: '0.82rem', color: 'var(--accent-yellow)', marginTop: 8 }}>💰 {mealPlan.weekly_summary.estimated_cost_savings}</p>
                                    )}
                                </div>
                            )}

                            {/* Day Cards */}
                            {mealPlan.meal_plan?.map((day, idx) => (
                                <div key={idx} style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-glass)', overflow: 'hidden' }}>
                                    <button onClick={() => setExpandedDay(expandedDay === idx ? null : idx)}
                                        style={{
                                            width: '100%', padding: 'var(--space-md) var(--space-lg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            background: expandedDay === idx ? 'var(--bg-glass)' : 'transparent', cursor: 'pointer', border: 'none', color: 'var(--text-primary)',
                                        }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>Day {day.day}</span>
                                            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                                {day.day_total_calories} cal · {day.day_total_protein_g}g protein
                                            </span>
                                        </div>
                                        {expandedDay === idx ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                    </button>

                                    {expandedDay === idx && day.meals && (
                                        <div style={{ padding: 'var(--space-md) var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                                            {Object.entries(day.meals).map(([mealType, meal]) => {
                                                const mc = mealColors[mealType] || mealColors.snack;
                                                return (
                                                    <div key={mealType} style={{ padding: 14, background: mc.bg, borderRadius: 12, borderLeft: `3px solid ${mc.color}` }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                                            <span style={{ fontWeight: 600, color: mc.color, fontSize: '0.9rem' }}>
                                                                {mc.icon} {mealType.charAt(0).toUpperCase() + mealType.slice(1)}
                                                            </span>
                                                            <div style={{ display: 'flex', gap: 10, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Flame size={12} /> {meal.calories} cal</span>
                                                                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={12} /> {meal.prep_mins}m</span>
                                                            </div>
                                                        </div>
                                                        <p style={{ fontWeight: 600, margin: '0 0 4px', fontSize: '0.95rem' }}>{meal.name}</p>
                                                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>
                                                            {meal.ingredients?.join(', ')}
                                                        </p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ))}

                            {/* Shopping List */}
                            {mealPlan.shopping_list?.length > 0 && (
                                <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-glass)', padding: 'var(--space-lg)' }}>
                                    <h3 style={{ fontSize: '1rem', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <ShoppingBag size={18} style={{ color: 'var(--accent-red)' }} /> Items You Need to Buy
                                    </h3>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                        {mealPlan.shopping_list.map((item, i) => (
                                            <span key={i} style={{ padding: '6px 14px', borderRadius: 99, fontSize: '0.85rem', background: 'var(--accent-red-dim)', color: 'var(--accent-red)', border: '1px solid rgba(239,68,68,0.2)' }}>
                                                {item}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
