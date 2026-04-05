'use client';
import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import './privacy-settings.css';

export default function PrivacySettings() {
  const supabase = createClientComponentClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    // What to share
    share_weight: true,
    share_weight_goal: true,
    share_weight_progress: true,
    share_current_weight_value: false,
    share_calories: true,
    share_calorie_details: false,
    share_macros: true,
    share_achievements: true,
    share_body_photos: false,
    share_meal_photos: false,
    
    // Social features
    show_in_leaderboards: true,
    allow_challenge_invites: true,
    allow_friend_requests: true,
    show_online_status: true,
    
    // Visibility
    profile_visibility: 'friends',
    
    // Notifications
    notify_friend_requests: true,
    notify_friend_achievements: true,
    notify_challenge_invites: true,
    notify_challenge_updates: true,
    notify_being_overtaken: false,
    notify_encouragement: true,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('privacy_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading privacy settings:', error);
        return;
      }

      if (data) {
        setSettings(data);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (field) => {
    setSettings(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleVisibilityChange = (value) => {
    setSettings(prev => ({ ...prev, profile_visibility: value }));
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('privacy_settings')
        .upsert({
          user_id: user.id,
          ...settings,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      // Show success message
      const successMsg = document.createElement('div');
      successMsg.className = 'save-success';
      successMsg.textContent = '✓ Settings saved successfully!';
      document.querySelector('.privacy-container').appendChild(successMsg);
      setTimeout(() => successMsg.remove(), 3000);

    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="privacy-container">
        <div className="loading">Loading privacy settings...</div>
      </div>
    );
  }

  return (
    <div className="privacy-container">
      <div className="privacy-header">
        <h2>🔒 Privacy & Sharing Settings</h2>
        <p className="privacy-subtitle">
          Control what you share with friends and the community
        </p>
      </div>

      {/* Profile Visibility */}
      <div className="settings-section">
        <h3>👁️ Profile Visibility</h3>
        <p className="section-description">
          Who can see your profile and activity
        </p>
        <div className="visibility-options">
          {[
            { value: 'public', icon: '🌍', label: 'Public', desc: 'Everyone can see your profile' },
            { value: 'friends', icon: '👥', label: 'Friends Only', desc: 'Only friends can see your activity' },
            { value: 'private', icon: '🔒', label: 'Private', desc: 'Only you can see your data' }
          ].map(option => (
            <div
              key={option.value}
              className={`visibility-card ${settings.profile_visibility === option.value ? 'active' : ''}`}
              onClick={() => handleVisibilityChange(option.value)}
            >
              <div className="visibility-icon">{option.icon}</div>
              <div className="visibility-label">{option.label}</div>
              <div className="visibility-desc">{option.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* What to Share */}
      <div className="settings-section">
        <h3>📊 What to Share with Friends</h3>
        <div className="toggle-group">
          <ToggleItem
            label="Weight Progress"
            description="Share your weight loss journey and trends"
            checked={settings.share_weight}
            onChange={() => handleToggle('share_weight')}
          />
          <ToggleItem
            label="Current Weight Number"
            description="Show exact weight values (vs. just progress)"
            checked={settings.share_current_weight_value}
            onChange={() => handleToggle('share_current_weight_value')}
            disabled={!settings.share_weight}
          />
          <ToggleItem
            label="Weight Goal"
            description="Share your target weight and goal type"
            checked={settings.share_weight_goal}
            onChange={() => handleToggle('share_weight_goal')}
          />
          <ToggleItem
            label="Calorie Tracking"
            description="Share daily calorie totals"
            checked={settings.share_calories}
            onChange={() => handleToggle('share_calories')}
          />
          <ToggleItem
            label="Calorie Details"
            description="Show individual meals and food items"
            checked={settings.share_calorie_details}
            onChange={() => handleToggle('share_calorie_details')}
            disabled={!settings.share_calories}
          />
          <ToggleItem
            label="Macro Breakdown"
            description="Share protein/carbs/fat distribution"
            checked={settings.share_macros}
            onChange={() => handleToggle('share_macros')}
          />
          <ToggleItem
            label="Achievements"
            description="Share when you unlock achievements"
            checked={settings.share_achievements}
            onChange={() => handleToggle('share_achievements')}
          />
          <ToggleItem
            label="Body Progress Photos"
            description="Share transformation photos"
            checked={settings.share_body_photos}
            onChange={() => handleToggle('share_body_photos')}
          />
          <ToggleItem
            label="Meal Photos"
            description="Share photos of what you're eating"
            checked={settings.share_meal_photos}
            onChange={() => handleToggle('share_meal_photos')}
          />
        </div>
      </div>

      {/* Social Features */}
      <div className="settings-section">
        <h3>🎮 Social & Competition</h3>
        <div className="toggle-group">
          <ToggleItem
            label="Show in Leaderboards"
            description="Appear in friend rankings and competitions"
            checked={settings.show_in_leaderboards}
            onChange={() => handleToggle('show_in_leaderboards')}
          />
          <ToggleItem
            label="Allow Challenge Invites"
            description="Let friends challenge you to competitions"
            checked={settings.allow_challenge_invites}
            onChange={() => handleToggle('allow_challenge_invites')}
          />
          <ToggleItem
            label="Allow Friend Requests"
            description="Let others send you friend requests"
            checked={settings.allow_friend_requests}
            onChange={() => handleToggle('allow_friend_requests')}
          />
          <ToggleItem
            label="Show Online Status"
            description="Display when you're active"
            checked={settings.show_online_status}
            onChange={() => handleToggle('show_online_status')}
          />
        </div>
      </div>

      {/* Notifications */}
      <div className="settings-section">
        <h3>🔔 Notification Preferences</h3>
        <div className="toggle-group">
          <ToggleItem
            label="Friend Requests"
            description="Notify when someone wants to connect"
            checked={settings.notify_friend_requests}
            onChange={() => handleToggle('notify_friend_requests')}
          />
          <ToggleItem
            label="Friend Achievements"
            description="See when friends unlock achievements"
            checked={settings.notify_friend_achievements}
            onChange={() => handleToggle('notify_friend_achievements')}
          />
          <ToggleItem
            label="Challenge Invites"
            description="Get notified about new challenges"
            checked={settings.notify_challenge_invites}
            onChange={() => handleToggle('notify_challenge_invites')}
          />
          <ToggleItem
            label="Challenge Updates"
            description="See progress in active challenges"
            checked={settings.notify_challenge_updates}
            onChange={() => handleToggle('notify_challenge_updates')}
          />
          <ToggleItem
            label="When Overtaken"
            description="Alert when a friend passes you in rankings"
            checked={settings.notify_being_overtaken}
            onChange={() => handleToggle('notify_being_overtaken')}
          />
          <ToggleItem
            label="Encouragement Messages"
            description="Receive motivational notifications"
            checked={settings.notify_encouragement}
            onChange={() => handleToggle('notify_encouragement')}
          />
        </div>
      </div>

      {/* Save Button */}
      <div className="save-section">
        <button 
          className="save-btn"
          onClick={saveSettings}
          disabled={saving}
        >
          {saving ? 'Saving...' : '💾 Save All Settings'}
        </button>
      </div>
    </div>
  );
}

function ToggleItem({ label, description, checked, onChange, disabled = false }) {
  return (
    <div className={`toggle-item ${disabled ? 'disabled' : ''}`}>
      <div className="toggle-info">
        <div className="toggle-label">{label}</div>
        <div className="toggle-description">{description}</div>
      </div>
      <label className="toggle-switch">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
        />
        <span className="toggle-slider"></span>
      </label>
    </div>
  );
}
