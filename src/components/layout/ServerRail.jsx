"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useServerStore } from "@/src/store/serverStore";
import { useAuthStore } from "@/src/store/authStore";
import { Home, Plus, Upload, RefreshCw, Settings, UserPlus, LogOut, Compass } from "lucide-react";
import Tooltip from "@/src/components/ui/Tooltip";
import RailUserPanel from "./RailUserPanel";
import ServerSettingsModal from "@/src/components/server/ServerSettingsModal";
import CreateInviteModal from "@/src/components/server/CreateInviteModal";
import LeaveServerModal from "@/src/components/server/LeaveServerModal";
import { useServerPermission } from "@/src/hooks/useServerPermission";

/**
 * 🚆 ServerRail - Netrex Premium Navigation Rail
 * Logic: Code 1 | Design: Code 2
 */
export default function ServerRail({ onOpenCreateModal }) {
  const { user } = useAuthStore();
  const { 
    servers, 
    currentServer, 
    selectServer, 
    fetchUserServers
  } = useServerStore();
  
  const [serverSettings, setServerSettings] = useState({ isOpen: false, initialTab: 'overview', serverId: null });
  const [inviteModal, setInviteModal] = useState({ isOpen: false, serverId: null });
  const [leaveModal, setLeaveModal] = useState({ isOpen: false, server: null });

  useEffect(() => {
    if (user?.uid) {
      fetchUserServers(user.uid);
    }
  }, [user?.uid, fetchUserServers]);

  const handleHomeClick = () => selectServer(null);
  const handleServerClick = (serverId) => selectServer(serverId);
  
  const handleOpenSettings = (serverId, tab = 'overview') => {
      setServerSettings({ isOpen: true, initialTab: tab, serverId });
  };

  const handleOpenInvite = (serverId) => {
    setInviteModal({ isOpen: true, serverId });
  };
  
  const { leaveServer } = useServerStore();

  const handleLeaveClick = (server) => {
     setLeaveModal({ isOpen: true, server });
  };
  
  const canManageCurrentServer = useServerPermission("MANAGE_SERVER");

  const confirmLeaveServer = async () => {
     if (leaveModal.server) {
        await leaveServer(leaveModal.server.id, user.uid);
        if (currentServer?.id === leaveModal.server.id) {
            selectServer(null);
        }
        setLeaveModal({ isOpen: false, server: null });
     }
  };

  return (
    <nav className="
      w-[72px] h-full 
      bg-gradient-to-b from-[#1a1b1e] via-[#16171a] to-[#111214]
      flex flex-col items-center 
      py-4 gap-2.5
      overflow-y-auto scrollbar-none
      flex-shrink-0 select-none
      border-r border-white/5
    ">
      
      {/* Home Button */}
      <RailItem 
        label="Ana Sayfa" 
        active={!currentServer}
        onClick={handleHomeClick}
        icon={<Home size={24} />}
      />

      <Separator />

      {/* Server List */}
      {servers.map((server) => (
        <RailItem 
          key={server.id}
          serverId={server.id}
          label={server.name}
          active={currentServer?.id === server.id}
          onClick={() => handleServerClick(server.id)}
          iconUrl={server.iconUrl}
          isOwner={server.ownerId === user?.uid}
          canManage={(currentServer?.id === server.id) ? canManageCurrentServer : false}
          onOpenSettings={handleOpenSettings}
          onOpenInvite={handleOpenInvite}
          onLeave={() => handleLeaveClick(server)}
        />
      ))}

      {/* Add Server Button */}
      <RailItem 
        label="Sunucu Ekle"
        active={false}
        onClick={onOpenCreateModal}
        variant="success"
        icon={<Plus size={24} />}
      />
      
      {/* User Panel (Fixed at Bottom with margin auto to push it down) */}
      <div className="mt-auto w-full flex justify-center pb-2">
         <RailUserPanel />
      </div>

      {/* Modals */}
      {serverSettings.isOpen && (
        <ServerSettingsModal 
          isOpen={serverSettings.isOpen} 
          onClose={() => setServerSettings({ ...serverSettings, isOpen: false })} 
          initialTab={serverSettings.initialTab}
        />
      )}

      {inviteModal.isOpen && (
        <CreateInviteModal
          isOpen={inviteModal.isOpen}
          onClose={() => setInviteModal({ isOpen: false, serverId: null })}
          serverId={inviteModal.serverId}
        />
      )}

      {leaveModal.isOpen && (
        <LeaveServerModal 
            isOpen={leaveModal.isOpen}
            onClose={() => setLeaveModal({ isOpen: false, server: null })}
            onConfirm={confirmLeaveServer}
            serverName={leaveModal.server?.name}
        />
      )}
    </nav>
  );
}

/**
 * 🎨 RailItem - Tasarım 2. koddaki yapıya uyarlandı
 */
function RailItem({ 
  label, 
  active, 
  onClick, 
  icon = null, 
  iconUrl = null, 
  variant = "default", // default | success | explore
  serverId = null,
  isOwner = false,
  canManage = false,
  onOpenSettings,
  onOpenInvite,
  onLeave
}) {
  const [localIcon, setLocalIcon] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const fileInputRef = useRef(null);

  // Local Storage Icon Logic
  useEffect(() => {
    if (serverId) {
      const stored = localStorage.getItem(`server_icon_${serverId}`);
      if (stored) setLocalIcon(stored);
    }
  }, [serverId]);

  const handleContextMenu = (e) => {
    if (!serverId) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    let top = rect.top;
    if (top + 300 > window.innerHeight) top = window.innerHeight - 300;
    setMenuPos({ top, left: rect.right + 12 });
    setShowMenu(true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
            localStorage.setItem(`server_icon_${serverId}`, ev.target.result);
            setLocalIcon(ev.target.result);
        } catch (err) { alert("Resim çok büyük."); }
      };
      reader.readAsDataURL(file);
    }
    setShowMenu(false);
  };

  const effectiveIcon = localIcon || iconUrl;
  
  // Icon Content Logic
  const renderIcon = () => {
    if (effectiveIcon) {
       return <img src={effectiveIcon} alt={label} className="w-full h-full object-cover" />;
    }
    
    // Variant specific text colors for non-image icons
    let iconClass = "transition-colors duration-300 ";
    if (variant === "success") iconClass += "text-emerald-400 group-hover:text-white";
    else if (variant === "explore") iconClass += "text-amber-400 group-hover:text-white";
    else iconClass += active ? "text-white" : "text-indigo-200/80 group-hover:text-white";

    return (
      <div className={`${iconClass} font-bold text-sm tracking-wide`}>
         {icon ? icon : label.substring(0, 2).toUpperCase()}
      </div>
    );
  };

  return (
    <div className="relative group w-full flex justify-center py-0.5" onContextMenu={handleContextMenu}>
      
      {/* 1. Active Indicator (Pill) - Tasarım 2 stili */}
      <div className={`
        absolute left-0 top-1/2 -translate-y-1/2
        w-[4px] bg-white rounded-r-md
        transition-all duration-300 ease-out z-20 shadow-[0_0_10px_rgba(255,255,255,0.5)]
        ${active 
            ? 'h-9 opacity-100 translate-x-0' 
            : 'h-2 opacity-0 -translate-x-full group-hover:h-5 group-hover:opacity-100 group-hover:translate-x-0'
        }
      `} />

      {/* 2. Main Icon Container - Tasarım 2 stili (Squircle Animation) */}
      <Tooltip content={label} position="right" delay={0}>
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
          {renderIcon()}
        </button>
      </Tooltip>

      {/* 3. Context Menu Portal */}
      {showMenu && <ContextMenu 
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
         clearLocalIcon={() => { localStorage.removeItem(`server_icon_${serverId}`); setLocalIcon(null); setShowMenu(false); }}
      />}
    </div>
  );
}

