"use client";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/src/store/authStore";
import RoomList from "@/src/components/RoomList";
import ActiveRoom from "@/src/components/ActiveRoom";
import SettingsModal from "@/src/components/SettingsModal";
import UpdateNotification from "@/src/components/UpdateNotification"; // EKLENDİ
import { Radio, Mic, Headphones } from "lucide-react";

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

  const handleGoogleLogin = () => {
    if (window.netrex) {
      window.netrex.startOAuth();
    } else {
      alert("Bu özellik sadece masaüstü uygulamasında çalışır.");
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
      <div className="h-screen w-screen bg-gray-900 flex items-center justify-center text-white select-none relative">
        {/* Bildirimi buraya da ekleyelim ki login ekranında güncelleme olursa görünsün */}
        <UpdateNotification />

        <div className="w-96 p-8 bg-gray-800 rounded-xl shadow-2xl border border-gray-700">
          <h1 className="text-3xl font-bold text-center mb-6 text-indigo-400">
            Netrex
          </h1>

          <button
            onClick={handleGoogleLogin}
            className="w-full bg-white text-gray-900 font-bold py-3 rounded hover:bg-gray-200 transition mb-6 flex items-center justify-center gap-2"
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
              <div className="w-full border-t border-gray-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-800 text-gray-400">veya</span>
            </div>
          </div>

          <form onSubmit={handleAnonLogin}>
            <input
              type="text"
              placeholder="Kullanıcı Adı"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              className="w-full bg-gray-900 border border-gray-600 rounded p-3 mb-4 text-white outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded transition"
            >
              Anonim Giriş
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- ANA UYGULAMA ---
  return (
    <div className="flex h-screen w-screen bg-gray-800 overflow-hidden text-white relative">
      {/* GÜNCELLEME BİLDİRİMİ */}
      <UpdateNotification />

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      <RoomList
        onJoin={(roomName) => {
          setCurrentRoom(roomName);
          setCurrentTextChannel(null);
          setViewMode("voice");
        }}
        onJoinTextChannel={(channelId) => {
          if (!currentRoom) {
            alert(
              "Metin kanallarını kullanmak için önce bir ses kanalına katılmanız gerekir."
            );
            return;
          }
          setCurrentTextChannel(channelId);
          setViewMode("chat");
        }}
        user={user}
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
          <div className="flex-1 flex flex-col items-center justify-center bg-[#313338] select-none p-4">
            <div className="w-24 h-24 bg-[#2b2d31] rounded-3xl flex items-center justify-center mb-6 shadow-sm border border-[#1f2023]">
              <Radio size={40} className="text-indigo-500" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Hoş Geldin, {user?.displayName || "Misafir"}!
            </h2>
            <p className="text-[#949ba4] text-sm text-center max-w-md mb-10 leading-relaxed">
              Arkadaşlarınla konuşmaya başlamak için sol taraftaki ses
              kanallarından birine tıklayabilirsin.
            </p>
            <div className="flex items-center gap-6 bg-[#2b2d31] px-8 py-3 rounded-full border border-[#1f2023] shadow-sm">
              <div className="flex items-center gap-3 group">
                <div className="p-1.5 bg-[#313338] rounded-md text-[#949ba4] group-hover:text-white transition-colors">
                  <Mic size={14} />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-[#dbdee1] uppercase tracking-wide">
                    Sustur
                  </span>
                  <span className="text-[10px] text-[#949ba4]">
                    Kısayol Tuşu
                  </span>
                </div>
              </div>
              <div className="w-px h-6 bg-[#3f4147]"></div>
              <div className="flex items-center gap-3 group">
                <div className="p-1.5 bg-[#313338] rounded-md text-[#949ba4] group-hover:text-white transition-colors">
                  <Headphones size={14} />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-[#dbdee1] uppercase tracking-wide">
                    Sağırlaştır
                  </span>
                  <span className="text-[10px] text-[#949ba4]">
                    Kısayol Tuşu
                  </span>
                </div>
              </div>
            </div>
            <div className="absolute bottom-4 text-[10px] text-[#5e626a] font-mono">
              Netrex Client v1.0.0
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
