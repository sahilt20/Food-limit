'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { NUTRIENT_INFO, DAILY_VALUES } from '@/lib/nutritionDB';
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

// Demo data for when no real data exists
const DEMO_SESSIONS = [
    { id: '1', session_name: 'Weekly Groceries', session_date: '2026-02-09', store_name: 'Whole Foods', total_spent: 85.40, total_calories: 12500, total_items: 15 },
    { id: '2', session_name: 'Quick Stop', session_date: '2026-02-07', store_name: 'Trader Joe\'s', total_spent: 32.10, total_calories: 5800, total_items: 8 },
    { id: '3', session_name: 'Monthly Stock', session_date: '2026-02-03', store_name: 'Costco', total_spent: 156.80, total_calories: 28400, total_items: 24 },
    { id: '4', session_name: 'Fruit Run', session_date: '2026-01-30', store_name: 'Farmers Market', total_spent: 28.50, total_calories: 3200, total_items: 10 },
    { id: '5', session_name: 'Dinner Party', session_date: '2026-01-25', store_name: 'Whole Foods', total_spent: 72.30, total_calories: 9800, total_items: 12 },
];

const DEMO_WEEKLY_CALORIES = [2100, 1850, 2300, 1950, 2200, 2400, 2150];
const DEMO_MACROS = { protein: 340, carbs: 820, fat: 290, sugar: 165, salt: 12 };
const DEMO_SPENDING = { Produce: 45, Protein: 62, Dairy: 28, Grains: 18, Snacks: 12 };
const DEMO_MICRO_SCORES = {
    vitamin_c_mg: 82, calcium_mg: 65, iron_mg: 71, potassium_mg: 58,
    vitamin_a_mcg: 90, vitamin_d_mcg: 35, zinc_mg: 73, magnesium_mg: 61,
};

