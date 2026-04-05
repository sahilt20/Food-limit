'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabaseClient';
import './gamification-mode.css';

export default function GamificationModeSelector() {
  const supabase = createClient();
  const [mode, setMode] = useState('supportive'); // supportive or competitive
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadMode();
  }, []);

  const loadMode = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('gamification_mode')
        .eq('id', user.id)
        .single();

      if (profile) {
        setMode(profile.gamification_mode || 'supportive');
      }
    } catch (error) {
      console.error('Error loading mode:', error);
    } finally {
      setLoading(false);
    }
  };

  const changeMode = async (newMode) => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .update({ gamification_mode: newMode })
        .eq('id', user.id);

      if (error) throw error;

      setMode(newMode);
      
      // Show success message
      const successMsg = document.createElement('div');
      successMsg.className = 'mode-success';
      successMsg.textContent = `✓ Switched to ${newMode === 'supportive' ? 'Supportive' : 'Competitive'} Mode!`;
      document.querySelector('.mode-selector-container').appendChild(successMsg);
      setTimeout(() => successMsg.remove(), 3000);

    } catch (error) {
      console.error('Error changing mode:', error);
      alert('Failed to change mode');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mode-selector-container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="mode-selector-container">
      <div className="mode-header">
        <h2>🎮 Choose Your Experience</h2>
        <p className="mode-subtitle">Select how you want to experience your journey</p>
      </div>

      <div className="mode-cards">
        {/* Supportive Mode */}
        <div
          className={`mode-card ${mode === 'supportive' ? 'active' : ''}`}
          onClick={() => changeMode('supportive')}
        >
          <div className="mode-icon supportive">🤝</div>
          <h3 className="mode-title">Supportive Mode</h3>
          <p className="mode-description">
            Focus on personal growth and self-improvement
          </p>

          <div className="mode-features">
            <div className="feature">✅ Personal achievements</div>
            <div className="feature">✅ Friend encouragement</div>
            <div className="feature">✅ Progress tracking</div>
            <div className="feature">✅ Milestone celebrations</div>
            <div className="feature">✅ Positive reinforcement</div>
            <div className="feature">❌ No rankings</div>
            <div className="feature">❌ No comparisons</div>
            <div className="feature">❌ No leaderboards</div>
          </div>

          {mode === 'supportive' && (
            <div className="active-badge">
              ✓ Currently Active
            </div>
          )}
        </div>

        {/* Competitive Mode */}
        <div
          className={`mode-card ${mode === 'competitive' ? 'active' : ''}`}
          onClick={() => changeMode('competitive')}
        >
          <div className="mode-icon competitive">⚔️</div>
          <h3 className="mode-title">Competitive Mode</h3>
          <p className="mode-description">
            Compete with friends and climb the leaderboards
          </p>

          <div className="mode-features">
            <div className="feature">✅ All Supportive features</div>
            <div className="feature">✅ Leaderboards</div>
            <div className="feature">✅ Rankings & positions</div>
            <div className="feature">✅ Head-to-head battles</div>
            <div className="feature">✅ Challenge invites</div>
            <div className="feature">✅ Performance comparisons</div>
            <div className="feature">✅ Competitive achievements</div>
            <div className="feature">✅ Win streaks</div>
          </div>

          {mode === 'competitive' && (
            <div className="active-badge">
              ✓ Currently Active
            </div>
          )}
        </div>
      </div>

      <div className="mode-info">
        <p>
          <strong>Note:</strong> You can switch between modes anytime. 
          Your progress and achievements are always saved.
        </p>
      </div>

      {saving && (
        <div className="mode-saving">
          Updating your experience...
        </div>
      )}
    </div>
  );
}

// Hook to check current mode
export function useGamificationMode() {
  const supabase = createClient();
  const [mode, setMode] = useState('supportive');

  useEffect(() => {
    loadMode();
  }, []);

  const loadMode = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('gamification_mode')
      .eq('id', user.id)
      .single();

    if (profile) {
      setMode(profile.gamification_mode || 'supportive');
    }
  };

  return {
    mode,
    isSupportive: mode === 'supportive',
    isCompetitive: mode === 'competitive'
  };
}
