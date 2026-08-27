# 03 — Kritik Buglar

## BUG-001: authStore Anonim Username Çakışması
- **Dosya:** `src/store/authStore.js`
- **Şiddet:** 🟡 Orta
- **Açıklama:** `loginAnonymously` fonksiyonunda iki farklı random suffix üretiliyor. Biri local state'e, diğeri Firestore'a yazılıyor. Sonuç: UI'da gösterilen username ile DB'deki username farklı.
- **Etki:** Diğer kullanıcılar farklı isim görür, chat mesajlarında tutarsızlık.
- **Çözüm:**
```js
// ÖNCE: İki ayrı random
const suffix1 = Math.random().toString(36)...  // state için
const suffix2 = Math.random().toString(36)...  // firestore için

// SONRA: Tek random, her yerde kullan
const suffix = Math.random().toString(36).substring(2, 6);
const finalUsername = `${username}#${suffix}`;
// Hem state'e hem Firestore'a finalUsername yaz
```

---

## BUG-002: DM clearConversation 500 Doküman Limiti
- **Dosya:** `src/store/dmStore.js` (satır 649-684)
- **Şiddet:** 🔴 Yüksek
- **Açıklama:** `clearConversation` tüm mesajları tek bir `writeBatch` ile siliyor. Firestore batch limiti 500. 500+ mesajlı sohbetlerde çökme.
- **Hata:** `FirebaseError: Maximum 500 writes allowed per batch`
- **Çözüm:**
```js
// Chunk'lara böl
const BATCH_SIZE = 499;
const docs = snapshot.docs;
for (let i = 0; i < docs.length; i += BATCH_SIZE) {
  const chunk = docs.slice(i, i + BATCH_SIZE);
  const batch = writeBatch(db);
  chunk.forEach(d => batch.delete(d.ref));
  await batch.commit();
}
```

---

## BUG-003: friendStore Tüm Users Koleksiyonunu Çekiyor
- **Dosya:** `src/store/friendStore.js` (satır 233-234)
- **Şiddet:** 🔴 Yüksek (Ölçekte)
- **Açıklama:** `searchUsers` fonksiyonu `getDocs(usersRef)` ile TÜM kullanıcıları çekiyor, sonra client-side filtreleme yapıyor. 10.000 kullanıcıda bu çağrı hem yavaş hem pahalı.
- **Maliyet:** Her arama = N Firestore read (N = toplam kullanıcı sayısı)
- **Çözüm:** Algolia/Typesense entegrasyonu veya en azından Firestore composite index ile prefix arama.

---

## BUG-004: chatStore Message ID Çakışma Riski
- **Dosya:** `src/store/chatStore.js` (satır 364)
- **Şiddet:** 🟡 Orta
- **Açıklama:** Message ID'si `Date.now() + Math.random().toString(36).substr(2, 9)` ile üretiliyor. Aynı milisaniyede gönderilen mesajlarda (ör. bot/script) çakışma riski var.
- **Çözüm:** `crypto.randomUUID()` veya nanoid kullanmak.

---

## BUG-005: dmStore selectConversation'da require() Kullanımı
- **Dosya:** `src/store/dmStore.js` (satır 296)
- **Şiddet:** 🟡 Orta
- **Açıklama:** `selectConversation` içinde `require("@/src/store/authStore")` çağrılıyor. Bu dinamik require, bundler optimizasyonlarını bozar ve circular dependency riski yaratır.
- **Çözüm:** Fonksiyon parametresi olarak `userId` almak veya store import'u dosya başına taşımak.

---

## BUG-006: chatStore deleteTextChannel Optimistic Update Tutarsızlığı
- **Dosya:** `src/store/chatStore.js` (satır 167-191)
- **Şiddet:** 🟢 Düşük
- **Açıklama:** Kanal silme önce Firestore'dan siliyor, sonra local state güncelliyor. Firestore silme başarısız olursa UI hâlâ eski state'i gösterir. Ama bu durumda listener zaten güncelleyecek. Asıl sorun: Firestore silme başarılı olsa bile, listener tetiklenmeden önce kısa bir süre tutarsız state oluşabilir.

---

## BUG-007: WatchParty resetWatchParty receivedAt Eksik
- **Dosya:** `src/store/watchPartyStore.js` (satır 269-283)
- **Şiddet:** 🟢 Düşük
- **Açıklama:** `resetWatchParty` fonksiyonu `playbackState` içinde `receivedAt` alanını sıfırlamıyor. Bu, reset sonrası eski `receivedAt` değerinin kalmasına ve yanlış senkronizasyon hesaplamasına yol açabilir.
