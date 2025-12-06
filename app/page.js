"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/src/store/authStore";
import RoomList from "@/src/components/RoomList";
import { Radio, Mic, Headphones } from "lucide-react";
import { toast } from "sonner";

const ActiveRoom = dynamic(() => import("@/src/components/ActiveRoom"), {
  loading: () => <div className="h-full w-full flex items-center justify-center bg-gray-900"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-indigo-500"></div></div>,
});
const SettingsModal = dynamic(() => import("@/src/components/SettingsModal"));
const UpdateNotification = dynamic(() => import("@/src/components/UpdateNotification"));
const UpdateSplash = dynamic(() => import("@/src/components/UpdateSplash"));
const InfoModal = dynamic(() => import("@/src/components/InfoModal"));

export default function Home() {
  const {
    user,
    isAuth,
    isLoading,
    initializeAuth,
    loginAnonymously,
    loginWithGoogleToken,
  } = useAuthStore();
  const [usernameInput, setUsernameInput] = useState("");
  const [currentRoom, setCurrentRoom] = useState(null);
  const [currentTextChannel, setCurrentTextChannel] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [viewMode, setViewMode] = useState("voice");
  const [infoModal, setInfoModal] = useState({
    isOpen: false,
    title: "",
    message: "",
  });
  const [showUpdateSplash, setShowUpdateSplash] = useState(false);

  // 0. Güncelleme Splash Ekranı Kontrolü
  useEffect(() => {
    // Sadece Electron'da ve güncelleme kontrolü açıksa göster
    if (typeof window !== "undefined" && window.netrex) {
      // Güncelleme kontrolü ayarını kontrol et
      window.netrex.getSetting("checkUpdatesOnStartup").then((enabled) => {
        if (enabled !== false) {
          // Varsayılan olarak true, eğer false değilse göster
          setShowUpdateSplash(true);
        }
      }).catch(() => {
        // Hata durumunda varsayılan olarak göster
        setShowUpdateSplash(true);
      });
    } else {
      // Electron yoksa (web) splash gösterme
      setShowUpdateSplash(false);
    }
  }, []);

  // 1. Auth Dinleyicisi
  useEffect(() => {
    const unsubscribe = initializeAuth();
    return () => unsubscribe();
  }, []);

  // 2. Google Token Dinleyicisi
  useEffect(() => {
    if (window.netrex) {
      window.netrex.onOAuthSuccess((token) => {
        console.log("Token Electron'dan alındı, giriş yapılıyor...");
        loginWithGoogleToken(token);
      });
    }
  }, []);

  // 3. Admin DevTools Hotkey (Ctrl+Shift+D) ve UID güncelleme
  useEffect(() => {
    if (!isAuth || !user || !window.netrex) return;
    
    const ADMIN_UID = process.env.NEXT_PUBLIC_ADMIN_UID?.trim() || "";
    const isAdmin = ADMIN_UID && user.uid === ADMIN_UID;
    
    // UID'yi Electron'a gönder (context menu için)
    if (window.netrex.setCurrentUserUid) {
      window.netrex.setCurrentUserUid(user.uid).catch(console.error);
    }
    
    if (!isAdmin) return;
    
    const handleKeyDown = async (e) => {
      // Ctrl+Shift+D
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        try {
          await window.netrex.openDevTools(user.uid);
        } catch (error) {
          console.error("DevTools açma hatası:", error);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuth, user]);

  const handleGoogleLogin = () => {
    if (window.netrex) {
      window.netrex.startOAuth();
    } else {
      toast.error("Bu özellik sadece masaüstü uygulamasında çalışır.");
    }
  };

  const handleAnonLogin = (e) => {
    e.preventDefault();
    if (usernameInput.trim()) loginAnonymously(usernameInput);
  };

  if (isLoading)
    return (
      <div className="h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-indigo-500"></div>
      </div>
    );

  // --- LOGIN EKRANI ---
  if (!isAuth) {
    return (
      <div className="h-screen w-screen bg-gradient-to-br from-[#0f0f11] via-[#1a1b1e] to-[#1e1f22] flex items-center justify-center text-white select-none relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse-slow"></div>
          <div
            className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse-slow"
            style={{ animationDelay: "1s" }}
          ></div>
        </div>

        {/* Bildirimi buraya da ekleyelim ki login ekranında güncelleme olursa görünsün */}
        <UpdateNotification />

        <div className="w-96 p-10 glass-strong rounded-2xl shadow-soft-lg border border-white/10 animate-scaleIn relative z-10">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Netrex
          </h1>
            <p className="text-[#949ba4] text-sm">Güvenli Sesli Sohbet</p>
          </div>

          <button
            onClick={handleGoogleLogin}
            className="w-full bg-white text-gray-900 font-bold py-3.5 rounded-xl hover:bg-gray-100 transition-all duration-200 mb-6 flex items-center justify-center gap-2 hover-lift shadow-soft btn-modern"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Google ile Giriş
          </button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 glass-light text-[#949ba4] rounded-full text-xs">
                veya
              </span>
            </div>
          </div>

          <form onSubmit={handleAnonLogin}>
            <input
              type="text"
              placeholder="Kullanıcı Adı"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              className="w-full glass border border-white/10 rounded-xl p-3.5 mb-4 text-white placeholder-[#6b7280] outline-none focus:border-indigo-500/50 focus:shadow-glow transition-all duration-200"
            />
            <button
              type="submit"
              className="w-full gradient-primary hover:shadow-glow text-white font-bold py-3.5 rounded-xl transition-all duration-200 hover-lift btn-modern"
            >
              Anonim Giriş
            </button>
          </form>
        </div>
      </div>
    );
  }

  // NOT: Splash ekranı artık Electron'da ayrı bir pencerede gösteriliyor
  // Bu component artık kullanılmıyor, ama yine de tutuyoruz (fallback için)

  // --- ANA UYGULAMA ---
  return (
    <div className="flex h-screen w-screen bg-gray-800 overflow-hidden text-white relative">
      {/* GÜNCELLEME BİLDİRİMİ */}
      <UpdateNotification />

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      <InfoModal
        isOpen={infoModal.isOpen}
        title={infoModal.title}
        message={infoModal.message}
        onClose={() => setInfoModal({ isOpen: false, title: "", message: "" })}
      />

      <RoomList
        onJoin={(roomName) => {
          setCurrentRoom(roomName);
          setCurrentTextChannel(null);
          setViewMode("voice");
        }}
        onJoinTextChannel={(channelId) => {
          if (!currentRoom) {
            setInfoModal({
              isOpen: true,
              title: "Ses Kanalı Gerekli",
              message:
                "Metin kanallarını kullanmak için önce bir ses kanalına katılmanız gerekir.",
            });
            return;
          }
          setCurrentTextChannel(channelId);
          setViewMode("chat");
        }}
        user={user}
        currentRoom={currentRoom}
        onOpenSettings={() => setShowSettings(true)}
      />

      <div className="flex-1 flex flex-col relative">
        {currentRoom ? (
          <ActiveRoom
            roomName={currentRoom}
            username={user.displayName || user.email || "Misafir"}
            onLeave={() => {
              setCurrentRoom(null);
              setCurrentTextChannel(null);
              setViewMode("voice");
            }}
            currentTextChannel={currentTextChannel}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            userId={user.uid}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-[#1a1b1e] via-[#1e1f22] to-[#25272a] select-none p-4 relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl"></div>
              <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl"></div>
            </div>

            <div className="relative z-10 animate-fadeIn flex flex-col items-center justify-center text-center">
              <div className="w-28 h-28 glass-strong rounded-3xl flex items-center justify-center mb-8 shadow-soft-lg border border-white/10 hover-lift mx-auto">
                <Radio
                  size={48}
                  className="text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]"
                />
              </div>
              <h2 className="text-3xl font-bold text-white mb-3 tracking-tight text-center">
              Hoş Geldin, {user?.displayName || "Misafir"}!
            </h2>
              <p className="text-[#949ba4] text-sm text-center max-w-md mb-12 leading-relaxed mx-auto">
              Arkadaşlarınla konuşmaya başlamak için sol taraftaki ses
              kanallarından birine tıklayabilirsin.
            </p>
              <div className="flex items-center gap-8 glass px-10 py-4 rounded-2xl border border-white/10 shadow-soft hover-lift mx-auto">
              <div className="flex items-center gap-3 group">
                  <div className="p-2 glass-light rounded-lg text-[#949ba4] group-hover:text-white group-hover:bg-indigo-500/20 transition-all duration-200">
                    <Mic size={16} />
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-[#dbdee1] uppercase tracking-wider">
                    Sustur
                  </span>
                  <span className="text-[10px] text-[#949ba4]">
                    Kısayol Tuşu
                  </span>
                </div>
              </div>
                <div className="w-px h-8 bg-gradient-to-b from-transparent via-white/10 to-transparent"></div>
              <div className="flex items-center gap-3 group">
                  <div className="p-2 glass-light rounded-lg text-[#949ba4] group-hover:text-white group-hover:bg-indigo-500/20 transition-all duration-200">
                    <Headphones size={16} />
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-[#dbdee1] uppercase tracking-wider">
                    Sağırlaştır
                  </span>
                  <span className="text-[10px] text-[#949ba4]">
                    Kısayol Tuşu
                  </span>
                </div>
              </div>
            </div>
            </div>
            <div className="absolute bottom-6 text-[10px] text-[#5e626a] font-mono z-10">
              Netrex Client v{process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
