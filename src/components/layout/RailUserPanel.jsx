"use client";

import { useState, useRef, useEffect } from "react";
import { Settings, ChevronRight, User } from "lucide-react";
import { useAuthStore } from "@/src/store/authStore";
import { useSettingsStore } from "@/src/store/settingsStore";
import { createPortal } from "react-dom";

export default function RailUserPanel() {
  const { user } = useAuthStore();
  const { 
    isMuted, 
    isDeafened, 
    toggleMute, 
    toggleDeaf, 
    userStatus, 
    setUserStatus 
  } = useSettingsStore();

  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const containerRef = useRef(null);

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target) && !event.target.closest('[data-rail-menu]')) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getProfileColor = (userId) => {
    if (!userId) return "#6366f1";
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = hash % 360;
    return `hsl(${hue}, 70%, 50%)`;
  };

  const profileColor = getProfileColor(user?.uid);

  const handleAvatarClick = (e) => {
    e.stopPropagation();
    if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        // Sol rail'in sağında açılması için
        setMenuPos({ top: rect.bottom - 20, left: rect.right + 16 }); 
    }
    setShowMenu(!showMenu);
  };

  // Status stilleri
  const statusConfig = {
    online: { color: "bg-emerald-500", shadow: "shadow-[0_0_10px_rgba(16,185,129,0.6)]", label: "Çevrimiçi" },
    idle: { color: "bg-amber-400", shadow: "shadow-[0_0_10px_rgba(251,191,36,0.6)]", label: "Uzakta" },
    dnd: { color: "bg-red-500", shadow: "shadow-[0_0_10px_rgba(239,68,68,0.6)]", label: "Rahatsız Etme" },
    invisible: { color: "bg-indigo-500", shadow: "shadow-[0_0_10px_rgba(99,102,241,0.6)]", label: "Görünmez" },
    offline: { color: "bg-gray-500", shadow: "", label: "Çevrimdışı" }
  };

  const currentStatus = statusConfig[userStatus] || statusConfig.offline;

  return (
    <>
      <div ref={containerRef} className="mt-auto pb-6 pt-2 w-full flex flex-col items-center gap-4 relative z-50">
          {/* Dekoratif Ayırıcı */}
          <div className="w-8 h-[2px] bg-gradient-to-r from-transparent via-white/10 to-transparent flex-shrink-0" />

          {/* Avatar Trigger Button */}
          <button 
              onClick={handleAvatarClick}
              className={`
                group relative w-12 h-12 transition-all duration-300
                ${showMenu ? 'scale-105' : 'hover:scale-105'}
              `}
          >
               {/* Arka Plan Glow Efekti */}
               <div className={`absolute inset-0 rounded-[18px] bg-indigo-500/20 blur-md transition-opacity duration-300 ${showMenu ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`} />

               {/* Avatar Container */}
               <div className={`
                 relative w-full h-full rounded-[18px] overflow-hidden 
                 border-2 transition-all duration-300
                 ${showMenu 
                    ? 'border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.3)]' 
                    : 'border-white/5 group-hover:border-white/20'
                 }
               `}>
                   <div className="absolute inset-0 bg-[#313338]" />
                   
                   <div className="absolute inset-0 flex items-center justify-center font-bold text-white text-lg z-10" style={{ background: !user?.photoURL ? profileColor : 'transparent' }}>
                       {user?.photoURL ? (
                          <img src={user.photoURL} alt="User" className="w-full h-full object-cover" />
                       ) : (
                          <User size={20} />
                       )}
                   </div>
               </div>

               {/* Status Dot (Avatar Üzerinde) */}
               <div className={`
                 absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-[3px] border-[#1e1f22] z-20 
                 ${currentStatus.color} ${currentStatus.shadow}
                 transition-all duration-300
               `} />
          </button>
      </div>

      {showMenu && typeof document !== 'undefined' && createPortal(
        <div 
          data-rail-menu
          className="
            fixed z-[9999] w-72 
            bg-[#111214]/90 backdrop-blur-xl 
            rounded-3xl border border-white/10 
            shadow-[0_20px_60px_rgba(0,0,0,0.6)] 
            p-2 overflow-hidden
            animate-in fade-in zoom-in-95 slide-in-from-left-4 duration-200
          "
          style={{ left: menuPos.left, bottom: 20 }}
          onContextMenu={(e) => e.preventDefault()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
            {/* Ambient Glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-[50px] pointer-events-none" />

            {/* User Header */}
            <div className="relative p-3 mb-2 rounded-2xl bg-white/5 border border-white/5 overflow-hidden group">
                {/* Header Gradient */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <div className="flex items-center gap-3 relative z-10">
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg overflow-hidden shadow-lg border border-white/10 shrink-0"
                      style={{ background: profileColor }}
                    >
                        {user?.photoURL ? (
                          <img src={user.photoURL} alt="User" className="w-full h-full object-cover" />
                        ) : (
                          user?.displayName?.charAt(0).toUpperCase() || "?"
                        )}
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="font-bold text-white text-[15px] truncate leading-tight">
                          {user?.displayName || "Misafir"}
                        </span>
                        <span className="text-xs text-indigo-400 font-medium truncate mt-0.5">
                          Netrex ID: #{user?.uid?.slice(0,4) || "0000"}
                        </span>
                    </div>
                </div>
            </div>

            {/* Status Section Title */}
            <div className="px-3 py-1.5 text-[10px] font-bold text-[#949ba4] uppercase tracking-wider">
              Durum Ayarla
            </div>

            {/* Status Options List */}
            <div className="space-y-1 mb-2">
               {[
                 { id: "online", label: "Çevrimiçi", color: "bg-emerald-500", shadow: "shadow-[0_0_8px_rgba(16,185,129,0.5)]" },
                 { id: "idle", label: "Uzakta", color: "bg-amber-400", shadow: "shadow-[0_0_8px_rgba(251,191,36,0.5)]" },
                 { id: "invisible", label: "Görünmez", color: "bg-indigo-500", shadow: "shadow-[0_0_8px_rgba(99,102,241,0.5)]" },
                 { id: "offline", label: "Çevrimdışı", color: "bg-gray-500", shadow: "" }
               ].map((status) => (
                 <button 
                    key={status.id}
                    onClick={(e) => { e.stopPropagation(); setUserStatus(status.id); setShowMenu(false); }} 
                    className={`
                      w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 group
                      ${userStatus === status.id 
                        ? 'bg-white/10 text-white shadow-inner' 
                        : 'text-[#949ba4] hover:bg-white/5 hover:text-white'
                      }
                    `}
                 >
                    <div className={`w-2.5 h-2.5 rounded-full ${status.color} ${status.shadow} group-hover:scale-110 transition-transform`} />
                    <span className="text-sm font-medium">{status.label}</span>
                    {userStatus === status.id && (
                       <div className="ml-auto w-1.5 h-1.5 bg-white rounded-full opacity-50 shadow-[0_0_5px_white]" />
                    )}
                 </button>
               ))}
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-2" />

            {/* Settings Button */}
            <button 
                  onClick={(e) => {
                     e.stopPropagation();
                     useSettingsStore.getState().setSettingsOpen(true); 
                     setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-[#dbdee1] hover:text-white transition-all group"
              >
                  <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-indigo-500/20 text-indigo-400 transition-colors">
                    <Settings size={16} />
                  </div>
                  <span className="text-sm font-medium">Uygulama Ayarları</span>
                  <ChevronRight size={14} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0" />
              </button>
        </div>,
        document.body
      )}
    </>
  );
}