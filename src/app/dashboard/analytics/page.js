'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { getCurrencySymbol } from '@/lib/currency';
import { DAILY_VALUES } from '@/lib/nutritionDB';
import {
    BarChart2, TrendingUp, DollarSign, Zap, Award,
    RefreshCw, ArrowUp, ArrowDown, Minus, Star,
    ShoppingBag, Leaf, AlertTriangle, Info,
} from 'lucide-react';
import styles from './analytics.module.css';

const supabase = createClient();

// Nutrients to show in density scoring
const DENSITY_NUTRIENTS = ['protein_g', 'fiber_g', 'vitamin_c_mg', 'iron_mg', 'calcium_mg', 'potassium_mg'];

function densityScore(nd) {
    if (!nd) return 0;
    let score = 0;
    const dvs = { protein_g: 50, fiber_g: 25, vitamin_c_mg: 90, iron_mg: 18, calcium_mg: 1000, potassium_mg: 4700 };
    for (const key of DENSITY_NUTRIENTS) {
        const pct = ((nd[key] || 0) / dvs[key]) * 100;
        score += Math.min(pct, 100);
    }
    return Math.round(score / DENSITY_NUTRIENTS.length);
}

function SparkBar({ value, max, color = 'var(--accent-green)' }) {
    const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    return (
        <div className={styles.sparkTrack}>
            <div className={styles.sparkFill} style={{ width: `${pct}%`, background: color }} />
        </div>
    );
}

function StatCard({ icon: Icon, label, value, sub, color = 'var(--accent-green)', trend }) {
    return (
        <div className={`glass-card ${styles.statCard}`}>
            <div className={styles.statIcon} style={{ background: `${color}1a`, color }}>
                <Icon size={20} />
            </div>
            <div className={styles.statBody}>
                <p className={styles.statLabel}>{label}</p>
                <p className={styles.statValue} style={{ color }}>{value}</p>
                {sub && <p className={styles.statSub}>{sub}</p>}
            </div>
            {trend !== undefined && (
                <div className={`${styles.trend} ${trend > 0 ? styles.trendUp : trend < 0 ? styles.trendDown : styles.trendFlat}`}>
                    {trend > 0 ? <ArrowUp size={14} /> : trend < 0 ? <ArrowDown size={14} /> : <Minus size={14} />}
                    {Math.abs(trend)}%
                </div>
            )}
        </div>
    );
}

