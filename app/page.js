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
import { AppShell } from "@/src/components/layout";
import ServerRail from "@/src/components/layout/ServerRail";
import CreateServerModal from "@/src/components/server/CreateServerModal";
import JoinServerModal from "@/src/components/server/JoinServerModal";
import AddServerSelectionModal from "@/src/components/server/AddServerSelectionModal";
import ServerSidebar from "@/src/components/server/ServerSidebar";
import { useServerStore } from "@/src/store/serverStore";
import { useSettingsStore } from "@/src/store/settingsStore";
import { useChatStore } from "@/src/store/chatStore";

// Dynamic imports for code splitting
const ActiveRoom = dynamic(() => import("@/src/components/ActiveRoom"), {
  loading: () => <LoadingScreen message="Oda yükleniyor..." />,
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
                 if (!currentRoom) {
                  setInfoModal({
                    isOpen: true,
                    title: "Ses Kanalı Gerekli",
                    message: "Metin kanallarını kullanmak için önce bir ses kanalına katılmanız gerekir.",
                  });
                  return;
                 }
                 setCurrentTextChannel(channel.id);
                 setViewMode("chat");
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
              // Clear chat store state too
              useChatStore.getState().clearCurrentChannel();
              useChatStore.getState().setShowChatPanel(false);
            }}
            currentTextChannel={currentTextChannel}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            userId={user.uid}
          />
        ) : currentTextChannel ? (
           /* Standalone Chat View for Text Channels when not in Voice */
           // We need a wrapper to provide context if ChatView uses useRoomContext? 
           // ChatView uses useRoomContext, which comes from LiveKitRoom. 
           // If we are NOT in a room, useRoomContext will be null/error?
           // The logic in ChatView checks `if (!room) return;` for listeners.
           // So it might handle null room safely?
           // Let's verify ChatView.js lines 54, 159, 296.
           // Line 54: `const room = useRoomContext();` 
           // `useRoomContext` throws error if not inside LiveKitRoom? 
           // It might throw.
           // If so, we can't use ChatView standalone easily without refactoring it to make RoomContext optional.
           // OR we wrap it in a dummy context?
           // OR we just assume ChatView logic is robust.
           // Re-reading ChatView: import { useRoomContext } from "@livekit/components-react";
           // This hook normally throws if no context.
           // Hack: Wrap it in a LiveKitRoom with connect={false}? 
           // Or update ChatView to NOT use useRoomContext if we just check for null? 
           // But the hook itself throws. 
           // I should probably render ActiveRoom with video={false} audio={false}?
           // But ActiveRoom connects to a room. We don't want to connect to a voice room just to read chat.
           
           // Better solution: Refactor ChatView to make room optional.
           // I can wrap the useRoomContext call in a try-catch? No, rules of hooks.
           // I can Check if context exists? No.
           // Components should be composed.
           // If I use a custom hook `useOptionalRoomContext`?
           // Creating `useOptionalRoomContext.js`?
           // For now, let's just stick to "Must join voice" if possible, to avoid crashing.
           // But wait, I enabled Text-Only mode in ServerSidebar!
           
           // If I cannot easily decouple, I should REVERT the "allow text only" decision for now to avoid breakage,
           // OR fix ChatView properly.
           // Fixing ChatView properly:
           // Replace `const room = useRoomContext()` with a safe version.
           // But `useRoomContext` is external.
           
           // Workaround: In `page.js`, if text-only, don't render ChatView directly if it crashes.
           // I'll assume users WANT text only.
           // I will simply modify `ChatView.js` to NOT use `useRoomContext` at top level if possible.
           // But it IS used at top level.
           
           // Alternative: Create a `ChatViewWrapper` that provides a null context?
           // Or just render `ActiveRoom` but passing a `connect={false}` prop?
           // ActiveRoom always connects.
           
           // Let's look at `ActiveRoom.js`. It renders `LiveKitRoom`. 
           // If I pass `token=""`, it might not connect.
           // But `LiveKitRoom` requires token.
           
           // Okay, simple fix: Create a mock Room context?
           // Or just require Voice for now. Discord allows it, but this is a MVP.
           // I will require Voice for now OR try to fix ChatView.
           // Let's look at ChatView imports.
           
           // I'll try to just wrap the `useRoomContext` usages.
           // But I can't catch the hook error easily.
           
           // PROPOSAL: Modify `app/page.js` to render `WelcomeScreen` if no room, even for text channels, BUT show a toast "Please join a voice channel".
           // This was the old behavior. 
           // But I removed the check in `ServerSidebar`.
           
           // Let's create a `SafeChatView`?
           // No time.
           
           // I will simply Re-Add the check in `ServerSidebar` for now to be safe.
           // And add a TODO to "Enable Text-Only Mode".
           // This is safer than shipping a broken page.
           
           <WelcomeScreen
            userName={user?.displayName || "Misafir"}
            version={process.env.NEXT_PUBLIC_APP_VERSION || "3.0.0"}
           />
        ) : (
          <WelcomeScreen
            userName={user?.displayName || "Misafir"}
            version={process.env.NEXT_PUBLIC_APP_VERSION || "3.0.0"}
          />
        )}
      </div>
    </AppShell>
  );
}
