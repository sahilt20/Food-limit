'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabaseClient';
import {
    Clock,
    AlertTriangle,
    CheckCircle2,
    Trash2,
    Calendar,
    RefreshCw,
    Package,
    AlertCircle,
} from 'lucide-react';
import styles from './expiry.module.css';

const supabase = createClient();

// Days-until-expiry thresholds
const STATUS = {
    expired:  { label: 'Expired',          color: '#ef4444', icon: AlertTriangle, days: -Infinity },
    critical: { label: 'Expires today/tomorrow', color: '#f97316', icon: AlertCircle, days: 1 },
    warning:  { label: 'Expires this week', color: '#fbbf24', icon: Clock, days: 7 },
    ok:       { label: 'Good',              color: '#00d4aa', icon: CheckCircle2, days: Infinity },
};

function getStatus(expiryDate) {
    if (!expiryDate) return null;
    const diff = Math.floor((new Date(expiryDate) - Date.now()) / 86_400_000);
    if (diff < 0)   return { ...STATUS.expired,  daysLeft: diff };
    if (diff <= 1)  return { ...STATUS.critical, daysLeft: diff };
    if (diff <= 7)  return { ...STATUS.warning,  daysLeft: diff };
    return { ...STATUS.ok, daysLeft: diff };
}

function formatDaysLeft(daysLeft) {
    if (daysLeft < 0)  return `Expired ${Math.abs(daysLeft)}d ago`;
    if (daysLeft === 0) return 'Expires today';
    if (daysLeft === 1) return 'Expires tomorrow';
    return `${daysLeft} days left`;
}

