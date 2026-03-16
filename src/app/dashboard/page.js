'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { NUTRIENT_INFO, DAILY_VALUES, lookupNutrition } from '@/lib/nutritionDB';
import { formatCurrency, getCurrencySymbol } from '@/lib/currency';
import Link from 'next/link';
import {
    TrendingUp,
    ShoppingCart,
    Flame,
    Zap,
    PlusCircle,
    Calendar,
    ArrowUpRight,
    Droplets,
    Heart,
    Apple,
    Brain,
    Loader,
    AlertTriangle,
    Target,
    Clock,
    ShieldCheck,
    Trash2,
    DollarSign,
    Leaf,
    Timer,
    Sparkles,
} from 'lucide-react';
import { Doughnut, Line, Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Tooltip,
    Legend,
    Filler,
} from 'chart.js';
import styles from './dashboard.module.css';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Tooltip,
    Legend,
    Filler
);

// Removed obsolete DEMO constants as data is now live from Supabase.

export default function DashboardPage() {
    const [sessions, setSessions] = useState([]);
    const [allSessions, setAllSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isDemo, setIsDemo] = useState(false);
    const [timeRange, setTimeRange] = useState('month'); // week, month, year, all

    const [householdCalorieTarget, setHouseholdCalorieTarget] = useState(2000);
    const [familySize, setFamilySize] = useState(1);
    const [currency, setCurrency] = useState('USD');

    const [aiInsights, setAiInsights] = useState({ week: null, month: null, year: null });
    const [insightsLoading, setInsightsLoading] = useState(false);
    const [insightsProgress, setInsightsProgress] = useState(0);
    const [insightsProgressText, setInsightsProgressText] = useState('');
    const [insightsPeriod, setInsightsPeriod] = useState('week');
    const [insightsError, setInsightsError] = useState('');
    const [aiProvider, setAiProvider] = useState('');
    const [insightsLoaded, setInsightsLoaded] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            // Check real auth first
            try {
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    localStorage.removeItem('foodlimit_demo');
                    
                    const [{ data: profData }, { data: famData }, { data: sessionData }] = await Promise.all([
                        supabase.from('profiles').select('daily_calorie_goal, currency_preference').eq('id', user.id).single(),
                        supabase.from('family_members').select('daily_calorie_goal').eq('user_id', user.id),
                        supabase.from('grocery_sessions')
                            .select('*, grocery_items(*, nutrition_data(*))')
                            .order('session_date', { ascending: false })
                    ]);

                    let totalGoal = profData?.daily_calorie_goal || 2000;
                    setCurrency(profData?.currency_preference || 'USD');
                    let fSize = 1;
                    if (famData && famData.length > 0) {
                        famData.forEach(m => totalGoal += parseInt(m.daily_calorie_goal || 0));
                        fSize += famData.length;
                    }
                    setHouseholdCalorieTarget(totalGoal);
                    setFamilySize(fSize);
                    
                    if (sessionData?.length) {
                        // Backfill missing nutrition_data from local DB
                        const itemsToBackfill = [];
                        sessionData.forEach(sess => {
                            (sess.grocery_items || []).forEach(item => {
                                const nd = Array.isArray(item.nutrition_data)
                                    ? (item.nutrition_data.length > 0 ? item.nutrition_data[0] : null)
                                    : item.nutrition_data;
                                if (!nd && item.name) {
                                    const localNut = lookupNutrition(item.name, (item.quantity || 1) * 150);
                                    if (localNut) {
                                        const { category, ...nutData } = localNut;
                                        itemsToBackfill.push({ item_id: item.id, ...nutData });
                                        // Patch in-memory so charts render immediately
                                        item.nutrition_data = nutData;
                                    }
                                }
                            });
                        });

                        // Persist backfilled nutrition to DB in background
                        if (itemsToBackfill.length > 0) {
                            console.log(`🔧 Backfilling nutrition_data for ${itemsToBackfill.length} items`);
                            supabase
                                .from('nutrition_data')
                                .upsert(itemsToBackfill, { onConflict: 'item_id' })
                                .then(({ error: bfErr }) => {
                                    if (bfErr) console.error('Backfill error:', bfErr);
                                    else console.log('✅ Nutrition backfill complete');
                                });
                        }

                        setAllSessions(sessionData);
                    } else {
                        setAllSessions([]);
                        setIsDemo(true);
                        setSessions([]); // Show empty states gracefully
                    }
                    setLoading(false);
                    return;
                }
            } catch {
                // Auth failed
            }
            setLoading(false);
        };
        loadData();
    }, []);

    // Filter sessions by time range whenever allSessions or timeRange changes
    useEffect(() => {
        if (!allSessions.length) {
            setSessions([]);
            return;
        }

        const now = new Date();
        const filtered = allSessions.filter(sess => {
            if (timeRange === 'all') return true;
            const sessDate = new Date(sess.session_date);
            const diffDays = (now - sessDate) / (1000 * 60 * 60 * 24);

            if (timeRange === 'week') return diffDays <= 7;
            if (timeRange === 'month') return diffDays <= 30;
            if (timeRange === 'year') {
                return sessDate.getFullYear() === now.getFullYear(); // YTD
            }
            return true;
        });
        setSessions(filtered);
    }, [allSessions, timeRange]);

    // Load cached AI insights from database
    useEffect(() => {
        const loadCachedInsights = async () => {
            try {
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                const { data: cachedInsights } = await supabase
                    .from('ai_insights_cache')
                    .select('*')
                    .eq('user_id', user.id);

                if (cachedInsights && cachedInsights.length > 0) {
                    const loadedInsights = { week: null, month: null, year: null };
                    cachedInsights.forEach(cache => {
                        loadedInsights[cache.period] = cache.insights;
                        if (cache.provider) setAiProvider(cache.provider);
                    });
                    setAiInsights(loadedInsights);
                    setInsightsLoaded(true);
                }
            } catch (error) {
                console.error('Failed to load cached insights:', error);
            }
        };
        loadCachedInsights();
    }, []);

    const fetchAiInsights = async (period, forceRefresh = false) => {
        setInsightsPeriod(period);

        // Don't refetch if we already have data for this period (unless forcing refresh)
        if (aiInsights[period] && !forceRefresh) {
            return;
        }

        setInsightsLoading(true);
        setInsightsError('');
        setInsightsProgress(10);
        setInsightsProgressText('Preparing your data...');

        // Simulate progress while waiting for AI
        const progressInterval = setInterval(() => {
            setInsightsProgress(prev => {
                if (prev >= 85) return 85;
                return prev + Math.random() * 12;
            });
        }, 800);

        try {
            setInsightsProgress(20);
            setInsightsProgressText('Sending to AI for analysis...');

            const response = await fetch('/api/ai-analytics', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessions, period, household_calorie_target: householdCalorieTarget, family_size: familySize }),
            });

            setInsightsProgress(70);
            setInsightsProgressText('Processing AI response...');

            const data = await response.json();
            if (data.data) {
                setInsightsProgress(90);
                setInsightsProgressText('Saving insights...');

                setAiInsights(prev => ({ ...prev, [period]: data.data }));
                setAiProvider(data.provider || '');

                // Save to database for persistence
                try {
                    const supabase = createClient();
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                        await supabase
                            .from('ai_insights_cache')
                            .upsert({
                                user_id: user.id,
                                period: period,
                                insights: data.data,
                                provider: data.provider || 'unknown',
                            }, { onConflict: 'user_id,period' });
                    }
                } catch (dbError) {
                    console.error('Failed to cache insights:', dbError);
                }

                setInsightsProgress(100);
                setInsightsProgressText('Done!');

                if (data.warning) {
                    setInsightsError(`⚡ Using fallback data (${data.provider || 'local'}). Add an AI API key for richer insights.`);
                }
            } else if (data.error) {
                setInsightsError(data.error);
            }
        } catch (e) {
            setInsightsError('Failed to load AI insights. Check your connection and try again.');
        } finally {
            clearInterval(progressInterval);
            setInsightsLoading(false);
            setInsightsProgress(0);
        }
    };

    const refreshInsights = async () => {
        // Clear current insights for the selected period and refetch
        setAiInsights(prev => ({ ...prev, [insightsPeriod]: null }));
        await fetchAiInsights(insightsPeriod, true);
    };

    const totalSpent = sessions.reduce((s, sess) => s + (sess.total_spent || 0), 0);
    const totalCalories = sessions.reduce((s, sess) => s + (sess.total_calories || 0), 0);
    const totalItems = sessions.reduce((s, sess) => s + (sess.total_items || 0), 0);
    const avgCalPerSession = sessions.length ? Math.round(totalCalories / sessions.length) : 0;

    // Aggregations
    const aggregatedMacros = { protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, salt: 0 };
    const aggregatedSpending = {};
    const storeAnalytics = {};
    const foodAnalytics = {};
    
    const aggregatedMicroScores = {
        vitamin_c_mg: 0, calcium_mg: 0, iron_mg: 0, potassium_mg: 0,
        vitamin_a_mcg: 0, vitamin_d_mcg: 0, vitamin_b12_mcg: 0,
        vitamin_e_mg: 0, vitamin_k_mcg: 0,
        zinc_mg: 0, magnesium_mg: 0, folate_mcg: 0, omega_3_mg: 0,
    };
    let itemsWithNutrition = 0;
    let itemsWithoutNutrition = 0;
    
    // Group calories by day for trend (last 7 days regardless of filter, or align with filter if possible. We'll stick to a simple 7-point array for demo structure).
    const weeklyCals = new Array(7).fill(0);

    sessions.forEach(sess => {
        // Simple day binning for the last 7 days chart
        const sessDate = new Date(sess.session_date);
        const dayDiff = Math.floor((new Date() - sessDate) / (1000 * 60 * 60 * 24));
        if (dayDiff >= 0 && dayDiff < 7) {
            weeklyCals[6 - dayDiff] += (sess.total_calories || 0);
        }

        const store = sess.store_name || 'Unknown Store';
        if (!storeAnalytics[store]) {
            storeAnalytics[store] = { spent: 0, trips: 0, categories: {} };
        }
        storeAnalytics[store].spent += (sess.total_spent || 0);
        storeAnalytics[store].trips += 1;

        (sess.grocery_items || []).forEach(item => {
            // Spending
            const cat = item.category || 'Other';
            aggregatedSpending[cat] = (aggregatedSpending[cat] || 0) + (item.price || 0);
            storeAnalytics[store].categories[cat] = (storeAnalytics[store].categories[cat] || 0) + 1;

            // Food Analytics
            const foodName = item.name || 'Unknown Item';
            if (!foodAnalytics[foodName]) {
                foodAnalytics[foodName] = { spent: 0, count: 0, category: cat };
            }
            foodAnalytics[foodName].spent += (item.price || 0);
            foodAnalytics[foodName].count += 1;

            // Nutrition — Supabase returns a single object (not array) for unique FK joins
            const nut = Array.isArray(item.nutrition_data)
                ? (item.nutrition_data.length > 0 ? item.nutrition_data[0] : null)
                : (item.nutrition_data || null);
            if (nut) {
                itemsWithNutrition++;
                aggregatedMacros.protein += (nut.protein_g || 0);
                aggregatedMacros.carbs += (nut.carbs_g || 0);
                aggregatedMacros.fat += (nut.fat_g || 0);
                aggregatedMacros.fiber += (nut.fiber_g || 0);
                aggregatedMacros.sugar += (nut.sugar_g || 0);
                aggregatedMacros.salt += ((nut.sodium_mg || 0) * 2.5 / 1000); // NaCl = Na × 2.5

                Object.keys(aggregatedMicroScores).forEach(key => {
                    if (nut[key]) {
                        aggregatedMicroScores[key] += (nut[key] || 0);
                    }
                });
            } else {
                itemsWithoutNutrition++;
            }
        });
    });

    // Normalize scores and macros to get Daily Average
    // Use actual unique shopping days (not calendar days) for more accurate averages
    const uniqueShoppingDays = new Set(sessions.map(s => s.session_date?.split('T')[0])).size;
    // Estimate consumption days: groceries from N shopping trips typically last ~3-5 days each
    // Use the actual date range spanned by sessions, with a minimum of the unique days count
    let daysInPeriod;
    if (sessions.length >= 2) {
        const dates = sessions.map(s => new Date(s.session_date)).sort((a, b) => a - b);
        const daySpan = Math.max(1, Math.ceil((dates[dates.length - 1] - dates[0]) / (1000 * 60 * 60 * 24)));
        daysInPeriod = Math.max(daySpan, uniqueShoppingDays);
    } else {
        // Single session: assume groceries cover ~5 days of meals
        daysInPeriod = Math.max(1, uniqueShoppingDays * 5);
    }
    // Scale by family size for per-person values
    const householdDivisor = daysInPeriod * familySize;

    // Normalize macros to daily per-person average
    Object.keys(aggregatedMacros).forEach(key => {
        aggregatedMacros[key] = (aggregatedMacros[key] / householdDivisor) || 0;
    });

    Object.keys(aggregatedMicroScores).forEach(key => {
        const dv = DAILY_VALUES?.[key];
        if (!dv) {
            aggregatedMicroScores[key] = 0;
            return;
        }
        const avgDailyIntake = aggregatedMicroScores[key] / householdDivisor;
        aggregatedMicroScores[key] = Math.min(150, Math.round((avgDailyIntake / dv) * 100)) || 0;
    });

    // Formatting Store Array
    const sortedStores = Object.entries(storeAnalytics)
        .map(([name, data]) => {
            const topCategory = Object.keys(data.categories).reduce((a, b) => data.categories[a] > data.categories[b] ? a : b, '');
            return { name, ...data, topCategory };
        })
        .sort((a, b) => b.spent - a.spent);

    // Formatting Food Array
    const sortedFoods = Object.entries(foodAnalytics)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10); // Display top 10 most frequent foods

    // Use AI macro data when available, fall back to local aggregation
    const currentInsights = aiInsights[insightsPeriod];
    const aiMacro = currentInsights?.macro_breakdown;
    const aiMicro = currentInsights?.micronutrient_coverage;

    const displayMacros = {
        protein: aiMacro?.daily_avg_protein_g ?? aggregatedMacros.protein,
        carbs: aiMacro?.daily_avg_carbs_g ?? aggregatedMacros.carbs,
        fat: aiMacro?.daily_avg_fat_g ?? aggregatedMacros.fat,
        fiber: aiMacro?.daily_avg_fiber_g ?? aggregatedMacros.fiber,
        sugar: aiMacro?.daily_avg_sugar_g ?? aggregatedMacros.sugar,
        salt: aiMacro?.daily_avg_salt_g ?? aggregatedMacros.salt,
    };

    const displayMicro = aiMicro ? {
        vitamin_c_mg: aiMicro.vitamin_c_mg ?? aggregatedMicroScores.vitamin_c_mg,
        calcium_mg: aiMicro.calcium_mg ?? aggregatedMicroScores.calcium_mg,
        iron_mg: aiMicro.iron_mg ?? aggregatedMicroScores.iron_mg,
        potassium_mg: aiMicro.potassium_mg ?? aggregatedMicroScores.potassium_mg,
        vitamin_a_mcg: aiMicro.vitamin_a_mcg ?? aggregatedMicroScores.vitamin_a_mcg,
        vitamin_d_mcg: aiMicro.vitamin_d_mcg ?? aggregatedMicroScores.vitamin_d_mcg,
        vitamin_b12_mcg: aiMicro.vitamin_b12_mcg ?? aggregatedMicroScores.vitamin_b12_mcg,
        vitamin_e_mg: aiMicro.vitamin_e_mg ?? aggregatedMicroScores.vitamin_e_mg,
        vitamin_k_mcg: aiMicro.vitamin_k_mcg ?? aggregatedMicroScores.vitamin_k_mcg,
        zinc_mg: aiMicro.zinc_mg ?? aggregatedMicroScores.zinc_mg,
        magnesium_mg: aiMicro.magnesium_mg ?? aggregatedMicroScores.magnesium_mg,
        folate_mcg: aiMicro.folate_mcg ?? aggregatedMicroScores.folate_mcg,
        omega_3_mg: aiMicro.omega_3_mg ?? aggregatedMicroScores.omega_3_mg,
        fiber_g: aiMicro.fiber_g ?? Math.min(150, Math.round((aggregatedMacros.fiber / (DAILY_VALUES?.fiber_g || 25)) * 100)),
    } : {
        ...aggregatedMicroScores,
        fiber_g: Math.min(150, Math.round(((aggregatedMacros.fiber) / (DAILY_VALUES?.fiber_g || 25)) * 100)),
    };

    const isAiEnhanced = !!aiMacro;

    // Chart configurations
    const macroData = {
        labels: ['Protein', 'Carbs', 'Fat', 'Fiber', 'Sugar', 'Salt'],
        datasets: [{
            data: [
                Math.round(displayMacros.protein),
                Math.round(displayMacros.carbs),
                Math.round(displayMacros.fat),
                Math.round(displayMacros.fiber),
                Math.round(displayMacros.sugar),
                Math.round(displayMacros.salt * 10) // *10 just for visual balance on doughnut
            ],
            backgroundColor: ['#4d8dff', '#fbbf24', '#ff6b9d', '#00d4aa', '#f472b6', '#fb923c'],
            borderColor: ['rgba(77,141,255,0.3)', 'rgba(251,191,36,0.3)', 'rgba(255,107,157,0.3)', 'rgba(0,212,170,0.3)', 'rgba(244,114,182,0.3)', 'rgba(251,146,60,0.3)'],
            borderWidth: 2,
            hoverOffset: 8,
        }],
    };

    const calorieTrendData = {
        labels: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7 (Today)'],
        datasets: [{
            label: 'Calories',
            data: weeklyCals,
            fill: true,
            backgroundColor: 'rgba(0, 212, 170, 0.1)',
            borderColor: '#00d4aa',
            borderWidth: 2,
            pointBackgroundColor: '#00d4aa',
            pointBorderColor: '#1a1a2e',
            pointBorderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 8,
            tension: 0.4,
        }],
    };

    const spendingData = {
        labels: Object.keys(aggregatedSpending).length ? Object.keys(aggregatedSpending) : ['No Data'],
        datasets: [{
            label: `Spending (${getCurrencySymbol(currency)})`,
            data: Object.keys(aggregatedSpending).length ? Object.values(aggregatedSpending) : [0],
            backgroundColor: [
                'rgba(0, 212, 170, 0.7)',
                'rgba(77, 141, 255, 0.7)',
                'rgba(251, 191, 36, 0.7)',
                'rgba(168, 85, 247, 0.7)',
                'rgba(255, 107, 157, 0.7)',
            ],
            borderRadius: 8,
            borderSkipped: false,
        }],
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false,
            },
            tooltip: {
                backgroundColor: 'rgba(18, 18, 26, 0.95)',
                titleColor: '#f0f0f5',
                bodyColor: '#a0a0b8',
                borderColor: 'rgba(255,255,255,0.1)',
                borderWidth: 1,
                cornerRadius: 12,
                padding: 12,
            },
        },
        scales: {
            x: {
                grid: { color: 'rgba(255,255,255,0.04)' },
                ticks: { color: '#6b6b80', font: { size: 11 } },
            },
            y: {
                grid: { color: 'rgba(255,255,255,0.04)' },
                ticks: { color: '#6b6b80', font: { size: 11 } },
            },
        },
    };

    const doughnutOptions = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    color: '#a0a0b8',
                    padding: 16,
                    usePointStyle: true,
                    pointStyleWidth: 10,
                    font: { size: 12 },
                },
            },
            tooltip: {
                backgroundColor: 'rgba(18, 18, 26, 0.95)',
                titleColor: '#f0f0f5',
                bodyColor: '#a0a0b8',
                borderColor: 'rgba(255,255,255,0.1)',
                borderWidth: 1,
                cornerRadius: 12,
                padding: 12,
            },
        },
    };

    if (loading) {
        return (
            <div className={styles.dashboard}>
                {/* Skeleton Welcome */}
                <div className={styles.welcomeSection}>
                    <div>
                        <div className="skeleton" style={{ width: 220, height: 28, marginBottom: 8 }} />
                        <div className="skeleton" style={{ width: 300, height: 16 }} />
                    </div>
                </div>
                {/* Skeleton Stats */}
                <div className={styles.statGrid}>
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className={styles.statCard}>
                            <div className="skeleton" style={{ width: 44, height: 44, borderRadius: 12 }} />
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <div className="skeleton" style={{ width: 80, height: 12 }} />
                                <div className="skeleton" style={{ width: 100, height: 24 }} />
                            </div>
                        </div>
                    ))}
                </div>
                {/* Skeleton Charts */}
                <div className={styles.chartsGrid}>
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className={styles.chartCard}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                                <div className="skeleton" style={{ width: 140, height: 18 }} />
                                <div className="skeleton" style={{ width: 70, height: 22, borderRadius: 99 }} />
                            </div>
                            <div className="skeleton" style={{ width: '100%', height: 180 }} />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className={styles.dashboard}>
            {/* Welcome Section */}
            <div className={styles.welcomeSection}>
                <div>
                    <h1 className={styles.welcomeTitle}>Nutrition Overview</h1>
                    <p className={styles.welcomeSubtitle}>
                        Your food shopping intelligence at a glance
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <select 
                        className="input-field" 
                        style={{ width: 'auto', padding: '8px 16px', borderRadius: '99px', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
                        value={timeRange}
                        onChange={(e) => setTimeRange(e.target.value)}
                    >
                        <option value="week">Past Week</option>
                        <option value="month">Past Month</option>
                        <option value="year">Year to Date (YTD)</option>
                        <option value="all">All Time</option>
                    </select>
                    <Link href="/dashboard/add" className="btn-primary">
                        <PlusCircle size={18} />
                        Add Groceries
                    </Link>
                </div>
            </div>

            {/* Empty State */}
            {!loading && allSessions.length === 0 && (
                <div className={styles.emptyState} style={{ gridColumn: '1 / -1', margin: '40px 0', border: '1px dashed var(--border-color)', background: 'transparent' }}>
                    <Droplets size={48} className={styles.emptyIcon} />
                    <h4>No shopping trips yet</h4>
                    <p>Add your first grocery session to start tracking!</p>
                </div>
            )}

            {/* Stat Cards */}
            <div className={styles.statGrid}>
                <div className={`${styles.statCard} animate-fadeInUp stagger-1`}>
                    <div className={styles.statIcon} style={{ background: 'var(--accent-green-dim)', color: 'var(--accent-green)' }}>
                        <ShoppingCart size={22} />
                    </div>
                    <div className={styles.statInfo}>
                        <span className={styles.statLabel}>Total Spent</span>
                        <span className={styles.statValue}>{formatCurrency(totalSpent, currency)}</span>
                    </div>
                    <div className={styles.statTrend} style={{ color: 'var(--accent-green)' }}>
                        <ArrowUpRight size={14} />
                        <span>12%</span>
                    </div>
                </div>

                <div className={`${styles.statCard} animate-fadeInUp stagger-2`}>
                    <div className={styles.statIcon} style={{ background: 'var(--accent-orange-dim)', color: 'var(--accent-orange)' }}>
                        <Flame size={22} />
                    </div>
                    <div className={styles.statInfo}>
                        <span className={styles.statLabel}>Avg Calories</span>
                        <span className={styles.statValue}>{avgCalPerSession.toLocaleString()}</span>
                    </div>
                    <div className={styles.statTrend} style={{ color: 'var(--accent-orange)' }}>
                        <TrendingUp size={14} />
                        <span>per trip</span>
                    </div>
                </div>

                <div className={`${styles.statCard} animate-fadeInUp stagger-3`}>
                    <div className={styles.statIcon} style={{ background: 'var(--accent-blue-dim)', color: 'var(--accent-blue)' }}>
                        <Zap size={22} />
                    </div>
                    <div className={styles.statInfo}>
                        <span className={styles.statLabel}>Total Items</span>
                        <span className={styles.statValue}>{totalItems}</span>
                    </div>
                    <div className={styles.statTrend} style={{ color: 'var(--accent-blue)' }}>
                        <span>{sessions.length} trips</span>
                    </div>
                </div>

                <div className={`${styles.statCard} animate-fadeInUp stagger-4`}>
                    <div className={styles.statIcon} style={{ background: 'var(--accent-pink-dim)', color: 'var(--accent-pink)' }}>
                        <Heart size={22} />
                    </div>
                    <div className={styles.statInfo}>
                        <span className={styles.statLabel}>Health Score</span>
                        <span className={styles.statValue}>78<span style={{ fontSize: '0.6em', color: 'var(--text-secondary)' }}>/100</span></span>
                    </div>
                    <div className={styles.statTrend} style={{ color: 'var(--accent-pink)' }}>
                        <TrendingUp size={14} />
                        <span>Good</span>
                    </div>
                </div>
            </div>

            {/* Charts Grid */}
            <div className={styles.chartsGrid}>
                {/* Calorie Trend */}
                <div className={`${styles.chartCard} animate-fadeInUp stagger-2`}>
                    <div className={styles.chartHeader}>
                        <h3>Calorie Trend</h3>
                        <span className={styles.chartBadge}>This Week</span>
                    </div>
                    <div className={styles.chartBody}>
                        <Line data={calorieTrendData} options={chartOptions} />
                    </div>
                </div>

                {/* Macro Split + Breakdown */}
                <div className={`${styles.chartCard} animate-fadeInUp stagger-3`}>
                    <div className={styles.chartHeader}>
                        <h3>Macro Breakdown</h3>
                        <span className={styles.chartBadge}>{isAiEnhanced ? 'AI-Enhanced' : 'Daily Avg'}</span>
                    </div>
                    {isAiEnhanced && aiMacro?.estimation_note && (
                        <p style={{ fontSize: '0.75rem', color: 'var(--accent-green)', margin: '0 0 var(--space-sm) 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Sparkles size={12} /> {aiMacro.estimation_note}
                        </p>
                    )}
                    {!isAiEnhanced && itemsWithoutNutrition > 0 && (
                        <p style={{ fontSize: '0.75rem', color: 'var(--accent-yellow)', margin: '0 0 var(--space-sm) 0' }}>
                            {itemsWithoutNutrition} item(s) missing nutrition data — generate AI Insights for accurate results
                        </p>
                    )}
                    <div className={styles.macroLayout}>
                        <div className={styles.chartBodyDoughnut}>
                            <Doughnut data={macroData} options={doughnutOptions} />
                        </div>
                        <div className={styles.macroBreakdown}>
                            {[
                                { label: 'Protein', value: Math.round(displayMacros.protein), max: 150, color: '#4d8dff', unit: 'g' },
                                { label: 'Carbs', value: Math.round(displayMacros.carbs), max: 300, color: '#fbbf24', unit: 'g' },
                                { label: 'Fat', value: Math.round(displayMacros.fat), max: 70, color: '#ff6b9d', unit: 'g' },
                                { label: 'Fiber', value: Math.round(displayMacros.fiber), max: 25, color: '#00d4aa', unit: 'g' },
                                { label: 'Sugar', value: Math.round(displayMacros.sugar), max: 50, color: '#f472b6', unit: 'g' },
                                { label: 'Salt', value: Math.round(displayMacros.salt * 10) / 10, max: 6, color: '#fb923c', unit: 'g' },
                            ].map(macro => (
                                <div key={macro.label} className={styles.macroStatRow}>
                                    <div className={styles.macroStatHeader}>
                                        <span className={styles.macroStatLabel}>{macro.label}</span>
                                        <span className={styles.macroStatValue} style={{ color: macro.color }}>
                                            {macro.value}{macro.unit}
                                            <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginLeft: 4 }}>/ {macro.max}{macro.unit}</span>
                                        </span>
                                    </div>
                                    <div className={styles.macroBarBg}>
                                        <div className={styles.macroBarFill} style={{
                                            width: `${Math.min((macro.value / (macro.max || 1)) * 100, 100)}%`,
                                            background: macro.color,
                                        }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Spending by Category */}
                <div className={`${styles.chartCard} animate-fadeInUp stagger-4`}>
                    <div className={styles.chartHeader}>
                        <h3>Spending by Category</h3>
                        <span className={styles.chartBadge}>Last 30 Days</span>
                    </div>
                    <div className={styles.chartBody}>
                        <Bar data={spendingData} options={chartOptions} />
                    </div>
                </div>

                {/* Micronutrient Scores */}
                <div className={`${styles.chartCard} animate-fadeInUp stagger-5`}>
                    <div className={styles.chartHeader}>
                        <h3>Micronutrient Coverage</h3>
                        <span className={styles.chartBadge}>{isAiEnhanced ? 'AI-Enhanced % DV' : '% Daily Value'}</span>
                    </div>
                    {!isAiEnhanced && itemsWithoutNutrition > 0 && (
                        <p style={{ fontSize: '0.75rem', color: 'var(--accent-yellow)', margin: '0 0 var(--space-sm) 0' }}>
                            {itemsWithoutNutrition} item(s) missing data — values may be underestimated
                        </p>
                    )}
                    <div className={styles.microGrid}>
                        {Object.entries(displayMicro)
                            .sort(([, a], [, b]) => b - a) // Sort by coverage descending
                            .map(([key, value]) => (
                            <div key={key} className={styles.microItem}>
                                <div className={styles.microInfo}>
                                    <span className={styles.microName}>
                                        {NUTRIENT_INFO[key]?.name || key.replace('_mg', '').replace('_mcg', '').replace('_g', '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                    </span>
                                    <span className={styles.microValue} style={{
                                        color: value >= 80 ? 'var(--accent-green)' : value >= 50 ? 'var(--accent-yellow)' : 'var(--accent-red)',
                                    }}>{value}%</span>
                                </div>
                                <div className={styles.microBarBg}>
                                    <div
                                        className={styles.microBarFill}
                                        style={{
                                            width: `${Math.min(value, 100)}%`,
                                            background: value >= 80 ? 'var(--accent-green)' : value >= 50 ? 'var(--accent-yellow)' : 'var(--accent-red)',
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Deep Dive Analysis Grid (Store & Food) */}
            <div className={styles.chartsGrid} style={{ marginTop: 'var(--space-xl)' }}>
                {/* Store Analytics */}
                <div className={`${styles.chartCard} animate-fadeInUp stagger-5`} style={{ overflowX: 'auto' }}>
                    <div className={styles.chartHeader} style={{ marginBottom: 'var(--space-md)' }}>
                        <h3>🏬 Store Analytics</h3>
                        <span className={styles.chartBadge}>By Spend</span>
                    </div>
                    {sortedStores.length > 0 ? (
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                                    <th style={{ padding: '12px 0', fontWeight: '500' }}>Store</th>
                                    <th style={{ padding: '12px 0', fontWeight: '500' }}>Trips</th>
                                    <th style={{ padding: '12px 0', fontWeight: '500' }}>Top Category</th>
                                    <th style={{ padding: '12px 0', fontWeight: '500', textAlign: 'right' }}>Total Spent</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedStores.map(store => (
                                    <tr key={store.name} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                        <td style={{ padding: '12px 0', fontWeight: '600', color: 'var(--text-primary)' }}>{store.name}</td>
                                        <td style={{ padding: '12px 0', color: 'var(--text-secondary)' }}>{store.trips}</td>
                                        <td style={{ padding: '12px 0' }}>
                                            <span style={{ fontSize: '0.75rem', padding: '4px 8px', borderRadius: '4px', background: 'var(--bg-card-hover)', color: 'var(--text-secondary)' }}>
                                                {store.topCategory}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px 0', textAlign: 'right', color: 'var(--accent-green)', fontWeight: '600' }}>{formatCurrency(store.spent, currency)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', padding: 'var(--space-lg) 0' }}>No store data available</p>
                    )}
                </div>

                {/* Food Analytics */}
                <div className={`${styles.chartCard} animate-fadeInUp stagger-6`} style={{ overflowX: 'auto' }}>
                    <div className={styles.chartHeader} style={{ marginBottom: 'var(--space-md)' }}>
                        <h3>🍎 Most Frequent Items</h3>
                        <span className={styles.chartBadge}>Top 10</span>
                    </div>
                    {sortedFoods.length > 0 ? (
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                                    <th style={{ padding: '12px 0', fontWeight: '500' }}>Item</th>
                                    <th style={{ padding: '12px 0', fontWeight: '500' }}>Frequency</th>
                                    <th style={{ padding: '12px 0', fontWeight: '500', textAlign: 'right' }}>Total Spent</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedFoods.map(food => (
                                    <tr key={food.name} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                        <td style={{ padding: '12px 0', fontWeight: '500', color: 'var(--text-primary)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-blue)' }}></div>
                                                {food.name}
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px 0', color: 'var(--text-secondary)' }}>{food.count}x</td>
                                        <td style={{ padding: '12px 0', textAlign: 'right', color: 'var(--accent-green)', fontWeight: '600' }}>{formatCurrency(food.spent, currency)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', padding: 'var(--space-lg) 0' }}>No food item data available</p>
                    )}
                </div>
            </div>

            {/* Budget Predictions & Alerts */}
            {sessions.length > 0 && (() => {
                const spendByWeek = {};
                sessions.forEach(sess => {
                    const d = new Date(sess.session_date);
                    const weekKey = `${d.getFullYear()}-W${Math.ceil(((d - new Date(d.getFullYear(), 0, 1)) / 86400000 + 1) / 7)}`;
                    spendByWeek[weekKey] = (spendByWeek[weekKey] || 0) + (sess.total_spent || 0);
                });
                const weeklySpends = Object.values(spendByWeek);
                const avgWeekly = weeklySpends.length ? weeklySpends.reduce((a, b) => a + b, 0) / weeklySpends.length : 0;
                const projectedMonthly = avgWeekly * 4.33;
                const lastWeekSpend = weeklySpends[weeklySpends.length - 1] || 0;
                const trend = avgWeekly > 0 ? ((lastWeekSpend - avgWeekly) / avgWeekly * 100).toFixed(0) : 0;
                const costPerCalorie = totalCalories > 0 ? (totalSpent / totalCalories).toFixed(3) : 0;
                const costPerItem = totalItems > 0 ? (totalSpent / totalItems).toFixed(2) : 0;

                return (
                    <div className={`${styles.chartCard} animate-fadeInUp stagger-5`} style={{ marginBottom: 'var(--space-xl)' }}>
                        <div className={styles.chartHeader}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <DollarSign size={20} style={{ color: 'var(--accent-yellow)' }} /> Budget Predictions
                            </h3>
                            <span className={styles.chartBadge}>Auto-calculated</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-md)' }}>
                            <div style={{ padding: 'var(--space-md)', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--accent-green)' }}>{formatCurrency(avgWeekly, currency)}</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Avg Weekly</div>
                            </div>
                            <div style={{ padding: 'var(--space-md)', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--accent-blue)' }}>{formatCurrency(projectedMonthly, currency)}</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Projected Monthly</div>
                            </div>
                            <div style={{ padding: 'var(--space-md)', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: Number(trend) > 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                                    {Number(trend) > 0 ? '+' : ''}{trend}%
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>vs Average</div>
                            </div>
                            <div style={{ padding: 'var(--space-md)', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--accent-purple)' }}>{formatCurrency(Number(costPerItem), currency)}</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Avg per Item</div>
                            </div>
                        </div>
                        {Number(trend) > 20 && (
                            <div style={{ marginTop: 'var(--space-md)', padding: '10px 14px', background: 'var(--accent-red-dim)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--accent-red)' }}>
                                <AlertTriangle size={16} /> Spending is {trend}% above your average. Consider reviewing your cart.
                            </div>
                        )}
                        <div style={{ marginTop: 'var(--space-sm)', fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                            Cost efficiency: {formatCurrency(Number(costPerCalorie), currency)}/calorie
                        </div>
                    </div>
                );
            })()}

            {/* Carbon Footprint Estimate + Expiry Alerts */}
            <div className={styles.chartsGrid} style={{ marginBottom: 'var(--space-xl)' }}>
                {/* Carbon Footprint */}
                <div className={`${styles.chartCard} animate-fadeInUp stagger-5`}>
                    <div className={styles.chartHeader}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Leaf size={18} style={{ color: 'var(--accent-green)' }} /> Carbon Footprint
                        </h3>
                        <span className={styles.chartBadge}>Estimate</span>
                    </div>
                    {(() => {
                        const carbonFactors = {
                            'Protein': 7.0, 'Dairy': 3.5, 'Grains': 1.2, 'Vegetables': 0.5,
                            'Fruits': 0.6, 'Legumes': 0.8, 'Oils': 2.0, 'Snacks': 2.5,
                            'Beverages': 1.0, 'Spices': 0.3, 'Other': 1.5,
                        };
                        const categoryWeights = {};
                        let totalCarbon = 0;

                        sessions.forEach(sess => {
                            (sess.grocery_items || []).forEach(item => {
                                const cat = item.category || 'Other';
                                const qty = item.quantity || 1;
                                const factor = carbonFactors[cat] || 1.5;
                                const co2 = qty * factor * 0.1;
                                totalCarbon += co2;
                                categoryWeights[cat] = (categoryWeights[cat] || 0) + co2;
                            });
                        });

                        const sortedCats = Object.entries(categoryWeights).sort((a, b) => b[1] - a[1]);
                        const maxCarbon = sortedCats.length ? sortedCats[0][1] : 1;
                        const ecoScore = Math.max(0, Math.min(100, Math.round(100 - (totalCarbon * 2))));

                        return (
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                                    <div>
                                        <div style={{ fontSize: '1.8rem', fontWeight: 800, color: ecoScore >= 60 ? 'var(--accent-green)' : ecoScore >= 30 ? 'var(--accent-yellow)' : 'var(--accent-red)' }}>
                                            {totalCarbon.toFixed(1)} kg
                                        </div>
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>Est. CO2 emissions</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: ecoScore >= 60 ? 'var(--accent-green)' : ecoScore >= 30 ? 'var(--accent-yellow)' : 'var(--accent-red)' }}>
                                            {ecoScore}/100
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>Eco Score</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {sortedCats.slice(0, 5).map(([cat, val]) => (
                                        <div key={cat}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 3 }}>
                                                <span style={{ color: 'var(--text-secondary)' }}>{cat}</span>
                                                <span style={{ color: 'var(--text-tertiary)' }}>{val.toFixed(1)} kg</span>
                                            </div>
                                            <div style={{ height: 4, background: 'var(--bg-glass)', borderRadius: 99, overflow: 'hidden' }}>
                                                <div style={{ height: '100%', width: `${(val / maxCarbon) * 100}%`, background: val / maxCarbon > 0.7 ? 'var(--accent-red)' : 'var(--accent-green)', borderRadius: 99, transition: 'width 1s ease' }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {totalCarbon > 0 && (
                                    <p style={{ marginTop: 'var(--space-sm)', fontSize: '0.78rem', color: 'var(--accent-green)' }}>
                                        💡 Tip: Replace some meat with legumes to reduce your carbon footprint by up to 40%.
                                    </p>
                                )}
                            </div>
                        );
                    })()}
                </div>

                {/* Expiry Alerts */}
                <div className={`${styles.chartCard} animate-fadeInUp stagger-6`}>
                    <div className={styles.chartHeader}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Timer size={18} style={{ color: 'var(--accent-orange)' }} /> Expiry Tracker
                        </h3>
                        <span className={styles.chartBadge}>Estimated</span>
                    </div>
                    {(() => {
                        const shelfLife = {
                            'Fruits': 5, 'Vegetables': 7, 'Dairy': 10, 'Protein': 3,
                            'Grains': 90, 'Legumes': 180, 'Oils': 365, 'Snacks': 60,
                            'Beverages': 30, 'Spices': 365, 'Other': 14,
                        };

                        const recentItems = [];
                        const now = new Date();
                        sessions.slice(0, 3).forEach(sess => {
                            const purchaseDate = new Date(sess.session_date);
                            (sess.grocery_items || []).forEach(item => {
                                const cat = item.category || 'Other';
                                const daysLeft = shelfLife[cat] || 14;
                                const expiryDate = new Date(purchaseDate.getTime() + daysLeft * 86400000);
                                const remaining = Math.ceil((expiryDate - now) / 86400000);
                                recentItems.push({ name: item.name, category: cat, remaining, daysLeft });
                            });
                        });

                        const sorted = recentItems.sort((a, b) => a.remaining - b.remaining);
                        const expiringSoon = sorted.filter(i => i.remaining <= 3 && i.remaining >= 0);
                        const expired = sorted.filter(i => i.remaining < 0);
                        const safe = sorted.filter(i => i.remaining > 3);

                        return (
                            <div>
                                <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
                                    <div style={{ flex: 1, padding: 10, background: 'var(--accent-red-dim)', borderRadius: 8, textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-red)' }}>{expired.length}</div>
                                        <div style={{ fontSize: '0.68rem', color: 'var(--accent-red)' }}>Likely Expired</div>
                                    </div>
                                    <div style={{ flex: 1, padding: 10, background: 'var(--accent-orange-dim)', borderRadius: 8, textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-orange)' }}>{expiringSoon.length}</div>
                                        <div style={{ fontSize: '0.68rem', color: 'var(--accent-orange)' }}>Use Soon</div>
                                    </div>
                                    <div style={{ flex: 1, padding: 10, background: 'var(--accent-green-dim)', borderRadius: 8, textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-green)' }}>{safe.length}</div>
                                        <div style={{ fontSize: '0.68rem', color: 'var(--accent-green)' }}>Fresh</div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                                    {sorted.slice(0, 10).map((item, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-glass)', borderRadius: 8, borderLeft: `3px solid ${item.remaining < 0 ? 'var(--accent-red)' : item.remaining <= 3 ? 'var(--accent-orange)' : 'var(--accent-green)'}` }}>
                                            <div>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{item.name}</div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>{item.category}</div>
                                            </div>
                                            <span style={{
                                                fontSize: '0.75rem', fontWeight: 600, padding: '3px 8px', borderRadius: 99,
                                                background: item.remaining < 0 ? 'var(--accent-red-dim)' : item.remaining <= 3 ? 'var(--accent-orange-dim)' : 'var(--accent-green-dim)',
                                                color: item.remaining < 0 ? 'var(--accent-red)' : item.remaining <= 3 ? 'var(--accent-orange)' : 'var(--accent-green)',
                                            }}>
                                                {item.remaining < 0 ? `${Math.abs(item.remaining)}d ago` : item.remaining === 0 ? 'Today' : `${item.remaining}d left`}
                                            </span>
                                        </div>
                                    ))}
                                    {sorted.length === 0 && (
                                        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', textAlign: 'center', padding: 'var(--space-lg)' }}>No recent items to track</p>
                                    )}
                                </div>
                            </div>
                        );
                    })()}
                </div>
            </div>

            {/* AI Insights Section */}
            <div className={`${styles.aiInsightsSection} animate-fadeInUp stagger-5`}>
                <div className={styles.insightsHeader}>
                    <h3><Brain size={20} /> AI Insights & Predictions</h3>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div className={styles.insightsTabs}>
                            {['week', 'month', 'year'].map(period => (
                                <button
                                    key={period}
                                    className={`${styles.insightTab} ${insightsPeriod === period ? styles.insightTabActive : ''}`}
                                    onClick={() => fetchAiInsights(period)}
                                    disabled={insightsLoading}
                                >
                                    {period.charAt(0).toUpperCase() + period.slice(1)}
                                </button>
                            ))}
                        </div>
                        {aiInsights[insightsPeriod] && (
                            <button
                                onClick={refreshInsights}
                                disabled={insightsLoading}
                                className="btn-secondary"
                                style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                                title="Refresh insights for current period"
                            >
                                <TrendingUp size={14} />
                                Refresh
                            </button>
                        )}
                    </div>
                </div>

                {!aiInsights[insightsPeriod] && !insightsLoading && !insightsError && (
                    <div style={{ textAlign: 'center', padding: 'var(--space-lg)' }}>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
                            Get AI-powered predictions, nutrition grades, and personalized insights
                        </p>
                        <button onClick={() => fetchAiInsights(insightsPeriod)} className="btn-primary" style={{ padding: '12px 24px' }}>
                            <Brain size={16} /> Generate AI Insights
                        </button>
                    </div>
                )}

                {insightsError && !insightsLoading && (
                    <div style={{ textAlign: 'center', padding: 'var(--space-lg)', background: 'rgba(255,180,50,0.08)', borderRadius: 'var(--radius-lg)', margin: 'var(--space-md)' }}>
                        <AlertTriangle size={24} style={{ color: 'var(--accent-yellow)', marginBottom: 'var(--space-sm)' }} />
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-md)', fontSize: '0.9rem' }}>
                            {insightsError}
                        </p>
                        <button onClick={() => fetchAiInsights(insightsPeriod)} className="btn-secondary" style={{ padding: '10px 20px' }}>
                            🔄 Retry
                        </button>
                    </div>
                )}

                {insightsLoading && (
                    <div style={{ padding: 'var(--space-xl)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
                            <Loader size={18} className={styles.spinningIcon} />
                            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>AI Analyzing Your Data</span>
                            <span style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--accent-green)', fontSize: '0.85rem' }}>{Math.round(insightsProgress)}%</span>
                        </div>
                        <div style={{ width: '100%', height: 6, background: 'var(--bg-glass)', borderRadius: 99, overflow: 'hidden', marginBottom: 'var(--space-sm)' }}>
                            <div style={{
                                height: '100%',
                                width: `${insightsProgress}%`,
                                background: 'var(--gradient-primary)',
                                borderRadius: 99,
                                transition: 'width 0.4s ease-out',
                            }} />
                        </div>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', textAlign: 'center' }}>{insightsProgressText}</p>
                    </div>
                )}

                {aiInsights[insightsPeriod] && !insightsLoading && (
                    <div className={styles.insightsBody}>
                        {/* AI Summary */}
                        {aiInsights[insightsPeriod].ai_summary && (
                            <div className={styles.insightCard}>
                                <div className={styles.insightCardHeader}>
                                    <div className={styles.insightCardIcon} style={{ background: 'var(--accent-green-dim)', color: 'var(--accent-green)' }}>
                                        <Brain size={16} />
                                    </div>
                                    <span className={styles.insightCardTitle}>{aiInsights[insightsPeriod].ai_summary.title || 'AI Summary'}</span>
                                </div>
                                <p className={styles.insightContent}>{aiInsights[insightsPeriod].ai_summary.overview}</p>
                                {aiInsights[insightsPeriod].ai_summary.highlights?.length > 0 && (
                                    <div style={{ marginTop: 'var(--space-sm)' }}>
                                        {aiInsights[insightsPeriod].ai_summary.highlights.map((h, i) => (
                                            <p key={i} style={{ color: 'var(--accent-green)', fontSize: '0.82rem', margin: '4px 0' }}>✅ {h}</p>
                                        ))}
                                    </div>
                                )}
                                {aiInsights[insightsPeriod].ai_summary.concerns?.length > 0 && (
                                    <div style={{ marginTop: 'var(--space-xs)' }}>
                                        {aiInsights[insightsPeriod].ai_summary.concerns.map((c, i) => (
                                            <p key={i} style={{ color: 'var(--accent-orange)', fontSize: '0.82rem', margin: '4px 0' }}>⚠️ {c}</p>
                                        ))}
                                    </div>
                                )}
                                {aiInsights[insightsPeriod].ai_summary.action_items?.length > 0 && (
                                    <div style={{ marginTop: 'var(--space-sm)', padding: 'var(--space-sm)', background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)' }}>
                                        <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginBottom: '4px', fontWeight: 600 }}>ACTION ITEMS</p>
                                        {aiInsights[insightsPeriod].ai_summary.action_items.map((a, i) => (
                                            <p key={i} style={{ color: 'var(--accent-blue)', fontSize: '0.82rem', margin: '4px 0' }}>→ {a}</p>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Consumption Predictions */}
                        {aiInsights[insightsPeriod].consumption_predictions && (
                            <div className={styles.insightCard}>
                                <div className={styles.insightCardHeader}>
                                    <div className={styles.insightCardIcon} style={{ background: 'var(--accent-blue-dim)', color: 'var(--accent-blue)' }}>
                                        <Clock size={16} />
                                    </div>
                                    <span className={styles.insightCardTitle}>Consumption Predictions</span>
                                </div>
                                <div className={styles.predictionGrid}>
                                    <div className={styles.predictionItem}>
                                        <span className={styles.predictionLabel}>Groceries Last</span>
                                        <span className={styles.predictionValue}>{aiInsights[insightsPeriod].consumption_predictions.estimated_days_supply} days</span>
                                    </div>
                                    <div className={styles.predictionItem}>
                                        <span className={styles.predictionLabel}>Next Shopping</span>
                                        <span className={styles.predictionValue}>{aiInsights[insightsPeriod].consumption_predictions.next_shopping_predicted}</span>
                                    </div>
                                    <div className={styles.predictionItem}>
                                        <span className={styles.predictionLabel}>Weekly Spend</span>
                                        <span className={styles.predictionValue}>{formatCurrency(aiInsights[insightsPeriod].consumption_predictions.estimated_weekly_spend, currency)}</span>
                                    </div>
                                    <div className={styles.predictionItem}>
                                        <span className={styles.predictionLabel}>Monthly Spend</span>
                                        <span className={styles.predictionValue}>{formatCurrency(aiInsights[insightsPeriod].consumption_predictions.estimated_monthly_spend, currency)}</span>
                                    </div>
                                </div>
                                {aiInsights[insightsPeriod].consumption_predictions.items_likely_to_run_out_first?.length > 0 && (
                                    <p className={styles.insightContent} style={{ marginTop: 'var(--space-sm)' }}>
                                        🏃 Running out first: {aiInsights[insightsPeriod].consumption_predictions.items_likely_to_run_out_first.join(', ')}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Nutrition Grade + Health */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                            {aiInsights[insightsPeriod].nutrition_insights && (
                                <div className={styles.insightCard}>
                                    <div className={styles.insightCardHeader}>
                                        <div className={styles.insightCardIcon} style={{ background: 'var(--accent-orange-dim)', color: 'var(--accent-orange)' }}>
                                            <Target size={16} />
                                        </div>
                                        <span className={styles.insightCardTitle}>Nutrition Grade</span>
                                        <span style={{
                                            fontSize: '1.4rem', fontWeight: 800,
                                            color: ['A', 'B'].includes(aiInsights[insightsPeriod].nutrition_insights.nutrition_grade) ? 'var(--accent-green)' :
                                                aiInsights[insightsPeriod].nutrition_insights.nutrition_grade === 'C' ? 'var(--accent-yellow)' : 'var(--accent-red)',
                                        }}>{aiInsights[insightsPeriod].nutrition_insights.nutrition_grade}</span>
                                    </div>
                                    <p className={styles.insightContent}>{aiInsights[insightsPeriod].nutrition_insights.nutrition_grade_explanation}</p>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: 'var(--space-sm)' }}>
                                        <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '99px', background: aiInsights[insightsPeriod].nutrition_insights.protein_adequacy === 'sufficient' ? 'var(--accent-green-dim)' : 'var(--accent-red-dim)', color: aiInsights[insightsPeriod].nutrition_insights.protein_adequacy === 'sufficient' ? 'var(--accent-green)' : 'var(--accent-red)' }}>Protein: {aiInsights[insightsPeriod].nutrition_insights.protein_adequacy}</span>
                                        <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '99px', background: aiInsights[insightsPeriod].nutrition_insights.sugar_alert === 'within limits' ? 'var(--accent-green-dim)' : 'rgba(251,146,60,0.1)', color: aiInsights[insightsPeriod].nutrition_insights.sugar_alert === 'within limits' ? 'var(--accent-green)' : '#fb923c' }}>Sugar: {aiInsights[insightsPeriod].nutrition_insights.sugar_alert}</span>
                                        <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '99px', background: aiInsights[insightsPeriod].nutrition_insights.salt_assessment === 'within limits' ? 'var(--accent-green-dim)' : 'var(--accent-red-dim)', color: aiInsights[insightsPeriod].nutrition_insights.salt_assessment === 'within limits' ? 'var(--accent-green)' : 'var(--accent-red)' }}>Salt: {aiInsights[insightsPeriod].nutrition_insights.salt_assessment}</span>
                                    </div>
                                </div>
                            )}

                            {aiInsights[insightsPeriod].health_predictions && (
                                <div className={styles.insightCard}>
                                    <div className={styles.insightCardHeader}>
                                        <div className={styles.insightCardIcon} style={{ background: 'var(--accent-pink-dim)', color: 'var(--accent-pink)' }}>
                                            <ShieldCheck size={16} />
                                        </div>
                                        <span className={styles.insightCardTitle}>Health Forecast</span>
                                    </div>
                                    <div className={styles.predictionGrid}>
                                        <div className={styles.predictionItem}>
                                            <span className={styles.predictionLabel}>Weight Impact</span>
                                            <span className={styles.predictionValue} style={{ fontSize: '0.85rem' }}>{aiInsights[insightsPeriod].health_predictions.weight_impact}</span>
                                        </div>
                                        <div className={styles.predictionItem}>
                                            <span className={styles.predictionLabel}>Energy Level</span>
                                            <span className={styles.predictionValue} style={{ fontSize: '0.85rem' }}>{aiInsights[insightsPeriod].health_predictions.energy_level_forecast}</span>
                                        </div>
                                        <div className={styles.predictionItem}>
                                            <span className={styles.predictionLabel}>Immune Score</span>
                                            <span className={styles.predictionValue}>{aiInsights[insightsPeriod].health_predictions.immune_support_score}/100</span>
                                        </div>
                                        <div className={styles.predictionItem}>
                                            <span className={styles.predictionLabel}>Gut Health</span>
                                            <span className={styles.predictionValue} style={{ fontSize: '0.85rem' }}>{aiInsights[insightsPeriod].health_predictions.gut_health_indicator}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Food Waste Risk */}
                        {aiInsights[insightsPeriod].food_waste_risk && (
                            <div className={styles.insightCard}>
                                <div className={styles.insightCardHeader}>
                                    <div className={styles.insightCardIcon} style={{ background: 'var(--accent-red-dim)', color: 'var(--accent-red)' }}>
                                        <Trash2 size={16} />
                                    </div>
                                    <span className={styles.insightCardTitle}>Food Waste Risk</span>
                                    <span style={{ fontSize: '0.82rem', color: 'var(--accent-orange)', fontWeight: 700 }}>
                                        ~{aiInsights[insightsPeriod].food_waste_risk.estimated_waste_percentage}% waste
                                    </span>
                                </div>
                                {aiInsights[insightsPeriod].food_waste_risk.high_waste_risk_items?.length > 0 && (
                                    <p className={styles.insightContent}>
                                        ⚠️ High risk: {aiInsights[insightsPeriod].food_waste_risk.high_waste_risk_items.join(', ')}
                                    </p>
                                )}
                                {aiInsights[insightsPeriod].food_waste_risk.tips_to_reduce_waste?.length > 0 && (
                                    <div style={{ marginTop: 'var(--space-xs)' }}>
                                        {aiInsights[insightsPeriod].food_waste_risk.tips_to_reduce_waste.map((t, i) => (
                                            <p key={i} style={{ fontSize: '0.82rem', color: 'var(--accent-green)', margin: '2px 0' }}>💡 {t}</p>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Spending Analytics */}
                        {aiInsights[insightsPeriod].spending_analytics && (
                            <div className={styles.insightCard}>
                                <div className={styles.insightCardHeader}>
                                    <div className={styles.insightCardIcon} style={{ background: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24' }}>
                                        <TrendingUp size={16} />
                                    </div>
                                    <span className={styles.insightCardTitle}>Spending Intelligence</span>
                                </div>
                                <div className={styles.predictionGrid}>
                                    <div className={styles.predictionItem}>
                                        <span className={styles.predictionLabel}>Cost per Calorie</span>
                                        <span className={styles.predictionValue}>{formatCurrency(aiInsights[insightsPeriod].spending_analytics.cost_per_calorie, currency)}</span>
                                    </div>
                                    {aiInsights[insightsPeriod].spending_analytics.cost_per_person_per_day && (
                                        <div className={styles.predictionItem}>
                                            <span className={styles.predictionLabel}>Cost / Person / Day</span>
                                            <span className={styles.predictionValue}>{formatCurrency(aiInsights[insightsPeriod].spending_analytics.cost_per_person_per_day, currency)}</span>
                                        </div>
                                    )}
                                    <div className={styles.predictionItem}>
                                        <span className={styles.predictionLabel}>Priciest Category</span>
                                        <span className={styles.predictionValue} style={{ fontSize: '0.85rem' }}>{aiInsights[insightsPeriod].spending_analytics.most_expensive_category}</span>
                                    </div>
                                </div>
                                {aiInsights[insightsPeriod].spending_analytics.potential_savings && (
                                    <p className={styles.insightContent} style={{ marginTop: 'var(--space-sm)' }}>
                                        💰 {aiInsights[insightsPeriod].spending_analytics.potential_savings}
                                    </p>
                                )}
                            </div>
                        )}
                        
                        {/* Red Flags */}
                        {aiInsights[insightsPeriod].red_flags && (
                            <div className={styles.insightCard}>
                                <div className={styles.insightCardHeader}>
                                    <div className={styles.insightCardIcon} style={{ background: 'var(--accent-red-dim)', color: 'var(--accent-red)' }}>
                                        <AlertTriangle size={16} />
                                    </div>
                                    <span className={styles.insightCardTitle}>Dietary Red Flags</span>
                                </div>
                                {aiInsights[insightsPeriod].red_flags.unhealthy_items?.length > 0 && (
                                    <div style={{ marginBottom: 'var(--space-sm)' }}>
                                        <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginBottom: '4px', fontWeight: 600 }}>ITEMS TO WATCH</p>
                                        {aiInsights[insightsPeriod].red_flags.unhealthy_items.map((item, i) => (
                                            <p key={i} className={styles.insightContent} style={{ color: 'var(--accent-orange)' }}>🚩 {item}</p>
                                        ))}
                                    </div>
                                )}
                                {aiInsights[insightsPeriod].red_flags.critical_warnings?.length > 0 && (
                                    <div>
                                        <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginBottom: '4px', fontWeight: 600 }}>CRITICAL WARNINGS</p>
                                        {aiInsights[insightsPeriod].red_flags.critical_warnings.map((warn, i) => (
                                            <p key={i} className={styles.insightContent} style={{ color: 'var(--accent-red)' }}>⚠️ {warn}</p>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Smart Recommendations */}
                        {aiInsights[insightsPeriod].smart_recommendations && (
                            <div className={styles.insightCard} style={{ gridColumn: '1 / -1' }}>
                                <div className={styles.insightCardHeader}>
                                    <div className={styles.insightCardIcon} style={{ background: 'var(--accent-green-dim)', color: 'var(--accent-green)' }}>
                                        <Apple size={16} />
                                    </div>
                                    <span className={styles.insightCardTitle}>Smart Purchase Recommendations</span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                                    <div>
                                        <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginBottom: '8px', fontWeight: 600 }}>MISSING NUTRIENTS</p>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                            {aiInsights[insightsPeriod].smart_recommendations.missing_nutrients?.map((nut, i) => (
                                                <span key={i} style={{ background: 'rgba(255,255,255,0.05)', padding: '4px 12px', borderRadius: '4px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                    {nut}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginBottom: '8px', fontWeight: 600 }}>RECOMMENDED ADDITIONS</p>
                                        {aiInsights[insightsPeriod].smart_recommendations.items_to_buy?.map((item, i) => (
                                            <p key={i} className={styles.insightContent} style={{ color: 'var(--accent-green)', marginBottom: '6px' }}>
                                                + {item}
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Healthier Alternatives from Sessions */}
            {(() => {
                // recommendations is saved as an array directly, or as {alternatives: [...]}
                const sessionWithAlts = allSessions.find(s => {
                    const recs = s.recommendations;
                    if (!recs) return false;
                    if (Array.isArray(recs) && recs.length > 0) return true;
                    if (Array.isArray(recs?.alternatives) && recs.alternatives.length > 0) return true;
                    return false;
                });
                if (!sessionWithAlts) return null;
                const recs = sessionWithAlts.recommendations;
                const alts = (Array.isArray(recs) ? recs : recs.alternatives).slice(0, 6);
                return (
                    <div className={`${styles.chartCard} animate-fadeInUp stagger-6`} style={{ marginBottom: 'var(--space-xl)' }}>
                        <div className={styles.chartHeader}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Leaf size={20} style={{ color: 'var(--accent-green)' }} /> Healthier Alternatives
                            </h3>
                            <span className={styles.chartBadge}>{sessionWithAlts.session_name || 'Latest Session'}</span>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
                            AI-suggested swaps from your recent grocery trip
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-md)' }}>
                            {alts.map((alt, i) => (
                                <div key={i} style={{
                                    padding: 'var(--space-md)',
                                    background: 'var(--bg-glass)',
                                    borderRadius: 'var(--radius-md)',
                                    borderLeft: '3px solid var(--accent-green)',
                                    display: 'flex', flexDirection: 'column', gap: 10,
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                        <span style={{ color: 'var(--text-secondary)', textDecoration: 'line-through', fontSize: '0.9rem' }}>
                                            {alt.original_item || alt.original}
                                        </span>
                                        <ArrowUpRight size={14} style={{ color: 'var(--accent-green)', flexShrink: 0 }} />
                                        <span style={{ color: 'var(--accent-green)', fontWeight: 600, fontSize: '0.9rem' }}>Healthier Swaps</span>
                                    </div>
                                    {alt.same_store_alternative && (
                                        <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, borderLeft: '3px solid var(--accent-blue)' }}>
                                            <p style={{ margin: 0, fontWeight: 600, fontSize: '0.8rem', color: 'var(--accent-blue)' }}>Same Store</p>
                                            <p style={{ margin: '2px 0', fontWeight: 500, fontSize: '0.85rem' }}>{alt.same_store_alternative.name}</p>
                                            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>{alt.same_store_alternative.reason}</p>
                                            {alt.same_store_alternative.price_impact && (
                                                <p style={{ margin: '2px 0 0 0', fontSize: '0.72rem', color: 'var(--accent-green)' }}>{alt.same_store_alternative.price_impact}</p>
                                            )}
                                        </div>
                                    )}
                                    {alt.best_health_alternative && (
                                        <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, borderLeft: '3px solid var(--accent-green)' }}>
                                            <p style={{ margin: 0, fontWeight: 600, fontSize: '0.8rem', color: 'var(--accent-green)' }}>Healthiest Option</p>
                                            <p style={{ margin: '2px 0', fontWeight: 500, fontSize: '0.85rem' }}>{alt.best_health_alternative.name}</p>
                                            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>{alt.best_health_alternative.reason}</p>
                                            {alt.best_health_alternative.price_impact && (
                                                <p style={{ margin: '2px 0 0 0', fontSize: '0.72rem', color: 'var(--accent-orange)' }}>{alt.best_health_alternative.price_impact}</p>
                                            )}
                                        </div>
                                    )}
                                    {/* Fallback for old format */}
                                    {alt.suggestion && !alt.same_store_alternative && (
                                        <div>
                                            <span style={{ color: 'var(--accent-green)', fontWeight: 500, fontSize: '0.85rem' }}>{alt.suggestion}</span>
                                            {alt.reason && <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', margin: '4px 0 0 0' }}>{alt.reason}</p>}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })()}

            {/* Recent Sessions */}
            <div className={`${styles.recentSection} animate-fadeInUp stagger-5`}>
                <div className={styles.sectionHeader}>
                    <h3>Recent Shopping Trips</h3>
                    <Link href="/dashboard/history" className={styles.viewAll}>
                        View All <ArrowUpRight size={14} />
                    </Link>
                </div>
                <div className={styles.sessionsList}>
                    {sessions.slice(0, 5).map((session, idx) => (
                        <div key={session.id} className={styles.sessionItem} style={{ animationDelay: `${idx * 0.1}s` }}>
                            <div className={styles.sessionIcon}>
                                <ShoppingCart size={18} />
                            </div>
                            <div className={styles.sessionInfo}>
                                <span className={styles.sessionName}>{session.session_name}</span>
                                <span className={styles.sessionMeta}>
                                    <Calendar size={12} /> {session.session_date} · {session.store_name || 'Unknown Store'}
                                </span>
                            </div>
                            <div className={styles.sessionStats}>
                                <span className={styles.sessionCalories}>{(session.total_calories || 0).toLocaleString()} cal</span>
                                <span className={styles.sessionSpent}>${(session.total_spent || 0).toFixed(2)}</span>
                            </div>
                        </div>
                    ))}
                    {sessions.length === 0 && (
                        <div className={styles.emptyState}>
                            <Droplets size={48} className={styles.emptyIcon} />
                            <h4>No shopping trips yet</h4>
                            <p>Add your first grocery session to start tracking!</p>
                            <Link href="/dashboard/add" className="btn-primary" style={{ marginTop: '16px' }}>
                                <PlusCircle size={18} /> Add Groceries
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
