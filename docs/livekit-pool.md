# 🔄 LiveKit Sunucu Havuzu Sistemi

## Neden Gerekli?

LiveKit ücretsiz tier'da **dakika sınırı** var. Bu sınır aşıldığında bağlantı hataları oluşuyor. 

**Çözüm:** Birden fazla ücretsiz LiveKit hesabı kullanarak sınırı aşmak.

---

## Nasıl Çalışır?

1. **Birden fazla LiveKit sunucusu** tanımlarsınız (her biri ayrı bir ücretsiz hesap)
2. **Firebase'de aktif sunucu** takip edilir
3. **Dakika bittiğinde** otomatik olarak sonraki sunucuya geçilir
4. **Tüm kullanıcılar** Firebase sayesinde aynı sunucuya yönlendirilir

---

## Yapılandırma

### 1. Birden Fazla LiveKit Hesabı Açın

1. [LiveKit Cloud](https://cloud.livekit.io/) adresine gidin
2. Farklı e-posta adresleriyle ücretsiz hesaplar oluşturun
3. Her hesapta bir proje oluşturun
4. API Key ve Secret'ları not edin

### 2. .env.local Dosyasını Düzenleyin

```bash
# Sunucu 0 (Ana sunucu)
LIVEKIT_SERVERS_0_URL=wss://netrex-server1.livekit.cloud
LIVEKIT_SERVERS_0_KEY=APIdgdfgdfgdfg
LIVEKIT_SERVERS_0_SECRET=secretkey123123

# Sunucu 1
LIVEKIT_SERVERS_1_URL=wss://netrex-server2.livekit.cloud
LIVEKIT_SERVERS_1_KEY=APIdgdfgdfgdfg2
LIVEKIT_SERVERS_1_SECRET=secretkey456456

# Sunucu 2
LIVEKIT_SERVERS_2_URL=wss://netrex-server3.livekit.cloud
LIVEKIT_SERVERS_2_KEY=APIdgdfgdfgdfg3
LIVEKIT_SERVERS_2_SECRET=secretkey789789

# ... istediğiniz kadar ekleyebilirsiniz (max 20)
```

### 3. Firebase'de Pool Başlatılacak (Otomatik)

Uygulama ilk çalıştığında Firebase'de şu yapı oluşturulur:

```
/system/livekitPool
{
  activeServerIndex: 0,
  lastRotation: timestamp,
  serverCount: 3
}
```

---

## Otomatik Geçiş

Sistem şu hataları algıladığında otomatik olarak sonraki sunucuya geçer:

- `quota exceeded`
- `rate limit`
- `connection limit`
- `participant limit`
- `minutes exceeded`
- Bağlantı timeout'ları

---

## Manuel Geçiş

Gerekirse kod üzerinden manuel geçiş yapabilirsiniz:

```javascript
import { rotateServer } from '@/src/utils/livekitPool';

// Sonraki sunucuya geç
await rotateServer('manual rotation');
```

---

## Dikkat Edilmesi Gerekenler

1. **Tüm sunucular aynı anda aktif olmalı** - Sunucu down olursa geçiş yapılır
2. **Firebase realtime güncelleme** - Sunucu değiştiğinde tüm clientlar bilgilendirilir
3. **Token'lar sunucuya özgü** - Her sunucu için ayrı token oluşturulur

---

## Önerilen Sunucu Sayısı

| Kullanıcı Sayısı | Önerilen Sunucu |
|-----------------|-----------------|
| 1-10 | 2-3 sunucu |
| 10-50 | 5-7 sunucu |
| 50-100+ | 10-15 sunucu |

---

## Sorun Giderme

### Sunucu değişmiyor
- Firebase'de `/system/livekitPool` dokümanını kontrol edin
- Console'da "LiveKit server rotated" log'unu arayın

### Tüm sunucular dolu
- Sistem en başa döner (index 0)
- Birkaç saat sonra dakikalar sıfırlanır

### Bağlantı hataları devam ediyor
- Sunucu URL'lerinin doğru olduğundan emin olun
- API Key/Secret'ların doğru eşleştiğinden emin olun

---

**Sürüm:** v5.2  
**Tarih:** 2026-01-26
