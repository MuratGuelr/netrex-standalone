"use client";

/**
 * 🔍 AddFriendView - Search and add friends
 * Inline view (not a modal) that appears as a tab in FriendsPanel
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { Search, UserPlus, Loader2, Users } from "lucide-react";
import { useFriendStore } from "@/src/store/friendStore";
import { useAuthStore } from "@/src/store/authStore";
import FriendItem from "./FriendItem";

export default function AddFriendView() {
  const { user } = useAuthStore();
  const {
    searchResults,
    isSearching,
    searchUsers,
    clearSearch,
    sendFriendRequest,
    incomingRequests,
    acceptRequest,
  } = useFriendStore();

  const [searchQuery, setSearchQuery] = useState("");
  const searchTimeoutRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounced search
  const handleSearchChange = useCallback((value) => {
    setSearchQuery(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!value.trim()) {
      clearSearch();
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchUsers(value, user?.uid);
    }, 400);
  }, [searchUsers, clearSearch, user?.uid]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      clearSearch();
    };
  }, [clearSearch]);

  const handleSendRequest = async (targetUserId) => {
    if (!user?.uid) return;
    await sendFriendRequest(user.uid, targetUserId);
    // Refresh search to update statuses
    if (searchQuery.trim()) {
      searchUsers(searchQuery, user.uid);
    }
  };

  const handleAcceptFromSearch = async (targetUserId) => {
    const request = incomingRequests.find(r => r.senderId === targetUserId);
    if (request) {
      await acceptRequest(request.id);
      if (searchQuery.trim()) {
        searchUsers(searchQuery, user.uid);
      }
    }
  };

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="px-6 py-5 border-b border-white/5">
        <h3 className="text-lg font-bold text-white mb-1">Arkadaş Ekle</h3>
        <p className="text-sm text-[#949ba4]">
          Netrex kullanıcı adı veya e-posta ile arayabilirsin.
        </p>
      </div>

      {/* Search Input */}
      <div className="px-6 py-4">
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#949ba4] pointer-events-none">
            {isSearching ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Search size={18} />
            )}
          </div>
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Kullanıcı adı veya e-posta ara..."
            className="
              w-full h-12 pl-12 pr-4
              bg-black/30 
              text-white placeholder:text-[#5c5e66]
              border border-white/10 rounded-2xl
              outline-none
              focus:border-indigo-500/50 focus:shadow-[0_0_20px_rgba(99,102,241,0.15)]
              transition-all duration-300
              text-sm
            "
          />
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-2">
        {searchQuery.trim() && !isSearching && searchResults.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-8">
            <div className="
              w-16 h-16 rounded-2xl 
              bg-[#2b2d31] border border-white/5 
              flex items-center justify-center mb-4
            ">
              <Users size={28} className="text-[#5c5e66]" />
            </div>
            <p className="text-sm text-[#949ba4] text-center">
              &quot;<span className="text-white font-medium">{searchQuery}</span>&quot; ile eşleşen kullanıcı bulunamadı.
            </p>
          </div>
        )}

        {searchResults.length > 0 && (
          <div>
            <div className="px-4 py-2">
              <span className="text-xs font-bold text-[#949ba4] uppercase tracking-wider">
                Sonuçlar — {searchResults.length}
              </span>
            </div>
            <div className="space-y-0.5">
              {searchResults.map((result) => (
                <FriendItem
                  key={result.uid}
                  user={result}
                  variant="search"
                  relationshipStatus={result.relationshipStatus}
                  onSendRequest={handleSendRequest}
                  onAccept={handleAcceptFromSearch}
                />
              ))}
            </div>
          </div>
        )}

        {!searchQuery.trim() && (
          <div className="flex flex-col items-center justify-center py-12 px-8">
            <div className="
              w-20 h-20 rounded-2xl 
              bg-gradient-to-br from-indigo-500/10 to-purple-500/10 
              border border-indigo-500/20 
              flex items-center justify-center mb-6
              shadow-lg
            ">
              <UserPlus size={36} className="text-indigo-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">
              Yeni arkadaşlar bul
            </h3>
            <p className="text-sm text-[#949ba4] text-center max-w-sm">
              Kullanıcı adı veya e-posta adresi yazarak arkadaş ekleyebilirsin.
              En az 2 karakter girmen gerekiyor.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
