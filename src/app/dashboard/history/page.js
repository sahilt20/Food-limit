'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabaseClient';
import {
    Calendar,
    ShoppingCart,
    Flame,
    DollarSign,
    Search,
    Filter,
    ChevronRight,
    Package,
} from 'lucide-react';
import styles from './history.module.css';

const DEMO_SESSIONS = [
    { id: '1', session_name: 'Weekly Groceries', session_date: '2026-02-09', store_name: 'Whole Foods', total_spent: 85.40, total_calories: 12500, total_items: 15 },
    { id: '2', session_name: 'Quick Stop', session_date: '2026-02-07', store_name: "Trader Joe's", total_spent: 32.10, total_calories: 5800, total_items: 8 },
    { id: '3', session_name: 'Monthly Stock Up', session_date: '2026-02-03', store_name: 'Costco', total_spent: 156.80, total_calories: 28400, total_items: 24 },
    { id: '4', session_name: 'Fruit Run', session_date: '2026-01-30', store_name: 'Farmers Market', total_spent: 28.50, total_calories: 3200, total_items: 10 },
    { id: '5', session_name: 'Dinner Party Prep', session_date: '2026-01-25', store_name: 'Whole Foods', total_spent: 72.30, total_calories: 9800, total_items: 12 },
    { id: '6', session_name: 'Meal Prep Sunday', session_date: '2026-01-20', store_name: "Trader Joe's", total_spent: 64.20, total_calories: 11200, total_items: 18 },
    { id: '7', session_name: 'Snack Run', session_date: '2026-01-15', store_name: 'Target', total_spent: 22.90, total_calories: 4500, total_items: 6 },
    { id: '8', session_name: 'Holiday Shopping', session_date: '2026-01-10', store_name: 'Costco', total_spent: 198.50, total_calories: 35000, total_items: 30 },
];

export default function HistoryPage() {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSession, setSelectedSession] = useState(null);

    useEffect(() => {
        const loadSessions = async () => {
            const isDemo = localStorage.getItem('foodlimit_demo');
            if (isDemo) {
                setSessions(DEMO_SESSIONS);
                setLoading(false);
                return;
            }

            const supabase = createClient();
            const { data } = await supabase
                .from('grocery_sessions')
                .select('*')
                .order('session_date', { ascending: false });

            setSessions(data || []);
            setLoading(false);
        };
        loadSessions();
    }, []);

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
                        <span className={styles.summaryValue}>${totalSpent.toFixed(0)}</span>
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
                                <ChevronRight size={18} className={styles.chevron} />
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
                                        ${(session.total_spent || 0).toFixed(2)}
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
