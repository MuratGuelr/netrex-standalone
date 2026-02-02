"use client";

/**
 * 🏠 Home Page - Main Application Entry
 * NDS v2.0 - Netrex Design System
 */

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/src/store/authStore";
import { toast } from "@/src/utils/toast";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/src/lib/firebase";

// Page Components
import { LoginPage, LoadingScreen } from "@/src/components/pages";
import { WelcomeScreen } from "@/src/components/layout";

// Splash Screen (direct import for immediate availability)
import SplashScreen from "@/src/components/SplashScreen";
import ExitSplashScreen from "@/src/components/ExitSplashScreen";
import { AppShell } from "@/src/components/layout";
import ServerRail from "@/src/components/layout/ServerRail";
import CreateServerModal from "@/src/components/server/CreateServerModal";
import JoinServerModal from "@/src/components/server/JoinServerModal";
import AddServerSelectionModal from "@/src/components/server/AddServerSelectionModal";
import ServerSidebar from "@/src/components/server/ServerSidebar";
import { useServerStore } from "@/src/store/serverStore";
import { useSettingsStore } from "@/src/store/settingsStore";
import { useChatStore } from "@/src/store/chatStore";
import { useUpdateStore } from "@/src/store/updateStore";

const ActiveRoom = dynamic(() => import("@/src/components/ActiveRoom"), {
  loading: () => <LoadingScreen message="Oda yükleniyor..." />,
});
const StandaloneChatView = dynamic(() => import("@/src/components/StandaloneChatView"), {
  loading: () => <LoadingScreen message="Sohbet yükleniyor..." />,
});

import SettingsModal from "@/src/components/SettingsModal";
import UpdateNotification from "@/src/components/UpdateNotification";
import InfoModal from "@/src/components/InfoModal";
const InstallUpdateSplash = dynamic(() => import("@/src/components/InstallUpdateSplash"));

import ServerMemberList from "@/src/components/server/ServerMemberList";