export default function ExpiryTracker() {
    const [items, setItems]       = useState([]);
    const [loading, setLoading]   = useState(true);
    const [saving, setSaving]     = useState(null);
    const [filter, setFilter]     = useState('all'); // all | expired | critical | warning | ok
    const [error, setError]       = useState('');

    const fetchItems = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            // Fetch recent grocery items with their session info
            const { data, error: dbErr } = await supabase
                .from('grocery_items')
                .select(`
                    id,
                    name,
                    quantity,
                    unit,
                    category,
                    expiry_date,
                    grocery_sessions!inner (
                        user_id,
                        session_name,
                        session_date,
                        store_name
                    )
                `)
                .eq('grocery_sessions.user_id', user.id)
                .order('expiry_date', { ascending: true, nullsLast: false });

            if (dbErr) throw dbErr;
            setItems(data ?? []);
        } catch (err) {
            console.error('Expiry fetch error:', err);
            setError('Could not load items. ' + (err.message ?? ''));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchItems(); }, [fetchItems]);

    const updateExpiry = async (itemId, expiryDate) => {
        setSaving(itemId);
        try {
            const { error: updateErr } = await supabase
                .from('grocery_items')
                .update({ expiry_date: expiryDate || null })
                .eq('id', itemId);
            if (updateErr) throw updateErr;
            setItems(prev => prev.map(i =>
                i.id === itemId ? { ...i, expiry_date: expiryDate || null } : i
            ));
        } catch (err) {
            console.error('Update expiry error:', err);
            alert('Failed to update: ' + err.message);
        } finally {
            setSaving(null);
        }
    };

    const clearExpiry = async (itemId) => {
        await updateExpiry(itemId, null);
    };

    // Filter items
    const filteredItems = items.filter(item => {
        if (filter === 'all') return true;
        const s = getStatus(item.expiry_date);
        if (!s) return filter === 'unset';
        if (filter === 'expired')  return s.daysLeft < 0;
        if (filter === 'critical') return s.daysLeft >= 0 && s.daysLeft <= 1;
        if (filter === 'warning')  return s.daysLeft > 1 && s.daysLeft <= 7;
        if (filter === 'ok')       return s.daysLeft > 7;
        return true;
    });

    // Counts for filter badges
    const counts = {
        all:      items.length,
        expired:  items.filter(i => { const s = getStatus(i.expiry_date); return s && s.daysLeft < 0; }).length,
        critical: items.filter(i => { const s = getStatus(i.expiry_date); return s && s.daysLeft >= 0 && s.daysLeft <= 1; }).length,
        warning:  items.filter(i => { const s = getStatus(i.expiry_date); return s && s.daysLeft > 1 && s.daysLeft <= 7; }).length,
        ok:       items.filter(i => { const s = getStatus(i.expiry_date); return s && s.daysLeft > 7; }).length,
        unset:    items.filter(i => !i.expiry_date).length,
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <h1 className={styles.title}>
                        <Clock size={24} />
                        Expiry Tracker
                    </h1>
                    <p className={styles.subtitle}>
                        Track expiry dates for your grocery items and reduce food waste.
                    </p>
                </div>
                <button className={styles.refreshBtn} onClick={fetchItems} disabled={loading} title="Refresh">
                    <RefreshCw size={18} className={loading ? styles.spinning : ''} />
                </button>
            </div>

            {/* Summary strip */}
            {!loading && (
                <div className={styles.summaryStrip}>
                    <div className={`${styles.summaryCard} ${styles.expired}`}>
                        <span className={styles.summaryNum}>{counts.expired}</span>
                        <span className={styles.summaryLabel}>Expired</span>
                    </div>
                    <div className={`${styles.summaryCard} ${styles.critical}`}>
                        <span className={styles.summaryNum}>{counts.critical}</span>
                        <span className={styles.summaryLabel}>Today / Tomorrow</span>
                    </div>
                    <div className={`${styles.summaryCard} ${styles.warning}`}>
                        <span className={styles.summaryNum}>{counts.warning}</span>
                        <span className={styles.summaryLabel}>This Week</span>
                    </div>
                    <div className={`${styles.summaryCard} ${styles.ok}`}>
                        <span className={styles.summaryNum}>{counts.ok}</span>
                        <span className={styles.summaryLabel}>Good</span>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className={styles.filters}>
                {[
                    { key: 'all',      label: 'All' },
                    { key: 'expired',  label: 'Expired' },
                    { key: 'critical', label: 'Critical' },
                    { key: 'warning',  label: 'This Week' },
                    { key: 'ok',       label: 'Good' },
                    { key: 'unset',    label: 'No Date' },
                ].map(f => (
                    <button
                        key={f.key}
                        className={`${styles.filterBtn} ${filter === f.key ? styles.filterActive : ''}`}
                        onClick={() => setFilter(f.key)}
                    >
                        {f.label}
                        {counts[f.key] > 0 && (
                            <span className={styles.filterBadge}>{counts[f.key]}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Error */}
            {error && (
                <div className={styles.errorBanner}>
                    <AlertTriangle size={16} /> {error}
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className={styles.loadingGrid}>
                    {[1,2,3,4,5,6].map(n => (
                        <div key={n} className={`${styles.skeletonCard} skeleton`} />
                    ))}
                </div>
            )}

            {/* Empty */}
            {!loading && filteredItems.length === 0 && (
                <div className={styles.emptyState}>
                    <Package size={48} className={styles.emptyIcon} />
                    <h3>No items found</h3>
                    <p>
                        {filter === 'all'
                            ? 'Add groceries first, then set expiry dates here.'
                            : `No items match the "${filter}" filter.`}
                    </p>
                </div>
            )}

            {/* Items grid */}
            {!loading && filteredItems.length > 0 && (
                <div className={styles.itemsGrid}>
                    {filteredItems.map(item => {
                        const status = getStatus(item.expiry_date);
                        const Icon = status?.icon ?? Calendar;
                        return (
                            <div
                                key={item.id}
                                className={styles.itemCard}
                                style={{ '--status-color': status?.color ?? 'var(--text-tertiary)' }}
                            >
                                <div className={styles.itemTop}>
                                    <div className={styles.itemInfo}>
                                        <div className={styles.categoryBadge}>{item.category ?? 'Other'}</div>
                                        <h3 className={styles.itemName}>{item.name}</h3>
                                        <p className={styles.itemMeta}>
                                            {item.quantity} {item.unit}
                                            {item.grocery_sessions?.store_name && (
                                                <> · {item.grocery_sessions.store_name}</>
                                            )}
                                        </p>
                                    </div>
                                    {status && (
                                        <div className={styles.statusBadge} style={{ color: status.color, background: `${status.color}1a` }}>
                                            <Icon size={14} />
                                            {formatDaysLeft(status.daysLeft)}
                                        </div>
                                    )}
                                </div>

                                <div className={styles.itemBottom}>
                                    <label className={styles.dateLabel}>
                                        <Calendar size={14} />
                                        Expiry date
                                    </label>
                                    <div className={styles.dateRow}>
                                        <input
                                            type="date"
                                            className={styles.dateInput}
                                            value={item.expiry_date ? item.expiry_date.slice(0, 10) : ''}
                                            min={new Date().toISOString().slice(0, 10)}
                                            onChange={e => updateExpiry(item.id, e.target.value)}
                                            disabled={saving === item.id}
                                        />
                                        {item.expiry_date && (
                                            <button
                                                className={styles.clearBtn}
                                                onClick={() => clearExpiry(item.id)}
                                                disabled={saving === item.id}
                                                title="Clear date"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                    {saving === item.id && (
                                        <p className={styles.savingText}>Saving…</p>
                                    )}
                                </div>

                                {/* Urgency bar */}
                                {status && (
                                    <div
                                        className={styles.urgencyBar}
                                        style={{ background: status.color }}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
