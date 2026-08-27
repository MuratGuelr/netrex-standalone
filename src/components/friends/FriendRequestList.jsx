"use client";

/**
 * 📬 FriendRequestList - Displays incoming and outgoing friend requests
 */

import { Inbox, Send } from "lucide-react";
import FriendItem from "./FriendItem";

export default function FriendRequestList({
  incomingRequests,
  outgoingRequests,
  onAccept,
  onReject,
  onCancelRequest,
}) {
  const hasRequests = incomingRequests.length > 0 || outgoingRequests.length > 0;

  if (!hasRequests) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-8">
        <div className="
          w-20 h-20 rounded-2xl 
          bg-gradient-to-br from-[#2b2d31] to-[#1e1f22] 
          border border-white/5 
          flex items-center justify-center mb-6
          shadow-lg
        ">
          <Inbox size={36} className="text-[#5c5e66]" />
        </div>
        <h3 className="text-lg font-bold text-white mb-2">
          Bekleyen istek yok
        </h3>
        <p className="text-sm text-[#949ba4] text-center max-w-sm">
          Şu anda bekleyen bir arkadaşlık isteğin bulunmuyor.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Incoming Requests */}
      {incomingRequests.length > 0 && (
        <div className="mb-4">
          <div className="px-4 py-3 flex items-center gap-2">
            <Inbox size={14} className="text-green-400" />
            <span className="text-xs font-bold text-[#949ba4] uppercase tracking-wider">
              Gelen İstekler
            </span>
            <span className="
              min-w-[20px] h-5 px-1.5 rounded-full 
              bg-red-500/20 border border-red-500/30
              text-red-400 text-[10px] font-bold 
              flex items-center justify-center
            ">
              {incomingRequests.length}
            </span>
          </div>

          <div className="space-y-0.5">
            {incomingRequests.map((request) => (
              <FriendItem
                key={request.id}
                user={request.senderData}
                variant="incoming"
                friendshipId={request.id}
                onAccept={onAccept}
                onReject={onReject}
              />
            ))}
          </div>
        </div>
      )}

      {/* Outgoing Requests */}
      {outgoingRequests.length > 0 && (
        <div>
          <div className="px-4 py-3 flex items-center gap-2">
            <Send size={14} className="text-[#949ba4]" />
            <span className="text-xs font-bold text-[#949ba4] uppercase tracking-wider">
              Gönderilen İstekler
            </span>
            <span className="text-xs font-medium text-[#5c5e66]">
              {outgoingRequests.length}
            </span>
          </div>

          <div className="space-y-0.5">
            {outgoingRequests.map((request) => (
              <FriendItem
                key={request.id}
                user={request.receiverData}
                variant="outgoing"
                friendshipId={request.id}
                onCancelRequest={onReject}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
