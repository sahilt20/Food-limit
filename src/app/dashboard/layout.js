'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { usePathname } from 'next/navigation';
import { AiOperationsProvider } from '@/lib/AiOperationsContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import Link from 'next/link';
import {
    LayoutDashboard,
    PlusCircle,
    History,
    UserCircle,
    LogOut,
    Menu,
    X,
    Sparkles,
    ChevronRight,
    ChefHat,
    Lightbulb,
    CalendarDays,
    Sun,
    Moon,
    Clock,
    Target,
    ShoppingCart,
    BarChart2,
    MoreHorizontal,
} from 'lucide-react';
import styles from './layout.module.css';

const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/dashboard/add', label: 'Add Groceries', icon: PlusCircle },
    { href: '/dashboard/history', label: 'History', icon: History },
    { href: '/dashboard/recipes', label: 'AI Recipes', icon: ChefHat },
    { href: '/dashboard/meal-planner', label: 'Meal Planner', icon: CalendarDays },
    { href: '/dashboard/recommendations', label: 'Recommendations', icon: Lightbulb },
    { href: '/dashboard/goals',         label: 'Nutrition Goals',  icon: Target },
    { href: '/dashboard/shopping-list', label: 'Shopping List',    icon: ShoppingCart },
    { href: '/dashboard/analytics',     label: 'Analytics',        icon: BarChart2 },
    { href: '/dashboard/expiry',        label: 'Expiry Tracker',   icon: Clock },
    { href: '/dashboard/profile',       label: 'Profile',          icon: UserCircle },
];

// Bottom nav shows the 4 most-used destinations + a "More" button to open sidebar
const bottomNavItems = [
    { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
    { href: '/dashboard/add', label: 'Add', icon: PlusCircle },
    { href: '/dashboard/shopping-list', label: 'List', icon: ShoppingCart },
    { href: '/dashboard/recipes', label: 'Recipes', icon: ChefHat },
];

export default function DashboardLayout({ children }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [theme, setTheme] = useState(() => (
        typeof window !== 'undefined'
            ? localStorage.getItem('foodlimit_theme') || 'dark'
            : 'dark'
    ));
    const pathname = usePathname();
    const supabase = useMemo(() => createClient(), []);

    useEffect(() => {
        const getUser = async () => {
            // Always check real auth FIRST — so real login isn't overridden by stale demo flag
            try {
                const { data: { user: authUser } } = await supabase.auth.getUser();
                if (authUser) {
                    // Real authenticated user — clear any stale demo flag
                    localStorage.removeItem('foodlimit_demo');
                    setUser(authUser);
                    const { data } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', authUser.id)
                        .single();
                    if (data) setProfile(data);
                    return;
                }
            } catch {
                // Supabase auth check failed — continue to demo check
            }

            // Fall back to demo mode if flag is set
            const isDemo = localStorage.getItem('foodlimit_demo');
            if (isDemo) {
                setUser({ email: 'demo@foodlimit.app', id: 'demo' });
                setProfile({ full_name: 'Demo User' });
            }
        };
        getUser();
    }, [supabase]);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    useEffect(() => {
        document.body.style.overflow = sidebarOpen ? 'hidden' : '';
        return () => {
            document.body.style.overflow = '';
        };
    }, [sidebarOpen]);

    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        localStorage.setItem('foodlimit_theme', newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
    };

    const handleLogout = async () => {
        // Clear demo mode
        localStorage.removeItem('foodlimit_demo');
        // Sign out from Supabase
        try {
            await supabase.auth.signOut();
        } catch {
            // Ignore sign-out errors (e.g. no session)
        }
        // Hard redirect — router.push can fail with stale client state
        window.location.href = '/login';
    };

    const getInitials = (name) => {
        if (!name) return 'U';
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    };

    return (
        <div className={styles.dashboardContainer}>
            {/* Mobile overlay */}
            {sidebarOpen && (
                <div className={styles.overlay} onClick={() => setSidebarOpen(false)} />
            )}

            {/* Sidebar */}
            <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
                <div className={styles.sidebarHeader}>
                    <Link href="/dashboard" className={styles.logo} onClick={() => setSidebarOpen(false)}>
                        <Sparkles size={24} />
                        <span>FoodLimit</span>
                    </Link>
                    <button className={styles.closeSidebar} onClick={() => setSidebarOpen(false)}>
                        <X size={20} />
                    </button>
                </div>

                <nav className={styles.nav}>
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`${styles.navItem} ${isActive ? styles.navActive : ''}`}
                                onClick={() => setSidebarOpen(false)}
                            >
                                <div className={styles.navIconWrap}>
                                    <Icon size={20} />
                                </div>
                                <span>{item.label}</span>
                                {isActive && <ChevronRight size={16} className={styles.navArrow} />}
                            </Link>
                        );
                    })}
                </nav>

                <div className={styles.sidebarFooter}>
                    <div className={styles.userInfo}>
                        <div className={styles.userAvatar}>
                            {getInitials(profile?.full_name)}
                        </div>
                        <div className={styles.userDetails}>
                            <span className={styles.userName}>{profile?.full_name || 'User'}</span>
                            <span className={styles.userEmail}>{user?.email || ''}</span>
                        </div>
                    </div>
                    <button onClick={handleLogout} className={styles.logoutBtn}>
                        <LogOut size={18} />
                        <span>Logout</span>
                    </button>
                </div>
            </aside>

            {/* Main content */}
            <main className={styles.mainContent}>
                <header className={styles.topbar}>
                    <button
                        className={styles.menuBtn}
                        onClick={() => setSidebarOpen(true)}
                        aria-label="Open navigation menu"
                        aria-expanded={sidebarOpen}
                    >
                        <Menu size={24} />
                    </button>
                    <div className={styles.topbarInfo}>
                        <div className={styles.topbarLabel}>FoodLimit</div>
                        <div className={styles.topbarTitle}>
                            {navItems.find(i => i.href === pathname)?.label || 'FoodLimit'}
                        </div>
                    </div>
                    <div className={styles.topbarRight}>
                        <button
                            onClick={toggleTheme}
                            className={styles.themeToggle}
                            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                        >
                            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                        </button>
                        <div className={styles.topbarAvatar}>
                            {getInitials(profile?.full_name)}
                        </div>
                    </div>
                </header>
                <AiOperationsProvider>
                    <ErrorBoundary>
                        <div className={styles.pageContent}>
                            {children}
                        </div>
                    </ErrorBoundary>
                </AiOperationsProvider>

                {/* Mobile bottom navigation */}
                <nav className={styles.bottomNav}>
                    {bottomNavItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`${styles.bottomNavItem} ${isActive ? styles.bottomNavActive : ''}`}
                            >
                                <Icon size={22} />
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}
                    <button
                        className={styles.bottomNavItem}
                        onClick={() => setSidebarOpen(true)}
                        aria-label="Open menu"
                    >
                        <MoreHorizontal size={22} />
                        <span>More</span>
                    </button>
                </nav>
            </main>
        </div>
    );
}
