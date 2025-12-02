"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Info, X } from "lucide-react";

export default function InfoModal({
  isOpen,
  title,
  message,
  onClose,
}) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const modalContent = (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 animate-fadeIn" 
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="glass-strong border border-white/20 rounded-2xl shadow-soft-lg w-full max-w-md animate-scaleIn">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-indigo-500/20 text-indigo-400 shadow-glow">
                <Info size={22} />
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight">{title}</h3>
            </div>
            <button
              onClick={onClose}
              className="text-[#b5bac1] hover:text-white glass border border-white/10 p-2 rounded-xl hover:bg-white/5 transition-all duration-200 hover-lift"
            >
              <X size={18} />
            </button>
          </div>
          
          <p className="text-sm text-[#b5bac1] leading-relaxed">{message}</p>
        </div>
        
        <div className="flex justify-end bg-gradient-to-t from-[#1e1f22] to-transparent p-5 border-t border-white/5 rounded-b-2xl backdrop-blur-sm">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover-lift btn-modern gradient-primary hover:shadow-glow shadow-soft-lg"
          >
            Tamam
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof window !== "undefined") {
    return createPortal(modalContent, document.body);
  }
  
  return null;
}

