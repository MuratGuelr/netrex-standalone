"use client";

import { Toaster } from "sonner";
import { SettingsApplier } from "@/src/components/SettingsApplier";

export function Providers({ children }) {
  return (
    <>
      <SettingsApplier />
      {children}
      <Toaster
        position="top-right"
        theme="dark"
        richColors
        closeButton
        toastOptions={{ 
          duration: 4000,
          style: {
            maxWidth: '400px',
            width: 'auto',
          }
        }}
        className="toaster"
      />
    </>
  );
}

