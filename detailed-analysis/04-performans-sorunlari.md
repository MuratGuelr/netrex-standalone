# 04 — Performans Sorunları

## PERF-001: friendStore Full Collection Scan
- **Dosya:** `src/store/friendStore.js:233`
- **Şiddet:** 🔴 Yüksek
- **Sorun:** `searchUsers` her çağrıda tüm `users` koleksiyonunu indiriyor.
- **Etki:** N kullanıcı = N Firestore read + N×(veri boyutu) bandwidth
- **Çözüm:** Full-text search servisi (Algolia, Meilisearch) veya Cloud Function ile server-side filtreleme.

---

## PERF-002: friendStore N+1 Query Problemi
- **Dosya:** `src/store/friendStore.js:76-123`
- **Şiddet:** 🟡 Orta
- **Sorun:** Her friendship snapshot'ında, her arkadaş için ayrı `getDoc` çağrısı yapılıyor. 50 arkadaş = 50 ayrı Firestore read.
- **Etki:** Yavaş yükleme, Firestore maliyeti.
- **Çözüm:** Firestore `getAll()` veya denormalize veri (friendship doc'a temel kullanıcı verisi ekle).

---

## PERF-003: dmStore N+1 Conversation User Fetch
- **Dosya:** `src/store/dmStore.js:83-105`
- **Şiddet:** 🟡 Orta
- **Sorun:** Her DM conversation listener tetiklendiğinde her konuşma için `getDoc` ile kullanıcı verisi çekiliyor. Presence listener zaten var ama ilk yükleme sırasında duplicate okuma yapılıyor.
- **Etki:** İlk açılışta yavaşlık, gereksiz Firestore read.
- **Çözüm:** User cache layer ekle. `users` state'indeki veriyi önce kontrol et, yoksa fetch et.

---

## PERF-004: chatStore messages Array Kopyalama
- **Dosya:** `src/store/chatStore.js:390-396, 428-436`
- **Şiddet:** 🟡 Orta
- **Sorun:** Her mesaj eklemede `[...state.messages, message]` ile tüm array kopyalanıyor. 300 mesajda bu O(n) kopyalama.
- **Etki:** Yoğun sohbetlerde GC baskısı ve mikro-gecikmeler.
- **Çözüm:** immer middleware veya en azından push + length check.

---

## PERF-005: page.js Büyük Component Dosyası
- **Dosya:** `app/page.js` (919 satır)
- **Şiddet:** 🟡 Orta
- **Sorun:** Ana sayfa tek dev component. 15+ useState, 10+ useEffect, 10+ useCallback. Her state değişiminde tüm JSX yeniden evaluate ediliyor.
- **Etki:** Gereksiz re-render'lar, bakım zorluğu.
- **Çözüm:** `useMemo` ile JSX bölümleri sarmalama veya alt component'lere ayırma.

---

## PERF-006: DM Presence Listener Birikimi
- **Dosya:** `src/store/dmStore.js:120-135`
- **Şiddet:** 🟡 Orta
- **Sorun:** `startUserPresenceListener` her yeni DM kullanıcısı için bir Firestore listener açıyor ama bunları sadece `stopListeners` ile toplu kapatıyor. Uzun session'larda 50+ aktif listener birikebilir.
- **Etki:** Firestore bağlantı limiti, bellek tüketimi.
- **Çözüm:** LRU cache ile en son görülen 20 kullanıcıya sınırla, gerisini kapat.

---

## PERF-007: settingsStore Her Toggle Persist Yazıyor
- **Dosya:** `src/store/settingsStore.js`
- **Şiddet:** 🟢 Düşük
- **Sorun:** Her toggle (mute, deaf, volume slider) anında localStorage'a persist yapıyor. Volume slider sürüklenirken saniyede 60+ yazma.
- **Çözüm:** `debounce` ile persist throttle'lama veya `partialize`'dan volume gibi sık değişen değerleri çıkarma.

---

## PERF-008: Overlay Window Inline HTML
- **Dosya:** `electron/managers/windowManager.js:332-660`
- **Şiddet:** 🟢 Düşük  
- **Sorun:** Pointer overlay HTML'i 300+ satır inline string olarak main process'te tutuluyor. Her overlay oluşturmada `encodeURIComponent` çağrısı var.
- **Çözüm:** Ayrı HTML dosyası + `loadFile()`.
