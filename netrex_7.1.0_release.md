# Netrex v7.1.0 Release Notes

## 🚀 Enhancements & New Features

* **Global Text-to-Speech (TTS) Integration:**
  * Incoming chat messages are now automatically and intelligently read aloud via the TTS system when notifications are enabled, even if the user is not actively viewing the respective chat room. 
  * **Smart TTS Parsing:** The TTS engine now accurately detects and gracefully handles Turkish "random keyboard smash laughs" (e.g., "asdfgh", "qweqwe"). It will natively read them as a natural laugh rather than spelling out individual letters.
* **Enhanced System Notifications:**
  * **Native External Links:** Clicking on a hyperlink directly inside a Windows desktop notification now correctly opens the URL in your system’s default internet browser (Chrome, Edge, etc.) rather than intercepting it inside the Electron window.
* **Performance & State Optimization:**
  * Overhauled the internal Zustand state managers (Settings & Voice Store). Transient variables (like real-time speaking statuses) are now excluded from disk persistence (`partialize`), vastly reducing local storage I/O thrashing.
  * Migrated away from deprecated Zustand APIs to modern deep-equality and shallow selectors.

## 🐛 Bug Fixes & Stability

* **Screen Sharing & Grid Spotlight:**
  * Resolved severe edge cases and video stuttering scenarios where the grid/spotlight layout would corrupt or attempt to mount multiple times when a user toggled, stopped, or rapidly switched their screen share source.
* **UI Z-Index Overlaps:**
  * Fixed visual layering issues where user profile pictures and the right-side member list would incorrectly bleed through and render on top of active popover modals. The hierarchy is now strictly enforced, especially visible during active screen sharing modes.
* **Voice Activity Detection (VAD) & UI Animation:**
  * Fixed a lingering issue where the real-time glowing "speaking" border animation completely failed to trigger for the local user when talking into the microphone.
* **RNNoise (Krisp) & Audio Processing Mastery:**
  * **WASM Memory Leak Fix:** Resolved a fatal WebAssembly `memory access out of bounds` crash caused by the continuous recreation of the RNNoise module. The system now utilizes a highly efficient, single, caching global `RNNoiseNode`.
  * **Silence Worklet Crash:** Prevented a silent background crash inside the audio worklets caused by optimized empty buffers by injecting an "Anti-Silence" micro-oscillator signal to maintain a steady processing state at all times.
  * **AudioContext Autoplay Fix:** Eliminated instances where the browser's autoplay policies forcefully blocked audio graph construction by moving the processor to a permanent suspend/resume lifecycle on a globally shared `AudioContext`.
  * **Microphone Track Integrity:** Fixed the LiveKit MediaStream cloning pipeline to prevent the local microphone capture stream from randomly freezing, breaking, or prematurely terminating when leaving rooms or rapidly toggling mute states.
* **LiveKit Server Pool & Rotation:**
  * **Global Synchronization Fix:** Fixed a critical bug in the multi-server load balancing algorithm where secondary users in a room would receive the "server changed" notification from Firebase but would fail to automatically refresh their authentication tokens and reconnect to the new server, leaving them visually stranded in the old server instance.
  * **Self-Healing & Validation Logic:** Implemented a new "boot repair" system for the server pool. If the synchronization document in Firebase contains corrupted data (e.g., negative indices or out-of-bounds counts), the client now automatically detects and repairs the document back to a healthy state (Server 0) upon connection. 
  * **State Consistency:** Overhauled the rotation logic with a Ref-based synchronization model, ensuring that rapid server switching events always use the absolute latest server count and index, preventing race conditions during high-load periods. 
  * **Enhanced Verification:** Added real-time write-verification logging, confirming every server rotation update in Firebase and ensuring all clients remain perfectly synchronized.
* **Input Sensitivity (Noise Gate) Calibration:**
  * Completely recalibrated the microphone Noise Gate. The visual audio level meter in the settings now accurately reflects the true RAW input RMS.
  * The Noise Gate algorithm now strictly and natively respects the exact manual percentage threshold configured by the user, completely eliminating overly sensitive triggers when heavy Krisp background noise suppression is active.
