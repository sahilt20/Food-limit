'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabaseClient';
import './notifications-center.css';

export default function NotificationsCenter() {
  const supabase = createClient();
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState('all'); // all, unread, friends, achievements
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();

    // Real-time subscription
    const channel = supabase
      .channel('notifications_updates')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        () => loadNotifications()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

      // Apply filters
      if (filter === 'unread') {
        query = query.eq('read', false);
      } else if (filter === 'friends') {
        query = query.in('notification_type', ['friend_request', 'friend_accepted']);
      } else if (filter === 'achievements') {
        query = query.in('notification_type', ['achievement_unlocked', 'milestone']);
      }

      const { data, error } = await query;

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await supabase
        .from('notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId);

      loadNotifications();
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('read', false);

      loadNotifications();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      loadNotifications();
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <div className="notifications-container">
        <div className="loading">Loading notifications...</div>
      </div>
    );
  }

  return (
    <div className="notifications-container">
      <div className="notifications-header">
        <h2>🔔 Notifications</h2>
        <div className="notifications-count">
          {unreadCount > 0 && `${unreadCount} unread`}
        </div>
      </div>

      {/* Filters */}
      <div className="notifications-filters">
        {['all', 'unread', 'friends', 'achievements'].map(f => (
          <button
            key={f}
            className={`filter-btn ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}

        {unreadCount > 0 && (
          <button className="mark-all-btn" onClick={markAllAsRead}>
            ✓ Mark all read
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="notifications-list">
        {notifications.length === 0 ? (
          <div className="empty-notifications">
            <div className="empty-icon">🔕</div>
            <h3>No notifications</h3>
            <p>You're all caught up!</p>
          </div>
        ) : (
          notifications.map(notification => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              onMarkRead={() => markAsRead(notification.id)}
              onDelete={() => deleteNotification(notification.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function NotificationCard({ notification, onMarkRead, onDelete }) {
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'friend_request': return '👋';
      case 'friend_accepted': return '🤝';
      case 'achievement_unlocked': return '🏆';
      case 'challenge_invite': return '⚔️';
      case 'challenge_started': return '🎯';
      case 'challenge_completed': return '🎉';
      case 'position_changed': return '📊';
      case 'encouragement': return '💪';
      case 'milestone': return '🎯';
      case 'goal_reached': return '✨';
      case 'streak_reminder': return '🔥';
      case 'weigh_in_reminder': return '⚖️';
      case 'meal_log_reminder': return '🍽️';
      default: return '📬';
    }
  };

  const formatTime = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diff = now - time;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return time.toLocaleDateString();
  };

  return (
    <div className={`notification-card ${notification.read ? 'read' : 'unread'}`}>
      <div className="notification-icon">
        {getNotificationIcon(notification.notification_type)}
      </div>

      <div className="notification-content">
        <div className="notification-title">{notification.title}</div>
        <div className="notification-message">{notification.message}</div>
        <div className="notification-time">{formatTime(notification.created_at)}</div>
      </div>

      <div className="notification-actions">
        {!notification.read && (
          <button className="action-btn mark-read" onClick={onMarkRead} title="Mark as read">
            ✓
          </button>
        )}
        <button className="action-btn delete" onClick={onDelete} title="Delete">
          🗑️
        </button>
      </div>

      {notification.action_url && (
        <a href={notification.action_url} className="notification-cta">
          View →
        </a>
      )}
    </div>
  );
}
