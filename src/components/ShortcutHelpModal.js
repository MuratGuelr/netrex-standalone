"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Keyboard, MousePointerClick, MessageSquare } from "lucide-react";
import { getKeyLabel, isModifierKey, getMouseLabel } from "@/src/utils/keyMap";

const formatKeybinding = (keybinding) => {
  if (!keybinding) return null;
  if (keybinding.type === "mouse" || keybinding.mouseButton)
    return getMouseLabel(keybinding.mouseButton);
  if (typeof keybinding.keycode !== "number") return null;
  const keyLabel = getKeyLabel(keybinding.keycode);
  const isStandaloneModifier = isModifierKey(keybinding.keycode);
  if (isStandaloneModifier) return keyLabel;
  const modifiers = [];
  if (keybinding.ctrlKey) modifiers.push("Ctrl");
  if (keybinding.shiftKey) modifiers.push("Shift");
  if (keybinding.altKey) modifiers.push("Alt");
  if (keybinding.metaKey) modifiers.push("Win");
  if (modifiers.length > 0) return [...modifiers, keyLabel].join(" + ");
  return keyLabel;
};

const STATIC_SHORTCUTS = [
  { combo: "Ctrl + /", description: "Klavye kısayollarını göster", action: null },
  { combo: "Ctrl + Enter", description: "Mesaj gönder", action: null },
  { combo: "ESC", description: "Açık modalları kapat", action: null },
];

export default function ShortcutHelpModal({ isOpen, onClose }) {
  const [muteKeybinding, setMuteKeybinding] = useState(null);
  const [deafenKeybinding, setDeafenKeybinding] = useState(null);
  const [cameraKeybinding, setCameraKeybinding] = useState(null);

  useEffect(() => {
    if (!isOpen || !window.netrex) return;
    window.netrex.getHotkey("mute").then((k) => setMuteKeybinding(k || null));
    window.netrex.getHotkey("deafen").then((k) => setDeafenKeybinding(k || null));
    window.netrex.getHotkey("camera").then((k) => setCameraKeybinding(k || null));
  }, [isOpen]);

  const dynamicShortcuts = [
    {
      combo: formatKeybinding(muteKeybinding),
      description: "Mikrofonu Sustur (Mute)",
      action: "mute",
    },
    {
      combo: formatKeybinding(deafenKeybinding),
      description: "Sağırlaştır (Deafen)",
      action: "deafen",
    },
    {
      combo: formatKeybinding(cameraKeybinding),
      description: "Kamerayı Aç/Kapat",
      action: "camera",
    },
  ].filter((s) => s.combo); // Sadece atanmış olanları göster

  const allShortcuts = [...STATIC_SHORTCUTS, ...dynamicShortcuts];
  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 bg-black/80 z-[99999] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#2b2d31] border border-[#1e1f22] rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-150">
        <div className="p-6 flex items-center gap-3 border-b border-[#1f2023]">
          <div className="p-3 rounded-full bg-[#5865f2]/15 text-[#5865f2]">
            <Keyboard size={28} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Klavye Kısayolları</h3>
            <p className="text-sm text-[#a5abb3]">Netrex'i daha hızlı kullanın</p>
          </div>
        </div>
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {allShortcuts.map(({ combo, description, action }) => (
            <div
              key={combo || action}
              className="flex items-center justify-between bg-[#1f2023] border border-[#2b2d31] rounded-xl px-4 py-3 gap-4"
            >
              <div>
                <p className="text-white font-semibold text-sm">{description}</p>
                <p className="text-xs text-[#a5abb3] mt-0.5">
                  {action ? "Ayarlardan değiştirilebilir" : "Masaüstü uygulaması"}
                </p>
              </div>
              <span className="text-[12px] font-semibold text-[#dbdee1] bg-[#2b2d31] border border-[#3a3c43] rounded px-3 py-1">
                {combo || "Atanmadı"}
              </span>
            </div>
          ))}
          <div className="bg-[#232428] border border-[#35373c] rounded-xl p-4 flex items-start gap-3 text-sm text-[#c8ccd3]">
            <MousePointerClick size={18} className="text-[#5865f2]" />
            <p>
              Kısayol penceresini açmak için{" "}
              <span className="font-semibold text-white">Ctrl + /</span>{" "}
              kombinasyonunu kullanabilir veya aşağıdaki butona tıklayabilirsiniz.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3 bg-[#1f2023] p-4 border-t border-[#1a1b1f]">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#5865f2] hover:bg-[#4752c4] transition-colors flex items-center gap-2"
          >
            <MessageSquare size={16} />
            Tamam, anladım
          </button>
        </div>
      </div>
    </div>
  );

  // React Portal kullanarak document.body'ye render et
  if (typeof window !== "undefined") {
    return createPortal(modalContent, document.body);
  }
  return null;
}

