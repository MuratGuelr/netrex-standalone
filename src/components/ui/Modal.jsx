"use client";

/**
 * 🪟 Modal - Premium Modal Dialog Component
 * Güncelleme: Dışarı tıklayınca kapanma (Backdrop Click) özelliği güçlendirildi.
 */

import { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, AlertTriangle, CheckCircle, Info, HelpCircle } from "lucide-react";

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = "md",
  showCloseButton = true,
  closeOnOverlay = true, // Varsayılan olarak açık
  closeOnEsc = true,
  className = "",
}) {
  // ESC tuşu ile kapatma
  const handleEsc = useCallback((e) => {
    if (e.key === "Escape" && closeOnEsc) onClose?.();
  }, [closeOnEsc, onClose]);

  // Overlay (Arka Plan) Tıklama İşleyicisi
  const handleOverlayClick = (e) => {
    // Eğer tıklanan eleman event'in tetiklendiği eleman ise (yani direkt arka plan)
    // ve closeOnOverlay true ise kapat.
    if (e.target === e.currentTarget && closeOnOverlay) {
      onClose?.();
    }
  };

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleEsc);
      // Scroll'u kilitle
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleEsc]);

  if (!isOpen) return null;
  if (typeof document === "undefined") return null;

  const sizeStyles = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
    full: "max-w-[95vw] max-h-[95vh]",
  };

  return createPortal(
    /* 
      1. Wrapper: Ekranı kaplar. 
      onClick={handleOverlayClick} buraya verildiği için padding boşluklarına 
      tıklansa bile 'target === currentTarget' sayesinde yakalanır.
    */
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      onClick={handleOverlayClick}
    >
      {/* --- Animasyon Tanımları --- */}
      <style>{`
        @keyframes nds-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes nds-scale-in { 
          from { opacity: 0; transform: scale(0.95) translateY(10px); } 
          to { opacity: 1; transform: scale(1) translateY(0); } 
        }
        .animate-nds-fade-in { animation: nds-fade-in 0.3s ease-out forwards; }
        .animate-nds-scale-in { animation: nds-scale-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>

      {/* 
         🌑 Backdrop (Görsel Arka Plan)
         pointer-events-none yaptık çünkü tıklamayı yukarıdaki Wrapper yönetecek.
      */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-nds-fade-in pointer-events-none" 
        aria-hidden="true"
      />

      {/* 
         📦 Modal Container
         onClick={(e) => e.stopPropagation()} eklemeye gerek kalmadı çünkü
         yukarıdaki handleOverlayClick sadece wrapper'a (boşluğa) tıklayınca çalışır.
         Ancak garanti olması için modalın kendisine tıklandığını ayırt edebiliriz, 
         fakat target kontrolü zaten bunu yapıyor.
      */}
      <div
        className={`
          relative flex flex-col
          bg-gradient-to-br from-[#1a1b1e] via-[#16171a] to-[#111214]
          border border-white/10 rounded-3xl 
          shadow-[0_0_50px_rgba(0,0,0,0.5)]
          overflow-hidden
          animate-nds-scale-in
          w-full ${sizeStyles[size]}
          ${className}
        `}
        // İçeriğe tıklandığında event'in yukarı (wrapper'a) gidip target kontrolüne takılmaması için durdurmuyoruz,
        // çünkü target !== currentTarget olacağı için zaten kapanmayacak.
        // Ama en güvenlisi:
        onClick={(e) => e.stopPropagation()} 
      >
        {/* ✨ Üst Parlama Efekti */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent z-20 pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-24 bg-indigo-500/10 blur-[50px] pointer-events-none z-0" />

        {/* 🏷️ Header */}
        {(title || showCloseButton) && (
          <div className="relative z-10 flex items-center justify-between px-6 py-5 border-b border-white/5 bg-white/[0.02]">
            {title && (
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="group relative w-8 h-8 flex items-center justify-center rounded-lg text-[#949ba4] hover:text-white hover:bg-white/10 transition-all duration-200"
              >
                <X size={18} className="transition-transform group-hover:rotate-90" />
              </button>
            )}
          </div>
        )}

        {/* 📝 Content */}
        <div className="relative z-10 flex-1 overflow-y-auto p-6 text-[#dbdee1] scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {children}
        </div>

        {/* 🦶 Footer */}
        {footer && (
          <div className="relative z-10 px-6 py-4 border-t border-white/5 bg-black/20 flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

/**
 * 🔔 ConfirmModal
 * Modal bileşenini kullandığı için "dışarı tıklayınca kapanma" özelliği 
 * otomatik olarak buna da gelmiş oldu.
 */
export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Emin misiniz?",
  message,
  confirmText = "Onayla",
  cancelText = "İptal",
  variant = "danger",
}) {
  
  const variants = {
    danger: {
      button: "bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 shadow-[0_0_20px_rgba(220,38,38,0.4)]",
      iconBg: "bg-red-500/10 border-red-500/20 text-red-500",
      Icon: AlertTriangle
    },
    primary: {
      button: "bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.4)]",
      iconBg: "bg-indigo-500/10 border-indigo-500/20 text-indigo-500",
      Icon: HelpCircle
    },
    success: {
      button: "bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 shadow-[0_0_20px_rgba(34,197,94,0.4)]",
      iconBg: "bg-green-500/10 border-green-500/20 text-green-500",
      Icon: CheckCircle
    },
    info: {
      button: "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.4)]",
      iconBg: "bg-blue-500/10 border-blue-500/20 text-blue-500",
      Icon: Info
    }
  };

  const currentVariant = variants[variant] || variants.primary;
  const IconComponent = currentVariant.Icon;

  return (
    <Modal 
        isOpen={isOpen} 
        onClose={onClose} 
        size="sm" 
        showCloseButton={false}
        closeOnOverlay={true} // Burası varsayılan true, yine de açıkça belirttik
    >
      <div className="flex flex-col items-center text-center">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border mb-6 ${currentVariant.iconBg}`}>
           <IconComponent size={32} />
        </div>

        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
        {message && <p className="text-sm text-[#949ba4] leading-relaxed mb-8">{message}</p>}
        
        <div className="flex gap-3 w-full">
          <button 
            onClick={onClose} 
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-[#dbdee1] bg-[#1e1f22] border border-white/5 hover:bg-white/5 hover:text-white transition-all"
          >
            {cancelText}
          </button>
          <button 
            onClick={() => { onConfirm?.(); onClose?.(); }} 
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all transform active:scale-95 ${currentVariant.button}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}