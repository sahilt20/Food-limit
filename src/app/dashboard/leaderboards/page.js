'use client';
import Leaderboards from '@/components/Leaderboards';

export default function LeaderboardsPage() {
  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '2rem' }}>
        📊 Leaderboards & Rankings
      </h1>
      
      <Leaderboards />
    </div>
  );
}
