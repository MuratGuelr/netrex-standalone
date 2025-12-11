"use client";

/**
 * 🪟 Modal - Modal Dialog Component
 * NDS v2.0 - Netrex Design System
 */

import { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = "md",
  showCloseButton = true,
  closeOnOverlay = true,
  closeOnEsc = true,
  className = "",
}) {
  const handleEsc = useCallback((e) => {
    if (e.key === "Escape" && closeOnEsc) onClose?.();
  }, [closeOnEsc, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleEsc]);

  if (!isOpen) return null;

  const sizeStyles = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
    full: "max-w-[90vw] max-h-[90vh]",
  };

  const modalContent = (
    <div className="nds-modal-overlay animate-nds-fade-in" onClick={closeOnOverlay ? onClose : undefined}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`
          nds-modal w-full ${sizeStyles[size]}
          flex flex-col animate-nds-scale-in
          ${className}
        `}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-nds-border-subtle">
            {title && <h2 className="text-h4 font-bold text-nds-text-primary">{title}</h2>}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-nds-text-tertiary hover:text-nds-text-primary hover:bg-white/5 transition-all group"
              >
                <X size={20} />
                <span className="absolute -bottom-6 right-0 text-caption text-nds-text-muted opacity-0 group-hover:opacity-100 transition-opacity">ESC</span>
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-nds-border-subtle bg-nds-bg-deep/30">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modalContent, document.body);
}

/**
 * 🔔 ConfirmModal - Confirmation dialog
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
  const variantStyles = {
    danger: "bg-nds-danger hover:bg-nds-danger-hover",
    primary: "bg-nds-gradient-primary hover:shadow-nds-glow",
    success: "bg-nds-success hover:bg-nds-success-hover",
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <div className="text-center">
        <h3 className="text-h4 font-bold text-nds-text-primary mb-2">{title}</h3>
        {message && <p className="text-body text-nds-text-secondary mb-6">{message}</p>}
        <div className="flex gap-3 justify-center">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl text-body font-medium text-nds-text-secondary hover:bg-white/5 transition-colors">
            {cancelText}
          </button>
          <button onClick={() => { onConfirm?.(); onClose?.(); }} className={`px-6 py-2.5 rounded-xl text-body font-medium text-white transition-all ${variantStyles[variant]}`}>
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
