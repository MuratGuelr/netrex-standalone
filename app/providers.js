"use client";

import { usePresence } from "@/src/hooks/usePresence";
import { useIdleDetection } from "@/src/hooks/useIdleDetection";
import { SettingsApplier } from "@/src/components/SettingsApplier";
import ToastSystem from "@/src/components/ui/ToastSystem";
import { useEffect } from "react";

export function Providers({ children }) {
  usePresence(); // Enable global presence tracking
  useIdleDetection(); // Enable idle detection (minimize/tray/inactivity)
  
  // Clean up coordination
  useEffect(() => {
    if (typeof window !== 'undefined' && window.netrex?.onAppWillQuit) {
      const { executeCleanupTasks } = require("@/src/utils/cleanup");
      // Register the master handler
      const handler = () => executeCleanupTasks();
      window.netrex.onAppWillQuit(handler);
    }
  }, []);

  return (
    <>
      <SettingsApplier />
      {children}
      <ToastSystem />
    </>
  );
}
