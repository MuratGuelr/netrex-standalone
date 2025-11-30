# 🎙️ Netrex

**Netrex**, Discord benzeri bir masaüstü sesli sohbet ve metin mesajlaşma uygulamasıdır. Modern web teknolojileri kullanılarak geliştirilmiş, güvenli ve kullanıcı dostu bir iletişim platformudur.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)

## ✨ Özellikler

### 🎤 Sesli İletişim
- **Gerçek zamanlı sesli sohbet** - LiveKit teknolojisi ile düşük gecikmeli ses iletimi
- **Ses aktivite göstergesi** - Konuşan kullanıcıları görsel olarak gösterir
- **Mikrofon kontrolü** - Anında mikrofon açma/kapama
- **Sağırlaştırma (Deafen)** - Hem mikrofonu hem hoparlörü kapatma
- **Global hotkeys** - Uygulama arka planda olsa bile tuş kombinasyonları ile kontrol
- **Ses ayarları** - Yankı engelleme, gürültü bastırma, otomatik kazanç kontrolü
- **Cihaz seçimi** - Mikrofon ve hoparlör cihazı seçimi

### 💬 Metin Mesajlaşma
- **Metin kanalları** - Birden fazla metin kanalı oluşturma
- **Gerçek zamanlı mesajlaşma** - Anlık mesaj gönderme ve alma
- **Mesaj silme** - Kendi mesajlarınızı silme
- **Link güvenliği** - Dış linkler için onay modalı
- **Mesaj kopyalama** - Sağ tık menüsü ile mesaj kopyalama
- **Tarih ayırıcıları** - Mesajları tarihlere göre gruplama

### 🔐 Kimlik Doğrulama
- **Google OAuth** - Google hesabı ile giriş
- **Anonim giriş** - Kullanıcı adı ile hızlı giriş
- **Güvenli oturum yönetimi** - Firebase Authentication ile güvenli kimlik doğrulama

### ⚙️ Ayarlar ve Özelleştirme
- **Tuş atamaları** - Özelleştirilebilir global hotkeys
- **Ses ayarları** - Gelişmiş ses işleme seçenekleri
- **Hesap yönetimi** - Profil görüntüleme ve çıkış yapma
- **Modern arayüz** - Discord benzeri karanlık tema

### 🏠 Oda Yönetimi
- **Ses kanalları** - Birden fazla ses kanalı oluşturma
- **Metin kanalları** - Her kullanıcı maksimum 3 metin kanalı oluşturabilir
- **Kanal silme** - Oluşturduğunuz kanalları silme
- **Gerçek zamanlı güncellemeler** - Yeni odalar ve kanallar anında görünür

## 🛠️ Teknolojiler

### Frontend
- **Next.js 14** - React framework (static export)
- **React 19** - UI kütüphanesi
- **Tailwind CSS** - Utility-first CSS framework
- **Zustand** - Hafif state management
- **Lucide React** - Modern icon kütüphanesi

### Backend & Services
- **Firebase** - Authentication ve Firestore database
- **LiveKit** - Gerçek zamanlı ses/video iletişim altyapısı
- **Electron** - Masaüstü uygulama framework

### Özel Özellikler
- **uiohook-napi** - Global keyboard hook (global hotkeys için)
- **electron-store** - Yerel ayar depolama

## 📋 Gereksinimler

- **Node.js** 18.x veya üzeri
- **npm** veya **yarn**
- **Firebase** projesi (ücretsiz plan yeterli)
- **LiveKit Cloud** hesabı (ücretsiz plan yeterli)

## 🚀 Kurulum

### 1. Projeyi Klonlayın

```bash
git clone https://github.com/yourusername/netrex.git
cd netrex
```

### 2. Bağımlılıkları Yükleyin

```bash
npm install
```

### 3. Ortam Değişkenlerini Ayarlayın

`.env.local` dosyası oluşturun ve aşağıdaki değişkenleri doldurun:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id

# LiveKit Configuration
LIVEKIT_API_KEY=your-livekit-api-key
LIVEKIT_API_SECRET=your-livekit-api-secret
NEXT_PUBLIC_LIVEKIT_URL=your-livekit-server-url
```

### 4. Firebase Kurulumu

1. [Firebase Console](https://console.firebase.google.com) üzerinden yeni bir proje oluşturun
2. Authentication'ı etkinleştirin (Google provider'ı ekleyin)
3. Firestore Database'i oluşturun (test modunda başlatabilirsiniz)
4. Güvenlik kurallarını ayarlayın (geliştirme için test modu kullanabilirsiniz)

### 5. LiveKit Kurulumu

1. [LiveKit Cloud](https://cloud.livekit.io) üzerinden ücretsiz hesap oluşturun
2. API Key ve Secret'ı alın
3. Server URL'ini not edin

### 6. Admin UID Ayarlama

`src/components/RoomList.js` dosyasında `ADMIN_UID` değişkenini kendi Firebase UID'niz ile değiştirin:

```javascript
const ADMIN_UID = "your-firebase-uid-here";
```

## 🎮 Kullanım

### Geliştirme Modu

```bash
# Next.js development server
npm run dev

# Electron ile birlikte çalıştırma
npm run electron-dev
```

### Production Build

```bash
# Next.js build
npm run build

