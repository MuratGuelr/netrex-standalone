"use client";

import { useServerStore } from "@/src/store/serverStore";
import { useAuthStore } from "@/src/store/authStore";
import { useMemo, useState, useEffect } from "react";
import { X, Users, Crown, Shield, Circle } from "lucide-react";
import Avatar from "@/src/components/ui/Avatar";
import MemberContextMenu from "@/src/components/server/MemberContextMenu";
import UserProfileModal from "@/src/components/server/UserProfileModal";
import GameDuration from "@/src/components/ui/GameDuration";
import GameIcon from "@/src/components/ui/GameIcon";
import { getEffectivePresence } from "@/src/hooks/usePresence";
import { db } from "@/src/lib/firebase";
import { collection, query, where, onSnapshot, documentId } from "firebase/firestore";

export default function ServerMemberList({ onClose }) {
  const { members, roles, currentServer } = useServerStore();
  const { user: currentUser } = useAuthStore();
  const [contextMenu, setContextMenu] = useState(null);
  const [profileModal, setProfileModal] = useState(null); // { member, position }
  const [userProfiles, setUserProfiles] = useState({}); // userId -> { gameActivity, customStatus }

  // 🎮 Listen to users collection for gameActivity and customStatus (real-time)
  useEffect(() => {
    if (!members || members.length === 0) return;

    // Get member IDs (max 30 for Firestore 'in' query)
    const memberIds = members
      .map(m => m.id || m.userId)
      .filter(Boolean)
      .slice(0, 30);

    if (memberIds.length === 0) return;

    // Query users collection for these members
    const q = query(
      collection(db, "users"),
      where(documentId(), "in", memberIds)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const profiles = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        profiles[doc.id] = {
          gameActivity: data.gameActivity || null,
          customStatus: data.customStatus || null,
          customStatusColor: data.customStatusColor || null,
          presence: data.presence || null,
          lastSeen: data.lastSeen || null,
        };
      });
      setUserProfiles(profiles);
    }, (error) => {
      console.error("User profiles listener error:", error);
    });

    return () => unsubscribe();
  }, [members]);

  // --- Logic Kısmı (Aynı Kaldı) ---
  const handleMemberContextMenu = (e, member) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, member });
  };

  // Handle click to open profile modal
  const handleMemberClick = (e, member) => {
    e.stopPropagation();
    setProfileModal({ 
      member, 
      position: { x: e.clientX, y: e.clientY } 
    });
  };

  const enrichedMembers = useMemo(() => {
    return members.map(member => {
      const memberId = member.id || member.userId;
      const userProfile = userProfiles[memberId] || {};
      
      // Calculate effective presence based on lastSeen timestamp
      // This handles "ghost online" when computer was shut down without closing app
      const effectivePresence = getEffectivePresence({ ...member, ...userProfile });
      
      if (currentUser && (member.id === currentUser.uid || member.userId === currentUser.uid)) {
        return {
          ...member,
          displayName: member.displayName || member.nickname || currentUser.displayName || "User",
          photoURL: member.photoURL || currentUser.photoURL || null,
          presence: effectivePresence,
          gameActivity: userProfile.gameActivity,
          customStatus: userProfile.customStatus || member.customStatus,
          customStatusColor: userProfile.customStatusColor,
        };
      }
      return {
        ...member,
        displayName: member.displayName || member.nickname || `User${member.id?.slice(-4) || ''}`,
        photoURL: member.photoURL || null,
        presence: effectivePresence,
        gameActivity: userProfile.gameActivity,
        customStatus: userProfile.customStatus || member.customStatus,
        customStatusColor: userProfile.customStatusColor,
      };
    });
  }, [members, currentUser, userProfiles]);

  const groupedMembers = useMemo(() => {
    if (!enrichedMembers || !roles || !currentServer) return {};
    const sortedRoles = [...roles].sort((a, b) => (b.order || 0) - (a.order || 0));
    
    const groups = {};
    groups['owner'] = { role: { name: 'Sunucu Kurucusu', color: '#f59e0b', id: 'owner' }, members: [] };
    sortedRoles.forEach(role => { groups[role.id] = { role: role, members: [] }; });
    groups['uncategorized'] = { role: { name: 'Çevrimiçi', color: '#949ba4', id: 'uncategorized' }, members: [] };
    groups['offline'] = { role: { name: 'Çevrimdışı', color: '#4e5058', id: 'offline' }, members: [] };

    enrichedMembers.forEach(member => {
      if (member.presence === 'offline') { groups['offline'].members.push(member); return; }
      if (member.id === currentServer.ownerId || member.userId === currentServer.ownerId) { groups['owner'].members.push(member); return; }
      
      let assigned = false;
      if (member.roles && member.roles.length > 0) {
        for (const role of sortedRoles) {
            if (member.roles.includes(role.id)) { groups[role.id].members.push(member); assigned = true; break; }
        }
      } 
      if (!assigned) { groups['uncategorized'].members.push(member); }
    });

    Object.keys(groups).forEach(key => {
        groups[key].members.sort((a, b) => a.displayName.localeCompare(b.displayName));
        if (groups[key].members.length === 0) { delete groups[key]; }
    });
    return groups;
  }, [enrichedMembers, roles, currentServer]);

  const sortedRoleIds = useMemo(() => {
      if (!roles) return [];
      const ids = [];
      if (groupedMembers && groupedMembers['owner']) ids.push('owner');
      const roleIds = [...roles].sort((a, b) => (b.order || 0) - (a.order || 0)).map(r => r.id);
      ids.push(...roleIds);
      ids.push('uncategorized');
      ids.push('offline');
      return ids.filter(id => groupedMembers && groupedMembers[id]);
  }, [roles, groupedMembers]);

  if (!currentServer) return null;

  const getRoleIcon = (roleId, roleName) => {
    const lowerName = roleName?.toLowerCase() || '';
    if (lowerName.includes('owner') || lowerName.includes('sahip') || lowerName.includes('kurucu') || roleId === 'owner') {
      return <Crown size={12} className="text-amber-400 fill-amber-400/20" />;
    }
    if (lowerName.includes('admin') || lowerName.includes('yönetici') || lowerName.includes('moderator')) {
      return <Shield size={12} className="text-indigo-400 fill-indigo-400/20" />;
    }
    return null;
  };

  // --- Render ---
  return (
    <div className="w-full h-full bg-[#111214] flex flex-col relative overflow-hidden border-l border-white/[0.06]">
      {/* Ambient Glow Effects */}
      <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-indigo-500/[0.03] blur-[80px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[200px] h-[200px] bg-purple-500/[0.02] blur-[60px] pointer-events-none" />

      {/* HEADER (Sticky Glass) */}
      <div className="
        flex items-center justify-between 
        px-4 h-16 shrink-0
        bg-[#111214]/80 backdrop-blur-xl 
        border-b border-white/[0.06]
        relative z-20
      ">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-white/5 border border-white/5">
             <Users size={16} className="text-[#949ba4]" />
          </div>
          <div className="flex flex-col">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Üyeler
            </h3>
            <span className="text-[10px] text-[#949ba4] font-medium">
              {members.length} Kişi
            </span>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#949ba4] hover:text-white hover:bg-white/10 transition-all duration-200"
          >
            <X size={18} />
          </button>
        )}
      </div>
      
      {/* MEMBER LIST */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-[#2b2d31] scrollbar-track-transparent relative z-10">
        {sortedRoleIds.map((roleId, index) => {
            const group = groupedMembers[roleId];
            if (!group || group.members.length === 0) return null;

            const roleIcon = getRoleIcon(roleId, group.role.name);
            const isOfflineGroup = roleId === 'offline';

            return (
                <div 
                  key={roleId} 
                  className={`animate-in fade-in slide-in-from-right-4 duration-500`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                    {/* Role Header */}
                    <div className="flex items-center gap-2 mb-2 px-2 group/header select-none sh">
                        <div className="text-[11px] font-bold text-[#949ba4] uppercase tracking-wide flex items-center gap-2 flex-1">
                            {roleIcon}
                            <span 
                              className="transition-colors group-hover/header:text-[#dbdee1] shrink-0"
                              style={{ color: !isOfflineGroup && roleId !== 'uncategorized' ? group.role.color : undefined }}
                            >
                              {group.role.name}
                            </span>
                            <span className="shrink-0 text-[10px] text-[#5c5e66] font-mono">
                               — {group.members.length}
                            </span>
                        </div>
                        {/* Decorative Line */}
                        <div className="h-px bg-white/5 flex-1 max-w-[50px] group-hover/header:max-w-[100px] transition-all duration-500" />
                    </div>
                    
                    {/* Members Grid/List */}
                    <div className={`space-y-1 ${isOfflineGroup ? 'opacity-60 hover:opacity-100 transition-opacity duration-300' : ''}`}>
                        {group.members.map(member => (
                            <div 
                              key={member.id} 
                              onClick={(e) => handleMemberClick(e, member)}
                              onContextMenu={(e) => handleMemberContextMenu(e, member)}
                              className="
                                group relative
                                flex items-center gap-3 
                                px-3 py-2 
                                rounded-xl
                                border border-transparent
                                hover:bg-white/[0.04] hover:border-white/[0.04]
                                active:scale-[0.98]
                                cursor-pointer 
                                transition-all duration-200
                              "
                            >
                                {/* Active Indicator Bar (Left) */}
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-indigo-500 rounded-r opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

                                {/* Avatar */}
                                <div className="relative shrink-0">
                                  <Avatar
                                    src={member.photoURL}
                                    name={member.displayName}
                                    size="md"
                                    status={member.presence || "online"}
                                    className={`
                                      rounded-xl transition-transform duration-300 group-hover:scale-105 
                                      ${roleId === 'owner' ? 'ring-2 ring-amber-500/20' : ''}
                                    `}
                                  />
                                  {/* Custom Crown Overlay for Owner (Optional) */}
                                  {roleId === 'owner' && (
                                    <div className="absolute -top-1 -right-1 bg-[#111214] rounded-full p-0.5 border border-amber-500/30">
                                      <Crown size={8} className="text-amber-500 fill-amber-500" />
                                    </div>
                                  )}
                                </div>
                                
                                {/* Info */}
                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                    <div className="flex items-center gap-1.5">
                                      <span 
                                        className="text-sm font-medium truncate text-[#dbdee1] group-hover:text-white transition-colors"
                                        style={{ 
                                          color: !isOfflineGroup && roleId !== 'uncategorized' ? group.role.color : undefined 
                                        }}
                                      >
                                          {member.displayName}
                                      </span>
                                      {/* Icons based on specific flags if you have them (e.g. Bot, Verified) */}
                                    </div>

                                    {/* Status Text */}
                                    <div className="text-[11px] truncate text-[#949ba4] group-hover:text-[#b5bac1] transition-colors min-h-[16px] flex items-center">
                                      {member.gameActivity && member.presence !== 'offline' ? (
                                        <span className="flex items-center gap-1.5 text-green-400 group/game relative">
                                          <GameIcon
                                            iconUrl={member.gameActivity.iconUrl}
                                            icon={member.gameActivity.icon}
                                            name={member.gameActivity.name}
                                            className="w-3.5 h-3.5 object-cover rounded-[2px]"
                                          />
                                          <span className="truncate max-w-[120px]">{member.gameActivity.name}</span>
                                          <GameDuration startTime={member.gameActivity.startedAt} />
                                        </span>
                                      ) : member.customStatus ? (
                                        <span style={{ color: member.customStatusColor || "inherit" }}>{member.customStatus}</span>
                                      ) : member.presence === 'idle' ? (
                                        <span className="flex items-center gap-1 text-amber-500/80">
                                          <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                                          Uzakta
                                        </span>
                                      ) : member.presence === 'dnd' ? (
                                        <span className="text-red-400/80">Rahatsız Etme</span>
                                      ) : null}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            );
        })}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <MemberContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          member={contextMenu.member}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Profile Modal */}
      {profileModal && (
        <UserProfileModal
          member={profileModal.member}
          position={profileModal.position}
          onClose={() => setProfileModal(null)}
        />
      )}
    </div>
  );
}