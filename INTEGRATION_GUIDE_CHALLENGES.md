# 🎯 How to Start Challenges & View Friend Weight Tracking

## Quick Integration Guide

Since all components are built but not yet integrated into dashboard pages, here's how to set them up:

---

## 📋 Step 1: Create Dashboard Pages

### 1. Create Challenges Page
**File:** `src/app/dashboard/challenges/page.js`

```javascript
'use client';
import DailyChallenges from '@/components/DailyChallenges';
import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function ChallengesPage() {
  const supabase = createClientComponentClient();
  const [showCreateChallenge, setShowCreateChallenge] = useState(false);

  const createChallenge = async (challengeData) => {
    const { data: { user } } = await supabase.auth.getUser();
    
    // Create head-to-head challenge with a friend
    const { data: challenge, error } = await supabase
      .from('challenges')
      .insert({
        creator_user_id: user.id,
        challenge_type: 'head_to_head', // or 'group', 'solo'
        name: challengeData.name,
        description: challengeData.description,
        goal_metric: 'weight_loss', // or 'calorie_streak', 'meals_logged', etc.
        target_value: challengeData.targetValue,
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      alert('Failed to create challenge');
      return;
    }

    // Add yourself as participant
    await supabase.from('challenge_participants').insert({
      challenge_id: challenge.id,
      user_id: user.id,
      invitation_status: 'accepted'
    });

    // Invite friend(s)
    if (challengeData.friendIds) {
      const invites = challengeData.friendIds.map(friendId => ({
        challenge_id: challenge.id,
        user_id: friendId,
        invitation_status: 'pending'
      }));
      await supabase.from('challenge_participants').insert(invites);
    }

    alert('Challenge created! Waiting for friends to accept.');
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>🏆 Challenges</h1>
      
      {/* Daily Challenges Component */}
      <DailyChallenges />

      {/* Create Challenge Button */}
      <button 
        onClick={() => setShowCreateChallenge(true)}
        style={{
          padding: '1rem 2rem',
          background: 'linear-gradient(135deg, #10b981, #059669)',
          color: 'white',
          border: 'none',
          borderRadius: '12px',
          fontSize: '1rem',
          fontWeight: '600',
          cursor: 'pointer',
          marginTop: '2rem'
        }}
      >
        + Create New Challenge
      </button>

      {showCreateChallenge && (
        <CreateChallengeForm 
          onSubmit={createChallenge}
          onCancel={() => setShowCreateChallenge(false)}
        />
      )}
    </div>
  );
}

function CreateChallengeForm({ onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    targetValue: 10, // 10 lbs for weight loss
    friendIds: []
  });

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: 'white',
        padding: '2rem',
        borderRadius: '16px',
        maxWidth: '500px',
        width: '90%'
      }}>
        <h2>Create Challenge</h2>
        
        <input
          type="text"
          placeholder="Challenge Name (e.g., 'Summer Slim Down')"
          value={formData.name}
          onChange={(e) => setFormData({...formData, name: e.target.value})}
          style={{
            width: '100%',
            padding: '0.75rem',
            border: '2px solid #e5e7eb',
            borderRadius: '8px',
            marginBottom: '1rem'
          }}
        />

        <textarea
          placeholder="Description (optional)"
          value={formData.description}
          onChange={(e) => setFormData({...formData, description: e.target.value})}
          style={{
            width: '100%',
            padding: '0.75rem',
            border: '2px solid #e5e7eb',
            borderRadius: '8px',
            marginBottom: '1rem',
            minHeight: '80px'
          }}
        />

        <input
          type="number"
          placeholder="Target (lbs to lose)"
          value={formData.targetValue}
          onChange={(e) => setFormData({...formData, targetValue: e.target.value})}
          style={{
            width: '100%',
            padding: '0.75rem',
            border: '2px solid #e5e7eb',
            borderRadius: '8px',
            marginBottom: '1rem'
          }}
        />

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={() => onSubmit(formData)}
            style={{
              flex: 1,
              padding: '0.75rem',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Create Challenge
          </button>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '0.75rem',
              background: '#f3f4f6',
              color: '#374151',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

### 2. Create Friends Weight Tracking Page
**File:** `src/app/dashboard/friends/page.js`

```javascript
'use client';
import FriendsList from '@/components/FriendsList';
import HeadToHead from '@/components/HeadToHead';
import { useState } from 'react';

export default function FriendsPage() {
  const [selectedFriend, setSelectedFriend] = useState(null);

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <h1>👥 Friends & Weight Tracking</h1>
      
      <div style={{
        display: 'grid',
        gridTemplateColumns: selectedFriend ? '400px 1fr' : '1fr',
        gap: '2rem',
        marginTop: '2rem'
      }}>
        {/* Friends List */}
        <div>
          <FriendsList onSelectFriend={(friend) => setSelectedFriend(friend)} />
        </div>

        {/* Friend Weight Comparison */}
        {selectedFriend && (
          <div>
            <HeadToHead friendId={selectedFriend.id} />
          </div>
        )}
      </div>
    </div>
  );
}
```

---

### 3. Update FriendsList Component
**File:** `src/components/FriendsList.js` (add onClick handler)

Add this to the friend card in FriendsList component:

```javascript
// In the friend mapping section, add onClick:
<div 
  className="friend-card"
  onClick={() => onSelectFriend && onSelectFriend(friend)}
  style={{ cursor: 'pointer' }}
>
  {/* existing content */}
