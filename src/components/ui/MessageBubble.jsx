"use client";

/**
 * 💬 MessageBubble - Chat Message Component
 * NDS v2.0 - Netrex Design System
 */

import { useState } from "react";
import { Copy, Trash2, MoreVertical } from "lucide-react";
import Avatar from "./Avatar";

export default function MessageBubble({
  message,
  isOwn = false,
  showAvatar = true,
  onDelete,
  onCopy,
  className = "",
}) {
  const [showActions, setShowActions] = useState(false);
  const displayName = message?.user?.displayName || "Kullanıcı";
  const timestamp = message?.timestamp ? new Date(message.timestamp).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <div
      className={`flex gap-3 group ${isOwn ? "flex-row-reverse" : ""} ${className}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {showAvatar && (
        <Avatar src={message?.user?.photoURL} name={displayName} size="sm" />
      )}

      <div className={`flex flex-col max-w-[70%] ${isOwn ? "items-end" : "items-start"}`}>
        {!isOwn && (
          <div className="flex items-center gap-2 mb-1">
            <span className="text-small font-semibold text-nds-text-primary">{displayName}</span>
            <span className="text-caption text-nds-text-muted">{timestamp}</span>
          </div>
        )}

        <div className={`
          relative px-4 py-2.5 rounded-2xl text-body
          ${isOwn
            ? "bg-nds-accent-primary text-white rounded-br-md"
            : "bg-nds-bg-secondary text-nds-text-primary rounded-bl-md"
          }
        `}>
          <p className="break-words whitespace-pre-wrap">{message?.content}</p>
          
          {isOwn && <span className="text-[10px] opacity-70 mt-1 block text-right">{timestamp}</span>}

          {/* Actions */}
          {showActions && (
            <div className={`
              absolute top-0 flex gap-1 p-1 rounded-lg bg-nds-bg-elevated shadow-nds-soft border border-nds-border-light
              ${isOwn ? "left-0 -translate-x-full -ml-2" : "right-0 translate-x-full mr-2"}
            `}>
              <button onClick={() => onCopy?.(message?.content)} className="p-1.5 rounded hover:bg-white/10 text-nds-text-tertiary hover:text-nds-text-primary transition-colors">
                <Copy size={14} />
              </button>
              {isOwn && onDelete && (
                <button onClick={() => onDelete?.(message)} className="p-1.5 rounded hover:bg-nds-danger/20 text-nds-text-tertiary hover:text-nds-danger transition-colors">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
