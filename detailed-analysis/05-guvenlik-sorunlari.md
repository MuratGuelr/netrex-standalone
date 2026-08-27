# 05 — Güvenlik Sorunları

## SEC-001: CSP'de `unsafe-eval` (Üretim)
- **Dosya:** `electron/managers/windowManager.js:188-195`
- **Şiddet:** 🔴 Kritik
- **Sorun:** Üretim CSP header'ında `script-src` direktifinde `'unsafe-eval'` var. Bu, XSS saldırılarında `eval()`, `Function()`, `setTimeout("string")` gibi vektörlerin çalışmasına izin verir.
- **Risk:** Bir XSS açığı bulunursa, saldırgan arbitrary JavaScript çalıştırabilir.
- **Çözüm:**
```js
// ÖNCE (üretim):
"script-src 'self' 'unsafe-inline' 'unsafe-eval' file: data: blob: https: http:"

// SONRA:
"script-src 'self' 'unsafe-inline' file: data: blob: https: http:"
// Eğer eval gerekiyorsa → nonce-based CSP veya hash-based CSP
```
- **Not:** `unsafe-eval` kaldırıldığında bazı kütüphaneler bozulabilir. Test gerekli.

---

## SEC-002: Static Server Path Traversal
- **Dosya:** `electron/managers/windowManager.js:60-67`
- **Şiddet:** 🔴 Kritik
- **Sorun:** Path traversal kontrolü `path.join` sonucunun `rootDir` ile başlayıp başlamadığını kontrol ediyor. Ancak `path.join` symlink'leri ve `..` segmentlerini resolve ETMEZ — sadece string birleştirme yapar.
- **Saldırı Vektörü:**
```
GET /..%2F..%2F..%2Fetc/passwd  → decodeURIComponent sonrası ../../../etc/passwd
path.join(rootDir, "../../../etc/passwd") → rootDir dışına çıkabilir (OS'a bağlı)
```
- **Mevcut Koruma:** `filePath.startsWith(rootDir)` — Windows'ta `path.join` normalize eder ama edge case'ler var.
- **Çözüm:**
```js
const resolvedPath = path.resolve(rootDir, urlPath);
if (!resolvedPath.startsWith(path.resolve(rootDir))) {
  res.writeHead(403);
  res.end('Forbidden');
  return;
}
```

---

## SEC-003: Firestore Güvenlik Kuralları (Client-Side)
- **Şiddet:** 🟡 Orta-Yüksek
- **Sorun:** Tüm CRUD işlemleri client-side'dan direkt Firestore'a yapılıyor. Güvenlik kuralları analiz edilemiyor (server-side) ama client kodunda hiçbir server-side doğrulama yok.
- **Risk Örnekleri:**
  - Kullanıcı başka birinin mesajını silmeyi deneyebilir (client-side userId kontrolü atlanabilir)
  - `deleteTextChannel` herhangi bir kullanıcının herhangi bir kanalı silmesine izin verebilir
  - `editMessage` 5dk limitini client bypass edebilir
- **Çözüm:** Tüm write işlemlerini Firestore Security Rules ile koruma altına al.

---

## SEC-004: Cloudinary Credentials Client-Side
- **Şiddet:** 🟡 Orta
- **Sorun:** `deleteImageFromCloudinary` gibi fonksiyonlar client-side'dan Cloudinary API'sine erişiyor. API key/secret client bundle'da olabilir.
- **Çözüm:** Cloudinary işlemlerini Cloud Function'a taşı.

---

## SEC-005: LiveKit Token Generation Client-Side
- **Şiddet:** 🟡 Orta
- **Sorun:** LiveKit API key ve secret `.env.local`'da tanımlanmış ve Next.js API route üzerinden token oluşturuluyor. Static export'ta API route'lar çalışmaz — bu durumda token generation nerede?
- **Risk:** Token generation client-side'a düşerse API secret expose olur.
- **Çözüm:** Ayrı bir token server veya Cloud Function kullan.

---

## SEC-006: XSS Risk — Pointer Overlay innerHTML
- **Dosya:** `electron/managers/windowManager.js:624-629`
- **Şiddet:** 🟡 Orta
- **Sorun:** Kullanıcı isimleri `innerHTML` ile doğrudan DOM'a yazılıyor:
```js
ulist.innerHTML = data.map(p => {
  const nm = p.name || 'Kullanıcı';
  return '...' + nm + '...';  // nm sanitize edilmemiş!
}).join('');
```
- **Saldırı:** Kullanıcı adını `<img onerror=alert(1)>` yaparak overlay'de XSS tetikleyebilir.
- **Çözüm:** `textContent` kullan veya DOMPurify ile sanitize et.
