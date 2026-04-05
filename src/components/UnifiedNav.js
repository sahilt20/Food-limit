'use client';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import './unified-nav.css';

export default function UnifiedNav() {
  const pathname = usePathname();
  const supabase = createClientComponentClient();
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [user, setUser] = useState(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  useEffect(() => {
    loadUser();
    loadNotifications();

    // Subscribe to notifications
    const channel = supabase
      .channel('notifications_count')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        () => loadNotifications()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      setUser(profile);
    }
  };

  const loadNotifications = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false);

    setUnreadNotifications(count || 0);
  };

  const navItems = [
    { href: '/dashboard', icon: '🏠', label: 'Dashboard', exact: true },
    { href: '/dashboard/add', icon: '➕', label: 'Log Meal' },
    { href: '/dashboard/challenges', icon: '🎯', label: 'Challenges', badge: 3 },
    { href: '/dashboard/achievements', icon: '🏆', label: 'Achievements' },
    { href: '/dashboard/friends', icon: '👥', label: 'Friends' },
    { href: '/dashboard/leaderboards', icon: '📊', label: 'Leaderboards' },
    { href: '/dashboard/feed', icon: '🌟', label: 'Activity Feed' },
    { href: '/dashboard/charts', icon: '📈', label: 'Progress' },
  ];

  const isActive = (href, exact = false) => {
    if (exact) {
      return pathname === href;
    }
    return pathname?.startsWith(href);
  };

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="unified-nav desktop-nav">
        <div className="nav-container">
          {/* Logo */}
          <div className="nav-brand">
            <a href="/dashboard">
              <span className="brand-icon">🍎</span>
              <span className="brand-name">Food Limit</span>
            </a>
          </div>

          {/* Main Navigation */}
          <div className="nav-links">
            {navItems.map(item => (
              <a
                key={item.href}
                href={item.href}
                className={`nav-link ${isActive(item.href, item.exact) ? 'active' : ''}`}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
                {item.badge && <span className="nav-badge">{item.badge}</span>}
              </a>
            ))}
          </div>

          {/* User Menu */}
          <div className="nav-user">
            <a href="/dashboard/notifications" className="notification-btn">
              <span className="notification-icon">🔔</span>
              {unreadNotifications > 0 && (
                <span className="notification-count">{unreadNotifications}</span>
              )}
            </a>

            <div className="user-menu">
              <img
                src={user?.avatar_url || '/placeholder-avatar.png'}
                alt={user?.full_name || 'User'}
                className="user-avatar-nav"
              />
              <div className="user-info">
                <div className="user-name">{user?.full_name || 'User'}</div>
                <div className="user-level">Level {user?.current_level || 1}</div>
              </div>
            </div>

            <a href="/dashboard/settings/privacy" className="settings-btn">
              ⚙️
            </a>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation */}
      <nav className="unified-nav mobile-nav">
        <div className="mobile-nav-header">
          <div className="nav-brand">
            <span className="brand-icon">🍎</span>
            <span className="brand-name">Food Limit</span>
          </div>

          <button 
            className="mobile-menu-toggle"
            onClick={() => setShowMobileMenu(!showMobileMenu)}
          >
            {showMobileMenu ? '✕' : '☰'}
          </button>
        </div>

        {/* Mobile Menu */}
        {showMobileMenu && (
          <div className="mobile-menu">
            {navItems.map(item => (
              <a
                key={item.href}
                href={item.href}
                className={`mobile-nav-link ${isActive(item.href, item.exact) ? 'active' : ''}`}
                onClick={() => setShowMobileMenu(false)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
                {item.badge && <span className="nav-badge">{item.badge}</span>}
              </a>
            ))}

            <div className="mobile-menu-footer">
              <a href="/dashboard/notifications" className="mobile-nav-link">
                <span className="nav-icon">🔔</span>
                <span className="nav-label">Notifications</span>
                {unreadNotifications > 0 && (
                  <span className="nav-badge">{unreadNotifications}</span>
                )}
              </a>
              <a href="/dashboard/settings/privacy" className="mobile-nav-link">
                <span className="nav-icon">⚙️</span>
                <span className="nav-label">Settings</span>
              </a>
            </div>
          </div>
        )}
      </nav>

      {/* Bottom Tab Bar (Mobile) */}
      <div className="mobile-tab-bar">
        {[
          { href: '/dashboard', icon: '🏠', label: 'Home' },
          { href: '/dashboard/add', icon: '➕', label: 'Log' },
          { href: '/dashboard/challenges', icon: '🎯', label: 'Challenges' },
          { href: '/dashboard/friends', icon: '👥', label: 'Friends' },
          { href: '/dashboard/feed', icon: '🌟', label: 'Feed' },
        ].map(item => (
          <a
            key={item.href}
            href={item.href}
            className={`tab-item ${isActive(item.href, item.href === '/dashboard') ? 'active' : ''}`}
          >
            <span className="tab-icon">{item.icon}</span>
            <span className="tab-label">{item.label}</span>
          </a>
        ))}
      </div>
    </>
  );
}
