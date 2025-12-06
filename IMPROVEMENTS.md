# Netrex - Code Review & Improvement Suggestions

> **Önemli Kısıtlamalar:**
> - Firebase ücretsiz plan sınırlarını aşmamak (Firestore okuma/yazma, Authentication)
> - LiveKit Cloud ücretsiz plan sınırlarını aşmamak (bandwidth, participant limits)
> - Dosya paylaşımı özelliği olmayacak (Firebase Storage ücretsiz planda yetersiz)
> - Ana odak: Sesli iletişim ve metin chat

---

## 🔴 Critical Issues (Fix Immediately)

### 1. Security Vulnerabilities
- **Hardcoded Admin UID**: `RoomList.js` line 14 has hardcoded `ADMIN_UID = "BURAYA_KENDI_FIREBASE_UID_YAZ"` - This should be:
  - Moved to environment variables
  - Or better: Use Firebase Custom Claims for role-based access (ücretsiz plan dahil)
  - Implement proper admin authentication

- **No Input Validation**: 
  - Room/channel names can be empty, too long, or contain malicious content
  - Message text not sanitized (XSS risk)
  - Add validation: max length, allowed characters, trim whitespace
  - **Önemli**: Uzun mesajlar Firestore kullanımını artırır, limit koyun (max 2000 karakter)

- **Missing Rate Limiting**:
  - No protection against spam (message sending, room creation)
  - **Kritik**: Spam Firestore okuma/yazma limitlerini aşabilir
  - Add client-side rate limiting (mesaj başına 2-3 saniye)
  - Firestore Security Rules ile server-side rate limiting

- **CSP (Content Security Policy)**: 
  - Current CSP in `main.js` line 375 is too permissive (`'unsafe-inline' 'unsafe-eval'`)
  - Tighten CSP for production

### 2. Error Handling
- **No Global Error Boundary**: Add React Error Boundary to catch crashes
- **Silent Failures**: Many errors are only logged to console
- **No Retry Logic**: Network failures should retry with exponential backoff
- **No Offline Handling**: App doesn't handle network disconnections gracefully
  - **Önemli**: Offline durumda gereksiz Firestore okuma işlemleri yapmayın

### 3. Firebase & LiveKit Cost Optimization (CRITICAL)

#### Firebase Firestore Optimizations
- **Polling Instead of Real-time**: `RoomList.js` line 54 uses 5-second polling for text channels
  - **SORUN**: Her 5 saniyede bir Firestore okuma = 720 okuma/saat/kullanıcı
  - **ÇÖZÜM**: `onSnapshot` kullanın (tek bağlantı, sadece değişikliklerde okuma)
  - **Not**: `onSnapshot` ücretsiz planda sınırsız, polling ise okuma limitini hızla tüketir

- **Message Storage Optimization**:
  - Şu an tüm mesajlar tek bir array'de (`messages: arrayUnion(message)`)
  - **SORUN**: Her mesaj gönderiminde tüm array okunuyor/yazılıyor
  - **ÇÖZÜM**: Mesajları subcollection'lara taşıyın (`text_channels/{channelId}/messages/{messageId}`)
  - Bu sayede sadece yeni mesajlar okunur, tüm array değil

