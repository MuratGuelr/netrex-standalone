# 01 — Genel Değerlendirme & Mimari Özet

## Teknoloji Yığını

| Katman | Teknoloji | Versiyon |
|--------|-----------|----------|
| Desktop Shell | Electron | 35.x |
| UI Framework | Next.js (Static Export) | 14.x |
| React | React 19 RC | 19.0.0-rc |
| State | Zustand + persist middleware | latest |
| Backend | Firebase (Firestore + Auth) | 11.x |
| Voice/Video | LiveKit (WebRTC) | latest |
| Audio Processing | Web Audio API + RNNoise WASM | Custom |
| Styling | Tailwind CSS (NDS) | 3.x |
| Hotkeys | uiohook-napi | Native |
| Packaging | electron-builder | 25.x |

## Mimari Diyagramı

```
┌──────────────────────────────────────────────┐
│              Electron Main Process            │
│  ┌──────────┐  ┌──────────┐  ┌─────────────┐│
│  │ Window   │  │ Hotkey   │  │ Static HTTP ││
│  │ Manager  │  │ Manager  │  │ Server      ││
│  └────┬─────┘  └────┬─────┘  └──────┬──────┘│
│       │             │               │        │
│       └─────────┬───┘───────────────┘        │
│            preload.js (IPC Bridge)            │
└──────────────────┬───────────────────────────┘
                   │
┌──────────────────▼───────────────────────────┐
│           Renderer (Next.js Static)           │
│  ┌─────────────────────────────────────────┐ │
│  │         Zustand Store Layer              │ │
│  │  auth │ server │ chat │ dm │ settings   │ │
│  │  friend │ watchParty │ sound │ update   │ │
│  └──────────────────┬──────────────────────┘ │
│  ┌──────────────────▼──────────────────────┐ │
│  │         Component Layer                  │ │
│  │  AppShell → ServerRail + Sidebar +       │ │
│  │  MainContent + ActiveRoom + ChatView     │ │
│  └──────────────────┬──────────────────────┘ │
│  ┌──────────────────▼──────────────────────┐ │
│  │         Service Layer                    │ │
│  │  Firebase SDK │ LiveKit SDK │ Cloudinary │ │
│  └─────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

## Güçlü Yönler

1. **Ref-based IPC Optimization** — `page.js`'te `userRef`, `currentRoomRef` ile IPC callback'ler sadece 1 kez register ediliyor. Çoğu Electron uygulaması bunu yanlış yapar.

2. **WatchParty Shallow Compare** — `watchPartyStore.setRemoteState()` fonksiyonu Firebase snapshot'larından gelen verileri alan bazında karşılaştırıyor. Gereksiz re-render'ları önleyen endüstri kalitesinde bir optimizasyon.

3. **Static HTTP Server** — `file://` protokolü yerine `localhost:17760` HTTP sunucusu. Chromium compositor idle CPU spike'ını çözen akıllıca bir karar.

4. **Zustand partialize** — `settingsStore`'da `localIsSpeaking`, `isInVoiceRoom` gibi geçici state'ler persist'ten hariç tutulmuş. Doğru yaklaşım.

5. **LiveKit Server Pool** — Ücretsiz hesap limitlerini aşmak için otomatik sunucu rotasyonu. Firebase üzerinden tüm client'ları senkronize eden yaratıcı çözüm.

6. **Store Migration** — `settingsStore` version 2 migration'ı mevcut. Şema değişikliklerinde veri kaybını önlüyor.

## Zayıf Yönler (Özet)

| Alan | Sorun | Şiddet |
|------|-------|--------|
| Güvenlik | CSP'de `unsafe-eval` üretim ortamında | 🔴 Yüksek |
| Güvenlik | Static server path traversal riski | 🔴 Yüksek |
| State | authStore username çakışması | 🟡 Orta |
| Performans | friendStore tüm kullanıcıları çekiyor | 🟡 Orta |
| Veri | DM clearConversation 500 doc limiti | 🟡 Orta |
| Bağımlılık | `"latest"` versiyonlu paketler | 🟡 Orta |

> Detaylar ilgili kategori dosyalarında.

## Puan Kartı (10 üzerinden)

| Kriter | Puan | Not |
|--------|------|-----|
| Kod Kalitesi | 8/10 | Tutarlı, iyi yorumlanmış |
| Mimari | 7.5/10 | Store ayrımı iyi, bazı coupling sorunları |
| Performans | 6.5/10 | İyi temeller, sızıntılar var |
| Güvenlik | 5/10 | Kritik CSP ve path traversal sorunları |
| UX Zenginliği | 8/10 | Watch Party, Pointer Sharing benzersiz |
| Test Coverage | 2/10 | Test dosyası yok |
| Hata Yönetimi | 6.5/10 | Çoğu yerde var, retry mekanizması eksik |
| **Genel** | **6.8/10** | İyi temel, güvenlik ve test acil |
