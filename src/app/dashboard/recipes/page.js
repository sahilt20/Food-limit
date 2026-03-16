'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { useAiOperations } from '@/lib/AiOperationsContext';
import { ChefHat, Search, Loader, Clock, Flame, Apple, CheckCircle2, AlertCircle } from 'lucide-react';
import styles from './recipes.module.css';

export default function RecipesPage() {
    const [pantryItems, setPantryItems] = useState([]);
    const [selectedItems, setSelectedItems] = useState([]);
    const [dietary, setDietary] = useState('Any');
    const [cuisine, setCuisine] = useState('Any');

    const [recipes, setRecipes] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [fetchingPantry, setFetchingPantry] = useState(true);
    const [progress, setProgress] = useState(0);
    const [progressText, setProgressText] = useState('');

    const { startOperation, getCompleted, clearCompleted, isRunning } = useAiOperations();

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
                console.error("Error fetching pantry", err);
            } finally {
                setFetchingPantry(false);
            }
        };
        fetchPantry();
    }, []);

    // Load saved recipes from DB + check context for background-completed results
    useEffect(() => {
        // Check context first (fresher data from background op)
        const completed = getCompleted('recipes');
        if (completed?.content?.recipes) {
            setRecipes(completed.content.recipes);
            clearCompleted('recipes');
            return;
        }

        // Fall back to DB
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
                if (data?.content?.recipes) {
                    setRecipes(data.content.recipes);
                }
            } catch {}
        };
        loadSaved();
    }, [getCompleted, clearCompleted]);

    // If a background op is running, show loading state
    useEffect(() => {
        if (isRunning('recipes') && !loading) {
            setLoading(true);
            setProgressText('Generating recipes in background...');
            setProgress(50);
        }
    }, [isRunning, loading]);

    const toggleItem = (item) => {
        if (selectedItems.includes(item)) {
            setSelectedItems(selectedItems.filter(i => i !== item));
        } else {
            setSelectedItems([...selectedItems, item]);
        }
    };

    const selectAll = () => setSelectedItems([...pantryItems]);
    const clearAll = () => setSelectedItems([]);

    const generateRecipes = async () => {
        if (selectedItems.length === 0) {
            setError("Please select at least one ingredient from your pantry.");
            return;
        }

        setLoading(true);
        setError('');
        setRecipes(null);
        setProgress(10);
        setProgressText('Selecting ingredients...');

        const progressInterval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 85) return 85;
                const increment = prev < 40 ? Math.random() * 15 : Math.random() * 8;
                return Math.min(prev + increment, 85);
            });
        }, 700);

        const inputParams = { ingredients: selectedItems, dietary, cuisine };

        try {
            setProgressText('Consulting the AI chef...');
            const result = await startOperation('recipes', async () => {
                const response = await fetch('/api/generate-recipes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(inputParams),
                });
                const data = await response.json();
                if (data.data?.recipes) {
                    return { data: data.data, provider: data.provider };
                }
                throw new Error(data.error || 'Failed to generate recipes');
            }, inputParams);

            setProgress(95);
            if (result?.data?.recipes) {
                setRecipes(result.data.recipes);
            }
        } catch (err) {
            setError(err.message || "Network error. Please try again.");
        } finally {
            clearInterval(progressInterval);
            setProgress(100);
            setProgressText('Done!');
            setTimeout(() => { setLoading(false); setProgress(0); }, 400);
        }
    };

    return (
        <div style={{ padding: 'max(20px, var(--space-xl))', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ marginBottom: 'var(--space-xl)' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 var(--space-xs) 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <ChefHat size={32} style={{ color: 'var(--accent-orange)' }} /> AI Recipe Generator
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', margin: 0 }}>
                    Turn your recent groceries into delicious meals instantly.
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: 'var(--space-xl)' }}>
                {/* Left Column: Controls */}
                <div style={{ background: 'var(--bg-card)', padding: 'var(--space-lg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', height: 'fit-content' }}>
                    <h3 style={{ fontSize: '1.2rem', marginBottom: 'var(--space-md)', color: 'var(--text-primary)' }}>Preferences</h3>

                    <div style={{ marginBottom: 'var(--space-md)' }}>
                        <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>Dietary Restriction</label>
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

                    <div style={{ marginBottom: 'var(--space-lg)' }}>
                        <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>Cuisine Type</label>
                        <select className="input-field" value={cuisine} onChange={e => setCuisine(e.target.value)}>
                            <option value="Any">Any Cuisine</option>
                            <option value="Italian">Italian</option>
                            <option value="Mexican">Mexican</option>
                            <option value="Asian">Asian (General)</option>
                            <option value="Indian">Indian</option>
                            <option value="Mediterranean">Mediterranean</option>
                            <option value="American">American</option>
                        </select>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
                        <h3 style={{ fontSize: '1.1rem', margin: 0, color: 'var(--text-primary)' }}>Your Pantry</h3>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={selectAll} style={{ fontSize: '0.75rem', padding: '4px 8px', background: 'var(--bg-card-hover)', border: 'none', borderRadius: '4px', color: 'var(--text-secondary)', cursor: 'pointer' }}>Select All</button>
                            <button onClick={clearAll} style={{ fontSize: '0.75rem', padding: '4px 8px', background: 'var(--bg-card-hover)', border: 'none', borderRadius: '4px', color: 'var(--text-secondary)', cursor: 'pointer' }}>Clear</button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '300px', overflowY: 'auto', paddingRight: '8px', marginBottom: 'var(--space-lg)' }}>
                        {fetchingPantry ? (
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Loading ingredients...</span>
                        ) : pantryItems.length > 0 ? (
                            pantryItems.map(item => (
                                <button
                                    key={item}
                                    onClick={() => toggleItem(item)}
                                    style={{
                                        padding: '6px 14px',
                                        borderRadius: '99px',
                                        fontSize: '0.85rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        border: selectedItems.includes(item) ? '1px solid var(--accent-orange)' : '1px solid var(--border-color)',
                                        background: selectedItems.includes(item) ? 'var(--accent-orange-dim)' : 'transparent',
                                        color: selectedItems.includes(item) ? 'var(--accent-orange)' : 'var(--text-primary)',
                                    }}
                                >
                                    {item}
                                </button>
                            ))
                        ) : (
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No recent groceries found. Go add some!</span>
                        )}
                    </div>

                    <button
                        onClick={generateRecipes}
                        className="btn-primary"
                        style={{ width: '100%', padding: '14px' }}
                        disabled={loading || selectedItems.length === 0}
                    >
                        {loading ? <><Loader size={18} className="spin" /> Generating Magic...</> : <><ChefHat size={18} /> Create Recipes</>}
                    </button>
                    {error && <p style={{ color: 'var(--accent-red)', fontSize: '0.85rem', marginTop: 'var(--space-sm)', textAlign: 'center' }}>{error}</p>}
                </div>

                {/* Right Column: Results */}
                <div>
                    {!loading && !recipes && !error && (
                        <div style={{ textAlign: 'center', padding: '100px 20px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border-color)' }}>
                            <Search size={48} style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--space-md)' }} />
                            <h3 style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', margin: '0 0 8px 0' }}>Ready to Cook?</h3>
                            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.95rem' }}>Select your ingredients and let AI design the perfect meal.</p>
                        </div>
                    )}

                    {loading && (
                        <div style={{ textAlign: 'center', padding: '80px 20px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
                            <ChefHat size={40} style={{ color: 'var(--accent-orange)', marginBottom: 'var(--space-md)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                            <h3 style={{ color: 'var(--text-primary)', margin: '0 0 8px 0' }}>{progressText}</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 'var(--space-lg)' }}>Analyzing flavor profiles and nutritional data</p>
                            <div style={{ maxWidth: 360, margin: '0 auto' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.78rem' }}>
                                    <span style={{ color: 'var(--text-tertiary)' }}>Progress</span>
                                    <span style={{ color: 'var(--accent-orange)', fontWeight: 700 }}>{Math.round(progress)}%</span>
                                </div>
                                <div style={{ height: 8, background: 'var(--bg-glass)', borderRadius: 99, overflow: 'hidden' }}>
                                    <div style={{
                                        height: '100%', borderRadius: 99,
                                        background: 'linear-gradient(90deg, var(--accent-orange), var(--accent-yellow))',
                                        width: `${progress}%`,
                                        transition: 'width 0.5s ease-out',
                                    }} />
                                </div>
                            </div>
                        </div>
                    )}

                    {recipes && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
                            {recipes.map((recipe, index) => (
                                <div key={index} style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                                    <div style={{ padding: 'var(--space-lg)', borderBottom: '1px solid var(--border-color)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div>
                                                <h2 style={{ margin: '0 0 8px 0', fontSize: '1.6rem', color: 'var(--accent-orange)' }}>{recipe.title}</h2>
                                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: '0 0 16px 0' }}>{recipe.description}</p>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-card-hover)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                <Clock size={14} /> Prep: {recipe.prep_time_mins}m | Cook: {recipe.cook_time_mins}m
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-card-hover)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                <Flame size={14} /> Difficulty: {recipe.difficulty}
                                            </div>
                                            {recipe.nutrition_estimates && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(77,141,255,0.1)', color: 'var(--accent-blue)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.85rem' }}>
                                                    <Apple size={14} /> {recipe.nutrition_estimates.calories} kcal | {recipe.nutrition_estimates.protein_g}g protein
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div style={{ padding: 'var(--space-lg)' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)', marginBottom: 'var(--space-xl)' }}>
                                            <div>
                                                <h4 style={{ margin: '0 0 12px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <CheckCircle2 size={16} style={{ color: 'var(--accent-green)' }} /> Ingredients You Have
                                                </h4>
                                                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    {recipe.matched_ingredients?.map((ing, i) => (
                                                        <li key={i} style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-green)' }} /> {ing}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <div>
                                                <h4 style={{ margin: '0 0 12px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <AlertCircle size={16} style={{ color: 'var(--accent-red)' }} /> Missing Ingredients
                                                </h4>
                                                {recipe.missing_ingredients?.length > 0 ? (
                                                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                        {recipe.missing_ingredients.map((ing, i) => (
                                                            <li key={i} style={{ color: 'var(--accent-red)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-red)' }} /> {ing}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    <span style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem', fontStyle: 'italic' }}>You have everything needed!</span>
                                                )}
                                            </div>
                                        </div>

                                        <div>
                                            <h4 style={{ margin: '0 0 16px 0', color: 'var(--text-primary)' }}>Instructions</h4>
                                            <ol style={{ paddingLeft: '20px', margin: 0, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.95rem', lineHeight: 1.5 }}>
                                                {recipe.instructions?.map((step, i) => (
                                                    <li key={i}>{step}</li>
                                                ))}
                                            </ol>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
