'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { useAiOperations } from '@/lib/AiOperationsContext';
import FeatureFlow from '@/components/FeatureFlow';
import {
    CalendarDays,
    Loader,
    UtensilsCrossed,
    Clock,
    Flame,
    ShoppingBag,
    Lightbulb,
    ChevronDown,
    ChevronUp,
    ArrowRight,
} from 'lucide-react';
import styles from './meal-planner.module.css';

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
                        supabase
                            .from('grocery_sessions')
                            .select('grocery_items(name)')
                            .order('session_date', { ascending: false })
                            .limit(5),
                        supabase
                            .from('profiles')
                            .select('daily_calorie_goal')
                            .eq('id', user.id)
                            .single(),
                    ]);

                    if (sessionData) {
                        const items = new Set();
                        sessionData.forEach((session) => {
                            session.grocery_items?.forEach((item) => {
                                if (item.name) items.add(item.name);
                            });
                        });
                        const deduped = Array.from(items).sort();
                        setPantryItems(deduped);
                        setSelectedItems(deduped);
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
        setSelectedItems((prev) => (
            prev.includes(item) ? prev.filter((entry) => entry !== item) : [...prev, item]
        ));
    };

    const toggleAllItems = () => {
        setSelectedItems(selectedItems.length === pantryItems.length ? [] : [...pantryItems]);
    };

    const generatePlan = async () => {
        if (selectedItems.length === 0) {
            setError('Select at least one ingredient');
            return;
        }

        setLoading(true);
        setError('');
        setMealPlan(null);
        setProgress(10);
        setProgressText('Gathering ingredients...');

        const progressInterval = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 85) return 85;
                const increment = prev < 40 ? Math.random() * 12 : Math.random() * 7;
                return Math.min(prev + increment, 85);
            });
        }, 800);

        const inputParams = { pantryItems: selectedItems, dietary, days, calorieTarget };

        try {
            setProgressText('AI is designing your meal plan...');
            const result = await startOperation(
                'meal_plan',
                async () => {
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
                },
                inputParams
            );

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
            setTimeout(() => {
                setLoading(false);
                setProgress(0);
            }, 400);
        }
    };

    const flowItems = [
        {
            href: '/dashboard/meal-planner',
            label: 'Build the plan',
            description: 'Choose pantry items and create a meal schedule around what you already bought.',
            icon: CalendarDays,
            state: 'current',
        },
        {
            href: '/dashboard/shopping-list',
            label: 'Import missing ingredients',
            description: 'Use the shopping list import tab to turn the saved plan into a checklist.',
            icon: ShoppingBag,
            state: mealPlan?.shopping_list?.length ? 'done' : 'next',
        },
        {
            href: '/dashboard/recipes',
            label: 'Explore recipe variations',
            description: 'Switch to AI recipes when you want single-meal ideas from the same pantry.',
            icon: UtensilsCrossed,
            state: 'next',
        },
    ];

    const mealColors = {
        breakfast: { bg: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24', label: 'Breakfast' },
        lunch: { bg: 'rgba(0, 212, 170, 0.1)', color: '#00d4aa', label: 'Lunch' },
        dinner: { bg: 'rgba(77, 141, 255, 0.1)', color: '#4d8dff', label: 'Dinner' },
        snack: { bg: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', label: 'Snack' },
    };

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>
                        <CalendarDays size={28} />
                        AI Meal Planner
                    </h1>
                    <p className={styles.subtitle}>
                        Build a practical plan from your recent groceries instead of planning meals in isolation.
                    </p>
                </div>
                <Link href="/dashboard/shopping-list" className="btn-secondary">
                    <ShoppingBag size={16} />
                    Open List
                </Link>
            </div>

            <FeatureFlow
                title="Plan, Then Shop What Is Missing"
                description="The planner now hands off cleanly to the shopping list, so mobile users can move from pantry-based planning to in-store execution without losing the thread."
                items={flowItems}
            />

            <div className={styles.layout}>
                <aside className={`glass-card ${styles.controls}`}>
                    <div className={styles.controlSection}>
                        <label className="input-label">Days</label>
                        <select className="input-field" value={days} onChange={(e) => setDays(Number(e.target.value))}>
                            {[1, 2, 3, 5, 7].map((value) => (
                                <option key={value} value={value}>
                                    {value} day{value > 1 ? 's' : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.controlSection}>
                        <label className="input-label">Daily Calorie Target</label>
                        <input
                            className="input-field"
                            type="number"
                            value={calorieTarget}
                            onChange={(e) => setCalorieTarget(Number(e.target.value))}
                            min={800}
                            max={5000}
                            step={100}
                        />
                    </div>

                    <div className={styles.controlSection}>
                        <label className="input-label">Dietary Restriction</label>
                        <select className="input-field" value={dietary} onChange={(e) => setDietary(e.target.value)}>
                            {['None', 'Vegetarian', 'Vegan', 'Keto', 'Paleo', 'Gluten-Free', 'High Protein'].map((value) => (
                                <option key={value} value={value}>
                                    {value}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.pantrySection}>
                        <div className={styles.pantryHeader}>
                            <label className="input-label">Ingredients ({selectedItems.length})</label>
                            <button type="button" onClick={toggleAllItems} className={styles.tinyBtn}>
                                {selectedItems.length === pantryItems.length ? 'Clear' : 'All'}
                            </button>
                        </div>

                        <div className={styles.pantryGrid}>
                            {fetchingPantry ? (
                                <span className={styles.pantryEmpty}>Loading pantry items...</span>
                            ) : pantryItems.length > 0 ? (
                                pantryItems.map((item) => (
                                    <button
                                        key={item}
                                        type="button"
                                        onClick={() => toggleItem(item)}
                                        className={`${styles.pantryChip} ${selectedItems.includes(item) ? styles.pantryChipSelected : ''}`}
                                    >
                                        {item}
                                    </button>
                                ))
                            ) : (
                                <span className={styles.pantryEmpty}>No recent groceries found.</span>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={generatePlan}
                        className={`btn-primary ${styles.generateBtn}`}
                        disabled={loading || selectedItems.length === 0}
                    >
                        {loading ? (
                            <>
                                <Loader size={16} className={styles.spin} />
                                Generating...
                            </>
                        ) : (
                            <>
                                <UtensilsCrossed size={16} />
                                Generate Meal Plan
                            </>
                        )}
                    </button>

                    {error && <p className={styles.errorText}>{error}</p>}
                </aside>

                <main className={styles.results}>
                    {!loading && !mealPlan && (
                        <div className={styles.emptyState}>
                            <CalendarDays size={44} className={styles.emptyIcon} />
                            <h3>Plan meals around your groceries</h3>
                            <p>Select pantry items on the left and generate a plan that leads directly into your shopping workflow.</p>
                        </div>
                    )}

                    {loading && (
                        <div className={styles.loadingState}>
                            <CalendarDays size={40} className={styles.loadingIcon} />
                            <h3>{progressText}</h3>
                            <p>Balancing nutrition and missing ingredients across {days} day{days > 1 ? 's' : ''}.</p>
                            <div className={styles.progressWrap}>
                                <div className={styles.progressMeta}>
                                    <span>Progress</span>
                                    <span>{Math.round(progress)}%</span>
                                </div>
                                <div className={styles.progressTrack}>
                                    <div className={styles.progressFill} style={{ width: `${progress}%` }} />
                                </div>
                            </div>
                        </div>
                    )}

                    {mealPlan && (
                        <div className={styles.planStack}>
                            {mealPlan.weekly_summary && (
                                <section className={`glass-card ${styles.summaryCard}`}>
                                    <h2 className={styles.sectionTitle}>
                                        <Lightbulb size={18} />
                                        Plan Summary
                                    </h2>
                                    <div className={styles.summaryGrid}>
                                        <div className={styles.summaryMetric}>
                                            <strong>{mealPlan.weekly_summary.avg_daily_calories}</strong>
                                            <span>Avg daily calories</span>
                                        </div>
                                        <div className={styles.summaryMetric}>
                                            <strong>{mealPlan.weekly_summary.avg_daily_protein_g}g</strong>
                                            <span>Avg daily protein</span>
                                        </div>
                                        <div className={styles.summaryMetric}>
                                            <strong>{mealPlan.weekly_summary.nutrition_balance}</strong>
                                            <span>Nutrition balance</span>
                                        </div>
                                    </div>

                                    {mealPlan.weekly_summary.tips?.length > 0 && (
                                        <div className={styles.tipList}>
                                            {mealPlan.weekly_summary.tips.map((tip, index) => (
                                                <p key={index} className={styles.tipItem}>{tip}</p>
                                            ))}
                                        </div>
                                    )}

                                    {mealPlan.weekly_summary.estimated_cost_savings && (
                                        <p className={styles.savingsText}>{mealPlan.weekly_summary.estimated_cost_savings}</p>
                                    )}
                                </section>
                            )}

                            {mealPlan.meal_plan?.map((day, index) => (
                                <section key={index} className={`glass-card ${styles.dayCard}`}>
                                    <button
                                        type="button"
                                        onClick={() => setExpandedDay(expandedDay === index ? null : index)}
                                        className={styles.dayToggle}
                                    >
                                        <div className={styles.dayHeader}>
                                            <strong>Day {day.day}</strong>
                                            <span>{day.day_total_calories} cal · {day.day_total_protein_g}g protein</span>
                                        </div>
                                        {expandedDay === index ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                    </button>

                                    {expandedDay === index && day.meals && (
                                        <div className={styles.mealList}>
                                            {Object.entries(day.meals).map(([mealType, meal]) => {
                                                const mealColor = mealColors[mealType] || mealColors.snack;
                                                return (
                                                    <article
                                                        key={mealType}
                                                        className={styles.mealCard}
                                                        style={{ background: mealColor.bg, borderLeftColor: mealColor.color }}
                                                    >
                                                        <div className={styles.mealHeader}>
                                                            <span className={styles.mealType} style={{ color: mealColor.color }}>
                                                                {mealColor.label}
                                                            </span>
                                                            <div className={styles.mealMeta}>
                                                                <span>
                                                                    <Flame size={12} />
                                                                    {meal.calories} cal
                                                                </span>
                                                                <span>
                                                                    <Clock size={12} />
                                                                    {meal.prep_mins}m
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <h3 className={styles.mealName}>{meal.name}</h3>
                                                        <p className={styles.mealIngredients}>
                                                            {meal.ingredients?.join(', ')}
                                                        </p>
                                                    </article>
                                                );
                                            })}
                                        </div>
                                    )}
                                </section>
                            ))}

                            {mealPlan.shopping_list?.length > 0 && (
                                <section className={`glass-card ${styles.shoppingCard}`}>
                                    <div className={styles.shoppingHeader}>
                                        <h2 className={styles.sectionTitle}>
                                            <ShoppingBag size={18} />
                                            Missing ingredients
                                        </h2>
                                        <span className={styles.shoppingCount}>
                                            {mealPlan.shopping_list.length} item{mealPlan.shopping_list.length !== 1 ? 's' : ''}
                                        </span>
                                    </div>

                                    <div className={styles.shoppingChips}>
                                        {mealPlan.shopping_list.map((item, index) => (
                                            <span key={index} className={styles.shoppingChip}>{item}</span>
                                        ))}
                                    </div>

                                    <div className={styles.shoppingActions}>
                                        <Link href="/dashboard/shopping-list" className="btn-primary">
                                            <ShoppingBag size={16} />
                                            Open Shopping List
                                        </Link>
                                        <Link href="/dashboard/recipes" className="btn-secondary">
                                            <ArrowRight size={16} />
                                            Compare Recipes
                                        </Link>
                                    </div>
                                </section>
                            )}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
