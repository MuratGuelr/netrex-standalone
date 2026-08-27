"use client";

/**
 * 💬 DMSidebar - Direct Message conversations list
 * Void Theme - Matches ServerSidebar design language
 */

import { useMemo } from "react";
import { MessageCircle, Search, X, Users, Hash } from "lucide-react";
import { useState } from "react";
import { useDMStore } from "@/src/store/dmStore";
import { useAuthStore } from "@/src/store/authStore";
import { useFriendStore } from "@/src/store/friendStore";
import { getEffectivePresence } from "@/src/hooks/usePresence";

const presenceColors = {
  online: "bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.5)]",
  idle: "bg-yellow-500 shadow-[0_0_4px_rgba(234,179,8,0.5)]",
  dnd: "bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.5)]",
  offline: "bg-[#5c5e66]/60",
};

export default function DMSidebar({ 
  onSelectConversation, 
  onOpenFriends,
  activeConversationId,
  showFriendsPanel,
}) {
  const { user } = useAuthStore();
  const { conversations, unreadDMCounts, users: realTimeUsers } = useDMStore();
  const { incomingRequests } = useFriendStore();
  const [searchQuery, setSearchQuery] = useState("");

  const pendingCount = incomingRequests.length;

  const filteredConvos = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter(c => 
      (c.otherUser?.displayName || "").toLowerCase().includes(q)
    );
  }, [conversations, searchQuery]);

  return (
    <div className="w-sidebar h-full flex flex-col shrink-0 relative bg-[#0a0a0c] border-r border-white/5 overflow-hidden">
      {/* Background Effects (Void Theme) */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.03] pointer-events-none" />

      {/* 1. HEADER */}
      <div className="relative z-10 p-4 pb-2">
        {/* Search Bar */}
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5c5e66] pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Sohbet ara veya başlat"
            className="
              w-full h-[30px] pl-8 pr-7
              bg-[#1e1f22]/60 rounded-md
              text-[11px] text-[#dbdee1] placeholder:text-[#5c5e66]
              border border-white/5
              outline-none focus:border-indigo-500/30
              transition-all duration-200
            "
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#5c5e66] hover:text-white transition-colors"
            >
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* 2. NAVIGATION */}
      <div className="relative z-10 px-2 pb-1">
        {/* Arkadaşlar Button */}
        <button
          onClick={onOpenFriends}
          className={`
            w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-md
            transition-all duration-150
            ${showFriendsPanel
              ? "bg-white/[0.08] text-white"
              : "text-[#949ba4] hover:bg-white/[0.04] hover:text-[#dbdee1]"
            }
          `}
        >
          <Users size={18} className={showFriendsPanel ? "text-white" : "text-[#949ba4]"} />
          <span className="text-[13px] font-medium flex-1 text-left">Arkadaşlar</span>
          {pendingCount > 0 && (
            <span className="
              min-w-[16px] h-4 px-1 rounded-full 
              bg-red-500 text-white 
              text-[10px] font-bold leading-none
              flex items-center justify-center
            ">
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {/* 3. DM LIST */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 pt-2 space-y-1">
        {/* Section Header */}
        <div className="flex items-center justify-between px-2 mb-3">
          <span className="text-[11px] font-extrabold text-[#5c5e66] uppercase tracking-[0.1em]">
            Direkt Mesajlar
          </span>
        </div>

        {/* Empty State */}
        {filteredConvos.length === 0 && (
          <div className="flex flex-col items-center pt-6 pb-4 px-2">
            <div className="
              w-10 h-10 rounded-xl 
              bg-[#1e1f22]/60 border border-white/5
              flex items-center justify-center mb-3
            ">
              <MessageCircle size={18} className="text-[#5c5e66]" />
            </div>
            <p className="text-[11px] text-[#5c5e66] text-center leading-relaxed">
              {searchQuery ? "Sonuç bulunamadı" : "Henüz direkt mesajın yok.\nArkadaş ekleyerek sohbet başlatabilirsin."}
            </p>
          </div>
        )}

        {/* Conversation Items */}
        {filteredConvos.map((convo) => {
          const otherId = convo.participantIds.find(id => id !== user?.uid);
          const other = realTimeUsers[otherId] || convo.otherUser; // Fallback to initial static data
          const isActive = activeConversationId === convo.id;
          const unread = unreadDMCounts[convo.id] || 0;
          const presence = getEffectivePresence(other);
          const avatarLetter = (other?.displayName || "?")[0].toUpperCase();
          const lastMsgPreview = convo.lastMessage?.text || "";

          return (
            <button
              key={convo.id}
              onClick={() => onSelectConversation(convo)}
              className={`
                w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-md
                transition-all duration-150 text-left group
                ${isActive
                  ? "bg-white/[0.08] text-white"
                  : "text-[#949ba4] hover:bg-white/[0.04] hover:text-[#dbdee1]"
                }
              `}
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                {other?.photoURL ? (
                  <img
                    src={other.photoURL}
                    alt={other.displayName}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="
                    w-8 h-8 rounded-full 
                    bg-[#5865f2] 
                    flex items-center justify-center
                    text-xs font-semibold text-white
                  ">
                    {avatarLetter}
                  </div>
                )}
                <div className={`
                  absolute -bottom-0.5 -right-0.5 
                  w-3 h-3 rounded-full 
                  border-[2.5px] border-[#0a0a0c]
                  ${presenceColors[presence] || presenceColors.offline}
                `} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className={`text-[13px] font-medium truncate ${isActive ? "text-white" : ""}`}>
                  {other?.displayName || "Bilinmeyen"}
                </p>
                {lastMsgPreview && (
                  <p className="text-[11px] text-[#5c5e66] truncate mt-0.5">
                    {lastMsgPreview}
                  </p>
                )}
              </div>

              {/* Unread badge */}
              {unread > 0 && (
                <span className="
                  min-w-[16px] h-4 px-1 rounded-full 
                  bg-red-500 text-white 
                  text-[10px] font-bold leading-none
                  flex items-center justify-center
                  flex-shrink-0
                ">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
