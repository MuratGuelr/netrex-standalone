"use client";

import { Toaster } from "sonner";
import { SettingsApplier } from "@/src/components/SettingsApplier";

export function Providers({ children }) {
  return (
    <>
      <SettingsApplier />
      {children}
      <Toaster
        position="bottom-right"
        theme="dark"
        richColors
        closeButton
        gap={12}
        offset={24}
        visibleToasts={5}
        expand={true}
        toastOptions={{ 
          duration: 4000,
          style: {
            maxWidth: '420px',
            minWidth: '340px',
            background: 'linear-gradient(135deg, rgba(30, 31, 34, 0.98) 0%, rgba(37, 39, 42, 0.95) 100%)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4), 0 0 40px rgba(0, 0, 0, 0.2)',
            padding: '16px 20px',
          },
          classNames: {
            toast: 'group toast-premium',
            title: 'text-sm font-semibold text-white',
            description: 'text-xs text-[#949ba4] mt-1',
            closeButton: 'bg-white/10 hover:bg-white/20 border-none text-white/70 hover:text-white transition-all duration-200',
            success: 'toast-success',
            error: 'toast-error',
            info: 'toast-info',
            warning: 'toast-warning',
          }
        }}
      />
    </>
  );
}
