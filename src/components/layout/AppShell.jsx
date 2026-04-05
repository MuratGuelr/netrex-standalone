"use client";

/**
 * 🏗️ AppShell - Main Layout Wrapper (OPTIMIZED)
 * NDS v2.0 - Netrex Design System
 * 
 * The root layout component that provides structure for the entire application.
 * Includes: Sidebar, Main Content Area
 * 
 * OPTIMIZATION: useGameActivity hook removed - it should only run when connected to a room
 */

import { useState, useEffect, lazy, Suspense } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useAuthStore } from "@/src/store/authStore";
import { useServerStore } from "@/src/store/serverStore";
import { useSettingsStore } from "@/src/store/settingsStore";
import { useSoundManagerStore } from "@/src/store/soundManagerStore";
import { toast } from "@/src/utils/toast";
import ErrorBoundary from "@/src/components/ui/ErrorBoundary";

const SettingsModal = lazy(() => import("@/src/components/SettingsModal"));

export default function AppShell({ 
  children, 
  sidebar,
  rightSidebar,
  serverRail,
  showRightSidebar = true,
  onToggleRightSidebar,
  hasRightSidebarContent = false,
  className = "" 
}) {

  const [isElectron, setIsElectron] = useState(false);
  const router = useRouter();
  const { user } = useAuthStore();
  const { currentServer, members, isLoading, isLeavingServer } = useServerStore();
  const showSettingsModal = useSettingsStore(state => state.showSettingsModal);
  const setSettingsOpen = useSettingsStore(state => state.setSettingsOpen);
  
  // 🚀 OPTIMIZATION: useGameActivity hook kaldırıldı
  // Oyun algılama electron/main.js tarafından otomatik yapılıyor
  // ve sadece odaya bağlanıldığında Firebase'e yazılıyor (useGameActivity.js içinde)

  // Real-time Kick/Ban Enforcement
  useEffect(() => {
    // Only run check if:
    // 1. We have a current server selected
    // 2. Loading is finished
    // 3. We have members loaded (to avoid false positives during initial load)
    // 4. We have a logged in user
    // 5. User is NOT voluntarily leaving (isLeavingServer flag)
    if (currentServer && !isLoading && members.length > 0 && user && !isLeavingServer) {
        const isMember = members.some(m => m.id === user.uid || m.userId === user.uid);
        
        // If user is not in the member list AND is not the owner (safety check)
        if (!isMember && currentServer.ownerId !== user.uid) {
             console.log("User removed from member list, redirecting to home.");
             router.push('/');
             // Use a unique ID to prevent toast spam if effect runs multiple times quickly
             toast.error("Bu sunucudan uzaklaştırıldınız.", { id: 'kick-notification' });
        }
    }
  }, [currentServer, members, user, isLoading, isLeavingServer, router]);

  useEffect(() => {
    setIsElectron(typeof window !== "undefined" && !!window.netrex);
    // 🚀 v5.3: Sistem seslerini RAM'e ön-yükle (Zero Latency)
    // ✅ FIX: 3sn geciktir — auth init ve Firestore onSnapshot ile yarışmasın
    const soundInitDelay = setTimeout(() => {
      useSoundManagerStore.getState().init();
    }, 3000);

    // 🎹 Global Hotkey Listener (Sadece Global Olanlar: TTS vs)
    // ⚠️ Mute, deafen, camera, quick-status gibi odaya özel şeyler BottomControls.js'de dinlenir!
    let cleanupTriggered;
    if (window.netrex) {
      cleanupTriggered = window.netrex.onHotkeyTriggered((action) => {
        if (action === "tts-stop") {
          window.speechSynthesis?.cancel();
          const evt = new CustomEvent("netrex-tts-state", { detail: { active: false, text: "" } });
          window.dispatchEvent(evt);
          toast.info("TTS durduruldu.");
        } else if (action === "tts-toggle") {
          const sStore = useSettingsStore.getState();
          useSettingsStore.setState({ ttsEnabled: !sStore.ttsEnabled });
          const newState = !sStore.ttsEnabled;
          if (!newState) {
            window.speechSynthesis?.cancel(); // Kapanıyorsa sustur
            const evt = new CustomEvent("netrex-tts-state", { detail: { active: false, text: "" } });
            window.dispatchEvent(evt);
          }
          toast.info(`Metin Okuma (TTS) ${newState ? 'açıldı' : 'kapatıldı'}.`);
        }
      });
    }

    return () => {
        clearTimeout(soundInitDelay);
        if (cleanupTriggered) cleanupTriggered();
    };
  }, []);

  return (
    <div className={`
      app-shell
      h-screen w-screen
      flex flex-col
      bg-nds-bg-primary
      text-nds-text-primary
      overflow-hidden
      select-none
      ${className}
    `}>
      {/* Main App Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Server Rail */}
        {serverRail}

        {/* Left Sidebar - Reals Closing & Opening for every server switch */}
        <AnimatePresence mode="wait">
          {sidebar && (
            <motion.aside
              key={sidebar.key || "sidebar"}
              initial={{ opacity: 0, x: -20, width: 0 }}
              animate={{ opacity: 1, x: 0, width: 240 }}
              exit={{ opacity: 0, x: -20, width: 0 }}
              transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
              className="
                sidebar
                h-full
                bg-[#0a0a0c]
                flex flex-col
                flex-shrink-0
                border-r border-nds-border-subtle
                overflow-hidden
              "
            >
              <motion.div 
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 exit={{ opacity: 0, transition: { duration: 0 } }}
                 transition={{ 
                   opacity: { delay: 0.35, duration: 0.2 },
                 }} 
                 className="w-sidebar h-full flex flex-col"
              >
                 {sidebar}
              </motion.div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <main className="
          main-content
          flex-1
          h-full
          bg-nds-bg-tertiary
          overflow-hidden
          relative
          flex
        ">
          <div className="flex-1 flex flex-col h-full overflow-hidden">
             <ErrorBoundary>
               {children}
             </ErrorBoundary>
          </div>

          {/* Right Sidebar with integrated Toggle Button */}
          {hasRightSidebarContent && (
            <div className="h-full flex-shrink-0 relative flex" style={{ zIndex: 'auto' }}>
              <button
                onClick={onToggleRightSidebar}
                className={`
                  absolute top-1/2 -translate-y-1/2 -left-6 z-50
                  w-6 h-20
                  bg-gradient-to-l from-[#1a1b1e]/95 to-[#111214]/95
                  hover:from-indigo-600/20 hover:to-indigo-500/10
                  border-l border-t border-b border-white/10
                  rounded-l-xl
                  flex items-center justify-center
                  text-[#949ba4] hover:text-white
                  shadow-[-5px_0_20px_rgba(0,0,0,0.3)]
                  backdrop-blur-md
                  group
                  transition-colors duration-300
                `}
                title={showRightSidebar ? "Üye listesini gizle" : "Üye listesini göster"}
              >
                <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <ChevronRight 
                  className={`w-4 h-4 group-hover:scale-125 group-hover:text-indigo-400 transition-all duration-300 relative z-10 ${showRightSidebar ? '' : 'rotate-180'}`} 
                />
              </button>

              {/* Animated Sidebar Container - Restored its beauty :) */}
              <motion.div
                initial={false}
                animate={{ width: showRightSidebar ? 240 : 0 }}
                transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
                className="h-full overflow-hidden"
              >
                {/* ✅ Sidebar Content - Unmounts 350ms after close (animasyon + 20ms buffer) */}
                <AnimatePresence mode="wait">
                  {(showRightSidebar || rightSidebar) && (
                    <motion.div
                      initial={false}
                      animate={{ 
                        opacity: showRightSidebar ? 1 : 0,
                        x: showRightSidebar ? 0 : 20
                      }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      onAnimationComplete={() => {
                        // When close animation completes, component will unmount via AnimatePresence
                      }}
                      className="
                        h-full w-[240px]
                        bg-gradient-to-b from-[#1a1b1e] via-[#16171a] to-[#111214]
                        border-l border-white/5
                        overflow-hidden
                      "
                    >
                      {rightSidebar}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>
          )}

        </main>
      </div>
      
      {/* Global Settings Modal - Accessible from anywhere in the app */}
      {showSettingsModal && (
        <Suspense fallback={null}>
          <SettingsModal 
            isOpen={showSettingsModal} 
            onClose={() => setSettingsOpen(false)} 
          />
        </Suspense>
      )}
    </div>
  );
}