export default function Home() {
  const {
    user,
    isAuth,
    isLoading,
    initializeAuth,
    loginAnonymously,
    loginWithGoogleToken,
  } = useAuthStore();
  const { currentServer } = useServerStore();

  const [currentRoom, setCurrentRoom] = useState(null);
  const [currentTextChannel, setCurrentTextChannel] = useState(null);
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [viewMode, setViewMode] = useState("voice");
  const [showSplash, setShowSplash] = useState(true);
  const [showExitSplash, setShowExitSplash] = useState(false);
  const [showInstallUpdateSplash, setShowInstallUpdateSplash] = useState(false);
  const [showMemberList, setShowMemberList] = useState(true);

  useEffect(() => {
    if (window.netrex && window.netrex.onRequestExit) {
      window.netrex.onRequestExit(() => {
        setShowExitSplash(true);
      });
    }

    if (window.netrex && window.netrex.onUpdateRestarting) {
        window.netrex.onUpdateRestarting(() => {
            setShowInstallUpdateSplash(true);
        });

        window.netrex.onUpdateRestartFailed((error) => {
            setShowInstallUpdateSplash(false);
            useUpdateStore.getState().reset();
            if (error) toast.info(error);
        });
    }
  }, []);

  const { showSettingsModal, setSettingsOpen } = useSettingsStore();

  const [infoModal, setInfoModal] = useState({
    isOpen: false,
    title: "",
    message: "",
  });

  const [showCreateServerModal, setShowCreateServerModal] = useState(false);
  const [showJoinServerModal, setShowJoinServerModal] = useState(false);
  const [showAddServerSelectionModal, setShowAddServerSelectionModal] = useState(false);

  useEffect(() => {
    initializeAuth();
    useUpdateStore.getState().initialize();
  }, [initializeAuth]);

  useEffect(() => {
    if (!isLoading && showSplash) {
      const timer = setTimeout(() => setShowSplash(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [isLoading, showSplash]);

  // Reset local state when server changes or is deselected (Home)
  useEffect(() => {
    setCurrentRoom(null);
    setCurrentTextChannel(null);
    setShowChatPanel(false);
    setViewMode("voice");
    useChatStore.getState().clearCurrentChannel();
    useChatStore.getState().setShowChatPanel(false);
  }, [currentServer?.id]);

  if (showExitSplash) {
    return (
      <ExitSplashScreen 
        onComplete={async () => {
          if (user?.uid) {
            try {
              await updateDoc(doc(db, 'users', user.uid), {
                presence: 'offline',
                lastSeen: serverTimestamp(),
                gameActivity: null
              });
            } catch (e) {
              console.error("Failed to set offline:", e);
            }
          }
          if (window.netrex?.forceQuitApp) {
            window.netrex.forceQuitApp();
          }
        }} 
      />
    );
  }

  if (showInstallUpdateSplash) {
      return <InstallUpdateSplash />;
  }

  if (isLoading || showSplash) {
    return <SplashScreen />;
  }

  if (!isAuth) {
    return (
      <LoginPage
        onGoogleLogin={async () => {
          if (window.netrex?.startOAuth) {
            try {
              await window.netrex.startOAuth();
            } catch (error) {
              console.error("Google login failed:", error);
              toast.error("Google ile giriş başarısız oldu");
            }
          } else {
            toast.error("Bu özellik sadece masaüstü uygulamasında kullanılabilir");
          }
        }}
        onAnonymousLogin={async (username) => {
          try {
            await loginAnonymously(username);
            toast.success("Giriş başarılı! Netrex'e hoş geldin.");
          } catch (error) {
            console.error("Anonymous login failed:", error);
            toast.error("Misafir girişi başarısız oldu");
          }
        }}
      />
    );
  }

  return (
    <AppShell
      serverRail={
        <ServerRail 
          onOpenCreateModal={() => setShowAddServerSelectionModal(true)} 
        />
      }
      rightSidebar={
        currentServer ? (
           <ServerMemberList onClose={() => setShowMemberList(false)} />
        ) : null
      }
      showRightSidebar={showMemberList}
      onToggleRightSidebar={() => setShowMemberList(!showMemberList)}
      hasRightSidebarContent={!!currentServer}
      sidebar={
        currentServer ? (
          <ServerSidebar 
            key={currentServer.id}
            activeTextChannelId={currentTextChannel}
            onJoinChannel={(channel) => {
               if (channel.type === 'voice') {
                 if (currentRoom?.id !== channel.id) {
                   setCurrentRoom(channel);
                   setCurrentTextChannel(null);
                   setViewMode("voice");
                 }
               } else {
                 if (currentTextChannel === channel.id && showChatPanel) {
                   setShowChatPanel(false);
                   setTimeout(() => {
                     setCurrentTextChannel(null);
                     setViewMode("voice");
                     useChatStore.getState().clearCurrentChannel();
                   }, 320);
                 } else {
                   setCurrentTextChannel(channel.id);
                   setShowChatPanel(true);
                   setViewMode("chat");
                   useChatStore.getState().loadChannelMessages(channel.id, currentServer?.id);
                 }
               }
            }}
            onToggleMemberList={() => setShowMemberList(!showMemberList)}
            showMemberList={showMemberList}
          />
        ) : null
      }
    >
      <UpdateNotification />
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setSettingsOpen(false)}
      />

      <InfoModal
        isOpen={infoModal.isOpen}
        title={infoModal.title}
        message={infoModal.message}
        onClose={() => setInfoModal({ isOpen: false, title: "", message: "" })}
      />

      <AddServerSelectionModal 
        isOpen={showAddServerSelectionModal}
        onClose={() => setShowAddServerSelectionModal(false)}
        onCreateClick={() => {
            setShowAddServerSelectionModal(false);
            setShowCreateServerModal(true);
        }}
        onJoinClick={() => {
            setShowAddServerSelectionModal(false);
            setShowJoinServerModal(true);
        }}
      />

      <CreateServerModal 
        isOpen={showCreateServerModal}
        onClose={() => setShowCreateServerModal(false)}
        onJoinClick={() => {
          setShowCreateServerModal(false);
          setShowJoinServerModal(true);
        }}
      />

      <JoinServerModal 
        isOpen={showJoinServerModal}
        onClose={() => setShowJoinServerModal(false)}
        onCreateClick={() => {
            setShowJoinServerModal(false);
            setShowCreateServerModal(true);
        }}
      />

      <div className="flex-1 flex flex-col relative overflow-hidden h-full">
        {currentRoom ? (
          <ActiveRoom
            roomName={currentRoom.id}
            displayName={currentRoom.name}
            username={user.displayName || user.email || "Misafir"}
            onLeave={() => {
              setCurrentRoom(null);
              setCurrentTextChannel(null);
              setViewMode("voice");
              setShowChatPanel(false);
              useChatStore.getState().clearCurrentChannel();
              useChatStore.getState().setShowChatPanel(false);
            }}
            currentTextChannel={currentTextChannel}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            userId={user.uid}
          />
        ) : (
          <div className="h-full w-full relative">
            <AnimatePresence mode="wait">
              {!showChatPanel ? (
                <motion.div
                  key="welcome"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0"
                >
                  <WelcomeScreen
                    userName={user?.displayName || "Misafir"}
                    version={process.env.NEXT_PUBLIC_APP_VERSION || "3.0.0"}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="chat"
                  initial={{ x: '-20%', opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: '-20%', opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0"
                >
                  {currentTextChannel && (
                    <div className="h-full w-full">
                      <StandaloneChatView
                        channelId={currentTextChannel}
                        username={user.displayName || user.email || "Misafir"}
                        userId={user.uid}
                      />
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </AppShell>
  );
}
