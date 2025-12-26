"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useServerStore } from "@/src/store/serverStore";
import { useAuthStore } from "@/src/store/authStore";
import Avatar from "@/src/components/ui/Avatar";
import { 
  Hash, 
  Volume2, 
  Settings, 
  Plus, 
  ChevronDown,
  UserPlus,
  Trash2,
  LogOut,
  Lock,
  MoreVertical,
  Signal,
  MessageSquare,
  MicOff,
  Headphones
} from "lucide-react";
import { useChatStore } from "@/src/store/chatStore";
import ServerSettingsModal from "./ServerSettingsModal";
import CreateChannelModal from "./CreateChannelModal";
import ChannelContextMenu from "./ChannelContextMenu";
import ChannelSettingsModal from "./ChannelSettingsModal";
import { useSettingsStore } from "@/src/store/settingsStore";
import { useServerPermission } from "@/src/hooks/useServerPermission";

export default function ServerSidebar({ onJoinChannel }) {
  const { currentServer, channels, deleteServer, members, canUserViewChannel, voiceStates } = useServerStore();
  const { user } = useAuthStore();
  const { unreadCounts, currentChannel, showChatPanel } = useChatStore();
  const canManageChannels = useServerPermission("MANAGE_CHANNELS");

  // State
  const [serverSettings, setServerSettings] = useState({ isOpen: false, initialTab: 'overview' });
  const [showMenu, setShowMenu] = useState(false);
  const [createChannelModal, setCreateChannelModal] = useState({ isOpen: false, type: 'text' });
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, type: null, data: null });
  const [channelContextMenu, setChannelContextMenu] = useState(null);
  const [channelSettings, setChannelSettings] = useState({ isOpen: false, channel: null, initialTab: "overview" });
  
  const menuRef = useRef(null);

  // Click Outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter Channels
  const currentUserMember = members.find(m => m.id === user?.uid || m.userId === user?.uid);
  const userRoles = currentUserMember?.roles || [];
  const isOwner = currentServer?.ownerId === user?.uid;

  const visibleChannels = useMemo(() => {
    if (!currentServer) return [];
    if (isOwner || canManageChannels) return channels;
    return channels.filter(channel => canUserViewChannel(channel, userRoles));
  }, [channels, isOwner, canManageChannels, userRoles, canUserViewChannel, currentServer]);

  if (!currentServer) return null;

  const textChannels = visibleChannels.filter(c => c.type === 'text');
  const voiceChannels = visibleChannels.filter(c => c.type === 'voice');
  
  const hasRestrictions = (channel) => {
    return channel.permissionOverwrites && Object.keys(channel.permissionOverwrites).length > 0;
  };

  // Actions
  const handleChannelContextMenu = (e, channel) => {
    e.preventDefault();
    setChannelContextMenu({ x: e.clientX, y: e.clientY, channel });
  };

  const handleCreateChannel = (type) => setCreateChannelModal({ isOpen: true, type });
  const handleDeleteServer = () => setDeleteModal({ isOpen: true, type: 'server', data: currentServer });
  const handleDeleteChannel = (channelId, channelName) => setDeleteModal({ isOpen: true, type: 'channel', data: { id: channelId, name: channelName } });

  const onConfirmDelete = async () => {
      if (deleteModal.type === 'server') {
          await deleteServer(deleteModal.data.id);
      } else if (deleteModal.type === 'channel') {
          await useServerStore.getState().deleteChannel(currentServer.id, deleteModal.data.id);
      }
      setDeleteModal({ isOpen: false, type: null, data: null });
  };

  return (
    <div className="w-sidebar h-full flex flex-col shrink-0 relative bg-[#0a0a0c] border-r border-white/5 overflow-hidden">
       {/* Background Effects (Void Theme) */}
       <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.03] pointer-events-none" />
       <div className="absolute -top-20 -left-20 w-60 h-60 bg-indigo-600/10 blur-[100px] pointer-events-none" />
       <div className="absolute top-1/2 -right-20 w-40 h-40 bg-purple-600/10 blur-[80px] pointer-events-none" />

      {/* 1. DASHBOARD HEADER (Not a dropdown bar anymore) */}
      <div className="relative z-30 p-4 pb-2" ref={menuRef}>
        <div 
          onClick={() => setShowMenu(!showMenu)}
          className={`
            relative overflow-hidden
            group flex flex-col justify-between 
            p-4 rounded-3xl cursor-pointer 
            border transition-all duration-300
            ${showMenu 
              ? 'bg-[#1a1b1e] border-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.15)]' 
              : 'bg-gradient-to-br from-[#16171a] to-[#111214] border-white/10 hover:border-white/20 hover:shadow-lg'
            }
          `}
        >
            {/* Header Glow */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-white/5 to-transparent rounded-full blur-2xl -translate-y-10 translate-x-10 group-hover:translate-x-5 transition-transform duration-500" />
            
            <div className="flex items-start justify-between relative z-10">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg overflow-hidden">
                    {currentServer.iconUrl ? (
                        <img 
                            src={currentServer.iconUrl} 
                            alt={currentServer.name}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        currentServer.name.charAt(0).toUpperCase()
                    )}
                </div>
                <div className={`p-2 rounded-xl transition-colors ${showMenu ? 'bg-white/10 text-white' : 'text-[#5c5e66] group-hover:text-white'}`}>
                    <MoreVertical size={18} />
                </div>
            </div>
            
            <div className="mt-3 relative z-10">
                <h1 className="font-bold text-lg text-white tracking-tight truncate">
                  {currentServer.name}
                </h1>
                <div className="flex items-center gap-2 mt-1">
                    <span className="flex w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
                    <span className="text-xs text-[#949ba4] font-medium">
                        {voiceStates ? Object.values(voiceStates).flat().length : 0} Sesli • {members.length} Üye
                    </span>
                </div>
            </div>
        </div>

         {/* Modern Dropdown Menu */}
         {showMenu && (
             <div className="absolute top-[calc(100%)] left-4 right-4 mt-2 bg-[#111214]/95 backdrop-blur-xl rounded-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50 animate-in fade-in zoom-in-95 slide-in-from-top-2 p-2 space-y-1">
                 <button onClick={() => { setServerSettings({ isOpen: true, initialTab: 'invites' }); setShowMenu(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500 hover:text-white transition-all">
                     <UserPlus size={18} />
                     <span className="text-sm font-semibold">Davet Et</span>
                 </button>

                 <div className="h-px bg-white/10 my-1 mx-2" />

                 {isOwner ? (
                     <>
                         <MenuButton icon={<Settings size={18} />} label="Ayarlar" onClick={() => { setServerSettings({ isOpen: true, initialTab: 'overview' }); setShowMenu(false); }} />
                         <MenuButton icon={<Plus size={18} />} label="Kanal Ekle" onClick={() => { handleCreateChannel('text'); setShowMenu(false); }} />
                         <MenuButton icon={<Trash2 size={18} />} label="Sunucuyu Sil" danger onClick={handleDeleteServer} />
                     </>
                 ) : (
                     <MenuButton icon={<LogOut size={18} />} label="Ayrıl" danger onClick={async () => { if(confirm("Ayrıl?")) { await useServerStore.getState().leaveServer(currentServer.id, user.uid); setShowMenu(false); }}} />
                 )}
             </div>
         )}
      </div>

      {/* 2. CHANNELS SCROLL AREA */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
        
        {/* --- TEXT CHANNELS (Compact & Clean) --- */}
        <div>
           <div className="flex items-center justify-between px-2 mb-3">
             <span className="text-[11px] font-extrabold text-[#5c5e66] uppercase tracking-[0.1em]">Sohbet</span>
             {canManageChannels && (
               <button onClick={() => handleCreateChannel('text')} className="text-[#5c5e66] hover:text-white transition-colors">
                 <Plus size={14} />
               </button>
             )}
           </div>

           <div className="space-y-1">
             {textChannels.map(channel => {
                const hasUnread = unreadCounts[channel.id] > 0;
                const isActive = currentChannel?.id === channel.id && showChatPanel;
                
                return (
                 <div
                   key={channel.id}
                   onClick={() => {
                        const isUserInVoice = Object.values(voiceStates || {}).some(cp => cp?.some(p => p.userId === user?.uid));
                        if (!isUserInVoice) { onJoinChannel(channel); return; }
                        const { loadChannelMessages, setShowChatPanel, showChatPanel, currentChannel } = useChatStore.getState();
                        if (currentChannel?.id === channel.id && showChatPanel) { setShowChatPanel(false); } 
                        else { loadChannelMessages(channel.id, currentServer.id); setShowChatPanel(true); onJoinChannel(channel); }
                   }}
                   onContextMenu={(e) => handleChannelContextMenu(e, channel)}
                   className={`
                     group relative flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200
                     ${isActive ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"}
                   `}
                 >
                    {/* Active Pill Indicator */}
                    {isActive && <div className="absolute left-0 h-6 w-1 bg-purple-500 rounded-r-full shadow-[0_0_10px_rgba(168,85,247,0.8)]" />}

                    <MessageSquare size={18} className={`${isActive ? "text-purple-400" : "text-[#5c5e66] group-hover:text-[#949ba4]"} transition-colors`} />
                    
                    <span className={`flex-1 truncate text-sm font-medium ${isActive ? "text-white" : "text-[#949ba4] group-hover:text-[#dbdee1]"}`}>
                      {channel.name}
                    </span>

                    {hasUnread && <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_5px_currentColor]" />}
                    {hasRestrictions(channel) && <Lock size={12} className="text-[#5c5e66]" />}
                 </div>
                );
             })}
           </div>
        </div>

        {/* --- VOICE CHANNELS (Cards / Pods Layout with User List) --- */}
        <div>
           <div className="flex items-center justify-between px-2 mb-3">
             <span className="text-[11px] font-extrabold text-[#5c5e66] uppercase tracking-[0.1em]">Ses Odaları</span>
             {canManageChannels && (
               <button onClick={() => handleCreateChannel('voice')} className="text-[#5c5e66] hover:text-white transition-colors">
                 <Plus size={14} />
               </button>
             )}
           </div>
           
           <div className="space-y-3">
             {voiceChannels.map(channel => {
                 const isActive = voiceStates?.[channel.id]?.some(u => u.userId === user?.uid) || false;
                 const participants = voiceStates?.[channel.id] || [];
                 
                 return (
                   <div key={channel.id} className="flex flex-col">
                     {/* Voice Channel Card */}
                     <div 
                        onClick={() => onJoinChannel(channel)}
                        onContextMenu={(e) => handleChannelContextMenu(e, channel)}
                        className={`
                            group relative p-3 rounded-2xl cursor-pointer border transition-all duration-300
                            ${isActive 
                               ? "bg-gradient-to-br from-[#1a1b1e] to-[#111214] border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.1)]" 
                               : "bg-[#111214] border-white/5 hover:border-white/10 hover:bg-[#16171a]"
                            }
                        `}
                     >
                        {/* Channel Info Row */}
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 overflow-hidden">
                                <div className={`
                                    p-1.5 rounded-lg transition-colors
                                    ${isActive ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/5 text-[#5c5e66] group-hover:text-[#949ba4]'}
                                `}>
                                    {isActive ? <Signal size={14} className="animate-pulse" /> : <Volume2 size={14} />}
                                </div>
                                <span className={`truncate font-semibold text-sm ${isActive ? 'text-white' : 'text-[#949ba4] group-hover:text-white'}`}>
                                    {channel.name}
                                </span>
                            </div>
                            {hasRestrictions(channel) && <Lock size={12} className="text-[#5c5e66]" />}
                        </div>

                        {/* Participants Count Badge */}
                        <div className="flex items-center justify-between">
                            {participants.length > 0 ? (
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-cyan-400 font-semibold">{participants.length} kişi bağlı</span>
                                </div>
                            ) : (
                                <span className="text-[10px] text-[#5c5e66] italic group-hover:text-[#80848e] transition-colors">
                                    Boş oda
                                </span>
                            )}
                            
                            {/* Active Dot if connected */}
                            {isActive && <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]" />}
                        </div>
                     </div>
                     
                     {/* Participants List (Under Channel Card) */}
                     {participants.length > 0 && (
                         <div className="mt-1 ml-3 space-y-0.5">
                             {participants.map((u) => (
                                 <div 
                                     key={u.userId} 
                                     className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] transition-colors cursor-default"
                                 >
                                     {/* Avatar */}
                                     <div className="relative flex-shrink-0">
                                         <div className="w-6 h-6 rounded-full bg-[#2b2d31] flex items-center justify-center overflow-hidden ring-1 ring-white/10">
                                             {u.photoURL ? (
                                                 <img src={u.photoURL} alt={u.username} className="w-full h-full object-cover" />
                                             ) : (
                                                 <span className="text-[9px] text-white font-bold">{u.username?.charAt(0).toUpperCase()}</span>
                                             )}
                                         </div>
                                         {/* Mic/Deaf Indicators */}
                                         {(u.isMuted || u.isDeafened) && (
                                             <div className="absolute -bottom-0.5 -right-0.5 bg-[#111214] rounded-full p-[2px]">
                                                 {u.isDeafened ? <Headphones size={8} className="text-red-400"/> : <MicOff size={8} className="text-red-400"/>}
                                             </div>
                                         )}
                                     </div>
                                     
                                     {/* Username */}
                                     <span className="text-xs text-[#949ba4] font-medium truncate flex-1">
                                         {u.username || "Kullanıcı"}
                                     </span>
                                     
                                     {/* Speaking Indicator (Optional Visual) */}
                                     {!u.isMuted && !u.isDeafened && (
                                         <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.6)]" />
                                     )}
                                 </div>
                             ))}
                         </div>
                     )}
                   </div>
                 );
             })}
           </div>
        </div>
      </div>

      {/* --- MODALS (Reused Logic) --- */}
      {serverSettings.isOpen && (
        <ServerSettingsModal 
          isOpen={serverSettings.isOpen} 
          onClose={() => setServerSettings({ ...serverSettings, isOpen: false })} 
          initialTab={serverSettings.initialTab}
        />
      )}

      <CreateChannelModal 
        isOpen={createChannelModal.isOpen}
        onClose={() => setCreateChannelModal({ ...createChannelModal, isOpen: false })}
        channelType={createChannelModal.type}
        serverId={currentServer.id}
      />

      {deleteModal.isOpen && createPortal(
        <div className="fixed inset-0 z-[10050] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in" onClick={() => setDeleteModal({ ...deleteModal, isOpen: false })}></div>
          <div className="relative w-full max-w-md rounded-3xl border border-white/10 shadow-2xl bg-[#111214] overflow-hidden animate-in zoom-in-95">
             <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent" />
             <div className="p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4 text-red-500">
                   <Trash2 size={32} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">
                  {deleteModal.type === 'server' ? "Sunucuyu Yok Et" : "Kanalı Sil"}
                </h3>
                <p className="text-[#949ba4] mb-6">
                   <span className="text-white font-bold">{deleteModal.data?.name}</span> kalıcı olarak silinecek. Bu işlem geri alınamaz.
                </p>
                <div className="flex gap-3 justify-center">
                    <button onClick={() => setDeleteModal({ ...deleteModal, isOpen: false })} className="px-5 py-2.5 rounded-xl text-[#dbdee1] hover:bg-white/5 transition-colors">Vazgeç</button>
                    <button onClick={onConfirmDelete} className="px-6 py-2.5 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/20">Sil ve Onayla</button>
                </div>
             </div>
          </div>
        </div>,
        document.body
      )}

      {channelContextMenu && (
        <ChannelContextMenu
          x={channelContextMenu.x}
          y={channelContextMenu.y}
          channel={channelContextMenu.channel}
          onClose={() => setChannelContextMenu(null)}
          onOpenSettings={(channel, initialTab) => setChannelSettings({ isOpen: true, channel, initialTab: initialTab || "overview" })}
        />
      )}

      <ChannelSettingsModal
        isOpen={channelSettings.isOpen}
        onClose={() => setChannelSettings({ isOpen: false, channel: null })}
        channel={channelSettings.channel}
        initialTab={channelSettings.initialTab}
      />
    </div>
  );
}

// Yardımcı Menü Butonu Bileşeni
function MenuButton({ icon, label, onClick, danger }) {
    return (
        <button 
            onClick={onClick}
            className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all
                ${danger 
                    ? 'text-red-400 hover:bg-red-500/10 hover:text-red-300' 
                    : 'text-[#949ba4] hover:bg-white/5 hover:text-white'
                }
            `}
        >
            {icon}
            <span className="text-sm font-medium">{label}</span>
        </button>
    )
}