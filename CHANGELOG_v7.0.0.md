# Netrex v7.0.0 Changelog

## 🚀 New Features & Improvements

### ⚡ Performance Optimization
- **Critical CPU Fix:** Resolved a major performance issue where the CPU usage spiked to 20-30% due to an unoptimized "audio-play" status animation in the User Card component. The animation logic has been refactored to be static and performant.
- **Memory Leak Prevention:** Addressed memory leaks associated with LiveKit audio track handling and improper cleanup of audio contexts upon room exit.

### 🖥️ Screen Sharing
- **Tab Reordering:** The **"Screens"** tab is now prioritized and appears first, followed by "Applications". The default view is set to "Screens" for faster access.
- **Enhanced Quality Options:**
  - Added support for **60 FPS** streaming.
  - Increased the FPS limit for **1080p** resolution to **30 FPS** (previously capped at 15).
  - Updated the UI to reflect these new capabilities and removed the 5 FPS option.

## 🛠️ Bug Fixes & Stability

### 👤 Anonymous User System
- **Crash Prevention:** Fixed a critical "Grey Screen" crash that occurred when anonymous users logged out.
- **Data Cleanup:** Implemented a robust deletion process that ensures anonymous user data (server memberships, user profile) is properly removed from the database upon logout.
- **Ghost Session Fix:** Added a safeguard to detect users whose database records have been deleted but still have a valid auth token. The app now automatically signs these users out to prevent "Cannot join servers" errors.
- **Login Verification:** The login process now strictly verifies that the user profile is successfully created in Firestore before granting access. If creation fails, the login is aborted to prevent a broken user state.

### 🔐 Authentication & Navigation
- **Black Screen Fix:** Resolved a persistent issue where the application would freeze on a black screen after logging out. This was caused by an unsafe page reload operation in the Electron environment. The logout flow now relies on React state updates for a seamless transition.
- **Google Login Reliability:** Fixed a bug where Google Login would stop working after the first logout. The OAuth event listener in the Electron preload script has been updated from a one-time listener (`once`) to a persistent listener (`on`), supporting multiple login/logout cycles without restarting the app.

## 📦 Technical Changes
- **Electron IPC:** Optimized `preload.js` to verify and maintain persistent event listeners for authentication.
- **Store Management:** Refactored `authStore.js` to handle logout cleanup logic more efficiently, removing unnecessary page reloads and ensuring safe state resets.
