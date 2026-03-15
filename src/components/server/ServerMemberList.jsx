"use client";

import { useServerStore } from "@/src/store/serverStore";
import { useAuthStore } from "@/src/store/authStore";
import { useSettingsStore } from "@/src/store/settingsStore";
import { useMemo, useState, useEffect, useCallback, memo, useRef } from "react";
import { X, Users, Crown, Shield } from "lucide-react";
import MemberContextMenu from "@/src/components/server/MemberContextMenu";
import UserProfileModal from "@/src/components/server/UserProfileModal";
import MemberItem from "@/src/components/server/MemberItem";
import { getEffectivePresence } from "@/src/hooks/usePresence";
import { db } from "@/src/lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  documentId,
} from "firebase/firestore";
import { Virtuoso } from "react-virtuoso";

const RoleIcon = memo(({ roleId, roleName }) => {
  const lowerName = roleName?.toLowerCase() || "";
  if (
    lowerName.includes("owner") ||
    lowerName.includes("sahip") ||
    lowerName.includes("kurucu") ||
    roleId === "owner"
  ) {
    return <Crown size={12} className="text-amber-400 fill-amber-400/20" />;
  }
  if (
    lowerName.includes("admin") ||
    lowerName.includes("yönetici") ||
    lowerName.includes("moderator")
  ) {
    return <Shield size={12} className="text-indigo-400 fill-indigo-400/20" />;
  }
  return null;
});
RoleIcon.displayName = "RoleIcon";

const HeaderRow = memo(({ item }) => (
  <div className="flex items-center px-4 pt-3 pb-1">
    <div className="flex items-center gap-2 flex-1 group/header cursor-default">
      <div className="text-[11px] font-bold text-[#949ba4] uppercase tracking-wide flex items-center gap-2 flex-1">
        <RoleIcon roleId={item.roleId} roleName={item.roleName} />
        <span
          className="transition-colors group-hover/header:text-[#dbdee1]"
          style={{
            color:
              !item.isOffline && item.roleId !== "uncategorized"
                ? item.roleColor
                : undefined,
          }}
        >
          {item.roleName}
        </span>
      </div>
    </div>
  </div>
));
HeaderRow.displayName = "HeaderRow";

