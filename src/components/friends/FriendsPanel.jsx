"use client";

/**
 * 🏠 FriendsPanel - Main friends view with tabs
 * Matches WelcomeScreen aesthetic with Netrex void theme
 */

import { useState, useMemo } from "react";
import { Users, UserPlus, Inbox, Globe, Sparkles } from "lucide-react";
import { useFriendStore } from "@/src/store/friendStore";
import { useAuthStore } from "@/src/store/authStore";
import { useDMStore } from "@/src/store/dmStore";
import FriendList from "./FriendList";
import FriendRequestList from "./FriendRequestList";
import AddFriendView from "./AddFriendView";
import Modal from "@/src/components/ui/Modal";
import Button from "@/src/components/ui/Button";
import { toast } from "@/src/utils/toast";
import { useEffect } from "react";

const TABS = [
  { id: "online", label: "Çevrimiçi", icon: Globe },
  { id: "all", label: "Tümü", icon: Users },
  { id: "pending", label: "Bekleyen", icon: Inbox },
  { id: "add", label: "Arkadaş Ekle", icon: UserPlus, highlight: true },
];

export default function FriendsPanel({ onOpenDM }) {
  const [activeTab, setActiveTab] = useState("online");
  const { user } = useAuthStore();
  const {
    friends,
    incomingRequests,
    outgoingRequests,
    acceptRequest,
    rejectRequest,
    removeFriend,
  } = useFriendStore();
  const { users: realTimeUsers, unreadDMCounts, conversations, startUserPresenceListener } = useDMStore();

  const pendingCount = incomingRequests.length;

  // ENSURE we are listening to real-time presence of all friends
  useEffect(() => {
    friends.forEach(f => {
      if (f.friendId && !realTimeUsers[f.friendId]) {
        startUserPresenceListener(f.friendId);
      }
    });
  }, [friends, realTimeUsers, startUserPresenceListener]);

  const [removeConfirm, setRemoveConfirm] = useState({ 
    isOpen: false, 
    friendshipId: null, 
    friendDisplayName: "" 
  });

  const handleRemoveClick = (friendshipId, friendDisplayName) => {
    setRemoveConfirm({
      isOpen: true,
      friendshipId,
      friendDisplayName
    });
  };

  const confirmRemove = async () => {
    if (!removeConfirm.friendshipId) return;
    
    try {
      await removeFriend(removeConfirm.friendshipId);
    } catch (error) {
      toast.error("Arkadaş silinirken hata oluştu.");
    } finally {
      setRemoveConfirm({ isOpen: false, friendshipId: null, friendDisplayName: "" });
    }
  };

  const handleCall = async (targetId) => {
    if (!user?.uid || !targetId) return;
    try {
      const { openOrCreateConversation, startCall } = useDMStore.getState();
      const conversationId = await openOrCreateConversation(user.uid, targetId);
      if (conversationId) {
        await startCall(conversationId, user.uid);
      } else {
        toast.error("Sohbet oluşturulamadı.");
      }
    } catch (error) {
      console.error("Call error:", error);
      toast.error("Arama başlatılamadı.");
    }
  };

  return (
    <div className="
      h-full w-full flex flex-col relative overflow-hidden
      bg-gradient-to-br from-[#111214] via-[#16171a] to-[#0f1012]
    ">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,black_40%,transparent_100%)]" />
      </div>

      {/* ── Top Bar ── */}
      <div className="
        relative z-10
        flex items-center px-3 sm:px-4 h-12
        border-b border-white/[0.06]
        bg-black/20
        flex-shrink-0
        overflow-x-auto no-scrollbar
      ">
        {/* Friends Icon + Title (Only on desktop) */}
        <div className="hidden sm:flex items-center gap-2 pr-4 mr-2 border-r border-white/[0.06] flex-shrink-0">
          <Users size={18} className="text-[#dbdee1]" />
          <span className="text-sm font-semibold text-white">Arkadaşlar</span>
        </div>

        {/* Tabs - perfectly sized for mobile and desktop */}
        <div className="flex items-center gap-1 sm:gap-1.5 flex-nowrap flex-shrink-0">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  relative flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md
                  text-[11px] sm:text-xs font-medium transition-all duration-150 flex-shrink-0 whitespace-nowrap
                  ${tab.highlight && !isActive
                    ? "text-green-400 hover:bg-green-500/10"
                    : isActive
                      ? "bg-white/[0.08] text-white font-semibold"
                      : "text-[#949ba4] hover:text-[#dbdee1] hover:bg-white/[0.04]"
                  }
                `}
              >
                <Icon size={13} />
                <span>{tab.label}</span>

                {tab.id === "pending" && pendingCount > 0 && (
                  <span className="
                    min-w-[15px] h-3.5 px-1 rounded-full 
                    bg-red-500 text-white 
                    text-[9px] font-bold leading-none
                    flex items-center justify-center
                  ">
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="relative z-10 flex-1 overflow-y-auto custom-scrollbar">
        {activeTab === "online" && (
          <FriendList
            friends={friends}
            filter="online"
            onMessage={(friendData) => onOpenDM?.(friendData)}
            onCall={(friend) => handleCall(friend.friendId)}
            realTimeUsers={realTimeUsers}
            unreadDMCounts={unreadDMCounts}
            conversations={conversations}
          />
        )}

        {activeTab === "all" && (
          <FriendList
            friends={friends}
            filter="all"
            onMessage={(friendData) => onOpenDM?.(friendData)}
            onRemove={(id) => {
              const friend = friends.find(f => f.friendshipId === id);
              handleRemoveClick(id, friend?.friendData?.displayName || "bu kişi");
            }}
            onCall={(friend) => handleCall(friend.friendId)}
            realTimeUsers={realTimeUsers}
            unreadDMCounts={unreadDMCounts}
            conversations={conversations}
          />
        )}

        {activeTab === "pending" && (
          <FriendRequestList
            incomingRequests={incomingRequests}
            outgoingRequests={outgoingRequests}
            onAccept={acceptRequest}
            onReject={rejectRequest}
            onCancelRequest={rejectRequest}
          />
        )}

        {activeTab === "add" && (
          <AddFriendView />
        )}
      </div>

      {/* ── Remove Confirmation Modal ── */}
      <Modal
        isOpen={removeConfirm.isOpen}
        onClose={() => setRemoveConfirm({ ...removeConfirm, isOpen: false })}
        title="Arkadaşı Sil"
        size="sm"
      >
        <div className="flex flex-col gap-4 py-2">
          <p className="text-sm text-[#dbdee1] leading-relaxed">
            <strong className="text-white">{removeConfirm.friendDisplayName}</strong> isimli kişiyi arkadaş listenden silmek istediğine emin misin? Bu işlem geri alınamaz.
          </p>
          
          <div className="flex items-center justify-end gap-3 mt-4">
            <button
              onClick={() => setRemoveConfirm({ ...removeConfirm, isOpen: false })}
              className="px-4 py-2 text-sm font-semibold text-white hover:underline transition-all"
            >
              Vazgeç
            </button>
            <Button
              variant="danger"
              size="md"
              onClick={confirmRemove}
            >
              Arkadaşlıktan Çıkart
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
