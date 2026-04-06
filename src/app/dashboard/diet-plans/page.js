'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';
import { useAiOperations } from '@/lib/AiOperationsContext';
import FeatureFlow from '@/components/FeatureFlow';
import {
    Apple,
    ArrowRight,
    CalendarClock,
    CalendarDays,
    ChevronDown,
    ChevronUp,
    Clock,
    CookingPot,
    Droplets,
    Flame,
    HeartPulse,
    Lightbulb,
    Loader,
    Radar,
    Scale,
    ShoppingBag,
    Sparkles,
    Store,
    Target,
    UtensilsCrossed,
} from 'lucide-react';
import styles from './diet-plans.module.css';

const DEFAULT_FORM = {
    sex: 'male',
    age: 30,
    heightCm: 175,
    currentWeightKg: 90,
    targetWeightKg: 80,
    activityLevel: 'moderate',
    dietStyle: 'omnivore',
    preferredProteins: 'chicken, eggs, Greek yogurt',
    excludedFoods: '',
    allergies: '',
    mealsPerDay: 4,
    planDays: 3,
    paceKgPerWeek: 0.5,
    userFeedback: '',
};

const DIET_OPTIONS = [
    { value: 'omnivore', label: 'Omnivore' },
    { value: 'vegetarian', label: 'Vegetarian' },
    { value: 'vegan', label: 'Vegan' },
    { value: 'pescatarian', label: 'Pescatarian' },
    { value: 'halal', label: 'Halal-friendly' },
    { value: 'high-protein', label: 'High protein' },
    { value: 'low-carb', label: 'Low carb' },
];

const ACTIVITY_OPTIONS = [
    { value: 'sedentary', label: 'Sedentary' },
    { value: 'light', label: 'Lightly active' },
    { value: 'moderate', label: 'Moderately active' },
    { value: 'active', label: 'Active' },
    { value: 'very_active', label: 'Very active' },
];

const DIET_THINKING_STEPS = [
    { label: 'Profile check', detail: 'Reviewing age, weight, activity, and target pace.' },
    { label: 'Calorie math', detail: 'Calculating maintenance calories and a safe deficit.' },
    { label: 'Macro split', detail: 'Balancing protein, carbs, fat, and fiber targets.' },
    { label: 'Meal design', detail: 'Drafting breakfasts, lunches, dinners, and snack structure.' },
    { label: 'Ingredient sizing', detail: 'Assigning weights and practical serving amounts.' },
    { label: 'Prep flow', detail: 'Writing compact cooking steps for each meal.' },
    { label: 'Shopping merge', detail: 'Combining ingredients into a single shopping list.' },
    { label: 'Store mapping', detail: 'Sorting store suggestions from value to premium.' },
    { label: 'Final pass', detail: 'Checking totals and tightening the plan output.' },
];

const PANTRY_THINKING_STEPS = [
    { label: 'Pantry scan', detail: 'Reviewing recent groceries and selected ingredients.' },
    { label: 'Coverage check', detail: 'Checking how far the pantry can support the plan.' },
    { label: 'Meal sketch', detail: 'Drafting meals around what you already bought.' },
    { label: 'Macro balance', detail: 'Keeping calories and protein aligned to your target.' },
    { label: 'Gap analysis', detail: 'Identifying missing items for the shopping list.' },
    { label: 'Hand-off prep', detail: 'Packaging the result for shopping and recipe follow-up.' },
];

