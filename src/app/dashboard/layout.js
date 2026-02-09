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
            // Check demo mode
            const isDemo = localStorage.getItem('foodlimit_demo');
            if (isDemo) {
                setUser({ email: 'demo@foodlimit.app', id: 'demo' });
                setProfile({ full_name: 'Demo User' });
                return;
            }

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
        getUser();
    }, []);

    const handleLogout = async () => {
        localStorage.removeItem('foodlimit_demo');
        await supabase.auth.signOut();
        router.push('/login');
        router.refresh();
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
