"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useServerStore } from "@/src/store/serverStore";
import { useAuthStore } from "@/src/store/authStore";
import { Plus, Trash2 } from "lucide-react";
import { useChatStore } from "@/src/store/chatStore";
import ServerSettingsModal from "./ServerSettingsModal";
import CreateInviteModal from "./CreateInviteModal";
import LeaveServerModal from "./LeaveServerModal";
import CreateChannelModal from "./CreateChannelModal";
import ChannelContextMenu from "./ChannelContextMenu";
import ChannelSettingsModal from "./ChannelSettingsModal";
import { useServerPermission } from "@/src/hooks/useServerPermission";
import { ServerHeader, TextChannelItem, VoiceChannelItem, ServerDropdownMenu } from "./sidebar";

/**
 * 🎨 ServerSidebar - OPTIMIZED & MODULAR v2.0
 * - Separated into sub-components
 * - Memoized channel items
 * - Reduced re-renders
 */
export default function ServerSidebar({ onJoinChannel, activeTextChannelId }) {
  const { currentServer, channels, deleteServer, members, canUserViewChannel, voiceStates } = useServerStore();
  const { user } = useAuthStore();
  const { unreadCounts, currentChannel, showChatPanel } = useChatStore();
  const canManageChannels = useServerPermission("MANAGE_CHANNELS");
  const canManageServer = useServerPermission("MANAGE_SERVER");

  // State
  const [serverSettings, setServerSettings] = useState({ isOpen: false, initialTab: 'overview' });
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
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

  // ✅ OPTIMIZATION: Memoized computed values
  const currentUserMember = useMemo(() => 
    members.find(m => m.id === user?.uid || m.userId === user?.uid), 
    [members, user?.uid]
  );
  
  const userRoles = currentUserMember?.roles || [];
  const isOwner = currentServer?.ownerId === user?.uid;

  const visibleChannels = useMemo(() => {
    if (!currentServer) return [];
    if (isOwner || canManageChannels) return channels;
    return channels.filter(channel => canUserViewChannel(channel, userRoles));
  }, [channels, isOwner, canManageChannels, userRoles, canUserViewChannel, currentServer]);

  const textChannels = useMemo(() => visibleChannels.filter(c => c.type === 'text'), [visibleChannels]);
  const voiceChannels = useMemo(() => visibleChannels.filter(c => c.type === 'voice'), [visibleChannels]);
  
  const voiceCount = useMemo(() => {
    return voiceStates ? Object.values(voiceStates).flat().length : 0;
  }, [voiceStates]);

  // ✅ OPTIMIZATION: Memoized callbacks
  const hasRestrictions = useCallback((channel) => {
    return channel.permissionOverwrites && Object.keys(channel.permissionOverwrites).length > 0;
  }, []);

  const handleChannelContextMenu = useCallback((e, channel) => {
    e.preventDefault();
    setChannelContextMenu({ x: e.clientX, y: e.clientY, channel });
  }, []);

  const handleCreateChannel = useCallback((type) => {
    setCreateChannelModal({ isOpen: true, type });
    setShowMenu(false);
  }, []);

  const handleDeleteServer = useCallback(() => {
    setDeleteModal({ isOpen: true, type: 'server', data: currentServer });
    setShowMenu(false);
  }, [currentServer]);

  const onConfirmDelete = useCallback(async () => {
    if (deleteModal.type === 'server') {
      await deleteServer(deleteModal.data.id);
    } else if (deleteModal.type === 'channel') {
      await useServerStore.getState().deleteChannel(currentServer.id, deleteModal.data.id);
    }
    setDeleteModal({ isOpen: false, type: null, data: null });
  }, [deleteModal, deleteServer, currentServer?.id]);

  const handleTextChannelClick = useCallback((channel) => {
    const isUserInVoice = Object.values(voiceStates || {}).some(cp => cp?.some(p => p.userId === user?.uid));
    if (!isUserInVoice) { 
      onJoinChannel(channel); 
      return; 
    }
    const { loadChannelMessages, setShowChatPanel, showChatPanel, currentChannel } = useChatStore.getState();
    if (currentChannel?.id === channel.id && showChatPanel) { 
      setShowChatPanel(false); 
    } else { 
      loadChannelMessages(channel.id, currentServer.id); 
      setShowChatPanel(true); 
      onJoinChannel(channel); 
    }
  }, [voiceStates, user?.uid, currentServer?.id, onJoinChannel]);

  if (!currentServer) return null;

  return (
    <div className="w-sidebar h-full flex flex-col shrink-0 relative bg-[#0a0a0c] border-r border-white/5 overflow-hidden">
      {/* Background Effects (Void Theme) */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.03] pointer-events-none" />
      <div className="absolute -top-20 -left-20 w-60 h-60 bg-indigo-600/10 blur-[100px] pointer-events-none" />
      <div className="absolute top-1/2 -right-20 w-40 h-40 bg-purple-600/10 blur-[80px] pointer-events-none" />

      {/* 1. DASHBOARD HEADER */}
      <div className="relative z-30 p-4 pb-2" ref={menuRef}>
        <ServerHeader
          server={currentServer}
          showMenu={showMenu}
          onToggleMenu={() => setShowMenu(!showMenu)}
          voiceCount={voiceCount}
          memberCount={members.length}
        />

        {/* Dropdown Menu */}
        {showMenu && (
          <ServerDropdownMenu
            isOwner={isOwner}
            canManageServer={canManageServer}
            canManageChannels={canManageChannels}
            onInvite={() => { setShowInviteModal(true); setShowMenu(false); }}
            onSettings={() => { setServerSettings({ isOpen: true, initialTab: 'overview' }); setShowMenu(false); }}
            onCreateChannel={() => handleCreateChannel('text')}
            onDeleteServer={handleDeleteServer}
            onLeaveServer={() => { setLeaveModalOpen(true); setShowMenu(false); }}
          />
        )}
      </div>

      {/* 2. CHANNELS SCROLL AREA */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
        
        {/* TEXT CHANNELS */}
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
              const isActive = (currentChannel?.id === channel.id && showChatPanel) || activeTextChannelId === channel.id;
              
              return (
                <TextChannelItem
                  key={channel.id}
                  channel={channel}
                  isActive={isActive}
                  hasUnread={hasUnread}
                  hasRestrictions={hasRestrictions(channel)}
                  onClick={() => handleTextChannelClick(channel)}
                  onContextMenu={(e) => handleChannelContextMenu(e, channel)}
                />
              );
            })}
          </div>
        </div>

        {/* VOICE CHANNELS */}
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
                <VoiceChannelItem
                  key={channel.id}
                  channel={channel}
                  isActive={isActive}
                  participants={participants}
                  hasRestrictions={hasRestrictions(channel)}
                  onClick={() => onJoinChannel(channel)}
                  onContextMenu={(e) => handleChannelContextMenu(e, channel)}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* MODALS */}
      {serverSettings.isOpen && (
        <ServerSettingsModal 
          isOpen={serverSettings.isOpen} 
          onClose={() => setServerSettings({ ...serverSettings, isOpen: false })} 
          initialTab={serverSettings.initialTab}
        />
      )}

      <CreateInviteModal 
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        serverId={currentServer.id}
      />
      
      <LeaveServerModal
        isOpen={leaveModalOpen}
        onClose={() => setLeaveModalOpen(false)}
        onConfirm={async () => {
          await useServerStore.getState().leaveServer(currentServer.id, user.uid);
          setLeaveModalOpen(false);
        }}
        serverName={currentServer.name}
      />

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