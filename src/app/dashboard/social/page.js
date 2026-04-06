'use client';

import SocialFeed from '@/components/SocialFeed';
import FriendSearch from '@/components/FriendSearch';
import FriendsList from '@/components/FriendsList';
import FriendComparison from '@/components/FriendComparison';
import NotificationsCenter from '@/components/NotificationsCenter';
import PrivacySettings from '@/components/PrivacySettings';

export default function SocialPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <NotificationsCenter />
      <FriendSearch />
      <FriendsList />
      <FriendComparison />
      <SocialFeed />
      <PrivacySettings />
    </div>
  );
}
