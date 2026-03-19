'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { DAILY_VALUES } from '@/lib/nutritionDB';
import {
    Target,
    RefreshCw,
    TrendingUp,
    Award,
    Utensils,
    ChevronDown,
    CalendarDays,
    Flame,
    Droplets,
    Zap,
    Leaf,
} from 'lucide-react';
import styles from './goals.module.css';

const supabase = createClient();

const MACRO_CONFIG = [
    { key: 'protein_g',  label: 'Protein',  unit: 'g',  icon: Zap,      color: 'blue'   },
    { key: 'carbs_g',    label: 'Carbs',    unit: 'g',  icon: Flame,     color: 'orange' },
    { key: 'fat_g',      label: 'Fat',      unit: 'g',  icon: Droplets,  color: 'purple' },
    { key: 'fiber_g',    label: 'Fiber',    unit: 'g',  icon: Leaf,      color: 'green'  },
];

const MICRO_CONFIG = [
    { key: 'vitamin_c_mg',   label: 'Vitamin C',   unit: 'mg'  },
    { key: 'calcium_mg',     label: 'Calcium',     unit: 'mg'  },
    { key: 'iron_mg',        label: 'Iron',        unit: 'mg'  },
    { key: 'potassium_mg',   label: 'Potassium',   unit: 'mg'  },
    { key: 'vitamin_d_mcg',  label: 'Vitamin D',   unit: 'mcg' },
    { key: 'vitamin_b12_mcg',label: 'Vitamin B12', unit: 'mcg' },
    { key: 'zinc_mg',        label: 'Zinc',        unit: 'mg'  },
    { key: 'magnesium_mg',   label: 'Magnesium',   unit: 'mg'  },
    { key: 'omega_3_mg',     label: 'Omega-3',     unit: 'mg'  },
    { key: 'folate_mcg',     label: 'Folate',      unit: 'mcg' },
];

function getMicroBarColor(pct) {
    if (pct >= 70 && pct <= 120) return 'green';
    if (pct >= 40 && pct < 70)   return 'yellow';
    if (pct > 120 && pct <= 150) return 'yellow';
    return 'red';
}

function getCalorieRingColor(pct) {
    if (pct > 100) return 'var(--accent-red)';
    if (pct >= 90)  return 'var(--accent-orange)';
    return 'var(--accent-green)';
}

