"use client";

import { useState, useRef, useEffect, useMemo, useCallback, memo } from "react";
import Tooltip from "@/src/components/ui/Tooltip";
import RailContextMenu from "./RailContextMenu";

/**
 * 🎨 RailItem - OPTIMIZED Server Icon Item
 * Memoized with custom comparison
 */
const RailItem = memo(function RailItem({ 
  label, 
  active, 
  onClick, 
  icon = null, 
  iconUrl = null, 
  variant = "default",
  serverId = null,
  isOwner = false,
  canManage = false,
  onOpenSettings,
  onOpenInvite,
  onLeave,
  isRoomActive
}) {
  const [localIcon, setLocalIcon] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const fileInputRef = useRef(null);

  // ✅ Lazy load local storage icon
  useEffect(() => {
    if (serverId) {
      const stored = localStorage.getItem(`server_icon_${serverId}`);
      if (stored) setLocalIcon(stored);
    }
  }, [serverId]);

  const handleContextMenu = useCallback((e) => {
    if (!serverId) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    let top = rect.top;
    if (top + 300 > window.innerHeight) top = window.innerHeight - 300;
    setMenuPos({ top, left: rect.right + 12 });
    setShowMenu(true);
  }, [serverId]);

  const handleFileChange = useCallback((e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          localStorage.setItem(`server_icon_${serverId}`, ev.target.result);
          setLocalIcon(ev.target.result);
        } catch (err) { 
          alert("Resim çok büyük."); 
        }
      };
      reader.readAsDataURL(file);
    }
    setShowMenu(false);
  }, [serverId]);

  const clearLocalIcon = useCallback(() => {
    localStorage.removeItem(`server_icon_${serverId}`);
    setLocalIcon(null);
    setShowMenu(false);
  }, [serverId]);

  const effectiveIcon = localIcon || iconUrl;
  
  // ✅ Memoize icon rendering
  const iconContent = useMemo(() => {
    if (effectiveIcon) {
      return (
        <img 
          src={effectiveIcon} 
          alt={label} 
          className={`w-full h-full object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setImageLoaded(true)}
          loading="lazy"
        />
      );
    }
    
    let iconClass = "transition-colors duration-300 ";
    if (variant === "success") iconClass += "text-emerald-400 group-hover:text-white";
    else if (variant === "explore") iconClass += "text-amber-400 group-hover:text-white";
    else iconClass += active ? "text-white" : "text-indigo-200/80 group-hover:text-white";

    return (
      <div className={`${iconClass} font-bold text-sm tracking-wide`}>
        {icon ? icon : label.substring(0, 2).toUpperCase()}
      </div>
    );
  }, [effectiveIcon, label, icon, variant, active, imageLoaded]);

  return (
    <div className="relative group w-full flex justify-center py-0.5" onContextMenu={handleContextMenu}>
      
      {/* Active Indicator */}
      <div className={`
        absolute left-0 top-1/2 -translate-y-1/2
        w-[4px] bg-white rounded-r-md
        transition-all duration-300 ease-out z-20 shadow-[0_0_10px_rgba(255,255,255,0.5)]
        ${active 
          ? 'h-9 opacity-100 translate-x-0' 
          : 'h-2 opacity-0 -translate-x-full group-hover:h-5 group-hover:opacity-100 group-hover:translate-x-0'
        }
      `} />

      {/* Main Icon Container */}
      <Tooltip 
        content={isRoomActive && !active ? "Önce sesli sohbetten ayrılmalısın" : label} 
        position="right" 
        delay={0}
      >
        <button
          onClick={onClick}
          className={`
            relative
            w-12 h-12 
            rounded-[24px] 
            hover:rounded-[15px] 
            flex items-center justify-center
            transition-all duration-300 ease-out
            overflow-hidden
            group
            z-10
            transform-gpu will-change-transform
            ${active 
              ? 'rounded-[15px] bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-[0_4px_12px_rgba(99,102,241,0.4)] ring-1 ring-white/10' 
              : 'bg-[#313338] hover:bg-gradient-to-br hover:from-indigo-500 hover:to-indigo-600 hover:shadow-lg'
            }
            ${variant === 'success' && !active ? '!bg-[#313338] hover:!from-emerald-500 hover:!to-emerald-600' : ''}
            ${variant === 'explore' && !active ? '!bg-[#313338] hover:!from-amber-500 hover:!to-amber-600' : ''}
          `}
        >
          {iconContent}
        </button>
      </Tooltip>

      {/* Context Menu Portal */}
      {showMenu && <RailContextMenu 
        menuPos={menuPos} 
        onClose={() => setShowMenu(false)}
        isOwner={isOwner}
        canManage={canManage}
        serverId={serverId}
        onOpenSettings={onOpenSettings}
        onOpenInvite={onOpenInvite}
        onLeave={onLeave}
        fileInputRef={fileInputRef}
        handleFileChange={handleFileChange}
        hasLocalIcon={!!localIcon}
        clearLocalIcon={clearLocalIcon}
      />}
    </div>
  );
}, (prevProps, nextProps) => {
  // ✅ Custom comparison for memo
  return (
    prevProps.label === nextProps.label &&
    prevProps.active === nextProps.active &&
    prevProps.iconUrl === nextProps.iconUrl &&
    prevProps.isOwner === nextProps.isOwner &&
    prevProps.canManage === nextProps.canManage &&
    prevProps.variant === nextProps.variant &&
    prevProps.isRoomActive === nextProps.isRoomActive
  );
});

export default RailItem;
