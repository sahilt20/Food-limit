'use client';

import Link from 'next/link';
import {
  Sparkles,
  ArrowRight,
  BarChart3,
  Shield,
  Zap,
  Apple,
  Brain,
  TrendingUp,
  ShoppingCart,
  Heart,
  CheckCircle2,
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
    icon: BarChart3,
    title: 'Beautiful Dashboards',
    desc: 'Interactive charts showing calorie trends, macro splits, spending patterns, and micronutrient coverage.',
    color: 'var(--accent-purple)',
    bg: 'var(--accent-purple-dim)',
  },
  {
    icon: Heart,
    title: 'Health Score & Goals',
    desc: 'Track your overall nutrition health score, set daily calorie goals, and earn achievement badges.',
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
  'Calories', 'Protein', 'Carbs', 'Fat', 'Fiber', 'Vitamin A',
  'Vitamin C', 'Vitamin D', 'Vitamin B12', 'Iron', 'Calcium',
  'Zinc', 'Magnesium', 'Folate', 'Potassium', 'Omega-3',
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
          The smartest way to analyze your grocery shopping. Get detailed macro & micro nutrient
          breakdowns, beautiful dashboards, and AI-powered insights — completely free.
        </p>
        <div className={styles.heroCTA}>
          <Link href="/register" className="btn-primary" style={{ padding: '16px 36px', fontSize: '1rem' }}>
            Start Tracking Free
            <ArrowRight size={18} />
          </Link>
          <Link href="/login" className="btn-secondary" style={{ padding: '16px 36px', fontSize: '1rem' }}>
            <Sparkles size={18} />
            Try Demo
          </Link>
          <a href="https://median.co/" target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ padding: '16px 36px', fontSize: '1rem' }}>
            📱 Download Android App
          </a>
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
        <p className={styles.sectionSubtitle}>Three simple steps to nutrition intelligence</p>
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