export default function DashboardPage() {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isDemo, setIsDemo] = useState(false);
    const [aiInsights, setAiInsights] = useState(null);
    const [insightsLoading, setInsightsLoading] = useState(false);
    const [insightsPeriod, setInsightsPeriod] = useState('week');

    useEffect(() => {
        const loadData = async () => {
            const demo = localStorage.getItem('foodlimit_demo');
            if (demo) {
                setIsDemo(true);
                setSessions(DEMO_SESSIONS);
                setLoading(false);
                return;
            }

            const supabase = createClient();
            const { data } = await supabase
                .from('grocery_sessions')
                .select('*')
                .order('session_date', { ascending: false })
                .limit(10);

            setSessions(data || []);
            setLoading(false);
        };
        loadData();
    }, []);

    const fetchAiInsights = async (period) => {
        setInsightsLoading(true);
        setInsightsPeriod(period);
        try {
            const response = await fetch('/api/ai-analytics', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessions, period }),
            });
            const data = await response.json();
            if (response.ok && data.data) {
                setAiInsights(data.data);
            }
        } catch (e) {
            // Silently fail
        } finally {
            setInsightsLoading(false);
        }
    };

    const totalSpent = sessions.reduce((s, sess) => s + (sess.total_spent || 0), 0);
    const totalCalories = sessions.reduce((s, sess) => s + (sess.total_calories || 0), 0);
    const totalItems = sessions.reduce((s, sess) => s + (sess.total_items || 0), 0);
    const avgCalPerSession = sessions.length ? Math.round(totalCalories / sessions.length) : 0;

    // Chart configurations
    const macroData = {
        labels: ['Protein', 'Carbs', 'Fat', 'Sugar', 'Salt'],
        datasets: [{
            data: [DEMO_MACROS.protein, DEMO_MACROS.carbs, DEMO_MACROS.fat, DEMO_MACROS.sugar, DEMO_MACROS.salt * 10],
            backgroundColor: ['#4d8dff', '#fbbf24', '#ff6b9d', '#f472b6', '#fb923c'],
            borderColor: ['rgba(77,141,255,0.3)', 'rgba(251,191,36,0.3)', 'rgba(255,107,157,0.3)', 'rgba(244,114,182,0.3)', 'rgba(251,146,60,0.3)'],
            borderWidth: 2,
            hoverOffset: 8,
        }],
    };

    const calorieTrendData = {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [{
            label: 'Calories',
            data: DEMO_WEEKLY_CALORIES,
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
        labels: Object.keys(DEMO_SPENDING),
        datasets: [{
            label: 'Spending ($)',
            data: Object.values(DEMO_SPENDING),
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
            <div className={styles.loadingContainer}>
                <div className={styles.loadingPulse}>
                    <Apple size={48} />
                </div>
                <p>Loading your nutrition data...</p>
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
                        {isDemo ? 'Demo Mode — Connect Supabase for your real data' : 'Your food shopping intelligence at a glance'}
                    </p>
                </div>
                <Link href="/dashboard/add" className="btn-primary">
                    <PlusCircle size={18} />
                    Add Groceries
                </Link>
            </div>

            {/* Stat Cards */}
            <div className={styles.statGrid}>
                <div className={`${styles.statCard} animate-fadeInUp stagger-1`}>
                    <div className={styles.statIcon} style={{ background: 'var(--accent-green-dim)', color: 'var(--accent-green)' }}>
                        <ShoppingCart size={22} />
                    </div>
                    <div className={styles.statInfo}>
                        <span className={styles.statLabel}>Total Spent</span>
                        <span className={styles.statValue}>${totalSpent.toFixed(2)}</span>
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
                        <span className={styles.chartBadge}>Daily Intake</span>
                    </div>
                    <div className={styles.macroLayout}>
                        <div className={styles.chartBodyDoughnut}>
                            <Doughnut data={macroData} options={doughnutOptions} />
                        </div>
                        <div className={styles.macroBreakdown}>
                            {[
                                { label: 'Protein', value: DEMO_MACROS.protein, max: 300, color: '#4d8dff', unit: 'g' },
                                { label: 'Carbs', value: DEMO_MACROS.carbs, max: 1200, color: '#fbbf24', unit: 'g' },
                                { label: 'Fat', value: DEMO_MACROS.fat, max: 400, color: '#ff6b9d', unit: 'g' },
                                { label: 'Sugar', value: DEMO_MACROS.sugar, max: 200, color: '#f472b6', unit: 'g' },
                                { label: 'Salt', value: DEMO_MACROS.salt, max: 6, color: '#fb923c', unit: 'g' },
                            ].map(macro => (
                                <div key={macro.label} className={styles.macroStatRow}>
                                    <div className={styles.macroStatHeader}>
                                        <span className={styles.macroStatLabel}>{macro.label}</span>
                                        <span className={styles.macroStatValue} style={{ color: macro.color }}>
                                            {macro.value}{macro.unit}
                                        </span>
                                    </div>
                                    <div className={styles.macroBarBg}>
                                        <div className={styles.macroBarFill} style={{
                                            width: `${Math.min((macro.value / macro.max) * 100, 100)}%`,
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
                        <span className={styles.chartBadge}>% Daily Value</span>
                    </div>
                    <div className={styles.microGrid}>
                        {Object.entries(DEMO_MICRO_SCORES).map(([key, value]) => (
                            <div key={key} className={styles.microItem}>
                                <div className={styles.microInfo}>
                                    <span className={styles.microName}>{NUTRIENT_INFO[key]?.name || key}</span>
                                    <span className={styles.microValue}>{value}%</span>
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

            {/* AI Insights Section */}
            <div className={`${styles.aiInsightsSection} animate-fadeInUp stagger-5`}>
                <div className={styles.insightsHeader}>
                    <h3><Brain size={20} /> AI Insights & Predictions</h3>
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
                </div>

                {!aiInsights && !insightsLoading && (
                    <div style={{ textAlign: 'center', padding: 'var(--space-lg)' }}>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
                            Get AI-powered predictions, nutrition grades, and personalized insights
                        </p>
                        <button onClick={() => fetchAiInsights('week')} className="btn-primary" style={{ padding: '12px 24px' }}>
                            <Brain size={16} /> Generate AI Insights
                        </button>
                    </div>
                )}

                {insightsLoading && (
                    <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-secondary)' }}>
                        <Loader size={24} className={styles.spinningIcon} style={{ marginBottom: 'var(--space-sm)' }} />
                        <p>🤖 AI analyzing your data...</p>
                    </div>
                )}

                {aiInsights && !insightsLoading && (
                    <div className={styles.insightsBody}>
                        {/* AI Summary */}
                        {aiInsights.ai_summary && (
                            <div className={styles.insightCard}>
                                <div className={styles.insightCardHeader}>
                                    <div className={styles.insightCardIcon} style={{ background: 'var(--accent-green-dim)', color: 'var(--accent-green)' }}>
                                        <Brain size={16} />
                                    </div>
                                    <span className={styles.insightCardTitle}>{aiInsights.ai_summary.title || 'AI Summary'}</span>
                                </div>
                                <p className={styles.insightContent}>{aiInsights.ai_summary.overview}</p>
                                {aiInsights.ai_summary.highlights?.length > 0 && (
                                    <div style={{ marginTop: 'var(--space-sm)' }}>
                                        {aiInsights.ai_summary.highlights.map((h, i) => (
                                            <p key={i} style={{ color: 'var(--accent-green)', fontSize: '0.82rem', margin: '4px 0' }}>✅ {h}</p>
                                        ))}
                                    </div>
                                )}
                                {aiInsights.ai_summary.concerns?.length > 0 && (
                                    <div style={{ marginTop: 'var(--space-xs)' }}>
                                        {aiInsights.ai_summary.concerns.map((c, i) => (
                                            <p key={i} style={{ color: 'var(--accent-orange)', fontSize: '0.82rem', margin: '4px 0' }}>⚠️ {c}</p>
                                        ))}
                                    </div>
                                )}
                                {aiInsights.ai_summary.action_items?.length > 0 && (
                                    <div style={{ marginTop: 'var(--space-sm)', padding: 'var(--space-sm)', background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)' }}>
                                        <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginBottom: '4px', fontWeight: 600 }}>ACTION ITEMS</p>
                                        {aiInsights.ai_summary.action_items.map((a, i) => (
                                            <p key={i} style={{ color: 'var(--accent-blue)', fontSize: '0.82rem', margin: '4px 0' }}>→ {a}</p>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Consumption Predictions */}
                        {aiInsights.consumption_predictions && (
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
                                        <span className={styles.predictionValue}>{aiInsights.consumption_predictions.estimated_days_supply} days</span>
                                    </div>
                                    <div className={styles.predictionItem}>
                                        <span className={styles.predictionLabel}>Next Shopping</span>
                                        <span className={styles.predictionValue}>{aiInsights.consumption_predictions.next_shopping_predicted}</span>
                                    </div>
                                    <div className={styles.predictionItem}>
                                        <span className={styles.predictionLabel}>Weekly Spend</span>
                                        <span className={styles.predictionValue}>${aiInsights.consumption_predictions.estimated_weekly_spend}</span>
                                    </div>
                                    <div className={styles.predictionItem}>
                                        <span className={styles.predictionLabel}>Monthly Spend</span>
                                        <span className={styles.predictionValue}>${aiInsights.consumption_predictions.estimated_monthly_spend}</span>
                                    </div>
                                </div>
                                {aiInsights.consumption_predictions.items_likely_to_run_out_first?.length > 0 && (
                                    <p className={styles.insightContent} style={{ marginTop: 'var(--space-sm)' }}>
                                        🏃 Running out first: {aiInsights.consumption_predictions.items_likely_to_run_out_first.join(', ')}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Nutrition Grade + Health */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                            {aiInsights.nutrition_insights && (
                                <div className={styles.insightCard}>
                                    <div className={styles.insightCardHeader}>
                                        <div className={styles.insightCardIcon} style={{ background: 'var(--accent-orange-dim)', color: 'var(--accent-orange)' }}>
                                            <Target size={16} />
                                        </div>
                                        <span className={styles.insightCardTitle}>Nutrition Grade</span>
                                        <span style={{
                                            fontSize: '1.4rem', fontWeight: 800,
                                            color: ['A', 'B'].includes(aiInsights.nutrition_insights.nutrition_grade) ? 'var(--accent-green)' :
                                                aiInsights.nutrition_insights.nutrition_grade === 'C' ? 'var(--accent-yellow)' : 'var(--accent-red)',
                                        }}>{aiInsights.nutrition_insights.nutrition_grade}</span>
                                    </div>
                                    <p className={styles.insightContent}>{aiInsights.nutrition_insights.nutrition_grade_explanation}</p>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: 'var(--space-sm)' }}>
                                        <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '99px', background: aiInsights.nutrition_insights.protein_adequacy === 'sufficient' ? 'var(--accent-green-dim)' : 'var(--accent-red-dim)', color: aiInsights.nutrition_insights.protein_adequacy === 'sufficient' ? 'var(--accent-green)' : 'var(--accent-red)' }}>Protein: {aiInsights.nutrition_insights.protein_adequacy}</span>
                                        <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '99px', background: aiInsights.nutrition_insights.sugar_alert === 'within limits' ? 'var(--accent-green-dim)' : 'rgba(251,146,60,0.1)', color: aiInsights.nutrition_insights.sugar_alert === 'within limits' ? 'var(--accent-green)' : '#fb923c' }}>Sugar: {aiInsights.nutrition_insights.sugar_alert}</span>
                                        <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '99px', background: aiInsights.nutrition_insights.salt_assessment === 'within limits' ? 'var(--accent-green-dim)' : 'var(--accent-red-dim)', color: aiInsights.nutrition_insights.salt_assessment === 'within limits' ? 'var(--accent-green)' : 'var(--accent-red)' }}>Salt: {aiInsights.nutrition_insights.salt_assessment}</span>
                                    </div>
                                </div>
                            )}

                            {aiInsights.health_predictions && (
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
                                            <span className={styles.predictionValue} style={{ fontSize: '0.85rem' }}>{aiInsights.health_predictions.weight_impact}</span>
                                        </div>
                                        <div className={styles.predictionItem}>
                                            <span className={styles.predictionLabel}>Energy Level</span>
                                            <span className={styles.predictionValue} style={{ fontSize: '0.85rem' }}>{aiInsights.health_predictions.energy_level_forecast}</span>
                                        </div>
                                        <div className={styles.predictionItem}>
                                            <span className={styles.predictionLabel}>Immune Score</span>
                                            <span className={styles.predictionValue}>{aiInsights.health_predictions.immune_support_score}/100</span>
                                        </div>
                                        <div className={styles.predictionItem}>
                                            <span className={styles.predictionLabel}>Gut Health</span>
                                            <span className={styles.predictionValue} style={{ fontSize: '0.85rem' }}>{aiInsights.health_predictions.gut_health_indicator}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Food Waste Risk */}
                        {aiInsights.food_waste_risk && (
                            <div className={styles.insightCard}>
                                <div className={styles.insightCardHeader}>
                                    <div className={styles.insightCardIcon} style={{ background: 'var(--accent-red-dim)', color: 'var(--accent-red)' }}>
                                        <Trash2 size={16} />
                                    </div>
                                    <span className={styles.insightCardTitle}>Food Waste Risk</span>
                                    <span style={{ fontSize: '0.82rem', color: 'var(--accent-orange)', fontWeight: 700 }}>
                                        ~{aiInsights.food_waste_risk.estimated_waste_percentage}% waste
                                    </span>
                                </div>
                                {aiInsights.food_waste_risk.high_waste_risk_items?.length > 0 && (
                                    <p className={styles.insightContent}>
                                        ⚠️ High risk: {aiInsights.food_waste_risk.high_waste_risk_items.join(', ')}
                                    </p>
                                )}
                                {aiInsights.food_waste_risk.tips_to_reduce_waste?.length > 0 && (
                                    <div style={{ marginTop: 'var(--space-xs)' }}>
                                        {aiInsights.food_waste_risk.tips_to_reduce_waste.map((t, i) => (
                                            <p key={i} style={{ fontSize: '0.82rem', color: 'var(--accent-green)', margin: '2px 0' }}>💡 {t}</p>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Spending Analytics */}
                        {aiInsights.spending_analytics && (
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
                                        <span className={styles.predictionValue}>${aiInsights.spending_analytics.cost_per_calorie}</span>
                                    </div>
                                    <div className={styles.predictionItem}>
                                        <span className={styles.predictionLabel}>Priciest Category</span>
                                        <span className={styles.predictionValue} style={{ fontSize: '0.85rem' }}>{aiInsights.spending_analytics.most_expensive_category}</span>
                                    </div>
                                </div>
                                {aiInsights.spending_analytics.potential_savings && (
                                    <p className={styles.insightContent} style={{ marginTop: 'var(--space-sm)' }}>
                                        💰 {aiInsights.spending_analytics.potential_savings}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

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
