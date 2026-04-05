'use client';

import AchievementsGallery from '@/components/AchievementsGallery';
import StreakTracker from '@/components/StreakTracker';
import GamificationModeSelector from '@/components/GamificationModeSelector';
import CelebrationAnimation from '@/components/CelebrationAnimation';

export default function AchievementsPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <GamificationModeSelector />
      <StreakTracker />
      <AchievementsGallery />
      <CelebrationAnimation />
    </div>
  );
}
