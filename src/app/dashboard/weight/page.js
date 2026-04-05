'use client';

import WeightTracker from '@/components/WeightTracker';
import RealtimeCalorieTracker from '@/components/RealtimeCalorieTracker';
import ProgressCharts from '@/components/ProgressCharts';
import PlateauDetection from '@/components/PlateauDetection';
import PatternAnalysis from '@/components/PatternAnalysis';
import AIWeeklyInsights from '@/components/AIWeeklyInsights';

export default function WeightPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <WeightTracker />
      <RealtimeCalorieTracker />
      <ProgressCharts />
      <AIWeeklyInsights />
      <PatternAnalysis />
      <PlateauDetection />
    </div>
  );
}
