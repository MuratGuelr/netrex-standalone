# 07 — Eksik Özellikler

## Tier 1 — Kritik Eksikler (Rakiplerde Standart)

### 1. Ekran Paylaşımı
- **Durum:** Hiç yok
- **Rakip:** Discord, TeamSpeak 5, Guilded hepsinde standart
- **Önem:** Kullanıcıların %40+'ı bu özelliği aktif kullanıyor
- **Gerekli:** LiveKit `LocalVideoTrack.createScreenShareTrack()` + UI

### 2. Gelişmiş Rol ve İzin Sistemi
- **Durum:** Sadece "owner" kontrolü var
- **Rakip:** Discord 30+ izin, hiyerarşik roller
- **Önem:** 10+ kişilik sunucularda moderasyon imkansız
- **Gerekli:** Role CRUD, izin bitfield sistemi, kanal bazlı override

### 3. Mesaj Arama
- **Durum:** Yok
- **Rakip:** Discord, Slack gelişmiş arama
- **Önem:** Eski mesajlara ulaşmak imkansız
- **Gerekli:** Full-text search index (Algolia/Typesense)

### 4. Sunucu Davet Sistemi
- **Durum:** Var ama temel
- **Rakip:** Discord vanity URL, expire süresi, kullanım limiti
- **Gerekli:** Davet linkleri için TTL, max kullanım, izleme

---

## Tier 2 — Önemli Eksikler

### 5. Thread / Forum Kanalları
- Discord'un en aktif kullanılan özelliklerinden biri. Organize tartışma için kritik.

### 6. Sesli Kanal Kullanıcı Limiti
- Şu an herhangi bir ses kanalına sınırsız kullanıcı katılabilir. Performans ve organizasyon için limit gerekli.

### 7. Slowmode
- Spam kontrolü için kanal bazlı mesaj hız limiti. Mevcut spam koruması global, kanal bazlı değil.

### 8. Mesaj Pinleme
- Önemli mesajları sabitlemek için. Discord'da temel özellik.

### 9. Kullanıcı Banlama (Sunucu Bazlı)
- Şu an sadece arkadaşlık bazlı engelleme var. Sunucu bazlı ban/kick yok.

### 10. Webhook / Bot API
- Harici entegrasyon imkanı yok. Bildirim, otomasyon, bot sistemi için gerekli.

---

## Tier 3 — İleri Seviye

### 11. Mobil Uygulama
- React Native veya Capacitor ile cross-platform. Zustand store'lar paylaşılabilir.

### 12. Sunucu Keşfet (Discovery)
- Yeni kullanıcı kazanımı için public sunucu listesi.

### 13. Stage Channel (Sahne Kanalı)
- Konuşmacı/dinleyici ayrımı olan kanal tipi. Etkinlik/toplantı için.

### 14. Scheduled Events
- Planlı etkinlik sistemi. Takvim entegrasyonu.

### 15. E2E Şifreleme
- Mumble'ın en büyük avantajı. Gizlilik odaklı kullanıcılar için gerekli.
