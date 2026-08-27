"use client";

/**
 * 👤 FriendItem - Single friend row with actions
 * Used in FriendList and search results
 */

import { useState, useEffect } from "react";
import { MessageCircle, UserMinus, MoreHorizontal, UserPlus, Check, X, Clock, ShieldAlert, Phone } from "lucide-react";
import { getEffectivePresence } from "@/src/hooks/usePresence";

const presenceColors = {
  online: "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]",
  idle: "bg-yellow-500 shadow-[0_0_6px_rgba(234,179,8,0.6)]",
  dnd: "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]",
  offline: "bg-gray-500",
};

const presenceLabels = {
  online: "Çevrimiçi",
  idle: "Boşta",
  dnd: "Rahatsız Etme",
  offline: "Çevrimdışı",
};

export default function FriendItem({
  user,
  variant = "friend", // "friend" | "incoming" | "outgoing" | "search"
  relationshipStatus, // for search: "none" | "friend" | "incoming" | "outgoing"
  onMessage,
  onAccept,
  onReject,
  onRemove,
  onSendRequest,
  onCancelRequest,
  onCall,
  friendshipId,
  unreadCount = 0,
}) {
  const [showActions, setShowActions] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);

  // Close context menu on click elsewhere - ✅ Sadece menü açıkken listener ekle
  useEffect(() => {
    if (!contextMenu) return;
    const handleGlobalClick = () => setContextMenu(null);
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, [contextMenu]);

  const handleContextMenu = (e) => {
    if (variant !== "friend") return;
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY
    });
  };

  if (!user) return null;

  const presence = getEffectivePresence(user);
  const avatarLetter = (user.displayName || "?")[0].toUpperCase();

  const handleAction = async (fn) => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      await fn?.();
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div
      className="
        group flex items-center gap-3 px-4 py-3
        hover:bg-white/[0.04] rounded-xl
        transition-all duration-200 cursor-pointer
        border border-transparent hover:border-white/5
      "
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onClick={() => { if (variant === "friend") onMessage?.(); }}
      onContextMenu={handleContextMenu}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt={user.displayName}
            className="w-10 h-10 rounded-full object-cover border border-white/10"
          />
        ) : (
          <div className="
            w-10 h-10 rounded-full 
            bg-gradient-to-br from-indigo-500/30 to-purple-500/30 
            border border-white/10
            flex items-center justify-center
            text-sm font-bold text-white
          ">
            {avatarLetter}
          </div>
        )}

        {/* Presence Indicator */}
        {variant !== "search" && (
          <div className={`
            absolute -bottom-0.5 -right-0.5 
            w-3.5 h-3.5 rounded-full 
            border-2 border-[#1a1b1e]
            ${presenceColors[presence] || presenceColors.offline}
          `} />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">
          {user.displayName || "Bilinmeyen"}
        </p>
        <p className="text-xs text-[#949ba4] truncate">
          {user.username 
            ? `@${user.username}`
            : variant === "search" && user.email
              ? user.email
              : variant === "incoming"
                ? "Arkadaşlık isteği gönderdi"
                : variant === "outgoing"
                  ? "İstek gönderildi"
                  : presenceLabels[presence] || "Çevrimdışı"
          }
        </p>
      </div>

      {/* Unread Badge */}
      {unreadCount > 0 && (
        <div className="
          min-w-[20px] h-5 px-1.5 rounded-full 
          bg-[#f23f43] border-2 border-[#1a1b1e]
          flex items-center justify-center
          animate-pulse shadow-[0_0_8px_rgba(242,63,67,0.4)]
        ">
          <span className="text-[11px] font-bold text-white leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* Friend actions */}
        {variant === "friend" && (
          <button
            onClick={(e) => { e.stopPropagation(); handleAction(() => onRemove?.(friendshipId)); }}
            className="
              w-9 h-9 rounded-xl flex items-center justify-center
              bg-[#2b2d31] border border-white/5
              text-[#b5bac1] hover:text-red-400 hover:bg-red-500/20 hover:border-red-500/30
              transition-all duration-200
              opacity-0 group-hover:opacity-100
            "
            title="Arkadaşlıktan Çıkart"
          >
            <UserMinus size={16} />
          </button>
        )}

        {/* Incoming request actions */}
        {variant === "incoming" && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); handleAction(() => onAccept?.(friendshipId)); }}
              disabled={actionLoading}
              className="
                w-9 h-9 rounded-xl flex items-center justify-center
                bg-green-500/20 border border-green-500/30
                text-green-400 hover:text-white hover:bg-green-500/30
                transition-all duration-200
                disabled:opacity-50
              "
              title="Kabul Et"
            >
              <Check size={16} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleAction(() => onReject?.(friendshipId)); }}
              disabled={actionLoading}
              className="
                w-9 h-9 rounded-xl flex items-center justify-center
                bg-red-500/20 border border-red-500/30
                text-red-400 hover:text-white hover:bg-red-500/30
                transition-all duration-200
                disabled:opacity-50
              "
              title="Reddet"
            >
              <X size={16} />
            </button>
          </>
        )}

        {/* Outgoing request actions */}
        {variant === "outgoing" && (
          <button
            onClick={(e) => { e.stopPropagation(); handleAction(() => onCancelRequest?.(friendshipId)); }}
            disabled={actionLoading}
            className="
              px-3 h-9 rounded-xl flex items-center justify-center gap-1.5
              bg-[#2b2d31] border border-white/5
              text-[#b5bac1] hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20
              transition-all duration-200 text-xs font-medium
              disabled:opacity-50
            "
            title="İptal Et"
          >
            <Clock size={14} />
            <span>Bekliyor</span>
          </button>
        )}

        {/* Search result actions */}
        {variant === "search" && (
          <>
            {relationshipStatus === "none" && (
              <button
                onClick={(e) => { e.stopPropagation(); handleAction(() => onSendRequest?.(user.uid)); }}
                disabled={actionLoading}
                className="
                  px-3 h-9 rounded-xl flex items-center justify-center gap-1.5
                  bg-indigo-500/20 border border-indigo-500/30
                  text-indigo-400 hover:text-white hover:bg-indigo-500/30
                  transition-all duration-200 text-xs font-medium
                  disabled:opacity-50
                "
              >
                <UserPlus size={14} />
                <span>Ekle</span>
              </button>
            )}
            {relationshipStatus === "friend" && (
              <span className="px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 text-xs font-medium border border-green-500/20">
                Arkadaş
              </span>
            )}
            {relationshipStatus === "outgoing" && (
              <span className="px-3 py-1.5 rounded-lg bg-yellow-500/10 text-yellow-400 text-xs font-medium border border-yellow-500/20 flex items-center gap-1">
                <Clock size={12} />
                Gönderildi
              </span>
            )}
            {relationshipStatus === "incoming" && (
              <button
                onClick={(e) => { e.stopPropagation(); handleAction(() => onAccept?.(user.uid)); }}
                disabled={actionLoading}
                className="
                  px-3 h-9 rounded-xl flex items-center justify-center gap-1.5
                  bg-green-500/20 border border-green-500/30
                  text-green-400 hover:text-white hover:bg-green-500/30
                  transition-all duration-200 text-xs font-medium
                  disabled:opacity-50
                "
              >
                <Check size={14} />
                <span>Kabul Et</span>
              </button>
            )}
          </>
        )}
      </div>

      {/* ── Context Menu ── */}
      {contextMenu && (
        <div 
          className="fixed z-[1000] w-48 bg-[#111214] border border-white/5 shadow-2xl rounded-xl py-1.5 animate-in fade-in zoom-in duration-150"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => { onCall?.(); setContextMenu(null); }}
            className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium text-[#dbdee1] hover:bg-white/5 hover:text-white transition-colors"
          >
            <Phone size={14} className="text-[#949ba4]" />
            Ara
          </button>
          <button
            onClick={() => { onMessage?.(); setContextMenu(null); }}
            className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium text-[#dbdee1] hover:bg-white/5 hover:text-white transition-colors"
          >
            <MessageCircle size={14} className="text-[#949ba4]" />
            Mesajlara Git
          </button>
          <div className="h-px bg-white/5 my-1 mx-2" />
          <button
            onClick={() => { handleAction(() => onRemove?.(friendshipId)); setContextMenu(null); }}
            className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <UserMinus size={14} />
            Arkadaşlıktan Çıkar
          </button>
        </div>
      )}
    </div>
  );
}
