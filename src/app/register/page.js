'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, User, Sparkles, UserPlus } from 'lucide-react';
import styles from './register.module.css';

export default function RegisterPage() {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setLoading(true);

        try {
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                    },
                },
            });

            if (error) {
                setError(error.message);
            } else {
                setSuccess(true);
                setTimeout(() => {
                    router.push('/login');
                }, 2000);
            }
        } catch {
            setError('An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.bgOrbs}>
                <div className={styles.orb1}></div>
                <div className={styles.orb2}></div>
                <div className={styles.orb3}></div>
            </div>

            <div className={styles.floatingIcons}>
                <span className={styles.foodIcon} style={{ '--delay': '0s', '--x': '8%', '--y': '25%' }}>🥗</span>
                <span className={styles.foodIcon} style={{ '--delay': '1.2s', '--x': '88%', '--y': '18%' }}>🍗</span>
                <span className={styles.foodIcon} style={{ '--delay': '0.7s', '--x': '75%', '--y': '80%' }}>🥛</span>
                <span className={styles.foodIcon} style={{ '--delay': '1.8s', '--x': '12%', '--y': '75%' }}>🍳</span>
                <span className={styles.foodIcon} style={{ '--delay': '2.2s', '--x': '45%', '--y': '10%' }}>🥕</span>
            </div>

            <div className={styles.card}>
                <div className={styles.cardHeader}>
                    <div className={styles.logo}>
                        <Sparkles size={28} />
                        <span>FoodLimit</span>
                    </div>
                    <h1 className={styles.title}>Create Account</h1>
                    <p className={styles.subtitle}>Start your nutrition tracking journey</p>
                </div>

                {success ? (
                    <div className={styles.successMessage}>
                        <span className={styles.successIcon}>✅</span>
                        <h3>Account Created!</h3>
                        <p>Check your email to verify, then sign in.</p>
                    </div>
                ) : (
                    <form onSubmit={handleRegister} className={styles.form}>
                        <div className={styles.inputGroup}>
                            <label className="input-label" htmlFor="fullName">Full Name</label>
                            <div className={styles.inputWrapper}>
                                <User size={18} className={styles.inputIcon} />
                                <input
                                    id="fullName"
                                    type="text"
                                    className="input-field"
                                    placeholder="John Doe"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    required
                                    style={{ paddingLeft: '44px' }}
                                />
                            </div>
                        </div>

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
                                    placeholder="Min 6 characters"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    style={{ paddingLeft: '44px' }}
                                />
                            </div>
                        </div>

                        <div className={styles.inputGroup}>
                            <label className="input-label" htmlFor="confirmPassword">Confirm Password</label>
                            <div className={styles.inputWrapper}>
                                <Lock size={18} className={styles.inputIcon} />
                                <input
                                    id="confirmPassword"
                                    type="password"
                                    className="input-field"
                                    placeholder="Repeat password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
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
                                    <UserPlus size={18} />
                                    Create Account
                                </>
                            )}
                        </button>
                    </form>
                )}

                <p className={styles.footer}>
                    Already have an account?{' '}
                    <Link href="/login" className={styles.link}>Sign In</Link>
                </p>
            </div>
        </div>
    );
}