function computeGrade(totals, calorieGoal) {
    const keys = ['protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'vitamin_c_mg', 'calcium_mg', 'iron_mg'];
    let score = 0;
    keys.forEach(k => {
        const goal = k === 'calories' ? calorieGoal : DAILY_VALUES[k];
        if (!goal) return;
        const pct = ((totals[k] || 0) / goal) * 100;
        if (pct >= 70 && pct <= 120) score += 2;
        else if (pct >= 40) score += 1;
    });
    const max = keys.length * 2;
    const ratio = score / max;
    if (ratio >= 0.85) return 'A';
    if (ratio >= 0.70) return 'B';
    if (ratio >= 0.50) return 'C';
    return 'D';
}

function getGradeColor(grade) {
    if (grade === 'A') return 'green';
    if (grade === 'B') return 'blue';
    if (grade === 'C') return 'yellow';
    return 'red';
}

function CalorieRing({ consumed, goal }) {
    const size = 200;
    const strokeWidth = 16;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const pct = goal > 0 ? Math.min((consumed / goal) * 100, 100) : 0;
    const offset = circumference - (pct / 100) * circumference;
    const ringColor = getCalorieRingColor(goal > 0 ? (consumed / goal) * 100 : 0);

    return (
        <div className={styles.ringWrapper}>
            <svg width={size} height={size} className={styles.ringSvg}>
                {/* Track */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="var(--border-glass)"
                    strokeWidth={strokeWidth}
                />
                {/* Progress */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={ringColor}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                    className={styles.ringProgress}
                />
            </svg>
            <div className={styles.ringCenter}>
                <span className={styles.ringConsumed} style={{ color: ringColor }}>
                    {Math.round(consumed).toLocaleString()}
                </span>
                <span className={styles.ringLabel}>of {Math.round(goal).toLocaleString()} kcal</span>
                <span className={styles.ringPct} style={{ color: ringColor }}>
                    {goal > 0 ? Math.round((consumed / goal) * 100) : 0}%
                </span>
            </div>
        </div>
    );
}

function ProgressBar({ value, max, colorClass }) {
    const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    return (
        <div className={styles.progressTrack}>
            <div
                className={`${styles.progressFill} ${styles[`fill_${colorClass}`]}`}
                style={{ width: `${pct}%` }}
            />
        </div>
    );
}

export default function GoalsPage() {
    const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [dateRange, setDateRange]         = useState('today');
    const [loading, setLoading]             = useState(true);
    const [nutritionTotals, setNutritionTotals] = useState({});
    const [items, setItems]                 = useState([]);
    const [profile, setProfile]             = useState(null);
    const [error, setError]                 = useState('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            // Load profile
            const { data: profileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();
            if (profileData) setProfile(profileData);

            // Determine date range
            const base = new Date(selectedDate);
            let startDate, endDate;
            if (dateRange === 'today') {
                startDate = endDate = selectedDate;
            } else if (dateRange === 'week') {
                const start = new Date(base);
                start.setDate(base.getDate() - base.getDay());
                const end   = new Date(start);
                end.setDate(start.getDate() + 6);
                startDate = start.toISOString().slice(0, 10);
                endDate   = end.toISOString().slice(0, 10);
            } else {
                startDate = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-01`;
                const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0);
                endDate = lastDay.toISOString().slice(0, 10);
            }

            // Fetch sessions
            const { data: sessions, error: sessErr } = await supabase
                .from('grocery_sessions')
                .select('id')
                .eq('user_id', user.id)
                .gte('session_date', startDate)
                .lte('session_date', endDate);
            if (sessErr) throw sessErr;

            if (!sessions || sessions.length === 0) {
                setNutritionTotals({});
                setItems([]);
                setLoading(false);
                return;
            }

            const sessionIds = sessions.map(s => s.id);

            // Fetch grocery_items + nutrition_data
            const { data: groceryItems, error: itemErr } = await supabase
                .from('grocery_items')
                .select(`
                    id, name, quantity, unit, price, category,
                    nutrition_data (
                        calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g,
                        sodium_mg, calcium_mg, iron_mg, potassium_mg,
                        vitamin_c_mg, vitamin_d_mcg, vitamin_b12_mcg,
                        vitamin_e_mg, zinc_mg, magnesium_mg, folate_mcg, omega_3_mg
                    )
                `)
                .in('session_id', sessionIds);
            if (itemErr) throw itemErr;

            // Aggregate
            const totals = {};
            const allNutritionKeys = [
                'calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sugar_g',
                'sodium_mg', 'calcium_mg', 'iron_mg', 'potassium_mg',
                'vitamin_c_mg', 'vitamin_d_mcg', 'vitamin_b12_mcg',
                'vitamin_e_mg', 'zinc_mg', 'magnesium_mg', 'folate_mcg', 'omega_3_mg',
            ];
            allNutritionKeys.forEach(k => { totals[k] = 0; });

            const enrichedItems = [];
            (groceryItems || []).forEach(item => {
                const nd = Array.isArray(item.nutrition_data)
                    ? item.nutrition_data[0]
                    : item.nutrition_data;
                if (nd) {
                    allNutritionKeys.forEach(k => {
                        totals[k] = (totals[k] || 0) + (nd[k] || 0);
                    });
                    enrichedItems.push({ ...item, nd });
                }
            });

            setNutritionTotals(totals);
            setItems(enrichedItems);
        } catch (err) {
            setError(err.message || 'Failed to load nutrition data');
        } finally {
            setLoading(false);
        }
    }, [selectedDate, dateRange]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const calorieGoal = profile?.daily_calorie_goal || DAILY_VALUES.calories;
    const grade       = computeGrade(nutritionTotals, calorieGoal);
    const gradeColor  = getGradeColor(grade);

    const caloriePct = calorieGoal > 0
        ? (nutritionTotals.calories || 0) / calorieGoal * 100
        : 0;

    function itemHealthColor(item) {
        const cal = item.nd?.calories || 0;
        const prot = item.nd?.protein_g || 0;
        const fiber = item.nd?.fiber_g || 0;
        if (prot > 10 || fiber > 3) return 'green';
        if (cal > 400) return 'red';
        return 'yellow';
    }

    return (
        <div className={`${styles.page} animate-fadeIn`}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.headerIcon}>
                        <Target size={22} />
                    </div>
                    <div>
                        <h1 className={styles.title}>Daily Nutrition Goals</h1>
                        <p className={styles.subtitle}>Track your intake vs daily targets</p>
                    </div>
                </div>
                <div className={styles.headerControls}>
                    <div className={styles.inputGroup}>
                        <CalendarDays size={16} className={styles.inputIcon} />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={e => setSelectedDate(e.target.value)}
                            className={styles.dateInput}
                        />
                    </div>
                    <div className={styles.selectWrapper}>
                        <select
                            value={dateRange}
                            onChange={e => setDateRange(e.target.value)}
                            className={styles.rangeSelect}
                        >
                            <option value="today">Today</option>
                            <option value="week">This Week</option>
                            <option value="month">This Month</option>
                        </select>
                        <ChevronDown size={14} className={styles.selectIcon} />
                    </div>
                    <button onClick={fetchData} className={styles.refreshBtn} title="Refresh">
                        <RefreshCw size={16} className={loading ? styles.spinning : ''} />
                    </button>
                    {/* Grade badge */}
                    <div className={`${styles.gradeBadge} ${styles[`grade_${gradeColor}`]}`}>
                        <Award size={14} />
                        <span>Grade {grade}</span>
                    </div>
                </div>
            </div>

            {error && <div className={styles.errorBanner}>{error}</div>}

            {loading ? (
                <div className={styles.loadingGrid}>
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className={`skeleton ${styles.skeletonCard}`} />
                    ))}
                </div>
            ) : (
                <>
                    {/* Calorie ring + macros */}
                    <div className={styles.topSection}>
                        {/* Ring */}
                        <div className={`glass-card ${styles.ringCard}`}>
                            <h2 className={styles.sectionTitle}>
                                <Flame size={18} />
                                Calories
                            </h2>
                            <CalorieRing
                                consumed={nutritionTotals.calories || 0}
                                goal={calorieGoal}
                            />
                            <p className={styles.ringStatus} style={{
                                color: caloriePct > 100
                                    ? 'var(--accent-red)'
                                    : caloriePct >= 90
                                        ? 'var(--accent-orange)'
                                        : 'var(--accent-green)',
                            }}>
                                {caloriePct > 100
                                    ? `${Math.round(caloriePct - 100)}% over goal`
                                    : `${Math.round(100 - caloriePct)}% remaining`}
                            </p>
                        </div>

                        {/* Macros */}
                        <div className={styles.macrosGrid}>
                            {MACRO_CONFIG.map(({ key, label, unit, icon: Icon, color }) => {
                                const val   = nutritionTotals[key] || 0;
                                const goal  = DAILY_VALUES[key] || 1;
                                const pct   = Math.min((val / goal) * 100, 100);
                                return (
                                    <div key={key} className={`glass-card ${styles.macroCard}`}>
                                        <div className={styles.macroHeader}>
                                            <div className={`${styles.macroIcon} ${styles[`macroIcon_${color}`]}`}>
                                                <Icon size={16} />
                                            </div>
                                            <span className={styles.macroLabel}>{label}</span>
                                        </div>
                                        <div className={styles.macroValues}>
                                            <span className={`${styles.macroVal} ${styles[`macroVal_${color}`]}`}>
                                                {Math.round(val)}{unit}
                                            </span>
                                            <span className={styles.macroGoal}>/ {goal}{unit}</span>
                                        </div>
                                        <ProgressBar value={val} max={goal} colorClass={color} />
                                        <span className={styles.macroPct}>{Math.round(pct)}%</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Micronutrients */}
                    <div className={`glass-card ${styles.microSection}`}>
                        <h2 className={styles.sectionTitle}>
                            <TrendingUp size={18} />
                            Micronutrients
                        </h2>
                        <div className={styles.microGrid}>
                            {MICRO_CONFIG.map(({ key, label, unit }) => {
                                const val  = nutritionTotals[key] || 0;
                                const goal = DAILY_VALUES[key] || 1;
                                const pct  = (val / goal) * 100;
                                const clamp = Math.min(pct, 100);
                                const barColor = getMicroBarColor(pct);
                                return (
                                    <div key={key} className={styles.microItem}>
                                        <div className={styles.microHeader}>
                                            <span className={styles.microLabel}>{label}</span>
                                            <div className={styles.microRight}>
                                                <span className={`${styles.microPct} ${styles[`microPct_${barColor}`]}`}>
                                                    {Math.round(pct)}%
                                                </span>
                                                <span className={styles.microVal}>
                                                    {val % 1 === 0 ? val : val.toFixed(1)}{unit}
                                                </span>
                                            </div>
                                        </div>
                                        <div className={styles.progressTrack}>
                                            <div
                                                className={`${styles.progressFill} ${styles[`fill_${barColor}`]}`}
                                                style={{ width: `${clamp}%` }}
                                            />
                                        </div>
                                        <span className={styles.microGoalText}>Goal: {goal}{unit}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Today's Foods */}
                    <div className={`glass-card ${styles.foodsSection}`}>
                        <h2 className={styles.sectionTitle}>
                            <Utensils size={18} />
                            Foods Logged ({items.length})
                        </h2>
                        {items.length === 0 ? (
                            <div className={styles.emptyState}>
                                <Utensils size={40} className={styles.emptyIcon} />
                                <p>No foods logged for this period.</p>
                                <p className={styles.emptyHint}>Add groceries to start tracking your nutrition.</p>
                            </div>
                        ) : (
                            <div className={styles.foodList}>
                                {items.map(item => {
                                    const dotColor = itemHealthColor(item);
                                    const cal = Math.round(item.nd?.calories || 0);
                                    const prot = item.nd?.protein_g || 0;
                                    const totalCal = nutritionTotals.calories || 1;
                                    const contribution = Math.round((cal / totalCal) * 100);
                                    return (
                                        <div key={item.id} className={styles.foodItem}>
                                            <div className={`${styles.healthDot} ${styles[`dot_${dotColor}`]}`} />
                                            <div className={styles.foodInfo}>
                                                <span className={styles.foodName}>{item.name}</span>
                                                {item.quantity && (
                                                    <span className={styles.foodQty}>
                                                        {item.quantity} {item.unit || ''}
                                                    </span>
                                                )}
                                            </div>
                                            <div className={styles.foodNutrition}>
                                                <span className={styles.foodCal}>{cal} kcal</span>
                                                <span className={styles.foodProt}>{prot.toFixed(1)}g protein</span>
                                                <div className={styles.foodContribBar}>
                                                    <div
                                                        className={styles.foodContribFill}
                                                        style={{ width: `${Math.min(contribution, 100)}%` }}
                                                    />
                                                </div>
                                                <span className={styles.foodContribPct}>{contribution}%</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
