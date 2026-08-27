"use client";

/**
 * 📋 FriendList - Displays all accepted friends
 * Supports filtering by online/all
 */

import { useMemo } from "react";
import { Users, UserX } from "lucide-react";
import FriendItem from "./FriendItem";
import { getEffectivePresence } from "@/src/hooks/usePresence";

export default function FriendList({
  friends,
  filter = "all", // "all" | "online"
  onMessage,
  onRemove,
  onCall,
  realTimeUsers = {},
  unreadDMCounts = {},
  conversations = []
}) {
  const filteredFriends = useMemo(() => {
    if (filter === "online") {
      return friends.filter(f => {
        const presence = getEffectivePresence(f.friendData);
        return presence !== "offline";
      });
    }
    return friends;
  }, [friends, filter]);

  // Sort: online first, then alphabetical
  const sortedFriends = useMemo(() => {
    return [...filteredFriends].sort((a, b) => {
      const presA = getEffectivePresence(a.friendData);
      const presB = getEffectivePresence(b.friendData);
      
      // Online users first
      const onlineA = presA !== "offline" ? 0 : 1;
      const onlineB = presB !== "offline" ? 0 : 1;
      
      if (onlineA !== onlineB) return onlineA - onlineB;
      
      // Then alphabetical
      const nameA = (a.friendData?.displayName || "").toLowerCase();
      const nameB = (b.friendData?.displayName || "").toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [filteredFriends]);

  // Count online
  const onlineCount = useMemo(() => {
    return friends.filter(f => getEffectivePresence(f.friendData) !== "offline").length;
  }, [friends]);

  if (sortedFriends.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-8">
        <div className="
          w-20 h-20 rounded-2xl 
          bg-gradient-to-br from-[#2b2d31] to-[#1e1f22] 
          border border-white/5 
          flex items-center justify-center mb-6
          shadow-lg
        ">
          {filter === "online" ? (
            <Users size={36} className="text-[#5c5e66]" />
          ) : (
            <UserX size={36} className="text-[#5c5e66]" />
          )}
        </div>
        <h3 className="text-lg font-bold text-white mb-2">
          {filter === "online" ? "Kimse çevrimiçi değil" : "Henüz arkadaş yok"}
        </h3>
        <p className="text-sm text-[#949ba4] text-center max-w-sm">
          {filter === "online"
            ? "Arkadaşların şu anda çevrimdışı görünüyor."
            : "\"Arkadaş Ekle\" sekmesinden kullanıcı arayarak yeni arkadaşlar edinebilirsin."
          }
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-2">
        <span className="text-xs font-bold text-[#949ba4] uppercase tracking-wider">
          {filter === "online" ? "Çevrimiçi" : "Tüm Arkadaşlar"}
        </span>
        <span className="text-xs text-[#5c5e66]">—</span>
        <span className="text-xs font-medium text-[#5c5e66]">
          {filter === "online" ? onlineCount : sortedFriends.length}
        </span>
      </div>

      {/* List */}
      <div className="space-y-0.5">
        {sortedFriends.map((friend) => {
          const convo = conversations.find(c => c.participantIds?.includes(friend.friendId));
          const unreadCount = convo ? (unreadDMCounts[convo.id] || 0) : 0;
          
          return (
            <FriendItem
              key={friend.friendshipId}
              user={realTimeUsers[friend.friendId] || friend.friendData}
              variant="friend"
              friendshipId={friend.friendshipId}
              onMessage={() => onMessage?.(friend.friendData)}
              onRemove={onRemove}
              onCall={() => onCall?.(friend)}
              unreadCount={unreadCount}
            />
          );
        })}
      </div>
    </div>
  );
}