const MEAL_COLORS = {
    breakfast: { bg: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24', label: 'Breakfast' },
    lunch: { bg: 'rgba(0, 212, 170, 0.1)', color: '#00d4aa', label: 'Lunch' },
    dinner: { bg: 'rgba(77, 141, 255, 0.1)', color: '#4d8dff', label: 'Dinner' },
    snack: { bg: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', label: 'Snack' },
};

function formatMacro(value) {
    return Number.isFinite(value) ? `${Math.round(value)}g` : '0g';
}

async function fetchWithTimeout(url, options, timeoutMs = 70000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(url, {
            ...options,
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timeoutId);
    }
}

function formatSavedDate(value) {
    return new Date(value).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

function DietPlansPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const plannerMode = searchParams.get('mode') === 'pantry' ? 'pantry' : 'goal';

    const [form, setForm] = useState(DEFAULT_FORM);
    const [dietPlan, setDietPlan] = useState(null);
    const [savedPlans, setSavedPlans] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [activePlanId, setActivePlanId] = useState(null);

    const [pantryItems, setPantryItems] = useState([]);
    const [selectedItems, setSelectedItems] = useState([]);
    const [fetchingPantry, setFetchingPantry] = useState(true);
    const [mealPlan, setMealPlan] = useState(null);
    const [mealDietary, setMealDietary] = useState('None');
    const [mealDays, setMealDays] = useState(3);
    const [mealCalorieTarget, setMealCalorieTarget] = useState(2000);
    const [mealExpandedDay, setMealExpandedDay] = useState(null);

    const [loading, setLoading] = useState(false);
    const [loadingMode, setLoadingMode] = useState('goal');
    const [error, setError] = useState('');
    const [progress, setProgress] = useState(0);
    const [progressText, setProgressText] = useState('');
    const [thinkingLogs, setThinkingLogs] = useState([]);
    const [expandedDay, setExpandedDay] = useState(0);

    const { startOperation, getCompleted, clearCompleted } = useAiOperations();

    useEffect(() => {
        const completedDiet = getCompleted('diet_plan');
        if (completedDiet?.content) {
            setDietPlan(completedDiet.content);
            clearCompleted('diet_plan');
        }

        const completedMeal = getCompleted('meal_plan');
        if (completedMeal?.content) {
            setMealPlan(completedMeal.content);
            setMealExpandedDay(0);
            clearCompleted('meal_plan');
        }

        const loadAllPlannerData = async () => {
            try {
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();

                if (!user) {
                    setHistoryLoading(false);
                    setFetchingPantry(false);
                    return;
                }

                const [
                    { data: dietContent },
                    { data: mealContent },
                    { data: historyData },
                    { data: sessionData },
                    { data: profileData },
                ] = await Promise.all([
                    supabase
                        .from('ai_generated_content')
                        .select('content, input_params')
                        .eq('user_id', user.id)
                        .eq('content_type', 'diet_plan')
                        .single(),
                    supabase
                        .from('ai_generated_content')
                        .select('content, input_params')
                        .eq('user_id', user.id)
                        .eq('content_type', 'meal_plan')
                        .single(),
                    supabase
                        .from('diet_plan_generations')
                        .select('id, title, content, input_params, feedback, provider, generation_mode, created_at')
                        .eq('user_id', user.id)
                        .order('created_at', { ascending: false })
                        .limit(12),
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

                if (dietContent?.input_params) {
                    setForm((prev) => ({ ...prev, ...dietContent.input_params }));
                }
                if (dietContent?.content) {
                    setDietPlan(dietContent.content);
                }

                if (mealContent?.content?.meal_plan) {
                    setMealPlan(mealContent.content);
                    setMealExpandedDay(0);
                }
                if (mealContent?.input_params) {
                    setMealDietary(mealContent.input_params.dietary || 'None');
                    setMealDays(mealContent.input_params.days || 3);
                    setMealCalorieTarget(mealContent.input_params.calorieTarget || 2000);
                }

                if (historyData) {
                    setSavedPlans(historyData);
                    if (historyData[0]?.id) {
                        setActivePlanId(historyData[0].id);
                    }
                }

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

                if (profileData?.daily_calorie_goal) {
                    setMealCalorieTarget(profileData.daily_calorie_goal);
                }
            } catch {
                // Keep the page usable with empty-state fallbacks.
            } finally {
                setHistoryLoading(false);
                setFetchingPantry(false);
            }
        };

        loadAllPlannerData();
    }, [clearCompleted, getCompleted]);

    useEffect(() => {
        if (!loading) {
            setThinkingLogs([]);
            return;
        }

        const steps = loadingMode === 'pantry' ? PANTRY_THINKING_STEPS : DIET_THINKING_STEPS;
        setThinkingLogs([
            {
                id: 0,
                label: loadingMode === 'pantry' ? 'Pantry planner started' : 'Goal planner started',
                detail: loadingMode === 'pantry'
                    ? 'The planner is using your grocery context to structure meals.'
                    : 'The planner is using your body metrics and food rules to build the plan.',
            },
        ]);

        let stepIndex = 0;
        const interval = setInterval(() => {
            setThinkingLogs((prev) => {
                if (stepIndex >= steps.length) return prev;
                const nextStep = steps[stepIndex];
                stepIndex += 1;
                return [...prev, { id: prev.length + 1, ...nextStep }].slice(-6);
            });
        }, 1600);

        return () => clearInterval(interval);
    }, [loading, loadingMode]);

    const updateForm = (key, value) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const setMode = (mode) => {
        setError('');
        router.replace(`/dashboard/diet-plans?mode=${mode}`, { scroll: false });
    };

    const refreshDietHistory = async () => {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: historyData } = await supabase
            .from('diet_plan_generations')
            .select('id, title, content, input_params, feedback, provider, generation_mode, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(12);

        if (historyData) {
            setSavedPlans(historyData);
        }
    };

    const generateDietPlan = async (mode = 'fresh') => {
        if (Number(form.targetWeightKg) >= Number(form.currentWeightKg)) {
            setError('Target weight must be lower than current weight for a fat-loss plan.');
            return;
        }

        setLoading(true);
        setLoadingMode('goal');
        setError('');
        setProgress(12);
        setProgressText('Checking your inputs and calorie targets...');

        const progressInterval = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 85) return 85;
                return Math.min(prev + (prev < 40 ? Math.random() * 12 : Math.random() * 7), 85);
            });
        }, 700);

        try {
            setProgressText('AI is designing the fat-loss plan, macros, steps, and shopping list...');
            const payload = {
                ...form,
                currentPlanContext: mode === 'revise' && dietPlan ? {
                    summary: dietPlan.summary,
                    daily_plan: dietPlan.daily_plan?.map((day) => ({ day: day.day, focus: day.focus })),
                    shopping_list: dietPlan.shopping_list?.map((group) => ({ category: group.category })),
                } : null,
            };

            const result = await startOperation(
                'diet_plan',
                async () => {
                    const response = await fetchWithTimeout('/api/generate-diet-plan', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                    }, 70000);
                    let data;
                    try {
                        data = await response.json();
                    } catch {
                        throw new Error('AI service is temporarily unavailable. All providers are rate-limited or timed out. Please try again in a few minutes.');
                    }
                    if (!response.ok) {
                        // Surface the full provider error only if it's a user-friendly message
                        const msg = data.error || 'Failed to generate diet plan';
                        throw new Error(msg.startsWith('All AI providers failed') ? 'All AI providers are currently unavailable (quota exceeded or timeout). Please try again later.' : msg);
                    }
                    if (data.historyId) {
                        setActivePlanId(data.historyId);
                    }
                    return { data: data.data, provider: data.provider };
                },
                payload
            );

            setProgress(96);
            if (result?.data) {
                setDietPlan(result.data);
                setExpandedDay(0);
                await refreshDietHistory();
            }
        } catch (err) {
            if (err.name === 'AbortError') {
                setError('Diet plan generation timed out. The AI provider took too long, so please try again.');
            } else {
                setError(err.message || 'Failed to generate diet plan');
            }
        } finally {
            clearInterval(progressInterval);
            setProgress(100);
            setProgressText('Plan ready.');
            setTimeout(() => {
                setLoading(false);
                setProgress(0);
            }, 400);
        }
    };

    const toggleItem = (item) => {
        setSelectedItems((prev) => (
            prev.includes(item) ? prev.filter((entry) => entry !== item) : [...prev, item]
        ));
    };

    const toggleAllItems = () => {
        setSelectedItems(selectedItems.length === pantryItems.length ? [] : [...pantryItems]);
    };

    const generatePantryPlan = async () => {
        if (selectedItems.length === 0) {
            setError('Select at least one pantry ingredient.');
            return;
        }

        setLoading(true);
        setLoadingMode('pantry');
        setError('');
        setProgress(10);
        setProgressText('Gathering pantry ingredients and calorie targets...');

        const progressInterval = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 85) return 85;
                return Math.min(prev + (prev < 40 ? Math.random() * 12 : Math.random() * 7), 85);
            });
        }, 800);

        const inputParams = {
            pantryItems: selectedItems,
            dietary: mealDietary,
            days: mealDays,
            calorieTarget: mealCalorieTarget,
        };

        try {
            setProgressText('AI is designing a pantry-first meal schedule...');
            const result = await startOperation(
                'meal_plan',
                async () => {
                    const response = await fetchWithTimeout('/api/generate-meal-plan', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(inputParams),
                    }, 60000);
                    let data;
                    try {
                        data = await response.json();
                    } catch {
                        throw new Error('AI service is temporarily unavailable. Please try again in a few minutes.');
                    }
                    if (!response.ok) {
                        const msg = data.error || 'Failed to generate meal plan';
                        throw new Error(msg.startsWith('All AI providers failed') ? 'All AI providers are currently unavailable. Please try again later.' : msg);
                    }
                    return { data: data.data, provider: data.provider };
                },
                inputParams
            );

            setProgress(96);
            if (result?.data) {
                setMealPlan(result.data);
                setMealExpandedDay(0);
            }
        } catch (err) {
            if (err.name === 'AbortError') {
                setError('Pantry plan generation timed out. Please try again.');
            } else {
                setError(err.message || 'Failed to generate meal plan');
            }
        } finally {
            clearInterval(progressInterval);
            setProgress(100);
            setProgressText('Plan ready.');
            setTimeout(() => {
                setLoading(false);
                setProgress(0);
            }, 400);
        }
    };

    const flowItems = useMemo(() => (
        plannerMode === 'pantry'
            ? [
                {
                    href: '/dashboard/diet-plans?mode=pantry',
                    label: 'Build from pantry',
                    description: 'Turn recent groceries into a practical multi-day meal schedule.',
                    icon: CalendarDays,
                    state: 'current',
                },
                {
                    href: '/dashboard/shopping-list',
                    label: 'Buy only what is missing',
                    description: 'Move the missing ingredients into the shopping flow.',
                    icon: ShoppingBag,
                    state: mealPlan?.shopping_list?.length ? 'done' : 'next',
                },
                {
                    href: '/dashboard/recipes',
                    label: 'Refine meal ideas',
                    description: 'Compare recipe variations using the same pantry context.',
                    icon: UtensilsCrossed,
                    state: 'next',
                },
            ]
            : [
                {
                    href: '/dashboard/diet-plans?mode=goal',
                    label: 'Create the fat-loss plan',
                    description: 'Turn body metrics into calorie math, macros, meals, and a shopping plan.',
                    icon: Apple,
                    state: 'current',
                },
                {
                    href: '/dashboard/goals',
                    label: 'Log intake against the plan',
                    description: 'Use the intake logger to compare what you ate with your targets.',
                    icon: Target,
                    state: dietPlan ? 'done' : 'next',
                },
                {
                    href: '/dashboard/shopping-list',
                    label: 'Shop the plan',
                    description: 'Use the generated list and store guidance during your next trip.',
                    icon: ShoppingBag,
                    state: dietPlan?.shopping_list?.length ? 'done' : 'next',
                },
            ]
    ), [plannerMode, mealPlan, dietPlan]);

    const loadSavedDietPlan = (plan) => {
        if (!plan) return;
        setDietPlan(plan.content || null);
        setActivePlanId(plan.id || null);
        if (plan.input_params) {
            setForm((prev) => ({ ...prev, ...plan.input_params }));
        }
        setExpandedDay(0);
    };

    const heroTitle = plannerMode === 'pantry'
        ? 'Plan meals around what you already bought'
        : 'Build a full diet plan from body metrics and food rules';
    const heroDescription = plannerMode === 'pantry'
        ? 'Use recent groceries as the starting point. The planner will build a practical schedule first and then highlight only the ingredients you still need.'
        : 'This planner calculates calorie targets and safe deficits, then builds a detailed meal plan, macros, ingredient weights, and a shopping route.';

    return (
        <div className={styles.page}>
            <section className={styles.hero}>
                <div className={styles.heroCopy}>
                    <span className={styles.kicker}>Unified AI Planner</span>
                    <h1 className={styles.title}>
                        <CalendarDays size={30} />
                        {heroTitle}
                    </h1>
                    <p className={styles.subtitle}>{heroDescription}</p>

                    <div className={styles.modeTabs}>
                        <button
                            type="button"
                            className={`${styles.modeTab} ${plannerMode === 'goal' ? styles.modeTabActive : ''}`}
                            onClick={() => setMode('goal')}
                        >
                            <Apple size={16} />
                            Goal-based plan
                        </button>
                        <button
                            type="button"
                            className={`${styles.modeTab} ${plannerMode === 'pantry' ? styles.modeTabActive : ''}`}
                            onClick={() => setMode('pantry')}
                        >
                            <ShoppingBag size={16} />
                            Pantry-based plan
                        </button>
                    </div>
                </div>

                <div className={`glass-card ${styles.heroPanel}`}>
                    {plannerMode === 'pantry' ? (
                        <>
                            <div className={styles.heroMetric}>
                                <ShoppingBag size={18} />
                                <div>
                                    <strong>{selectedItems.length || pantryItems.length || 0} items</strong>
                                    <span>Pantry ingredients available</span>
                                </div>
                            </div>
                            <div className={styles.heroMetric}>
                                <CalendarDays size={18} />
                                <div>
                                    <strong>{mealDays} days</strong>
                                    <span>Current pantry plan length</span>
                                </div>
                            </div>
                            <div className={styles.heroMetric}>
                                <Flame size={18} />
                                <div>
                                    <strong>{mealPlan?.weekly_summary?.avg_daily_calories || mealCalorieTarget}</strong>
                                    <span>Daily calorie target</span>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className={styles.heroMetric}>
                                <Flame size={18} />
                                <div>
                                    <strong>{dietPlan?.summary?.calorie_target || 'Calorie target'}</strong>
                                    <span>Daily deficit-based target</span>
                                </div>
                            </div>
                            <div className={styles.heroMetric}>
                                <Scale size={18} />
                                <div>
                                    <strong>{dietPlan?.summary?.estimated_weekly_loss_kg || '0.5'} kg/week</strong>
                                    <span>Projected weekly loss</span>
                                </div>
                            </div>
                            <div className={styles.heroMetric}>
                                <ShoppingBag size={18} />
                                <div>
                                    <strong>{dietPlan?.shopping_list?.length || 0} groups</strong>
                                    <span>Shopping list sections</span>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </section>

            <FeatureFlow
                title={plannerMode === 'pantry' ? 'Use, Then Shop' : 'Generate, Follow, Then Track'}
                description={plannerMode === 'pantry'
                    ? 'The unified planner keeps pantry-driven planning connected to shopping and recipe exploration.'
                    : 'The unified planner keeps goal-driven meal planning connected to intake logging and shopping execution.'}
                items={flowItems}
            />

            <div className={styles.layout}>
                <aside className={`glass-card ${styles.controls}`}>
                    <div className={styles.sectionHeader}>
                        <h2>{plannerMode === 'pantry' ? 'Pantry Planner Inputs' : 'Goal Planner Inputs'}</h2>
                        <p>
                            {plannerMode === 'pantry'
                                ? 'Use recent groceries as the planning base. The planner will fill only the gaps.'
                                : 'Feed the planner enough structure to generate a realistic fat-loss plan instead of generic meals.'}
                        </p>
                    </div>

                    {plannerMode === 'goal' ? (
                        <>
                            <div className={styles.formGrid}>
                                <div className={styles.field}>
                                    <label className="input-label">Sex</label>
                                    <select className="input-field" value={form.sex} onChange={(e) => updateForm('sex', e.target.value)}>
                                        <option value="male">Male</option>
                                        <option value="female">Female</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                                <div className={styles.field}>
                                    <label className="input-label">Age</label>
                                    <input className="input-field" type="number" value={form.age} onChange={(e) => updateForm('age', Number(e.target.value))} />
                                </div>
                                <div className={styles.field}>
                                    <label className="input-label">Height (cm)</label>
                                    <input className="input-field" type="number" value={form.heightCm} onChange={(e) => updateForm('heightCm', Number(e.target.value))} />
                                </div>
                                <div className={styles.field}>
                                    <label className="input-label">Current Weight (kg)</label>
                                    <input className="input-field" type="number" value={form.currentWeightKg} onChange={(e) => updateForm('currentWeightKg', Number(e.target.value))} />
                                </div>
                                <div className={styles.field}>
                                    <label className="input-label">Target Weight (kg)</label>
                                    <input className="input-field" type="number" value={form.targetWeightKg} onChange={(e) => updateForm('targetWeightKg', Number(e.target.value))} />
                                </div>
                                <div className={styles.field}>
                                    <label className="input-label">Activity Level</label>
                                    <select className="input-field" value={form.activityLevel} onChange={(e) => updateForm('activityLevel', e.target.value)}>
                                        {ACTIVITY_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className={styles.field}>
                                    <label className="input-label">Diet Style</label>
                                    <select className="input-field" value={form.dietStyle} onChange={(e) => updateForm('dietStyle', e.target.value)}>
                                        {DIET_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className={styles.field}>
                                    <label className="input-label">Meals Per Day</label>
                                    <select className="input-field" value={form.mealsPerDay} onChange={(e) => updateForm('mealsPerDay', Number(e.target.value))}>
                                        {[3, 4, 5, 6].map((value) => (
                                            <option key={value} value={value}>{value} meals</option>
                                        ))}
                                    </select>
                                </div>
                                <div className={styles.field}>
                                    <label className="input-label">Plan Length</label>
                                    <select className="input-field" value={form.planDays} onChange={(e) => updateForm('planDays', Number(e.target.value))}>
                                        {[3, 5, 7].map((value) => (
                                            <option key={value} value={value}>{value} days</option>
                                        ))}
                                    </select>
                                </div>
                                <div className={styles.field}>
                                    <label className="input-label">Target Pace (kg/week)</label>
                                    <select className="input-field" value={form.paceKgPerWeek} onChange={(e) => updateForm('paceKgPerWeek', Number(e.target.value))}>
                                        {[0.25, 0.5, 0.75, 1].map((value) => (
                                            <option key={value} value={value}>{value}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className={styles.field}>
                                <label className="input-label">Preferred Proteins</label>
                                <textarea className={`${styles.textarea} input-field`} value={form.preferredProteins} onChange={(e) => updateForm('preferredProteins', e.target.value)} placeholder="e.g. chicken, salmon, tofu, eggs" />
                            </div>
                            <div className={styles.field}>
                                <label className="input-label">Excluded Foods</label>
                                <textarea className={`${styles.textarea} input-field`} value={form.excludedFoods} onChange={(e) => updateForm('excludedFoods', e.target.value)} placeholder="e.g. beef, mushrooms, coriander" />
                            </div>
                            <div className={styles.field}>
                                <label className="input-label">Allergies / Hard Restrictions</label>
                                <textarea className={`${styles.textarea} input-field`} value={form.allergies} onChange={(e) => updateForm('allergies', e.target.value)} placeholder="e.g. nuts, shellfish, soy" />
                            </div>
                            <div className={styles.field}>
                                <label className="input-label">User Feedback For Regeneration</label>
                                <textarea
                                    className={`${styles.textarea} input-field`}
                                    value={form.userFeedback}
                                    onChange={(e) => updateForm('userFeedback', e.target.value)}
                                    placeholder="e.g. reduce cost, add more vegetarian lunches, make dinners faster, avoid whey"
                                />
                            </div>

                            <div className={styles.actionRow}>
                                <button className={`btn-primary ${styles.generateBtn}`} onClick={() => generateDietPlan('fresh')} disabled={loading}>
                                    {loading && loadingMode === 'goal' ? <Loader size={18} className={styles.spin} /> : <Sparkles size={18} />}
                                    {loading && loadingMode === 'goal' ? 'Generating Goal Plan...' : 'Generate Goal Plan'}
                                </button>
                                <button
                                    className={`btn-secondary ${styles.secondaryBtn}`}
                                    onClick={() => generateDietPlan('revise')}
                                    disabled={loading || !dietPlan}
                                >
                                    Regenerate With Feedback
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className={styles.formGrid}>
                                <div className={styles.field}>
                                    <label className="input-label">Days</label>
                                    <select className="input-field" value={mealDays} onChange={(e) => setMealDays(Number(e.target.value))}>
                                        {[1, 2, 3, 5, 7].map((value) => (
                                            <option key={value} value={value}>
                                                {value} day{value > 1 ? 's' : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className={styles.field}>
                                    <label className="input-label">Daily Calorie Target</label>
                                    <input
                                        className="input-field"
                                        type="number"
                                        value={mealCalorieTarget}
                                        onChange={(e) => setMealCalorieTarget(Number(e.target.value))}
                                        min={800}
                                        max={5000}
                                        step={100}
                                    />
                                </div>
                                <div className={styles.field}>
                                    <label className="input-label">Dietary Restriction</label>
                                    <select className="input-field" value={mealDietary} onChange={(e) => setMealDietary(e.target.value)}>
                                        {['None', 'Vegetarian', 'Vegan', 'Keto', 'Paleo', 'Gluten-Free', 'High Protein'].map((value) => (
                                            <option key={value} value={value}>{value}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className={styles.pantrySection}>
                                <div className={styles.pantryHeader}>
                                    <label className="input-label">Ingredients ({selectedItems.length})</label>
                                    <button type="button" onClick={toggleAllItems} className={styles.tinyBtn}>
                                        {selectedItems.length === pantryItems.length ? 'Clear' : 'All'}
                                    </button>
                                </div>
                                <p className={styles.controlHint}>
                                    The pantry planner works better than the diet planner because it sends a much smaller prompt and expects a much smaller JSON response.
                                </p>
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
                                className={`btn-primary ${styles.generateBtn}`}
                                onClick={generatePantryPlan}
                                disabled={loading || selectedItems.length === 0}
                            >
                                {loading && loadingMode === 'pantry' ? <Loader size={18} className={styles.spin} /> : <UtensilsCrossed size={18} />}
                                {loading && loadingMode === 'pantry' ? 'Generating Pantry Plan...' : 'Generate Pantry Plan'}
                            </button>
                        </>
                    )}

                    {error && <p className={styles.errorText}>{error}</p>}
                </aside>

                <section className={styles.results}>
                    {loading && (
                        <div className={`glass-card ${styles.loadingState}`}>
                            <Loader size={36} className={styles.spin} />
                            <h3>{loadingMode === 'pantry' ? 'Designing the pantry plan' : 'Designing the goal plan'}</h3>
                            <p>{progressText}</p>
                            <div className={styles.progressWrap}>
                                <div className={styles.progressMeta}>
                                    <span>{progressText}</span>
                                    <span>{Math.round(progress)}%</span>
                                </div>
                                <div className={styles.progressTrack}>
                                    <div className={styles.progressFill} style={{ width: `${progress}%` }} />
                                </div>
                            </div>
                            <div className={styles.thinkingPanel}>
                                <div className={styles.thinkingHeader}>
                                    <span>AI activity log</span>
                                    <span className={styles.thinkingPulse}>live</span>
                                </div>
                                <div className={styles.thinkingList}>
                                    {thinkingLogs.map((entry) => (
                                        <div key={entry.id} className={styles.thinkingItem}>
                                            <span className={styles.thinkingDot} />
                                            <div>
                                                <strong>{entry.label}</strong>
                                                <p>{entry.detail}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {!loading && plannerMode === 'goal' && savedPlans.length > 0 && (
                        <section className={`glass-card ${styles.historyCard}`}>
                            <div className={styles.sectionTop}>
                                <div>
                                    <h2>Saved Goal Plans</h2>
                                    <p>Every generated diet plan is stored in the database. Reopen recent versions here.</p>
                                </div>
                                <CalendarClock size={18} />
                            </div>
                            <div className={styles.historyList}>
                                {savedPlans.map((plan) => (
                                    <button
                                        key={plan.id}
                                        className={`${styles.historyItem} ${activePlanId === plan.id ? styles.historyItemActive : ''}`}
                                        onClick={() => loadSavedDietPlan(plan)}
                                    >
                                        <div className={styles.historyTop}>
                                            <strong>{plan.title || 'Saved diet plan'}</strong>
                                            <span>{formatSavedDate(plan.created_at)}</span>
                                        </div>
                                        <p>{plan.generation_mode === 'regenerate' ? 'Regenerated from feedback' : 'Fresh generation'}</p>
                                        {plan.feedback && <span className={styles.historyTag}>Feedback: {plan.feedback}</span>}
                                    </button>
                                ))}
                            </div>
                        </section>
                    )}

                    {!loading && plannerMode === 'goal' && historyLoading && (
                        <div className={`glass-card ${styles.historyCard}`}>
                            <div className={styles.sectionTop}>
                                <div>
                                    <h2>Saved Goal Plans</h2>
                                    <p>Loading stored goal plans...</p>
                                </div>
                                <Loader size={18} className={styles.spin} />
                            </div>
                        </div>
                    )}

                    {!loading && plannerMode === 'goal' && !dietPlan && (
                        <div className={`glass-card ${styles.emptyState}`}>
                            <Radar size={42} className={styles.emptyIcon} />
                            <h3>No goal-based plan generated yet</h3>
                            <p>The goal-based planner is heavier than the pantry planner because it calculates body metrics and asks the model for a larger structured response.</p>
                        </div>
                    )}

                    {!loading && plannerMode === 'goal' && dietPlan && (
                        <div className={styles.planStack}>
                            <section className={`glass-card ${styles.summaryCard}`}>
                                <div className={styles.summaryHeader}>
                                    <div>
                                        <h2>Weight-Loss Math</h2>
                                        <p>{dietPlan.summary?.headline || 'Calories, deficit, and macros were recalculated before generating the plan.'}</p>
                                    </div>
                                    <Link href="/dashboard/goals" className="btn-secondary">
                                        Track Intake
                                        <ArrowRight size={16} />
                                    </Link>
                                </div>

                                <div className={styles.metricGrid}>
                                    <div className={styles.metricCard}>
                                        <Flame size={18} />
                                        <strong>{dietPlan.summary?.calorie_target} kcal</strong>
                                        <span>Daily target</span>
                                    </div>
                                    <div className={styles.metricCard}>
                                        <Target size={18} />
                                        <strong>{dietPlan.summary?.daily_deficit} kcal</strong>
                                        <span>Daily deficit</span>
                                    </div>
                                    <div className={styles.metricCard}>
                                        <Scale size={18} />
                                        <strong>{dietPlan.summary?.estimated_weekly_loss_kg} kg</strong>
                                        <span>Weekly loss</span>
                                    </div>
                                    <div className={styles.metricCard}>
                                        <HeartPulse size={18} />
                                        <strong>{dietPlan.summary?.projected_weeks_to_goal} weeks</strong>
                                        <span>Projected timeline</span>
                                    </div>
                                    <div className={styles.metricCard}>
                                        <CookingPot size={18} />
                                        <strong>{formatMacro(dietPlan.summary?.macro_targets?.protein_g)}</strong>
                                        <span>Protein target</span>
                                    </div>
                                    <div className={styles.metricCard}>
                                        <Droplets size={18} />
                                        <strong>{dietPlan.summary?.hydration_liters} L</strong>
                                        <span>Water target</span>
                                    </div>
                                </div>

                                <div className={styles.macroRow}>
                                    <div className={styles.macroPill}>Protein {formatMacro(dietPlan.summary?.macro_targets?.protein_g)}</div>
                                    <div className={styles.macroPill}>Carbs {formatMacro(dietPlan.summary?.macro_targets?.carbs_g)}</div>
                                    <div className={styles.macroPill}>Fat {formatMacro(dietPlan.summary?.macro_targets?.fat_g)}</div>
                                    <div className={styles.macroPill}>Fiber {formatMacro(dietPlan.summary?.macro_targets?.fiber_g)}</div>
                                </div>

                                {form.userFeedback?.trim() && (
                                    <div className={styles.feedbackBanner}>
                                        <strong>Latest regeneration brief</strong>
                                        <p>{form.userFeedback}</p>
                                    </div>
                                )}
                            </section>

                            <section className={`glass-card ${styles.storeCard}`}>
                                <div className={styles.sectionTop}>
                                    <div>
                                        <h2>Store Order</h2>
                                        <p>{dietPlan.store_ranking_note}</p>
                                    </div>
                                    <Store size={18} />
                                </div>
                                <div className={styles.storeRow}>
                                    {dietPlan.store_ranking?.map((store) => (
                                        <div key={store.store} className={styles.storePill}>
                                            <strong>{store.rank}. {store.store}</strong>
                                            <span>{store.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section className={styles.dayStack}>
                                {dietPlan.daily_plan?.map((day, index) => {
                                    const open = expandedDay === index;
                                    return (
                                        <article key={`${day.day}-${index}`} className={`glass-card ${styles.dayCard}`}>
                                            <button className={styles.dayToggle} onClick={() => setExpandedDay(open ? -1 : index)}>
                                                <div>
                                                    <span className={styles.dayEyebrow}>Day {day.day}</span>
                                                    <h3>{day.focus || `Meal structure for day ${day.day}`}</h3>
                                                    <p>{day.day_totals?.calories} kcal • {formatMacro(day.day_totals?.protein_g)} protein • {formatMacro(day.day_totals?.carbs_g)} carbs • {formatMacro(day.day_totals?.fat_g)} fat</p>
                                                </div>
                                                {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                            </button>

                                            {open && (
                                                <div className={styles.mealGrid}>
                                                    {day.meals?.map((meal, mealIndex) => (
                                                        <section key={`${meal.name}-${mealIndex}`} className={styles.mealCard}>
                                                            <div className={styles.mealTop}>
                                                                <div>
                                                                    <span className={styles.mealLabel}>{meal.meal_label}</span>
                                                                    <h4>{meal.name}</h4>
                                                                </div>
                                                                <span className={styles.prepBadge}>{meal.prep_minutes} min</span>
                                                            </div>

                                                            <div className={styles.mealMetaChips}>
                                                                <span>{meal.calories} kcal</span>
                                                                <span>{formatMacro(meal.protein_g)} protein</span>
                                                                <span>{formatMacro(meal.carbs_g)} carbs</span>
                                                                <span>{formatMacro(meal.fat_g)} fat</span>
                                                            </div>

                                                            <div className={styles.mealBlock}>
                                                                <strong>Ingredients</strong>
                                                                <ul className={styles.inlineList}>
                                                                    {meal.ingredients?.map((ingredient, ingredientIndex) => (
                                                                        <li key={`${ingredient.item}-${ingredientIndex}`}>
                                                                            <span>{ingredient.item}</span>
                                                                            <span>{ingredient.amount}</span>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>

                                                            <div className={styles.mealBlock}>
                                                                <strong>Steps</strong>
                                                                <ol className={styles.stepList}>
                                                                    {meal.steps?.map((step, stepIndex) => (
                                                                        <li key={`${meal.name}-step-${stepIndex}`}>{step}</li>
                                                                    ))}
                                                                </ol>
                                                            </div>
                                                        </section>
                                                    ))}
                                                </div>
                                            )}
                                        </article>
                                    );
                                })}
                            </section>

                            <section className={`glass-card ${styles.shoppingCard}`}>
                                <div className={styles.sectionTop}>
                                    <div>
                                        <h2>Shopping List</h2>
                                        <p>Grouped for faster mobile shopping, with estimated cheapest-to-premium store options per item.</p>
                                    </div>
                                    <Link href="/dashboard/shopping-list" className="btn-secondary">
                                        Open Shopping List
                                        <ArrowRight size={16} />
                                    </Link>
                                </div>

                                <div className={styles.shoppingGroups}>
                                    {dietPlan.shopping_list?.map((group) => (
                                        <div key={group.category} className={styles.shoppingGroup}>
                                            <h3>{group.category}</h3>
                                            <div className={styles.shoppingItems}>
                                                {group.items?.map((item, index) => (
                                                    <div key={`${item.item}-${index}`} className={styles.shoppingItem}>
                                                        <div className={styles.shoppingItemTop}>
                                                            <strong>{item.item}</strong>
                                                            <span>{item.total_amount}</span>
                                                        </div>
                                                        {item.used_in?.length > 0 && (
                                                            <p className={styles.usedIn}>Used in {item.used_in.join(', ')}</p>
                                                        )}
                                                        <div className={styles.storeOptions}>
                                                            {item.store_options?.map((option) => (
                                                                <span key={`${item.item}-${option.store}`} className={styles.storeOption}>
                                                                    {option.store}
                                                                    {option.note ? ` • ${option.note}` : ''}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {dietPlan.execution_guide?.length > 0 && (
                                <section className={`glass-card ${styles.guideCard}`}>
                                    <div className={styles.sectionTop}>
                                        <div>
                                            <h2>Execution Guide</h2>
                                            <p>Use this sequence to follow the plan without friction.</p>
                                        </div>
                                    </div>
                                    <ol className={styles.guideList}>
                                        {dietPlan.execution_guide.map((step, index) => (
                                            <li key={`guide-${index}`}>{step}</li>
                                        ))}
                                    </ol>
                                </section>
                            )}
                        </div>
                    )}

                    {!loading && plannerMode === 'pantry' && !mealPlan && (
                        <div className={`glass-card ${styles.emptyState}`}>
                            <Radar size={42} className={styles.emptyIcon} />
                            <h3>No pantry-based plan generated yet</h3>
                            <p>Select pantry ingredients on the left and generate a leaner meal plan that works from your recent groceries first.</p>
                        </div>
                    )}

                    {!loading && plannerMode === 'pantry' && mealPlan && (
                        <div className={styles.planStack}>
                            {mealPlan.weekly_summary && (
                                <section className={`glass-card ${styles.summaryCard}`}>
                                    <div className={styles.summaryHeader}>
                                        <div>
                                            <h2>Pantry Plan Summary</h2>
                                            <p>Smaller AI workload, faster response. This planner starts from groceries you already have.</p>
                                        </div>
                                        <Link href="/dashboard/shopping-list" className="btn-secondary">
                                            Open Shopping List
                                            <ArrowRight size={16} />
                                        </Link>
                                    </div>
                                    <div className={styles.metricGrid}>
                                        <div className={styles.metricCard}>
                                            <Flame size={18} />
                                            <strong>{mealPlan.weekly_summary.avg_daily_calories}</strong>
                                            <span>Avg daily calories</span>
                                        </div>
                                        <div className={styles.metricCard}>
                                            <CookingPot size={18} />
                                            <strong>{mealPlan.weekly_summary.avg_daily_protein_g}g</strong>
                                            <span>Avg daily protein</span>
                                        </div>
                                        <div className={styles.metricCard}>
                                            <Lightbulb size={18} />
                                            <strong>{mealPlan.weekly_summary.nutrition_balance}</strong>
                                            <span>Nutrition balance</span>
                                        </div>
                                    </div>
                                    {mealPlan.weekly_summary.tips?.length > 0 && (
                                        <ol className={styles.guideList}>
                                            {mealPlan.weekly_summary.tips.map((tip, index) => (
                                                <li key={index}>{tip}</li>
                                            ))}
                                        </ol>
                                    )}
                                </section>
                            )}

                            {mealPlan.meal_plan?.map((day, index) => (
                                <section key={index} className={`glass-card ${styles.dayCard}`}>
                                    <button
                                        type="button"
                                        onClick={() => setMealExpandedDay(mealExpandedDay === index ? null : index)}
                                        className={styles.dayToggle}
                                    >
                                        <div>
                                            <span className={styles.dayEyebrow}>Day {day.day}</span>
                                            <h3>Pantry-led schedule</h3>
                                            <p>{day.day_total_calories} kcal • {day.day_total_protein_g}g protein</p>
                                        </div>
                                        {mealExpandedDay === index ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                    </button>

                                    {mealExpandedDay === index && day.meals && (
                                        <div className={styles.mealGrid}>
                                            {Object.entries(day.meals).map(([mealType, meal]) => {
                                                const mealColor = MEAL_COLORS[mealType] || MEAL_COLORS.snack;
                                                return (
                                                    <article
                                                        key={mealType}
                                                        className={styles.mealCard}
                                                        style={{ background: mealColor.bg, borderLeftColor: mealColor.color }}
                                                    >
                                                        <div className={styles.mealTop}>
                                                            <div>
                                                                <span className={styles.mealLabel} style={{ color: mealColor.color }}>
                                                                    {mealColor.label}
                                                                </span>
                                                                <h4>{meal.name}</h4>
                                                            </div>
                                                            <span className={styles.prepBadge}>{meal.prep_mins} min</span>
                                                        </div>
                                                        <div className={styles.mealMetaChips}>
                                                            <span>{meal.calories} kcal</span>
                                                            <span>{meal.protein_g}g protein</span>
                                                            <span>{meal.ingredients?.length || 0} ingredients</span>
                                                        </div>
                                                        <p className={styles.mealDescription}>
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
                                    <div className={styles.sectionTop}>
                                        <div>
                                            <h2>Missing Ingredients</h2>
                                            <p>These are the only items the pantry plan could not cover from your recent groceries.</p>
                                        </div>
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
                </section>
            </div>
        </div>
    );
}

export default function DietPlansPage() {
    return (
        <Suspense fallback={null}>
            <DietPlansPageContent />
        </Suspense>
    );
}
