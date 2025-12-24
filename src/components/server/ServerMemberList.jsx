"use client";

import { useServerStore } from "@/src/store/serverStore";
import { useAuthStore } from "@/src/store/authStore";
import { useMemo, useState } from "react";
import { X, Users, Crown, Shield } from "lucide-react";
import Avatar from "@/src/components/ui/Avatar";
import MemberContextMenu from "@/src/components/server/MemberContextMenu";

export default function ServerMemberList({ onClose }) {
  const { members, roles, currentServer } = useServerStore();
  const { user: currentUser } = useAuthStore();

  // Context menu state
  const [contextMenu, setContextMenu] = useState(null);

  // Handle right-click on member
  const handleMemberContextMenu = (e, member) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      member
    });
  };

  // Enrich members with fallback data from currentUser if needed
  const enrichedMembers = useMemo(() => {
    return members.map(member => {
      // If this is the current user and displayName is missing, use their auth data
      if (currentUser && (member.id === currentUser.uid || member.userId === currentUser.uid)) {
        return {
          ...member,
          displayName: member.displayName || member.nickname || currentUser.displayName || "User",
          photoURL: member.photoURL || currentUser.photoURL || null
        };
      }
      // For other members, use whatever we have
      return {
        ...member,
        displayName: member.displayName || member.nickname || `User${member.id?.slice(-4) || ''}`,
        photoURL: member.photoURL || null
      };
    });
  }, [members, currentUser]);

  const groupedMembers = useMemo(() => {
    if (!enrichedMembers || !roles || !currentServer) return {};

    // Sort roles by order
    const sortedRoles = [...roles].sort((a, b) => (b.order || 0) - (a.order || 0));
    
    const groups = {};

    // 0. Owner Group
    groups['owner'] = {
        role: { name: 'Sunucu Kurucusu', color: '#f59e0b', id: 'owner' }, // Gold color
        members: []
    };

    // 1. Role Groups
    sortedRoles.forEach(role => {
      groups[role.id] = {
        role: role,
        members: []
      };
    });

    // 2. Uncategorized Group
    groups['uncategorized'] = {
      role: { name: 'Çevrimiçi', color: '#99aab5', id: 'uncategorized' },
      members: []
    };

    enrichedMembers.forEach(member => {
      // 1. Check if member is Owner
      if (member.id === currentServer.ownerId || member.userId === currentServer.ownerId) {
          groups['owner'].members.push(member);
          return;
      }

      // 2. Check Roles
      let assigned = false;
      if (member.roles && member.roles.length > 0) {
        for (const role of sortedRoles) {
            if (member.roles.includes(role.id)) {
                groups[role.id].members.push(member);
                assigned = true;
                break;
            }
        }
      } 
      
      // 3. Fallback to Uncategorized
      if (!assigned) {
         groups['uncategorized'].members.push(member);
      }
    });

    // Clean up empty groups (except maybe uncategorized if you want it always visible, but usually hide empty)
    // We'll keep them if they have members. 
    // Sort members within groups alphabetically
    Object.keys(groups).forEach(key => {
        groups[key].members.sort((a, b) => a.displayName.localeCompare(b.displayName));
        if (groups[key].members.length === 0) {
             delete groups[key];
        }
    });

    return groups;
  }, [enrichedMembers, roles, currentServer]);

  const sortedRoleIds = useMemo(() => {
      if (!roles) return [];
      // Start with Owner
      const ids = [];
      const hasOwnerGroup = groupedMembers && groupedMembers['owner'];
      
      if (hasOwnerGroup) ids.push('owner');

      // Then Roles
      const roleIds = [...roles].sort((a, b) => (b.order || 0) - (a.order || 0)).map(r => r.id);
      ids.push(...roleIds);

      // Then Uncategorized
      ids.push('uncategorized');
      
      // Filter out ids that don't exist in groupedMembers (because we deleted empty groups)
      return ids.filter(id => groupedMembers && groupedMembers[id]);
  }, [roles, groupedMembers]);

  if (!currentServer) return null;

  // Get role icon
  const getRoleIcon = (roleId, roleName) => {
    const lowerName = roleName?.toLowerCase() || '';
    if (lowerName.includes('owner') || lowerName.includes('sahip') || lowerName.includes('kurucu')) {
      return <Crown className="w-3 h-3 text-yellow-500" />;
    }
    if (lowerName.includes('admin') || lowerName.includes('yönetici') || lowerName.includes('moderator')) {
      return <Shield className="w-3 h-3 text-blue-400" />;
    }
    return null;
  };

  return (
    <div className="w-full bg-gradient-to-b from-[#1a1b1e] via-[#16171a] to-[#111214] flex-shrink-0 flex flex-col h-full overflow-hidden border-l border-white/5">
      {/* Header with close button */}
      <div className="p-4 flex items-center justify-between bg-[#1a1b1e]/95 backdrop-blur-md sticky top-0 z-10 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[#949ba4]" />
          <h3 className="text-xs font-bold text-[#949ba4] uppercase tracking-wider">
            Üyeler — {members.length}
          </h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="
              w-6 h-6 rounded-lg
              flex items-center justify-center
              text-[#949ba4] hover:text-white
              hover:bg-white/10
              transition-all duration-200
            "
            title="Üye listesini kapat"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      
      {/* Member list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-6 scrollbar-thin">
        {sortedRoleIds.map(roleId => {
            const group = groupedMembers[roleId];
            if (!group || group.members.length === 0) return null;

            const roleIcon = getRoleIcon(roleId, group.role.name);

            return (
                <div key={roleId} className="animate-in fade-in duration-300 slide-in-from-right-2">
                    {/* Role header */}
                    <div className="text-[10px] font-bold text-[#949ba4] uppercase mb-2 px-3 flex items-center gap-1.5 opacity-80 hover:opacity-100 transition-opacity">
                        {roleId !== 'uncategorized' && (
                           <span 
                             className="w-1.5 h-1.5 rounded-full flex-shrink-0 shadow-[0_0_8px_currentColor]" 
                             style={{ backgroundColor: group.role.color, color: group.role.color }}
                           />
                        )}
                        {roleIcon}
                        <span>{group.role.name}</span>
                        <span className="text-[#6d7177]">— {group.members.length}</span>
                    </div>
                    
                    {/* Members */}
                    <div className="space-y-1">
                        {group.members.map(member => (
                            <div 
                              key={member.id} 
                              className="
                                flex items-center gap-3 
                                px-3 py-2 
                                rounded-xl
                                hover:bg-white/5 
                                cursor-pointer 
                                group 
                                transition-all duration-200
                              "
                              onContextMenu={(e) => handleMemberContextMenu(e, member)}
                            >
                                {/* Avatar */}
                                <div className="relative">
                                  <Avatar
                                    src={member.photoURL}
                                    name={member.displayName}
                                    size="md"
                                    status="online"
                                    className="flex-shrink-0 rounded-lg"
                                  />
                                </div>
                                
                                {/* User info */}
                                <div className="flex-1 min-w-0">
                                    <div 
                                      className="text-sm font-medium truncate text-[#dbdee1] group-hover:text-white transition-colors"
                                      style={{ 
                                        color: roleId !== 'uncategorized' ? group.role.color : undefined
                                      }}
                                    >
                                        {member.displayName}
                                    </div>
                                    {member.customStatus && (
                                      <div className="text-[11px] text-[#949ba4] truncate group-hover:text-[#b5bac1] transition-colors">
                                        {member.customStatus}
                                      </div>
                                    )}
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
    </div>
  );
}

