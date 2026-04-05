'use client';
import { useEffect } from 'react';
import './celebration-animation.css';

export default function CelebrationAnimation({ type = 'achievement', data, onClose }) {
  useEffect(() => {
    // Auto-close after 4 seconds
    const timer = setTimeout(() => {
      onClose?.();
    }, 4000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const getCelebrationContent = () => {
    switch (type) {
      case 'achievement':
        return {
          icon: '🏆',
          title: 'Achievement Unlocked!',
          subtitle: data?.name || 'New Achievement',
          description: data?.description,
          reward: `+${data?.xp || 0} XP • +${data?.points || 0} Points`,
          color: getTierColor(data?.tier)
        };
      case 'level_up':
        return {
          icon: '⭐',
          title: 'Level Up!',
          subtitle: `Level ${data?.level}`,
          description: data?.title,
          reward: `You're getting stronger!`,
          color: '#f59e0b'
        };
      case 'milestone':
        return {
          icon: '🎯',
          title: 'Milestone Reached!',
          subtitle: data?.milestone,
          description: data?.message,
          reward: `Keep up the great work!`,
          color: '#10b981'
        };
      case 'challenge_complete':
        return {
          icon: '🎉',
          title: 'Challenge Complete!',
          subtitle: data?.challengeName,
          description: data?.result,
          reward: `+${data?.xp || 0} XP • +${data?.points || 0} Points`,
          color: '#3b82f6'
        };
      case 'streak':
        return {
          icon: '🔥',
          title: 'Streak Milestone!',
          subtitle: `${data?.days} Day Streak`,
          description: `You've been consistent for ${data?.days} days!`,
          reward: `+${data?.xp || 0} XP`,
          color: '#ef4444'
        };
      default:
        return {
          icon: '✨',
          title: 'Congratulations!',
          subtitle: data?.title,
          description: data?.message,
          reward: '',
          color: '#10b981'
        };
    }
  };

  const content = getCelebrationContent();

  return (
    <div className="celebration-overlay" onClick={onClose}>
      <div className="celebration-content" onClick={(e) => e.stopPropagation()}>
        {/* Confetti */}
        <div className="confetti-container">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="confetti"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                backgroundColor: ['#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6'][Math.floor(Math.random() * 5)]
              }}
            />
          ))}
        </div>

        {/* Main Content */}
        <div className="celebration-card" style={{ borderColor: content.color }}>
          <div className="celebration-icon-wrapper">
            <div className="celebration-icon" style={{ color: content.color }}>
              {content.icon}
            </div>
            <div className="celebration-glow" style={{ backgroundColor: content.color }}></div>
          </div>

          <h2 className="celebration-title">{content.title}</h2>
          <h3 className="celebration-subtitle" style={{ color: content.color }}>
            {content.subtitle}
          </h3>
          
          {content.description && (
            <p className="celebration-description">{content.description}</p>
          )}

          {content.reward && (
            <div className="celebration-reward">
              {content.reward}
            </div>
          )}

          {/* Action Buttons */}
          <div className="celebration-actions">
            {type === 'achievement' && (
              <button className="celebration-btn share" style={{ background: content.color }}>
                📤 Share
              </button>
            )}
            <button className="celebration-btn close" onClick={onClose}>
              Continue
            </button>
          </div>
        </div>

        {/* Sparkles */}
        <div className="sparkles-container">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="sparkle"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`
              }}
            >
              ✨
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function getTierColor(tier) {
  switch (tier) {
    case 'bronze': return '#cd7f32';
    case 'silver': return '#c0c0c0';
    case 'gold': return '#ffd700';
    case 'platinum': return '#e5e4e2';
    case 'diamond': return '#b9f2ff';
    default: return '#10b981';
  }
}

// Hook to trigger celebrations
export function useCelebration() {
  const celebrate = (type, data) => {
    // Create and mount celebration component
    const container = document.createElement('div');
    container.id = 'celebration-root';
    document.body.appendChild(container);

    const root = require('react-dom/client').createRoot(container);
    root.render(
      <CelebrationAnimation
        type={type}
        data={data}
        onClose={() => {
          root.unmount();
          container.remove();
        }}
      />
    );
  };

  return { celebrate };
}