# Electron paketleme
npm run electron-pack
```

Build edilmiş dosyalar `dist/` klasöründe bulunur.

## 📁 Proje Yapısı

```
netrex/
├── app/                    # Next.js app directory
│   ├── layout.js          # Root layout
│   ├── page.js            # Ana sayfa
│   └── globals.css        # Global stiller
├── electron/              # Electron main process
│   ├── main.js           # Electron ana dosyası
│   └── preload.js        # Preload script (IPC bridge)
├── src/
│   ├── components/       # React bileşenleri
│   │   ├── ActiveRoom.js      # Aktif oda görünümü
│   │   ├── ChatView.js        # Chat görünümü
│   │   ├── RoomList.js        # Oda listesi
│   │   └── SettingsModal.js   # Ayarlar modalı
│   ├── store/            # Zustand state stores
│   │   ├── authStore.js       # Authentication state
│   │   ├── chatStore.js       # Chat state
│   │   └── settingsStore.js   # Ayarlar state
│   ├── lib/              # Utility kütüphaneleri
│   │   └── firebase.js        # Firebase config
│   └── utils/            # Yardımcı fonksiyonlar
│       └── keyMap.js          # Klavye keycode mapping
├── scripts/              # Build scriptleri
│   ├── copy-env.js       # Environment variable kopyalama
│   └── fix-electron-paths.js  # Electron path düzeltmeleri
├── public/               # Statik dosyalar
├── dist/                 # Build çıktıları
└── out/                  # Next.js static export
```

## 🔑 Özellikler Detayı

### Global Hotkeys

Uygulama arka planda olsa bile çalışan tuş kombinasyonları:

- **Mikrofon Aç/Kapa**: Özelleştirilebilir (varsayılan: atanmamış)
- **Sağırlaştır**: Özelleştirilebilir (varsayılan: atanmamış)

Tuş atamalarını Ayarlar > Tuş Atamaları bölümünden yapabilirsiniz.

### Ses Kanalları

- Admin kullanıcılar ses kanalları oluşturabilir
- Herkes ses kanallarına katılabilir
- Gerçek zamanlı ses iletimi
- Konuşan kullanıcılar görsel olarak vurgulanır

### Metin Kanalları

- Her kullanıcı maksimum 3 metin kanalı oluşturabilir
- Kanal oluşturan veya admin kullanıcılar kanal silebilir
- Gerçek zamanlı mesajlaşma
- Mesaj silme özelliği

### Güvenlik

- Google OAuth ile güvenli giriş
- Firebase Security Rules ile veri koruması
- XSS koruması için link onay modalı
- CSP (Content Security Policy) desteği

## 💰 Maliyet Optimizasyonu

Bu proje Firebase ve LiveKit'in **ücretsiz planlarını** kullanacak şekilde optimize edilmiştir:

### Firebase (Spark Plan - Ücretsiz)
- **Firestore**: 50K okuma/gün, 20K yazma/gün
- **Authentication**: Sınırsız
- **Storage**: Kullanılmıyor (dosya paylaşımı yok)

### LiveKit Cloud (Free Tier)
- **Participant Minutes**: 10K/dakika/ay
- **Bandwidth**: 5GB/ay

### Optimizasyon İpuçları

1. **Firestore okuma/yazma limitlerini aşmamak için**:
   - Mesajları subcollection'lara taşıyın
   - `onSnapshot` kullanın (polling yerine)
   - Mesaj pagination ekleyin

2. **LiveKit bandwidth tasarrufu için**:
   - Sadece aktif konuşanları dinleyin
   - Audio quality ayarlarını optimize edin
   - Kullanılmayan odalardan ayrılın

Detaylı optimizasyon önerileri için `IMPROVEMENTS.md` dosyasına bakın.

## 🐛 Bilinen Sorunlar

- [ ] Mesajlar şu an array olarak saklanıyor (subcollection'a taşınmalı)
- [ ] Text channel'lar için polling kullanılıyor (`onSnapshot`'a geçilmeli)
- [ ] Admin UID hardcoded (environment variable'a taşınmalı)

## 🛣️ Yol Haritası

- [ ] Mesaj düzenleme özelliği
- [ ] Typing indicators (LiveKit Data Channel ile)
- [ ] Emoji reactions
- [ ] User mentions (@mention)
- [ ] Mesaj arama (client-side)
- [ ] Desktop notifications
- [ ] Dark/Light theme toggle
- [ ] Message pagination
- [ ] Virtual scrolling (uzun mesaj listeleri için)

## 🤝 Katkıda Bulunma

Katkıda bulunmak isterseniz:

1. Fork edin
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit edin (`git commit -m 'Add amazing feature'`)
4. Push edin (`git push origin feature/amazing-feature`)
5. Pull Request açın

## 📝 Lisans

Bu proje MIT lisansı altında lisanslanmıştır.

## 👨‍💻 Geliştirici

Netrex projesi açık kaynak olarak geliştirilmektedir.

## 🙏 Teşekkürler

- [LiveKit](https://livekit.io) - Gerçek zamanlı iletişim altyapısı
- [Firebase](https://firebase.google.com) - Backend servisleri
- [Next.js](https://nextjs.org) - React framework
- [Electron](https://www.electronjs.org) - Masaüstü uygulama framework

## 📞 Destek

Sorularınız veya önerileriniz için:
- GitHub Issues açabilirsiniz
- Pull Request gönderebilirsiniz

---

**Not**: Bu uygulama Firebase ve LiveKit'in ücretsiz planlarını kullanacak şekilde tasarlanmıştır. Ücretsiz plan limitlerini aşmamak için `IMPROVEMENTS.md` dosyasındaki optimizasyon önerilerini uygulamanız önerilir.

