# 🚀 Netrex v4.2.0 Release Notes

### **Voice & Audio Engine**
* **Advanced Noise Suppression:** Major optimizations to the RNNoise integration. The audio engine now effectively filters out mechanical keyboard clicks, mouse clicks, and desk impacts while preserving natural human speech.
* **VAD Improvements:** Refined Voice Activity Detection (VAD) algorithms (especially in Krisp mode) to prevent cutting off the beginning of words while strictly blocking non-speech background noise.
* **Stability Fixes:** Resolved WebAssembly (WASM) initialization errors related to the RNNoise module.

### **Server Management & Interaction**
* **New "Add Server" Flow:** Clicking the `+` button now opens a dedicated selection modal, giving users a clear choice to either **Create a New Server** or **Join an Existing One**.
* **Themed "Leave Server" Modal:** Replaced generic browser alerts with a fully themed, animated confirmation modal when leaving a server.
* **Permission Updates:** Managers with the `MANAGE_SERVER` permission can now access Server Settings (previously restricted to the Owner).
* **Context Menu Polish:** Cleaned up the server context menus to correctly show/hide options based on user roles (e.g., hiding "Delete Server" for non-owners).

### **Chat & Media**
* **Drag & Drop Uploads:** Implemented a full-screen drop zone overlay. You can now drag images anywhere onto the app window to initiate an upload in the chat.
* **Optimized Message Loading:** Improved chat performance by implementing smart pagination (loading the last 50 messages initially) and seamless "load older messages" functionality on scroll.

### **User Interface & Experience**
* **Refined UI Elements:** Fixed vertical alignment and symmetry issues on all Toggle/Switch components for a pixel-perfect look.
* **Camera Overlay Fix:** Resolved an issue where a secondary camera overlay would appear unexpectedly; overlays now only trigger correctly during screen sharing sessions.
* **Presence System:** Fixed bugs related to "Away" and "Offline" status detection, ensuring user states are accurately reflected when minimizing the app or going idle.
