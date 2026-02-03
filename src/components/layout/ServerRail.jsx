"use client";

import { useEffect, useState, useMemo, useCallback, memo } from "react";
import { useServerStore } from "@/src/store/serverStore";
import { useAuthStore } from "@/src/store/authStore";
import { toast } from "@/src/utils/toast";
import { Home, Plus } from "lucide-react";
import RailUserPanel from "./RailUserPanel";
import ServerSettingsModal from "@/src/components/server/ServerSettingsModal";
import CreateInviteModal from "@/src/components/server/CreateInviteModal";
import LeaveServerModal from "@/src/components/server/LeaveServerModal";
import { useServerPermission } from "@/src/hooks/useServerPermission";
import { RailItem, RailSeparator } from "./server-rail";

/**
 * 🚆 ServerRail - OPTIMIZED & MODULAR v2.0
 * - Separated into sub-components
 * - React.memo for performance
 * - Clean and maintainable
 */
export default function ServerRail({ onOpenCreateModal, isRoomActive }) {
  const { user } = useAuthStore();
  const { 
    servers, 
    currentServer, 
    selectServer, 
    fetchUserServers,
    leaveServer
  } = useServerStore();
  
  const [serverSettings, setServerSettings] = useState({ isOpen: false, initialTab: 'overview', serverId: null });
  const [inviteModal, setInviteModal] = useState({ isOpen: false, serverId: null });
  const [leaveModal, setLeaveModal] = useState({ isOpen: false, server: null });

  useEffect(() => {
    if (user?.uid) {
      fetchUserServers(user.uid);
    }
  }, [user?.uid, fetchUserServers]);

  // ✅ Memoized handlers
  const handleHomeClick = useCallback(() => {
    if (isRoomActive) {
      toast.error("Sesli sohbetten ayrılmadan ana sayfaya dönemezsin.");
      return;
    }
    selectServer(null);
  }, [selectServer, isRoomActive]);

  const handleServerClick = useCallback((serverId) => {
    if (isRoomActive) {
      toast.error("Sesli sohbetten ayrılmadan sunucu değiştiremezsin.");
      return;
    }
    selectServer(serverId);
  }, [selectServer, isRoomActive]);
  
  const handleOpenSettings = useCallback((serverId, tab = 'overview') => {
    setServerSettings({ isOpen: true, initialTab: tab, serverId });
  }, []);

  const handleOpenInvite = useCallback((serverId) => {
    setInviteModal({ isOpen: true, serverId });
  }, []);

  const handleLeaveClick = useCallback((server) => {
    setLeaveModal({ isOpen: true, server });
  }, []);
  
  const canManageCurrentServer = useServerPermission("MANAGE_SERVER");

  const confirmLeaveServer = useCallback(async () => {
    if (leaveModal.server) {
      await leaveServer(leaveModal.server.id, user.uid);
      if (currentServer?.id === leaveModal.server.id) {
        selectServer(null);
      }
      setLeaveModal({ isOpen: false, server: null });
    }
  }, [leaveModal.server, leaveServer, user?.uid, currentServer?.id, selectServer]);

  // ✅ Memoized server list
  const serverItems = useMemo(() => {
    return servers.map((server) => (
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
        isRoomActive={isRoomActive}
      />
    ));
  }, [servers, currentServer?.id, user?.uid, canManageCurrentServer, handleServerClick, handleOpenSettings, handleOpenInvite, handleLeaveClick, isRoomActive]);

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
        isRoomActive={isRoomActive}
      />

      <RailSeparator />

      {/* Server List - Memoized */}
      {serverItems}

      {/* Add Server Button */}
      <RailItem
        label="Sunucu Ekle"
        active={false}
        onClick={onOpenCreateModal}
        variant="success"
        icon={<Plus size={24} />}
      />
      
      {/* User Panel (Fixed at Bottom) */}
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