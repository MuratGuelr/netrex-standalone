"use client";

/**
 * 🏠 Home Page - Main Application Entry
 * NDS v2.0 - Netrex Design System
 */

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/src/store/authStore";
import RoomList from "@/src/components/RoomList";
import { toast } from "sonner";

// Page Components
import { LoginPage, LoadingScreen } from "@/src/components/pages";
import { WelcomeScreen } from "@/src/components/layout";

// Splash Screen (direct import for immediate availability)
import SplashScreen from "@/src/components/SplashScreen";

// Dynamic imports for code splitting
const ActiveRoom = dynamic(() => import("@/src/components/ActiveRoom"), {
  loading: () => <LoadingScreen message="Oda yükleniyor..." />,
});
const SettingsModal = dynamic(() => import("@/src/components/SettingsModal"));
const UpdateNotification = dynamic(() => import("@/src/components/UpdateNotification"));
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

  const [currentRoom, setCurrentRoom] = useState(null);
  const [currentTextChannel, setCurrentTextChannel] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [viewMode, setViewMode] = useState("voice");
  const [showSplash, setShowSplash] = useState(true); // Splash screen visibility
  const [infoModal, setInfoModal] = useState({
    isOpen: false,
    title: "",
    message: "",
  });

  // 1. Auth Listener
  useEffect(() => {
    const unsubscribe = initializeAuth();
    return () => unsubscribe();
  }, [initializeAuth]);

  // 2. Google Token Listener
  useEffect(() => {
    if (typeof window !== "undefined" && window.netrex) {
      window.netrex.onOAuthSuccess((token) => {
        console.log("Token received from Electron, logging in...");
        loginWithGoogleToken(token);
      });
    }
  }, [loginWithGoogleToken]);

  // 3. Admin DevTools Hotkey (Ctrl+Shift+D)
  useEffect(() => {
    if (!isAuth || !user || typeof window === "undefined" || !window.netrex) return;
    
    const ADMIN_UID = process.env.NEXT_PUBLIC_ADMIN_UID?.trim() || "";
    const isAdmin = ADMIN_UID && user.uid === ADMIN_UID;
    
    // Send UID to Electron (for context menu)
    if (window.netrex.setCurrentUserUid) {
      window.netrex.setCurrentUserUid(user.uid).catch(console.error);
    }
    
    if (!isAdmin) return;
    
    const handleKeyDown = async (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        try {
          await window.netrex.openDevTools(user.uid);
        } catch (error) {
          console.error("DevTools error:", error);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuth, user]);

  // Handle Google login
  const handleGoogleLogin = () => {
    if (typeof window !== "undefined" && window.netrex) {
      window.netrex.startOAuth();
    } else {
      toast.error("Bu özellik sadece masaüstü uygulamasında çalışır.");
    }
  };

  // Handle Anonymous login
  const handleAnonLogin = (username) => {
    if (username.trim()) {
      loginAnonymously(username);
    }
  };

  // --- SPLASH SCREEN ---
  if (showSplash) {
    return (
      <SplashScreen 
        onComplete={() => setShowSplash(false)}
        loadingText="Başlatılıyor"
      />
    );
  }

  // --- LOADING STATE ---
  if (isLoading) {
    return <LoadingScreen message="Giriş yapılıyor..." />;
  }

  // --- LOGIN SCREEN ---
  if (!isAuth) {
    return (
      <>
        <UpdateNotification />
        <LoginPage
          onGoogleLogin={handleGoogleLogin}
          onAnonymousLogin={handleAnonLogin}
        />
      </>
    );
  }

  // --- MAIN APPLICATION ---
  return (
    <div className="
      flex h-screen w-screen
      bg-nds-bg-tertiary
      overflow-hidden
      text-nds-text-primary
      relative
    ">
      {/* Update Notification */}
      <UpdateNotification />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      {/* Info Modal */}
      <InfoModal
        isOpen={infoModal.isOpen}
        title={infoModal.title}
        message={infoModal.message}
        onClose={() => setInfoModal({ isOpen: false, title: "", message: "" })}
      />

      {/* Sidebar - Room List */}
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
              message: "Metin kanallarını kullanmak için önce bir ses kanalına katılmanız gerekir.",
            });
            return;
          }
          setCurrentTextChannel(channelId);
          setViewMode("chat");
        }}
        user={user}
        currentRoom={currentRoom}
        currentTextChannel={currentTextChannel}
        onOpenSettings={() => setShowSettings(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
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
          <WelcomeScreen
            userName={user?.displayName || "Misafir"}
            version={process.env.NEXT_PUBLIC_APP_VERSION || "3.0.0"}
          />
        )}
      </div>
    </div>
  );
}
