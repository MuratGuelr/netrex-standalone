"use client";

/**
 * 👤 Avatar - User Avatar Component
 * NDS v2.0 - Netrex Design System
 * 
 * Features: sizes, status indicator, fallback initials, speaking state
 */

import { forwardRef } from "react";

// Avatar color palette based on user ID
const AVATAR_COLORS = [
  "#6366f1", // Indigo
  "#a855f7", // Purple
  "#ec4899", // Pink
  "#22c55e", // Green
  "#3b82f6", // Blue
  "#f97316", // Orange
  "#eab308", // Yellow
  "#14b8a6", // Teal
  "#ef4444", // Red
  "#8b5cf6", // Violet
];

// Generate consistent color from string
const getColorFromString = (str) => {
  if (!str) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

// Get initials from name
const getInitials = (name, maxChars = 2) => {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return parts
    .slice(0, maxChars)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
};

const Avatar = forwardRef(function Avatar({
  src,
  alt,
  name,
  size = "md",
  status,
  speaking = false,
  muted = false,
  deafened = false,
  color,
  className = "",
  ...props
}, ref) {
  const avatarColor = color || getColorFromString(name);
  const initials = getInitials(name);

  // Size configurations
  const sizeConfig = {
    xs: { avatar: "w-5 h-5", text: "text-[8px]", status: "w-2 h-2", statusRing: "w-2.5 h-2.5" },
    sm: { avatar: "w-6 h-6", text: "text-[9px]", status: "w-2.5 h-2.5", statusRing: "w-3 h-3" },
    md: { avatar: "w-8 h-8", text: "text-small", status: "w-2.5 h-2.5", statusRing: "w-3.5 h-3.5" },
    lg: { avatar: "w-10 h-10", text: "text-body", status: "w-3 h-3", statusRing: "w-4 h-4" },
    xl: { avatar: "w-16 h-16", text: "text-h4", status: "w-4 h-4", statusRing: "w-5 h-5" },
    "2xl": { avatar: "w-24 h-24", text: "text-h2", status: "w-5 h-5", statusRing: "w-6 h-6" },
  };

  const config = sizeConfig[size];

  // Status color
  const getStatusColor = () => {
    if (status === "online") return "bg-nds-online";
    if (status === "offline") return "bg-nds-offline";
    if (status === "invisible") return "bg-nds-invisible";
    if (status === "dnd") return "bg-nds-danger";
    if (status === "idle") return "bg-nds-warning";
    return null;
  };

  const statusColor = getStatusColor();

  return (
    <div 
      ref={ref}
      className={`
        relative inline-flex
        ${className}
      `}
      {...props}
    >
      {/* Avatar Container */}
      <div
        className={`
          ${config.avatar}
          rounded-lg
          flex items-center justify-center
          overflow-hidden
          flex-shrink-0
          font-semibold text-white
          transition-all duration-normal
          
          ${speaking ? "ring-2 ring-nds-success animate-nds-speaking" : ""}
          ${muted || deafened ? "opacity-50 grayscale" : ""}
        `}
        style={{ backgroundColor: !src ? avatarColor : undefined }}
      >
        {src ? (
          <img
            src={src}
            alt={alt || name}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.style.display = "none";
              e.target.parentNode.querySelector(".avatar-fallback")?.classList.remove("hidden");
            }}
          />
        ) : null}
        
        {/* Fallback Initials */}
        <span 
          className={`
            avatar-fallback
            ${config.text}
            ${src ? "hidden" : ""}
          `}
        >
          {initials}
        </span>
      </div>

      {/* Status Indicator */}
      {statusColor && (
        <div 
          className={`
            absolute -bottom-0.5 -right-0.5
            ${config.statusRing}
            bg-nds-bg-primary
            rounded-full
            flex items-center justify-center
          `}
        >
          <div 
            className={`
              ${config.status}
              rounded-full
              ${statusColor}
            `}
          />
        </div>
      )}

      {/* Speaking Ring Animation */}
      {speaking && (
        <div 
          className={`
            absolute inset-0
            rounded-lg
            border-2 border-nds-success
            animate-nds-speaking-ring
            pointer-events-none
          `}
        />
      )}
    </div>
  );
});

export default Avatar;

/**
 * 👥 AvatarGroup - Stack of avatars with overflow indicator
 */
export function AvatarGroup({
  avatars = [],
  max = 4,
  size = "md",
  className = "",
}) {
  const visible = avatars.slice(0, max);
  const remaining = avatars.length - max;

  const offsetStyles = {
    xs: "-ml-1.5",
    sm: "-ml-2",
    md: "-ml-2.5",
    lg: "-ml-3",
    xl: "-ml-4",
    "2xl": "-ml-6",
  };

  return (
    <div className={`flex items-center ${className}`}>
      {visible.map((avatar, index) => (
        <div
          key={avatar.id || index}
          className={`
            ${index > 0 ? offsetStyles[size] : ""}
            ring-2 ring-nds-bg-primary rounded-lg
          `}
        >
          <Avatar
            src={avatar.src}
            name={avatar.name}
            status={avatar.status}
            size={size}
          />
        </div>
      ))}
      
      {remaining > 0 && (
        <div 
          className={`
            ${offsetStyles[size]}
            ring-2 ring-nds-bg-primary
          `}
        >
          <div 
            className={`
              ${size === "xs" ? "w-5 h-5 text-[8px]" : 
                size === "sm" ? "w-6 h-6 text-[9px]" :
                size === "md" ? "w-8 h-8 text-small" :
                size === "lg" ? "w-10 h-10 text-body" : "w-16 h-16 text-h4"}
              rounded-lg
              bg-nds-bg-elevated
              flex items-center justify-center
              text-nds-text-tertiary
              font-medium
            `}
          >
            +{remaining}
          </div>
        </div>
      )}
    </div>
  );
}
