'use client';

import SocialFeed from '@/components/SocialFeed';
import FriendSearch from '@/components/FriendSearch';
import FriendsList from '@/components/FriendsList';
import NotificationsCenter from '@/components/NotificationsCenter';
import PrivacySettings from '@/components/PrivacySettings';

export default function SocialPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <NotificationsCenter />
      <FriendSearch />
      <FriendsList />
      <SocialFeed />
      <PrivacySettings />
    </div>
  );
}