</div>
```

---

## 🚀 Step 2: How to Use (Once Integrated)

### Starting a Challenge:

1. **Navigate to `/dashboard/challenges`**
2. **Click "Create New Challenge"**
3. **Fill in the form:**
   - Challenge Name: "10 Pound Challenge"
   - Description: "First to lose 10 lbs wins!"
   - Target: 10 (lbs)
   - Select friends to invite
4. **Click "Create Challenge"**
5. **Friends receive notification to accept**
6. **Once accepted, challenge starts automatically**

### Types of Challenges You Can Create:

```javascript
// Head-to-Head (1v1)
challenge_type: 'head_to_head'
goal_metric: 'weight_loss'
target_value: 10 // 10 lbs

// Group Challenge (multiple people)
challenge_type: 'group'
goal_metric: 'weight_loss'
target_value: 15

// Calorie Streak Challenge
challenge_type: 'head_to_head'
goal_metric: 'calorie_streak'
target_value: 14 // 14 days

// Meal Logging Challenge
challenge_type: 'group'
goal_metric: 'meals_logged'
target_value: 50 // 50 meals
```

---

### Viewing Friend's Weight Tracking:

1. **Navigate to `/dashboard/friends`**
2. **Your friends list appears on the left**
3. **Click on any friend's card**
4. **Head-to-Head comparison loads on the right** showing:
   - Weight loss comparison
   - Streak comparison  
   - Calories burned
   - Meals logged
   - Achievements earned
   - XP comparison
   - Overall winner badge

---

## 🔒 Privacy Settings

Friends can only see your weight if you allow it in Privacy Settings:

**File:** `src/app/dashboard/settings/page.js`

```javascript
'use client';
import PrivacySettings from '@/components/PrivacySettings';

export default function SettingsPage() {
  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>⚙️ Settings</h1>
      <PrivacySettings />
    </div>
  );
}
```

**Privacy Toggles Available:**
- ✅ Share weight progress with friends
- ✅ Share achievements with friends  
- ✅ Share streak stats
- ✅ Show on leaderboards
- ✅ Allow challenge invites
- ✅ Show in friend recommendations

---

## 📊 Database Flow

### When You Create a Challenge:

```sql
-- 1. Challenge is created
INSERT INTO challenges (
  creator_user_id,
  challenge_type,
  name,
  goal_metric,
  target_value,
  start_date,
  end_date,
  status
) VALUES (...);

-- 2. You're added as participant
INSERT INTO challenge_participants (
  challenge_id,
  user_id,
  invitation_status
) VALUES (challenge_id, your_id, 'accepted');

-- 3. Friends are invited
INSERT INTO challenge_participants (
  challenge_id,
  user_id,
  invitation_status
) VALUES (challenge_id, friend_id, 'pending');

-- 4. Notification sent to friends
INSERT INTO notifications (
  user_id,
  notification_type,
  title,
  message
) VALUES (
  friend_id,
  'challenge_invite',
  'Challenge Invite!',
  'You were invited to: Challenge Name'
);
```

### When Friend Accepts:

```sql
-- Update participant status
UPDATE challenge_participants
SET 
  invitation_status = 'accepted',
  accepted_at = NOW(),
  starting_value = (SELECT weight_kg FROM weight_logs WHERE user_id = friend_id ORDER BY logged_at DESC LIMIT 1)
WHERE challenge_id = ? AND user_id = friend_id;

-- If all participants accepted, activate challenge
UPDATE challenges
SET status = 'active'
WHERE id = ? 
AND NOT EXISTS (
  SELECT 1 FROM challenge_participants 
  WHERE challenge_id = ? AND invitation_status = 'pending'
);
```

### Viewing Friend Weight:

```sql
-- Check privacy settings first
SELECT share_weight_progress, share_achievements
FROM privacy_settings
WHERE user_id = friend_id;

-- If allowed, fetch weight data
SELECT *
FROM weight_logs
WHERE user_id = friend_id
AND EXISTS (
  SELECT 1 FROM friendships
  WHERE status = 'accepted'
  AND ((user_id = your_id AND friend_id = friend_id)
    OR (friend_id = your_id AND user_id = friend_id))
)
ORDER BY logged_at DESC
LIMIT 30;
```

---

## 🎮 Quick Integration Commands

Run these to create all dashboard pages at once:

```bash
# Create directories
mkdir -p src/app/dashboard/challenges
mkdir -p src/app/dashboard/friends
mkdir -p src/app/dashboard/settings

# Create the page files (copy code above into these files)
# Then you can access:
# - http://localhost:3000/dashboard/challenges
# - http://localhost:3000/dashboard/friends
# - http://localhost:3000/dashboard/settings
```

---

## 🏆 Challenge Results

When a challenge ends:

1. **System automatically calculates winner** based on progress
2. **Updates challenge status to 'completed'**
3. **Awards XP & points to winner**
4. **Creates notifications for all participants**
5. **ChallengeResults component shows:**
   - Winner announcement
   - Final standings
   - Rewards earned
   - Option to rematch

---

## 📱 Mobile Support

All components are mobile-responsive:
- Challenges page: Stacks vertically on mobile
- Friends comparison: Full-width cards
- Privacy settings: Touch-friendly toggles

---

## ⚡ Real-time Updates

Challenges update in real-time via Supabase subscriptions:
- Friend accepts challenge → instant notification
- Friend logs weight → leaderboard updates
- Challenge ends → results appear immediately

---

Need help creating these pages? I can generate the complete code files for you!
