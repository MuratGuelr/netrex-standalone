# 02 — Rakip Karşılaştırması

## Netrex vs Rakipler — Özellik Matrisi

| Özellik | Netrex | Discord | TeamSpeak | Mumble | Revolt |
|---------|--------|---------|-----------|--------|--------|
| **Sesli Sohbet** | ✅ LiveKit | ✅ Proprietary | ✅ Opus | ✅ Opus | ✅ Vortex |
| **Metin Sohbet** | ✅ Firestore | ✅ | ✅ (v5+) | ❌ | ✅ |
| **Video Görüşme** | ⚠️ Sadece kamera | ✅ Tam | ❌ | ❌ | ⚠️ Kısıtlı |
| **Ekran Paylaşımı** | ❌ | ✅ | ✅ (v5+) | ❌ | ⚠️ Beta |
| **Sunucu Sistemi** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Rol/İzin Sistemi** | ⚠️ Temel (owner) | ✅ Gelişmiş | ✅ Gelişmiş | ✅ ACL | ✅ |
| **DM Sistemi** | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Arkadaşlık** | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Watch Party** | ✅ YouTube | ✅ Activity | ❌ | ❌ | ❌ |
| **Pointer Sharing** | ✅ Benzersiz | ❌ | ❌ | ❌ | ❌ |
| **Bot Sistemi** | ❌ | ✅ Zengin | ✅ Plugin | ✅ Plugin | ✅ |
| **E2E Şifreleme** | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Self-Host** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Gürültü Bastırma** | ✅ RNNoise/Krisp | ✅ Krisp | ✅ Temel | ✅ RNNoise | ❌ |
| **Game Overlay** | ✅ Voice Overlay | ✅ | ✅ | ✅ Positional | ❌ |
| **Bildirimler** | ✅ + TTS | ✅ | ✅ | ✅ | ✅ |
| **Tepki/Emoji** | ✅ Temel | ✅ Custom | ❌ | ❌ | ✅ Custom |
| **Mesaj Düzenleme** | ✅ (5dk limit) | ✅ (sınırsız) | ❌ | ❌ | ✅ |
| **Dosya Paylaşımı** | ✅ Cloudinary | ✅ CDN | ❌ | ❌ | ✅ |
| **Tema/Özelleştirme** | ✅ NDS | ⚠️ Sınırlı | ✅ | ❌ | ✅ |
| **Mobil Uygulama** | ❌ | ✅ | ✅ | ✅ | ⚠️ PWA |

## Netrex'in Rekabet Avantajları

### 1. Watch Party (YouTube Birlikte İzleme)
Discord'un "Activity" özelliğine alternatif. Senkronize video oynatma, co-host sistemi, oy verme mekanizması. **Hiçbir rakipte bu kalitede yok.**

### 2. Pointer Sharing (İmleç Paylaşımı)
Tamamen benzersiz özellik. Overlay penceresiyle ekranda gerçek zamanlı imleç görüntüleme. Eğitim, teknik destek ve birlikte çalışma için çok değerli.

### 3. Quick Status Sistemi
Hotkey ile anlık durum mesajları (🚽 Lavabodayım, ⏰ 5dk geliyorum). Discord'da benzer özellik yok — kullanıcılar bunu manuel custom status ile yapmak zorunda.

### 4. Gelişmiş Ses İşleme Modları
3 kademeli ses işleme: None → Standard → Krisp (RNNoise AI). Discord'un Krisp entegrasyonuna benzer ama kullanıcıya daha fazla kontrol veriyor.

### 5. Voice Overlay (Oyun İçi)
Anti-cheat uyumlu oyun içi ses overlay'i. Pozisyon preset'leri ve özelleştirme. TeamSpeak seviyesinde profesyonel.

## Netrex'in Zayıf Kaldığı Alanlar

### 🔴 Kritik Eksikler

| Eksik | Rakiplerdeki Durum | Öncelik |
|-------|-------------------|---------|
| **Ekran Paylaşımı** | Discord, TS5 standart | P0 |
| **Rol/İzin Sistemi** | Discord detaylı, 30+ izin | P1 |
| **Bot/Plugin API** | Discord, TS, Mumble hepsinde var | P1 |
| **Mobil Uygulama** | Tüm büyük rakiplerde var | P2 |
| **Arama Fonksiyonu** | Discord mesaj arama | P2 |

### 🟡 Önemli Eksikler

| Eksik | Açıklama | Öncelik |
|-------|----------|---------|
| Thread/Forum kanalları | Discord'un en çok kullanılan özelliklerinden | P2 |
| Sesli kanal kullanıcı limiti | Discord'da standart | P2 |
| Webhook desteği | Harici entegrasyon için gerekli | P3 |
| Sunucu keşfet | Yeni kullanıcı kazanımı için kritik | P3 |
| Nitro benzeri premium | Gelir modeli için | P3 |

## Sonuç

Netrex, Discord'un temel özelliklerinin **~%65-70'ini** karşılıyor. Watch Party ve Pointer Sharing gibi benzersiz özellikleriyle **niş bir avantaj** sunuyor. Ancak ekran paylaşımı, gelişmiş izin sistemi ve bot API'si olmadan mainstream adoption zor. **Öncelik: Ekran paylaşımı → İzin sistemi → Bot API.**
