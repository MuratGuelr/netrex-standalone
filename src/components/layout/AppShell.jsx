"use client";

/**
 * 🏗️ AppShell - Main Layout Wrapper
 * NDS v2.0 - Netrex Design System
 * 
 * The root layout component that provides structure for the entire application.
 * Includes: Titlebar, Sidebar, Main Content Area
 */

import { useState, useEffect } from "react";
import Titlebar from "./Titlebar";

export default function AppShell({ 
  children, 
  sidebar,
  showTitlebar = true,
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
      {/* Titlebar - Only in Electron */}
      {showTitlebar && isElectron && <Titlebar />}

      {/* Main App Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        {sidebar && (
          <aside className="
            sidebar
            w-sidebar
            h-full
            bg-nds-bg-primary
            flex flex-col
            flex-shrink-0
            border-r border-nds-border-subtle
          ">
            {sidebar}
          </aside>
        )}

        {/* Main Content */}
        <main className="
          main-content
          flex-1
          h-full
          bg-nds-bg-tertiary
          overflow-hidden
          relative
        ">
          {children}
        </main>
      </div>
    </div>
  );
}
