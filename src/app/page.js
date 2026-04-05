'use client';

import Link from 'next/link';
import {
  Sparkles,
  ArrowRight,
  BarChart3,
  Shield,
  Zap,
  Brain,
  TrendingUp,
  ShoppingCart,
  Heart,
  CheckCircle2,
  Download,
  Scale,
  Trophy,
  Users,
  Swords,
  Clock,
  Lightbulb,
} from 'lucide-react';
import styles from './home.module.css';

const features = [
  {
    icon: ShoppingCart,
    title: 'Smart Grocery Tracking',
    desc: 'Log your groceries manually or via receipt upload. Track spending, quantities, and categories effortlessly.',
    color: 'var(--accent-green)',
    bg: 'var(--accent-green-dim)',
  },
  {
    icon: Brain,
    title: 'AI Nutrition Analysis',
    desc: 'Instant detailed nutrition breakdown for every item — calories, macros, and 14+ micronutrients analyzed.',
    color: 'var(--accent-blue)',
    bg: 'var(--accent-blue-dim)',
  },
  {
    icon: Scale,
    title: 'Weight & Health Tracking',
    desc: 'Log weight, body fat, and mood daily. AI-powered plateau detection and weekly pattern insights.',
    color: 'var(--accent-green)',
    bg: 'var(--accent-green-dim)',
  },
  {
    icon: Trophy,
    title: 'Achievements & Streaks',
    desc: 'Earn bronze to diamond badges across 6 categories. Build streaks and unlock gamification rewards.',
    color: 'var(--accent-yellow)',
    bg: 'var(--accent-yellow-dim)',
  },
  {
    icon: Swords,
    title: 'Daily Challenges',
    desc: 'Complete daily and weekly nutrition challenges. Compete head-to-head and climb leaderboards.',
    color: 'var(--accent-orange)',
    bg: 'var(--accent-orange-dim)',
  },
  {
    icon: Users,
    title: 'Social & Friends',
    desc: 'Follow friends, share progress to your feed, and get notified of their milestones in real time.',
    color: 'var(--accent-purple)',
    bg: 'var(--accent-purple-dim)',
  },
  {
    icon: BarChart3,
    title: 'Advanced Analytics',
    desc: 'Interactive charts showing calorie trends, macro splits, spending patterns, and AI weekly insights.',
    color: 'var(--accent-blue)',
    bg: 'var(--accent-blue-dim)',
  },
  {
    icon: Clock,
    title: 'Expiry Tracker',
    desc: 'Never waste food again. Track expiry dates and get alerts before items go bad.',
    color: 'var(--accent-pink)',
    bg: 'var(--accent-pink-dim)',
  },
  {
    icon: Lightbulb,
    title: 'AI Recommendations',
    desc: 'Personalized food suggestions based on your history, goals, and nutritional gaps.',
    color: 'var(--accent-green)',
    bg: 'var(--accent-green-dim)',
  },
  {
    icon: Heart,
    title: 'Goals & Diet Plans',
    desc: 'Set intake goals, generate AI meal plans, and get smart shopping list suggestions.',
    color: 'var(--accent-pink)',
    bg: 'var(--accent-pink-dim)',
  },
  {
    icon: Shield,
    title: '100% Free & Secure',
    desc: 'No hidden costs. Your data is secured with Supabase authentication and row-level security.',
    color: 'var(--accent-orange)',
    bg: 'var(--accent-orange-dim)',
  },
  {
    icon: Zap,
    title: 'Instant Insights',
    desc: 'Local nutrition database means zero API latency. Get results instantly without any paid services.',
    color: 'var(--accent-yellow)',
    bg: 'var(--accent-yellow-dim)',
  },
];

const nutrients = [
  'Calories', 'Protein', 'Carbs', 'Fat', 'Fiber', 'Weight Tracking',
  'Achievements', 'Challenges', 'Leaderboards', 'Friends', 'Social Feed',
  'AI Insights', 'Meal Planning', 'Expiry Alerts', 'Streak Tracking', 'Omega-3',
];

