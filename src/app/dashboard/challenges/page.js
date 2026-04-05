'use client';

import DailyChallenges from '@/components/DailyChallenges';
import ChallengeResults from '@/components/ChallengeResults';
import Leaderboards from '@/components/Leaderboards';
import HeadToHead from '@/components/HeadToHead';
import CompetitiveNotifications from '@/components/CompetitiveNotifications';

export default function ChallengesPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <CompetitiveNotifications />
      <DailyChallenges />
      <HeadToHead />
      <Leaderboards />
      <ChallengeResults />
    </div>
  );
}
