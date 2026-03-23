'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { useAiOperations } from '@/lib/AiOperationsContext';
import FeatureFlow from '@/components/FeatureFlow';
import {
    Apple,
    ArrowRight,
    CalendarClock,
    Flame,
    Loader,
    Radar,
    ShoppingBag,
    Store,
    Target,
    Scale,
    HeartPulse,
    ChevronDown,
    ChevronUp,
    CookingPot,
    Droplets,
    Sparkles,
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

const THINKING_STEPS = [
    { label: 'Profile check', detail: 'Reviewing age, weight, activity, and target pace.' },
    { label: 'Calorie math', detail: 'Calculating maintenance calories and a safe deficit.' },
    { label: 'Macro split', detail: 'Balancing protein, carbs, fat, and fiber targets.' },
    { label: 'Meal design', detail: 'Drafting breakfasts, lunches, dinners, and snack structure.' },
    { label: 'Ingredient sizing', detail: 'Assigning weights and practical serving amounts.' },
    { label: 'Prep flow', detail: 'Writing simple cooking steps for each meal.' },
    { label: 'Shopping merge', detail: 'Combining ingredients into a single shopping list.' },
    { label: 'Store mapping', detail: 'Sorting store suggestions from value to premium.' },
    { label: 'Final pass', detail: 'Checking totals and tightening the plan output.' },
];

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

export default function DietPlansPage() {
    const [form, setForm] = useState(DEFAULT_FORM);
    const [dietPlan, setDietPlan] = useState(null);
    const [savedPlans, setSavedPlans] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [activePlanId, setActivePlanId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [progress, setProgress] = useState(0);
    const [progressText, setProgressText] = useState('');
    const [thinkingLogs, setThinkingLogs] = useState([]);
    const [expandedDay, setExpandedDay] = useState(0);

    const { startOperation, getCompleted, clearCompleted, isRunning } = useAiOperations();

    useEffect(() => {
        const completed = getCompleted('diet_plan');
        if (completed?.content) {
            setDietPlan(completed.content);
            clearCompleted('diet_plan');
            return;
        }

        const loadSaved = async () => {
            try {
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    setHistoryLoading(false);
                    return;
                }

                const [{ data }, { data: historyData }] = await Promise.all([
                    supabase
                    .from('ai_generated_content')
                    .select('content, input_params, updated_at')
                    .eq('user_id', user.id)
                    .eq('content_type', 'diet_plan')
                    .single(),
                    supabase
                        .from('diet_plan_generations')
                        .select('id, title, content, input_params, feedback, provider, generation_mode, created_at')
                        .eq('user_id', user.id)
                        .order('created_at', { ascending: false })
                        .limit(12),
                ]);

                if (data?.input_params) {
                    setForm((prev) => ({ ...prev, ...data.input_params }));
                }

                if (data?.content) {
                    setDietPlan(data.content);
                }

                 if (historyData) {
                    setSavedPlans(historyData);
                    if (historyData[0]?.id) {
                        setActivePlanId(historyData[0].id);
                    }
                }
            } catch {}
            finally {
                setHistoryLoading(false);
            }
        };

        loadSaved();
    }, [clearCompleted, getCompleted]);

    useEffect(() => {
        if (isRunning('diet_plan') && !loading) {
            setLoading(true);
            setProgress(50);
            setProgressText('AI is rebuilding your fat-loss plan...');
        }
    }, [isRunning, loading]);

    useEffect(() => {
        if (!loading) {
            setThinkingLogs([]);
            return;
        }

        setThinkingLogs([
            {
                id: 0,
                label: 'Planner started',
                detail: 'The AI planner accepted your inputs and started building the plan.',
            },
        ]);

        let stepIndex = 0;
        const interval = setInterval(() => {
            setThinkingLogs((prev) => {
                if (stepIndex >= THINKING_STEPS.length) return prev;
                const nextStep = THINKING_STEPS[stepIndex];
                stepIndex += 1;
                return [
                    ...prev,
                    {
                        id: prev.length + 1,
                        ...nextStep,
                    },
                ].slice(-6);
            });
        }, 1600);

        return () => clearInterval(interval);
    }, [loading]);

    const updateForm = (key, value) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const generatePlan = async (mode = 'fresh') => {
        if (Number(form.targetWeightKg) >= Number(form.currentWeightKg)) {
            setError('Target weight must be lower than current weight for a fat-loss plan.');
            return;
        }

        setLoading(true);
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
            setProgressText('AI is designing the plan, macros, steps, and shopping list...');
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
                    const data = await response.json();
                    if (!response.ok) {
                        throw new Error(data.error || 'Failed to generate diet plan');
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
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: historyData } = await supabase
                        .from('diet_plan_generations')
                        .select('id, title, content, input_params, feedback, provider, generation_mode, created_at')
                        .eq('user_id', user.id)
                        .order('created_at', { ascending: false })
                        .limit(12);
                    if (historyData) {
                        setSavedPlans(historyData);
                    }
                }
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

    const flowItems = [
        {
            href: '/dashboard/diet-plans',
            label: 'Create the fat-loss plan',
            description: 'Turn profile inputs into calorie math, daily macros, meals, and a consolidated shopping list.',
            icon: Apple,
            state: 'current',
        },
        {
            href: '/dashboard/goals',
            label: 'Log intake against the plan',
            description: 'Use the intake logger to compare what you ate with the new calorie and macro targets.',
            icon: Target,
            state: dietPlan ? 'done' : 'next',
        },
        {
            href: '/dashboard/shopping-list',
            label: 'Shop the plan',
            description: 'Carry the ingredient list into your next trip and follow the store guidance in the cheapest order.',
            icon: ShoppingBag,
            state: dietPlan?.shopping_list?.length ? 'done' : 'next',
        },
    ];

    const loadSavedPlan = (plan) => {
        if (!plan) return;
        setDietPlan(plan.content || null);
        setActivePlanId(plan.id || null);
        if (plan.input_params) {
            setForm((prev) => ({ ...prev, ...plan.input_params }));
        }
        setExpandedDay(0);
    };

    return (
        <div className={styles.page}>
            <section className={styles.hero}>
                <div className={styles.heroCopy}>
                    <span className={styles.kicker}>AI Weight-Loss Planner</span>
                    <h1 className={styles.title}>
                        <Apple size={30} />
                        Build a full diet plan from your body metrics and food rules
                    </h1>
                    <p className={styles.subtitle}>
                        This planner calculates your calorie target, sets a realistic deficit, then uses AI to generate detailed meals, ingredient weights, cooking steps, and an estimated UK store-by-store shopping route.
                    </p>
                </div>
                <div className={`glass-card ${styles.heroPanel}`}>
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
                </div>
            </section>

            <FeatureFlow
                title="Generate, Follow, Then Track"
                description="The new planner is linked into the rest of the app so a user can generate a diet plan, follow it on mobile, and log consumed items without losing context."
                items={flowItems}
            />

            <div className={styles.layout}>
                <aside className={`glass-card ${styles.controls}`}>
                    <div className={styles.sectionHeader}>
                        <h2>Planner Inputs</h2>
                        <p>Feed the AI enough structure to generate a realistic fat-loss plan instead of generic meals.</p>
                    </div>

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

                    {error && <p className={styles.errorText}>{error}</p>}

                    <div className={styles.actionRow}>
                        <button className={`btn-primary ${styles.generateBtn}`} onClick={() => generatePlan('fresh')} disabled={loading}>
                            {loading ? <Loader size={18} className={styles.spin} /> : <Sparkles size={18} />}
                            {loading ? 'Generating AI Diet Plan...' : 'Generate Fresh Plan'}
                        </button>
                        <button
                            className={`btn-secondary ${styles.secondaryBtn}`}
                            onClick={() => generatePlan('revise')}
                            disabled={loading || !dietPlan}
                            title={dietPlan ? 'Regenerate using the current inputs and feedback' : 'Generate a first plan before requesting revisions'}
                        >
                            Regenerate With Feedback
                        </button>
                    </div>
                </aside>

                <section className={styles.results}>
                    {loading && (
                        <div className={`glass-card ${styles.loadingState}`}>
                            <Loader size={36} className={styles.spin} />
                            <h3>Designing the plan</h3>
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

                    {!loading && !dietPlan && (
                        <div className={`glass-card ${styles.emptyState}`}>
                            <Radar size={42} className={styles.emptyIcon} />
                            <h3>No diet plan generated yet</h3>
                            <p>Set the user profile, food rules, and target pace on the left. The planner will calculate calories first, then generate a detailed AI meal structure you can actually follow on mobile.</p>
                        </div>
                    )}

                    {!loading && savedPlans.length > 0 && (
                        <section className={`glass-card ${styles.historyCard}`}>
                            <div className={styles.sectionTop}>
                                <div>
                                    <h2>Saved Plans</h2>
                                    <p>Every generated diet plan is now stored in the database. Reopen any recent version here.</p>
                                </div>
                                <CalendarClock size={18} />
                            </div>
                            <div className={styles.historyList}>
                                {savedPlans.map((plan) => (
                                    <button
                                        key={plan.id}
                                        className={`${styles.historyItem} ${activePlanId === plan.id ? styles.historyItemActive : ''}`}
                                        onClick={() => loadSavedPlan(plan)}
                                    >
                                        <div className={styles.historyTop}>
                                            <strong>{plan.title || 'Saved diet plan'}</strong>
                                            <span>{new Date(plan.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                        </div>
                                        <p>{plan.generation_mode === 'regenerate' ? 'Regenerated from feedback' : 'Fresh generation'}</p>
                                        {plan.feedback && <span className={styles.historyTag}>Feedback: {plan.feedback}</span>}
                                    </button>
                                ))}
                            </div>
                        </section>
                    )}

                    {!loading && historyLoading && (
                        <div className={`glass-card ${styles.historyCard}`}>
                            <div className={styles.sectionTop}>
                                <div>
                                    <h2>Saved Plans</h2>
                                    <p>Loading stored diet plans...</p>
                                </div>
                                <Loader size={18} className={styles.spin} />
                            </div>
                        </div>
                    )}

                    {!loading && dietPlan && (
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

                                                            <div className={styles.mealMeta}>
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
                </section>
            </div>
        </div>
    );
}
