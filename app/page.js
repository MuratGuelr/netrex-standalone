"use client";

/**
 * 🏠 Home Page - Main Application Entry
 * NDS v2.0 - Netrex Design System
 */

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/src/store/authStore";
import RoomList from "@/src/components/RoomList";
import { toast } from "sonner";

// Page Components
import { LoginPage, LoadingScreen } from "@/src/components/pages";
import { WelcomeScreen } from "@/src/components/layout";

// Splash Screen (direct import for immediate availability)
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

const ActiveRoom = dynamic(() => import("@/src/components/ActiveRoom"), {
  loading: () => <LoadingScreen message="Oda yükleniyor..." />,
});
const StandaloneChatView = dynamic(() => import("@/src/components/StandaloneChatView"), {
  loading: () => <LoadingScreen message="Sohbet yükleniyor..." />,
});
const SettingsModal = dynamic(() => import("@/src/components/SettingsModal"));
const UpdateNotification = dynamic(() => import("@/src/components/UpdateNotification"));
const InfoModal = dynamic(() => import("@/src/components/InfoModal"));

import ServerMemberList from "@/src/components/server/ServerMemberList";
import { usePresence } from "@/src/hooks/usePresence";
import { useIdleDetection } from "@/src/hooks/useIdleDetection";

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
  const [showChatPanel, setShowChatPanel] = useState(false); // For smooth chat animation
  const [showSettings, setShowSettings] = useState(false);
  const [viewMode, setViewMode] = useState("voice");
  const [showSplash, setShowSplash] = useState(true); // Splash screen visibility
  const [showMemberList, setShowMemberList] = useState(true); // Added state
  const { showSettingsModal, setSettingsOpen } = useSettingsStore();

  const [infoModal, setInfoModal] = useState({
    isOpen: false,
    title: "",
    message: "",
  });

  const [showCreateServerModal, setShowCreateServerModal] = useState(false);
  const [showJoinServerModal, setShowJoinServerModal] = useState(false);
  const [showAddServerSelectionModal, setShowAddServerSelectionModal] = useState(false);

  // Initialize presence tracking (online/idle/offline status)
  usePresence();
  // Initialize auto-idle detection
  useIdleDetection();

  // Initialize Authentication
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // Handle Splash Screen Display
  useEffect(() => {
    if (!isLoading && showSplash) {
      const timer = setTimeout(() => setShowSplash(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [isLoading, showSplash]);

  // Show Loading Screen while authenticating
  if (isLoading || showSplash) {
    return <SplashScreen />;
  }

  // Show Login Page if not authenticated
  if (!isAuth) {
    return (
      <LoginPage
        onGoogleLogin={async () => {
          if (window.netrex?.startOAuth) {
            try {
              // Start OAuth flow - this opens browser and local auth server handles the rest
              await window.netrex.startOAuth();
              // The auth success will be handled by onOAuthSuccess callback
              // which is set up in authStore's initializeAuth
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
          } catch (error) {
            console.error("Anonymous login failed:", error);
            toast.error("Misafir girişi başarısız oldu");
          }
        }}
      />
    );
  }

  // --- MAIN APPLICATION ---
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
                 if (currentRoom?.id === channel.id) {
                   // Already in this room
                 } else {
                   setCurrentRoom(channel);
                   setCurrentTextChannel(null);
                   setViewMode("voice");
                 }
               } else {
                 // Text channel - toggle behavior
                 if (currentTextChannel === channel.id && showChatPanel) {
                   // Already viewing this channel - close it
                   setShowChatPanel(false);
                   // Delay the state cleanup to allow exit animation
                   setTimeout(() => {
                     setCurrentTextChannel(null);
                     setViewMode("voice");
                     useChatStore.getState().clearCurrentChannel();
                   }, 320); // Match animation duration
                 } else {
                   // Open text channel (or switch to different channel)
                   setCurrentTextChannel(channel.id);
                   setShowChatPanel(true);
                   setViewMode("chat");
                   // Load channel messages
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

      {/* Info Modal */}
      <InfoModal
        isOpen={infoModal.isOpen}
        title={infoModal.title}
        message={infoModal.message}
        onClose={() => setInfoModal({ isOpen: false, title: "", message: "" })}
      />

      {/* Add Server Selection Modal */}
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

      {/* Create Server Modal */}
      <CreateServerModal 
        isOpen={showCreateServerModal}
        onClose={() => setShowCreateServerModal(false)}
        onJoinClick={() => {
          setShowCreateServerModal(false);
          setShowJoinServerModal(true);
        }}
      />

      {/* Join Server Modal */}
      <JoinServerModal 
        isOpen={showJoinServerModal}
        onClose={() => setShowJoinServerModal(false)}
        onCreateClick={() => {
            setShowJoinServerModal(false);
            setShowCreateServerModal(true);
        }}
      />

      {/* Main Content Area */}
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
              setShowChatPanel(false); // Reset local state
              
              // Clear chat store state too
              useChatStore.getState().clearCurrentChannel();
              useChatStore.getState().setShowChatPanel(false);
            }}
            currentTextChannel={currentTextChannel}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            userId={user.uid}
          />
        ) : (
          /* Main content area - Welcome or Chat */
          <div className="h-full w-full relative">
            {/* Welcome Screen - Always rendered, fades based on chat state */}
            <motion.div
              initial={false}
              animate={{ 
                opacity: showChatPanel ? 0 : 1
              }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="absolute inset-0"
              style={{ 
                pointerEvents: showChatPanel ? 'none' : 'auto',
                zIndex: showChatPanel ? 0 : 1
              }}
            >
              <WelcomeScreen
                userName={user?.displayName || "Misafir"}
                version={process.env.NEXT_PUBLIC_APP_VERSION || "3.0.0"}
              />
            </motion.div>
            
            {/* Chat Panel - Slides in from left like right sidebar */}
            <motion.div
              initial={false}
              animate={{ 
                x: showChatPanel ? 0 : '-100%',
                opacity: showChatPanel ? 1 : 0
              }}
              transition={{ 
                duration: 0.32, 
                ease: [0.4, 0, 0.2, 1],
                opacity: { duration: 0.15 }
              }}
              className="absolute inset-0"
              style={{ 
                zIndex: showChatPanel ? 2 : 0
              }}
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
          </div>
        )}
      </div>
    </AppShell>
  );
}
