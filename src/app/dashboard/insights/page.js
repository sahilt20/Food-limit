'use client';
import AIWeeklyInsights from '@/components/AIWeeklyInsights';
import PatternAnalysis from '@/components/PatternAnalysis';

export default function InsightsPage() {
  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '2rem' }}>
        🤖 AI Insights & Analysis
      </h1>
      
      <div style={{ display: 'grid', gap: '2rem' }}>
        <AIWeeklyInsights />
        <PatternAnalysis />
      </div>
    </div>
  );
}
