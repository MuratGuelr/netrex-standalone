"use client";

/**
 * 🏗️ AppShell - Main Layout Wrapper
 * NDS v2.0 - Netrex Design System
 * 
 * The root layout component that provides structure for the entire application.
 * Includes: Titlebar, Sidebar, Main Content Area
 */

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Titlebar from "./Titlebar";
import { Users, ChevronRight } from "lucide-react";

export default function AppShell({ 
  children, 
  sidebar,
  rightSidebar,
  serverRail,
  showTitlebar = true,
  showRightSidebar = true,
  onToggleRightSidebar,
  hasRightSidebarContent = false,
  className = "" 
}) {
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    setIsElectron(typeof window !== "undefined" && !!window.netrex);
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
      {/* Titlebar removed as requested */}

      {/* Main App Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Server Rail */}
        {serverRail}

        {/* Left Sidebar */}
        <AnimatePresence mode="wait">
          {sidebar && (
            <motion.aside
              key={sidebar.key || "sidebar"}
              initial={{ x: -20, opacity: 0, width: 0 }}
              animate={{ x: 0, opacity: 1, width: "var(--sidebar-width, 240px)" }}
              exit={{ x: -20, opacity: 0, width: 0 }}
              transition={{ duration: 0.32, ease: "easeInOut" }}
              className="
                sidebar
                h-full
                bg-nds-bg-primary
                flex flex-col
                flex-shrink-0
                border-r border-nds-border-subtle
                overflow-hidden
              "
            >
              <div className="w-sidebar h-full flex flex-col">
                 {sidebar}
              </div>
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
             {children}
          </div>

          {/* Right Sidebar Toggle Button - Always visible when hasRightSidebarContent */}
          {/* Right Sidebar Toggle Button - Always visible when hasRightSidebarContent */}
          {hasRightSidebarContent && (
            <motion.button
              onClick={onToggleRightSidebar}
              initial={false}
              animate={{ right: showRightSidebar ? 240 : 0 }}
              transition={{ duration: 0.32, ease: "easeInOut" }}
              className={`
                absolute top-1/2 -translate-y-1/2
                w-6 h-20
                bg-gradient-to-l from-[#1a1b1e]/95 to-[#111214]/95
                hover:from-indigo-600/20 hover:to-indigo-500/10
                border-l border-t border-b border-white/10
                rounded-l-xl
                flex items-center justify-center
                text-[#949ba4] hover:text-white
                shadow-[-5px_0_20px_rgba(0,0,0,0.3)]
                backdrop-blur-md
                z-50
                group
                overflow-hidden
              `}
              title={showRightSidebar ? "Üye listesini gizle" : "Üye listesini göster"}
            >
              <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <ChevronRight 
                className={`w-4 h-4 group-hover:scale-125 group-hover:text-indigo-400 transition-all duration-300 relative z-10 ${showRightSidebar ? '' : 'rotate-180'}`} 
              />
            </motion.button>
          )}

          {/* Right Sidebar - Member List */}
          <AnimatePresence mode="wait">
             {rightSidebar && showRightSidebar && (
               <motion.aside
                  key="right-sidebar"
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 240 }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.32, ease: "easeInOut" }}
                  className="
                    h-full
                    bg-gradient-to-b from-[#1a1b1e] via-[#16171a] to-[#111214]
                    flex-shrink-0
                    border-l border-white/5
                    overflow-hidden
                    z-10
                  "
               >
                  {rightSidebar}
               </motion.aside>
             )}
          </AnimatePresence>

        </main>
      </div>
    </div>
  );
}
