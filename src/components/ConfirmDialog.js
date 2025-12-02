"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Loader2, AlertTriangle } from "lucide-react";

export default function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel = "Onayla",
  cancelLabel = "Vazgeç",
  loading = false,
  variant = "default",
  onConfirm,
  onCancel,
  itemToDelete, // Silinecek öğenin adı (vurgulanacak)
}) {
  useEffect(() => {
    if (isOpen) {
      // Modal açıldığında body scroll'unu kapat
      document.body.style.overflow = "hidden";
    } else {
      // Modal kapandığında body scroll'unu aç
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
        // Backdrop'a tıklandığında modal'ı kapatma (sadece butonlarla kapatılsın)
        if (e.target === e.currentTarget) {
          // İsteğe bağlı: backdrop'a tıklayınca kapat
          // onCancel();
        }
      }}
    >
      <div className="glass-strong border border-white/20 rounded-2xl shadow-soft-lg w-full max-w-md animate-scaleIn">
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div
              className={`p-3 rounded-xl ${
                variant === "danger"
                  ? "bg-red-500/20 text-red-400 shadow-glow-red"
                  : "bg-indigo-500/20 text-indigo-400 shadow-glow"
              }`}
            >
              <AlertTriangle size={22} />
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">{title}</h3>
          </div>
          
          {/* Silinecek öğe vurgusu */}
          {itemToDelete && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-3">
              <div className="text-lg font-bold text-red-400 break-words">
                {itemToDelete}
              </div>
            </div>
          )}
          
          <p className="text-sm text-[#b5bac1] leading-relaxed">{description}</p>
        </div>
        <div className="flex justify-end gap-3 bg-gradient-to-t from-[#1e1f22] to-transparent p-5 border-t border-white/5 rounded-b-2xl backdrop-blur-sm">
          <button
            onClick={onCancel}
            className="px-6 py-2.5 text-sm font-medium glass border border-white/10 text-[#b5bac1] hover:text-white hover:bg-white/5 rounded-xl transition-all duration-200 hover-lift"
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed hover-lift btn-modern ${
              variant === "danger"
                ? "gradient-danger hover:shadow-glow-red shadow-soft-lg"
                : "gradient-primary hover:shadow-glow shadow-soft-lg"
            }`}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );

  // Portal kullanarak modal'ı document.body'ye render et
  if (typeof window !== "undefined") {
    return createPortal(modalContent, document.body);
  }
  
  return null;
}

