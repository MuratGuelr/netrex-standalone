import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useServerStore } from "@/src/store/serverStore";
import { useAuthStore } from "@/src/store/authStore";
import Button from "@/src/components/ui/Button";
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
  Mic,
  MicOff,
  Headphones,
  Circle,
  CircleOff,
  EyeOff,
  Loader2,
  Users,
  Lock
} from "lucide-react";
import { useChatStore } from "@/src/store/chatStore";
import ServerSettingsModal from "./ServerSettingsModal";
import CreateChannelModal from "./CreateChannelModal";
import ChannelContextMenu from "./ChannelContextMenu";
import ChannelSettingsModal from "./ChannelSettingsModal";
import { ConfirmModal } from "@/src/components/ui/Modal";
import { useSettingsStore } from "@/src/store/settingsStore";

import { toast } from "sonner";
import { useServerPermission } from "@/src/hooks/useServerPermission";

export default function ServerSidebar({ onJoinChannel, onToggleMemberList, showMemberList }) {
  const { currentServer, channels, createChannel, deleteServer, members, canUserViewChannel, voiceStates } = useServerStore();
  const { user } = useAuthStore();
  const { isMuted, isDeafened, toggleMute, toggleDeaf, userStatus, setUserStatus } = useSettingsStore();
  const { unreadCounts, currentChannel, showChatPanel } = useChatStore();
  const canManageChannels = useServerPermission("MANAGE_CHANNELS");

  // Reset local state when server changes to ensure no ghost highlights
  useEffect(() => {
    // Note: currentChannel and showChatPanel are handled globally by chatStore
  }, [currentServer?.id]);

  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [serverSettings, setServerSettings] = useState({ isOpen: false, initialTab: 'overview' });
  const [showMenu, setShowMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [hoveredChannel, setHoveredChannel] = useState(null);
  const [createChannelModal, setCreateChannelModal] = useState({ isOpen: false, type: 'text' });
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, type: null, data: null });
  
  // Channel context menu & settings state
  const [channelContextMenu, setChannelContextMenu] = useState(null);
  const [channelSettings, setChannelSettings] = useState({ isOpen: false, channel: null, initialTab: "overview" });
  
  const menuRef = useRef(null);
  const userMenuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target) && !event.target.closest('[data-user-menu]')) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Get current user's roles for permission filtering
  const currentUserMember = members.find(m => m.id === user?.uid || m.userId === user?.uid);
  const userRoles = currentUserMember?.roles || [];
  const isOwner = currentServer?.ownerId === user?.uid;

  // Filter channels based on user permissions (owners and admins see all)
  const visibleChannels = useMemo(() => {
    if (!currentServer) return [];
    if (isOwner || canManageChannels) return channels;
    return channels.filter(channel => canUserViewChannel(channel, userRoles));
  }, [channels, isOwner, canManageChannels, userRoles, canUserViewChannel, currentServer]);

  if (!currentServer) return null;

  const textChannels = visibleChannels.filter(c => c.type === 'text');
  const voiceChannels = visibleChannels.filter(c => c.type === 'voice');
  
  // Check if a channel has permission restrictions
  const hasRestrictions = (channel) => {
    return channel.permissionOverwrites && Object.keys(channel.permissionOverwrites).length > 0;
  };
  
  // Handle channel right-click
  const handleChannelContextMenu = (e, channel) => {
    e.preventDefault();
    setChannelContextMenu({
      x: e.clientX,
      y: e.clientY,
      channel
    });
  };

  const handleCreateChannel = (type) => {
    setCreateChannelModal({ isOpen: true, type });
  };
  
  const handleDeleteServer = () => {
    setDeleteModal({
        isOpen: true,
        type: 'server',
        data: currentServer
    });
  };

  const handleDeleteChannel = (channelId, channelName) => {
    setDeleteModal({
        isOpen: true,
        type: 'channel',
        data: { id: channelId, name: channelName }
    });
  };

  const onConfirmDelete = async () => {
      if (deleteModal.type === 'server') {
          await deleteServer(deleteModal.data.id);
      } else if (deleteModal.type === 'channel') {
          await useServerStore.getState().deleteChannel(currentServer.id, deleteModal.data.id);
      }
      setDeleteModal({ isOpen: false, type: null, data: null });
  };

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

  return (
    <div className="w-sidebar h-full flex flex-col flex-shrink-0 select-none relative overflow-hidden bg-[#1e1f22]">
       {/* Background gradient */}
       <div className="absolute inset-0 bg-gradient-to-b from-[#1a1b1e] via-[#16171a] to-[#111214] pointer-events-none" />
      
      {/* Subtle glow effects */}
      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-purple-500/3 to-transparent pointer-events-none" />
      
      {/* Right border */}
      <div className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-white/10 via-white/5 to-white/10" />

      {/* 1. HEADER - Server Dropdown */}
      <div className="relative z-20 px-3 py-4" ref={menuRef}>
        <div className="flex items-center gap-2">
          {/* Server Info Button - Left Side */}
          <button 
              onClick={() => setShowMenu(!showMenu)}
              className={`
                flex-1 flex items-center justify-between 
                px-4 py-3 rounded-2xl 
                cursor-pointer 
                border transition-all duration-300 group 
                min-w-0 relative overflow-hidden
                ${showMenu 
                  ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border-indigo-500/30' 
                  : 'bg-gradient-to-br from-white/5 to-white/[0.02] border-white/5 hover:border-white/10 hover:bg-white/10'
                }
              `}
          >
              <div className="flex flex-col min-w-0 items-start relative z-10">
                  <h1 className="font-bold text-white text-[15px] tracking-tight leading-none truncate w-full text-left drop-shadow-sm">
                    {currentServer.name}
                  </h1>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${showMenu ? 'bg-indigo-400 shadow-[0_0_5px_currentColor]' : 'bg-emerald-500 shadow-[0_0_5px_currentColor]'}`}></span>
                    <span className="text-[10px] text-gray-400 font-medium group-hover:text-gray-300 transition-colors uppercase tracking-wider">
                      {showMenu ? 'Menü Açık' : 'Çevrimiçi'}
                    </span>
                  </div>
              </div>
              
              <div className={`
                 w-7 h-7 rounded-lg flex items-center justify-center
                 transition-all duration-300 flex-shrink-0 ml-1
                 ${showMenu ? 'bg-indigo-500 text-white rotate-180 shadow-lg' : 'bg-white/5 text-gray-400 group-hover:bg-white/10 group-hover:text-white'}
              `}>
                <ChevronDown size={14} strokeWidth={2.5} />
              </div>

              {/* Hover Glow Effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none"></div>
          </button>
          
        </div>

         {/* Dropdown Menu */}
         {showMenu && (
             <div className="absolute top-full left-4 right-4 mt-2 bg-gradient-to-br from-[#1a1b1e] via-[#16171a] to-[#111214] rounded-2xl overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.6)] border border-white/10 z-50 animate-in fade-in zoom-in-95 duration-200 p-2 space-y-1 backdrop-blur-2xl ring-1 ring-black/50">
                 
                 {/* Invite Button - Prominent */}
                 <button 
                      onClick={() => {
                          setServerSettings({ isOpen: true, initialTab: 'invites' });
                          setShowMenu(false);
                      }}
                      className="group flex items-center justify-between w-full px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 bg-indigo-500/10 hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-500/20 border border-indigo-500/20 hover:border-indigo-500"
                 >
                     <span className="text-sm font-bold text-indigo-400 group-hover:text-white transition-colors">İnsanları Davet Et</span>
                     <UserPlus size={16} className="text-indigo-400 group-hover:text-white transition-colors" />
                 </button>

                 <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-1.5 mx-2"></div>

                 {isOwner && (
                     <>
                         <button 
                             onClick={() => {
                                 setServerSettings({ isOpen: true, initialTab: 'overview' });
                                 setShowMenu(false);
                             }}
                             className="group flex items-center justify-between w-full px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 hover:bg-white/5 border border-transparent hover:border-white/5"
                         >
                             <span className="text-sm font-medium text-gray-400 group-hover:text-white transition-colors">Sunucu Ayarları</span>
                             <Settings size={16} className="text-gray-500 group-hover:text-white transition-colors" />
                         </button>
                         
                         <button 
                             onClick={() => {
                                 handleCreateChannel('text');
                                 setShowMenu(false);
                             }}
                             className="group flex items-center justify-between w-full px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 hover:bg-white/5 border border-transparent hover:border-white/5"
                         >
                             <span className="text-sm font-medium text-gray-400 group-hover:text-white transition-colors">Kanal Oluştur</span>
                             <Plus size={16} className="text-gray-500 group-hover:text-white transition-colors" />
                         </button>
                         
                         <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-1.5 mx-2"></div>

                         <button 
                             onClick={handleDeleteServer}
                             className="group flex items-center justify-between w-full px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 hover:bg-red-500/10 border border-transparent hover:border-red-500/20"
                         >
                             <span className="text-sm font-medium text-red-400 group-hover:text-red-300 transition-colors">Sunucuyu Sil</span>
                             <Trash2 size={16} className="text-red-400 group-hover:text-red-300 group-hover:scale-110 transition-transform" />
                         </button>
                     </>
                 )}
                 
                 {!isOwner && (
                      <button 
                         className="group flex items-center justify-between w-full px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 hover:bg-red-500/10 border border-transparent hover:border-red-500/20"
                         onClick={async () => {
                             if(confirm("Sunucudan ayrılmak istediğinize emin misiniz?")) {
                                 const { leaveServer } = useServerStore.getState();
                                 await leaveServer(currentServer.id, user.uid);
                                 setShowMenu(false);
                             }
                         }}
                     >
                         <span className="text-sm font-medium text-red-400 group-hover:text-red-300 transition-colors">Sunucudan Ayrıl</span>
                         <LogOut size={16} className="text-red-400 group-hover:text-red-300 group-hover:translate-x-1 transition-transform" />
                     </button>
                 )}
             </div>
         )}
      </div>

       {/* Divider */}
       <div className="relative z-10 mx-3 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* 2. KANALLAR LİSTESİ */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-3 space-y-4 pt-4 relative z-10">
        
        {/* METİN KANALLARI */}
        <div>
           <div className="flex items-center justify-between px-1 mb-2 group">
             <div className="flex items-center gap-2 cursor-pointer" onClick={() => {}}>
               <div className="w-1 h-3 rounded-full bg-gradient-to-b from-purple-400 to-pink-500" />
               <span className="text-[10px] font-bold text-[#5c5e66] group-hover:text-[#949ba4] uppercase tracking-wider transition-colors">Metin Kanalları</span>
             </div>
              {canManageChannels && (
                <button onClick={() => handleCreateChannel('text')} className="w-6 h-6 flex items-center justify-center rounded-lg text-[#5c5e66] hover:text-white hover:bg-white/10 transition-all duration-200">
                  <Plus size={14} strokeWidth={2} />
                </button>
              )}
           </div>

           <div className="space-y-1">
             {textChannels.map(channel => {
                const hasUnread = unreadCounts[channel.id] > 0;
                // Check if this channel is the current active text channel and the chat panel is visible
                const isActive = currentChannel?.id === channel.id && showChatPanel;
                
                return (
                 <div
                   key={channel.id}
                   onClick={() => {
                        const { loadChannelMessages, setShowChatPanel, showChatPanel, currentChannel } = useChatStore.getState();
                        
                        if (currentChannel?.id === channel.id && showChatPanel) {
                          // If already active and panel is open, toggle it off
                          setShowChatPanel(false);
                        } else {
                          // Otherwise, activate it
                          loadChannelMessages(channel.id, currentServer.id);
                          setShowChatPanel(true);
                          onJoinChannel(channel);
                        }
                   }}
                   onContextMenu={(e) => handleChannelContextMenu(e, channel)}
                   onMouseEnter={() => setHoveredChannel(`text-${channel.id}`)}
                   onMouseLeave={() => setHoveredChannel(null)}
                   className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 relative overflow-hidden ${
                       isActive
                       ? "bg-gradient-to-r from-purple-500/20 to-pink-500/10 border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.15)]"
                       : "hover:bg-white/5 border border-transparent"
                   }`}
                 >
                    {isActive && (
                      <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-transparent pointer-events-none" />
                    )}
                    
                    <div className="flex items-center gap-3 min-w-0 relative z-10">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
                            isActive
                            ? "bg-purple-500/20 text-purple-400"
                            : hasUnread
                              ? "bg-indigo-500/20 text-indigo-400"
                              : "bg-white/5 text-[#5c5e66] group-hover:bg-white/10 group-hover:text-[#949ba4]"
                        }`}>
                           <Hash size={16} />
                        </div>
                        <span className={`truncate text-sm ${
                           isActive ? "font-semibold text-white" : 
                           hasUnread ? "font-semibold text-white" : 
                           "font-medium text-[#949ba4] group-hover:text-white"
                        }`}>
                          {channel.name}
                        </span>
                        {hasRestrictions(channel) && (
                          <Lock size={12} className="text-[#5c5e66] flex-shrink-0" title="Bu kanal belirli rollere kısıtlı" />
                        )}
                    </div>

                    {hasUnread && !isActive && (
                      <div className="px-2 py-0.5 rounded-full bg-indigo-500 text-[10px] font-bold text-white shadow-[0_0_10px_rgba(99,102,241,0.5)]">
                         {unreadCounts[channel.id]}
                      </div>
                    )}

                    {canManageChannels && (
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteChannel(channel.id, channel.name);
                            }}
                            className={`absolute right-2 text-gray-400 hover:text-red-400 p-1 rounded hover:bg-black/20 transition-all ${
                                hoveredChannel === `text-${channel.id}` ? 'opacity-100' : 'opacity-0'
                            }`}
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                 </div>
                );
             })}
           </div>
        </div>

        {/* SES KANALLARI */}
        <div className="mt-4">
           <div className="flex items-center justify-between px-1 mb-2 group">
             <div className="flex items-center gap-2">
               <div className="w-1 h-3 rounded-full bg-gradient-to-b from-cyan-400 to-blue-500" />
               <span className="text-[10px] font-bold text-[#5c5e66] group-hover:text-[#949ba4] uppercase tracking-wider transition-colors">Ses Kanalları</span>
             </div>
             {canManageChannels && (
               <button onClick={() => handleCreateChannel('voice')} className="w-6 h-6 flex items-center justify-center rounded-lg text-[#5c5e66] hover:text-white hover:bg-white/10 transition-all duration-200">
                 <Plus size={14} strokeWidth={2} />
               </button>
             )}
           </div>
           <div className="space-y-1">
             {voiceChannels.map(channel => {
                 // Check if current user is in this voice channel
                 const isActive = voiceStates?.[channel.id]?.some(u => u.userId === user?.uid) || false;
                 
                 return (
                 <div key={channel.id} className="flex flex-col mb-0.5">
                   <div
                     onClick={() => onJoinChannel(channel)}
                     onContextMenu={(e) => handleChannelContextMenu(e, channel)}
                     onMouseEnter={() => setHoveredChannel(`voice-${channel.id}`)}
                     onMouseLeave={() => setHoveredChannel(null)}
                     className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 relative overflow-hidden border border-transparent ${
                        isActive 
                        ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/10 border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                        : "hover:bg-white/5"
                     }`}
                   >
                       {isActive && (
                         <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-transparent pointer-events-none" />
                       )}
                      <div className="flex items-center gap-3 min-w-0 flex-1 relative z-10">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
                              isActive
                              ? "bg-cyan-500/20 text-cyan-400"
                              : "bg-white/5 text-[#5c5e66] group-hover:bg-white/10 group-hover:text-[#949ba4]"
                          }`}>
                             <Volume2 size={16} />
                          </div>
                          <span className={`truncate text-sm ${
                              isActive
                              ? "font-semibold text-white"
                              : "font-medium text-[#949ba4] group-hover:text-white"
                          }`}>
                              {channel.name}
                          </span>
                          {hasRestrictions(channel) && (
                            <Lock size={12} className="text-[#5c5e66] flex-shrink-0" title="Bu kanal belirli rollere kısıtlı" />
                          )}
                      </div>

                      {canManageChannels && (
                          <button 
                              onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteChannel(channel.id, channel.name);
                              }}
                              className={`absolute right-2 text-gray-400 hover:text-red-400 p-1 rounded hover:bg-black/20 transition-all ${
                                  hoveredChannel === `voice-${channel.id}` ? 'opacity-100' : 'opacity-0'
                              }`}
                          >
                              <Trash2 size={14} />
                          </button>
                      )}
                   </div>
                   
                   {/* Connected Users List */}
                   {voiceStates?.[channel.id] && voiceStates[channel.id].length > 0 && (
                       <div className="pl-5 pr-2 pb-1 space-y-1">
                           {voiceStates[channel.id].map((u) => (
                               <div key={u.userId} className="group/user flex items-center gap-2.5 py-1 px-1 rounded-xl transition-all duration-200 hover:bg-gradient-to-r hover:from-white/10 hover:to-transparent border border-transparent hover:border-white/5 cursor-default relative overflow-hidden">
                                   {/* Hover Glow */}
                                   <div className="absolute inset-0 bg-white/5 opacity-0 group-hover/user:opacity-100 transition-opacity duration-300 pointer-events-none" />
                                   
                                   <div className="relative">
                                     <Avatar 
                                         src={u.photoURL} 
                                         fallback={u.username?.substring(0, 2).toUpperCase() || "??"}
                                         className="w-6 h-6 rounded-full border border-white/10 shadow-sm group-hover/user:scale-105 transition-transform duration-200 mr-2"
                                     />
                                   </div>

                                   <span className="relative text-[13px] font-medium text-gray-400 group-hover/user:text-white truncate transition-colors duration-200">
                                       {u.username || "Kullanıcı"}
                                   </span>
                               </div>
                           ))}
                       </div>
                   )}
                 </div>
             )})}
           </div>
        </div>

      </div>

      {serverSettings.isOpen && (
        <ServerSettingsModal 
          isOpen={serverSettings.isOpen} 
          onClose={() => setServerSettings({ ...serverSettings, isOpen: false })} 
          initialTab={serverSettings.initialTab}
        />
      )}

      {/* Create Channel Modal */}
      <CreateChannelModal 
        isOpen={createChannelModal.isOpen}
        onClose={() => setCreateChannelModal({ ...createChannelModal, isOpen: false })}
        channelType={createChannelModal.type}
        serverId={currentServer.id}
      />

      {/* Custom Delete Confirmation Modal */}
      {deleteModal.isOpen && createPortal(
        <div className="fixed inset-0 z-[10050] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-nds-fade-in" onClick={() => setDeleteModal({ ...deleteModal, isOpen: false })}></div>
          
          <div className="relative w-full max-w-md rounded-3xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden animate-nds-scale-in bg-gradient-to-br from-[#1a1b1e] via-[#16171a] to-[#111214]">
             {/* Top Glow & Effects */}
             <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent z-10"></div>
             <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-24 bg-red-500/10 blur-[50px] pointer-events-none"></div>

             <div className="p-8 text-center relative z-10">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-500/20 to-red-900/10 flex items-center justify-center mx-auto mb-6 text-red-500 shadow-[0_0_25px_rgba(239,68,68,0.15)] border border-red-500/20 group">
                    <div className="animate-nds-bounce-subtle">
                      <Trash2 size={40} className="group-hover:scale-110 transition-transform duration-300 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
                    </div>
                </div>
                
                <h3 className="text-2xl font-bold text-white mb-3">
                  {deleteModal.type === 'server' ? "Sunucuyu Sil" : "Kanalı Sil"}
                </h3>
                
                <p className="text-gray-400 text-base mb-8 leading-relaxed">
                   {deleteModal.type === 'server' ? (
                     <>
                       <span className="text-white font-bold">{deleteModal.data?.name}</span> sunucusunu silmek istediğinize emin misiniz? <br/>
                       <span className="text-red-400/80 text-sm mt-2 block">Bu işlem geri alınamaz ve tüm veriler silinir.</span>
                     </>
                   ) : (
                     <>
                       <span className="text-white font-bold">#{deleteModal.data?.name}</span> kanalını silmek istediğinize emin misiniz? <br/>
                       <span className="text-red-400/80 text-sm mt-2 block">Bu işlem geri alınamaz.</span>
                     </>
                   )}
                </p>
                
                <div className="flex gap-4 justify-center">
                    <Button 
                      variant="ghost" 
                      onClick={() => setDeleteModal({ ...deleteModal, isOpen: false })}
                      className="hover:bg-white/5 text-gray-400 hover:text-white px-6 h-11"
                    >
                      İptal
                    </Button>
                    <Button 
                      onClick={onConfirmDelete}
                      className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg shadow-red-500/25 px-8 h-11 border-0"
                    >
                      {deleteModal.type === 'server' ? "Sunucuyu Sil" : "Kanalı Sil"}
                    </Button>
                </div>
             </div>
          </div>
        </div>,
        document.body
      )}

      {/* Channel Context Menu */}
      {channelContextMenu && (
        <ChannelContextMenu
          x={channelContextMenu.x}
          y={channelContextMenu.y}
          channel={channelContextMenu.channel}
          onClose={() => setChannelContextMenu(null)}
          onOpenSettings={(channel, initialTab) => setChannelSettings({ isOpen: true, channel, initialTab: initialTab || "overview" })}
        />
      )}

      {/* Channel Settings Modal */}
      <ChannelSettingsModal
        isOpen={channelSettings.isOpen}
        onClose={() => setChannelSettings({ isOpen: false, channel: null })}
        channel={channelSettings.channel}
        initialTab={channelSettings.initialTab}
      />
    </div>
  );
}
