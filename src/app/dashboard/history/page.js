'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { formatCurrency } from '@/lib/currency';
import {
    Calendar,
    ShoppingCart,
    Flame,
    DollarSign,
    Search,
    Filter,
    ChevronRight,
    Package,
    Trash2,
} from 'lucide-react';
import styles from './history.module.css';

export default function HistoryPage() {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currency, setCurrency] = useState('USD');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSession, setSelectedSession] = useState(null);

    useEffect(() => {
        const loadSessions = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                const [{ data: sessionsData }, { data: profData }] = await Promise.all([
                    supabase
                        .from('grocery_sessions')
                        .select('*')
                        .order('session_date', { ascending: false }),
                    supabase
                        .from('profiles')
                        .select('currency_preference')
                        .eq('id', user.id)
                        .single()
                ]);

                if (profData) setCurrency(profData.currency_preference || 'USD');
                setSessions(sessionsData || []);
            } else {
                setSessions([]);
            }
            setLoading(false);
        };
        loadSessions();
    }, []);

    const handleDeleteSession = async (id) => {
        if (!window.confirm("Are you sure you want to permanently delete this shopping trip?")) return;

        const supabase = createClient();
        const { error } = await supabase
            .from('grocery_sessions')
            .delete()
            .eq('id', id);

        if (!error) {
            setSessions(sessions.filter(s => s.id !== id));
        } else {
            console.error("Error deleting session:", error);
            alert("Failed to delete session.");
        }
    };

    const filtered = sessions.filter(s =>
        s.session_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.store_name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const totalSpent = sessions.reduce((s, sess) => s + (sess.total_spent || 0), 0);
    const totalCalories = sessions.reduce((s, sess) => s + (sess.total_calories || 0), 0);
    const totalItems = sessions.reduce((s, sess) => s + (sess.total_items || 0), 0);

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const getRelativeDate = (dateStr) => {
        const now = new Date();
        const date = new Date(dateStr);
        const diff = Math.floor((now - date) / (1000 * 60 * 60 * 24));
        if (diff === 0) return 'Today';
        if (diff === 1) return 'Yesterday';
        if (diff < 7) return `${diff} days ago`;
        if (diff < 30) return `${Math.floor(diff / 7)} weeks ago`;
        return `${Math.floor(diff / 30)} months ago`;
    };

    if (loading) {
        return (
            <div className={styles.loadingContainer}>
                <div className={styles.loadingPulse}>
                    <ShoppingCart size={48} />
                </div>
                <p>Loading history...</p>
            </div>
        );
    }

    return (
        <div className={styles.historyPage}>
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>Shopping History</h1>
                    <p className={styles.pageSubtitle}>Review your past grocery sessions and trending data</p>
                </div>
            </div>

            {/* Summary Stats */}
            <div className={styles.summaryGrid}>
                <div className={styles.summaryCard}>
                    <ShoppingCart size={20} className={styles.summaryIcon} style={{ color: 'var(--accent-green)' }} />
                    <div>
                        <span className={styles.summaryValue}>{sessions.length}</span>
                        <span className={styles.summaryLabel}>Total Trips</span>
                    </div>
                </div>
                <div className={styles.summaryCard}>
                    <DollarSign size={20} className={styles.summaryIcon} style={{ color: 'var(--accent-blue)' }} />
                    <div>
                        <span className={styles.summaryValue}>{formatCurrency(totalSpent, currency)}</span>
                        <span className={styles.summaryLabel}>Total Spent</span>
                    </div>
                </div>
                <div className={styles.summaryCard}>
                    <Flame size={20} className={styles.summaryIcon} style={{ color: 'var(--accent-orange)' }} />
                    <div>
                        <span className={styles.summaryValue}>{(totalCalories / 1000).toFixed(1)}k</span>
                        <span className={styles.summaryLabel}>Total Calories</span>
                    </div>
                </div>
                <div className={styles.summaryCard}>
                    <Package size={20} className={styles.summaryIcon} style={{ color: 'var(--accent-purple)' }} />
                    <div>
                        <span className={styles.summaryValue}>{totalItems}</span>
                        <span className={styles.summaryLabel}>Total Items</span>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className={styles.searchBar}>
                <Search size={18} className={styles.searchIcon} />
                <input
                    className="input-field"
                    placeholder="Search sessions or store names..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ paddingLeft: '44px' }}
                />
            </div>

            {/* Timeline */}
            <div className={styles.timeline}>
                {filtered.map((session, idx) => (
                    <div
                        key={session.id}
                        className={styles.timelineItem}
                        style={{ animationDelay: `${idx * 0.08}s` }}
                    >
                        <div className={styles.timelineDot} />
                        <div className={styles.timelineCard}>
                            <div className={styles.timelineCardHeader}>
                                <div>
                                    <h3 className={styles.sessionTitle}>{session.session_name}</h3>
                                    <div className={styles.sessionMeta}>
                                        <span><Calendar size={13} /> {formatDate(session.session_date)}</span>
                                        <span className={styles.relativeDate}>{getRelativeDate(session.session_date)}</span>
                                        {session.store_name && <span>📍 {session.store_name}</span>}
                                    </div>
                                </div>
                                <button 
                                    onClick={() => handleDeleteSession(session.id)}
                                    className={styles.deleteBtn}
                                    title="Delete Session"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                            <div className={styles.timelineStats}>
                                <div className={styles.sessionStatItem}>
                                    <span className={styles.statNumber}>{session.total_items || 0}</span>
                                    <span className={styles.statDesc}>Items</span>
                                </div>
                                <div className={styles.sessionStatItem}>
                                    <span className={styles.statNumber} style={{ color: 'var(--accent-orange)' }}>
                                        {(session.total_calories || 0).toLocaleString()}
                                    </span>
                                    <span className={styles.statDesc}>Calories</span>
                                </div>
                                <div className={styles.sessionStatItem}>
                                    <span className={styles.statNumber} style={{ color: 'var(--accent-green)' }}>
                                        {formatCurrency(session.total_spent || 0, currency)}
                                    </span>
                                    <span className={styles.statDesc}>Spent</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
                {filtered.length === 0 && (
                    <div className={styles.emptyState}>
                        <Search size={48} style={{ color: 'var(--text-muted)' }} />
                        <h4>No sessions found</h4>
                        <p>Try adjusting your search query</p>
                    </div>
                )}
            </div>
        </div>
    );
}
