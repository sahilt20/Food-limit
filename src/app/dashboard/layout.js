'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { useRouter, usePathname } from 'next/navigation';
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
    Download,
} from 'lucide-react';
import styles from './layout.module.css';

const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/dashboard/add', label: 'Add Groceries', icon: PlusCircle },
    { href: '/dashboard/history', label: 'History', icon: History },
    { href: '/dashboard/profile', label: 'Profile', icon: UserCircle },
];

export default function DashboardLayout({ children }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const pathname = usePathname();
    const router = useRouter();
    const supabase = createClient();

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
    }, []);

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

    return (
        <div className={styles.dashboardContainer}>
            {/* Mobile overlay */}
            {sidebarOpen && (
                <div className={styles.overlay} onClick={() => setSidebarOpen(false)} />
            )}

            {/* Sidebar */}
            <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
                <div className={styles.sidebarHeader}>
                    <Link href="/dashboard" className={styles.logo}>
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
                    <a href="https://median.co/" target="_blank" rel="noopener noreferrer" className={styles.downloadBtn} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: 'var(--accent-primary, #6366f1)', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', outline: 'none', width: '100%', marginBottom: '1rem', fontWeight: '500', transition: 'opacity 0.2s', textDecoration: 'none' }} onMouseOver={e => e.currentTarget.style.opacity = '0.9'} onMouseOut={e => e.currentTarget.style.opacity = '1'}>
                        <Download size={18} />
                        <span>Get Android App</span>
                    </a>
                    <div className={styles.userInfo}>
                        <div className={styles.userAvatar}>
                            {(profile?.full_name || 'U').charAt(0).toUpperCase()}
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
                    <button className={styles.menuBtn} onClick={() => setSidebarOpen(true)}>
                        <Menu size={24} />
                    </button>
                    <div className={styles.topbarTitle}>
                        {navItems.find(i => i.href === pathname)?.label || 'FoodLimit'}
                    </div>
                    <div className={styles.topbarRight}>
                        <div className={styles.topbarAvatar}>
                            {(profile?.full_name || 'U').charAt(0).toUpperCase()}
                        </div>
                    </div>
                </header>
                <div className={styles.pageContent}>
                    {children}
                </div>
            </main>
        </div>
    );
}