export default function AnalyticsPage() {
    const [sessions, setSessions]     = useState([]);
    const [items, setItems]           = useState([]);
    const [profile, setProfile]       = useState(null);
    const [loading, setLoading]       = useState(true);
    const [range, setRange]           = useState('month');
    const [error, setError]           = useState('');

    const fetchData = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
            setProfile(prof);

            const days = range === 'week' ? 7 : range === 'month' ? 30 : range === '3month' ? 90 : 365;
            const start = new Date(); start.setDate(start.getDate() - days);
            const startStr = start.toISOString().slice(0, 10);

            const { data: sess } = await supabase
                .from('grocery_sessions')
                .select('id, session_name, session_date, store_name, total_spent, total_calories, total_items')
                .eq('user_id', user.id)
                .gte('session_date', startStr)
                .order('session_date', { ascending: true });

            setSessions(sess ?? []);

            if (!sess?.length) { setItems([]); setLoading(false); return; }

            const sessionIds = sess.map(s => s.id);
            const { data: gItems } = await supabase
                .from('grocery_items')
                .select('id, name, quantity, unit, price, category, session_id, nutrition_data(*)')
                .in('session_id', sessionIds);

            setItems(gItems ?? []);
        } catch (err) {
            setError(err.message || 'Failed to load analytics');
        } finally {
            setLoading(false);
        }
    }, [range]);

    useEffect(() => { fetchData(); }, [fetchData]);

    /* ── Derived analytics ─────────────────── */
    const currency = profile?.currency_preference || 'USD';
    const sym      = getCurrencySymbol(currency);

    // Summary stats
    const totalSpent   = sessions.reduce((s, x) => s + (x.total_spent || 0), 0);
    const totalCal     = sessions.reduce((s, x) => s + (x.total_calories || 0), 0);
    const totalItems   = items.length;
    const sessCount    = sessions.length;

    const itemsWithNutrition = items.filter(i => {
        const nd = Array.isArray(i.nutrition_data) ? i.nutrition_data[0] : i.nutrition_data;
        return !!nd;
    });

    // Cost per calorie
    const cpc = totalCal > 0 ? (totalSpent / totalCal * 100).toFixed(2) : '—';

    // Average spend per session
    const avgSpend = sessCount > 0 ? (totalSpent / sessCount).toFixed(2) : '0';

    // Nutrient density per item
    const itemDensity = itemsWithNutrition.map(item => {
        const nd = Array.isArray(item.nutrition_data) ? item.nutrition_data[0] : item.nutrition_data;
        const score = densityScore(nd);
        const cal   = nd?.calories || 0;
        const price = item.price || 0;
        const nutritionPerDollar = price > 0 ? Math.round(score / price) : 0;
        return { ...item, nd, score, cal, price, nutritionPerDollar };
    }).sort((a, b) => b.score - a.score);

    // Best value foods (high nutrition score per dollar)
    const bestValue  = [...itemDensity].sort((a, b) => b.nutritionPerDollar - a.nutritionPerDollar).slice(0, 5);
    const worstValue = [...itemDensity].filter(i => i.price > 0).sort((a, b) => a.nutritionPerDollar - b.nutritionPerDollar).slice(0, 5);

    // Category breakdown
    const catSpend = {};
    const catCal   = {};
    items.forEach(item => {
        const cat   = item.category || 'Other';
        const price = item.price || 0;
        const nd    = Array.isArray(item.nutrition_data) ? item.nutrition_data[0] : item.nutrition_data;
        const cal   = nd?.calories || 0;
        catSpend[cat] = (catSpend[cat] || 0) + price;
        catCal[cat]   = (catCal[cat] || 0) + cal;
    });
    const catKeys = Object.keys(catSpend).sort((a, b) => catSpend[b] - catSpend[a]);
    const maxCatSpend = Math.max(...Object.values(catSpend), 1);

    // Top most-bought foods
    const nameCounts = {};
    items.forEach(i => {
        const k = i.name.toLowerCase();
        if (!nameCounts[k]) nameCounts[k] = { name: i.name, count: 0, totalSpent: 0, category: i.category };
        nameCounts[k].count++;
        nameCounts[k].totalSpent += i.price || 0;
    });
    const topFoods = Object.values(nameCounts).sort((a, b) => b.count - a.count).slice(0, 8);

    // Spending trend (per session)
    const spendTrend = sessions.map(s => ({
        date: s.session_date?.slice(5),  // MM-DD
        spent: s.total_spent || 0,
        cal: s.total_calories || 0,
    }));
    const maxTrendSpend = Math.max(...spendTrend.map(s => s.spent), 1);
    const maxTrendCal   = Math.max(...spendTrend.map(s => s.cal), 1);

    // Macro aggregates (only from items with nutrition)
    const macroTotals = { protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 };
    itemsWithNutrition.forEach(item => {
        const nd = Array.isArray(item.nutrition_data) ? item.nutrition_data[0] : item.nutrition_data;
        if (!nd) return;
        macroTotals.protein_g += nd.protein_g || 0;
        macroTotals.carbs_g   += nd.carbs_g   || 0;
        macroTotals.fat_g     += nd.fat_g     || 0;
        macroTotals.fiber_g   += nd.fiber_g   || 0;
    });
    const macroTotal = macroTotals.protein_g + macroTotals.carbs_g + macroTotals.fat_g || 1;
    const macroBreakdown = [
        { label: 'Protein', val: macroTotals.protein_g, color: '#4d8dff', unit: 'g' },
        { label: 'Carbs',   val: macroTotals.carbs_g,   color: '#fbbf24', unit: 'g' },
        { label: 'Fat',     val: macroTotals.fat_g,     color: '#ff6b9d', unit: 'g' },
        { label: 'Fiber',   val: macroTotals.fiber_g,   color: '#00d4aa', unit: 'g' },
    ];

    const isEmpty = !loading && sessions.length === 0;

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}><BarChart2 size={22} /> Advanced Analytics</h1>
                    <p className={styles.subtitle}>Deep insights into your food spending, nutrition quality & value.</p>
                </div>
                <div className={styles.controls}>
                    <select className={styles.rangeSelect} value={range} onChange={e => setRange(e.target.value)}>
                        <option value="week">Last 7 Days</option>
                        <option value="month">Last 30 Days</option>
                        <option value="3month">Last 90 Days</option>
                        <option value="year">Last Year</option>
                    </select>
                    <button className={styles.refreshBtn} onClick={fetchData} disabled={loading} title="Refresh">
                        <RefreshCw size={16} className={loading ? styles.spin : ''} />
                    </button>
                </div>
            </div>

            {error && <div className={styles.errorBox}><AlertTriangle size={16} /> {error}</div>}

            {loading && (
                <div className={styles.loadingGrid}>
                    {[1,2,3,4,5,6,7,8].map(n => <div key={n} className={`skeleton ${styles.skCard}`} />)}
                </div>
            )}

            {isEmpty && !loading && (
                <div className={styles.empty}>
                    <BarChart2 size={48} opacity={0.2} />
                    <h3>No data in this period</h3>
                    <p>Add some grocery sessions to see your analytics.</p>
                </div>
            )}

            {!loading && !isEmpty && (
                <>
                    {/* Summary stat cards */}
                    <div className={styles.statsGrid}>
                        <StatCard icon={DollarSign}   label="Total Spent"         value={`${sym}${totalSpent.toFixed(2)}`}      sub={`across ${sessCount} trips`}         color="var(--accent-green)" />
                        <StatCard icon={Zap}          label="Total Calories"       value={totalCal.toLocaleString()}              sub="from tracked items"                  color="var(--accent-orange)" />
                        <StatCard icon={TrendingUp}   label="Cost per 100 kcal"    value={`${sym}${cpc}`}                        sub="nutritional cost efficiency"         color="var(--accent-blue)" />
                        <StatCard icon={ShoppingBag}  label="Avg Trip Spend"       value={`${sym}${avgSpend}`}                   sub="per grocery session"                 color="var(--accent-purple)" />
                        <StatCard icon={Star}         label="Items Tracked"        value={totalItems}                             sub={`${itemsWithNutrition.length} with nutrition data`} color="var(--accent-cyan)" />
                        <StatCard icon={Award}        label="Avg Nutrition Score"  value={itemDensity.length > 0 ? Math.round(itemDensity.reduce((s,i)=>s+i.score,0)/itemDensity.length) + '/100' : '—'} sub="density across all items" color="var(--accent-pink)" />
                    </div>

                    {/* Spending + calorie trend */}
                    {spendTrend.length > 1 && (
                        <section className={`glass-card ${styles.section}`}>
                            <h2 className={styles.sectionTitle}><TrendingUp size={18} /> Spending & Calorie Trend per Session</h2>
                            <div className={styles.trendChart}>
                                {spendTrend.map((s, i) => (
                                    <div key={i} className={styles.trendBar}>
                                        <div className={styles.trendBars}>
                                            <div
                                                className={styles.trendBarSpend}
                                                style={{ height: `${(s.spent / maxTrendSpend) * 100}%` }}
                                                title={`${sym}${s.spent.toFixed(2)}`}
                                            />
                                            <div
                                                className={styles.trendBarCal}
                                                style={{ height: `${(s.cal / maxTrendCal) * 100}%` }}
                                                title={`${Math.round(s.cal)} kcal`}
                                            />
                                        </div>
                                        <span className={styles.trendLabel}>{s.date}</span>
                                    </div>
                                ))}
                            </div>
                            <div className={styles.trendLegend}>
                                <span className={styles.legendDot} style={{ background: 'var(--accent-green)' }} /> Spend
                                <span className={styles.legendDot} style={{ background: 'var(--accent-orange)' }} /> Calories
                            </div>
                        </section>
                    )}

                    {/* Category breakdown + macro breakdown side by side */}
                    <div className={styles.twoCol}>
                        {/* Category spending */}
                        <section className={`glass-card ${styles.section}`}>
                            <h2 className={styles.sectionTitle}><ShoppingBag size={18} /> Spend by Category</h2>
                            <div className={styles.catList}>
                                {catKeys.map(cat => (
                                    <div key={cat} className={styles.catRow}>
                                        <span className={styles.catLabel}>{cat}</span>
                                        <SparkBar value={catSpend[cat]} max={maxCatSpend} color="var(--accent-blue)" />
                                        <span className={styles.catValue}>{sym}{catSpend[cat].toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* Macro split */}
                        <section className={`glass-card ${styles.section}`}>
                            <h2 className={styles.sectionTitle}><Leaf size={18} /> Total Macro Split</h2>
                            <div className={styles.macroDonut}>
                                {/* Simple stacked bar */}
                                <div className={styles.macroStack}>
                                    {macroBreakdown.map(m => (
                                        <div
                                            key={m.label}
                                            className={styles.macroSegment}
                                            style={{ flex: m.val || 0.01, background: m.color }}
                                            title={`${m.label}: ${m.val.toFixed(1)}g`}
                                        />
                                    ))}
                                </div>
                                <div className={styles.macroLegend}>
                                    {macroBreakdown.map(m => (
                                        <div key={m.label} className={styles.macroLegendItem}>
                                            <span className={styles.macroLegendDot} style={{ background: m.color }} />
                                            <span className={styles.macroLegendLabel}>{m.label}</span>
                                            <span className={styles.macroLegendVal}>{m.val.toFixed(0)}g</span>
                                            <span className={styles.macroLegendPct}>
                                                ({Math.round(m.val / macroTotal * 100)}%)
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* Best & worst value */}
                    <div className={styles.twoCol}>
                        <section className={`glass-card ${styles.section}`}>
                            <h2 className={styles.sectionTitle}><Star size={18} style={{ color: 'var(--accent-green)' }} /> Best Nutritional Value</h2>
                            <p className={styles.sectionHint}>Highest nutrition score per dollar spent</p>
                            <div className={styles.rankList}>
                                {bestValue.map((item, i) => (
                                    <div key={item.id} className={styles.rankItem}>
                                        <span className={`${styles.rankNum} ${i === 0 ? styles.rankGold : i === 1 ? styles.rankSilver : i === 2 ? styles.rankBronze : ''}`}>
                                            #{i + 1}
                                        </span>
                                        <div className={styles.rankInfo}>
                                            <span className={styles.rankName}>{item.name}</span>
                                            <span className={styles.rankCat}>{item.category}</span>
                                        </div>
                                        <div className={styles.rankScores}>
                                            <span className={styles.rankScore} style={{ color: 'var(--accent-green)' }}>
                                                {item.score}/100
                                            </span>
                                            <span className={styles.rankPrice}>{sym}{item.price.toFixed(2)}</span>
                                        </div>
                                    </div>
                                ))}
                                {bestValue.length === 0 && <p className={styles.noData}>Not enough priced items yet.</p>}
                            </div>
                        </section>

                        <section className={`glass-card ${styles.section}`}>
                            <h2 className={styles.sectionTitle}><AlertTriangle size={18} style={{ color: 'var(--accent-orange)' }} /> Lowest Nutrition per Dollar</h2>
                            <p className={styles.sectionHint}>Consider healthier alternatives for these</p>
                            <div className={styles.rankList}>
                                {worstValue.map((item, i) => (
                                    <div key={item.id} className={styles.rankItem}>
                                        <span className={styles.rankNum} style={{ color: 'var(--text-tertiary)' }}>{i + 1}</span>
                                        <div className={styles.rankInfo}>
                                            <span className={styles.rankName}>{item.name}</span>
                                            <span className={styles.rankCat}>{item.category}</span>
                                        </div>
                                        <div className={styles.rankScores}>
                                            <span className={styles.rankScore} style={{ color: 'var(--accent-orange)' }}>
                                                {item.score}/100
                                            </span>
                                            <span className={styles.rankPrice}>{sym}{item.price.toFixed(2)}</span>
                                        </div>
                                    </div>
                                ))}
                                {worstValue.length === 0 && <p className={styles.noData}>Not enough priced items yet.</p>}
                            </div>
                        </section>
                    </div>

                    {/* Most bought foods */}
                    <section className={`glass-card ${styles.section}`}>
                        <h2 className={styles.sectionTitle}><RefreshCw size={18} /> Most Frequently Bought</h2>
                        <div className={styles.topFoodsGrid}>
                            {topFoods.map((food, i) => (
                                <div key={i} className={styles.topFoodCard}>
                                    <div className={styles.topFoodRank}>{i + 1}</div>
                                    <div className={styles.topFoodInfo}>
                                        <span className={styles.topFoodName}>{food.name}</span>
                                        <span className={styles.topFoodCat}>{food.category}</span>
                                    </div>
                                    <div className={styles.topFoodStats}>
                                        <span className={styles.topFoodCount}>×{food.count}</span>
                                        <span className={styles.topFoodSpent}>{sym}{food.totalSpent.toFixed(2)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Nutrient density leaderboard */}
                    {itemDensity.length > 0 && (
                        <section className={`glass-card ${styles.section}`}>
                            <h2 className={styles.sectionTitle}><Award size={18} /> Nutrient Density Leaderboard</h2>
                            <p className={styles.sectionHint}>Score based on protein, fiber, Vitamin C, iron, calcium and potassium</p>
                            <div className={styles.densityList}>
                                {itemDensity.slice(0, 10).map((item, i) => (
                                    <div key={item.id} className={styles.densityRow}>
                                        <span className={styles.densityRank}>{i + 1}</span>
                                        <div className={styles.densityInfo}>
                                            <span className={styles.densityName}>{item.name}</span>
                                            <span className={styles.densityCat}>{item.category}</span>
                                        </div>
                                        <div className={styles.densityBarWrap}>
                                            <SparkBar value={item.score} max={100}
                                                color={item.score >= 70 ? 'var(--accent-green)' : item.score >= 40 ? 'var(--accent-blue)' : 'var(--accent-orange)'} />
                                        </div>
                                        <span
                                            className={styles.densityScore}
                                            style={{ color: item.score >= 70 ? 'var(--accent-green)' : item.score >= 40 ? 'var(--accent-blue)' : 'var(--accent-orange)' }}
                                        >
                                            {item.score}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </>
            )}
        </div>
    );
}
