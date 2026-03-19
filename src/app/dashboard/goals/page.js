'use client';

import Image from 'next/image';
import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { DAILY_VALUES } from '@/lib/nutritionDB';
import FeatureFlow from '@/components/FeatureFlow';
import {
    Target,
    RefreshCw,
    TrendingUp,
    Award,
    Utensils,
    ChevronDown,
    CalendarDays,
    Flame,
    Droplets,
    Zap,
    Leaf,
    Upload,
    Search,
    Save,
    Trash2,
    X,
    CheckCircle2,
    AlertCircle,
    Sparkles,
    Package,
    Camera,
} from 'lucide-react';
import styles from './goals.module.css';

const supabase = createClient();

const MACRO_CONFIG = [
    { key: 'protein_g', label: 'Protein', unit: 'g', icon: Zap, color: 'blue' },
    { key: 'carbs_g', label: 'Carbs', unit: 'g', icon: Flame, color: 'orange' },
    { key: 'fat_g', label: 'Fat', unit: 'g', icon: Droplets, color: 'purple' },
    { key: 'fiber_g', label: 'Fiber', unit: 'g', icon: Leaf, color: 'green' },
];

const MICRO_CONFIG = [
    { key: 'vitamin_c_mg', label: 'Vitamin C', unit: 'mg' },
    { key: 'calcium_mg', label: 'Calcium', unit: 'mg' },
    { key: 'iron_mg', label: 'Iron', unit: 'mg' },
    { key: 'potassium_mg', label: 'Potassium', unit: 'mg' },
    { key: 'vitamin_d_mcg', label: 'Vitamin D', unit: 'mcg' },
    { key: 'vitamin_b12_mcg', label: 'Vitamin B12', unit: 'mcg' },
    { key: 'zinc_mg', label: 'Zinc', unit: 'mg' },
    { key: 'magnesium_mg', label: 'Magnesium', unit: 'mg' },
    { key: 'omega_3_mg', label: 'Omega-3', unit: 'mg' },
    { key: 'folate_mcg', label: 'Folate', unit: 'mcg' },
];

const EMPTY_NUTRITION = {
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    fiber_g: 0,
    sugar_g: 0,
    sodium_mg: 0,
    potassium_mg: 0,
    calcium_mg: 0,
    iron_mg: 0,
    vitamin_a_mcg: 0,
    vitamin_c_mg: 0,
    vitamin_d_mcg: 0,
    vitamin_b12_mcg: 0,
    vitamin_e_mg: 0,
    vitamin_k_mcg: 0,
    zinc_mg: 0,
    magnesium_mg: 0,
    folate_mcg: 0,
    omega_3_mg: 0,
};

const MEAL_OPTIONS = [
    { value: 'breakfast', label: 'Breakfast' },
    { value: 'lunch', label: 'Lunch' },
    { value: 'dinner', label: 'Dinner' },
    { value: 'snack', label: 'Snack' },
    { value: 'other', label: 'Other' },
];

const SERVING_UNITS = ['serving', 'g', 'ml', 'piece', 'cup', 'tbsp', 'tsp', 'oz'];

function getMicroBarColor(pct) {
    if (pct >= 70 && pct <= 120) return 'green';
    if (pct >= 40 && pct < 70) return 'yellow';
    if (pct > 120 && pct <= 150) return 'yellow';
    return 'red';
}

function getCalorieRingColor(pct) {
    if (pct > 100) return 'var(--accent-red)';
    if (pct >= 90) return 'var(--accent-orange)';
    return 'var(--accent-green)';
}