export default function ServerMemberList({ onClose }) {
  const { members, roles, currentServer } = useServerStore();
  const { user: currentUser } = useAuthStore();
  // Kendi profileColor'ımızı da okuyoruz (local user için fallback)
  const localProfileColor = useSettingsStore((s) => s.profileColor);

  const [contextMenu, setContextMenu] = useState(null);
  const [profileModal, setProfileModal] = useState(null);
  const [userProfiles, setUserProfiles] = useState({});

  // ✅ Firestore users listener — profileColor da dahil
  useEffect(() => {
    if (!members || members.length === 0) return;

    const memberIds = members
      .map((m) => m.id || m.userId)
      .filter(Boolean)
      .slice(0, 30);

    if (memberIds.length === 0) return;

    const q = query(
      collection(db, "users"),
      where(documentId(), "in", memberIds),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const profiles = {};
        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          profiles[doc.id] = {
            gameActivity: data.gameActivity || null,
            customStatus: data.customStatus || null,
            customStatusColor: data.customStatusColor || null,
            presence: data.presence || null,
            lastSeen: data.lastSeen || null,
            profileColor: data.profileColor || null, // ✅ yeni
            photoURL: data.photoURL ?? null, // ✅ Firestore'dan en güncel fotoğraf
          };
        });
        setUserProfiles(profiles);
      },
      (error) => {
        console.error("User profiles listener error:", error);
      },
    );

    return () => unsubscribe();
  }, [members]);

  const profileModalTimeoutRef = useRef(null);
  const contextMenuTimeoutRef = useRef(null);

  const handleMemberClick = useCallback((e, member) => {
    e.stopPropagation();
    if (profileModalTimeoutRef.current)
      clearTimeout(profileModalTimeoutRef.current);
    profileModalTimeoutRef.current = setTimeout(() => {
      setProfileModal({ member, position: { x: e.clientX, y: e.clientY } });
    }, 100);
  }, []);

  const handleMemberContextMenu = useCallback((e, member) => {
    e.preventDefault();
    if (contextMenuTimeoutRef.current)
      clearTimeout(contextMenuTimeoutRef.current);
    contextMenuTimeoutRef.current = setTimeout(() => {
      setContextMenu({ x: e.clientX, y: e.clientY, member });
    }, 50);
  }, []);

  useEffect(() => {
    return () => {
      if (profileModalTimeoutRef.current)
        clearTimeout(profileModalTimeoutRef.current);
      if (contextMenuTimeoutRef.current)
        clearTimeout(contextMenuTimeoutRef.current);
    };
  }, []);

  // ✅ enrichedMembers — profileColor kaynağı: Firestore users > member doc > local store (sadece kendi)
  const enrichedMembers = useMemo(() => {
    return members.map((member) => {
      const memberId = member.id || member.userId;
      const userProfile = userProfiles[memberId] || {};
      const isCurrentUser =
        currentUser &&
        (member.id === currentUser.uid || member.userId === currentUser.uid);
      const effectivePresence = getEffectivePresence({
        ...member,
        ...userProfile,
      });

      // profileColor öncelik sırası:
      // 1. Firestore users dokümanı (en güncel)
      // 2. member dokümanındaki profileColor
      // 3. Kendi local store'umuz (sadece local kullanıcı için)
      const profileColor =
        userProfile.profileColor ||
        member.profileColor ||
        (isCurrentUser ? localProfileColor : null);

      // photoURL: Firestore users dokümanı her zaman member doc'tan daha güncel
      const photoURL =
        "photoURL" in userProfile
          ? userProfile.photoURL
          : member.photoURL || (isCurrentUser ? currentUser.photoURL : null);

      return {
        ...member,
        displayName:
          member.displayName ||
          member.nickname ||
          (isCurrentUser
            ? currentUser.displayName
            : `User${member.id?.slice(-4) || ""}`),
        photoURL,
        profileColor, // ✅ override edilmiş renk
        presence: effectivePresence,
        gameActivity: userProfile.gameActivity,
        customStatus: userProfile.customStatus || member.customStatus,
        customStatusColor: userProfile.customStatusColor,
      };
    });
  }, [members, currentUser, userProfiles, localProfileColor]);

  const groupedMembers = useMemo(() => {
    if (!enrichedMembers || !roles || !currentServer) return {};
    const sortedRoles = [...roles].sort(
      (a, b) => (b.order || 0) - (a.order || 0),
    );

    const groups = {};
    groups["owner"] = {
      role: { name: "Sunucu Kurucusu", color: "#f59e0b", id: "owner" },
      members: [],
    };
    sortedRoles.forEach((role) => {
      groups[role.id] = { role, members: [] };
    });
    groups["uncategorized"] = {
      role: { name: "Çevrimiçi", color: "#949ba4", id: "uncategorized" },
      members: [],
    };
    groups["offline"] = {
      role: { name: "Çevrimdışı", color: "#4e5058", id: "offline" },
      members: [],
    };

    enrichedMembers.forEach((member) => {
      if (member.presence === "offline") {
        groups["offline"].members.push(member);
        return;
      }
      if (
        member.id === currentServer.ownerId ||
        member.userId === currentServer.ownerId
      ) {
        groups["owner"].members.push(member);
        return;
      }

      let assigned = false;
      if (member.roles?.length > 0) {
        for (const role of sortedRoles) {
          if (member.roles.includes(role.id)) {
            groups[role.id].members.push(member);
            assigned = true;
            break;
          }
        }
      }
      if (!assigned) groups["uncategorized"].members.push(member);
    });

    Object.keys(groups).forEach((key) => {
      groups[key].members.sort((a, b) =>
        a.displayName.localeCompare(b.displayName),
      );
      if (groups[key].members.length === 0) delete groups[key];
    });
    return groups;
  }, [enrichedMembers, roles, currentServer]);

  const flatData = useMemo(() => {
    if (!roles) return [];

    const ids = [];
    if (groupedMembers?.["owner"]) ids.push("owner");
    const roleIds = [...roles]
      .sort((a, b) => (b.order || 0) - (a.order || 0))
      .map((r) => r.id);
    ids.push(...roleIds, "uncategorized", "offline");

    const items = [];
    ids
      .filter((id) => groupedMembers?.[id])
      .forEach((key) => {
        const group = groupedMembers[key];
        items.push({
          type: "header",
          roleId: key,
          roleName: group.role.name,
          roleColor: group.role.color,
          count: group.members.length,
          isOffline: key === "offline",
        });
        group.members.forEach((member) => {
          items.push({
            type: "member",
            member,
            roleId: key,
            roleColor: group.role.color,
            isOfflineGroup: key === "offline",
          });
        });
      });
    return items;
  }, [groupedMembers, roles]);

  const rowContent = useCallback(
    (index, item) => {
      if (item.type === "header") return <HeaderRow item={item} />;
      return (
        <div className="px-2 py-[2px]">
          <div
            className={
              item.isOfflineGroup
                ? "opacity-60 hover:opacity-100 transition-opacity duration-300"
                : ""
            }
          >
            <MemberItem
              member={item.member}
              roleId={item.roleId}
              roleColor={item.roleColor}
              isOfflineGroup={item.isOfflineGroup}
              onClick={handleMemberClick}
              onContextMenu={handleMemberContextMenu}
            />
          </div>
        </div>
      );
    },
    [handleMemberClick, handleMemberContextMenu],
  );

  if (!currentServer) return null;

  return (
    <div className="w-full h-full bg-[#111214] flex flex-col relative overflow-hidden border-l border-white/[0.06]">
      <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-indigo-500/[0.03] blur-[80px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[200px] h-[200px] bg-purple-500/[0.02] blur-[60px] pointer-events-none" />

      <div className="flex items-center justify-between px-4 h-16 shrink-0 bg-[#111214]/80 backdrop-blur-xl border-b border-white/[0.06] relative z-20">
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

      <div className="flex-1 relative z-10">
        <Virtuoso
          style={{ height: "100%", width: "100%" }}
          data={flatData}
          itemContent={rowContent}
          className="scrollbar-thin scrollbar-thumb-[#2b2d31] scrollbar-track-transparent"
        />
      </div>

      {contextMenu && (
        <MemberContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          member={contextMenu.member}
          onClose={() => setContextMenu(null)}
        />
      )}
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
