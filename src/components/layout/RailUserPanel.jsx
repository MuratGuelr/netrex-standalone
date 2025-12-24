
"use client";

import { useState, useRef, useEffect } from "react";
import { Settings } from "lucide-react";
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
  const [showStatusMenu, setShowStatusMenu] = useState(false);
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
        setMenuPos({ top: rect.bottom - 40, left: rect.right + 10 }); // Position to the right
    }
    setShowMenu(!showMenu);
  };

  const MenuPortal = () => {
    if (typeof document === 'undefined') return null;
    return createPortal(
      <div 
        data-rail-menu
        className="fixed z-[9999] w-64 bg-[#111214] rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] border border-white/10 p-3 animate-in fade-in zoom-in-95 duration-100 origin-bottom-left"
        style={{ left: menuPos.left, bottom: 20 }} // Fixed bottom-left alignment
      >
          {/* User Header */}
          <div className="flex items-center gap-3 mb-3 pb-3 border-b border-white/5">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm overflow-hidden shadow-lg border border-white/10 shrink-0"
                style={{ background: profileColor }}
              >
                  {user?.photoURL ? (
                    <img src={user.photoURL} alt="User" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-base">{user?.displayName?.charAt(0).toUpperCase() || "?"}</span>
                  )}
              </div>
              <div className="flex flex-col min-w-0">
                  <span className="font-bold text-white text-sm truncate">{user?.displayName || "Misafir"}</span>
                  <div className="flex items-center gap-1.5 cursor-pointer hover:opacity-80" onClick={() => setShowStatusMenu(!showStatusMenu)}>
                      <div className={`w-2 h-2 rounded-full ${
                          userStatus === "online" ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" :
                          userStatus === "offline" ? "bg-gray-500" :
                          "bg-indigo-500"
                      }`} />
                      <span className="text-[10px] text-gray-400 font-medium">
                        {userStatus === "online" ? "Çevrimiçi" : userStatus === "offline" ? "Çevrimdışı" : "Görünmez"}
                      </span>
                  </div>
              </div>
          </div>

          {/* Status Options */}
          <div className="space-y-1 mb-2">
             <button onClick={() => { setUserStatus("online"); setShowMenu(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${userStatus === 'online' ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-gray-300 hover:text-white'}`}>
                <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                <span className="text-sm font-medium">Çevrimiçi</span>
                {userStatus === "online" && <div className="ml-auto w-1.5 h-1.5 bg-white rounded-full opacity-50" />}
             </button>
             
             <button onClick={() => { setUserStatus("invisible"); setShowMenu(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${userStatus === 'invisible' ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-gray-300 hover:text-white'}`}>
                <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                <span className="text-sm font-medium">Görünmez</span>
                {userStatus === "invisible" && <div className="ml-auto w-1.5 h-1.5 bg-white rounded-full opacity-50" />}
             </button>

             <button onClick={() => { setUserStatus("offline"); setShowMenu(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${userStatus === 'offline' ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-gray-300 hover:text-white'}`}>
                <div className="w-2.5 h-2.5 rounded-full bg-gray-500" />
                <span className="text-sm font-medium">Çevrimdışı</span>
                {userStatus === "offline" && <div className="ml-auto w-1.5 h-1.5 bg-white rounded-full opacity-50" />}
             </button>
          </div>

          <div className="h-px bg-white/5 my-1" />

          {/* Settings - Always at bottom */}
          <button 
                onClick={() => {
                   useSettingsStore.getState().setSettingsOpen(true); 
                   setShowMenu(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-gray-300 hover:text-white transition-all"
            >
                <Settings size={18} />
                <span className="text-sm font-medium">Ayarlar</span>
            </button>
      </div>,
      document.body
    );
  };

  return (
    <div ref={containerRef} className="mt-auto pb-4 pt-2 w-full flex flex-col items-center gap-3">
        {/* Separator */}
        <div className="w-8 h-[2px] bg-[#35363c] rounded-lg mb-1 flex-shrink-0" />

        {/* Avatar Trigger */}
        <button 
            onClick={handleAvatarClick}
            className="group relative w-12 h-12 rounded-[24px] hover:rounded-[16px] transition-all duration-300 overflow-hidden shadow-lg border-2 border-transparent hover:border-indigo-500/50"
        >
             <div className="absolute inset-0 bg-[#313338] group-hover:bg-[#232428] transition-colors" />
             
             {/* Avatar Image */}
             <div className="absolute inset-0 flex items-center justify-center font-bold text-white text-lg z-10" style={{ background: !user?.photoURL ? profileColor : 'transparent' }}>
                 {user?.photoURL ? (
                    <img src={user.photoURL} alt="User" className="w-full h-full object-cover" />
                 ) : (
                    user?.displayName?.charAt(0).toUpperCase() || "?"
                 )}
             </div>

             {/* Status Dot */}
             <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-[3px] border-[#1e1f22] z-20 ${
                 userStatus === "online" ? "bg-green-500" :
                 userStatus === "offline" ? "bg-gray-500" :
                 "bg-indigo-500"
             }`} />
        </button>
        
        {showMenu && <MenuPortal />}
    </div>
  );
}
