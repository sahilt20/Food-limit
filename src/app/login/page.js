'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, LogIn, Sparkles, ArrowRight } from 'lucide-react';
import styles from './login.module.css';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                setError(error.message);
            } else {
                router.push('/dashboard');
                router.refresh();
            }
        } catch {
            setError('An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    // Demo mode - skip auth
    const handleDemoMode = () => {
        localStorage.setItem('foodlimit_demo', 'true');
        router.push('/dashboard');
    };

    return (
        <div className={styles.container}>
            {/* Animated background elements */}
            <div className={styles.bgOrbs}>
                <div className={styles.orb1}></div>
                <div className={styles.orb2}></div>
                <div className={styles.orb3}></div>
            </div>

            {/* Floating food icons */}
            <div className={styles.floatingIcons}>
                <span className={styles.foodIcon} style={{ '--delay': '0s', '--x': '10%', '--y': '20%' }}>🥑</span>
                <span className={styles.foodIcon} style={{ '--delay': '1s', '--x': '85%', '--y': '15%' }}>🍎</span>
                <span className={styles.foodIcon} style={{ '--delay': '2s', '--x': '70%', '--y': '75%' }}>🥦</span>
                <span className={styles.foodIcon} style={{ '--delay': '0.5s', '--x': '15%', '--y': '70%' }}>🍊</span>
                <span className={styles.foodIcon} style={{ '--delay': '1.5s', '--x': '50%', '--y': '85%' }}>🥕</span>
                <span className={styles.foodIcon} style={{ '--delay': '2.5s', '--x': '90%', '--y': '50%' }}>🍇</span>
            </div>

            <div className={styles.card}>
                <div className={styles.cardHeader}>
                    <div className={styles.logo}>
                        <Sparkles size={28} />
                        <span>FoodLimit</span>
                    </div>
                    <h1 className={styles.title}>Welcome Back</h1>
                    <p className={styles.subtitle}>Track your nutrition, transform your health</p>
                </div>

                <form onSubmit={handleLogin} className={styles.form}>
                    <div className={styles.inputGroup}>
                        <label className="input-label" htmlFor="email">Email</label>
                        <div className={styles.inputWrapper}>
                            <Mail size={18} className={styles.inputIcon} />
                            <input
                                id="email"
                                type="email"
                                className="input-field"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                style={{ paddingLeft: '44px' }}
                            />
                        </div>
                    </div>

                    <div className={styles.inputGroup}>
                        <label className="input-label" htmlFor="password">Password</label>
                        <div className={styles.inputWrapper}>
                            <Lock size={18} className={styles.inputIcon} />
                            <input
                                id="password"
                                type="password"
                                className="input-field"
                                placeholder="Your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                style={{ paddingLeft: '44px' }}
                            />
                        </div>
                    </div>

                    {error && <div className={styles.error}>{error}</div>}

                    <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', padding: '16px' }}>
                        {loading ? (
                            <span className={styles.spinner}></span>
                        ) : (
                            <>
                                <LogIn size={18} />
                                Sign In
                            </>
                        )}
                    </button>
                </form>

                <div className={styles.divider}>
                    <span>or</span>
                </div>

                <p className={styles.footer}>
                    Don&apos;t have an account?{' '}
                    <Link href="/register" className={styles.link}>Create one</Link>
                </p>
            </div>
        </div>
    );
}
