'use client';
import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import './friends-list.css';

export default function FriendsList() {
  const supabase = createClientComponentClient();
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all'); // all, active, challenges
  const [selectedFriend, setSelectedFriend] = useState(null);

  useEffect(() => {
    loadFriends();
    
    // Real-time subscription for friend updates
    const channel = supabase
      .channel('friends_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'friendships' },
        () => loadFriends()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadFriends = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get friends with their stats
      const { data: friendships, error } = await supabase
        .from('friendships')
        .select(`
          id,
          friend_id,
          responded_at,
          profiles!friendships_friend_id_fkey (
            id,
            full_name,
            avatar_url,
            gamification_mode
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'accepted')
        .order('responded_at', { ascending: false });

      if (error) throw error;

      // Enrich with stats
      const enrichedFriends = await Promise.all(
        friendships.map(async (friendship) => {
          const friendId = friendship.friend_id;

          // Get latest weight
          const { data: latestWeight } = await supabase
            .from('weight_logs')
            .select('weight_kg, logged_at')
            .eq('user_id', friendId)
            .order('logged_at', { ascending: false })
            .limit(1)
            .single();

          // Get weight goal and progress
          const { data: goal } = await supabase
            .from('weight_goals')
            .select('*')
            .eq('user_id', friendId)
            .eq('status', 'active')
            .single();

          // Get user stats (streaks, achievements)
          const { data: stats } = await supabase
            .from('user_stats')
            .select('*')
            .eq('user_id', friendId)
            .single();

          // Get active challenges
          const { data: activeChallenges } = await supabase
            .from('challenge_participants')
            .select('challenge_id, challenges(*)')
            .eq('user_id', friendId)
            .eq('challenges.status', 'active');

          // Calculate if they're active (logged in last 24h)
          const isActive = latestWeight && 
            new Date() - new Date(latestWeight.logged_at) < 24 * 60 * 60 * 1000;

          return {
            ...friendship,
            profile: friendship.profiles,
            latest_weight: latestWeight,
            goal,
            stats,
            active_challenges: activeChallenges || [],
            is_active: isActive,
            weight_lost_kg: goal ? (goal.start_weight_kg - (goal.current_weight_kg || goal.start_weight_kg)) : 0
          };
        })
      );

      setFriends(enrichedFriends);
    } catch (error) {
      console.error('Error loading friends:', error);
    } finally {
      setLoading(false);
    }
  };

  const removeFriend = async (friendshipId, friendName) => {
    if (!confirm(`Remove ${friendName} from your friends?`)) return;

    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId);

      if (error) throw error;

      loadFriends();
      setSelectedFriend(null);
    } catch (error) {
      console.error('Error removing friend:', error);
      alert('Failed to remove friend. Please try again.');
    }
  };

  const getFilteredFriends = () => {
    switch (activeTab) {
      case 'active':
        return friends.filter(f => f.is_active);
      case 'challenges':
        return friends.filter(f => f.active_challenges.length > 0);
      default:
        return friends;
    }
  };

  const filteredFriends = getFilteredFriends();

  if (loading) {
    return (
      <div className="friends-list-container">
        <div className="loading">Loading friends...</div>
      </div>
    );
  }

  return (
    <div className="friends-list-container">
      <div className="friends-header">
        <h2>👥 My Friends</h2>
        <div className="friends-count">{friends.length} friends</div>
      </div>

      {/* Tabs */}
      <div className="friends-tabs">
        <button
          className={`tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All ({friends.length})
        </button>
        <button
          className={`tab ${activeTab === 'active' ? 'active' : ''}`}
          onClick={() => setActiveTab('active')}
        >
          Active ({friends.filter(f => f.is_active).length})
        </button>
        <button
          className={`tab ${activeTab === 'challenges' ? 'active' : ''}`}
          onClick={() => setActiveTab('challenges')}
        >
          In Challenges ({friends.filter(f => f.active_challenges.length > 0).length})
        </button>
      </div>

      {/* Friends Grid */}
      {filteredFriends.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <h3>No friends found</h3>
          <p>
            {activeTab === 'all' 
              ? 'Add some friends to get started!'
              : `No friends in "${activeTab}" category`}
          </p>
        </div>
      ) : (
        <div className="friends-grid">
          {filteredFriends.map(friend => (
            <FriendCard
              key={friend.id}
              friend={friend}
              onSelect={() => setSelectedFriend(friend)}
              onRemove={() => removeFriend(friend.id, friend.profile.full_name)}
            />
          ))}
        </div>
      )}

      {/* Friend Details Modal */}
      {selectedFriend && (
        <FriendDetailModal
          friend={selectedFriend}
          onClose={() => setSelectedFriend(null)}
          onRemove={() => removeFriend(selectedFriend.id, selectedFriend.profile.full_name)}
        />
      )}
    </div>
  );
}

function FriendCard({ friend, onSelect, onRemove }) {
  const { profile, latest_weight, goal, stats, is_active, weight_lost_kg, active_challenges } = friend;

  return (
    <div className="friend-card" onClick={onSelect}>
      <div className="friend-card-header">
        <div className="friend-avatar-wrapper">
          <img 
            src={profile.avatar_url || '/placeholder-avatar.png'} 
            alt={profile.full_name}
            className="friend-avatar"
          />
          {is_active && <div className="online-indicator" title="Active today"></div>}
        </div>
        <div className="friend-info">
          <h3 className="friend-name">{profile.full_name}</h3>
          <div className="friend-mode">
            {profile.gamification_mode === 'competitive' ? '⚔️ Competitive' : '🤝 Supportive'}
          </div>
        </div>
      </div>

      <div className="friend-stats">
        <div className="stat-item">
          <div className="stat-icon">🔥</div>
          <div className="stat-value">{stats?.tracking_streak || 0}</div>
          <div className="stat-label">Day Streak</div>
        </div>
        <div className="stat-item">
          <div className="stat-icon">⚖️</div>
          <div className="stat-value">{weight_lost_kg.toFixed(1)}kg</div>
          <div className="stat-label">Lost</div>
        </div>
        <div className="stat-item">
          <div className="stat-icon">🏆</div>
          <div className="stat-value">{stats?.achievements_count || 0}</div>
          <div className="stat-label">Achievements</div>
        </div>
      </div>

      {goal && (
        <div className="friend-goal">
          <div className="goal-type">
            {goal.goal_type === 'weight_loss' ? '📉 Losing Weight' :
             goal.goal_type === 'weight_gain' ? '📈 Gaining Weight' :
             '⚖️ Maintaining'}
          </div>
          <div className="goal-progress">
            <div className="progress-bar-mini">
              <div 
                className="progress-fill-mini"
                style={{ 
                  width: `${Math.min(100, (weight_lost_kg / Math.abs(goal.target_weight_kg - goal.start_weight_kg)) * 100)}%` 
                }}
              ></div>
            </div>
            <div className="progress-text-mini">
              {weight_lost_kg.toFixed(1)} / {Math.abs(goal.target_weight_kg - goal.start_weight_kg).toFixed(1)}kg
            </div>
          </div>
        </div>
      )}

      {active_challenges.length > 0 && (
        <div className="active-challenges-badge">
          🎯 {active_challenges.length} active challenge{active_challenges.length > 1 ? 's' : ''}
        </div>
      )}

      <div className="friend-actions">
        <button className="action-btn compare" onClick={(e) => { e.stopPropagation(); alert('Compare feature coming soon!'); }}>
          📊 Compare
        </button>
        <button className="action-btn challenge" onClick={(e) => { e.stopPropagation(); alert('Challenge feature coming soon!'); }}>
          ⚔️ Challenge
        </button>
      </div>
    </div>
  );
}

function FriendDetailModal({ friend, onClose, onRemove }) {
  const { profile, stats, goal, weight_lost_kg, latest_weight } = friend;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        
        <div className="modal-header">
          <img 
            src={profile.avatar_url || '/placeholder-avatar.png'} 
            alt={profile.full_name}
            className="modal-avatar"
          />
          <h2>{profile.full_name}</h2>
          <div className="modal-mode">
            {profile.gamification_mode === 'competitive' ? '⚔️ Competitive Mode' : '🤝 Supportive Mode'}
          </div>
        </div>

        <div className="modal-stats">
          <div className="modal-stat">
            <div className="modal-stat-value">{stats?.tracking_streak || 0}</div>
            <div className="modal-stat-label">Day Streak</div>
          </div>
          <div className="modal-stat">
            <div className="modal-stat-value">{weight_lost_kg.toFixed(1)}kg</div>
            <div className="modal-stat-label">Weight Lost</div>
          </div>
          <div className="modal-stat">
            <div className="modal-stat-value">{stats?.total_xp || 0}</div>
            <div className="modal-stat-label">Total XP</div>
          </div>
          <div className="modal-stat">
            <div className="modal-stat-value">{stats?.achievements_count || 0}</div>
            <div className="modal-stat-label">Achievements</div>
          </div>
        </div>

        {goal && (
          <div className="modal-goal-section">
            <h3>Current Goal</h3>
            <div className="modal-goal-details">
              <div className="modal-goal-type">
                {goal.goal_type === 'weight_loss' ? '📉 Weight Loss' :
                 goal.goal_type === 'weight_gain' ? '📈 Weight Gain' :
                 '⚖️ Maintenance'}
              </div>
              <div className="modal-goal-numbers">
                Start: {goal.start_weight_kg.toFixed(1)}kg → Target: {goal.target_weight_kg.toFixed(1)}kg
              </div>
              {latest_weight && (
                <div className="modal-current-weight">
                  Current: {latest_weight.weight_kg.toFixed(1)}kg
                </div>
              )}
            </div>
          </div>
        )}

        <div className="modal-actions">
          <button className="modal-action-btn compare">📊 View Full Comparison</button>
          <button className="modal-action-btn challenge">⚔️ Create Challenge</button>
          <button className="modal-action-btn message">💬 Send Message</button>
          <button className="modal-action-btn remove" onClick={onRemove}>
            🗑️ Remove Friend
          </button>
        </div>
      </div>
    </div>
  );
}
