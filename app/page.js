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

// Splash Screen
import SplashScreen from "@/src/components/SplashScreen";
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
const StandaloneChatView = dynamic(
  () => import("@/src/components/StandaloneChatView"),
  {
    loading: () => <LoadingScreen message="Sohbet yükleniyor..." />,
  },
);

// ✅ SettingsModal KALDIRILDI — AppShell global olarak render ediyor
import UpdateNotification from "@/src/components/UpdateNotification";
import InfoModal from "@/src/components/InfoModal";
import VoiceChannelSwitchModal from "@/src/components/VoiceChannelSwitchModal";
const InstallUpdateSplash = dynamic(
  () => import("@/src/components/InstallUpdateSplash"),
);

import ServerMemberList from "@/src/components/server/ServerMemberList";

export default function Home() {
  const { user, isAuth, isLoading, initializeAuth, loginAnonymously } =
    useAuthStore();
  const { currentServer, servers } = useServerStore();

  const [currentRoom, setCurrentRoom] = useState(null);
  const [currentTextChannel, setCurrentTextChannel] = useState(null);

  // ✅ Global Chat State
  const showChatPanel = useChatStore((state) => state.showChatPanel);
  const setShowChatPanel = useChatStore((state) => state.setShowChatPanel);

  const [viewMode, setViewMode] = useState("voice");
  const [showSplash, setShowSplash] = useState(true);
  const [showInstallUpdateSplash, setShowInstallUpdateSplash] = useState(false);
  const [showMemberList, setShowMemberList] = useState(true);

  // ✅ Voice channel switch confirmation modal
  const [voiceChannelSwitch, setVoiceChannelSwitch] = useState({
    isOpen: false,
    currentChannel: null,
    targetChannel: null,
  });

  // currentRoom null olduğunda modal'ı kapat
  useEffect(() => {
    if (!currentRoom) {
      setVoiceChannelSwitch((prev) => {
        if (prev.isOpen) {
          return { isOpen: false, currentChannel: null, targetChannel: null };
        }
        return prev;
      });
    }
  }, [currentRoom]);

  // --- GRACEFUL EXIT LOGIC ---
  useEffect(() => {
    if (window.netrex && window.netrex.onAppWillQuit) {
      window.netrex.onAppWillQuit(async () => {
        console.log("🧹 Starting graceful shutdown...");
        try {
          if (user?.uid) {
            await updateDoc(doc(db, "users", user.uid), {
              presence: "offline",
              lastSeen: serverTimestamp(),
              gameActivity: null,
              currentRoom: null,
            });
          }
          if (currentRoom) setCurrentRoom(null);
          if (currentTextChannel) {
            setCurrentTextChannel(null);
            useChatStore.getState().clearCurrentChannel();
          }
          if (currentServer) useServerStore.getState().clearCurrentServer();
          console.log("✅ Graceful shutdown completed");
        } catch (e) {
          console.error("❌ Cleanup error:", e);
        }
        if (window.netrex?.notifyCleanupComplete) {
          window.netrex.notifyCleanupComplete();
        }
      });
    }

    if (window.netrex && window.netrex.onRequestExit) {
      window.netrex.onRequestExit(async () => {
        if (window.netrex && window.netrex.forceQuitApp) {
          window.netrex.forceQuitApp();
        }
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
  }, [user?.uid, currentRoom, currentTextChannel, currentServer]);

  const [infoModal, setInfoModal] = useState({
    isOpen: false,
    title: "",
    message: "",
  });

  const [showCreateServerModal, setShowCreateServerModal] = useState(false);
  const [showJoinServerModal, setShowJoinServerModal] = useState(false);
  const [showAddServerSelectionModal, setShowAddServerSelectionModal] =
    useState(false);

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

  // Server değiştiğinde text channel temizle, voice room'u KORU
  useEffect(() => {
    setCurrentTextChannel(null);
    setShowChatPanel(false);
    setViewMode("voice");
    useChatStore.getState().clearCurrentChannel();
  }, [currentServer?.id]);

  if (showInstallUpdateSplash) return <InstallUpdateSplash />;
  if (isLoading || showSplash) return <SplashScreen />;

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
            toast.error(
              "Bu özellik sadece masaüstü uygulamasında kullanılabilir",
            );
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
          isRoomActive={!!currentRoom}
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
              console.log("🎤 onJoinChannel called:", channel.name);

              if (channel.type === "voice") {
                if (currentRoom && currentRoom.id !== channel.id) {
                  const currentRoomServer = servers.find(
                    (s) => s.id === currentRoom._serverId,
                  );
                  setVoiceChannelSwitch({
                    isOpen: true,
                    currentChannel: {
                      name: currentRoom.name,
                      serverName:
                        currentRoomServer?.name || "Bilinmeyen Sunucu",
                      serverIcon: currentRoomServer?.iconUrl || null,
                    },
                    targetChannel: {
                      name: channel.name,
                      serverName: currentServer?.name || "Bilinmeyen Sunucu",
                      serverIcon: currentServer?.iconUrl || null,
                    },
                    onConfirm: () => {
                      const roomWithSession = {
                        ...channel,
                        _sessionStart: Date.now(),
                        _serverId: currentServer?.id,
                        _serverName: currentServer?.name,
                        _serverIcon: currentServer?.iconUrl,
                      };
                      setCurrentRoom(roomWithSession);
                      setCurrentTextChannel(null);
                      useChatStore.getState().clearCurrentChannel();
                      setViewMode("voice");
                      setVoiceChannelSwitch({
                        isOpen: false,
                        currentChannel: null,
                        targetChannel: null,
                      });
                    },
                  });
                  return;
                }

                const roomWithSession = {
                  ...channel,
                  _sessionStart: Date.now(),
                  _serverId: currentServer?.id,
                  _serverName: currentServer?.name,
                  _serverIcon: currentServer?.iconUrl,
                };
                setCurrentRoom(roomWithSession);
                setCurrentTextChannel(null);
                useChatStore.getState().clearCurrentChannel();
                setViewMode("voice");
              } else {
                if (currentTextChannel === channel.id) {
                  if (showChatPanel) {
                    setShowChatPanel(false);
                    setCurrentTextChannel(null);
                    useChatStore.getState().clearCurrentChannel();
                    setViewMode("voice");
                  } else {
                    setShowChatPanel(true);
                    setViewMode("chat");
                  }
                } else {
                  setCurrentTextChannel(channel.id);
                  setShowChatPanel(true);
                  setViewMode("chat");
                  useChatStore
                    .getState()
                    .loadChannelMessages(channel.id, currentServer?.id);
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

      {/* ✅ SettingsModal yok — AppShell'deki global instance kullanılıyor */}

      <InfoModal
        isOpen={infoModal.isOpen}
        title={infoModal.title}
        message={infoModal.message}
        onClose={() => setInfoModal({ isOpen: false, title: "", message: "" })}
      />

      <VoiceChannelSwitchModal
        isOpen={voiceChannelSwitch.isOpen}
        currentChannel={voiceChannelSwitch.currentChannel}
        targetChannel={voiceChannelSwitch.targetChannel}
        onClose={() =>
          setVoiceChannelSwitch({
            isOpen: false,
            currentChannel: null,
            targetChannel: null,
          })
        }
        onConfirm={voiceChannelSwitch.onConfirm}
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
        {/* ActiveRoom her zaman mount, sadece visibility değişiyor */}
        <div
          className={`absolute inset-0 ${currentRoom ? "z-10 opacity-100" : "z-0 opacity-0 pointer-events-none"}`}
          style={{ transition: "opacity 0.2s" }}
        >
          {currentRoom && (
            <ActiveRoom
              roomName={currentRoom.id}
              displayName={currentRoom.name}
              username={user?.displayName || user?.email || "Misafir"}
              onLeave={() => {
                setCurrentRoom(null);
                setCurrentTextChannel(null);
                setViewMode("voice");
                setShowChatPanel(false);
                useChatStore.getState().clearCurrentChannel();
              }}
              currentTextChannel={currentTextChannel}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              userId={user?.uid}
            />
          )}
        </div>

        {/* Welcome/Chat screen */}
        <div
          className={`absolute inset-0 ${!currentRoom ? "z-10 opacity-100" : "z-0 opacity-0 pointer-events-none"}`}
          style={{ transition: "opacity 0.2s" }}
        >
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
                initial={{ x: "-20%", opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: "-20%", opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0"
              >
                {currentTextChannel && (
                  <div className="h-full w-full">
                    <StandaloneChatView
                      channelId={currentTextChannel}
                      username={user?.displayName || user?.email || "Misafir"}
                      userId={user?.uid}
                    />
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </AppShell>
  );
}