/**
 * ➖ Separator - Tasarım 2
 */
function Separator() {
  return (
    <div className="w-8 h-[2px] bg-white/5 rounded-full my-1.5 flex-shrink-0" />
  );
}

/**
 * 🖱️ Context Menu (Portal) - Tasarım 2 Görünümü ile
 */
function ContextMenu({ menuPos, onClose, isOwner, canManage, serverId, onOpenSettings, onOpenInvite, onLeave, fileInputRef, handleFileChange, hasLocalIcon, clearLocalIcon }) {
    if (typeof document === 'undefined') return null;
    
    return createPortal(
      <>
        {/* Backdrop */}
        <div 
            className="fixed inset-0 z-[9999]" 
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            onContextMenu={(e) => { e.preventDefault(); onClose(); }}
        />
        
        {/* Menu - Void Theme / Premium Dark Style */}
        <div 
           className="
             fixed z-[10000] w-56
             bg-[#0d0e10]/95
             backdrop-blur-xl
             rounded-xl overflow-hidden 
             shadow-[0_8px_32px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.05)]
             border border-white/[0.08]
             p-1.5 space-y-0.5
             animate-in fade-in zoom-in-95 duration-150 origin-top-left
           "
           style={{ top: menuPos.top, left: menuPos.left }}
        >
           {/* Section 1: Actions */}
           <div className="px-2.5 py-1.5 text-[10px] font-semibold text-[#5c5e66] uppercase tracking-wider">
             Sunucu
           </div>
           
           
           <MenuBtn icon={<UserPlus size={14}/>} label="İnsanları Davet Et" onClick={() => { onClose(); onOpenInvite(serverId); }} color="indigo" />
           
           <div className="h-px bg-white/[0.06] my-1" />

           {(isOwner || canManage) && (
               <MenuBtn icon={<Settings size={14}/>} label="Sunucu Ayarları" onClick={() => { onClose(); onOpenSettings(serverId, 'overview'); }} />
           )}

           {!isOwner && (
               <MenuBtn icon={<LogOut size={14}/>} label="Sunucudan Ayrıl" onClick={() => { onClose(); onLeave(); }} color="red" />
           )}

           {/* Section 2: Customization */}
           <div className="h-px bg-white/[0.06] my-1" />
           <div className="px-2.5 py-1.5 text-[10px] font-semibold text-[#5c5e66] uppercase tracking-wider">
             Simge Yönetimi
           </div>
           
           <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
           <MenuBtn icon={<Upload size={14}/>} label="Simge Değiştir" onClick={() => fileInputRef.current?.click()} />
           
           {hasLocalIcon && (
               <MenuBtn icon={<RefreshCw size={14}/>} label="Varsayılanı Geri Yükle" onClick={clearLocalIcon} color="red" />
           )}
        </div>
      </>,
      document.body
    );
}

// Void Theme Menu Button
function MenuBtn({ icon, label, onClick, color = "default" }) {
    const colors = {
        default: "text-[#b5bac1] hover:bg-white/[0.06] hover:text-white",
        indigo: "text-indigo-400 hover:bg-indigo-500/15 hover:text-indigo-300",
        red: "text-red-400 hover:bg-red-500/15 hover:text-red-300",
    };

    return (
        <button 
            onClick={onClick}
            className={`
                w-full text-left px-2.5 py-2 rounded-lg text-[13px] font-medium 
                transition-all duration-150 flex items-center gap-2.5 group
                ${colors[color]}
            `}
        >
            <span className="opacity-70 group-hover:opacity-100 transition-opacity">
                {icon}
            </span>
            {label}
        </button>
    )
}