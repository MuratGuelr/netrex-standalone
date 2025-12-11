# LiveKit Quota Efficiency Improvements

## Summary

This document describes the changes made to prevent "Ghost/Zombie Participants" and reduce LiveKit quota drainage in the Netrex application.

## Problem Description

When a user's internet fluctuates and they reconnect:
1. The system was assigning a NEW random identity (using `username` as identity)
2. LiveKit would see 2 users (old disconnected + new one) until timeout expires
3. This caused "Participant Minutes" usage to spike by 3x-4x

## Solutions Implemented

### 1. Deterministic (Static) Identity ✅

**File: `src/utils/deviceId.js`** (NEW)
- Created a utility to generate and persist a unique device ID in `localStorage`
- The device ID is generated once and reused for all future connections
- Identity format: `{userId}_{deviceShort}` (e.g., "abc123_a1b2c3d4")

**File: `electron/main.js`** (MODIFIED)
- Updated `get-livekit-token` handler to accept separate `identity` and `displayName` parameters
- Identity is now persistent (userId-based) instead of using display name
- Added 24-hour TTL to tokens for security

**File: `electron/preload.js`** (MODIFIED)
- Updated `getLiveKitToken` bridge to pass `identity` and `displayName` separately

**File: `src/components/ActiveRoom.js`** (MODIFIED)
- Added import for `generateLiveKitIdentity` utility
- Updated token generation to use persistent identity
- Updated retry logic to use the same persistent identity
- **Fixed display name:** UI now uses `participant.name` for display instead of `participant.identity`

### 2. Display Name Fix ✅

The key distinction in LiveKit:
- `participant.identity` = unique ID for tracking (our new `userId_deviceShort` format)
- `participant.name` = display name visible to users (the username they entered)

**Files Updated to use `participant.name` for display:**
- `src/components/ActiveRoom.js` - User cards, notifications, screen share buttons
- `src/components/UserContextMenu.js` - Context menu header

### 3. Graceful Shutdown (Immediate Disconnect) ✅

**File: `electron/main.js`** (MODIFIED)
- Added SIGINT and SIGTERM signal handlers for graceful shutdown
- Ensures proper cleanup even when app is force-killed

**File: `src/components/ActiveRoom.js`** (MODIFIED)
- Updated LiveKitRoom options with `disconnectOnPageLeave: true`
- Added `stopLocalTrackOnUnpublish: true` to prevent lingering audio
- Added `onDisconnected` callback for logging

### 4. Connection Configuration ✅

**File: `src/components/ActiveRoom.js`** (MODIFIED)
- Added `peerConnectionTimeout: 10000` (10 seconds) to establish WebRTC faster
- Enabled `adaptiveStream` for bandwidth efficiency
- Improved documentation for connection options

### 5. Bug Fixes ✅

**Fixed `HeadphoneOff` import error:**
- `HeadphoneOff` doesn't exist in lucide-react 0.300.0
- Replaced with `VolumeX` in:
  - `src/components/ui/UserCard.jsx`
  - `src/components/layout/UserPanel.jsx`
  - `src/components/layout/BottomControls.jsx`

## How It Works

### Before (Problematic)
```
User connects → identity = "John" 
Internet drops → LiveKit keeps "John" ghost for 60s
User reconnects → identity = "John" (but treated as new connection!)
Result: 2 participants counted for 60 seconds = Double quota usage

UI shows: "btaGFBnF2EMQQXRzUWxhAuA0tCk2_8baacc05" (ugly!)
```

### After (Fixed)
```
User connects → identity = "user123_a1b2c3d4", name = "John"
Internet drops → LiveKit keeps ghost for timeout period
User reconnects → identity = "user123_a1b2c3d4" (SAME!), name = "John"
Result: LiveKit replaces old connection = No ghost participant

UI shows: "John" (proper display name!)
```

## Key Benefits

1. **No Ghost Participants**: Same identity forces LiveKit to replace old connection
2. **Immediate Disconnect**: Proper cleanup on app close prevents lingering sessions
3. **Reduced Quota Usage**: Expected 3-4x reduction in participant minutes
4. **Better Reconnection**: Faster peer connection establishment
5. **Proper Display Names**: Users see their actual usernames, not internal IDs

## Testing

To verify the fix works:
1. Join a room and note the participant count in LiveKit Dashboard
2. Verify your **username appears correctly** (not a random ID string)
3. Disconnect internet briefly (disable Wi-Fi/Ethernet)
4. Reconnect internet
5. The participant count should stay the same (no duplicate)
6. Close the app and verify immediate disconnect in dashboard

## Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `src/utils/deviceId.js` | NEW | Device ID generation and persistence |
| `electron/main.js` | MODIFIED | Token generation with separate identity/name |
| `electron/preload.js` | MODIFIED | Updated IPC bridge |
| `src/components/ActiveRoom.js` | MODIFIED | Identity usage + display name fix |
| `src/components/UserContextMenu.js` | MODIFIED | Display name fix |
| `src/components/ui/UserCard.jsx` | MODIFIED | HeadphoneOff → VolumeX |
| `src/components/layout/UserPanel.jsx` | MODIFIED | HeadphoneOff → VolumeX |
| `src/components/layout/BottomControls.jsx` | MODIFIED | HeadphoneOff → VolumeX |

## Notes

- Device ID is stored in `localStorage` under key `netrex_device_id`
- The identity format includes userId + device short hash for uniqueness
- Existing users will get a new device ID on first reconnection
- This is backward compatible (old tokens still work until they expire)
- Display names use `participant.name || participant.identity` fallback