- **Unnecessary Reads**:
  - `loadChannelMessages` her seferinde tüm kanalı okuyor
  - Mesaj pagination ekleyin (son 50 mesaj, scroll'da daha fazla yükle)
  - Kullanılmayan kanalları dinlemeyin

- **Race Conditions**: Message sending updates local state before Firestore confirmation
  - Optimistic updates kullanın ama Firestore başarısız olursa geri alın

#### LiveKit Cloud Optimizations
- **Connection Management**:
  - Kullanılmayan odalardan hemen ayrılın (cleanup)
  - Auto-reconnect logic ekleyin ama exponential backoff ile
  - Participant limit kontrolü ekleyin (ücretsiz plan: ~25 participant)

- **Bandwidth Optimization**:
  - Audio quality ayarları ekleyin (düşük kalite = daha az bandwidth)
  - Sadece aktif konuşanları dinleyin (mute olanları unsubscribe edin)
  - Background'da oda bağlantısını kesin (window minimize)

---

## 🟠 High Priority Improvements

### 4. Performance Optimizations
- **No Code Splitting**: All components load upfront
  - Implement dynamic imports for heavy components (SettingsModal, ActiveRoom)
- **No Memoization**: Expensive computations re-run on every render
  - Use `useMemo` for filtered lists, `useCallback` for event handlers
- **Bundle Size**: Large dependencies loaded synchronously
  - Consider lazy loading LiveKit components
- **Unnecessary Re-renders**: Some components re-render when parent state changes unnecessarily

### 5. Missing Core Features (Cost-Effective)

#### Chat Features (Firestore Optimized)
- **Message Editing**: Users can't edit sent messages
  - **Uygulama**: Sadece son 5 dakika içindeki mesajlar düzenlenebilir
  - Firestore'da sadece `updateDoc` kullanın (yeni mesaj oluşturmayın)

- **Typing Indicators**: Show when users are typing
  - **Uygulama**: LiveKit Data Channel kullanın (Firestore kullanmayın!)
  - Sadece aktif kanalda gösterin, diğer kanallarda gereksiz okuma yapmayın

- **Message Reactions**: Emoji reactions
  - **Uygulama**: Mesaj objesine `reactions: { emoji: [userId1, userId2] }` ekleyin
  - Sadece `updateDoc` ile güncelleyin, yeni document oluşturmayın

- **User Mentions**: @mention users
  - **Uygulama**: Client-side parsing, Firestore'da sadece mesaj text'inde saklayın
  - Notification için LiveKit Data Channel kullanın (Firestore değil)

- **Message Search**: Search messages in current channel
  - **Uygulama**: Client-side search (local state'te), Firestore query yapmayın
  - Sadece açık kanaldaki mesajlarda ara, tüm kanallarda değil

#### Voice Features (LiveKit Optimized)
- **Connection Quality Indicator**: Show network quality
- **Auto-reconnect**: Better reconnection logic
- **Participant Limit Warning**: Warn when approaching LiveKit limits

#### Notifications (No Firebase Cost)
- **Desktop Notifications**: 
  - Use Electron's native `Notification` API (ücretsiz)
  - Sadece mention ve DM için bildirim gönderin
  - Kullanıcı odadayken bildirim göstermeyin

### 6. User Experience
- **No Loading States**: Some operations show no feedback
- **No Optimistic Updates**: UI doesn't update immediately for better perceived performance
- **No Keyboard Shortcuts Documentation**: Users don't know available shortcuts
- **Inconsistent Confirmations**: Some destructive actions have confirmations, others don't
- **No Undo/Redo**: Can't undo message deletion (client-side, Firestore kullanmayın)
- **Local Search Only**: Search only in loaded messages (no Firestore queries)

---

## 🟡 Medium Priority Improvements

### 7. Code Quality
- **No TypeScript**: Add TypeScript for type safety
- **Mixed Languages**: Code has Turkish comments/strings mixed with English
  - Consider i18n (internationalization) library (client-side only, no server cost)
- **Duplicate Code**: Some logic repeated across components
  - Extract to custom hooks or utilities
- **Missing PropTypes/Type Checking**: No runtime type validation
- **Magic Numbers**: Hardcoded values (e.g., `300000` in ChatView.js line 186)
  - Extract to constants file

### 8. Additional Features (Cost-Conscious)

#### User Profiles (Minimal Firestore Usage)
- **Basic Profile**: 
  - Display name, avatar (emoji/initials only, no image upload)
  - Status message (max 100 chars, Firestore'da sakla)
  - **NOT**: Custom avatar images (Firebase Storage kullanmayın)

- **User Presence**: 
  - Online/Offline status
  - **Uygulama**: LiveKit participant metadata kullanın (Firestore değil)
  - Sadece aktif odadaki kullanıcıları gösterin

#### Room/Channel Management (Firestore Optimized)
- **Channel Descriptions**: 
  - Max 200 karakter, sadece kanal oluşturulurken yaz
  - Edit sırasında sadece `updateDoc` kullan

- **Message Limits**: 
  - Kanal başına max 1000 mesaj (eski mesajları otomatik sil)
  - Veya mesajları subcollection'lara taşıyın ve pagination yapın

#### Message Formatting (Client-Side Only)
- **Markdown Support**: 
  - Client-side parsing (marked.js veya benzeri)
  - Firestore'da sadece raw text saklayın, rendering client-side

- **Emoji Picker**: 
  - Client-side emoji library (emoji-mart veya benzeri)
  - Emoji'leri Unicode olarak saklayın (Firestore'da text)

- **Link Previews**: 
  - **NOT**: Server-side link preview (ekstra API maliyeti)
  - Sadece link'i tıklanabilir yapın, preview göstermeyin

#### Themes (No Cost)
- **Dark/Light Theme**: 
  - LocalStorage'da sakla (Firestore kullanmayın)
  - CSS variables ile implement et

#### Accessibility (No Cost)
- **ARIA Labels**: Add accessibility attributes
- **Keyboard Navigation**: Tab order, shortcuts
- **Screen Reader Support**: Semantic HTML
- **Focus Management**: Proper focus handling

### 9. Testing & Quality Assurance
- **No Tests**: Add unit tests (Jest), integration tests, E2E tests (Playwright)
- **No CI/CD**: Set up GitHub Actions for automated testing and building
- **No Linting**: Add ESLint with strict rules
- **No Prettier**: Add code formatting

### 10. Monitoring & Analytics (Free Options)
- **Error Tracking**: 
  - **Ücretsiz Seçenekler**: Sentry free tier (5000 events/month) veya client-side logging
  - Sadece kritik hataları logla, her şeyi değil

- **Analytics**: 
  - **Ücretsiz Seçenekler**: Plausible (self-hosted) veya client-side event tracking
  - Anonymized, minimal data collection

- **Logging**: 
  - Client-side structured logging (console with levels)
  - Production'da sadece error ve warn logları

---

## 🟢 Nice-to-Have Features (If Within Free Limits)

### 11. Advanced Features (Cost-Conscious)
- **Voice Effects**: 
  - Client-side audio processing (Web Audio API)
  - LiveKit'te audio filter kullan (server-side, ücretsiz planda mevcut)

- **Message Threading**: 
  - Reply to specific messages
  - **Uygulama**: Mesaj objesine `replyTo: messageId` ekle
  - Firestore'da sadece reference sakla, thread'i client-side render et

- **Keyboard Shortcuts**: 
  - Expand existing hotkey system
  - Add shortcuts for common actions (mute, deafen, send message)

### 12. Developer Experience
- **Documentation**: 
  - README with setup instructions
  - API documentation
  - Firebase/LiveKit cost optimization guide

- **Development Tools**:
  - React DevTools integration
  - Performance profiling tools
  - Firestore usage monitor (development only)

---

## 📋 Specific Code Improvements

### `app/page.js`
- Line 138: Use proper error handling instead of `alert()`
- Extract login form to separate component
- Add loading states for async operations

### `src/components/ActiveRoom.js`
- [x] Line 79-87: Audio detection could be optimized (throttle/debounce)
- Extract `ParticipantList` and `UserCard` to separate files
- Add error boundaries around LiveKit components
- **Optimize**: Sadece aktif konuşanları render et, diğerlerini lazy load

### `src/components/ChatView.js`
- Line 186: Magic number `300000` should be a constant (`MESSAGE_SEQUENCE_THRESHOLD = 5 * 60 * 1000`)
- Add message editing functionality (son 5 dakika)
- Implement virtual scrolling for large message lists (react-window)
- **Optimize**: Mesajları pagination ile yükle (son 50, scroll'da daha fazla)

### `src/components/RoomList.js`
- Line 14: Remove hardcoded ADMIN_UID (environment variable veya Firebase Custom Claims)
- Line 54: **CRITICAL** - Replace polling with Firestore `onSnapshot` listener
  - Bu değişiklik Firestore okuma limitini %95 azaltacak
- Add room search/filter functionality (client-side only)

### `src/store/chatStore.js`
- **CRITICAL**: Mesajları subcollection'a taşıyın
  - `text_channels/{channelId}/messages/{messageId}` yapısına geçin
  - Bu sayede sadece yeni mesajlar okunur, tüm array değil
- Add optimistic updates for messages
- Implement message pagination (load older messages on scroll)
- Add message caching strategy (localStorage, sadece son 100 mesaj)

### `electron/main.js`
- Line 375: Tighten CSP policy
- Add auto-updater functionality (electron-updater, ücretsiz)
- Implement crash reporting (minimal, sadece kritik hatalar)
- Add app menu with keyboard shortcuts

### `package.json`
- Add scripts for testing, linting, formatting
- Consider adding `husky` for pre-commit hooks
- Add `engines` field to specify Node version

---

## 🎯 Recommended Implementation Order (Cost-Optimized)

1. **Week 1**: 
   - **CRITICAL**: Firestore polling → `onSnapshot` migration (huge cost savings)
   - Security fixes (admin UID, input validation, CSP)
   - Message storage optimization (subcollection structure)

2. **Week 2**: 
   - Error handling (error boundaries, retry logic, offline handling)
   - Message pagination (reduce Firestore reads)

3. **Week 3**: 
   - Performance (code splitting, memoization)
   - Typing indicators via LiveKit Data Channel (no Firestore cost)

4. **Week 4**: 
   - Core features (notifications, message editing, reactions)
   - All features should use LiveKit Data Channel when possible

5. **Week 5**: 
   - UX improvements (loading states, optimistic updates, local search)
   - Client-side features only (no additional Firestore costs)

6. **Week 6**: 
   - Code quality (TypeScript migration, testing setup)
   - Documentation

7. **Week 7+**: 
   - Advanced features based on user feedback
   - Monitor Firebase/LiveKit usage and optimize further

---

## 🔧 Quick Wins (Can implement immediately, no cost)

1. Replace `alert()` with proper toast notifications (client-side)
2. Add loading spinners to async operations
3. Extract magic numbers to constants
4. Add PropTypes or TypeScript types
5. Implement local message search (client-side only)
6. Add keyboard shortcut help modal
7. Improve error messages (user-friendly)
8. Add confirmation dialogs for all destructive actions
9. Implement optimistic UI updates
10. Add retry buttons for failed operations
11. **CRITICAL**: Replace polling with `onSnapshot` (huge Firestore cost savings)

---

## 📚 Recommended Libraries/Tools (Free Tier Friendly)

- **Notifications**: Native Electron `Notification` API (free)
- **Toast Messages**: `react-hot-toast` or `sonner` (client-side, free)
- **Form Validation**: `zod` (client-side validation, free)
- **i18n**: `react-i18next` (client-side, free)
- **Testing**: `Jest` + `React Testing Library` (free, open source)
- **Error Tracking**: Sentry free tier (5000 events/month) veya client-side logging
- **Analytics**: Plausible self-hosted (free) veya minimal client-side tracking
- **Code Quality**: `ESLint` + `Prettier` + `Husky` (all free)
- **Type Safety**: Migrate to TypeScript gradually (free)
- **Virtual Scrolling**: `react-window` (free, reduces DOM nodes)
- **Markdown**: `marked` (client-side, free)
- **Emoji**: `emoji-mart` (client-side, free)

---

## 🎨 UI/UX Enhancements (No Cost)

- Add smooth transitions/animations (CSS)
- Implement skeleton loaders instead of spinners
- Add tooltips for all icon buttons
- Add keyboard navigation (Tab order, shortcuts)
- Improve color contrast for accessibility
- **NOT**: Drag-and-drop file uploads (Firebase Storage kullanmayın)

---

## 🔐 Security Checklist

- [ ] Move admin UID to environment variable or Firebase Custom Claims
- [ ] Add input validation and sanitization
- [ ] Implement rate limiting (client-side + Firestore Security Rules)
- [ ] Tighten CSP policy
- [ ] Sanitize user-generated content (XSS protection)
- [ ] Implement proper authentication checks
- [ ] Add message length limits (max 2000 chars to save Firestore space)
- [ ] Use HTTPS/WSS for all connections

---

## 💰 Cost Optimization Checklist

### Firebase Firestore
- [x] Replace polling with `onSnapshot` listeners (CRITICAL)
- [x] Move messages to subcollections (reduce read/write costs)
- [ ] Implement message pagination (load only last 50 messages)
- [ ] Add message limits per channel (auto-delete old messages)
- [ ] Use client-side search only (no Firestore queries)
- [ ] Minimize metadata updates (only update when necessary)
- [ ] Cache frequently accessed data (localStorage)
- [ ] Use Firestore Security Rules for rate limiting

### LiveKit Cloud
- [ ] Implement participant limit checks
- [ ] Auto-disconnect from unused rooms
- [ ] Optimize audio quality settings
- [ ] Unsubscribe from muted participants
- [ ] Disconnect when window minimized (optional)
- [ ] Use Data Channel for non-critical data (typing indicators, presence)

### General
- [ ] Monitor usage daily (Firebase Console, LiveKit Dashboard)
- [ ] Set up alerts for approaching limits
- [ ] Use client-side features when possible
- [ ] Minimize server-side operations
- [ ] Cache everything possible (localStorage, IndexedDB)

---

## 📊 Performance Checklist

- [x] Implement code splitting
- [x] Add lazy loading for heavy components
- [ ] Implement virtual scrolling for long message lists
- [ ] Add memoization where needed
- [ ] Reduce bundle size
- [ ] Optimize re-renders
- [ ] Implement message pagination
- [ ] Add connection quality indicators
- [x] Optimize audio processing (throttle/debounce)

---

## 🚫 Features NOT to Implement (Cost Reasons)

- ❌ File/image upload (Firebase Storage ücretsiz planda yetersiz)
- ❌ Screen sharing (LiveKit Cloud ücretsiz planda bandwidth limiti)
- ❌ Video calls (bandwidth maliyeti çok yüksek)
- ❌ Server-side link previews (API maliyeti)
- ❌ Custom avatar images (Firebase Storage)
- ❌ Message history backup (Firestore storage limiti)
- ❌ Analytics with external services (maliyet)
- ❌ Cloud functions (Firebase Functions ücretsiz planda sınırlı)

---

## 📈 Monitoring & Alerts

### Firebase Usage Tracking
- Daily Firestore read/write counts
- Authentication usage
- Storage usage (if any)
- Set up Firebase Console alerts at 80% of free tier limits

### LiveKit Usage Tracking
- Daily participant minutes
- Bandwidth usage
- Set up LiveKit Dashboard alerts at 80% of free tier limits

### Client-Side Monitoring
- Track message send frequency (prevent spam)
- Monitor connection quality
- Log errors (client-side only, no server cost)

---

This document prioritizes cost-effective improvements that stay within Firebase and LiveKit free tier limits while enhancing the core voice chat and messaging experience.
