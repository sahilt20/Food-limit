'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabaseClient';
import FeatureFlow from '@/components/FeatureFlow';
import {
    ShoppingCart, Plus, Trash2, CheckSquare, Square,
    Package, RefreshCw, Import, AlertTriangle, X,
    ClipboardList, Copy, Check,
} from 'lucide-react';
import styles from './shopping-list.module.css';

const supabase = createClient();
const LS_KEY   = 'foodlimit_shopping_list';

const CATEGORY_COLORS = {
    Fruits: '#f97316', Vegetables: '#00d4aa', Protein: '#4d8dff',
    Dairy: '#fbbf24', Grains: '#a855f7', Beverages: '#22d3ee',
    Snacks: '#ff6b9d', Legumes: '#10b981', Oils: '#84cc16', Other: '#94a3b8',
};

function categoryColor(cat) { return CATEGORY_COLORS[cat] || CATEGORY_COLORS.Other; }

let _nextId = Date.now();
function uid() { return `item_${_nextId++}`; }

function loadList() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
}

function saveList(list) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch {}
}

// Group items by category
function groupBy(items, key) {
    return items.reduce((acc, item) => {
        const k = item[key] || 'Other';
        if (!acc[k]) acc[k] = [];
        acc[k].push(item);
        return acc;
    }, {});
}

