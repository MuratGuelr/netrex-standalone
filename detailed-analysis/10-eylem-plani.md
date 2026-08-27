# 10 — Eylem Planı

## Sprint 1: Acil Düzeltmeler (1-2 gün)

| # | Görev | Dosya | Şiddet | Tahmini |
|---|-------|-------|--------|---------|
| 1 | CSP'den `unsafe-eval` kaldır | `windowManager.js:190` | 🔴 | 30dk |
| 2 | Static server `path.resolve` düzelt | `windowManager.js:60` | 🔴 | 15dk |
| 3 | authStore username çakışması düzelt | `authStore.js` | 🟡 | 15dk |
| 4 | DM clearConversation batch chunking | `dmStore.js:649` | 🔴 | 30dk |
| 5 | Tüm `"latest"` bağımlılıkları sabitle | `package.json` | 🔴 | 20dk |
| 6 | Overlay innerHTML XSS düzelt | `windowManager.js:624` | 🟡 | 20dk |

---

## Sprint 2: Performans (2-3 gün)

| # | Görev | Dosya | Şiddet | Tahmini |
|---|-------|-------|--------|---------|
| 7 | friendStore arama optimizasyonu | `friendStore.js:233` | 🟡 | 2s |
| 8 | DM presence listener LRU cache | `dmStore.js:120` | 🟡 | 1s |
| 9 | settingsStore persist debounce | `settingsStore.js` | 🟢 | 30dk |
| 10 | page.js custom hook'lara ayırma | `app/page.js` | 🟡 | 3s |
| 11 | Message ID'yi crypto.randomUUID yap | `chatStore.js:364` | 🟢 | 10dk |

---

## Sprint 3: Stabilite (3-5 gün)

| # | Görev | Açıklama | Tahmini |
|---|-------|----------|---------|
| 12 | Offline state göstergesi | Bağlantı kesildiğinde UI bildirimi | 1s |
| 13 | React Error Boundary | Crash recovery UI | 1s |
| 14 | Kanal hızlı değişim race condition | AbortController ile eski request iptali | 1s |
| 15 | Watch Party host heartbeat | Timeout sonrası otomatik sonlandırma | 2s |
| 16 | Auth token expire recovery | Listener yeniden başlatma | 1s |

---

## Sprint 4: Özellik Geliştirme (1-2 hafta)

| # | Görev | Açıklama | Tahmini |
|---|-------|----------|---------|
| 17 | Ekran Paylaşımı | LiveKit screen share track | 3-5 gün |
| 18 | Rol/İzin sistemi v1 | Admin, Moderatör, Üye | 3-4 gün |
| 19 | Mesaj arama | Client-side basit arama başlangıç | 1-2 gün |
| 20 | Mesaj pinleme | Kanal bazlı pinned messages | 1 gün |

---

## Sprint 5: Altyapı (1-2 hafta)

| # | Görev | Açıklama | Tahmini |
|---|-------|----------|---------|
| 21 | API Layer oluştur | Store'ları Firestore'dan ayır | 3 gün |
| 22 | Store unit test'leri | authStore, chatStore, dmStore | 3 gün |
| 23 | CI/CD pipeline | Build + test + auto-publish | 2 gün |
| 24 | Firestore Security Rules audit | Tüm write kurallarını sıkılaştır | 2 gün |

---

## Öncelik Matrisi

```
         YÜKSEK ETKİ
              │
    Sprint 1  │  Sprint 4
    (Güvenlik) │  (Ekran Paylaşımı)
              │
 KOLAY ───────┼─────── ZOR
              │
    Sprint 2  │  Sprint 5
    (Performans)│ (Altyapı)
              │
         DÜŞÜK ETKİ
```

## Toplam Tahmini Süre

| Sprint | Süre | Odak |
|--------|------|------|
| Sprint 1 | 1-2 gün | 🔴 Acil güvenlik + bug fix |
| Sprint 2 | 2-3 gün | 🟡 Performans optimizasyonu |
| Sprint 3 | 3-5 gün | 🟡 Stabilite ve edge case'ler |
| Sprint 4 | 1-2 hafta | 🟢 Yeni özellikler |
| Sprint 5 | 1-2 hafta | 🟢 Teknik altyapı |
| **Toplam** | **~4-6 hafta** | **Full stabilite + temel eksik özellikler** |
