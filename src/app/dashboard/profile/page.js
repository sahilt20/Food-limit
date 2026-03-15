'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { DAILY_VALUES, NUTRIENT_INFO } from '@/lib/nutritionDB';
import { getCurrencySymbol } from '@/lib/currency';
import {
    User,
    Mail,
    Target,
    Award,
    Save,
    LogOut,
    Edit2,
    Flame,
    TrendingUp,
    ShoppingCart,
    Leaf,
    Heart,
    Zap,
    Shield,
    Star,
    Trophy,
    Plus,
    Trash2,
    Activity,
    Users,
    Scale,
    Ruler
} from 'lucide-react';
import styles from './profile.module.css';

const DIETARY_OPTIONS = [
    'Vegetarian', 'Vegan', 'Keto', 'Paleo', 'Gluten-Free',
    'Dairy-Free', 'Low-Carb', 'High-Protein', 'Mediterranean', 'None',
];

const BASE_ACHIEVEMENTS = [
    { id: 'protein', icon: '💪', title: 'Protein Champion', desc: 'Hit 100g+ protein in a session', color: 'var(--accent-blue)' },
    { id: 'vitc', icon: '🍊', title: 'Vitamin C Master', desc: 'Exceeded daily Vitamin C 5x', color: 'var(--accent-orange)' },
    { id: 'fiber', icon: '🥬', title: 'Fiber Hero', desc: 'Averaged 25g+ fiber per day', color: 'var(--accent-green)' },
    { id: 'budget', icon: '💰', title: 'Budget Guru', desc: 'Under $50 per trip on average', color: 'var(--accent-yellow)' },
    { id: 'variety', icon: '🌈', title: 'Food Rainbow', desc: 'Tracked 20+ different foods', color: 'var(--accent-purple)' },
    { id: 'streak', icon: '🔥', title: '5-Trip Streak', desc: 'Tracked 5+ grocery sessions', color: 'var(--accent-red)' },
    { id: 'omega', icon: '🐟', title: 'Omega Master', desc: 'Bought omega-rich foods', color: 'var(--accent-cyan)' },
    { id: 'iron', icon: '🏋️', title: 'Iron Force', desc: 'High iron content in a session', color: 'var(--accent-pink)' },
];

