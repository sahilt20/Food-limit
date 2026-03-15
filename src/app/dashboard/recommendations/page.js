'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { 
    Sparkles, 
    ArrowRight, 
    CheckCircle2, 
    AlertCircle, 
    Loader,
    Apple,
    TrendingUp,
    HeartPulse,
    Store
} from 'lucide-react';
import styles from './recommendations.module.css';

export default function RecommendationsPage() {
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [historyData, setHistoryData] = useState({ top: [], recent: [] });
    const [recommendations, setRecommendations] = useState(null);
    const [error, setError] = useState('');

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
                        
                        // Extract recent items from the last 2 sessions
                        data.slice(0, 2).forEach(session => {
                            session.grocery_items?.forEach(i => {
                                if (i.name) recent.push(i.name);
                            });
                        });

                        // Calculate frequency for top items
                        data.forEach(session => {
                            session.grocery_items?.forEach(item => {
                                if (item.name) {
                                    const key = item.name.toLowerCase();
                                    if (!itemCounts[key]) {
                                        itemCounts[key] = { name: item.name, category: item.category, count: 0 };
                                    }
                                    itemCounts[key].count++;
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
                console.error("Error fetching history for recommendations", err);
                setError("Failed to load your purchase history.");
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, []);

    const generateRecommendations = async () => {
        if (historyData.top.length === 0) {
            setError("You need to log at least one grocery trip to get recommendations.");
            return;
        }

        setGenerating(true);
        setError('');

        try {
            const response = await fetch('/api/history-recommendations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    topItems: historyData.top,
                    recentItems: historyData.recent
                }),
            });
            const data = await response.json();

            if (data.data) {
                setRecommendations(data.data);
            } else if (data.error) {
                setError(data.error);
            } else {
                setError("Failed to generate recommendations. Please try again.");
            }
        } catch (err) {
            setError("Network error. Please try again.");
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div style={{ padding: 'max(20px, var(--space-xl))', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ marginBottom: 'var(--space-xl)', textAlign: 'center' }}>
                <h1 style={{ fontSize: '2.4rem', fontWeight: 800, margin: '0 0 var(--space-md) 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                    <Sparkles size={36} style={{ color: 'var(--accent-pink)' }} /> 
                    Smart Recommendations
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
                    We analyze your entire purchase history to discover brilliant nutritional pairings, identify critical gaps, and suggest effortless health improvements.
                </p>
                
                {historyData.top.length > 0 && !recommendations && !generating && (
                    <button 
                        onClick={generateRecommendations} 
                        className="btn-primary" 
                        style={{ marginTop: 'var(--space-lg)', padding: '14px 32px', fontSize: '1.1rem', borderRadius: '99px', background: 'var(--accent-pink)' }}
                    >
                        Analyze My Buying Habits
                    </button>
                )}
            </div>

            {loading && (
                <div style={{ textAlign: 'center', padding: '100px 20px' }}>
                    <Loader size={48} className={styles.spin} style={{ color: 'var(--accent-blue)', marginBottom: 'var(--space-md)' }} />
                    <h3 style={{ color: 'var(--text-primary)', margin: 0 }}>Reading your pantry history...</h3>
                </div>
            )}

            {!loading && historyData.top.length === 0 && (
                <div style={{ textAlign: 'center', padding: '100px 20px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border-color)' }}>
                    <TrendingUp size={48} style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--space-md)' }} />
                    <h3 style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', margin: '0 0 8px 0' }}>No History Found</h3>
                    <p style={{ color: 'var(--text-tertiary)', fontSize: '0.95rem' }}>Add some grocery sessions first so the AI can analyze your habits.</p>
                </div>
            )}

            {generating && (
                <div style={{ textAlign: 'center', padding: '100px 20px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
                    <Loader size={48} className={styles.spin} style={{ color: 'var(--accent-pink)', marginBottom: 'var(--space-md)' }} />
                    <h3 style={{ color: 'var(--text-primary)', margin: '0 0 12px 0', fontSize: '1.4rem' }}>Connecting to Culinary AI Engine...</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', maxWidth: '400px', margin: '0 auto' }}>Scanning your top 30 most frequently purchased items to formulate the perfect health strategy.</p>
                </div>
            )}

            {error && (
                <div style={{ background: 'var(--accent-red-dim)', border: '1px solid rgba(255, 107, 107, 0.3)', padding: '20px', borderRadius: '12px', textAlign: 'center', color: 'var(--accent-red)', marginBottom: 'var(--space-xl)' }}>
                    <AlertCircle size={24} style={{ marginBottom: '8px' }} />
                    <p style={{ margin: 0, fontWeight: 500 }}>{error}</p>
                </div>
            )}

            {recommendations && !generating && (
                <div className={styles.recommendationsContainer}>
                    
                    {/* Overall summary card */}
                    {recommendations.overall_advice && (
                        <div style={{ background: 'linear-gradient(135deg, rgba(244, 114, 182, 0.1) 0%, rgba(77, 141, 255, 0.1) 100%)', border: '1px solid rgba(244, 114, 182, 0.2)', padding: 'var(--space-xl)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-xl)', textAlign: 'center' }}>
                            <HeartPulse size={32} style={{ color: 'var(--accent-pink)', marginBottom: 'var(--space-md)' }} />
                            <h2 style={{ color: 'var(--text-primary)', margin: '0 0 12px 0', fontSize: '1.5rem' }}>AI Dietitian Assessment</h2>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', lineHeight: 1.6, margin: 0, fontStyle: 'italic' }}>"{recommendations.overall_advice}"</p>
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-xl)' }}>
                        
                        {/* Perfect Complements */}
                        <div className={styles.recSection}>
                            <h3 className={styles.sectionTitle} style={{ color: 'var(--accent-green)' }}>
                                <CheckCircle2 size={22} /> Perfect Complements
                            </h3>
                            <p className={styles.sectionSubtitle}>Add these to what you already buy for a massive nutritional boost.</p>
                            
                            <div className={styles.cardsList}>
                                {recommendations.complements?.map((comp, i) => (
                                    <div key={i} className={styles.actionCard}>
                                        <div className={styles.cardHeader}>
                                            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '1.1rem' }}>+ {comp.item_to_add}</span>
                                            <span style={{ fontSize: '0.8rem', background: 'var(--bg-card-hover)', padding: '4px 10px', borderRadius: '99px', color: 'var(--text-secondary)' }}>Pairs with {comp.because_you_buy}</span>
                                        </div>
                                        <p className={styles.cardReason}>{comp.reason}</p>
                                        {comp.suggested_store && (
                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: 'var(--accent-pink)', background: 'rgba(244, 114, 182, 0.1)', padding: '4px 10px', borderRadius: '6px', marginTop: 'var(--space-sm)' }}>
                                                <Store size={14} /> Buy at: {comp.suggested_store}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Healthy Swaps */}
                        <div className={styles.recSection}>
                            <h3 className={styles.sectionTitle} style={{ color: 'var(--accent-blue)' }}>
                                <ArrowRight size={22} /> Healthy Improvements
                            </h3>
                            <p className={styles.sectionSubtitle}>Simple, effective swaps for your most frequent purchases.</p>

                            <div className={styles.cardsList}>
                                {recommendations.improvements?.map((imp, i) => (
                                    <div key={i} className={styles.actionCard}>
                                        <div className={styles.swapHeader}>
                                            <span style={{ color: 'var(--text-secondary)', textDecoration: 'line-through' }}>{imp.original_item}</span>
                                            <ArrowRight size={16} style={{ color: 'var(--accent-blue)' }} />
                                            <span style={{ fontWeight: 600, color: 'var(--accent-blue)' }}>{imp.better_alternative}</span>
                                        </div>
                                        <p className={styles.cardReason}>{imp.reason}</p>
                                        {imp.suggested_store && (
                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: 'var(--accent-pink)', background: 'rgba(244, 114, 182, 0.1)', padding: '4px 10px', borderRadius: '6px', marginTop: 'var(--space-sm)' }}>
                                                <Store size={14} /> Buy at: {imp.suggested_store}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Nutritional Gaps */}
                        <div className={styles.recSection}>
                            <h3 className={styles.sectionTitle} style={{ color: 'var(--accent-orange)' }}>
                                <AlertCircle size={22} /> Mind The Gaps
                            </h3>
                            <p className={styles.sectionSubtitle}>Critical nutrients missing from your recent hauls.</p>

                            <div className={styles.cardsList}>
                                {recommendations.nutritional_gaps?.map((gap, i) => (
                                    <div key={i} className={styles.actionCard} style={{ borderLeft: '4px solid var(--accent-orange)' }}>
                                        <div className={styles.cardHeader} style={{ marginBottom: '8px' }}>
                                            <span style={{ fontWeight: 600, color: 'var(--accent-orange)', fontSize: '1.05rem' }}>Missing: {gap.missing_nutrient}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--text-primary)', fontWeight: 500 }}>
                                            <Apple size={16} style={{ color: 'var(--accent-green)' }} /> Fix with: {gap.suggestion}
                                        </div>
                                        <p className={styles.cardReason}>{gap.reason}</p>
                                        {gap.suggested_store && (
                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: 'var(--accent-pink)', background: 'rgba(244, 114, 182, 0.1)', padding: '4px 10px', borderRadius: '6px', marginTop: 'var(--space-sm)' }}>
                                                <Store size={14} /> Buy at: {gap.suggested_store}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}