function computeGrade(totals, calorieGoal) {
    const keys = ['protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'vitamin_c_mg', 'calcium_mg', 'iron_mg'];
    let score = 0;

    keys.forEach((key) => {
        const goal = key === 'calories' ? calorieGoal : DAILY_VALUES[key];
        if (!goal) return;
        const pct = ((totals[key] || 0) / goal) * 100;
        if (pct >= 70 && pct <= 120) score += 2;
        else if (pct >= 40) score += 1;
    });

    const max = keys.length * 2;
    const ratio = score / max;
    if (ratio >= 0.85) return 'A';
    if (ratio >= 0.7) return 'B';
    if (ratio >= 0.5) return 'C';
    return 'D';
}

function getGradeColor(grade) {
    if (grade === 'A') return 'green';
    if (grade === 'B') return 'blue';
    if (grade === 'C') return 'yellow';
    return 'red';
}

function CalorieRing({ consumed, goal }) {
    const size = 200;
    const strokeWidth = 16;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const pct = goal > 0 ? Math.min((consumed / goal) * 100, 100) : 0;
    const offset = circumference - (pct / 100) * circumference;
    const ringColor = getCalorieRingColor(goal > 0 ? (consumed / goal) * 100 : 0);

    return (
        <div className={styles.ringWrapper}>
            <svg width={size} height={size} className={styles.ringSvg}>
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="var(--border-glass)"
                    strokeWidth={strokeWidth}
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={ringColor}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                    className={styles.ringProgress}
                />
            </svg>
            <div className={styles.ringCenter}>
                <span className={styles.ringConsumed} style={{ color: ringColor }}>
                    {Math.round(consumed).toLocaleString()}
                </span>
                <span className={styles.ringLabel}>of {Math.round(goal).toLocaleString()} kcal</span>
                <span className={styles.ringPct} style={{ color: ringColor }}>
                    {goal > 0 ? Math.round((consumed / goal) * 100) : 0}%
                </span>
            </div>
        </div>
    );
}

function ProgressBar({ value, max, colorClass }) {
    const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    return (
        <div className={styles.progressTrack}>
            <div
                className={`${styles.progressFill} ${styles[`fill_${colorClass}`]}`}
                style={{ width: `${pct}%` }}
            />
        </div>
    );
}

function getStartAndEndDate(selectedDate, dateRange) {
    const base = new Date(selectedDate);
    let startDate;
    let endDate;

    if (dateRange === 'today') {
        startDate = selectedDate;
        endDate = selectedDate;
    } else if (dateRange === 'week') {
        const start = new Date(base);
        start.setDate(base.getDate() - base.getDay());
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        startDate = start.toISOString().slice(0, 10);
        endDate = end.toISOString().slice(0, 10);
    } else {
        startDate = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-01`;
        const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0);
        endDate = lastDay.toISOString().slice(0, 10);
    }

    return { startDate, endDate };
}

export default function GoalsPage() {
    const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [dateRange, setDateRange] = useState('today');
    const [loading, setLoading] = useState(true);
    const [nutritionTotals, setNutritionTotals] = useState(EMPTY_NUTRITION);
    const [items, setItems] = useState([]);
    const [profile, setProfile] = useState(null);
    const [error, setError] = useState('');

    const [entryMode, setEntryMode] = useState('scan');
    const [mealType, setMealType] = useState('snack');
    const [itemName, setItemName] = useState('');
    const [brand, setBrand] = useState('');
    const [barcode, setBarcode] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [servingSize, setServingSize] = useState(1);
    const [servingUnit, setServingUnit] = useState('serving');
    const [notes, setNotes] = useState('');
    const [labelImage, setLabelImage] = useState(null);
    const [labelPreview, setLabelPreview] = useState(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [analysisError, setAnalysisError] = useState('');
    const [analyzedItem, setAnalyzedItem] = useState(null);
    const [analysisNutrition, setAnalysisNutrition] = useState(EMPTY_NUTRITION);
    const [analysisNote, setAnalysisNote] = useState('');
    const [analysisProvider, setAnalysisProvider] = useState('');
    const [saveSuccess, setSaveSuccess] = useState('');
    const [editingItemId, setEditingItemId] = useState('');
    const [scannerOpen, setScannerOpen] = useState(false);
    const [scannerError, setScannerError] = useState('');
    const [barcodeSupported, setBarcodeSupported] = useState(false);
    const [isCameraActive, setIsCameraActive] = useState(false);

    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const scannerFrameRef = useRef(null);
    const detectorRef = useRef(null);
    const labelInputRef = useRef(null);

    const flowItems = [
        {
            href: '/dashboard/goals',
            label: 'Log consumed items',
            description: 'Add what you actually ate, not what you bought, so nutrition tracking is accurate.',
            icon: Target,
            state: 'current',
        },
        {
            href: '/dashboard/shopping-list',
            label: 'Plan the next restock',
            description: 'Use what you are actually eating to adjust the next shopping list.',
            icon: Package,
            state: items.length ? 'done' : 'next',
        },
        {
            href: '/dashboard/recommendations',
            label: 'Improve future choices',
            description: 'Move from daily intake data into AI suggestions for better repeat purchases.',
            icon: Sparkles,
            state: 'next',
        },
    ];

    const resetAnalysis = useCallback(() => {
        setAnalyzedItem(null);
        setAnalysisNutrition(EMPTY_NUTRITION);
        setAnalysisNote('');
        setAnalysisProvider('');
        setAnalysisError('');
        setSaveSuccess('');
    }, []);

    const resetForm = useCallback(() => {
        setEditingItemId('');
        setItemName('');
        setBrand('');
        setBarcode('');
        setQuantity(1);
        setServingSize(1);
        setServingUnit('serving');
        setMealType('snack');
        setNotes('');
        setLabelImage(null);
        if (labelPreview) URL.revokeObjectURL(labelPreview);
        setLabelPreview(null);
        resetAnalysis();
    }, [labelPreview, resetAnalysis]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError('');

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const { data: profileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();
            if (profileData) setProfile(profileData);

            const { startDate, endDate } = getStartAndEndDate(selectedDate, dateRange);

            const { data, error: itemsError } = await supabase
                .from('consumed_items')
                .select(`
                    id,
                    consumed_on,
                    meal_type,
                    name,
                    brand,
                    description,
                    barcode,
                    quantity,
                    serving_size,
                    serving_unit,
                    category,
                    source,
                    ai_provider,
                    confidence,
                    notes,
                    created_at,
                    consumed_item_nutrition (
                        calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g,
                        sodium_mg, calcium_mg, iron_mg, potassium_mg,
                        vitamin_c_mg, vitamin_d_mcg, vitamin_b12_mcg,
                        vitamin_e_mg, vitamin_k_mcg, zinc_mg, magnesium_mg,
                        folate_mcg, omega_3_mg, vitamin_a_mcg
                    )
                `)
                .eq('user_id', user.id)
                .gte('consumed_on', startDate)
                .lte('consumed_on', endDate)
                .order('consumed_on', { ascending: false })
                .order('created_at', { ascending: false });

            if (itemsError) throw itemsError;

            if (!data || data.length === 0) {
                setNutritionTotals(EMPTY_NUTRITION);
                setItems([]);
                return;
            }

            const totals = { ...EMPTY_NUTRITION };
            const enrichedItems = [];

            data.forEach((item) => {
                const nd = Array.isArray(item.consumed_item_nutrition)
                    ? item.consumed_item_nutrition[0]
                    : item.consumed_item_nutrition;

                if (nd) {
                    Object.keys(totals).forEach((key) => {
                        totals[key] = (totals[key] || 0) + (nd[key] || 0);
                    });
                }

                enrichedItems.push({
                    ...item,
                    nd: nd || EMPTY_NUTRITION,
                });
            });

            setNutritionTotals(totals);
            setItems(enrichedItems);
        } catch (err) {
            const message = err.message || 'Failed to load nutrition data';
            if (message.toLowerCase().includes('consumed_items')) {
                setError('Daily intake tables are missing. Run supabase/add_consumed_items.sql and refresh.');
            } else {
                setError(message);
            }
        } finally {
            setLoading(false);
        }
    }, [selectedDate, dateRange]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        return () => {
            if (labelPreview) URL.revokeObjectURL(labelPreview);
        };
    }, [labelPreview]);

    const stopBarcodeScanner = useCallback(() => {
        if (scannerFrameRef.current) {
            cancelAnimationFrame(scannerFrameRef.current);
            scannerFrameRef.current = null;
        }

        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }

        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }

        setIsCameraActive(false);
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        setBarcodeSupported('BarcodeDetector' in window);
    }, []);

    useEffect(() => {
        if (!scannerOpen) {
            stopBarcodeScanner();
            return;
        }

        let isCancelled = false;

        const startScanner = async () => {
            setScannerError('');

            if (typeof window === 'undefined' || !('BarcodeDetector' in window)) {
                setScannerError('Barcode scanning is not supported in this browser. Type the barcode or use a package photo instead.');
                return;
            }

            try {
                const supportedFormats = typeof window.BarcodeDetector.getSupportedFormats === 'function'
                    ? await window.BarcodeDetector.getSupportedFormats()
                    : ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'];

                detectorRef.current = new window.BarcodeDetector({
                    formats: supportedFormats.filter((format) =>
                        ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'codabar'].includes(format)
                    ),
                });

                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: { ideal: 'environment' },
                    },
                    audio: false,
                });

                if (isCancelled) {
                    stream.getTracks().forEach((track) => track.stop());
                    return;
                }

                streamRef.current = stream;

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                }

                setIsCameraActive(true);

                const scanFrame = async () => {
                    if (
                        !videoRef.current ||
                        !detectorRef.current ||
                        videoRef.current.readyState < 2
                    ) {
                        scannerFrameRef.current = requestAnimationFrame(scanFrame);
                        return;
                    }

                    try {
                        const barcodes = await detectorRef.current.detect(videoRef.current);
                        const firstBarcode = barcodes?.[0]?.rawValue;
                        if (firstBarcode) {
                            setBarcode(firstBarcode);
                            resetAnalysis();
                            setScannerOpen(false);
                            return;
                        }
                    } catch {
                        // Ignore transient frame-read errors and keep scanning.
                    }

                    scannerFrameRef.current = requestAnimationFrame(scanFrame);
                };

                scannerFrameRef.current = requestAnimationFrame(scanFrame);
            } catch (err) {
                setScannerError(err.message || 'Unable to access the camera for barcode scanning.');
                stopBarcodeScanner();
            }
        };

        startScanner();

        return () => {
            isCancelled = true;
            stopBarcodeScanner();
        };
    }, [scannerOpen, stopBarcodeScanner, resetAnalysis]);

    const handleImageSelect = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (labelPreview) URL.revokeObjectURL(labelPreview);
        setLabelImage(file);
        setLabelPreview(URL.createObjectURL(file));
        resetAnalysis();
    };

    const handleScanTrigger = () => {
        if (barcodeSupported) {
            setScannerOpen(true);
            return;
        }

        setEntryMode('scan');
        setScannerError('');
        labelInputRef.current?.click();
    };

    const analyzeConsumedItem = async () => {
        if (!itemName.trim() && !barcode.trim() && !labelImage) {
            setAnalysisError('Add a product name, barcode, or package image first.');
            return;
        }

        setAnalyzing(true);
        setAnalysisError('');
        setSaveSuccess('');

        try {
            let response;

            if (labelImage) {
                const formData = new FormData();
                formData.append('label_image', labelImage);
                formData.append('itemName', itemName);
                formData.append('brand', brand);
                formData.append('barcode', barcode);
                formData.append('mealType', mealType);
                formData.append('quantity', String(quantity));
                formData.append('servingSize', String(servingSize));
                formData.append('servingUnit', servingUnit);
                formData.append('notes', notes);

                response = await fetch('/api/analyze-consumed-item', {
                    method: 'POST',
                    body: formData,
                });
            } else {
                response = await fetch('/api/analyze-consumed-item', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        itemName,
                        brand,
                        barcode,
                        mealType,
                        quantity,
                        servingSize,
                        servingUnit,
                        notes,
                    }),
                });
            }

            const result = await response.json();
            if (!response.ok || !result.data) {
                throw new Error(result.error || 'Failed to analyze item');
            }

            setAnalyzedItem({
                ...result.data.item,
                notes,
                source: labelImage ? 'scan' : 'manual',
            });
            setAnalysisNutrition(result.data.nutrition || EMPTY_NUTRITION);
            setAnalysisNote(result.data.note || '');
            setAnalysisProvider(result.provider || '');
        } catch (err) {
            setAnalysisError(err.message || 'Failed to analyze item');
        } finally {
            setAnalyzing(false);
        }
    };

    const saveConsumedItem = async () => {
        if (!analyzedItem) {
            setAnalysisError('Analyze the item before saving it.');
            return;
        }

        setSaving(true);
        setAnalysisError('');
        setSaveSuccess('');

        try {
            const response = await fetch('/api/log-consumed-item', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    itemId: editingItemId || undefined,
                    consumedOn: selectedDate,
                    provider: analysisProvider,
                    item: {
                        ...analyzedItem,
                        meal_type: mealType,
                        quantity,
                        serving_size: servingSize,
                        serving_unit: servingUnit,
                        source: labelImage ? 'scan' : entryMode,
                        notes,
                    },
                    nutrition: analysisNutrition,
                }),
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'Failed to save consumed item');
            }

            setSaveSuccess(editingItemId ? 'Updated your intake entry.' : 'Saved to your daily intake.');
            await fetchData();
            resetForm();
        } catch (err) {
            setAnalysisError(err.message || 'Failed to save consumed item');
        } finally {
            setSaving(false);
        }
    };

    const editConsumedItem = useCallback((item) => {
        setEditingItemId(item.id);
        setEntryMode(item.source === 'scan' ? 'scan' : 'manual');
        setMealType(item.meal_type || 'snack');
        setItemName(item.name || '');
        setBrand(item.brand || '');
        setBarcode(item.barcode || '');
        setQuantity(Number(item.quantity || 1));
        setServingSize(Number(item.serving_size || 1));
        setServingUnit(item.serving_unit || 'serving');
        setNotes(item.notes || '');
        setAnalyzedItem({
            name: item.name,
            brand: item.brand || '',
            description: item.description || '',
            barcode: item.barcode || '',
            category: item.category || 'Other',
            quantity: Number(item.quantity || 1),
            serving_size: Number(item.serving_size || 1),
            serving_unit: item.serving_unit || 'serving',
            meal_type: item.meal_type || 'snack',
            confidence: item.confidence || 'saved',
            source: item.source || 'manual',
        });
        setAnalysisNutrition(item.nd || EMPTY_NUTRITION);
        setAnalysisNote(item.description ? 'Loaded from your saved intake entry.' : 'Loaded from your saved intake entry for editing.');
        setAnalysisProvider(item.ai_provider || 'saved');
        setAnalysisError('');
        setSaveSuccess('');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, []);

    const deleteConsumedItem = async (id) => {
        if (!window.confirm('Delete this logged item?')) return;

        try {
            const { error: deleteError } = await supabase.from('consumed_items').delete().eq('id', id);
            if (deleteError) throw deleteError;
            await fetchData();
        } catch (err) {
            setError(err.message || 'Failed to delete item');
        }
    };

    const calorieGoal = profile?.daily_calorie_goal || DAILY_VALUES.calories;
    const grade = computeGrade(nutritionTotals, calorieGoal);
    const gradeColor = getGradeColor(grade);
    const caloriePct = calorieGoal > 0 ? ((nutritionTotals.calories || 0) / calorieGoal) * 100 : 0;

    const mealCounts = items.reduce((acc, item) => {
        acc[item.meal_type] = (acc[item.meal_type] || 0) + 1;
        return acc;
    }, {});

    const groupedIntake = items.reduce((acc, item) => {
        const dateKey = item.consumed_on || selectedDate;
        if (!acc[dateKey]) acc[dateKey] = {};
        const mealKey = item.meal_type || 'other';
        if (!acc[dateKey][mealKey]) acc[dateKey][mealKey] = [];
        acc[dateKey][mealKey].push(item);
        return acc;
    }, {});

    const groupedDates = Object.keys(groupedIntake).sort((a, b) => b.localeCompare(a));

    function itemHealthColor(item) {
        const cal = item.nd?.calories || 0;
        const prot = item.nd?.protein_g || 0;
        const fiber = item.nd?.fiber_g || 0;
        if (prot > 10 || fiber > 3) return 'green';
        if (cal > 400) return 'red';
        return 'yellow';
    }

    return (
        <div className={`${styles.page} animate-fadeIn`}>
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.headerIcon}>
                        <Target size={22} />
                    </div>
                    <div>
                        <h1 className={styles.title}>Daily Intake & Nutrition Goals</h1>
                        <p className={styles.subtitle}>Log what you actually ate, scan package labels, and compare intake against your targets.</p>
                    </div>
                </div>
                <div className={styles.headerControls}>
                    <div className={styles.inputGroup}>
                        <CalendarDays size={16} className={styles.inputIcon} />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className={styles.dateInput}
                        />
                    </div>
                    <div className={styles.selectWrapper}>
                        <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} className={styles.rangeSelect}>
                            <option value="today">Today</option>
                            <option value="week">This Week</option>
                            <option value="month">This Month</option>
                        </select>
                        <ChevronDown size={14} className={styles.selectIcon} />
                    </div>
                    <button onClick={fetchData} className={styles.refreshBtn} title="Refresh">
                        <RefreshCw size={16} className={loading ? styles.spinning : ''} />
                    </button>
                    <div className={`${styles.gradeBadge} ${styles[`grade_${gradeColor}`]}`}>
                        <Award size={14} />
                        <span>Grade {grade}</span>
                    </div>
                </div>
            </div>

            <FeatureFlow
                title="Daily Intake Loop"
                description="Capture what you consumed with a package photo or barcode details, save it to the diary, and use that real intake data to guide future shopping and recommendations."
                items={flowItems}
            />

            {error && <div className={styles.errorBanner}>{error}</div>}

            <div className={styles.intakeLayout}>
                <section className={`glass-card ${styles.loggerCard}`}>
                    <div className={styles.loggerHeader}>
                        <div>
                            <h2 className={styles.sectionTitle}>
                                <Utensils size={18} />
                                {editingItemId ? 'Edit Intake Entry' : 'Log A Consumed Item'}
                            </h2>
                            <p className={styles.loggerSubtitle}>Manual entry works, but scanning a package photo gives better descriptions and macro estimates.</p>
                        </div>
                    </div>

                    <div className={styles.modeTabs}>
                        <button
                            className={`${styles.modeTab} ${entryMode === 'scan' ? styles.modeTabActive : ''}`}
                            onClick={() => { setEntryMode('scan'); resetAnalysis(); }}
                        >
                            <Camera size={16} />
                            Scan Label / Barcode
                        </button>
                        <button
                            className={`${styles.modeTab} ${entryMode === 'manual' ? styles.modeTabActive : ''}`}
                            onClick={() => { setEntryMode('manual'); resetAnalysis(); }}
                        >
                            <Package size={16} />
                            Manual / Barcode Entry
                        </button>
                    </div>

                    <div className={styles.loggerForm}>
                        <div className={styles.formGrid}>
                            <div className={styles.formField}>
                                <label className="input-label">Product Name</label>
                                <input
                                    className="input-field"
                                    value={itemName}
                                    onChange={(e) => { setItemName(e.target.value); resetAnalysis(); }}
                                    placeholder="Greek yogurt, protein bar, sparkling water..."
                                />
                            </div>
                            <div className={styles.formField}>
                                <label className="input-label">Brand</label>
                                <input
                                    className="input-field"
                                    value={brand}
                                    onChange={(e) => { setBrand(e.target.value); resetAnalysis(); }}
                                    placeholder="Optional"
                                />
                            </div>
                            <div className={styles.formField}>
                                <label className="input-label">Barcode Number</label>
                                <div className={styles.barcodeRow}>
                                    <input
                                        className="input-field"
                                        value={barcode}
                                        onChange={(e) => { setBarcode(e.target.value); resetAnalysis(); }}
                                        placeholder="Type or scan barcode digits"
                                    />
                                    <button
                                        type="button"
                                        className={styles.scanTrigger}
                                        onClick={handleScanTrigger}
                                        title={barcodeSupported ? 'Scan barcode with camera' : 'Use the camera to capture the barcode or package image'}
                                    >
                                        <Camera size={16} />
                                        Scan
                                    </button>
                                </div>
                            </div>
                            <div className={styles.formField}>
                                <label className="input-label">Meal</label>
                                <select className="input-field" value={mealType} onChange={(e) => { setMealType(e.target.value); resetAnalysis(); }}>
                                    {MEAL_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className={styles.formField}>
                                <label className="input-label">Quantity Eaten</label>
                                <input
                                    type="number"
                                    min="0.1"
                                    step="0.1"
                                    max="20"
                                    className="input-field"
                                    value={quantity}
                                    onChange={(e) => { setQuantity(Number(e.target.value) || 1); resetAnalysis(); }}
                                />
                            </div>
                            <div className={styles.formField}>
                                <label className="input-label">Serving Size</label>
                                <input
                                    type="number"
                                    min="0.1"
                                    step="0.1"
                                    className="input-field"
                                    value={servingSize}
                                    onChange={(e) => { setServingSize(Number(e.target.value) || 1); resetAnalysis(); }}
                                />
                            </div>
                            <div className={styles.formField}>
                                <label className="input-label">Serving Unit</label>
                                <select className="input-field" value={servingUnit} onChange={(e) => { setServingUnit(e.target.value); resetAnalysis(); }}>
                                    {SERVING_UNITS.map((unit) => (
                                        <option key={unit} value={unit}>{unit}</option>
                                    ))}
                                </select>
                            </div>
                            <div className={`${styles.formField} ${styles.notesField}`}>
                                <label className="input-label">Notes</label>
                                <textarea
                                    className="input-field"
                                    rows={3}
                                    value={notes}
                                    onChange={(e) => { setNotes(e.target.value); resetAnalysis(); }}
                                    placeholder="Optional details, flavor, pack size, or eating notes"
                                />
                            </div>
                        </div>

                        {entryMode === 'scan' && (
                            <div className={styles.scanCard}>
                                <div className={styles.scanHeader}>
                                    <div>
                                        <h3>Scan A Package Photo</h3>
                                        <p>Upload a front label, nutrition panel, or barcode photo. Mobile camera capture is enabled.</p>
                                    </div>
                                </div>
                                <label className={styles.uploadBox}>
                                    <input
                                        ref={labelInputRef}
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        onChange={handleImageSelect}
                                        className={styles.hiddenInput}
                                    />
                                    <Upload size={22} />
                                    <span>{labelImage ? 'Replace image' : 'Tap to add package image'}</span>
                                </label>

                                {labelPreview && (
                                    <div className={styles.previewWrap}>
                                        <Image
                                            src={labelPreview}
                                            alt="Package preview"
                                            width={1200}
                                            height={1200}
                                            unoptimized
                                            className={styles.previewImage}
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        <div className={styles.loggerActions}>
                            <button
                                onClick={analyzeConsumedItem}
                                className="btn-primary"
                                disabled={analyzing}
                            >
                                {analyzing ? (
                                    <>
                                        <RefreshCw size={16} className={styles.spinning} />
                                        Analyzing...
                                    </>
                                ) : (
                                    <>
                                        <Search size={16} />
                                        Analyze With AI
                                    </>
                                )}
                            </button>
                            <button onClick={resetForm} className="btn-secondary" disabled={analyzing || saving}>
                                {editingItemId ? 'Cancel Edit' : 'Reset'}
                            </button>
                        </div>

                        {analysisError && (
                            <div className={styles.inlineError}>
                                <AlertCircle size={16} />
                                {analysisError}
                            </div>
                        )}

                        {saveSuccess && (
                            <div className={styles.inlineSuccess}>
                                <CheckCircle2 size={16} />
                                {saveSuccess}
                            </div>
                        )}

                        {analyzedItem && (
                            <div className={styles.analysisCard}>
                                <div className={styles.analysisHeader}>
                                    <div>
                                        <h3>{analyzedItem.name}</h3>
                                        <p>{analyzedItem.brand || 'Unknown brand'} · {analyzedItem.category || 'Other'} · {analyzedItem.meal_type || mealType}</p>
                                    </div>
                                    <span className={styles.confidenceBadge}>
                                        {analyzedItem.confidence || 'estimated'}
                                    </span>
                                </div>

                                {analyzedItem.description && (
                                    <p className={styles.analysisDescription}>{analyzedItem.description}</p>
                                )}

                                <div className={styles.analysisMacroGrid}>
                                    <div className={styles.analysisMetric}>
                                        <strong>{Math.round(analysisNutrition.calories || 0)}</strong>
                                        <span>Calories</span>
                                    </div>
                                    <div className={styles.analysisMetric}>
                                        <strong>{Math.round(analysisNutrition.protein_g || 0)}g</strong>
                                        <span>Protein</span>
                                    </div>
                                    <div className={styles.analysisMetric}>
                                        <strong>{Math.round(analysisNutrition.carbs_g || 0)}g</strong>
                                        <span>Carbs</span>
                                    </div>
                                    <div className={styles.analysisMetric}>
                                        <strong>{Math.round(analysisNutrition.fat_g || 0)}g</strong>
                                        <span>Fat</span>
                                    </div>
                                </div>

                                {(analysisNote || analysisProvider) && (
                                    <div className={styles.analysisMeta}>
                                        {analysisNote && <p>{analysisNote}</p>}
                                        {analysisProvider && <span>Provider: {analysisProvider}</span>}
                                    </div>
                                )}

                                <button onClick={saveConsumedItem} className="btn-primary" disabled={saving}>
                                    {saving ? (
                                        <>
                                            <RefreshCw size={16} className={styles.spinning} />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Save size={16} />
                                            {editingItemId ? 'Update Intake Entry' : 'Save To Daily Intake'}
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </section>

                <div className={styles.summaryColumn}>
                    {loading ? (
                        <div className={styles.loadingGrid}>
                            {[...Array(5)].map((_, index) => (
                                <div key={index} className={`skeleton ${styles.skeletonCard}`} />
                            ))}
                        </div>
                    ) : (
                        <>
                            <div className={styles.quickStats}>
                                <div className={`glass-card ${styles.quickStat}`}>
                                    <strong>{items.length}</strong>
                                    <span>Items Logged</span>
                                </div>
                                <div className={`glass-card ${styles.quickStat}`}>
                                    <strong>{Object.keys(mealCounts).length}</strong>
                                    <span>Meals Covered</span>
                                </div>
                                <div className={`glass-card ${styles.quickStat}`}>
                                    <strong>{Math.round(nutritionTotals.protein_g || 0)}g</strong>
                                    <span>Protein Today</span>
                                </div>
                            </div>

                            <div className={styles.topSection}>
                                <div className={`glass-card ${styles.ringCard}`}>
                                    <h2 className={styles.sectionTitle}>
                                        <Flame size={18} />
                                        Calories
                                    </h2>
                                    <CalorieRing consumed={nutritionTotals.calories || 0} goal={calorieGoal} />
                                    <p
                                        className={styles.ringStatus}
                                        style={{
                                            color: caloriePct > 100
                                                ? 'var(--accent-red)'
                                                : caloriePct >= 90
                                                    ? 'var(--accent-orange)'
                                                    : 'var(--accent-green)',
                                        }}
                                    >
                                        {caloriePct > 100
                                            ? `${Math.round(caloriePct - 100)}% over goal`
                                            : `${Math.max(0, Math.round(100 - caloriePct))}% remaining`}
                                    </p>
                                </div>

                                <div className={styles.macrosGrid}>
                                    {MACRO_CONFIG.map(({ key, label, unit, icon: Icon, color }) => {
                                        const value = nutritionTotals[key] || 0;
                                        const goal = DAILY_VALUES[key] || 1;
                                        const pct = Math.min((value / goal) * 100, 100);
                                        return (
                                            <div key={key} className={`glass-card ${styles.macroCard}`}>
                                                <div className={styles.macroHeader}>
                                                    <div className={`${styles.macroIcon} ${styles[`macroIcon_${color}`]}`}>
                                                        <Icon size={16} />
                                                    </div>
                                                    <span className={styles.macroLabel}>{label}</span>
                                                </div>
                                                <div className={styles.macroValues}>
                                                    <span className={`${styles.macroVal} ${styles[`macroVal_${color}`]}`}>
                                                        {Math.round(value)}{unit}
                                                    </span>
                                                    <span className={styles.macroGoal}>/ {goal}{unit}</span>
                                                </div>
                                                <ProgressBar value={value} max={goal} colorClass={color} />
                                                <span className={styles.macroPct}>{Math.round(pct)}%</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {!loading && (
                <>
                    <div className={`glass-card ${styles.microSection}`}>
                        <h2 className={styles.sectionTitle}>
                            <TrendingUp size={18} />
                            Micronutrients
                        </h2>
                        <div className={styles.microGrid}>
                            {MICRO_CONFIG.map(({ key, label, unit }) => {
                                const value = nutritionTotals[key] || 0;
                                const goal = DAILY_VALUES[key] || 1;
                                const pct = (value / goal) * 100;
                                const barColor = getMicroBarColor(pct);
                                return (
                                    <div key={key} className={styles.microItem}>
                                        <div className={styles.microHeader}>
                                            <span className={styles.microLabel}>{label}</span>
                                            <div className={styles.microRight}>
                                                <span className={`${styles.microPct} ${styles[`microPct_${barColor}`]}`}>
                                                    {Math.round(pct)}%
                                                </span>
                                                <span className={styles.microVal}>
                                                    {value % 1 === 0 ? value : value.toFixed(1)}{unit}
                                                </span>
                                            </div>
                                        </div>
                                        <div className={styles.progressTrack}>
                                            <div
                                                className={`${styles.progressFill} ${styles[`fill_${barColor}`]}`}
                                                style={{ width: `${Math.min(pct, 100)}%` }}
                                            />
                                        </div>
                                        <span className={styles.microGoalText}>Goal: {goal}{unit}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className={`glass-card ${styles.foodsSection}`}>
                        <div className={styles.foodsHeader}>
                            <h2 className={styles.sectionTitle}>
                                <Utensils size={18} />
                                Logged Intake ({items.length})
                            </h2>
                            <p className={styles.foodsHint}>These entries come from your consumed-items diary, not grocery purchase history.</p>
                        </div>

                        {items.length === 0 ? (
                            <div className={styles.emptyState}>
                                <Utensils size={40} className={styles.emptyIcon} />
                                <p>No intake logged for this period.</p>
                                <p className={styles.emptyHint}>Use the logger above to scan or add your first consumed item.</p>
                            </div>
                        ) : (
                            <div className={styles.timeline}>
                                {groupedDates.map((dateKey) => (
                                    <div key={dateKey} className={styles.dayGroup}>
                                        <div className={styles.dayHeader}>
                                            <h3>{new Date(`${dateKey}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}</h3>
                                            <span>{Object.values(groupedIntake[dateKey]).flat().length} item(s)</span>
                                        </div>

                                        <div className={styles.mealGroups}>
                                            {MEAL_OPTIONS.filter((option) => groupedIntake[dateKey][option.value]?.length).map((option) => (
                                                <div key={`${dateKey}-${option.value}`} className={styles.mealGroupCard}>
                                                    <div className={styles.mealGroupHeader}>
                                                        <span className={styles.mealGroupTitle}>{option.label}</span>
                                                        <span className={styles.mealGroupCount}>{groupedIntake[dateKey][option.value].length}</span>
                                                    </div>

                                                    <div className={styles.foodList}>
                                                        {groupedIntake[dateKey][option.value].map((item) => {
                                                            const dotColor = itemHealthColor(item);
                                                            const calories = Math.round(item.nd?.calories || 0);
                                                            const protein = item.nd?.protein_g || 0;
                                                            const totalCalories = nutritionTotals.calories || 1;
                                                            const contribution = Math.round((calories / totalCalories) * 100);

                                                            return (
                                                                <div key={item.id} className={styles.foodItem}>
                                                                    <div className={`${styles.healthDot} ${styles[`dot_${dotColor}`]}`} />
                                                                    <div className={styles.foodInfo}>
                                                                        <div className={styles.foodLine}>
                                                                            <span className={styles.foodName}>{item.name}</span>
                                                                            {item.source && <span className={styles.sourceTag}>{item.source}</span>}
                                                                        </div>
                                                                        <span className={styles.foodQty}>
                                                                            {item.brand ? `${item.brand} · ` : ''}
                                                                            {item.quantity} × {item.serving_size} {item.serving_unit}
                                                                            {item.barcode ? ` · ${item.barcode}` : ''}
                                                                        </span>
                                                                        {item.description && <span className={styles.foodDesc}>{item.description}</span>}
                                                                    </div>
                                                                    <div className={styles.foodNutrition}>
                                                                        <span className={styles.foodCal}>{calories} kcal</span>
                                                                        <span className={styles.foodProt}>{protein.toFixed(1)}g protein</span>
                                                                        <div className={styles.foodContribBar}>
                                                                            <div className={styles.foodContribFill} style={{ width: `${Math.min(contribution, 100)}%` }} />
                                                                        </div>
                                                                        <span className={styles.foodContribPct}>{contribution}%</span>
                                                                    </div>
                                                                    <div className={styles.itemActions}>
                                                                        <button className={styles.editBtn} onClick={() => editConsumedItem(item)} title="Edit logged item">
                                                                            Edit
                                                                        </button>
                                                                        <button className={styles.deleteBtn} onClick={() => deleteConsumedItem(item.id)} title="Delete logged item">
                                                                            <Trash2 size={15} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}

            {scannerOpen && (
                <div className={styles.scannerOverlay} onClick={() => setScannerOpen(false)}>
                    <div className={styles.scannerModal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.scannerHeader}>
                            <div>
                                <h3>Scan Barcode</h3>
                                <p>Point the rear camera at the product barcode.</p>
                            </div>
                            <button
                                type="button"
                                className={styles.scannerClose}
                                onClick={() => setScannerOpen(false)}
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className={styles.scannerViewport}>
                            <video ref={videoRef} className={styles.scannerVideo} playsInline muted />
                            <div className={styles.scannerGuide} />
                        </div>

                        {!barcodeSupported && (
                            <div className={styles.inlineError}>
                                <AlertCircle size={16} />
                                Barcode scanning is not supported in this browser.
                            </div>
                        )}

                        {scannerError && (
                            <div className={styles.inlineError}>
                                <AlertCircle size={16} />
                                {scannerError}
                            </div>
                        )}

                        {!scannerError && barcodeSupported && (
                            <p className={styles.scannerHint}>
                                {isCameraActive
                                    ? 'Scanning continuously. The dialog closes automatically when a barcode is detected.'
                                    : 'Requesting camera access...'}
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