export default function ShoppingListPage() {
    const [tab, setTab]           = useState('list');
    const [list, setList]         = useState([]);
    const [newName, setNewName]   = useState('');
    const [newQty, setNewQty]     = useState('');
    const [newCat, setNewCat]     = useState('Other');
    const [copied, setCopied]     = useState(false);

    // Import tab state
    const [mealPlanItems, setMealPlanItems] = useState([]);
    const [loadingMeal, setLoadingMeal]     = useState(false);
    const [mealError, setMealError]         = useState('');

    // Restock tab
    const [expiringItems, setExpiringItems] = useState([]);
    const [freqItems, setFreqItems]         = useState([]);
    const [loadingRestock, setLoadingRestock] = useState(false);

    // Load list from localStorage on mount
    useEffect(() => { setList(loadList()); }, []);

    // Persist on every change
    useEffect(() => { saveList(list); }, [list]);

    /* ── List actions ──────────────────────── */
    const addItem = useCallback(() => {
        const name = newName.trim();
        if (!name) return;
        setList(prev => [...prev, {
            id: uid(), name, qty: newQty.trim() || '', category: newCat, checked: false,
        }]);
        setNewName(''); setNewQty('');
    }, [newName, newQty, newCat]);

    const toggleItem  = id => setList(prev => prev.map(i => i.id === id ? { ...i, checked: !i.checked } : i));
    const deleteItem  = id => setList(prev => prev.filter(i => i.id !== id));
    const clearAll    = () => setList([]);
    const clearChecked = () => setList(prev => prev.filter(i => !i.checked));

    const addToList = (name, qty = '', category = 'Other') => {
        if (!list.find(i => i.name.toLowerCase() === name.toLowerCase())) {
            setList(prev => [...prev, { id: uid(), name, qty, category, checked: false }]);
        }
    };

    const copyList = () => {
        const text = list
            .map(i => `${i.checked ? '✓' : '○'} ${i.name}${i.qty ? ` (${i.qty})` : ''}`)
            .join('\n');
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    /* ── Import from AI Planner ────────────── */
    const loadMealPlan = useCallback(async () => {
        setLoadingMeal(true); setMealError('');
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');
            const { data } = await supabase
                .from('ai_generated_content')
                .select('content')
                .eq('user_id', user.id)
                .eq('content_type', 'meal_plan')
                .single();
            if (data?.content?.shopping_list?.length > 0) {
                setMealPlanItems(data.content.shopping_list);
            } else {
                setMealError('No saved pantry plan found. Generate one in AI Planner first.');
            }
        } catch (err) {
            setMealError(err.message || 'Failed to load meal plan');
        } finally {
            setLoadingMeal(false);
        }
    }, []);

    useEffect(() => { if (tab === 'import') loadMealPlan(); }, [tab, loadMealPlan]);

    const addAllMealItems = () => {
        mealPlanItems.forEach(item => {
            const name = typeof item === 'string' ? item : (item.name || String(item));
            addToList(name);
        });
    };

    /* ── Restock / Expiry ──────────────────── */
    const loadRestock = useCallback(async () => {
        setLoadingRestock(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() + 3);

            // Items expiring ≤3 days
            const { data: expItems } = await supabase
                .from('grocery_items')
                .select('id, name, quantity, unit, category, expiry_date, grocery_sessions!inner(user_id)')
                .eq('grocery_sessions.user_id', user.id)
                .lte('expiry_date', cutoff.toISOString().slice(0, 10))
                .not('expiry_date', 'is', null)
                .order('expiry_date', { ascending: true })
                .limit(20);

            setExpiringItems(expItems ?? []);

            // Most frequently bought items (top 8 names)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 60);
            const { data: sessions } = await supabase
                .from('grocery_sessions')
                .select('id')
                .eq('user_id', user.id)
                .gte('session_date', thirtyDaysAgo.toISOString().slice(0, 10));

            if (sessions?.length) {
                const { data: histItems } = await supabase
                    .from('grocery_items')
                    .select('name, category')
                    .in('session_id', sessions.map(s => s.id));

                // Count name frequencies
                const freq = {};
                (histItems ?? []).forEach(i => {
                    const k = i.name.toLowerCase();
                    if (!freq[k]) freq[k] = { name: i.name, category: i.category || 'Other', count: 0 };
                    freq[k].count++;
                });
                const sorted = Object.values(freq)
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 8);
                setFreqItems(sorted);
            }
        } catch (err) {
            console.error('Restock load error:', err);
        } finally {
            setLoadingRestock(false);
        }
    }, []);

    useEffect(() => { if (tab === 'restock') loadRestock(); }, [tab, loadRestock]);

    /* ── Derived ───────────────────────────── */
    const grouped      = groupBy(list, 'category');
    const checkedCount = list.filter(i => i.checked).length;
    const remaining    = list.length - checkedCount;
    const categories   = Object.keys(grouped).sort();
    const flowItems = [
        {
            href: '/dashboard/shopping-list',
            label: 'Keep the list current',
            description: 'Manage your checklist here, then import ingredients from other features when needed.',
            icon: ShoppingCart,
            state: 'current',
        },
        {
            href: '/dashboard/diet-plans?mode=pantry',
            label: 'Import from AI Planner',
            description: 'Pull missing items from your saved pantry plan instead of rebuilding the list.',
            icon: Import,
            state: mealPlanItems.length ? 'done' : 'next',
        },
        {
            href: '/dashboard/add',
            label: 'Log new groceries',
            description: 'After shopping, add the finished basket so the dashboard and plans stay in sync.',
            icon: Plus,
            state: 'next',
        },
    ];

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}><ShoppingCart size={22} /> Smart Shopping List</h1>
                    <p className={styles.subtitle}>Build your list, import from AI Planner, or restock expiring items.</p>
                </div>
                <div className={styles.headerActions}>
                    <button className={styles.iconBtn} onClick={copyList} title="Copy list as text">
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                </div>
            </div>

            <FeatureFlow
                title="Shopping Loop"
                description="This checklist now sits in the middle of the workflow: import from planning, use it in-store on mobile, then log the completed trip back into FoodLimit."
                items={flowItems}
            />

            {/* Tabs */}
            <div className={styles.tabs}>
                {[
                    { key: 'list',    label: 'My List',           badge: list.length },
                    { key: 'import',  label: 'Import Meal Plan',  badge: null },
                    { key: 'restock', label: 'Restock',           badge: expiringItems.length || null },
                ].map(t => (
                    <button
                        key={t.key}
                        className={`${styles.tab} ${tab === t.key ? styles.tabActive : ''}`}
                        onClick={() => setTab(t.key)}
                    >
                        {t.label}
                        {t.badge != null && t.badge > 0 && (
                            <span className={`${styles.badge} ${t.key === 'restock' && expiringItems.length ? styles.badgeRed : ''}`}>
                                {t.badge}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* ─── MY LIST TAB ─── */}
            {tab === 'list' && (
                <div className={styles.tabContent}>
                    {/* Add item */}
                    <div className={styles.addRow}>
                        <input
                            className={`${styles.addInput} input-field`}
                            placeholder="Add item..."
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addItem()}
                        />
                        <input
                            className={`${styles.qtyInput} input-field`}
                            placeholder="Qty"
                            value={newQty}
                            onChange={e => setNewQty(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addItem()}
                        />
                        <select
                            className={styles.catSelect}
                            value={newCat}
                            onChange={e => setNewCat(e.target.value)}
                        >
                            {Object.keys(CATEGORY_COLORS).map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                        <button className={`${styles.addBtn} btn-primary`} onClick={addItem}>
                            <Plus size={18} /> Add
                        </button>
                    </div>

                    {/* Empty state */}
                    {list.length === 0 && (
                        <div className={styles.empty}>
                            <ClipboardList size={48} opacity={0.25} />
                            <h3>Your list is empty</h3>
                            <p>Add items above, or import from your meal plan.</p>
                        </div>
                    )}

                    {/* Grouped list */}
                    {categories.map(cat => (
                        <div key={cat} className={styles.categoryGroup}>
                            <div className={styles.catHeader} style={{ '--cat-color': categoryColor(cat) }}>
                                <span className={styles.catDot} style={{ background: categoryColor(cat) }} />
                                <span className={styles.catName}>{cat}</span>
                                <span className={styles.catCount}>{grouped[cat].length}</span>
                            </div>
                            {grouped[cat].map(item => (
                                <div
                                    key={item.id}
                                    className={`${styles.listItem} ${item.checked ? styles.listItemChecked : ''}`}
                                >
                                    <button className={styles.checkBtn} onClick={() => toggleItem(item.id)}>
                                        {item.checked
                                            ? <CheckSquare size={20} style={{ color: 'var(--accent-green)' }} />
                                            : <Square size={20} style={{ color: 'var(--text-tertiary)' }} />
                                        }
                                    </button>
                                    <span className={styles.itemName}>{item.name}</span>
                                    {item.qty && <span className={styles.itemQty}>{item.qty}</span>}
                                    <button className={styles.deleteBtn} onClick={() => deleteItem(item.id)}>
                                        <X size={15} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    ))}

                    {/* Footer */}
                    {list.length > 0 && (
                        <div className={styles.footer}>
                            <span className={styles.footerCount}>
                                {remaining} item{remaining !== 1 ? 's' : ''} remaining
                            </span>
                            <div className={styles.footerActions}>
                                {checkedCount > 0 && (
                                    <button className={styles.clearBtn} onClick={clearChecked}>
                                        <CheckSquare size={15} /> Clear checked ({checkedCount})
                                    </button>
                                )}
                                <button className={`${styles.clearBtn} ${styles.clearAllBtn}`} onClick={clearAll}>
                                    <Trash2 size={15} /> Clear all
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ─── IMPORT MEAL PLAN TAB ─── */}
            {tab === 'import' && (
                <div className={styles.tabContent}>
                    <div className={styles.importHeader}>
                        <button className={styles.iconBtn} onClick={loadMealPlan} disabled={loadingMeal}>
                            <RefreshCw size={16} className={loadingMeal ? styles.spin : ''} />
                        </button>
                        {mealPlanItems.length > 0 && (
                            <button className="btn-primary" onClick={addAllMealItems}>
                                <Import size={16} /> Add All to List
                            </button>
                        )}
                    </div>

                    {mealError && (
                        <div className={styles.infoBox}>
                            <AlertTriangle size={16} /> {mealError}
                        </div>
                    )}

                    {loadingMeal && (
                        <div className={styles.loadingRows}>
                            {[1,2,3,4].map(n => <div key={n} className={`skeleton ${styles.skRow}`} />)}
                        </div>
                    )}

                    {!loadingMeal && mealPlanItems.length > 0 && (
                        <div className={styles.importList}>
                            <p className={styles.importHint}>
                                {mealPlanItems.length} items needed for your saved meal plan
                            </p>
                            {mealPlanItems.map((item, i) => {
                                const name  = typeof item === 'string' ? item : (item.name || String(item));
                                const inList = list.some(l => l.name.toLowerCase() === name.toLowerCase());
                                return (
                                    <div key={i} className={styles.importItem}>
                                        <Package size={14} className={styles.importIcon} />
                                        <span className={`${styles.importName} ${inList ? styles.importNameDone : ''}`}>
                                            {name}
                                        </span>
                                        {inList
                                            ? <span className={styles.inListBadge}><Check size={12} /> In list</span>
                                            : (
                                                <button
                                                    className={styles.addSmallBtn}
                                                    onClick={() => addToList(name)}
                                                >
                                                    <Plus size={14} /> Add
                                                </button>
                                            )
                                        }
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ─── RESTOCK TAB ─── */}
            {tab === 'restock' && (
                <div className={styles.tabContent}>
                    <div className={styles.importHeader}>
                        <button className={styles.iconBtn} onClick={loadRestock} disabled={loadingRestock}>
                            <RefreshCw size={16} className={loadingRestock ? styles.spin : ''} />
                        </button>
                    </div>

                    {loadingRestock && (
                        <div className={styles.loadingRows}>
                            {[1,2,3].map(n => <div key={n} className={`skeleton ${styles.skRow}`} />)}
                        </div>
                    )}

                    {!loadingRestock && (
                        <>
                            {/* Expiring items */}
                            {expiringItems.length > 0 && (
                                <div className={styles.restockSection}>
                                    <h3 className={styles.restockTitle}>
                                        <AlertTriangle size={16} style={{ color: 'var(--accent-orange)' }} />
                                        Expiring Soon — Consider Restocking
                                    </h3>
                                    {expiringItems.map(item => {
                                        const daysLeft = item.expiry_date
                                            ? Math.floor((new Date(item.expiry_date) - Date.now()) / 86_400_000)
                                            : null;
                                        const inList = list.some(l => l.name.toLowerCase() === item.name.toLowerCase());
                                        return (
                                            <div key={item.id} className={styles.importItem}>
                                                <span
                                                    className={styles.expiryTag}
                                                    style={{ color: daysLeft < 0 ? 'var(--accent-red)' : daysLeft <= 1 ? 'var(--accent-orange)' : 'var(--accent-yellow)' }}
                                                >
                                                    {daysLeft < 0 ? 'Expired' : daysLeft === 0 ? 'Today' : `${daysLeft}d`}
                                                </span>
                                                <span className={styles.importName}>{item.name}</span>
                                                <span className={styles.importMeta}>{item.quantity} {item.unit}</span>
                                                {inList
                                                    ? <span className={styles.inListBadge}><Check size={12} /> In list</span>
                                                    : (
                                                        <button
                                                            className={styles.addSmallBtn}
                                                            onClick={() => addToList(item.name, `${item.quantity} ${item.unit}`, item.category)}
                                                        >
                                                            <Plus size={14} /> Restock
                                                        </button>
                                                    )
                                                }
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Frequently bought */}
                            {freqItems.length > 0 && (
                                <div className={styles.restockSection}>
                                    <h3 className={styles.restockTitle}>
                                        <RefreshCw size={16} style={{ color: 'var(--accent-blue)' }} />
                                        Your Regulars — Frequently Bought
                                    </h3>
                                    {freqItems.map((item, i) => {
                                        const inList = list.some(l => l.name.toLowerCase() === item.name.toLowerCase());
                                        return (
                                            <div key={i} className={styles.importItem}>
                                                <span className={styles.freqBadge}>×{item.count}</span>
                                                <span className={styles.importName}>{item.name}</span>
                                                <span className={styles.importMeta}>{item.category}</span>
                                                {inList
                                                    ? <span className={styles.inListBadge}><Check size={12} /> In list</span>
                                                    : (
                                                        <button
                                                            className={styles.addSmallBtn}
                                                            onClick={() => addToList(item.name, '', item.category)}
                                                        >
                                                            <Plus size={14} /> Add
                                                        </button>
                                                    )
                                                }
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {expiringItems.length === 0 && freqItems.length === 0 && (
                                <div className={styles.empty}>
                                    <Package size={44} opacity={0.25} />
                                    <h3>Nothing to restock right now</h3>
                                    <p>Set expiry dates on your items to get restock suggestions here.</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
