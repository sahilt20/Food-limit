'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { useAiOperations } from '@/lib/AiOperationsContext';
import FeatureFlow from '@/components/FeatureFlow';
import {
    Sparkles,
    ArrowRight,
    CheckCircle2,
    AlertCircle,
    Loader,
    Apple,
    HeartPulse,
    Store,
    ShoppingCart,
    CalendarDays,
} from 'lucide-react';
import styles from './recommendations.module.css';

export default function RecommendationsPage() {
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [historyData, setHistoryData] = useState({ top: [], recent: [] });
    const [recommendations, setRecommendations] = useState(null);
    const [error, setError] = useState('');
    const [progress, setProgress] = useState(0);
    const [progressText, setProgressText] = useState('');

    const { startOperation, getCompleted, clearCompleted, isRunning } = useAiOperations();

    useEffect(() => {
        const completed = getCompleted('recommendations');
        if (completed?.content) {
            setRecommendations(completed.content);
            clearCompleted('recommendations');
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
                    .eq('content_type', 'recommendations')
                    .single();
                if (data?.content) {
                    setRecommendations(data.content);
                }
            } catch {}
        };

        loadSaved();
    }, [getCompleted, clearCompleted]);

    useEffect(() => {
        if (isRunning('recommendations') && !generating) {
            setGenerating(true);
            setProgressText('Generating recommendations in background...');
            setProgress(50);
        }
    }, [isRunning, generating]);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data } = await supabase
                        .from('grocery_sessions')
                        .select('grocery_items(name, category, price)')
                        .order('session_date', { ascending: false });

                    if (data && data.length > 0) {
                        const itemCounts = {};
                        const recent = [];

                        data.slice(0, 2).forEach((session) => {
                            session.grocery_items?.forEach((item) => {
                                if (item.name) recent.push(item.name);
                            });
                        });

                        data.forEach((session) => {
                            session.grocery_items?.forEach((item) => {
                                if (item.name) {
                                    const key = item.name.toLowerCase();
                                    if (!itemCounts[key]) {
                                        itemCounts[key] = { name: item.name, category: item.category, count: 0 };
                                    }
                                    itemCounts[key].count += 1;
                                }
                            });
                        });

                        const top = Object.values(itemCounts)
                            .sort((a, b) => b.count - a.count)
                            .slice(0, 30);

                        setHistoryData({ top, recent });
                    }
                }
            } catch (err) {
                console.error('Error fetching history for recommendations', err);
                setError('Failed to load your purchase history.');
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, []);

    const generateRecommendations = async () => {
        if (historyData.top.length === 0) {
            setError('You need to log at least one grocery trip to get recommendations.');
            return;
        }

        setGenerating(true);
        setError('');
        setProgress(10);
        setProgressText('Scanning purchase history...');

        const progressInterval = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 85) return 85;
                const increment = prev < 40 ? Math.random() * 14 : Math.random() * 8;
                return Math.min(prev + increment, 85);
            });
        }, 700);

        const inputParams = { topItems: historyData.top, recentItems: historyData.recent };

        try {
            setProgressText('AI analyzing your buying patterns...');
            const result = await startOperation(
                'recommendations',
                async () => {
                    const response = await fetch('/api/history-recommendations', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(inputParams),
                    });
                    const data = await response.json();
                    if (data.data) {
                        return { data: data.data, provider: data.provider };
                    }
                    throw new Error(data.error || 'Failed to generate recommendations');
                },
                inputParams
            );

            setProgress(95);
            if (result?.data) {
                setRecommendations(result.data);
            }
        } catch (err) {
            setError(err.message || 'Network error. Please try again.');
        } finally {
            clearInterval(progressInterval);
            setProgress(100);
            setProgressText('Done!');
            setTimeout(() => {
                setGenerating(false);
                setProgress(0);
            }, 400);
        }
    };

    const flowItems = [
        {
            href: '/dashboard/recommendations',
            label: 'Analyze buying patterns',
            description: 'Use purchase history to identify repeat behaviors, weak spots, and practical improvements.',
            icon: Sparkles,
            state: 'current',
        },
        {
            href: '/dashboard/add',
            label: 'Apply improvements on the next trip',
            description: 'Take the recommended swaps into your next grocery logging flow.',
            icon: ShoppingCart,
            state: recommendations ? 'done' : 'next',
        },
        {
            href: '/dashboard/meal-planner',
            label: 'Turn advice into meals',
            description: 'Use better ingredients in the planner once you know what to add or replace.',
            icon: CalendarDays,
            state: 'next',
        },
    ];

    const sections = [
        {
            key: 'complements',
            title: 'Perfect Complements',
            subtitle: 'Add these around what you already buy for better nutrient coverage.',
            icon: CheckCircle2,
            accent: 'green',
            items: recommendations?.complements || [],
            render: (item) => (
                <>
                    <div className={styles.cardHeader}>
                        <span className={styles.cardTitle}>+ {item.item_to_add}</span>
                        <span className={styles.cardMeta}>Pairs with {item.because_you_buy}</span>
                    </div>
                    <p className={styles.cardReason}>{item.reason}</p>
                    {item.suggested_store && (
                        <span className={styles.storeTag}>
                            <Store size={14} />
                            Buy at {item.suggested_store}
                        </span>
                    )}
                </>
            ),
        },
        {
            key: 'improvements',
            title: 'Healthier Improvements',
            subtitle: 'Simple swaps that fit your current shopping habits.',
            icon: ArrowRight,
            accent: 'blue',
            items: recommendations?.improvements || [],
            render: (item) => (
                <>
                    <div className={styles.swapRow}>
                        <span className={styles.swapOld}>{item.original_item}</span>
                        <ArrowRight size={15} />
                        <span className={styles.swapNew}>{item.better_alternative}</span>
                    </div>
                    <p className={styles.cardReason}>{item.reason}</p>
                    {item.suggested_store && (
                        <span className={styles.storeTag}>
                            <Store size={14} />
                            Buy at {item.suggested_store}
                        </span>
                    )}
                </>
            ),
        },
        {
            key: 'gaps',
            title: 'Mind The Gaps',
            subtitle: 'Critical nutrients or food groups missing from recent baskets.',
            icon: AlertCircle,
            accent: 'orange',
            items: recommendations?.nutritional_gaps || [],
            render: (item) => (
                <>
                    <div className={styles.cardHeader}>
                        <span className={styles.cardTitle}>Missing: {item.missing_nutrient}</span>
                    </div>
                    <p className={styles.fixRow}>
                        <Apple size={15} />
                        Fix with {item.suggestion}
                    </p>
                    <p className={styles.cardReason}>{item.reason}</p>
                    {item.suggested_store && (
                        <span className={styles.storeTag}>
                            <Store size={14} />
                            Buy at {item.suggested_store}
                        </span>
                    )}
                </>
            ),
        },
    ];

    return (
        <div className={styles.page}>
            <div className={styles.hero}>
                <div className={styles.heroText}>
                    <span className={styles.kicker}>AI Nutrition Assistant</span>
                    <h1 className={styles.title}>
                        <Sparkles size={30} />
                        Smart Recommendations
                    </h1>
                    <p className={styles.subtitle}>
                        Analyze your grocery history, find repeat mistakes, and turn the next shop into a cleaner, easier decision.
                    </p>
                </div>

                <div className={styles.heroActions}>
                    <button
                        onClick={generateRecommendations}
                        className="btn-primary"
                        disabled={generating || historyData.top.length === 0}
                    >
                        {generating ? (
                            <>
                                <Loader size={16} className={styles.spin} />
                                Generating...
                            </>
                        ) : (
                            <>
                                <Sparkles size={16} />
                                Analyze My Buying Habits
                            </>
                        )}
                    </button>
                    <Link href="/dashboard/add" className="btn-secondary">
                        <ShoppingCart size={16} />
                        Log Groceries
                    </Link>
                </div>
            </div>

            <FeatureFlow
                title="Recommendations That Feed The Next Trip"
                description="This page is now tied into the rest of the product: review what to improve, log the next grocery session, then bring the better basket into planning."
                items={flowItems}
            />

            {loading && (
                <div className={styles.centerState}>
                    <Loader size={42} className={styles.spin} />
                    <h3>Loading your purchase history</h3>
                    <p>We need a clean view of your recent grocery data before recommendations can be generated.</p>
                </div>
            )}

            {generating && (
                <div className={styles.centerState}>
                    <Sparkles size={42} className={styles.pulse} />
                    <h3>{progressText}</h3>
                    <p>Reviewing repeat purchases, identifying gaps, and building practical suggestions.</p>
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

            {error && (
                <div className={styles.errorBox}>
                    <AlertCircle size={18} />
                    <p>{error}</p>
                </div>
            )}

            {!loading && !generating && !recommendations && !error && (
                <div className={styles.centerState}>
                    <HeartPulse size={42} className={styles.emptyIcon} />
                    <h3>Ready to analyze your habits</h3>
                    <p>Generate recommendations once you have enough purchase history. The results will point directly into your next grocery and meal-planning steps.</p>
                </div>
            )}

            {recommendations && !generating && (
                <div className={styles.content}>
                    {recommendations.overall_advice && (
                        <section className={styles.summaryCard}>
                            <HeartPulse size={28} className={styles.summaryIcon} />
                            <div>
                                <h2>AI Dietitian Assessment</h2>
                                <p>{recommendations.overall_advice}</p>
                            </div>
                        </section>
                    )}

                    <div className={styles.sectionsGrid}>
                        {sections.map((section) => (
                            <section key={section.key} className={styles.recSection}>
                                <div className={styles.sectionHeader}>
                                    <h3 className={styles.sectionTitle}>
                                        <section.icon size={20} className={styles[`icon_${section.accent}`]} />
                                        {section.title}
                                    </h3>
                                    <p className={styles.sectionSubtitle}>{section.subtitle}</p>
                                </div>

                                <div className={styles.cardsList}>
                                    {section.items.length > 0 ? (
                                        section.items.map((item, index) => (
                                            <article key={index} className={`${styles.actionCard} ${styles[`card_${section.accent}`]}`}>
                                                {section.render(item)}
                                            </article>
                                        ))
                                    ) : (
                                        <div className={styles.emptyBlock}>No suggestions in this section yet.</div>
                                    )}
                                </div>
                            </section>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