export default function HomePage() {
  return (
    <div className={styles.homePage}>
      {/* Background effects */}
      <div className={styles.bgEffects}>
        <div className={styles.orb1} />
        <div className={styles.orb2} />
        <div className={styles.orb3} />
        <div className={styles.grid} />
      </div>

      {/* Navigation */}
      <nav className={styles.nav}>
        <Link href="/" className={styles.navLogo}>
          <Sparkles size={24} />
          <span>FoodLimit</span>
        </Link>
        <div className={styles.navLinks}>
          <Link href="/download" className={styles.navLink} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Download size={16} />
            Download APK
          </Link>
          <Link href="/login" className={styles.navLink}>Sign In</Link>
          <Link href="/register" className="btn-primary" style={{ padding: '10px 24px' }}>
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroBadge}>
          <Sparkles size={14} />
          <span>100% Free • No API Keys Required</span>
        </div>
        <h1 className={styles.heroTitle}>
          Track Your Food.<br />
          <span className={styles.gradientText}>Know Your Nutrition.</span>
        </h1>
        <p className={styles.heroDesc}>
          The all-in-one nutrition platform. Track food, weight, and health goals — compete with
          friends, earn achievements, and get AI-powered insights — completely free.
        </p>
        <div className={styles.heroCTA}>
          <Link href="/register" className="btn-primary" style={{ padding: '16px 36px', fontSize: '1rem' }}>
            Start Tracking Free
            <ArrowRight size={18} />
          </Link>
          <Link href="/download" className={styles.downloadBtn}>
            <Download size={18} />
            Download Android APK
          </Link>
        </div>

        {/* Nutrient Pills */}
        <div className={styles.nutrientPills}>
          {nutrients.map((n, i) => (
            <span key={n} className={styles.pill} style={{ animationDelay: `${i * 0.1}s` }}>
              <CheckCircle2 size={12} /> {n}
            </span>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className={styles.features} id="features">
        <h2 className={styles.sectionTitle}>Everything You Need</h2>
        <p className={styles.sectionSubtitle}>Powerful nutrition intelligence, zero cost</p>
        <div className={styles.featureGrid}>
          {features.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <div key={idx} className={styles.featureCard} style={{ animationDelay: `${idx * 0.1}s` }}>
                <div className={styles.featureIcon} style={{ background: feature.bg, color: feature.color }}>
                  <Icon size={24} />
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* How It Works */}
      <section className={styles.howItWorks}>
        <h2 className={styles.sectionTitle}>How It Works</h2>
        <p className={styles.sectionSubtitle}>Three simple steps to total health intelligence</p>
        <div className={styles.stepsGrid}>
          <div className={styles.step}>
            <div className={styles.stepNumber}>1</div>
            <h3>Add Your Groceries</h3>
            <p>Enter items manually with our smart food picker or upload a receipt photo</p>
          </div>
          <div className={styles.stepArrow}>→</div>
          <div className={styles.step}>
            <div className={styles.stepNumber}>2</div>
            <h3>Get Instant Analysis</h3>
            <p>Our built-in database instantly calculates 20+ nutrients for each item</p>
          </div>
          <div className={styles.stepArrow}>→</div>
          <div className={styles.step}>
            <div className={styles.stepNumber}>3</div>
            <h3>Track & Improve</h3>
            <p>Beautiful dashboards show trends, gaps, and achievements over time</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className={styles.ctaSection}>
        <div className={styles.ctaCard}>
          <h2>Start Your Nutrition Journey Today</h2>
          <p>Join thousands of health-conscious shoppers. Free forever.</p>
          <Link href="/register" className="btn-primary" style={{ padding: '18px 48px', fontSize: '1.1rem' }}>
            Create Free Account
            <ArrowRight size={20} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.footerLogo}>
            <Sparkles size={20} />
            <span>FoodLimit</span>
          </div>
          <p className={styles.footerText}>
            Built with ❤️ • Open Source • Free Forever
          </p>
        </div>
      </footer>
    </div>
  );
}
