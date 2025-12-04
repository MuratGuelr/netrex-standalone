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
        gap={8}
        toastOptions={{ 
          duration: 4000,
          style: {
            maxWidth: '420px',
            minWidth: '300px',
          },
          classNames: {
            toast: 'group',
            title: 'text-sm font-semibold text-white',
            description: 'text-xs text-[#949ba4]',
            success: 'border-l-[#23a559]',
            error: 'border-l-[#ef4444]',
            info: 'border-l-[#6366f1]',
            warning: 'border-l-[#f59e0b]',
          }
        }}
      />
    </>
  );
}

