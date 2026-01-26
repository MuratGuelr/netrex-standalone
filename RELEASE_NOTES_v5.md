# 🚀 Netrex v5.0.0 Release Notes

## 🎨 UI/UX Improvements

### Speaking Indicator - Gradient Border
- **Premium gradient border** when user is speaking
- Border color matches user's profile theme
- Smooth glow effect around the card
- Scale animation (1.02x) for emphasis
- Clean look when not speaking (no border)

### User Card Redesign
- **No border** in normal state (cleaner look)
- **Gradient wrapper border** only when speaking
- **Red border** only for muted/deafened users
- Background gradient improved for better contrast
- Smooth transitions (0.25s ease-out)

---

## ⚡ Performance Optimizations

### Game Detection System - REMOVED
- **Completely removed** game detection feature
- Saves significant CPU and RAM usage
- No more `tasklist` process scanning
- IPC handlers preserved for compatibility (return null)
- `games.js` file deleted (~600 lines removed)
- `useGameActivity` hook simplified (always returns null)

### Graphics Quality Modes
- **High Mode:** Full animations, blur effects
- **Performance Mode:** Balanced, blur disabled
- **Potato Mode:** Minimal resources, animations disabled

---

## 🔧 Technical Changes

### Electron Main Process
- Removed ~235 lines of game detection code
- Removed process caching system
- Removed priority games array
- Simplified IPC handlers

### React Components
- `UserCard.js`: New gradient border wrapper system
- `UserCard.js`: Border only for muted/deafened state
- `useGameActivity.js`: Simplified to return null always

---

## 🐛 Bug Fixes

### Border Display Issues
- Fixed white border appearing in High/Potato modes
- Fixed border persisting after speaking ends
- Border now only shows when:
  - Speaking (gradient color)
  - Muted/Deafened (red)

### Speaking Detection
- Improved speaking state transitions
- Smoother animation when starting/stopping speech

---

## 📊 Performance Summary

| Feature | Before | After |
|---------|--------|-------|
| Game Detection | Active (CPU intensive) | **Disabled** |
| Process Scanning | Every 25-30 seconds | **None** |
| Memory Usage | Higher (process cache) | **Lower** |
| User Card Border | Always visible | **Only when needed** |

---

## 📁 Modified Files

```
electron/main.js (removed game detection)
electron/games.js (DELETED)
src/hooks/useGameActivity.js (simplified)
src/components/active-room/UserCard.js (new border system)
```

---

## 🔄 Migration Notes

- Game activity will no longer be displayed
- All game detection API calls will return null
- No action required from users
- Settings related to game detection can be ignored

---

## 📈 What's New Since v4.4.2

| Category | Changes |
|----------|---------|
| **UI** | Gradient speaking border, cleaner card design |
| **Performance** | Game detection removed, lower CPU usage |
| **Code** | ~800+ lines removed |
| **Stability** | Fewer background processes |

---

**Version:** 5.0.0  
**Date:** 2026-01-26  
**Developer:** MuratGuelr
