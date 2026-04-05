'use client';
import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import './competitive-notifications.css';

export default function CompetitiveNotifications() {
  const supabase = createClientComponentClient();
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState('all'); // all, challenges, rankings, overtakes

  useEffect(() => {
    loadNotifications();
    subscribeToNotifications();
  }, [filter]);

  const loadNotifications = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      // Filter competitive notifications
      if (filter !== 'all') {
        const types = {
          'challenges': ['challenge_invite', 'challenge_started', 'challenge_ending_soon', 'challenge_completed'],
          'rankings': ['rank_up', 'rank_down', 'leaderboard_top3'],
          'overtakes': ['friend_overtook_you', 'you_overtook_friend', 'close_competition']
        };
        query = query.in('notification_type', types[filter]);
      } else {
        // Only competitive types
        query = query.in('notification_type', [
          'challenge_invite', 'challenge_started', 'challenge_ending_soon', 'challenge_completed',
          'rank_up', 'rank_down', 'leaderboard_top3',
          'friend_overtook_you', 'you_overtook_friend', 'close_competition',
          'challenge_position_change', 'daily_ranking_update'
        ]);
      }

      const { data } = await query;
      setNotifications(data || []);

    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const subscribeToNotifications = () => {
    const channel = supabase
      .channel('competitive_notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications'
        },
        (payload) => {
          const competitiveTypes = [
            'challenge_invite', 'challenge_started', 'challenge_ending_soon', 'challenge_completed',
            'rank_up', 'rank_down', 'leaderboard_top3',
            'friend_overtook_you', 'you_overtook_friend', 'close_competition'
          ];
          
          if (competitiveTypes.includes(payload.new.notification_type)) {
            setNotifications(prev => [payload.new, ...prev]);
            
            // Show browser notification if permission granted
            if (Notification.permission === 'granted') {
              new Notification(payload.new.title, {
                body: payload.new.message,
                icon: '/icon.png'
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const markAsRead = async (notificationId) => {
    try {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);

      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        alert('Notifications enabled! You\'ll now receive competitive updates.');
      }
    }
  };

  return (
    <div className="competitive-notifications">
      <div className="notifications-header">
        <h2>🏆 Competitive Updates</h2>
        {Notification.permission !== 'granted' && (
          <button className="enable-notifications-btn" onClick={requestNotificationPermission}>
            🔔 Enable Push Notifications
          </button>
        )}
      </div>

      <div className="notifications-filters">
        <button 
          className={filter === 'all' ? 'active' : ''}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        <button 
          className={filter === 'challenges' ? 'active' : ''}
          onClick={() => setFilter('challenges')}
        >
          🎯 Challenges
        </button>
        <button 
          className={filter === 'rankings' ? 'active' : ''}
          onClick={() => setFilter('rankings')}
        >
          📊 Rankings
        </button>
        <button 
          className={filter === 'overtakes' ? 'active' : ''}
          onClick={() => setFilter('overtakes')}
        >
          ⚡ Overtakes
        </button>
      </div>

      {notifications.some(n => !n.read) && (
        <div className="mark-all-read">
          <button onClick={markAllAsRead}>Mark all as read</button>
        </div>
      )}

      <div className="notifications-list">
        {notifications.length === 0 ? (
          <div className="notifications-empty">
            <div className="empty-icon">🏆</div>
            <p>No competitive notifications yet</p>
            <p className="empty-hint">Join a challenge or compete with friends to get started!</p>
          </div>
        ) : (
          notifications.map(notification => (
            <CompetitiveNotificationCard
              key={notification.id}
              notification={notification}
              onRead={() => markAsRead(notification.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function CompetitiveNotificationCard({ notification, onRead }) {
  const getNotificationIcon = (type) => {
    const icons = {
      'challenge_invite': '🎯',
      'challenge_started': '🏁',
      'challenge_ending_soon': '⏰',
      'challenge_completed': '🏆',
      'rank_up': '⬆️',
      'rank_down': '⬇️',
      'leaderboard_top3': '🥇',
      'friend_overtook_you': '😱',
      'you_overtook_friend': '💪',
      'close_competition': '🔥',
      'challenge_position_change': '📊',
      'daily_ranking_update': '📈'
    };
    return icons[type] || '🔔';
  };

  const getNotificationColor = (type) => {
    if (['rank_up', 'you_overtook_friend', 'leaderboard_top3', 'challenge_completed'].includes(type)) {
      return 'success';
    }
    if (['rank_down', 'friend_overtook_you'].includes(type)) {
      return 'warning';
    }
    if (['challenge_ending_soon', 'close_competition'].includes(type)) {
      return 'urgent';
    }
    return 'info';
  };

  const formatTimestamp = (timestamp) => {
    const now = new Date();
    const notifTime = new Date(timestamp);
    const diffMs = now - notifTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return notifTime.toLocaleDateString();
  };

  return (
    <div 
      className={`notification-card ${getNotificationColor(notification.notification_type)} ${!notification.read ? 'unread' : ''}`}
      onClick={onRead}
    >
      <div className="notification-icon">
        {getNotificationIcon(notification.notification_type)}
      </div>
      <div className="notification-content">
        <div className="notification-title">{notification.title}</div>
        <div className="notification-message">{notification.message}</div>
        <div className="notification-time">{formatTimestamp(notification.created_at)}</div>
      </div>
      {!notification.read && <div className="unread-indicator"></div>}
    </div>
  );
}
