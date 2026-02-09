'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { DAILY_VALUES, NUTRIENT_INFO } from '@/lib/nutritionDB';
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
} from 'lucide-react';
import styles from './profile.module.css';

const DIETARY_OPTIONS = [
    'Vegetarian', 'Vegan', 'Keto', 'Paleo', 'Gluten-Free',
    'Dairy-Free', 'Low-Carb', 'High-Protein', 'Mediterranean', 'None',
];

const ACHIEVEMENTS = [
    { id: 'protein', icon: '💪', title: 'Protein Champion', desc: 'Hit 100g+ protein in a session', earned: true, color: 'var(--accent-blue)' },
    { id: 'vitc', icon: '🍊', title: 'Vitamin C Master', desc: 'Exceeded daily Vitamin C 5x', earned: true, color: 'var(--accent-orange)' },
    { id: 'fiber', icon: '🥬', title: 'Fiber Hero', desc: 'Averaged 25g+ fiber per day', earned: true, color: 'var(--accent-green)' },
    { id: 'budget', icon: '💰', title: 'Budget Guru', desc: 'Under $50 per trip for a month', earned: false, color: 'var(--accent-yellow)' },
    { id: 'variety', icon: '🌈', title: 'Food Rainbow', desc: 'Tracked 20+ different foods', earned: true, color: 'var(--accent-purple)' },
    { id: 'streak', icon: '🔥', title: '5-Day Streak', desc: 'Tracked groceries 5 days in a row', earned: false, color: 'var(--accent-red)' },
    { id: 'omega', icon: '🐟', title: 'Omega Master', desc: 'Hit omega-3 goals for a week', earned: false, color: 'var(--accent-cyan)' },
    { id: 'iron', icon: '🏋️', title: 'Iron Force', desc: 'Exceeded daily iron 3x in a row', earned: true, color: 'var(--accent-pink)' },
];

export default function ProfilePage() {
    const [profile, setProfile] = useState({
        full_name: '',
        dietary_preferences: [],
        daily_calorie_goal: 2000,
    });
    const [user, setUser] = useState(null);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isDemo, setIsDemo] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const loadProfile = async () => {
            const demo = localStorage.getItem('foodlimit_demo');
            if (demo) {
                setIsDemo(true);
                setUser({ email: 'demo@foodlimit.app' });
                setProfile({
                    full_name: 'Demo User',
                    dietary_preferences: ['High-Protein', 'Mediterranean'],
                    daily_calorie_goal: 2200,
                });
                return;
            }

            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUser(user);
                const { data } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();
                if (data) setProfile(data);
            }
        };
        loadProfile();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        if (!isDemo) {
            const supabase = createClient();
            await supabase
                .from('profiles')
                .update({
                    full_name: profile.full_name,
                    dietary_preferences: profile.dietary_preferences,
                    daily_calorie_goal: profile.daily_calorie_goal,
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
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push('/login');
        router.refresh();
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
                            {ACHIEVEMENTS.map(badge => (
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
