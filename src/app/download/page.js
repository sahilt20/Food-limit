import Link from 'next/link';
import { Download, Smartphone, ShieldCheck, ArrowLeft, Sparkles } from 'lucide-react';
import styles from './download.module.css';

export default function DownloadPage() {
    return (
        <div className={styles.container}>
            {/* Background elements */}
            <div className={styles.bgGlow}></div>

            <nav className={styles.nav}>
                <Link href="/" className={styles.backLink}>
                    <ArrowLeft size={20} />
                    <span>Back to Home</span>
                </Link>
                <div className={styles.logo}>
                    <Sparkles size={24} />
                    <span>FoodLimit</span>
                </div>
            </nav>

            <main className={styles.main}>
                <div className={styles.heroSection}>
                    <div className={styles.badge}>
                        <Smartphone size={16} />
                        <span>Android App Available</span>
                    </div>

                    <h1 className={styles.title}>
                        Take Control of Your Nutrition <span className={styles.gradientText}>Anywhere</span>
                    </h1>

                    <p className={styles.subtitle}>
                        Download the official FoodLimit Android App for native performance, push notifications, and AI scanning on the go.
                    </p>

                    <div className={styles.downloadCard}>
                        <div className={styles.cardInfo}>
                            <h3>FoodLimit for Android</h3>
                            <p>Version 1.0.0 • Requires Android 8.0+</p>
                        </div>
                        <a href="/FoodLimit.apk" download className={styles.downloadBtn}>
                            <Download size={20} />
                            Download APK
                        </a>
                    </div>

                    <div className={styles.features}>
                        <div className={styles.feature}>
                            <ShieldCheck size={24} className={styles.featureIcon} />
                            <h4>Secure & Private</h4>
                            <p>Your nutrition data is encrypted and saved securely to only your account.</p>
                        </div>
                        <div className={styles.feature}>
                            <Sparkles size={24} className={styles.featureIcon} />
                            <h4>AI Receipt Scanning</h4>
                            <p>Use your camera to instantly analyze grocery receipts and track calories.</p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