export default function ProfilePage() {
    const [profile, setProfile] = useState({
        full_name: '',
        dietary_preferences: [],
        daily_calorie_goal: 2000,
        currency_preference: 'USD',
    });
    const [user, setUser] = useState(null);
    const [familyMembers, setFamilyMembers] = useState([]);
    const [showFamilyForm, setShowFamilyForm] = useState(false);
    const [familyForm, setFamilyForm] = useState({ name: '', age: 30, gender: 'male', weight_kg: 70, height_cm: 170, activity_level: 'sedentary' });
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isDemo, setIsDemo] = useState(false);
    const [achievements, setAchievements] = useState(BASE_ACHIEVEMENTS.map(a => ({ ...a, earned: false })));
    const router = useRouter();

    const calculateMetrics = (member) => {
        const w = parseFloat(member.weight_kg) || 0;
        const h = parseFloat(member.height_cm) || 0;
        const a = parseInt(member.age) || 0;
        const bmi = h > 0 ? (w / Math.pow(h / 100, 2)).toFixed(1) : 0;
        
        let bmr = 0;
        if (member.gender === 'male') {
            bmr = (10 * w) + (6.25 * h) - (5 * a) + 5;
        } else {
            bmr = (10 * w) + (6.25 * h) - (5 * a) - 161;
        }
        
        const multipliers = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };
        const goal = Math.round(bmr * (multipliers[member.activity_level] || 1.2));
        return { bmi, goal };
    };

    useEffect(() => {
        const loadProfile = async () => {
            try {
                const supabase = createClient();
                const { data: { user: authUser } } = await supabase.auth.getUser();
                if (authUser) {
                    setUser(authUser);
                    const { data } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', authUser.id)
                        .single();
                    if (data) {
                        setProfile({
                            ...data,
                            dietary_preferences: data.dietary_preferences || [],
                            currency_preference: data.currency_preference || 'USD',
                        });
                    }

                    const { data: familyData } = await supabase
                        .from('family_members')
                        .select('*')
                        .eq('user_id', authUser.id);
                    if (familyData) setFamilyMembers(familyData);

                    // Fetch history for dynamic achievements
                    const { data: sessionsData } = await supabase
                        .from('grocery_sessions')
                        .select('total_spent, grocery_items(name, nutrition_data(protein_g, vit_c_mg, fiber_g, iron_mg))')
                        .order('session_date', { ascending: false });

                    if (sessionsData) {
                        calculateAchievements(sessionsData);
                    }
                }
            } catch (err) {
                // Auth check failed
            }
        };
        loadProfile();
    }, []);

    const calculateAchievements = (sessions) => {
        let maxProteinSession = 0;
        let maxVitCSession = 0;
        let maxIronSession = 0;
        let totalFiber = 0;
        const uniqueFoods = new Set();
        let validBudgetTrips = 0;
        let hasOmegaItem = false;

        const OMEGA_KEYWORDS = ['salmon', 'chia', 'flax', 'walnut', 'sardine', 'mackerel', 'tuna', 'hemp'];

        sessions.forEach(session => {
            let sessionProtein = 0;
            let sessionVitC = 0;
            let sessionIron = 0;
            let sessionFiber = 0;

            if (session.grocery_items) {
                // To track variety, we only count trips with > 3 items as valid shopping trips
                const isValidTrip = session.grocery_items.length > 3;
                if (isValidTrip && session.total_spent < 50) validBudgetTrips++;

                session.grocery_items.forEach(item => {
                    if (item.name) uniqueFoods.add(item.name.toLowerCase().trim());
                    
                    const name = item.name ? item.name.toLowerCase() : '';
                    if (OMEGA_KEYWORDS.some(k => name.includes(k))) hasOmegaItem = true;

                    if (item.nutrition_data) {
                        sessionProtein += parseFloat(item.nutrition_data.protein_g) || 0;
                        sessionVitC += parseFloat(item.nutrition_data.vit_c_mg) || 0;
                        sessionIron += parseFloat(item.nutrition_data.iron_mg) || 0;
                        sessionFiber += parseFloat(item.nutrition_data.fiber_g) || 0;
                    }
                });
            }

            maxProteinSession = Math.max(maxProteinSession, sessionProtein);
            maxVitCSession = Math.max(maxVitCSession, sessionVitC);
            maxIronSession = Math.max(maxIronSession, sessionIron);
            totalFiber += sessionFiber;
        });

        const dailyVitCV = 90; // mg
        const dailyIronV = 18; // mg

        const results = {
            protein: maxProteinSession >= 100, // 100g in a session
            vitc: maxVitCSession >= (dailyVitCV * 5), // 5x daily value
            fiber: sessions.length > 0 && ((totalFiber / sessions.length) >= 25), // avg 25g per session
            budget: sessions.length > 0 && validBudgetTrips > 0, // Got a real haul for < $50
            variety: uniqueFoods.size >= 20, // Tracked 20+ distinct foods
            streak: sessions.length >= 5, // 5 sessions tracked
            omega: hasOmegaItem, // Bought omega-rich foods
            iron: maxIronSession >= (dailyIronV * 3) // 3x daily value
        };

        setAchievements(BASE_ACHIEVEMENTS.map(badge => ({
            ...badge,
            earned: results[badge.id] || false
        })));
    };

    const handleSaveFamilyMember = async () => {
        if (!familyForm.name) return;
        setSaving(true);
        const { goal } = calculateMetrics(familyForm);
        const supabase = createClient();
        
        const newMember = {
            user_id: user.id,
            ...familyForm,
            daily_calorie_goal: goal
        };

        const { data, error } = await supabase
            .from('family_members')
            .insert(newMember)
            .select()
            .single();

        if (data && !error) {
            setFamilyMembers([...familyMembers, data]);
            setShowFamilyForm(false);
            setFamilyForm({ name: '', age: 30, gender: 'male', weight_kg: 70, height_cm: 170, activity_level: 'sedentary' });
        }
        setSaving(false);
    };

    const handleDeleteFamilyMember = async (id) => {
        const supabase = createClient();
        await supabase.from('family_members').delete().eq('id', id);
        setFamilyMembers(familyMembers.filter(m => m.id !== id));
    };

    const handleSave = async () => {
        setSaving(true);
        if (user) {
            const supabase = createClient();
            await supabase
                .from('profiles')
                .update({
                    full_name: profile.full_name,
                    dietary_preferences: profile.dietary_preferences,
                    daily_calorie_goal: profile.daily_calorie_goal,
                    currency_preference: profile.currency_preference,
                })
                .eq('id', user.id);
        }
        setSaving(false);
        setEditing(false);
    };

    const toggleDiet = (diet) => {
        const prefs = profile.dietary_preferences || [];
        if (prefs.includes(diet)) {
            setProfile({ ...profile, dietary_preferences: prefs.filter(d => d !== diet) });
        } else {
            setProfile({ ...profile, dietary_preferences: [...prefs, diet] });
        }
    };

    const handleLogout = async () => {
        localStorage.removeItem('foodlimit_demo');
        try {
            const supabase = createClient();
            await supabase.auth.signOut();
        } catch {
            // Ignore sign-out errors
        }
        window.location.href = '/login';
    };

    return (
        <div className={styles.profilePage}>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Profile</h1>
                <p className={styles.pageSubtitle}>Manage your account and preferences</p>
            </div>

            {/* Profile Card */}
            <div className={styles.profileCard}>
                <div className={styles.profileBanner} />
                <div className={styles.profileContent}>
                    <div className={styles.avatarSection}>
                        <div className={styles.avatarLarge}>
                            {(profile.full_name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div className={styles.profileInfo}>
                            {editing ? (
                                <input
                                    className="input-field"
                                    value={profile.full_name}
                                    onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                                    style={{ fontSize: '1.2rem', fontWeight: 600 }}
                                />
                            ) : (
                                <h2 className={styles.profileName}>{profile.full_name || 'Your Name'}</h2>
                            )}
                            <span className={styles.profileEmail}>
                                <Mail size={14} /> {user?.email || 'email@example.com'}
                            </span>
                        </div>
                    </div>

                    <div className={styles.profileActions}>
                        {editing ? (
                            <button onClick={handleSave} className="btn-primary" disabled={saving}>
                                <Save size={16} />
                                {saving ? 'Saving...' : 'Save'}
                            </button>
                        ) : (
                            <button onClick={() => setEditing(true)} className="btn-secondary">
                                <Edit2 size={16} />
                                Edit Profile
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Household & Family */}
            <div className={styles.section} style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 className={styles.sectionTitle} style={{ marginBottom: 0 }}>
                        <Users size={18} /> Household & BMI Calculator
                    </h3>
                    <button onClick={() => setShowFamilyForm(!showFamilyForm)} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                        {showFamilyForm ? 'Cancel' : <><Plus size={16} /> Add Member</>}
                    </button>
                </div>

                {showFamilyForm && (
                     <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '12px', marginBottom: '20px', border: '1px solid var(--border-color)' }}>
                         <h4 style={{ margin: '0 0 16px 0', color: 'var(--text-primary)' }}>New Household Member</h4>
                         <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                             <div>
                                 <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Name</label>
                                 <input className="input-field" value={familyForm.name} onChange={e => setFamilyForm({...familyForm, name: e.target.value})} placeholder="e.g. John" />
                             </div>
                             <div>
                                 <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Gender</label>
                                 <select className="input-field" value={familyForm.gender} onChange={e => setFamilyForm({...familyForm, gender: e.target.value})}>
                                     <option value="male">Male</option>
                                     <option value="female">Female</option>
                                 </select>
                             </div>
                             <div>
                                 <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Age (years)</label>
                                 <input type="number" className="input-field" value={familyForm.age} onChange={e => setFamilyForm({...familyForm, age: e.target.value})} />
                             </div>
                             <div>
                                 <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Height (cm)</label>
                                 <input type="number" className="input-field" value={familyForm.height_cm} onChange={e => setFamilyForm({...familyForm, height_cm: e.target.value})} />
                             </div>
                             <div>
                                 <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Weight (kg)</label>
                                 <input type="number" className="input-field" value={familyForm.weight_kg} onChange={e => setFamilyForm({...familyForm, weight_kg: e.target.value})} />
                             </div>
                             <div>
                                 <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Activity Level</label>
                                 <select className="input-field" value={familyForm.activity_level} onChange={e => setFamilyForm({...familyForm, activity_level: e.target.value})}>
                                     <option value="sedentary">Sedentary (Little/no ex.)</option>
                                     <option value="light">Lightly Active (1-3 days)</option>
                                     <option value="moderate">Moderately Active (3-5 days)</option>
                                     <option value="active">Active (6-7 days)</option>
                                     <option value="very_active">Very Active (Twice daily)</option>
                                 </select>
                             </div>
                         </div>
                         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                             <div style={{ display: 'flex', gap: '16px' }}>
                                 <div style={{ background: 'var(--accent-blue-dim)', padding: '8px 12px', borderRadius: '8px', color: 'var(--accent-blue)' }}>
                                     <span style={{ fontSize: '0.75rem', display: 'block', fontWeight: 600 }}>Est. BMI</span>
                                     <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>{calculateMetrics(familyForm).bmi}</span>
                                 </div>
                                 <div style={{ background: 'var(--accent-orange-dim)', padding: '8px 12px', borderRadius: '8px', color: 'var(--accent-orange)' }}>
                                     <span style={{ fontSize: '0.75rem', display: 'block', fontWeight: 600 }}>TDEE (Calories/Day)</span>
                                     <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>{calculateMetrics(familyForm).goal}</span>
                                 </div>
                             </div>
                             <button onClick={handleSaveFamilyMember} className="btn-primary" disabled={saving}>
                                 <Save size={16} /> {saving ? 'Saving...' : 'Save Member'}
                             </button>
                         </div>
                     </div>
                )}

                {familyMembers.length > 0 ? (
                     <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                         {familyMembers.map(member => (
                             <div key={member.id} style={{ background: 'var(--bg-card-hover)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', position: 'relative' }}>
                                 <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                     <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--accent-green-dim)', color: 'var(--accent-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                         {member.name.charAt(0).toUpperCase()}
                                     </div>
                                     <div>
                                         <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>{member.name}</h4>
                                         <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{member.age} yrs • {member.gender}</span>
                                     </div>
                                 </div>
                                 <button onClick={() => handleDeleteFamilyMember(member.id)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                     <Trash2 size={16} />
                                 </button>
                                 
                                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                                     <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '8px' }}>
                                         <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}><Scale size={12} /> Weight</span>
                                         <span style={{ display: 'block', fontWeight: 600, marginTop: '2px', fontSize: '0.9rem' }}>{member.weight_kg} kg</span>
                                     </div>
                                     <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '8px' }}>
                                         <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}><Ruler size={12} /> Height</span>
                                         <span style={{ display: 'block', fontWeight: 600, marginTop: '2px', fontSize: '0.9rem' }}>{member.height_cm} cm</span>
                                     </div>
                                 </div>
                                 
                                 <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
                                     <div>
                                         <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>BMI</span>
                                         <span style={{ fontWeight: 600, color: 'var(--accent-blue)' }}>{member.bmi}</span>
                                     </div>
                                     <div style={{ textAlign: 'right' }}>
                                         <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Daily Target</span>
                                         <span style={{ fontWeight: 600, color: 'var(--accent-orange)' }}>{member.daily_calorie_goal} kcal</span>
                                     </div>
                                 </div>
                             </div>
                         ))}
                     </div>
                ) : (
                     <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', padding: '20px', background: 'var(--bg-card-hover)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                         No household members added yet. Add members to calculate true household AI grocery predictions and costs across everyone.
                     </p>
                )}
            </div>

            <div className={styles.twoCol}>
                {/* Left Column */}
                <div className={styles.leftCol}>
                    {/* Dietary Preferences */}
                    <div className={styles.section}>
                        <h3 className={styles.sectionTitle}>
                            <Leaf size={18} /> Dietary Preferences
                        </h3>
                        <div className={styles.dietGrid}>
                            {DIETARY_OPTIONS.map(diet => (
                                <button
                                    key={diet}
                                    className={`${styles.dietTag} ${(profile.dietary_preferences || []).includes(diet) ? styles.dietActive : ''}`}
                                    onClick={() => editing && toggleDiet(diet)}
                                    disabled={!editing}
                                >
                                    {diet}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Calorie Goal */}
                    <div className={styles.section}>
                        <h3 className={styles.sectionTitle}>
                            <Target size={18} /> Daily Calorie Goal
                        </h3>
                        <div className={styles.calorieGoal}>
                            {editing ? (
                                <input
                                    type="number"
                                    className="input-field"
                                    value={profile.daily_calorie_goal}
                                    onChange={(e) => setProfile({ ...profile, daily_calorie_goal: parseInt(e.target.value) || 2000 })}
                                    style={{ maxWidth: '200px', fontSize: '1.5rem', fontWeight: 700, textAlign: 'center' }}
                                />
                            ) : (
                                <span className={styles.calorieNumber}>{profile.daily_calorie_goal || 2000}</span>
                            )}
                            <span className={styles.calorieUnit}>calories / day</span>
                        </div>
                        <div className={styles.calorieBar}>
                            <div className={styles.calorieBarFill} style={{ width: '78%' }} />
                        </div>
                        <span className={styles.calorieNote}>You&apos;re hitting 78% of your daily goal on average</span>
                    </div>

                    {/* Currency Preference */}
                    <div className={styles.section}>
                        <h3 className={styles.sectionTitle}>
                            <ShoppingCart size={18} /> Currency Preference
                        </h3>
                        <div style={{ marginTop: '16px' }}>
                            {editing ? (
                                <select 
                                    className="input-field" 
                                    style={{ width: '100%' }}
                                    value={profile.currency_preference || 'USD'} 
                                    onChange={e => setProfile({...profile, currency_preference: e.target.value})}
                                >
                                    <option value="USD">USD ($)</option>
                                    <option value="EUR">EUR (€)</option>
                                    <option value="GBP">GBP (£)</option>
                                    <option value="INR">INR (₹)</option>
                                    <option value="CAD">CAD (CA$)</option>
                                    <option value="AUD">AUD (A$)</option>
                                    <option value="JPY">JPY (¥)</option>
                                    <option value="CHF">CHF (CHF)</option>
                                    <option value="CNY">CNY (¥)</option>
                                    <option value="SEK">SEK (kr)</option>
                                    <option value="NZD">NZD (NZ$)</option>
                                    <option value="KRW">KRW (₩)</option>
                                    <option value="SGD">SGD (S$)</option>
                                    <option value="NOK">NOK (kr)</option>
                                    <option value="MXN">MXN (Mex$)</option>
                                    <option value="HKD">HKD (HK$)</option>
                                    <option value="ZAR">ZAR (R)</option>
                                    <option value="BRL">BRL (R$)</option>
                                    <option value="RUB">RUB (₽)</option>
                                </select>
                            ) : (
                                <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {profile.currency_preference} ({getCurrencySymbol(profile.currency_preference)})
                                </div>
                            )}
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '8px' }}>
                                This symbol will be used across your dashboards and history.
                            </p>
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div className={styles.section}>
                        <h3 className={styles.sectionTitle}>
                            <TrendingUp size={18} /> Quick Summary
                        </h3>
                        <div className={styles.quickStats}>
                            <div className={styles.quickStat}>
                                <ShoppingCart size={18} style={{ color: 'var(--accent-green)' }} />
                                <div>
                                    <span className={styles.quickValue}>12</span>
                                    <span className={styles.quickLabel}>Shopping Trips</span>
                                </div>
                            </div>
                            <div className={styles.quickStat}>
                                <Flame size={18} style={{ color: 'var(--accent-orange)' }} />
                                <div>
                                    <span className={styles.quickValue}>2,150</span>
                                    <span className={styles.quickLabel}>Avg Daily Cal</span>
                                </div>
                            </div>
                            <div className={styles.quickStat}>
                                <Heart size={18} style={{ color: 'var(--accent-pink)' }} />
                                <div>
                                    <span className={styles.quickValue}>78</span>
                                    <span className={styles.quickLabel}>Health Score</span>
                                </div>
                            </div>
                            <div className={styles.quickStat}>
                                <Zap size={18} style={{ color: 'var(--accent-yellow)' }} />
                                <div>
                                    <span className={styles.quickValue}>$62</span>
                                    <span className={styles.quickLabel}>Avg per Trip</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column - Achievements */}
                <div className={styles.rightCol}>
                    <div className={styles.section}>
                        <h3 className={styles.sectionTitle}>
                            <Trophy size={18} /> Achievements
                        </h3>
                        <div className={styles.achievementsGrid}>
                            {achievements.map(badge => (
                                <div
                                    key={badge.id}
                                    className={`${styles.badge} ${!badge.earned ? styles.badgeLocked : ''}`}
                                >
                                    <div className={styles.badgeIcon} style={{ '--badge-color': badge.color }}>
                                        <span>{badge.icon}</span>
                                    </div>
                                    <div className={styles.badgeInfo}>
                                        <span className={styles.badgeTitle}>{badge.title}</span>
                                        <span className={styles.badgeDesc}>{badge.desc}</span>
                                    </div>
                                    {badge.earned && (
                                        <div className={styles.badgeEarned}>
                                            <Star size={14} />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Logout */}
            <div className={styles.logoutSection}>
                <button onClick={handleLogout} className="btn-danger">
                    <LogOut size={18} />
                    Sign Out
                </button>
            </div>
        </div>
    );
}
