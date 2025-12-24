"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useServerStore } from "@/src/store/serverStore";
import { useAuthStore } from "@/src/store/authStore";
import { Home, Plus, Upload, RefreshCw, Settings, UserPlus, LogOut, Trash2 } from "lucide-react";
import Tooltip from "@/src/components/ui/Tooltip";
import { useSettingsStore } from "@/src/store/settingsStore"; // If needed for theme/colors
import RailUserPanel from "./RailUserPanel";
import ServerSettingsModal from "@/src/components/server/ServerSettingsModal";
import { useServerPermission } from "@/src/hooks/useServerPermission";

/**
 * 🚆 ServerRail - Leftmost navigation rail
 * Displays joined servers and home button
 */
export default function ServerRail({ onOpenCreateModal }) {
  const { user } = useAuthStore();
  const { 
    servers, 
    currentServer, 
    selectServer, 
    fetchUserServers
  } = useServerStore();

  useEffect(() => {
    if (user?.uid) {
      fetchUserServers(user.uid);
    }
  }, [user?.uid, fetchUserServers]);

  const handleHomeClick = () => {
    selectServer(null); // Select Home
  };

  const handleServerClick = (serverId) => {
    selectServer(serverId);
  };
  
  const [serverSettings, setServerSettings] = useState({ isOpen: false, initialTab: 'overview', serverId: null });

  const handleOpenSettings = (serverId, tab = 'overview') => {
      setServerSettings({ isOpen: true, initialTab: tab, serverId });
  };
  
  const { deleteServer, leaveServer } = useServerStore();

  const handleLeaveServer = async (server) => {
      if(confirm(`"${server.name}" sunucusundan ayrılmak istediğinize emin misiniz?`)) {
          await leaveServer(server.id, user.uid);
          selectServer(null);
      }
  };
  
  const handleDeleteServer = async (server) => {
     // Usually handled in settings, but if we add it here, we should probably just open settings
     // or use a confirmation. Let's redirect to settings "Danger Zone" effectively.
     setServerSettings({ isOpen: true, initialTab: 'overview', serverId: server.id });
  };

  return (
    <nav className="
      w-[72px] 
      h-full 
      bg-gradient-to-b from-[#1a1b1e] via-[#16171a] to-[#111214]
      flex flex-col items-center 
      py-4
      gap-2.5
      overflow-y-auto 
      scrollbar-none
      flex-shrink-0
      select-none
      border-r border-white/5
    ">
      {/* Home Button */}
      <RailItem 
        label="Ana Sayfa" 
        active={!currentServer}
        onClick={handleHomeClick}
      >
        <Home size={24} />
      </RailItem>

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
          server={server}
          isOwner={server.ownerId === user?.uid}
          onOpenSettings={handleOpenSettings}
          onLeave={() => handleLeaveServer(server)}
        />
      ))}

      {/* Add Server Button */}
      <RailItem 
        label="Sunucu Ekle"
        active={false}
        onClick={onOpenCreateModal}
        variant="success"
      >
        <Plus size={24} className="text-emerald-400 group-hover:text-white transition-colors duration-300" />
      </RailItem>

      {/* User Panel */}
      <RailUserPanel />

      {serverSettings.isOpen && (
        <ServerSettingsModal 
          isOpen={serverSettings.isOpen} 
          onClose={() => setServerSettings({ ...serverSettings, isOpen: false })} 
          initialTab={serverSettings.initialTab}
          // We need to ensure the modal knows WHICH server if we are not editing currentServer?
          // ServerSettingsModal typically uses 'currentServer' from store. 
          // If we right click a server that is NOT active, we might need to select it first?
          // Let's assume user wants to edit the selected server or we select it.
          // Ideally we select it when opening settings.
        />
      )}
    </nav>
  );
}

