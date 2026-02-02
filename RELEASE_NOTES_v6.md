# 🚀 Netrex v6.0.0 Release Notes

We are taking your voice and text chat experience to the next level with Netrex Core Engine v6! This update includes fundamental changes focused on performance, security, and user experience.

## ✨ Highlights

### 🛡️ Security and Link Verification
*   **Advanced Security Modal:** The warning screen that appears when clicking external links has been completely redesigned to match the Netrex design language.
*   **Link Validation:** External links are now presented with a more distinct visual structure, providing users with full control and transparency.
*   **Smart Navigation:** A new security layer has been added to prevent accidental in-app redirections and navigation bugs.

### 💬 Modernized Chat Input
*   **Premium Design:** The chat input area has been revamped with an ultra-modern look featuring glassmorphism effects and interactive gradient transitions.
*   **Enhanced Media Preview:** Added an animated and more compact preview panel for images ready to be sent.
*   **Emoji and File Access:** Emoji picker and file attachment buttons are now better balanced and more quickly accessible.

### 🖼️ Professional Media Viewer (v5 Engine)
*   **Zero-Lag Dragging:** Our new dragging engine works independently of the React render cycle, allowing images to track your mouse cursor in real-time with 1:1 precision.
*   **Frictionless Experience:** The requirement to hold the "Space" key to drag images has been removed; you can now move freely with a direct "click and drag" method.
*   **Advanced Controls:** Zoom In/Out, Rotate, and Reset View icons have been updated to be easily distinguishable.
*   **Secure Downloading:** The image download process has been optimized to trigger a native "Save As" dialog directly, without breaking the application state.

### 🌊 Visual Experience and Splash Screens
*   **Exit Splash Screen:** The application exit screen has been updated with the new Aurora theme and a red "exit" palette.
*   **Initialization Animations:** Splash screen transition times and text cycles (Initializing, Checking Data, Rolling Out) have been made smoother.

## 🛠️ Bug Fixes and Improvements

*   **Scroll-to-Bottom:** Scrolling issues and jumpy transitions when new messages arrive have been completely resolved with the new "Dual-Anchor Scroll" system.
*   **Performance:** Unnecessary render operations across the app have been reduced, optimizing CPU and RAM usage.
*   **Fix:** Cleaned up `ReferenceError` and `setState` warnings that occurred in certain scenarios.
*   **Fix:** Resolved an issue where the chat panel remained in an incorrect state during server switches.

---
*The Netrex team continues to work for a better experience. Your feedback is valuable to us!* 🚀
