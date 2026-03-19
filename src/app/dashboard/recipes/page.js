'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { useAiOperations } from '@/lib/AiOperationsContext';
import FeatureFlow from '@/components/FeatureFlow';
import {
    ChefHat, Search, Loader, Clock, Flame, Apple,
    CheckCircle2, AlertCircle, ShoppingCart, Plus,
    Check, Trash2, Package, ArrowRight, Sparkles,
} from 'lucide-react';
import styles from './recipes.module.css';

const LS_KEY = 'foodlimit_shopping_list';

function loadShoppingList() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
}

function saveShoppingList(list) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch {}
}

let _uid = Date.now();
function uid() { return `sl_${_uid++}`; }

export default function RecipesPage() {
    const [pantryItems, setPantryItems]     = useState([]);
    const [selectedItems, setSelectedItems] = useState([]);
    const [dietary, setDietary]             = useState('Any');
    const [cuisine, setCuisine]             = useState('Any');

    const [recipes, setRecipes]             = useState(null);
    const [loading, setLoading]             = useState(false);
    const [error, setError]                 = useState('');
    const [fetchingPantry, setFetchingPantry] = useState(true);
    const [progress, setProgress]           = useState(0);
    const [progressText, setProgressText]   = useState('');

    // Shopping list state
    const [shoppingList, setShoppingList]   = useState([]);
    const [addedItems, setAddedItems]       = useState(new Set()); // tracks newly added this session

    const { startOperation, getCompleted, clearCompleted, isRunning } = useAiOperations();

    // Sync shopping list from localStorage on mount
    useEffect(() => { setShoppingList(loadShoppingList()); }, []);

    // Load pantry items
    useEffect(() => {
        const fetchPantry = async () => {
            try {
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data } = await supabase
                        .from('grocery_sessions')
                        .select('grocery_items(name)')
                        .order('session_date', { ascending: false })
                        .limit(5);

                    if (data) {
                        const items = new Set();
                        data.forEach(session => {
                            session.grocery_items?.forEach(item => {
                                if (item.name) items.add(item.name.toLowerCase());
                            });
                        });
                        setPantryItems(Array.from(items).sort());
                    }
                }
            } catch (err) {
                console.error('Error fetching pantry', err);
            } finally {
                setFetchingPantry(false);
            }
        };
        fetchPantry();
    }, []);

    // Load saved recipes from DB / background op context
    useEffect(() => {
        const completed = getCompleted('recipes');
        if (completed?.content?.recipes) {
            setRecipes(completed.content.recipes);
            clearCompleted('recipes');
            return;
        }
        const loadSaved = async () => {
            try {
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;
                const { data } = await supabase
                    .from('ai_generated_content')
                    .select('content, input_params, updated_at')
                    .eq('user_id', user.id)
                    .eq('content_type', 'recipes')
                    .single();
                if (data?.content?.recipes) setRecipes(data.content.recipes);
            } catch {}
        };
        loadSaved();
    }, [getCompleted, clearCompleted]);

    useEffect(() => {
        if (isRunning('recipes') && !loading) {
            setLoading(true);
            setProgressText('Generating recipes in background...');
            setProgress(50);
        }
    }, [isRunning, loading]);

    /* ── Collect missing ingredients across all recipes ── */
    const missingIngredients = useMemo(() => {
        if (!recipes) return [];
        const seen = new Set();
        const list = [];
        recipes.forEach(r => {
            (r.missing_ingredients || []).forEach(ing => {
                const key = ing.toLowerCase().trim();
                if (!seen.has(key)) { seen.add(key); list.push(ing.trim()); }
            });
        });
        return list;
    }, [recipes]);

    /* ── Shopping list helpers ── */
    const isInList   = name => shoppingList.some(i => i.name.toLowerCase() === name.toLowerCase());
    const wasAdded   = name => addedItems.has(name.toLowerCase());

    const addToList = (name) => {
        if (isInList(name)) return;
        const updated = [...shoppingList, { id: uid(), name, qty: '', category: 'Other', checked: false }];
        setShoppingList(updated);
        saveShoppingList(updated);
        setAddedItems(prev => new Set(prev).add(name.toLowerCase()));
    };

    const removeFromList = (name) => {
        const updated = shoppingList.filter(i => i.name.toLowerCase() !== name.toLowerCase());
        setShoppingList(updated);
        saveShoppingList(updated);
        setAddedItems(prev => { const s = new Set(prev); s.delete(name.toLowerCase()); return s; });
    };

    const addAll = () => {
        missingIngredients.forEach(ing => { if (!isInList(ing)) addToList(ing); });
    };

    const clearAdded = () => {
        const names = new Set(missingIngredients.map(i => i.toLowerCase()));
        const updated = shoppingList.filter(i => !names.has(i.name.toLowerCase()));
        setShoppingList(updated);
        saveShoppingList(updated);
        setAddedItems(new Set());
    };

    /* ── Generate recipes ── */
    const toggleItem   = item => setSelectedItems(prev =>
        prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
    );
    const selectAll    = () => setSelectedItems([...pantryItems]);
    const clearAllSel  = () => setSelectedItems([]);

    const generateRecipes = async () => {
        if (selectedItems.length === 0) { setError('Please select at least one ingredient.'); return; }
        setLoading(true); setError(''); setRecipes(null); setProgress(10);
        setProgressText('Selecting ingredients...');
        const progressInterval = setInterval(() => {
            setProgress(prev => prev >= 85 ? 85 : Math.min(prev + (prev < 40 ? Math.random() * 15 : Math.random() * 8), 85));
        }, 700);

        try {
            setProgressText('Consulting the AI chef...');
            const result = await startOperation('recipes', async () => {
                const res = await fetch('/api/generate-recipes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ingredients: selectedItems, dietary, cuisine }),
                });
                const data = await res.json();
                if (data.data?.recipes) return { data: data.data, provider: data.provider };
                throw new Error(data.error || 'Failed to generate recipes');
            }, { ingredients: selectedItems, dietary, cuisine });

            setProgress(95);
            if (result?.data?.recipes) {
                setRecipes(result.data.recipes);
                setAddedItems(new Set()); // reset for new results
            }
        } catch (err) {
            setError(err.message || 'Network error. Please try again.');
        } finally {
            clearInterval(progressInterval);
            setProgress(100); setProgressText('Done!');
            setTimeout(() => { setLoading(false); setProgress(0); }, 400);
        }
    };

    const addedCount     = missingIngredients.filter(i => isInList(i)).length;
    const missingCount   = missingIngredients.length;
    const flowItems = [
        {
            href: '/dashboard/recipes',
            label: 'Generate recipes',
            description: 'Choose pantry items and let AI produce meals around what you already have.',
            icon: ChefHat,
            state: 'current',
        },
        {
            href: '/dashboard/shopping-list',
            label: 'Add missing ingredients',
            description: 'Carry recipe gaps into your checklist instead of copying them by hand.',
            icon: ShoppingCart,
            state: recipes ? 'done' : 'next',
        },
        {
            href: '/dashboard/meal-planner',
            label: 'Turn ideas into a plan',
            description: 'When one recipe is not enough, move into the meal planner with the same pantry context.',
            icon: Sparkles,
            state: 'next',
        },
    ];

    return (
        <div className={styles.page}>
            {/* Header */}
            <div className={styles.header}>
                <h1 className={styles.title}>
                    <ChefHat size={28} style={{ color: 'var(--accent-orange)' }} />
                    AI Recipe Generator
                </h1>
                <p className={styles.subtitle}>Turn your recent groceries into delicious meals instantly.</p>
            </div>

            <FeatureFlow
                title="Cook From What You Bought"
                description="Recipe suggestions connect directly into the shopping list and meal planner so you can go from idea to action without re-entering ingredients."
                items={flowItems}
            />

            <div className={styles.layout}>
                {/* ── LEFT: Controls ── */}
                <aside className={styles.controls}>
                    <div className={styles.controlSection}>
                        <label className="input-label">Dietary Restriction</label>
                        <select className="input-field" value={dietary} onChange={e => setDietary(e.target.value)}>
                            <option value="None">None (Any)</option>
                            <option value="Vegetarian">Vegetarian</option>
                            <option value="Vegan">Vegan</option>
                            <option value="Keto">Keto</option>
                            <option value="Paleo">Paleo</option>
                            <option value="Gluten-Free">Gluten-Free</option>
                            <option value="High Protein">High Protein</option>
                        </select>
                    </div>

                    <div className={styles.controlSection}>
                        <label className="input-label">Cuisine Type</label>
                        <select className="input-field" value={cuisine} onChange={e => setCuisine(e.target.value)}>
                            <option value="Any">Any Cuisine</option>
                            <option value="Italian">Italian</option>
                            <option value="Mexican">Mexican</option>
                            <option value="Asian">Asian</option>
                            <option value="Indian">Indian</option>
                            <option value="Mediterranean">Mediterranean</option>
                            <option value="American">American</option>
                        </select>
                    </div>

                    <div className={styles.pantryHeader}>
                        <span className={styles.pantryTitle}>Your Pantry</span>
                        <div className={styles.pantryActions}>
                            <button className={styles.tinyBtn} onClick={selectAll}>All</button>
                            <button className={styles.tinyBtn} onClick={clearAllSel}>Clear</button>
                        </div>
                    </div>

                    <div className={styles.pantryGrid}>
                        {fetchingPantry ? (
                            <span className={styles.pantryEmpty}>Loading ingredients…</span>
                        ) : pantryItems.length > 0 ? (
                            pantryItems.map(item => (
                                <button
                                    key={item}
                                    onClick={() => toggleItem(item)}
                                    className={`${styles.pantryChip} ${selectedItems.includes(item) ? styles.pantryChipSelected : ''}`}
                                >
                                    {item}
                                </button>
                            ))
                        ) : (
                            <span className={styles.pantryEmpty}>No recent groceries. Add some first!</span>
                        )}
                    </div>

                    <button
                        onClick={generateRecipes}
                        className={`btn-primary ${styles.generateBtn}`}
                        disabled={loading || selectedItems.length === 0}
                    >
                        {loading
                            ? <><Loader size={18} className={styles.spin} /> Generating…</>
                            : <><ChefHat size={18} /> Create Recipes ({selectedItems.length})</>
                        }
                    </button>

                    {error && <p className={styles.errorText}>{error}</p>}
                </aside>

                {/* ── CENTER: Recipe results ── */}
                <main className={styles.results}>
                    {!loading && !recipes && (
                        <div className={styles.emptyState}>
                            <Search size={48} className={styles.emptyIcon} />
                            <h3>Ready to Cook?</h3>
                            <p>Select ingredients on the left and let AI design the perfect meal for you.</p>
                        </div>
                    )}

                    {loading && (
                        <div className={styles.loadingState}>
                            <ChefHat size={44} className={styles.chefPulse} />
                            <h3>{progressText}</h3>
                            <p>Analyzing flavor profiles and nutritional data…</p>
                            <div className={styles.progressWrap}>
                                <div className={styles.progressMeta}>
                                    <span>Progress</span>
                                    <span className={styles.progressPct}>{Math.round(progress)}%</span>
                                </div>
                                <div className={styles.progressTrack}>
                                    <div className={styles.progressFill} style={{ width: `${progress}%` }} />
                                </div>
                            </div>
                        </div>
                    )}

                    {recipes && recipes.map((recipe, index) => (
                        <div key={index} className={styles.recipeCard}>
                            {/* Recipe header */}
                            <div className={styles.recipeHeader}>
                                <div className={styles.recipeIndex}>{index + 1}</div>
                                <div className={styles.recipeTitleWrap}>
                                    <h2 className={styles.recipeTitle}>{recipe.title}</h2>
                                    <p className={styles.recipeDesc}>{recipe.description}</p>
                                </div>
                            </div>

                            {/* Meta badges */}
                            <div className={styles.recipeMeta}>
                                <span className={styles.metaBadge}>
                                    <Clock size={13} /> {recipe.prep_time_mins}m prep · {recipe.cook_time_mins}m cook
                                </span>
                                <span className={styles.metaBadge}>
                                    <Flame size={13} /> {recipe.difficulty}
                                </span>
                                {recipe.nutrition_estimates && (
                                    <span className={`${styles.metaBadge} ${styles.metaBadgeBlue}`}>
                                        <Apple size={13} />
                                        {recipe.nutrition_estimates.calories} kcal · {recipe.nutrition_estimates.protein_g}g protein
                                    </span>
                                )}
                            </div>

                            {/* Ingredients */}
                            <div className={styles.ingredientsGrid}>
                                <div className={styles.ingredientCol}>
                                    <h4 className={styles.ingTitle}>
                                        <CheckCircle2 size={15} style={{ color: 'var(--accent-green)' }} /> Have
                                    </h4>
                                    <ul className={styles.ingList}>
                                        {recipe.matched_ingredients?.map((ing, i) => (
                                            <li key={i} className={styles.ingItem}>
                                                <span className={styles.ingDotGreen} /> {ing}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div className={styles.ingredientCol}>
                                    <h4 className={styles.ingTitle}>
                                        <AlertCircle size={15} style={{ color: 'var(--accent-red)' }} /> Need to buy
                                    </h4>
                                    {recipe.missing_ingredients?.length > 0 ? (
                                        <ul className={styles.ingList}>
                                            {recipe.missing_ingredients.map((ing, i) => (
                                                <li key={i} className={styles.ingItem}>
                                                    <span className={styles.ingDotRed} /> {ing}
                                                    <button
                                                        className={`${styles.addIngBtn} ${isInList(ing) ? styles.addIngBtnDone : ''}`}
                                                        onClick={() => isInList(ing) ? removeFromList(ing) : addToList(ing)}
                                                        title={isInList(ing) ? 'Remove from shopping list' : 'Add to shopping list'}
                                                    >
                                                        {isInList(ing)
                                                            ? <Check size={11} />
                                                            : <Plus size={11} />
                                                        }
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className={styles.allGood}>
                                            <CheckCircle2 size={14} /> You have everything!
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Instructions */}
                            <div className={styles.instructions}>
                                <h4 className={styles.instrTitle}>Instructions</h4>
                                <ol className={styles.instrList}>
                                    {recipe.instructions?.map((step, i) => (
                                        <li key={i} className={styles.instrStep}>{step}</li>
                                    ))}
                                </ol>
                            </div>
                        </div>
                    ))}
                </main>

                {/* ── RIGHT: Shopping suggestions panel ── */}
                <aside className={styles.shopPanel}>
                    <div className={styles.shopPanelInner}>
                        <div className={styles.shopHeader}>
                            <div className={styles.shopHeaderLeft}>
                                <ShoppingCart size={18} style={{ color: 'var(--accent-green)' }} />
                                <span className={styles.shopTitle}>Shopping List</span>
                            </div>
                            {missingCount > 0 && (
                                <span className={styles.shopBadge}>{missingCount}</span>
                            )}
                        </div>

                        {!recipes && (
                            <div className={styles.shopEmpty}>
                                <Package size={36} opacity={0.2} />
                                <p>Generate recipes to see missing ingredients here.</p>
                            </div>
                        )}

                        {recipes && missingCount === 0 && (
                            <div className={styles.shopEmpty}>
                                <CheckCircle2 size={32} style={{ color: 'var(--accent-green)', opacity: 0.6 }} />
                                <p>You have all the ingredients! Nothing to buy.</p>
                            </div>
                        )}

                        {recipes && missingCount > 0 && (
                            <>
                                <p className={styles.shopSubtitle}>
                                    Missing ingredients across your recipes
                                </p>

                                {/* Add All / Clear button */}
                                <div className={styles.shopActions}>
                                    {addedCount < missingCount && (
                                        <button className={`btn-primary ${styles.addAllBtn}`} onClick={addAll}>
                                            <ShoppingCart size={14} /> Add All ({missingCount - addedCount})
                                        </button>
                                    )}
                                    {addedCount > 0 && (
                                        <button className={styles.clearBtn} onClick={clearAdded}>
                                            <Trash2 size={13} /> Remove
                                        </button>
                                    )}
                                </div>

                                {/* Missing items list */}
                                <div className={styles.shopItems}>
                                    {missingIngredients.map((ing, i) => {
                                        const inList = isInList(ing);
                                        const fresh  = wasAdded(ing);
                                        return (
                                            <div key={i} className={`${styles.shopItem} ${inList ? styles.shopItemAdded : ''}`}>
                                                <div className={styles.shopItemLeft}>
                                                    {inList
                                                        ? <Check size={14} style={{ color: 'var(--accent-green)', flexShrink: 0 }} />
                                                        : <AlertCircle size={14} style={{ color: 'var(--accent-red)', opacity: 0.7, flexShrink: 0 }} />
                                                    }
                                                    <span className={styles.shopItemName}>{ing}</span>
                                                    {fresh && <span className={styles.freshTag}>added</span>}
                                                </div>
                                                <button
                                                    className={`${styles.shopToggleBtn} ${inList ? styles.shopToggleBtnDone : ''}`}
                                                    onClick={() => inList ? removeFromList(ing) : addToList(ing)}
                                                    title={inList ? 'Remove from list' : 'Add to list'}
                                                >
                                                    {inList ? <Check size={13} /> : <Plus size={13} />}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Link to full shopping list */}
                                <a href="/dashboard/shopping-list" className={styles.shopLink}>
                                    <ShoppingCart size={14} /> View full shopping list
                                    <ArrowRight size={13} />
                                </a>

                                {/* Progress */}
                                {addedCount > 0 && (
                                    <div className={styles.shopProgress}>
                                        <div className={styles.shopProgressBar}>
                                            <div
                                                className={styles.shopProgressFill}
                                                style={{ width: `${(addedCount / missingCount) * 100}%` }}
                                            />
                                        </div>
                                        <span className={styles.shopProgressText}>
                                            {addedCount}/{missingCount} added
                                        </span>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Current list preview */}
                        {shoppingList.length > 0 && (
                            <div className={styles.listPreview}>
                                <div className={styles.listPreviewHeader}>
                                    <Sparkles size={13} style={{ color: 'var(--accent-purple)' }} />
                                    <span>Your list has {shoppingList.length} item{shoppingList.length !== 1 ? 's' : ''}</span>
                                </div>
                                <div className={styles.listPreviewItems}>
                                    {shoppingList.slice(0, 5).map(i => (
                                        <span key={i.id} className={`${styles.previewChip} ${i.checked ? styles.previewChipChecked : ''}`}>
                                            {i.name}
                                        </span>
                                    ))}
                                    {shoppingList.length > 5 && (
                                        <span className={styles.previewMore}>+{shoppingList.length - 5} more</span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </aside>
            </div>
        </div>
    );
}
