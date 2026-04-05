'use client';
import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import './challenge-results.css';

export default function ChallengeResults({ challengeId }) {
  const supabase = createClientComponentClient();
  const [challenge, setChallenge] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [winner, setWinner] = useState(null);
  const [rewards, setRewards] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (challengeId) {
      loadChallengeResults();
    }
  }, [challengeId]);

  const loadChallengeResults = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load challenge details
      const { data: challengeData } = await supabase
        .from('challenges')
        .select('*')
        .eq('id', challengeId)
        .single();

      setChallenge(challengeData);

      // Load all participants with their profiles
      const { data: participantsData } = await supabase
        .from('challenge_participants')
        .select(`
          *,
          profiles:user_id (
            username,
            avatar_url
          )
        `)
        .eq('challenge_id', challengeId)
        .order('current_progress', { ascending: false });

      setParticipants(participantsData || []);

      // Determine winner
      if (challengeData?.status === 'completed' && participantsData?.length > 0) {
        const winnerParticipant = participantsData[0];
        setWinner(winnerParticipant);

        // Calculate rewards for current user
        if (winnerParticipant.user_id === user.id) {
          const rewardData = {
            xp: calculateXPReward(challengeData.challenge_type, participantsData.length),
            points: calculatePointsReward(challengeData.challenge_type, participantsData.length),
            badge: determineBadge(challengeData.challenge_type, participantsData.length),
            title: 'Challenge Champion'
          };
          setRewards(rewardData);
          
          // Award achievement if not already awarded
          awardChallengeAchievement(user.id, challengeData.challenge_type);
        }
      }

    } catch (error) {
      console.error('Error loading challenge results:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateXPReward = (type, participantCount) => {
    const baseXP = {
      'solo': 100,
      'head_to_head': 300,
      'group': 500
    };
    return (baseXP[type] || 100) + (participantCount * 50);
  };

  const calculatePointsReward = (type, participantCount) => {
    const basePoints = {
      'solo': 50,
      'head_to_head': 150,
      'group': 250
    };
    return (basePoints[type] || 50) + (participantCount * 25);
  };

  const determineBadge = (type, participantCount) => {
    if (type === 'group' && participantCount >= 5) {
      return { name: 'Group Leader', icon: '👑', tier: 'gold' };
    }
    if (type === 'head_to_head') {
      return { name: 'Duel Master', icon: '⚔️', tier: 'silver' };
    }
    return { name: 'Challenge Complete', icon: '🏅', tier: 'bronze' };
  };

  const awardChallengeAchievement = async (userId, challengeType) => {
    try {
      await fetch('/api/achievements/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          event: 'challenge_won',
          metadata: { challengeType }
        })
      });
    } catch (error) {
      console.error('Error awarding achievement:', error);
    }
  };

  const sendRematchRequest = async () => {
    if (!challenge || !participants) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Create new challenge with same settings
      const { data: newChallenge, error } = await supabase
        .from('challenges')
        .insert({
          creator_user_id: user.id,
          challenge_type: challenge.challenge_type,
          name: `${challenge.name} - Rematch`,
          description: 'Rematch challenge',
          goal_metric: challenge.goal_metric,
          target_value: challenge.target_value,
          start_date: new Date().toISOString(),
          end_date: new Date(new Date().setDate(new Date().getDate() + 14)).toISOString(),
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      // Invite all previous participants
      const invites = participants
        .filter(p => p.user_id !== user.id)
        .map(p => ({
          challenge_id: newChallenge.id,
          user_id: p.user_id,
          invitation_status: 'pending'
        }));

      await supabase.from('challenge_participants').insert(invites);

      alert('Rematch challenge sent! 🔥');
    } catch (error) {
      console.error('Error sending rematch:', error);
      alert('Failed to send rematch');
    }
  };

  const shareResults = () => {
    if (!challenge || !winner) return;

    const shareText = `I just ${winner.user_id === supabase.auth.getUser().id ? 'won' : 'completed'} the "${challenge.name}" challenge! 🏆`;
    
    if (navigator.share) {
      navigator.share({
        title: 'Challenge Results',
        text: shareText,
        url: window.location.href
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(shareText);
      alert('Results copied to clipboard!');
    }
  };

  if (loading) {
    return <div className="challenge-results-loading"><div className="loader"></div></div>;
  }

  if (!challenge) {
    return <div className="challenge-results-empty">Challenge not found</div>;
  }

  const isUserWinner = winner && winner.user_id === supabase.auth.getUser()?.id;

  return (
    <div className="challenge-results">
      {/* Winner Announcement */}
      <div className={`winner-announcement ${isUserWinner ? 'user-won' : ''}`}>
        {isUserWinner ? (
          <>
            <div className="trophy-animation">🏆</div>
            <h1 className="winner-title">YOU WON!</h1>
            <p className="winner-subtitle">Congratulations, Champion!</p>
          </>
        ) : (
          <>
            <div className="trophy-animation">🥈</div>
            <h1 className="winner-title">Challenge Complete</h1>
            <p className="winner-subtitle">
              Winner: {winner?.profiles?.username || 'Unknown'}
            </p>
          </>
        )}
      </div>

      {/* Challenge Info */}
      <div className="challenge-info-card">
        <h2>{challenge.name}</h2>
        <div className="challenge-meta">
          <span className="challenge-type">{challenge.challenge_type.replace('_', ' ')}</span>
          <span className="challenge-metric">{challenge.goal_metric.replace('_', ' ')}</span>
          <span className="challenge-duration">
            {Math.ceil((new Date(challenge.end_date) - new Date(challenge.start_date)) / (1000 * 60 * 60 * 24))} days
          </span>
        </div>
      </div>

      {/* Final Standings */}
      <div className="final-standings">
        <h3>🏁 Final Standings</h3>
        <div className="standings-list">
          {participants.map((participant, index) => (
            <div key={participant.id} className={`standing-item ${index === 0 ? 'winner' : ''}`}>
              <div className="standing-rank">
                {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}️⃣`}
              </div>
              <div className="standing-user">
                <div className="standing-username">
                  {participant.profiles?.username || 'User'}
                </div>
                <div className="standing-progress">
                  {participant.current_progress.toFixed(1)} {getMetricUnit(challenge.goal_metric)}
                </div>
              </div>
              {index === 0 && (
                <div className="standing-badge">Winner</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Rewards (if user won) */}
      {isUserWinner && rewards && (
        <div className="rewards-section">
          <h3>🎉 Rewards Earned</h3>
          <div className="rewards-grid">
            <div className="reward-card">
              <div className="reward-icon">✨</div>
              <div className="reward-value">+{rewards.xp} XP</div>
              <div className="reward-label">Experience</div>
            </div>
            <div className="reward-card">
              <div className="reward-icon">💎</div>
              <div className="reward-value">+{rewards.points}</div>
              <div className="reward-label">Points</div>
            </div>
            <div className="reward-card">
              <div className="reward-icon">{rewards.badge.icon}</div>
              <div className="reward-value">{rewards.badge.name}</div>
              <div className="reward-label">{rewards.badge.tier} Badge</div>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="results-actions">
        <button className="action-btn primary" onClick={sendRematchRequest}>
          🔥 Request Rematch
        </button>
        <button className="action-btn secondary" onClick={shareResults}>
          📤 Share Results
        </button>
        <button className="action-btn tertiary" onClick={() => window.location.href = '/dashboard/challenges'}>
          🏆 View All Challenges
        </button>
      </div>

      {/* Stats Comparison (for head-to-head) */}
      {challenge.challenge_type === 'head_to_head' && participants.length === 2 && (
        <div className="stats-comparison">
          <h3>📊 Head-to-Head Comparison</h3>
          <div className="comparison-grid">
            <div className="comparison-user">
              <div className="comparison-avatar">👤</div>
              <div className="comparison-name">{participants[0].profiles?.username}</div>
              <div className="comparison-score">{participants[0].current_progress.toFixed(1)}</div>
            </div>
            <div className="comparison-vs">VS</div>
            <div className="comparison-user">
              <div className="comparison-avatar">👤</div>
              <div className="comparison-name">{participants[1].profiles?.username}</div>
              <div className="comparison-score">{participants[1].current_progress.toFixed(1)}</div>
            </div>
          </div>
          <div className="comparison-diff">
            Difference: {Math.abs(participants[0].current_progress - participants[1].current_progress).toFixed(1)} {getMetricUnit(challenge.goal_metric)}
          </div>
        </div>
      )}
    </div>
  );
}

function getMetricUnit(metric) {
  const units = {
    'weight_loss': 'lbs',
    'calorie_streak': 'days',
    'meals_logged': 'meals',
    'step_count': 'steps',
    'workout_days': 'days',
    'protein_goal': 'g'
  };
  return units[metric] || 'points';
}
