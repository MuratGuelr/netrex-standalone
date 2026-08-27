# 06 — Edge Caseler

## EDGE-001: Çift Pencere / Çift Instance
- **Dosya:** `electron/main.js`
- **Sorun:** `app.requestSingleInstanceLock()` kullanılıyor mu kontrol edilmeli. İkinci instance açılırsa Firestore listener'lar çift çalışır, presence durumu tutarsız olur.
- **Senaryo:** Kullanıcı kısayoldan iki kez tıklar → iki pencere → iki onSnapshot → race condition.

---

## EDGE-002: Offline Mode Davranışı
- **Sorun:** Firestore offline cache modu aktif değilse, internet kesildiğinde uygulama tamamen kilitlenir. `onSnapshot` listener'lar hata fırlatır ama recovery mekanizması yok.
- **Senaryo:** Kullanıcı WiFi kaybeder → tüm listener'lar hata → UI donmuş görünür.
- **Çözüm:** `enablePersistence()` + offline state göstergesi + retry mekanizması.

---

## EDGE-003: Auth Token Expire
- **Sorun:** Firebase Auth token'ı expire olduğunda (1 saat), yenileme otomatik ama Firestore listener'lar bazen `permission-denied` hatası verebilir. Bu durumda listener'lar yeniden başlatılmıyor.
- **Senaryo:** Kullanıcı uygulamayı 2+ saat açık bırakır → token expire → listener hataları.

---

## EDGE-004: Anlık Server/Kanal Silme
- **Dosya:** `src/store/chatStore.js:196-230`
- **Sorun:** Kullanıcı bir kanalda mesaj yazarken, başka biri o kanalı silerse → `loadChannelMessages` "Kanal bulunamadı" hatası verir ama mesaj input'u hâlâ açık kalır.
- **Senaryo:** Kullanıcı A siliyor → Kullanıcı B mesaj gönderiyor → Firestore hata.

---

## EDGE-005: Eşzamanlı Kanal Değiştirme
- **Dosya:** `app/page.js:722-729`
- **Sorun:** Kullanıcı çok hızlı kanal değiştirirse, `loadChannelMessages` async çağrıları birbiriyle yarışır. İlk kanalın mesajları sonra yüklenir ve yanlış kanalda gösterilir.
- **Çözüm:** AbortController veya channel ID doğrulama ile eski request'leri iptal et.

---

## EDGE-006: Watch Party Host Disconnect
- **Sorun:** Host aniden bağlantıyı kaybederse (crash/internet), Watch Party durumu Firestore'da `isActive: true` kalır. Diğer kullanıcılar "aktif" bir partiye bağlı kalır ama kontrol edemez.
- **Çözüm:** Host heartbeat mekanizması + timeout sonrası otomatik co-host devri veya party sonlandırma.

---

## EDGE-007: DM Arama Timeout
- **Dosya:** `app/page.js:334-354`
- **Sorun:** Çağrı 60 saniye sonra timeout oluyor ama sadece arayan tarafta. Aranan tarafta `ringing` statüsü Firestore'da kalabilir eğer arayan timeout polling'i çalışmadan crash olursa.
- **Çözüm:** Server-side TTL veya Firestore Cloud Function ile otomatik temizleme.

---

## EDGE-008: localStorage Taşması
- **Sorun:** `settingsStore` ve `watchPartyStore` localStorage'a persist yapıyor. `userVolumes` objesi sınırsız büyüyebilir (her kullanıcı için volume kaydedilir). Server icon'ları base64 olarak saklanıyorsa, localStorage 5MB limitine çarpabilir.
- **Sonuç:** `QuotaExceededError` → tüm persist state kaybı.
- **Çözüm:** IndexedDB'ye geçiş veya eski verileri temizleyen LRU politikası.

---

## EDGE-009: React 19 RC Riski
- **Sorun:** React 19 hâlâ RC aşamasında. Breaking change'ler olabilir. Üretim uygulamasında RC kullanmak risk.
- **Çözüm:** Stable release beklenip geçiş yapılmalı veya en azından versiyon sabitlenmeli.