function RailItem({ 
  label, 
  active, 
  onClick, 
  children, 
  iconUrl = null, 
  variant = "default",
  serverId = null,
  server = null,
  isOwner = false,
  onOpenSettings,
  onLeave
}) {
  const [localIcon, setLocalIcon] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const fileInputRef = useRef(null);

  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

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
    // Adjust position if too low
    let top = rect.top;
    if (top + 300 > window.innerHeight) {
        top = window.innerHeight - 300;
    }
    setMenuPos({ top: top, left: rect.right + 10 });
    setShowMenu(true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target.result;
        try {
            localStorage.setItem(`server_icon_${serverId}`, result);
            setLocalIcon(result);
        } catch (err) {
            console.error("Local storage limit reached?", err);
            alert("Resim çok büyük, kaydedilemedi.");
        }
      };
      reader.readAsDataURL(file);
    }
    setShowMenu(false);
  };

  const clearLocalIcon = () => {
    localStorage.removeItem(`server_icon_${serverId}`);
    setLocalIcon(null);
    setShowMenu(false);
    setShowMenu(false);
  };

  const effectiveIcon = localIcon || iconUrl;
  const isEmoji = effectiveIcon && !effectiveIcon.startsWith("http") && !effectiveIcon.startsWith("data:");

  const MenuPortal = () => {
      if (typeof document === 'undefined') return null;
      return createPortal(
        <>
          <div 
             className="fixed inset-0 z-[9999]" 
             onClick={(e) => {
                 e.stopPropagation();
                 setShowMenu(false);
             }}
             onContextMenu={(e) => {
                 e.preventDefault();
                 setShowMenu(false);
             }}
          ></div>
          <div 
             className="fixed z-[10000] w-64 bg-gradient-to-br from-[#1a1b1e] via-[#16171a] to-[#111214] rounded-2xl overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.6)] border border-white/10 p-2 space-y-1 backdrop-blur-2xl ring-1 ring-black/50 animate-in fade-in zoom-in-95 duration-200 origin-top-left"
             style={{ top: menuPos.top, left: menuPos.left }}
          >
            <div className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 border-b border-white/5 mx-1">
              Sunucu
            </div>
            
            <button 
                onClick={() => { setShowMenu(false); onOpenSettings(serverId, 'invites'); }}
                className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-indigo-300 hover:bg-indigo-500/10 transition-all flex items-center gap-2.5 group"
            >
                <UserPlus size={14} className="text-indigo-400 group-hover:text-indigo-300 transition-colors" />
                İnsanları Davet Et
            </button>
            <div className="h-px bg-white/5 my-1 mx-2" />

             {isOwner && (
                 <button 
                    onClick={() => { setShowMenu(false); onOpenSettings(serverId, 'overview'); }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-gray-300 hover:bg-white/5 hover:text-white transition-all flex items-center gap-2.5 group"
                >
                    <Settings size={14} className="text-gray-400 group-hover:text-white transition-colors" />
                    Sunucu Ayarları
                </button>
             )}
             
            {!isOwner && (
                <button 
                    onClick={() => { setShowMenu(false); onLeave(); }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-red-400 hover:bg-red-500/10 transition-all flex items-center gap-2.5"
                >
                    <LogOut size={14} />
                    Sunucudan Ayrıl
                </button>
            )}

            <div className="h-px bg-white/5 my-1 mx-2" />
            <div className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 border-b border-white/5 mx-1">
              Simge Yönetimi
            </div>
            <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-gray-300 hover:bg-white/5 hover:text-white transition-all flex items-center gap-2.5 group"
            >
                <Upload size={14} className="group-hover:text-indigo-400 transition-colors" />
                Simge Değiştir
            </button>
            {localIcon && (
                <button 
                    onClick={clearLocalIcon}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-red-400 hover:bg-red-500/10 transition-all flex items-center gap-2.5"
                >
                    <RefreshCw size={14} />
                    Varsayılanı Geri Yükle
                </button>
            )}
          </div>
        </>,
        document.body
      );
  };

  return (
    <div className="relative group w-full flex justify-center py-0.5" onContextMenu={handleContextMenu}>
      {/* Context Menu */}
      {showMenu && <MenuPortal />}
      
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/*" 
        className="hidden" 
      />

      {/* Active Indicator (Pill) */}
      <div className={`
        absolute left-0 top-1/2 -translate-y-1/2
        w-[4px] bg-white rounded-r-md
        transition-all duration-300 ease-out z-20 shadow-[0_0_10px_rgba(255,255,255,0.5)]
        ${active ? 'h-9 opacity-100 translate-x-0' : 'h-2 opacity-0 -translate-x-full group-hover:h-5 group-hover:opacity-100 group-hover:translate-x-0'}
      `} />

      <Tooltip content={label} position="right" delay={0}>
        <button
          onClick={onClick}
          className={`
            relative
            w-12 h-12 
            rounded-[24px] 
            hover:rounded-[15px] 
            ${active 
                ? 'rounded-[15px] bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-[0_4px_12px_rgba(99,102,241,0.4)] ring-1 ring-white/10' 
                : 'bg-[#313338] hover:bg-gradient-to-br hover:from-indigo-500 hover:to-indigo-600 hover:shadow-lg'
            }
            ${variant === 'success' && !active 
                ? 'bg-[#313338] hover:from-emerald-500 hover:to-green-500' 
                : ''
            }
            flex items-center justify-center
            transition-all duration-300 ease-out
            group
            overflow-hidden
            z-10
            ${isEmoji ? 'bg-[#2b2d31]' : ''}
          `}
        >
          {effectiveIcon ? (
            isEmoji ? (
                 <span className="text-2xl select-none filter group-hover:drop-shadow-md transition-all">{effectiveIcon}</span>
            ) : (
                 <img src={effectiveIcon} alt={label} className="w-full h-full object-cover" />
            )
          ) : (
            <div className={`
              text-indigo-200/80 
              ${active ? 'text-white' : 'group-hover:text-white'}
              ${variant === 'success' ? 'text-emerald-400 group-hover:text-white' : ''}
              transition-colors duration-300
              font-bold text-sm tracking-wide
            `}>
              {children || label.substring(0, 2).toUpperCase()}
            </div>
          )}
        </button>
      </Tooltip>
    </div>
  );
}

function Separator() {
  return (
    <div className="w-8 h-[2px] bg-white/5 rounded-full my-1.5 flex-shrink-0" />
  );
}
