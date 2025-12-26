# Netrex v4.1.0 Release Notes

## 🎨 UI/UX Improvements

### Premium Modal Redesign
- **CreateServerModal & JoinServerModal** - Completely redesigned with premium Void Theme styling
  - Glassmorphism backdrop with blur effects
  - Animated particles and gradient glows
  - Premium ESC close button with hover animations (rotate effect + red glow)
  - Consistent styling with ServerSettingsModal

### Context Menu Enhancements
- **ServerRail Context Menu** - Updated to match Void Theme
  - Deeper dark background (`bg-[#0d0e10]/95`)
  - Refined shadows and border styling
  - Compact padding and faster animations
  - Updated section headers and button styles

### User Context Menu Overhaul
- **Complete redesign** with premium dark theme
  - Larger user avatar with subtle glow effect
  - Volume control in its own styled card
  - **New compact toggle switches** for moderation (Mute/Deafen)
    - Single-click toggle instead of separate buttons
    - Visual state indicators with colored glow effects
    - Inline layout saves vertical space
  - Streamlined warning messages

### Animation Refinements
- **Page transition animations** - Changed from slide-in to clean fade-in
  - Removed `translateY` and `scale` transforms for smoother feel
  - Faster animation duration (0.5s → 0.3s)
  - Reduced stagger delays for snappier UI

## 🐛 Bug Fixes

### Mute/Deafen State Synchronization
- **Fixed visual state desync** - When rejoining a voice channel, mute/deafen states now properly reset
- Previously, visual indicators would persist but audio wouldn't match
- Solution: Reset `isMuted` and `isDeafened` in settingsStore when joining a room

### Server Logo Display
- **Fixed server icon in sidebar** - Now properly displays Cloudinary-hosted server logos
- Added fallback to first letter if no icon is set

## 🔧 Technical Changes

- Updated CSS animations in `globals.css`
- Refactored moderation button logic to use toggle switches
- Improved component consistency across modal designs

---

**Full Changelog**: v4.0.0...v4.1.0
