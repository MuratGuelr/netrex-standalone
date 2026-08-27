# 09 — Dependency Sorunları

## DEP-001: `"latest"` Versiyonlu Paketler
- **Şiddet:** 🔴 Yüksek
- **Sorun:** `package.json`'da birçok paket `"latest"` olarak tanımlı. Bu, her `npm install`'da farklı versiyon indirileceği anlamına gelir.
- **Risk:** Breaking change ile aniden bozulan build, farklı makinelerde farklı davranış.
- **Etkilenen Paketler (kontrol edilmeli):**
  - `electron-builder`
  - `electron-updater`
  - `firebase`
  - `livekit-client`
  - `framer-motion`
  - `zustand`
- **Çözüm:** Tüm paketleri mevcut çalışan versiyona sabitle:
```json
// ÖNCE:
"firebase": "latest"
// SONRA:
"firebase": "11.2.0"
```
- **Komut:** `npm ls --depth=0` ile mevcut versiyonları al, `package.json`'a yaz.

---

## DEP-002: React 19 RC (Release Candidate)
- **Şiddet:** 🟡 Orta
- **Sorun:** `react: 19.0.0-rc` üretim uygulamasında RC kullanmak riskli. API değişiklikleri olabilir.
- **Risk:** Gelecek RC veya stable release'de breaking change.
- **Çözüm:** React 19 stable çıkana kadar 18.3.x'e dönmek veya mevcut RC versiyonunu sabitlemek.

---

## DEP-003: electron-store Deprecation Riski
- **Dosya:** `electron/managers/windowManager.js:21`
- **Şiddet:** 🟢 Düşük
- **Sorun:** `electron-store` artık bakımı azalan bir paket. Alternatifler daha aktif.
- **Çözüm:** `conf` veya native `safeStorage` + JSON file'a geçiş düşünülebilir.

---

## DEP-004: uiohook-napi Native Binding Riski
- **Şiddet:** 🟡 Orta
- **Sorun:** `uiohook-napi` native C++ binding kullanıyor. Electron major update'lerinde rebuild gerekir. Cross-platform derleme sorunları yaşanabilir.
- **Risk:** Electron 36'ya geçişte binding uyumsuzluğu.
- **Çözüm:** `electron-rebuild` CI/CD pipeline'ına eklenmeli. Fallback olarak Electron `globalShortcut` API'si.

---

## DEP-005: Cloudinary Client-Side SDK
- **Şiddet:** 🟡 Orta
- **Sorun:** Resim yükleme/silme Cloudinary'ye client-side'dan yapılıyor. SDK bundle boyutunu artırır.
- **Çözüm:** Cloud Function üzerinden proxy. Client sadece presigned URL alsın.

---

## DEP-006: concurrently + wait-on Dev Dependency Karmaşası
- **Şiddet:** 🟢 Düşük
- **Sorun:** Dev script'leri `concurrently` + `wait-on` + custom script'ler içeriyor. Bu zincir kırılgan ve debug etmesi zor.
- **Çözüm:** `turbo` veya `nx` gibi monorepo araçları veya basit shell script.

---

## Dependency Audit Özeti

| Paket | Risk | Aksiyon |
|-------|------|---------|
| `react@19.0.0-rc` | 🟡 RC kullanımı | Sabitle veya 18.x'e dön |
| `firebase@latest` | 🔴 Sabitlenmemiş | Versiyon pinle |
| `livekit-client@latest` | 🔴 Sabitlenmemiş | Versiyon pinle |
| `framer-motion@latest` | 🔴 Sabitlenmemiş | Versiyon pinle |
| `electron@latest` | 🔴 Sabitlenmemiş | Versiyon pinle |
| `uiohook-napi` | 🟡 Native binding | Rebuild pipeline ekle |
| `electron-store` | 🟢 Bakım azalıyor | İzle, gerekirse geçiş |
