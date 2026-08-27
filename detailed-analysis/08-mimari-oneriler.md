# 08 — Mimari Öneriler

## ARCH-001: page.js Decomposition
- **Sorun:** `app/page.js` 919 satır, 15+ state hook, 10+ effect. Single Responsibility ihlali.
- **Öneri:**
```
app/page.js (shell only)
├── hooks/useCallManager.js      → Çağrı state + timeout + cleanup
├── hooks/useNotifications.js    → DM, arkadaş, kabul bildirimleri
├── hooks/useRoomManager.js      → currentRoom, channel switch logic
├── hooks/useGracefulShutdown.js → IPC exit cleanup
└── components/MainRouter.jsx    → friendsMode / server / welcome routing
```

---

## ARCH-002: Store Arası Bağımlılık Temizleme
- **Sorun:** `dmStore.selectConversation` içinde `require("authStore")` kullanımı. `page.js`'te store'lar arası doğrudan `.getState()` çağrıları.
- **Öneri:** Event-driven pattern. Store'lar birbirini dinlesin:
```js
// authStore logout event'i
useAuthStore.subscribe((state) => {
  if (!state.user) {
    useDMStore.getState().reset();
    useFriendStore.getState().reset();
    useChatStore.getState().clearCurrentChannel();
  }
});
```

---

## ARCH-003: API Layer Ekleme
- **Sorun:** Store'lar doğrudan Firestore SDK çağırıyor. Test edilemez, mock'lanamaz.
- **Öneri:**
```
src/api/
├── chatApi.js        → Firestore chat CRUD
├── dmApi.js          → Firestore DM CRUD  
├── serverApi.js      → Firestore server CRUD
├── userApi.js        → Firestore user CRUD
└── livekitApi.js     → LiveKit token + room
```
Store'lar sadece API layer'ı çağırsın. Test'te API mock'lanabilir.

---

## ARCH-004: Error Boundary Sistemi
- **Sorun:** React Error Boundary yok. Bir component crash ederse tüm uygulama beyaz ekran gösterir.
- **Öneri:**
```jsx
<ErrorBoundary fallback={<CrashRecovery />}>
  <AppShell>...</AppShell>
</ErrorBoundary>
```
Alt bölümler için de granüler error boundary'ler:
- `<ChatErrorBoundary>` → Chat crash ederse sadece chat paneli "hata" göstersin
- `<VoiceErrorBoundary>` → Voice crash ederse yeniden bağlan butonu

---

## ARCH-005: Listener Lifecycle Manager
- **Sorun:** Her store kendi listener'larını yönetiyor. Start/stop çağrıları `page.js`'te dağınık.
- **Öneri:** Merkezi listener yöneticisi:
```js
class ListenerManager {
  listeners = new Map();
  
  register(key, startFn, stopFn) { ... }
  startAll(userId) { ... }
  stopAll() { ... }
  restart(key) { ... }
}
```

---

## ARCH-006: Offline-First Architecture
- **Sorun:** Internet kesildiğinde uygulama çalışmaz. Firestore offline persistence aktif değil.
- **Öneri:**
  1. `enableIndexedDbPersistence(db)` aktif et
  2. Bağlantı durumu göstergesi (header'da)
  3. Offline queue: Mesajlar local'de beklesin, internet gelince gönderilsin
  4. Optimistic UI: Tüm aksiyonlar anında UI'da yansısın

---

## ARCH-007: Test Altyapısı
- **Sorun:** Sıfır test coverage. Hiç test dosyası yok.
- **Öneri:**
```
__tests__/
├── stores/
│   ├── authStore.test.js
│   ├── chatStore.test.js
│   └── dmStore.test.js
├── components/
│   └── ActiveRoom.test.jsx
└── e2e/
    └── login.spec.ts  (Playwright)
```
- Öncelik: Store unit test'leri → Component test'leri → E2E
