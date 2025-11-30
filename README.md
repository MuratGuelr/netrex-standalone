# 🎙️ Netrex - Desktop Voice Chat & Messaging Application

**Netrex**, Discord benzeri modern bir masaüstü sesli sohbet ve metin mesajlaşma uygulamasıdır. Electron, Next.js, Firebase ve LiveKit teknolojileri kullanılarak geliştirilmiş, güvenli ve kullanıcı dostu bir iletişim platformudur.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)

---

## 📋 İçindekiler

- [Özellikler](#-özellikler)
- [Teknolojiler](#-teknolojiler)
- [Gereksinimler](#-gereksinimler)
- [Kurulum](#-kurulum)
- [Kullanım](#-kullanım)
- [Proje Yapısı](#-proje-yapısı)
- [Mimari Açıklamalar](#-mimari-açıklamalar)
- [Özellikler Detayı](#-özellikler-detayı)
- [Geliştirme](#-geliştirme)
- [Build & Paketleme](#-build--paketleme)
- [Sorun Giderme](#-sorun-giderme)
- [Maliyet Optimizasyonu](#-maliyet-optimizasyonu)
- [Yol Haritası](#-yol-haritası)
- [Katkıda Bulunma](#-katkıda-bulunma)
- [Lisans](#-lisans)

---

## ✨ Özellikler

### 🎤 Sesli İletişim

- **Gerçek Zamanlı Sesli Sohbet**: LiveKit teknolojisi ile düşük gecikmeli (low-latency) ses iletimi
- **Ses Aktivite Göstergesi**: Konuşan kullanıcıları görsel olarak vurgulama (yeşil border, pulse animasyonu)
- **Mikrofon Kontrolü**: Anında mikrofon açma/kapama (mute/unmute)
- **Sağırlaştırma (Deafen)**: Hem mikrofonu hem hoparlörü tek tuşla kapatma
- **Global Hotkeys**: Uygulama arka planda olsa bile tuş kombinasyonları ile kontrol
  - Klavye tuşları (Ctrl, Shift, Alt kombinasyonları)
  - Mouse tuşları (Orta tık, Geri/İleri tuşları)
- **Gelişmiş Ses İşleme**:
  - Yankı Engelleme (Echo Cancellation)
  - Gürültü Bastırma (Noise Suppression)
  - Otomatik Kazanç Kontrolü (Auto Gain Control)
  - Voice Processor (Noise Gate) - Konuşma algılama ile otomatik mikrofon kontrolü
- **Cihaz Seçimi**: Mikrofon ve hoparlör cihazı seçimi
- **Kullanıcı Ses Seviyesi**: Her kullanıcı için ayrı ses seviyesi ayarlama
- **Ses Efektleri**: Giriş, çıkış, mute/unmute, mesaj bildirim sesleri

### 💬 Metin Mesajlaşma

- **Metin Kanalları**: Birden fazla metin kanalı oluşturma (kullanıcı başına max 3)
- **Gerçek Zamanlı Mesajlaşma**: LiveKit Data Channel ile anlık mesaj gönderme ve alma
- **Mesaj Yönetimi**:
  - Mesaj silme (sadece kendi mesajlarınızı)
  - Mesaj kopyalama (sağ tık menüsü)
  - Tarih ayırıcıları (mesajları tarihlere göre gruplama)
  - Mesaj dizisi (aynı kullanıcının ardışık mesajları birleştirme)
- **Link Güvenliği**: Dış linkler için onay modalı (XSS koruması)
- **Okunmamış Mesaj Göstergesi**: Kanal listesinde okunmamış mesaj sayısı
- **Firebase Firestore Entegrasyonu**: Mesajların kalıcı olarak saklanması

### 🔐 Kimlik Doğrulama

- **Google OAuth**: Google hesabı ile güvenli giriş (Electron içinde popup)
- **Anonim Giriş**: Kullanıcı adı ile hızlı giriş (Firebase Anonymous Auth)
- **Güvenli Oturum Yönetimi**: Firebase Authentication ile oturum yönetimi
- **Otomatik Çıkış**: Anonim kullanıcılar çıkışta otomatik silinir

### ⚙️ Ayarlar ve Özelleştirme

- **Tuş Atamaları**: Özelleştirilebilir global hotkeys
  - Mute/Unmute tuşu
  - Deafen/Undeafen tuşu
  - Klavye ve mouse tuşları desteği
- **Ses Ayarları**:
  - Giriş/Çıkış cihaz seçimi
  - Uygulama sesleri seviyesi
  - Voice Threshold (Noise Gate hassasiyeti)
  - Gelişmiş ses işleme seçenekleri
- **Profil Özelleştirme**:
  - Profil rengi seçimi (solid renkler)
  - Gradient renk desteği (özel gradient oluşturma)
  - Hazır renk paletleri
- **Hesap Yönetimi**: Profil görüntüleme ve çıkış yapma

### 🏠 Oda Yönetimi

- **Ses Kanalları**: 
  - Admin kullanıcılar ses kanalları oluşturabilir
  - Herkes ses kanallarına katılabilir
  - Gerçek zamanlı katılımcı listesi
- **Metin Kanalları**: 
  - Her kullanıcı maksimum 3 metin kanalı oluşturabilir
  - Kanal oluşturan veya admin kullanıcılar kanal silebilir
  - Gerçek zamanlı kanal listesi
- **Görünüm Kontrolü**: 
  - Ses paneli açma/kapama
  - Chat paneli açma/kapama
  - Panel pozisyonu değiştirme (sol/sağ)

### 🎨 Kullanıcı Arayüzü

- **Modern Tasarım**: Discord benzeri karanlık tema
- **Responsive Layout**: Farklı ekran boyutlarına uyum
- **Smooth Animations**: CSS animasyonları ve geçişler
- **Custom Scrollbar**: Özel scrollbar tasarımı
- **Context Menus**: Sağ tık menüleri (kullanıcı, mesaj)
- **Modal Dialogs**: Ayarlar, kanal oluşturma modalları

---

## 🛠️ Teknolojiler

### Frontend Framework
- **Next.js 14**: React framework (static export mode)
- **React 19**: UI kütüphanesi
- **Tailwind CSS**: Utility-first CSS framework
- **Zustand**: Hafif state management (persist middleware ile)
- **Lucide React**: Modern icon kütüphanesi

### Backend & Services
- **Firebase Authentication**: Google OAuth ve Anonymous Auth
- **Firebase Firestore**: Veritabanı (oda, kanal, mesaj saklama)
- **LiveKit**: Gerçek zamanlı ses/video iletişim altyapısı
  - WebRTC tabanlı düşük gecikme
  - Data Channel ile mesajlaşma
  - Participant metadata ile durum paylaşımı

### Desktop Application
- **Electron**: Masaüstü uygulama framework
- **uiohook-napi**: Global keyboard/mouse hook (global hotkeys için)
- **electron-store**: Yerel ayar depolama (hotkey ayarları)

### Build Tools
- **electron-builder**: Electron uygulama paketleme
- **PostCSS & Autoprefixer**: CSS işleme
- **Custom Scripts**: Path düzeltme, env kopyalama

---

## 📋 Gereksinimler

### Sistem Gereksinimleri
- **Node.js**: 18.x veya üzeri
- **npm**: 9.x veya üzeri (veya yarn/pnpm)
- **İşletim Sistemi**: Windows 10+, macOS 10.15+, Linux (Ubuntu 20.04+)

### Servis Hesapları
- **Firebase Projesi**: Ücretsiz Spark planı yeterli
- **LiveKit Cloud Hesabı**: Ücretsiz plan yeterli

### Geliştirme Ortamı
- **Git**: Versiyon kontrolü için
- **Code Editor**: VS Code önerilir (opsiyonel)

---

## 🚀 Kurulum

### 1. Projeyi Klonlayın

```bash
git clone https://github.com/yourusername/netrex-standalone.git
cd netrex-standalone
```

### 2. Bağımlılıkları Yükleyin

```bash
npm install
```

**Not**: İlk kurulum biraz zaman alabilir (Electron ve native modüller).

### 3. Ortam Değişkenlerini Ayarlayın

Proje kök dizininde `.env.local` dosyası oluşturun:

```env
# Firebase Configuration
# Firebase Console'dan (https://console.firebase.google.com) projenizin ayarlarından alın
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key-here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id

# LiveKit Configuration
# LiveKit Cloud veya kendi LiveKit sunucunuzdan alın
LIVEKIT_API_KEY=your-livekit-api-key
LIVEKIT_API_SECRET=your-livekit-api-secret
NEXT_PUBLIC_LIVEKIT_URL=wss://your-livekit-server-url
```

**Örnek**: `env.example` dosyasını referans alabilirsiniz.

### 4. Firebase Kurulumu

#### 4.1. Firebase Projesi Oluşturma

1. [Firebase Console](https://console.firebase.google.com) üzerinden yeni bir proje oluşturun
2. Proje adını girin ve Google Analytics'i isteğe bağlı olarak etkinleştirin

#### 4.2. Authentication Kurulumu

1. Sol menüden **Authentication** > **Sign-in method** seçin
2. **Google** provider'ı etkinleştirin
3. Support email ekleyin ve kaydedin

#### 4.3. Firestore Database Kurulumu

1. Sol menüden **Firestore Database** seçin
2. **Create database** butonuna tıklayın
3. **Start in test mode** seçin (geliştirme için)
4. Location seçin (en yakın bölgeyi seçin)

#### 4.4. Firestore Security Rules (Geliştirme)

Geliştirme için test modu yeterlidir. Production için şu kuralları kullanın:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Rooms collection
    match /rooms/{roomId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.auth.uid == resource.data.createdBy;
      allow delete: if request.auth != null && request.auth.uid == resource.data.createdBy;
    }
    
    // Text channels collection
    match /text_channels/{channelId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null;
      allow delete: if request.auth != null && 
        (request.auth.uid == resource.data.createdBy || 
         request.auth.uid == get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.isAdmin);
    }
  }
}
```

#### 4.5. Firebase Config Bilgilerini Alma

1. Firebase Console > Project Settings > General
2. **Your apps** bölümünden Web uygulaması ekleyin (veya mevcut uygulamanın config'ini alın)
3. Config bilgilerini `.env.local` dosyasına kopyalayın

### 5. LiveKit Kurulumu

#### 5.1. LiveKit Cloud Hesabı

1. [LiveKit Cloud](https://cloud.livekit.io) üzerinden ücretsiz hesap oluşturun
2. Yeni bir proje oluşturun
3. **Keys** sekmesinden API Key ve Secret'ı alın
4. **Settings** sekmesinden Server URL'ini alın (genellikle `wss://your-project.livekit.cloud`)

#### 5.2. LiveKit Config

`.env.local` dosyasına LiveKit bilgilerini ekleyin:

```env
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
NEXT_PUBLIC_LIVEKIT_URL=wss://your-project.livekit.cloud
```

### 6. Admin UID Ayarlama

`src/components/RoomList.js` dosyasında `ADMIN_UID` değişkenini kendi Firebase UID'niz ile değiştirin:

```javascript
// src/components/RoomList.js (satır 25)
const ADMIN_UID = "your-firebase-uid-here";
```

**Firebase UID'nizi bulmak için**:
1. Uygulamayı çalıştırın ve Google ile giriş yapın
2. Browser Console'da `firebase.auth().currentUser.uid` yazın
3. Veya Firebase Console > Authentication > Users'dan UID'nizi bulun

**Not**: Production için bu değeri environment variable'a taşımanız önerilir.

### 7. Kurulumu Test Edin

```bash
npm run electron-dev
```

Uygulama açıldığında giriş ekranını görmelisiniz. Eğer hata alırsanız [Sorun Giderme](#-sorun-giderme) bölümüne bakın.

---

## 🎮 Kullanım

### Geliştirme Modu

#### Web (Next.js) Development Server

```bash
npm run dev
```

Tarayıcıda `http://localhost:3000` adresine gidin.

**Not**: Web modunda Electron özellikleri (global hotkeys, OAuth popup) çalışmaz.

#### Electron Development Mode

```bash
npm run electron-dev
```

Bu komut:
1. `.env.local` dosyasını `electron/` klasörüne kopyalar
2. Next.js development server'ı başlatır
3. Server hazır olduğunda Electron uygulamasını açar

### Production Build

#### 1. Next.js Build

```bash
npm run build
```

Bu komut:
- Next.js uygulamasını static HTML/CSS/JS olarak build eder
- `out/` klasörüne çıktı verir
- Electron path'lerini düzeltir (`postbuild` script)

#### 2. Electron Paketleme

```bash
npm run electron-pack
```

Bu komut:
- `.env.local` dosyasını `electron/` klasörüne kopyalar
- Next.js build yapar
- Electron uygulamasını paketler
- `dist/` klasörüne installer oluşturur

**Platforma Özel Çıktılar**:
- **Windows**: NSIS installer (`.exe`)
- **macOS**: DMG dosyası
- **Linux**: AppImage

### Uygulama Kullanımı

#### İlk Giriş

1. **Google ile Giriş**:
   - "Google ile Giriş" butonuna tıklayın
   - Browser'da Google hesabınızı seçin
   - Onay verin ve uygulamaya dönün

2. **Anonim Giriş**:
   - Kullanıcı adı girin
   - "Anonim Giriş" butonuna tıklayın

#### Ses Kanalına Katılma

1. Sol panelden bir ses kanalı seçin
2. Otomatik olarak kanala bağlanırsınız
3. Mikrofonunuz açık olarak başlar

#### Metin Kanalı Kullanma

1. Sol panelden bir metin kanalı seçin (veya yeni kanal oluşturun)
2. Sağ panelde chat görünümü açılır
3. Mesaj yazın ve Enter'a basın

#### Ayarlar

1. Sol alttaki kullanıcı paneline tıklayın
2. **Hesabım**: Profil rengi, kullanıcı bilgileri
3. **Ses ve Görüntü**: Cihaz seçimi, ses ayarları
4. **Tuş Atamaları**: Global hotkey ayarları

#### Global Hotkeys

1. Ayarlar > Tuş Atamaları
2. İstediğiniz eylem için "Tuşa Basın..." butonuna tıklayın
3. Klavye tuşu veya mouse tuşuna basın
4. Atama otomatik olarak kaydedilir

**Not**: Global hotkeys uygulama arka planda olsa bile çalışır.

---

## 📁 Proje Yapısı

```
netrex-standalone/
├── app/                          # Next.js App Router
│   ├── layout.js                 # Root layout (metadata, global styles)
│   ├── page.js                   # Ana sayfa (login, main app)
│   └── globals.css               # Global CSS (Tailwind, custom scrollbar)
│
├── electron/                     # Electron main process
│   ├── main.js                  # Electron ana dosyası
│   │                            # - Window yönetimi
│   │                            # - IPC handlers
│   │                            # - OAuth server
│   │                            # - LiveKit token generation
│   │                            # - Global hotkey handling
│   └── preload.js               # Preload script (IPC bridge)
│                                # - window.netrex API
│
├── src/
│   ├── components/              # React bileşenleri
│   │   ├── ActiveRoom.js        # Aktif oda görünümü
│   │   │                        # - LiveKit room wrapper
│   │   │                        # - Participant list
│   │   │                        # - Voice/Chat panel toggle
│   │   │                        # - Bottom controls (mute, deafen)
│   │   │
│   │   ├── ChatView.js          # Chat görünümü
│   │   │                        # - Message list
│   │   │                        # - Message input
│   │   │                        # - Context menu
│   │   │                        # - Link modal
│   │   │
│   │   ├── RoomList.js          # Oda listesi (sidebar)
│   │   │                        # - Voice channels
│   │   │                        # - Text channels
│   │   │                        # - Channel creation/deletion
│   │   │                        # - User panel
│   │   │
│   │   ├── SettingsModal.js     # Ayarlar modalı
│   │   │                        # - Account settings
│   │   │                        # - Voice settings
│   │   │                        # - Keybind settings
│   │   │
│   │   └── UserContextMenu.js   # Kullanıcı context menu
│   │                            # - User volume control
│   │
│   ├── store/                   # Zustand state stores
│   │   ├── authStore.js         # Authentication state
│   │   │                        # - User info
│   │   │                        # - Login/logout
│   │   │
│   │   ├── chatStore.js         # Chat state
│   │   │                        # - Text channels
│   │   │                        # - Messages
│   │   │                        # - Unread counts
│   │   │
│   │   └── settingsStore.js     # Settings state (persisted)
│   │                            # - Audio devices
│   │                            # - Voice settings
│   │                            # - Profile color
│   │                            # - User volumes
│   │
│   ├── hooks/                   # Custom React hooks
│   │   ├── useSoundEffects.js   # Ses efektleri hook
│   │   └── useVoiceProcessor.js # Voice processor (noise gate)
│   │
│   ├── lib/                     # Utility kütüphaneleri
│   │   └── firebase.js          # Firebase config & initialization
│   │
│   └── utils/                   # Yardımcı fonksiyonlar
│       └── keyMap.js            # Klavye keycode mapping
│                                # - Key labels
│                                # - Mouse button labels
│                                # - Modifier key detection
│
├── scripts/                     # Build scriptleri
│   ├── copy-env.js             # .env.local kopyalama (Electron için)
│   └── fix-electron-paths.js   # Electron path düzeltmeleri
│                                # - /_next/ -> ./_next/
│                                # - Base tag ekleme
│
├── public/                     # Statik dosyalar
│   ├── sounds/                 # Ses efektleri (.mp3)
│   │   ├── join.mp3
│   │   ├── left.mp3
│   │   ├── mute.mp3
│   │   ├── unmute.mp3
│   │   ├── deafen.mp3
│   │   ├── undeafen.mp3
│   │   ├── message.mp3
│   │   └── someone-left.mp3
│   └── logo.ico               # Uygulama ikonu
│
├── out/                        # Next.js static export (build output)
├── dist/                       # Electron build output (installers)
│
├── .env.local                  # Environment variables (gitignore)
├── .gitignore                  # Git ignore rules
├── env.example                 # Environment variables template
├── jsconfig.json               # JavaScript path aliases (@/*)
├── next.config.js              # Next.js configuration
├── tailwind.config.js          # Tailwind CSS configuration
├── postcss.config.js           # PostCSS configuration
├── package.json                # Dependencies & scripts
└── README.md                   # Bu dosya
```

---

## 🏗️ Mimari Açıklamalar

### Uygulama Akışı

```
┌─────────────────┐
│   Electron      │
│   Main Process  │
│                 │
│  - Window       │
│  - IPC          │
│  - OAuth Server │
│  - Hotkeys      │
└────────┬────────┘
         │ IPC
         │
┌────────▼────────┐
│   Preload       │
│   Script        │
│                 │
│  window.netrex  │
│  API Bridge     │
└────────┬────────┘
         │
┌────────▼────────┐
│   Next.js       │
│   Renderer      │
│                 │
│  - React App    │
│  - Firebase     │
│  - LiveKit      │
└─────────────────┘
```

### State Management

**Zustand Stores**:
- `authStore`: Kullanıcı kimlik doğrulama durumu
- `chatStore`: Metin kanalları ve mesajlar
- `settingsStore`: Kullanıcı ayarları (localStorage'da persist)

### Veri Akışı

#### Sesli İletişim
```
User → Microphone → LiveKit Room → Other Participants
```

#### Metin Mesajlaşma
```
User Input → LiveKit Data Channel (realtime) → Other Participants
         → Firebase Firestore (persistence) → Database
```

#### Global Hotkeys
```
Keyboard/Mouse Event → uiohook → Electron Main → IPC → Renderer → Action
```

### Firebase Yapısı

```
firestore/
├── rooms/                    # Ses kanalları
│   └── {roomId}/
│       ├── name: string
│       ├── createdBy: string
│       └── createdAt: timestamp
│
└── text_channels/            # Metin kanalları
    └── {channelId}/
        ├── name: string
        ├── createdBy: string
        ├── createdAt: timestamp
        └── messages: array    # Mesaj array'i (subcollection'a taşınmalı)
            └── {message}
                ├── id: string
                ├── text: string
                ├── userId: string
                ├── username: string
                └── timestamp: number
```

**Not**: Mesajlar şu an array olarak saklanıyor. Optimizasyon için `text_channels/{channelId}/messages/{messageId}` subcollection yapısına geçilmesi önerilir.

### LiveKit Yapısı

- **Room**: Her ses kanalı bir LiveKit room'u
- **Participant**: Her kullanıcı bir participant
- **Track**: Mikrofon track'i (audio only)
- **Data Channel**: Mesajlaşma için kullanılıyor
- **Metadata**: Participant metadata'da kullanıcı durumu (muted, deafened, color)

---

## 🔑 Özellikler Detayı

### Global Hotkeys

**Desteklenen Tuşlar**:
- **Klavye**: Tüm tuşlar (Ctrl, Shift, Alt, Meta kombinasyonları ile)
- **Mouse**: Orta tık (button 3), Geri tuşu (button 4), İleri tuşu (button 5)

**Kullanım**:
1. Ayarlar > Tuş Atamaları
2. İstediğiniz eylem için "Tuşa Basın..." butonuna tıklayın
3. Tuşa basın (kombinasyonlar desteklenir: Ctrl+Shift+M gibi)
4. Atama otomatik kaydedilir

**Not**: Sol tık (button 1) ve sağ tık (button 2) atanamaz (uygulama kilitlenmesini önlemek için).

### Voice Processor (Noise Gate)

**Nasıl Çalışır**:
1. Mikrofon sesini analiz eder (Web Audio API)
2. Bandpass filter ile konuşma frekanslarını filtreler (800Hz)
3. RMS (Root Mean Square) hesaplar
4. Eşik değerini (threshold) kontrol eder
5. Eşik üzerindeyse mikrofonu açar, altındaysa kapatır
6. Release time ile konuşma bitince bekleme süresi ekler

**Ayarlar**:
- **Voice Threshold**: Eşik değeri (0-100%)
- **Smoothing**: Ses analizi yumuşatma (0.2 - hızlı tepki, düşük gürültü)

### Ses Kanalları

**Oluşturma**:
- Sadece admin kullanıcılar ses kanalı oluşturabilir
- Firebase Firestore'da `rooms` collection'ına eklenir

**Katılma**:
- Herkes ses kanallarına katılabilir
- LiveKit token oluşturulur (Electron main process)
- Room'a bağlanılır
- Mikrofon otomatik açılır

**Görsel Göstergeler**:
- Konuşan kullanıcılar: Yeşil border, pulse animasyonu
- Muted kullanıcılar: Kırmızı badge, gri avatar
- Deafened kullanıcılar: Kırmızı badge, gri avatar

### Metin Kanalları

**Oluşturma**:
- Her kullanıcı maksimum 3 metin kanalı oluşturabilir
- Kanal adı küçük harfe çevrilir, boşluklar tire ile değiştirilir

**Mesajlaşma**:
- Mesajlar hem LiveKit Data Channel ile (realtime) hem de Firestore'a (persistence) gönderilir
- Mesajlar timestamp'e göre sıralanır
- Aynı kullanıcının 5 dakika içindeki mesajları birleştirilir (sequence)

**Okunmamış Mesajlar**:
- Kullanıcı kanalda değilse veya panel kapalıysa okunmamış sayısı artar
- Kanal açıldığında sayı sıfırlanır
- Kanal listesinde beyaz nokta ile gösterilir

### Profil Renkleri

**Solid Renkler**:
- Hazır renk paleti (10 renk)
- Custom renk seçici (16 milyon renk)

**Gradient Renkler**:
- Başlangıç ve bitiş rengi seçimi
- Açı ayarı (0-360°)
- Hazır gradient paleti (6 gradient)

**Kullanım**:
- Avatar arka planı
- Konuşma border rengi
- Kullanıcı kartı vurguları

---

## 💻 Geliştirme

### Development Scripts

```bash
# Next.js development server (web)
npm run dev

# Electron development mode
npm run electron-dev

# Next.js build
npm run build

# Electron paketleme
npm run electron-pack

# Linting (eğer ESLint kuruluysa)
npm run lint
```

### Code Style

- **JavaScript**: ES6+ syntax
- **React**: Functional components, hooks
- **CSS**: Tailwind CSS utility classes
- **Naming**: camelCase (variables), PascalCase (components)

### Debugging

#### Electron Main Process
```javascript
// electron/main.js
console.log('Debug message'); // Terminal'de görünür
```

#### Renderer Process (Next.js)
```javascript
// Browser DevTools Console'da görünür
console.log('Debug message');
```

#### LiveKit Debug
```javascript
// LiveKit log seviyesini artır
import { setLogLevel, LogLevel } from 'livekit-client';
setLogLevel(LogLevel.debug);
```

### Testing

**Not**: Şu an test framework'ü kurulu değil. Test eklemek için:

```bash
npm install --save-dev jest @testing-library/react @testing-library/jest-dom
```

---

## 📦 Build & Paketleme

### Build Adımları

1. **Environment Variables**: `.env.local` dosyasının `electron/` klasörüne kopyalandığından emin olun
2. **Next.js Build**: `npm run build` (otomatik olarak `postbuild` script çalışır)
3. **Path Fixes**: `scripts/fix-electron-paths.js` otomatik çalışır
4. **Electron Build**: `npm run electron-pack`

### Build Çıktıları

- **Windows**: `dist/Netrex Setup X.X.X.exe` (NSIS installer)
- **macOS**: `dist/Netrex-X.X.X.dmg`
- **Linux**: `dist/Netrex-X.X.X.AppImage`

### Electron Builder Config

`package.json` içindeki `build` objesi Electron Builder ayarlarını içerir:
- App ID: `com.netrex.app`
- Product Name: `Netrex`
- Icon: `public/logo.ico`
- Output: `dist/`

---

## 🔧 Sorun Giderme

### Yaygın Sorunlar

#### 1. "Cannot find module" Hatası

**Çözüm**:
```bash
rm -rf node_modules package-lock.json
npm install
```

#### 2. Electron Açılmıyor

**Kontrol Edin**:
- `.env.local` dosyası var mı?
- `electron/.env.local` dosyası var mı? (build için gerekli)
- Terminal'de hata mesajı var mı?

**Çözüm**:
```bash
npm run electron-dev
# Terminal'deki hata mesajını kontrol edin
```

#### 3. Firebase Bağlantı Hatası

**Kontrol Edin**:
- `.env.local` dosyasındaki Firebase config doğru mu?
- Firebase Console'da Authentication etkin mi?
- Firestore Database oluşturuldu mu?

**Test**:
```javascript
// Browser Console'da
import { auth } from '@/src/lib/firebase';
console.log(auth);
```

#### 4. LiveKit Bağlantı Hatası

**Kontrol Edin**:
- `LIVEKIT_API_KEY` ve `LIVEKIT_API_SECRET` doğru mu?
- `NEXT_PUBLIC_LIVEKIT_URL` doğru formatta mı? (`wss://...`)
- LiveKit Cloud'da proje aktif mi?

**Test**:
```javascript
// Browser Console'da
console.log(process.env.NEXT_PUBLIC_LIVEKIT_URL);
```

#### 5. Global Hotkeys Çalışmıyor

**Kontrol Edin**:
- `uiohook-napi` modülü yüklü mü?
- Electron main process çalışıyor mu?
- Tuş ataması yapıldı mı? (Ayarlar > Tuş Atamaları)

**Not**: Web modunda (sadece Next.js) global hotkeys çalışmaz, Electron gerekir.

#### 6. Ses Çalmıyor / Mikrofon Çalışmıyor

**Kontrol Edin**:
- Tarayıcı/Electron mikrofon izni verdi mi?
- Ses cihazları doğru seçilmiş mi? (Ayarlar > Ses ve Görüntü)
- Sistem ses ayarları kontrol edin

**macOS**:
- System Preferences > Security & Privacy > Microphone
- Electron'a izin verildiğinden emin olun

**Windows**:
- Settings > Privacy > Microphone
- Uygulamalara izin verildiğinden emin olun

#### 7. Build Hatası (Path Issues)

**Sorun**: Electron'da `/_next/` path'leri çalışmıyor

**Çözüm**: `scripts/fix-electron-paths.js` otomatik çalışmalı. Manuel çalıştırın:
```bash
node scripts/fix-electron-paths.js
```

#### 8. Mesajlar Görünmüyor

**Kontrol Edin**:
- Firestore'da `text_channels` collection'ı var mı?
- Mesajlar Firestore'a yazılıyor mu? (Firebase Console'da kontrol edin)
- LiveKit Data Channel çalışıyor mu? (Network tab'de kontrol edin)

---

## 💰 Maliyet Optimizasyonu

Bu proje Firebase ve LiveKit'in **ücretsiz planlarını** kullanacak şekilde optimize edilmiştir.

### Firebase (Spark Plan - Ücretsiz)

**Limitler**:
- **Firestore**: 50K okuma/gün, 20K yazma/gün
- **Authentication**: Sınırsız
- **Storage**: 5GB (kullanılmıyor)

**Optimizasyon İpuçları**:
1. **Polling yerine `onSnapshot` kullanın** (RoomList.js'de text channels için)
2. **Mesajları subcollection'a taşıyın** (şu an array olarak saklanıyor)
3. **Mesaj pagination ekleyin** (son 50 mesaj, scroll'da daha fazla)
4. **Kullanılmayan kanalları dinlemeyin**

### LiveKit Cloud (Free Tier)

**Limitler**:
- **Participant Minutes**: 10K dakika/ay
- **Bandwidth**: 5GB/ay

**Optimizasyon İpuçları**:
1. **Sadece aktif konuşanları dinleyin** (mute olanları unsubscribe edin)
2. **Audio quality ayarlarını optimize edin**
3. **Kullanılmayan odalardan ayrılın**
4. **Background'da bağlantıyı kesin** (window minimize)

### Maliyet İzleme

**Firebase**:
- Firebase Console > Usage and billing
- Günlük okuma/yazma sayılarını kontrol edin

**LiveKit**:
- LiveKit Dashboard > Usage
- Participant minutes ve bandwidth kullanımını kontrol edin

**Öneri**: Limitlerin %80'ine ulaştığınızda uyarı almak için alert kurun.

Detaylı optimizasyon önerileri için `IMPROVEMENTS.md` dosyasına bakın.

---

## 🛣️ Yol Haritası

### Kısa Vadeli (1-2 Hafta)
- [ ] Mesajları subcollection'a taşıma (Firestore optimizasyonu)
- [ ] `onSnapshot` kullanımı (polling yerine)
- [ ] Admin UID'yi environment variable'a taşıma
- [ ] Input validation ekleme
- [ ] Error boundaries ekleme

### Orta Vadeli (1 Ay)
- [ ] Mesaj düzenleme özelliği (son 5 dakika)
- [ ] Typing indicators (LiveKit Data Channel ile)
- [ ] Emoji reactions
- [ ] User mentions (@mention)
- [ ] Mesaj arama (client-side)
- [ ] Desktop notifications
- [ ] Message pagination

### Uzun Vadeli (2-3 Ay)
- [ ] TypeScript migration
- [ ] Unit tests (Jest)
- [ ] E2E tests (Playwright)
- [ ] Virtual scrolling (uzun mesaj listeleri için)
- [ ] Dark/Light theme toggle
- [ ] i18n desteği (çoklu dil)
- [ ] Performance optimizations (code splitting, memoization)

Detaylı özellik listesi için `IMPROVEMENTS.md` dosyasına bakın.

---

## 🤝 Katkıda Bulunma

Katkıda bulunmak isterseniz:

1. **Fork** edin
2. **Feature branch** oluşturun (`git checkout -b feature/amazing-feature`)
3. **Commit** edin (`git commit -m 'Add amazing feature'`)
4. **Push** edin (`git push origin feature/amazing-feature`)
5. **Pull Request** açın

### Katkı Kuralları

- Code style'a uyun (ESLint/Prettier kullanın)
- Yeni özellikler için test yazın
- README'yi güncelleyin
- Commit mesajlarını açıklayıcı yazın

---

## 📝 Lisans

Bu proje MIT lisansı altında lisanslanmıştır. Detaylar için `LICENSE` dosyasına bakın.

---

## 👨‍💻 Geliştirici

Netrex projesi açık kaynak olarak geliştirilmektedir.

---

## 🙏 Teşekkürler

- [LiveKit](https://livekit.io) - Gerçek zamanlı iletişim altyapısı
- [Firebase](https://firebase.google.com) - Backend servisleri
- [Next.js](https://nextjs.org) - React framework
- [Electron](https://www.electronjs.org) - Masaüstü uygulama framework
- [Zustand](https://github.com/pmndrs/zustand) - State management
- [Tailwind CSS](https://tailwindcss.com) - CSS framework
- [Lucide](https://lucide.dev) - Icon library

---

## 📞 Destek

Sorularınız veya önerileriniz için:
- **GitHub Issues** açabilirsiniz
- **Pull Request** gönderebilirsiniz
- **Discussions** bölümünü kullanabilirsiniz

---

## ⚠️ Önemli Notlar

1. **Ücretsiz Plan Limitleri**: Bu uygulama Firebase ve LiveKit'in ücretsiz planlarını kullanacak şekilde tasarlanmıştır. Limitleri aşmamak için `IMPROVEMENTS.md` dosyasındaki optimizasyon önerilerini uygulamanız önerilir.

2. **Güvenlik**: Production kullanımı için:
   - Firestore Security Rules'ı sıkılaştırın
   - Admin UID'yi environment variable'a taşıyın
   - Input validation ekleyin
   - Rate limiting ekleyin

3. **Performans**: Büyük ölçekli kullanım için:
   - Mesajları subcollection'a taşıyın
   - `onSnapshot` kullanın (polling yerine)
   - Message pagination ekleyin
   - Virtual scrolling kullanın

---

**Son Güncelleme**: 2024

**Versiyon**: 1.0.0
