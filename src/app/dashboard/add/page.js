'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { lookupNutrition, getAllFoods, getCategories, NUTRIENT_INFO } from '@/lib/nutritionDB';
import { formatCurrency } from '@/lib/currency';
import {
    Upload,
    FileText,
    Plus,
    Trash2,
    Search,
    ShoppingCart,
    Sparkles,
    Check,
    AlertCircle,
    ChevronDown,
    Save,
    Loader,
    Image as ImageIcon,
    X,
    Brain,
    Leaf,
    ArrowRight,
    Heart,
    TrendingUp,
} from 'lucide-react';
import styles from './add.module.css';

const UNITS = ['g', 'kg', 'piece', 'oz', 'lb', 'cup', 'ml', 'L'];
const CATEGORIES = ['Fruits', 'Vegetables', 'Protein', 'Dairy', 'Grains', 'Legumes', 'Oils', 'Snacks', 'Beverages', 'Spices', 'Other'];

const UNIT_TO_GRAMS = {
    g: 1,
    kg: 1000,
    piece: 150,
    oz: 28.35,
    lb: 453.6,
    cup: 240,
    ml: 1,
    L: 1000,
};

export default function AddGroceriesPage() {
    const [activeTab, setActiveTab] = useState('manual');
    const [sessionName, setSessionName] = useState('');
    const [storeName, setStoreName] = useState('');
    const [items, setItems] = useState([
        { id: 1, name: '', quantity: 1, unit: 'piece', price: 0, category: 'Other' },
    ]);
    const [analyzed, setAnalyzed] = useState(false);
    const [nutritionResults, setNutritionResults] = useState([]);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [analyzing, setAnalyzing] = useState(false);
    const [analyzeStep, setAnalyzeStep] = useState(''); // New state for progress text
    const [aiSummary, setAiSummary] = useState(null);
    const [recommendations, setRecommendations] = useState(null);
    const [showFoodPicker, setShowFoodPicker] = useState(null);
    const [currency, setCurrency] = useState('USD');

    useEffect(() => {
        const fetchCurrency = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase.from('profiles').select('currency_preference').eq('id', user.id).single();
                if (data) setCurrency(data.currency_preference || 'USD');
            }
        };
        fetchCurrency();
    }, []);

    // Receipt upload state
    const [receiptImage, setReceiptImage] = useState(null);
    const [receiptPreview, setReceiptPreview] = useState(null);
    const [ocrProgress, setOcrProgress] = useState(0);
    const [ocrStatus, setOcrStatus] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [ocrText, setOcrText] = useState('');
    const [extractedItems, setExtractedItems] = useState([]);
    const fileInputRef = useRef(null);

    const allFoods = getAllFoods();

    const addItem = () => {
        setItems([...items, {
            id: Date.now(),
            name: '',
            quantity: 1,
            unit: 'piece',
            price: 0,
            category: 'Other',
        }]);
        setAnalyzed(false);
    };

    const removeItem = (id) => {
        if (items.length <= 1) return;
        setItems(items.filter(i => i.id !== id));
        setAnalyzed(false);
    };

    const updateItem = (id, field, value) => {
        setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i));
        setAnalyzed(false);
    };

    const selectFood = (itemId, food) => {
        setItems(items.map(i => i.id === itemId ? {
            ...i,
            name: food.name,
            category: food.category || 'Other',
        } : i));
        setShowFoodPicker(null);
        setSearchQuery('');
        setAnalyzed(false);
    };

    // ========== Receipt Upload Logic ==========
    const handleFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const file = e.dataTransfer?.files?.[0];
        if (file) processFile(file);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const processFile = (file) => {
        if (!file.type.startsWith('image/')) {
            setError('Please upload an image file (JPG, PNG, etc.)');
            return;
        }
        setReceiptImage(file);
        setReceiptPreview(URL.createObjectURL(file));
        setOcrText('');
        setExtractedItems([]);
        setError('');
    };

    const clearReceipt = () => {
        setReceiptImage(null);
        setReceiptPreview(null);
        setOcrText('');
        setExtractedItems([]);
        setOcrProgress(0);
        setOcrStatus('');
        setIsProcessing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const runOCR = async () => {
        if (!receiptImage) return;
        setIsProcessing(true);
        setOcrProgress(0);
        setOcrStatus('Sending to AI for analysis...');
        setError('');

        // Simulate progress while waiting for AI
        const progressInterval = setInterval(() => {
            setOcrProgress(prev => {
                if (prev >= 90) return 90;
                return prev + Math.random() * 15;
            });
        }, 500);

        try {
            const formData = new FormData();
            formData.append('receipt', receiptImage);

            setOcrStatus('🤖 AI analyzing your receipt...');
            setOcrProgress(20);

            const response = await fetch('/api/analyze-receipt', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                // AI failed (quota exceeded, no keys, etc.) — fall back to browser OCR
                clearInterval(progressInterval);
                setOcrStatus('AI unavailable — switching to browser OCR (Tesseract.js)...');
                setOcrProgress(10);
                await runTesseractFallback();
                return;
            }

            clearInterval(progressInterval);
            setOcrProgress(100);

            const parsed = data.data;
            setOcrText(JSON.stringify(parsed, null, 2));

            // Show which AI provider was used
            const providerLabel = data.provider === 'openai' ? 'OpenAI' : 'Gemini';

            if (parsed.error) {
                setError(parsed.error);
                setExtractedItems([]);
                setOcrStatus('Could not read receipt');
            } else {
                // Map AI response to our item format
                const items = (parsed.items || []).map((item, idx) => ({
                    id: Date.now() + idx,
                    name: item.name || 'Unknown Item',
                    quantity: item.quantity || 1,
                    unit: item.unit || 'piece',
                    price: item.price || 0,
                    category: item.category || 'Other',
                }));

                setExtractedItems(items);
                setOcrStatus(`✨ ${providerLabel} found ${items.length} item(s)`);

                if (parsed.store_name) {
                    setStoreName(parsed.store_name);
                }
            }
        } catch (err) {
            // Network error — also fall back to browser OCR
            clearInterval(progressInterval);
            setOcrStatus('Network error — switching to browser OCR...');
            setOcrProgress(10);
            try {
                await runTesseractFallback();
            } catch {
                setError('All receipt analysis methods failed. Please enter items manually.');
                setOcrStatus('Failed');
                setIsProcessing(false);
            }
        } finally {
            clearInterval(progressInterval);
        }
    };

    // Fallback to Tesseract.js if Gemini is not available
    const runTesseractFallback = async () => {
        try {
            const Tesseract = (await import('tesseract.js')).default;

            const result = await Tesseract.recognize(receiptImage, 'eng', {
                logger: (m) => {
                    if (m.status === 'recognizing text') {
                        setOcrProgress(Math.round(m.progress * 100));
                        setOcrStatus('Recognizing text (Tesseract.js)...');
                    } else if (m.status === 'loading tesseract core') {
                        setOcrStatus('Loading OCR engine...');
                    } else if (m.status === 'loading language traineddata') {
                        setOcrStatus('Loading language data...');
                    }
                },
            });

            const text = result.data.text;
            setOcrText(text);
            setOcrStatus('Extracting items...');

            const parsed = parseReceiptText(text);
            setExtractedItems(parsed);
            setOcrStatus(`Found ${parsed.length} item(s) (OCR)`);
        } catch (err) {
            setError('OCR failed: ' + (err.message || 'Unknown error'));
            setOcrStatus('Failed');
        } finally {
            setIsProcessing(false);
        }
    };

    const parseReceiptText = (text) => {
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);
        const items = [];
        const priceRegex = /\$?\d+\.\d{2}/;
        const skipWords = ['total', 'subtotal', 'tax', 'change', 'cash', 'card', 'visa', 'mastercard',
            'debit', 'credit', 'balance', 'savings', 'member', 'thank', 'welcome', 'receipt',
            'store', 'date', 'time', 'tel', 'phone', 'address', 'qty', 'price', '---', '===',
            'rewards', 'discount', 'coupon', 'payment', 'tender', 'approved'];

        for (const line of lines) {
            const lower = line.toLowerCase();
            if (skipWords.some(w => lower.includes(w))) continue;
            if (/^[\d\s\-\.\/\#\*]+$/.test(line)) continue;
            if (line.replace(/[^a-zA-Z]/g, '').length < 3) continue;

            const priceMatch = line.match(priceRegex);
            let name = line;
            let price = 0;
            if (priceMatch) {
                price = parseFloat(priceMatch[0].replace('$', ''));
                name = line.replace(priceRegex, '').trim();
            }
            name = name.replace(/^[\d\s\-\*]+/, '').replace(/[\s\-\*]+$/, '').trim();
            if (name.length < 2) continue;
            name = name.replace(/\b\w/g, c => c.toUpperCase());

            items.push({
                id: Date.now() + items.length,
                name, quantity: 1, unit: 'piece', price, category: 'Other',
            });
        }
        return items;
    };

    const useExtractedItems = () => {
        if (extractedItems.length === 0) return;
        setItems(extractedItems);
        setActiveTab('manual');
        setSessionName(sessionName || 'Receipt Upload');
        setAnalyzed(false);
    };

    const analyzeNutrition = async () => {
        const validItems = items.filter(i => i.name.trim());
        if (validItems.length === 0) {
            setError('Please add at least one item with a name');
            return;
        }

        setAnalyzing(true);
        setAnalyzeStep('Step 1/2: Analyzing nutrition macros...');
        setError('');
        setAiSummary(null);
        setRecommendations(null);
        setNutritionResults([]);

        try {
            // Call AI nutrition analysis
            const response = await fetch('/api/analyze-nutrition', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: validItems }),
            });

            const data = await response.json();

            if (!response.ok) {
                // Fallback to local DB if AI unavailable
                if (data.error?.includes('API key')) {
                    const results = items.map(item => {
                        if (!item.name.trim()) return { ...item, nutrition: null, matched: false };
                        const gramsMultiplier = UNIT_TO_GRAMS[item.unit] || 100;
                        const totalGrams = item.quantity * gramsMultiplier;
                        const nutrition = lookupNutrition(item.name, totalGrams);
                        return { ...item, nutrition, matched: nutrition !== null };
                    });
                    setNutritionResults(results);
                    setAnalyzed(true);
                    setAnalyzing(false);
                    return;
                }
                throw new Error(data.error || 'Analysis failed');
            }

            const aiData = data.data;
            setAiSummary(aiData.summary);

            // Map AI results back to items
            const results = items.map(item => {
                if (!item.name.trim()) return { ...item, nutrition: null, matched: false };
                const aiItem = aiData.items?.find(ai =>
                    ai.name.toLowerCase().includes(item.name.toLowerCase()) ||
                    item.name.toLowerCase().includes(ai.name.toLowerCase())
                );
                if (aiItem) {
                    return { ...item, nutrition: aiItem, matched: true };
                }
                return { ...item, nutrition: null, matched: false };
            });

            setNutritionResults(results);
            
            // Advance progress and await recommendations before finalizing
            setAnalyzeStep('Step 2/2: Finding healthier alternatives...');
            await fetchRecommendations(validItems, storeName);
            
            setAnalyzed(true);

        } catch (err) {
            setError('Analysis failed: ' + (err.message || 'Unknown error'));
        } finally {
            setAnalyzing(false);
            setAnalyzeStep('');
        }
    };

    const fetchRecommendations = async (itemsList, store) => {
        try {
            const response = await fetch('/api/recommend-foods', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: itemsList, storeName: store }),
            });
            const data = await response.json();
            if (response.ok && data.data) {
                setRecommendations(data.data.recommendations);
            }
        } catch (e) {
            // Silently fail — recommendations are optional
        }
    };

    const handleSave = async () => {
        setError('');

        if (!sessionName.trim()) {
            setError('Please enter a session name');
            return;
        }

        const validItems = nutritionResults.filter(r => r.name.trim());
        if (validItems.length === 0) {
            setError('Please add at least one item');
            return;
        }

        setSaving(true);

        try {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                setError('Not logged in');
                setSaving(false);
                return;
            }

            // Calculate totals
            const totalSpent = validItems.reduce((s, i) => s + (i.price || 0), 0);
            const totalCalories = validItems.reduce((s, i) => s + (i.nutrition?.calories || 0), 0);

            // Create session
            const { data: session, error: sessErr } = await supabase
                .from('grocery_sessions')
                .insert({
                    user_id: user.id,
                    session_name: sessionName,
                    store_name: storeName,
                    total_spent: totalSpent,
                    total_calories: totalCalories,
                    total_items: validItems.length,
                    ai_summary: aiSummary,
                    recommendations: recommendations,
                })
                .select()
                .single();

            if (sessErr) throw sessErr;

            // Insert items
            for (const item of validItems) {
                const { data: groceryItem, error: itemErr } = await supabase
                    .from('grocery_items')
                    .insert({
                        session_id: session.id,
                        name: item.name,
                        quantity: item.quantity,
                        unit: item.unit,
                        price: item.price,
                        category: item.category,
                    })
                    .select()
                    .single();

                if (itemErr) throw itemErr;

                // Insert nutrition data if available
                if (item.nutrition) {
                    const { category, ...nutritionData } = item.nutrition;
                    await supabase
                        .from('nutrition_data')
                        .insert({
                            item_id: groceryItem.id,
                            ...nutritionData,
                        });
                }
            }

            setSaved(true);
        } catch (err) {
            setError(err.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    const filteredFoods = allFoods.filter(f =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const totalPrice = items.reduce((s, i) => s + (parseFloat(i.price) || 0), 0);
    const totalAnalyzedCalories = nutritionResults.reduce((s, r) => s + (r.nutrition?.calories || 0), 0);
    const totalProtein = nutritionResults.reduce((s, r) => s + (r.nutrition?.protein_g || 0), 0);
    const totalCarbs = nutritionResults.reduce((s, r) => s + (r.nutrition?.carbs_g || 0), 0);
    const totalFat = nutritionResults.reduce((s, r) => s + (r.nutrition?.fat_g || 0), 0);
    const totalSugar = nutritionResults.reduce((s, r) => s + (r.nutrition?.sugar_g || 0), 0);
    const totalSalt = nutritionResults.reduce((s, r) => s + (r.nutrition?.salt_g || 0), 0);

    if (saved) {
        return (
            <div className={styles.successContainer}>
                <div className={styles.successCard}>
                    <div className={styles.successIcon}>✅</div>
                    <h2>Session Saved!</h2>
                    <p>Your grocery data and nutrition analysis have been saved.</p>
                    <div className={styles.successStats}>
                        <div className={styles.successStat}>
                            <span>{nutritionResults.filter(r => r.matched).length}</span>
                            <label>Items Analyzed</label>
                        </div>
                        <div className={styles.successStat}>
                            <span>{Math.round(totalAnalyzedCalories).toLocaleString()}</span>
                            <label>Total Calories</label>
                        </div>
                        <div className={styles.successStat}>
                            <span>{formatCurrency(totalPrice, currency)}</span>
                            <label>Total Spent</label>
                        </div>
                    </div>
                    <button onClick={() => {
                        setSaved(false);
                        setAnalyzed(false);
                        setItems([{ id: 1, name: '', quantity: 1, unit: 'piece', price: 0, category: 'Other' }]);
                        setSessionName('');
                        setStoreName('');
                        setNutritionResults([]);
                    }} className="btn-primary">
                        Add Another Session
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.addPage}>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Add Groceries</h1>
                <p className={styles.pageSubtitle}>Enter your grocery items and get detailed nutrition analysis</p>
            </div>

            {/* Tabs */}
            <div className={styles.tabs}>
                <button
                    className={`${styles.tab} ${activeTab === 'manual' ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab('manual')}
                >
                    <FileText size={18} />
                    Manual Entry
                </button>
                <button
                    className={`${styles.tab} ${activeTab === 'receipt' ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab('receipt')}
                >
                    <Upload size={18} />
                    Receipt Upload
                </button>
            </div>

            {activeTab === 'receipt' && (
                <div className={styles.receiptSection}>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className={styles.hiddenInput}
                    />

                    {!receiptPreview ? (
                        /* Upload Zone */
                        <div
                            className={styles.uploadZone}
                            onClick={() => fileInputRef.current?.click()}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                        >
                            <Upload size={48} className={styles.uploadIcon} />
                            <h3>Upload Receipt Image</h3>
                            <p>Drag and drop or click to upload your receipt</p>
                            <button className="btn-secondary" style={{ marginTop: '16px' }} onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                                Choose File
                            </button>
                        </div>
                    ) : (
                        /* Preview + OCR */
                        <div className={styles.receiptPreviewSection}>
                            <div className={styles.previewHeader}>
                                <h3><ImageIcon size={18} /> Receipt Preview</h3>
                                <button onClick={clearReceipt} className={styles.clearBtn}>
                                    <X size={16} /> Clear
                                </button>
                            </div>

                            <div className={styles.previewContainer}>
                                <img src={receiptPreview} alt="Receipt" className={styles.previewImage} />
                            </div>

                            {/* OCR Progress */}
                            {isProcessing && (
                                <div className={styles.ocrProgress}>
                                    <div className={styles.progressHeader}>
                                        <Loader size={16} className={styles.spinningIcon} />
                                        <span>{ocrStatus}</span>
                                        <span className={styles.progressPercent}>{ocrProgress}%</span>
                                    </div>
                                    <div className={styles.progressBar}>
                                        <div className={styles.progressFill} style={{ width: `${ocrProgress}%` }} />
                                    </div>
                                </div>
                            )}

                            {/* Scan Button */}
                            {!isProcessing && !ocrText && (
                                <button onClick={runOCR} className="btn-primary" style={{ width: '100%', padding: '16px', marginTop: 'var(--space-md)' }}>
                                    <Sparkles size={18} />
                                    Scan Receipt with AI
                                </button>
                            )}

                            {/* OCR Results */}
                            {ocrText && (
                                <div className={styles.ocrResults}>
                                    <div className={styles.ocrResultsHeader}>
                                        <h4>📝 Extracted Text</h4>
                                        <span className={styles.ocrBadge}>{extractedItems.length} items found</span>
                                    </div>

                                    <div className={styles.rawText}>
                                        {ocrText}
                                    </div>

                                    {extractedItems.length > 0 && (
                                        <>
                                            <h4 style={{ marginTop: 'var(--space-md)', marginBottom: 'var(--space-sm)' }}>🛒 Detected Items</h4>
                                            <div className={styles.extractedList}>
                                                {extractedItems.map((item, idx) => (
                                                    <div key={item.id} className={styles.extractedItem}>
                                                        <span className={styles.extractedNum}>{idx + 1}</span>
                                                        <span className={styles.extractedName}>{item.name}</span>
                                                        {item.price > 0 && (
                                                            <span className={styles.extractedPrice}>{formatCurrency(item.price, currency)}</span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>

                                            <button onClick={useExtractedItems} className="btn-primary" style={{ width: '100%', padding: '16px', marginTop: 'var(--space-md)' }}>
                                                <ShoppingCart size={18} />
                                                Use These Items → Analyze Nutrition
                                            </button>
                                        </>
                                    )}

                                    {extractedItems.length === 0 && ocrText && (
                                        <div className={styles.noItemsMsg}>
                                            <AlertCircle size={18} />
                                            <p>Could not detect specific items. The receipt text may be unclear. Try a clearer photo or enter items manually.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {error && <div className={styles.errorMsg} style={{ marginTop: 'var(--space-md)' }}>{error}</div>}

                    <p className={styles.receiptHint}>
                        💡 Tip: For best results, take a clear, well-lit photo of your receipt.
                    </p>
                </div>
            )}

            {activeTab === 'manual' && (
                <>
                    {/* Session Info */}
                    <div className={styles.sessionInfo}>
                        <div className={styles.sessionField}>
                            <label className="input-label">Session Name *</label>
                            <input
                                className="input-field"
                                placeholder="e.g., Weekly Groceries"
                                value={sessionName}
                                onChange={(e) => setSessionName(e.target.value)}
                            />
                        </div>
                        <div className={styles.sessionField}>
                            <label className="input-label">Store Name</label>
                            <input
                                className="input-field"
                                placeholder="e.g., Whole Foods"
                                value={storeName}
                                onChange={(e) => setStoreName(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Items List */}
                    <div className={styles.itemsSection}>
                        <div className={styles.itemsHeader}>
                            <h3><ShoppingCart size={18} /> Items ({items.length})</h3>
                            <span className={styles.totalPrice}>Total: {formatCurrency(totalPrice, currency)}</span>
                        </div>

                        <div className={styles.itemsList}>
                            {items.map((item, idx) => (
                                <div key={item.id} className={styles.itemRow}>
                                    <div className={styles.itemNumber}>{idx + 1}</div>

                                    <div className={styles.itemFields}>
                                        <div className={styles.itemNameField}>
                                            <div className={styles.nameInputWrap}>
                                                <input
                                                    className="input-field"
                                                    placeholder="Food name (e.g., chicken breast)"
                                                    value={item.name}
                                                    onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                                                    onFocus={() => setShowFoodPicker(item.id)}
                                                />
                                                {item.name && (
                                                    <span className={styles.matchIndicator}>
                                                        {lookupNutrition(item.name) ? (
                                                            <Check size={14} style={{ color: 'var(--accent-green)' }} />
                                                        ) : (
                                                            <AlertCircle size={14} style={{ color: 'var(--accent-yellow)' }} />
                                                        )}
                                                    </span>
                                                )}
                                            </div>
                                            {showFoodPicker === item.id && (
                                                <div className={styles.foodPicker}>
                                                    <div className={styles.foodPickerSearch}>
                                                        <Search size={14} />
                                                        <input
                                                            placeholder="Search foods..."
                                                            value={searchQuery}
                                                            onChange={(e) => setSearchQuery(e.target.value)}
                                                            autoFocus
                                                        />
                                                    </div>
                                                    <div className={styles.foodPickerList}>
                                                        {filteredFoods.slice(0, 10).map(food => (
                                                            <button
                                                                key={food.key}
                                                                className={styles.foodPickerItem}
                                                                onClick={() => selectFood(item.id, food)}
                                                            >
                                                                <span>{food.name}</span>
                                                                <span className={styles.foodCat}>{food.category}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <button className={styles.foodPickerClose} onClick={() => setShowFoodPicker(null)}>
                                                        Close
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <div className={styles.itemQtyField}>
                                            <input
                                                className="input-field"
                                                type="number"
                                                placeholder="Qty"
                                                min="0"
                                                step="0.1"
                                                value={item.quantity}
                                                onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                            />
                                        </div>

                                        <div className={styles.itemUnitField}>
                                            <select
                                                className="input-field"
                                                value={item.unit}
                                                onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                                            >
                                                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                            </select>
                                        </div>

                                        <div className={styles.itemPriceField}>
                                            <input
                                                className="input-field"
                                                type="number"
                                                placeholder="0.00"
                                                min="0"
                                                step="0.01"
                                                value={item.price || ''}
                                                onChange={(e) => updateItem(item.id, 'price', parseFloat(e.target.value) || 0)}
                                            />
                                        </div>

                                        <div className={styles.itemCategoryField}>
                                            <select
                                                className="input-field"
                                                value={item.category}
                                                onChange={(e) => updateItem(item.id, 'category', e.target.value)}
                                            >
                                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <button
                                        className={styles.removeBtn}
                                        onClick={() => removeItem(item.id)}
                                        disabled={items.length <= 1}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <button onClick={addItem} className={styles.addItemBtn}>
                            <Plus size={18} />
                            Add Another Item
                        </button>
                    </div>

                    {/* Analyze Button */}
                    <div className={styles.actionBar}>
                        <button onClick={analyzeNutrition} className="btn-primary" disabled={analyzing} style={{ padding: '16px 32px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {analyzing ? (
                                <>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Loader size={18} className={styles.spinningIcon} /> AI Analyzing...
                                    </div>
                                    <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>{analyzeStep}</span>
                                </>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Brain size={18} /> Analyze with AI
                                </div>
                            )}
                        </button>
                    </div>

                    {/* Results */}
                    {analyzed && (
                        <div className={styles.resultsSection}>
                            {/* AI Summary Cards */}
                            {aiSummary && (
                                <div className={styles.aiSummarySection}>
                                    <div className={styles.summaryCards}>
                                        <div className={styles.summaryCard}>
                                            <span className={styles.summaryValue}>{Math.round(aiSummary.total_calories || totalAnalyzedCalories).toLocaleString()}</span>
                                            <span className={styles.summaryLabel}>Calories</span>
                                        </div>
                                        <div className={styles.summaryCard}>
                                            <span className={styles.summaryValue} style={{ color: 'var(--accent-blue)' }}>{Math.round(aiSummary.total_protein_g || totalProtein)}g</span>
                                            <span className={styles.summaryLabel}>Protein</span>
                                        </div>
                                        <div className={styles.summaryCard}>
                                            <span className={styles.summaryValue} style={{ color: 'var(--accent-yellow)' }}>{Math.round(aiSummary.total_carbs_g || totalCarbs)}g</span>
                                            <span className={styles.summaryLabel}>Carbs</span>
                                        </div>
                                        <div className={styles.summaryCard}>
                                            <span className={styles.summaryValue} style={{ color: 'var(--accent-red)' }}>{Math.round(aiSummary.total_fat_g || totalFat)}g</span>
                                            <span className={styles.summaryLabel}>Fat</span>
                                        </div>
                                        <div className={styles.summaryCard}>
                                            <span className={styles.summaryValue} style={{ color: '#f472b6' }}>{Math.round(aiSummary.total_sugar_g || totalSugar)}g</span>
                                            <span className={styles.summaryLabel}>Sugar</span>
                                        </div>
                                        <div className={styles.summaryCard}>
                                            <span className={styles.summaryValue} style={{ color: '#fb923c' }}>{(aiSummary.total_salt_g || totalSalt).toFixed(1)}g</span>
                                            <span className={styles.summaryLabel}>Salt</span>
                                        </div>
                                    </div>

                                    {/* Health Score */}
                                    {aiSummary.overall_health_score != null && (
                                        <div className={styles.healthScoreBar}>
                                            <div className={styles.healthScoreHeader}>
                                                <span><Heart size={16} /> Health Score</span>
                                                <span className={styles.healthScoreValue}>{aiSummary.overall_health_score}/100</span>
                                            </div>
                                            <div className={styles.healthTrack}>
                                                <div className={styles.healthFill} style={{
                                                    width: `${aiSummary.overall_health_score}%`,
                                                    background: aiSummary.overall_health_score >= 70 ? 'var(--accent-green)' :
                                                        aiSummary.overall_health_score >= 40 ? 'var(--accent-yellow)' : 'var(--accent-red)'
                                                }} />
                                            </div>
                                            {aiSummary.diet_assessment && (
                                                <p className={styles.dietAssessment}>{aiSummary.diet_assessment}</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className={styles.resultsHeader}>
                                <h3>📊 Nutrition Breakdown</h3>
                                <div className={styles.resultsSummary}>
                                    <span>{nutritionResults.filter(r => r.matched).length}/{nutritionResults.filter(r => r.name.trim()).length} items analyzed</span>
                                </div>
                            </div>

                            <div className={styles.resultsTable}>
                                <div className={styles.tableHeader}>
                                    <span>Item</span>
                                    <span>Cal</span>
                                    <span>Protein</span>
                                    <span>Carbs</span>
                                    <span>Fat</span>
                                    <span>Sugar</span>
                                    <span>Salt</span>
                                    <span>Score</span>
                                </div>
                                {nutritionResults.map((result, idx) => (
                                    result.name.trim() && (
                                        <div key={idx} className={`${styles.tableRow} ${!result.matched ? styles.unmatched : ''}`}>
                                            <span className={styles.itemCell}>
                                                {result.matched ? '✅' : '⚠️'} {result.name}
                                            </span>
                                            <span>{result.nutrition?.calories || '—'}</span>
                                            <span>{result.nutrition?.protein_g || '—'}g</span>
                                            <span>{result.nutrition?.carbs_g || '—'}g</span>
                                            <span>{result.nutrition?.fat_g || '—'}g</span>
                                            <span>{result.nutrition?.sugar_g || '—'}g</span>
                                            <span>{result.nutrition?.salt_g || '—'}g</span>
                                            <span className={styles.scoreCell}>
                                                {result.nutrition?.health_score != null ? (
                                                    <span className={styles.scoreBadge} style={{
                                                        color: result.nutrition.health_score >= 70 ? 'var(--accent-green)' :
                                                            result.nutrition.health_score >= 40 ? 'var(--accent-yellow)' : 'var(--accent-red)',
                                                        background: result.nutrition.health_score >= 70 ? 'var(--accent-green-dim)' :
                                                            result.nutrition.health_score >= 40 ? 'rgba(234,179,8,0.1)' : 'var(--accent-red-dim)',
                                                    }}>{result.nutrition.health_score}</span>
                                                ) : '—'}
                                            </span>
                                        </div>
                                    )
                                ))}
                            </div>

                            {/* AI Recommendations */}
                            {recommendations && (
                                <div className={styles.recsSection}>
                                    <h3 className={styles.recsTitle}><Leaf size={18} /> Healthier Alternatives</h3>

                                    <div className={styles.recsList}>
                                        {recommendations?.map((rec, idx) => (
                                            <div key={idx} className={styles.recCard} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                <div className={styles.recSwap}>
                                                    <span className={styles.recOriginal}>{rec.original_item}</span>
                                                    <ArrowRight size={16} className={styles.recArrow} />
                                                    <span className={styles.recAlternative}>Healthier Swaps</span>
                                                </div>
                                                
                                                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid var(--accent-blue)' }}>
                                                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', color: 'var(--accent-blue)' }}>🏬 Same Store Option</p>
                                                    <p style={{ margin: '4px 0', fontWeight: 500 }}>{rec.same_store_alternative?.name}</p>
                                                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{rec.same_store_alternative?.reason}</p>
                                                    <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--accent-green)' }}>{rec.same_store_alternative?.price_impact}</p>
                                                </div>

                                                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid var(--accent-green)' }}>
                                                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', color: 'var(--accent-green)' }}>🌱 Healthiest Option</p>
                                                    <p style={{ margin: '4px 0', fontWeight: 500 }}>{rec.best_health_alternative?.name}</p>
                                                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{rec.best_health_alternative?.reason}</p>
                                                    <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--accent-orange)' }}>{rec.best_health_alternative?.price_impact}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {error && <div className={styles.errorMsg}>{error}</div>}

                            <button
                                onClick={handleSave}
                                className="btn-primary"
                                disabled={saving}
                                style={{ padding: '16px 40px', marginTop: '20px' }}
                            >
                                {saving ? (
                                    <span className={styles.spinner}></span>
                                ) : (
                                    <>
                                        <Save size={18} />
                                        Save Session
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
