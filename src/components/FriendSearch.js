'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import './friend-search.css';

export default function FriendSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const supabase = createClient();

  useEffect(() => {
    loadCurrentUser();
    loadFriendRequests();
    loadFriends();
  }, []);

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);
  };

  const loadFriendRequests = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Pending requests (received) — other user is in user_id column
      const { data: pending } = await supabase
        .from('friendships')
        .select('id, user_id, requested_at')
        .eq('friend_id', user.id)
        .eq('status', 'pending');

      if (pending?.length) {
        const ids = pending.map(r => r.user_id);
        const { data: profiles } = await supabase
          .from('profiles').select('id, full_name, avatar_url').in('id', ids);
        const map = Object.fromEntries((profiles || []).map(p => [p.id, p]));
        setPendingRequests(pending.map(r => ({ ...r, profiles: map[r.user_id] || null })));
      } else {
        setPendingRequests([]);
      }

      // Sent requests — other user is in friend_id column
      const { data: sent } = await supabase
        .from('friendships')
        .select('id, friend_id, requested_at')
        .eq('user_id', user.id)
        .eq('status', 'pending');

      if (sent?.length) {
        const ids = sent.map(r => r.friend_id);
        const { data: profiles } = await supabase
          .from('profiles').select('id, full_name, avatar_url').in('id', ids);
        const map = Object.fromEntries((profiles || []).map(p => [p.id, p]));
        setSentRequests(sent.map(r => ({ ...r, profiles: map[r.friend_id] || null })));
      } else {
        setSentRequests([]);
      }
    } catch (error) {
      console.error('Error loading requests:', error);
    }
  };

  const loadFriends = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: friendships } = await supabase
        .from('friendships')
        .select('id, friend_id, responded_at')
        .eq('user_id', user.id)
        .eq('status', 'accepted');

      if (friendships?.length) {
        const ids = friendships.map(f => f.friend_id);
        const { data: profiles } = await supabase
          .from('profiles').select('id, full_name, avatar_url').in('id', ids);
        const map = Object.fromEntries((profiles || []).map(p => [p.id, p]));
        setFriends(friendships.map(f => ({ ...f, profiles: map[f.friend_id] || null })));
      } else {
        setFriends([]);
      }
    } catch (error) {
      console.error('Error loading friends:', error);
    }
  };

  const searchUsers = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Search profiles by name
      const { data: profiles, error: searchError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .ilike('full_name', `%${searchQuery}%`)
        .neq('id', user.id)
        .limit(10);

      if (searchError) {
        console.error('Search error:', searchError);
        setSearchResults([]);
        setLoading(false);
        return;
      }

      // Filter out existing friends and pending requests
      const friendIds = friends.map(f => f.friend_id);
      const pendingIds = [
        ...pendingRequests.map(r => r.user_id),
        ...sentRequests.map(r => r.friend_id)
      ];
      const excludeIds = [...friendIds, ...pendingIds];

      const filtered = profiles?.filter(p => !excludeIds.includes(p.id)) || [];
      setSearchResults(filtered);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendFriendRequest = async (friendId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Use the database function
      const { error } = await supabase.rpc('create_friendship', {
        p_user_id: user.id,
        p_friend_id: friendId
      });

      if (error) throw error;

      alert('✅ Friend request sent!');
      setSearchResults(searchResults.filter(r => r.id !== friendId));
      loadFriendRequests();
    } catch (error) {
      console.error('Error sending request:', error);
      alert(error.message || 'Failed to send friend request');
    }
  };

  const acceptFriendRequest = async (friendshipId) => {
    try {
      // Use the database function
      const { error } = await supabase.rpc('accept_friendship', {
        p_friendship_id: friendshipId
      });

      if (error) throw error;

      // Check for achievement
      await fetch('/api/achievements/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          event: 'friend_added'
        })
      });

      alert('✅ Friend request accepted!');
      loadFriendRequests();
      loadFriends();
    } catch (error) {
      console.error('Error accepting request:', error);
      alert('Failed to accept friend request');
    }
  };

  const declineFriendRequest = async (friendshipId) => {
    try {
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'declined', responded_at: new Date().toISOString() })
        .eq('id', friendshipId);

      if (error) throw error;

      loadFriendRequests();
    } catch (error) {
      console.error('Error declining request:', error);
    }
  };

  const removeFriend = async (friendshipId) => {
    if (!confirm('Remove this friend?')) return;

    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId);

      if (error) throw error;

      loadFriends();
      alert('Friend removed');
    } catch (error) {
      console.error('Error removing friend:', error);
    }
  };

  return (
    <div className="friend-search-container">
      <h2>👥 Connect with Friends</h2>

      {/* Search Section */}
      <div className="search-section">
        <div className="search-box">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchUsers()}
            placeholder="🔍 Search by name..."
          />
          <button onClick={searchUsers} disabled={loading}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>

        {searchResults.length > 0 && (
          <div className="search-results">
            <h3>Search Results</h3>
            {searchResults.map(profile => (
              <div key={profile.id} className="user-card">
                <div className="user-info">
                  {profile.avatar_url && (
                    <img src={profile.avatar_url} alt={profile.full_name} className="avatar" />
                  )}
                  <div>
                    <div className="user-name">{profile.full_name || 'Unknown User'}</div>
                  </div>
                </div>
                <button 
                  className="add-btn"
                  onClick={() => sendFriendRequest(profile.id)}
                >
                  Add Friend
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Friend Requests */}
      {pendingRequests.length > 0 && (
        <div className="requests-section">
          <h3>Friend Requests ({pendingRequests.length})</h3>
          {pendingRequests.map(request => (
            <div key={request.id} className="request-card">
              <div className="user-info">
                {request.profiles?.avatar_url && (
                  <img src={request.profiles.avatar_url} alt={request.profiles.full_name} className="avatar" />
                )}
                <div>
                  <div className="user-name">{request.profiles?.full_name || 'Unknown User'}</div>
                  <div className="request-date">
                    {new Date(request.requested_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <div className="request-actions">
                <button 
                  className="accept-btn"
                  onClick={() => acceptFriendRequest(request.id)}
                >
                  Accept
                </button>
                <button 
                  className="decline-btn"
                  onClick={() => declineFriendRequest(request.id)}
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sent Requests */}
      {sentRequests.length > 0 && (
        <div className="sent-requests-section">
          <h3>Pending Requests Sent ({sentRequests.length})</h3>
          {sentRequests.map(request => (
            <div key={request.id} className="request-card pending">
              <div className="user-info">
                {request.profiles?.avatar_url && (
                  <img src={request.profiles.avatar_url} alt={request.profiles.full_name} className="avatar" />
                )}
                <div>
                  <div className="user-name">{request.profiles?.full_name || 'Unknown User'}</div>
                  <div className="request-status">⏳ Pending</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Friends List */}
      {friends.length > 0 && (
        <div className="friends-list-section">
          <h3>My Friends ({friends.length})</h3>
          {friends.map(friendship => (
            <div key={friendship.id} className="friend-card">
              <div className="user-info">
                {friendship.profiles?.avatar_url && (
                  <img src={friendship.profiles.avatar_url} alt={friendship.profiles.full_name} className="avatar" />
                )}
                <div>
                  <div className="user-name">{friendship.profiles?.full_name || 'Unknown User'}</div>
                  <div className="friend-since">
                    Friends since {new Date(friendship.responded_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <div className="friend-actions">
                <a href={`/dashboard/compare/${friendship.profiles.id}`} className="compare-btn">
                  Compare
                </a>
                <button 
                  className="remove-btn"
                  onClick={() => removeFriend(friendship.id)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {friends.length === 0 && pendingRequests.length === 0 && (
        <div className="empty-state">
          <p>👋 Search for friends to connect with!</p>
          <p>Start your weight loss journey together</p>
        </div>
      )}
    </div>
  );
}
