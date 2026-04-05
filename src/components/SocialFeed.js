'use client';
import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import './social-feed.css';

export default function SocialFeed() {
  const supabase = createClientComponentClient();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newPost, setNewPost] = useState('');
  const [showCreatePost, setShowCreatePost] = useState(false);

  useEffect(() => {
    loadFeed();

    // Real-time subscription
    const channel = supabase
      .channel('social_feed_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'social_feed' },
        () => loadFeed()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadFeed = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('social_feed')
        .select(`
          *,
          profiles!social_feed_user_id_fkey (
            id,
            full_name,
            avatar_url
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Get comments for each post
      const enrichedPosts = await Promise.all(
        data.map(async (post) => {
          const { data: comments } = await supabase
            .from('social_feed_comments')
            .select(`
              *,
              profiles (
                full_name,
                avatar_url
              )
            `)
            .eq('post_id', post.id)
            .order('created_at', { ascending: true })
            .limit(3);

          return { ...post, recent_comments: comments || [] };
        })
      );

      setPosts(enrichedPosts);
    } catch (error) {
      console.error('Error loading feed:', error);
    } finally {
      setLoading(false);
    }
  };

  const createPost = async () => {
    if (!newPost.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from('social_feed').insert({
        user_id: user.id,
        post_type: 'custom',
        content: { text: newPost },
        visibility: 'friends'
      });

      if (error) throw error;

      setNewPost('');
      setShowCreatePost(false);
      loadFeed();
    } catch (error) {
      console.error('Error creating post:', error);
      alert('Failed to create post');
    }
  };

  const reactToPost = async (postId, reactionType) => {
    try {
      const post = posts.find(p => p.id === postId);
      const reactions = post.reactions || { heart: 0, fire: 0, muscle: 0, party: 0 };
      reactions[reactionType] = (reactions[reactionType] || 0) + 1;

      await supabase
        .from('social_feed')
        .update({ reactions })
        .eq('id', postId);

      loadFeed();
    } catch (error) {
      console.error('Error reacting to post:', error);
    }
  };

  const addComment = async (postId, commentText) => {
    if (!commentText.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('social_feed_comments').insert({
        post_id: postId,
        user_id: user.id,
        comment_text: commentText
      });

      loadFeed();
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  if (loading) {
    return (
      <div className="social-feed-container">
        <div className="loading">Loading feed...</div>
      </div>
    );
  }

  return (
    <div className="social-feed-container">
      <div className="feed-header">
        <h2>🌟 Activity Feed</h2>
        <button className="create-post-btn" onClick={() => setShowCreatePost(!showCreatePost)}>
          ✍️ Share Update
        </button>
      </div>

      {/* Create Post */}
      {showCreatePost && (
        <div className="create-post-card">
          <textarea
            className="post-input"
            placeholder="Share your progress, motivation, or achievements..."
            value={newPost}
            onChange={(e) => setNewPost(e.target.value)}
            rows={4}
          />
          <div className="post-actions">
            <button className="cancel-btn" onClick={() => setShowCreatePost(false)}>
              Cancel
            </button>
            <button className="submit-btn" onClick={createPost}>
              Post
            </button>
          </div>
        </div>
      )}

      {/* Feed */}
      <div className="feed-posts">
        {posts.length === 0 ? (
          <div className="empty-feed">
            <div className="empty-icon">📝</div>
            <h3>No activity yet</h3>
            <p>Add friends to see their progress and achievements!</p>
          </div>
        ) : (
          posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              onReact={reactToPost}
              onComment={addComment}
            />
          ))
        )}
      </div>
    </div>
  );
}

function PostCard({ post, onReact, onComment }) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');

  const handleComment = () => {
    onComment(post.id, commentText);
    setCommentText('');
  };

  const getPostContent = () => {
    switch (post.post_type) {
      case 'achievement':
        return {
          icon: '🏆',
          title: `unlocked "${post.content?.achievement_name}"`,
          description: post.content?.achievement_description
        };
      case 'milestone':
        return {
          icon: '🎯',
          title: `reached a milestone!`,
          description: post.content?.milestone_text
        };
      case 'goal_reached':
        return {
          icon: '🎉',
          title: `reached their weight goal!`,
          description: post.content?.message
        };
      case 'streak_milestone':
        return {
          icon: '🔥',
          title: `${post.content?.days} day streak!`,
          description: `Maintaining consistency for ${post.content?.days} days`
        };
      default:
        return {
          icon: '💭',
          title: '',
          description: post.content?.text
        };
    }
  };

  const content = getPostContent();
  const reactions = post.reactions || { heart: 0, fire: 0, muscle: 0, party: 0 };

  return (
    <div className="post-card">
      <div className="post-header">
        <img
          src={post.profiles?.avatar_url || '/placeholder-avatar.png'}
          alt={post.profiles?.full_name}
          className="post-avatar"
        />
        <div className="post-user-info">
          <div className="post-user-name">{post.profiles?.full_name}</div>
          <div className="post-time">{formatTime(post.created_at)}</div>
        </div>
      </div>

      <div className="post-content">
        <div className="post-icon">{content.icon}</div>
        {content.title && (
          <div className="post-title">{content.title}</div>
        )}
        <div className="post-description">{content.description}</div>
      </div>

      <div className="post-reactions">
        {Object.entries({ heart: '❤️', fire: '🔥', muscle: '💪', party: '🎉' }).map(([type, emoji]) => (
          <button
            key={type}
            className="reaction-btn"
            onClick={() => onReact(post.id, type)}
          >
            {emoji} {reactions[type] || 0}
          </button>
        ))}
      </div>

      <div className="post-footer">
        <button className="comment-toggle-btn" onClick={() => setShowComments(!showComments)}>
          💬 {post.comment_count || 0} Comments
        </button>
      </div>

      {showComments && (
        <div className="comments-section">
          {post.recent_comments?.map(comment => (
            <div key={comment.id} className="comment">
              <img
                src={comment.profiles?.avatar_url || '/placeholder-avatar.png'}
                alt={comment.profiles?.full_name}
                className="comment-avatar"
              />
              <div className="comment-content">
                <div className="comment-author">{comment.profiles?.full_name}</div>
                <div className="comment-text">{comment.comment_text}</div>
              </div>
            </div>
          ))}

          <div className="add-comment">
            <input
              type="text"
              placeholder="Write a comment..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleComment()}
            />
            <button onClick={handleComment}>Send</button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(timestamp) {
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
}
