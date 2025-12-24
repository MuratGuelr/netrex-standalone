"use client";

import { useEffect, useRef, useState } from "react";
import { useServerStore } from "@/src/store/serverStore";
import { useAuthStore } from "@/src/store/authStore";
import { Shield, Crown, Check, ChevronRight } from "lucide-react";
import Avatar from "@/src/components/ui/Avatar";
import { toast } from "sonner";

export default function MemberContextMenu({
  x,
  y,
  member,
  onClose,
}) {
  const menuRef = useRef(null);
  const { 
    roles, 
    currentServer, 
    members, 
    assignRoleToMember, 
    removeRoleFromMember,
    setMemberRoles 
  } = useServerStore();
  const { user } = useAuthStore();
  
  const [coords, setCoords] = useState({ top: y, left: x });
  const [showRoles, setShowRoles] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Store'dan güncel üyeyi bul (Reactivity için)
  const currentMember = members.find(m => m.id === member.id) || member;

  // Check if current user is owner or has MANAGE_ROLES permission
  const isOwner = currentServer?.ownerId === user?.uid;
  const currentUserMember = members.find(
    m => m.id === user?.uid || m.userId === user?.uid
  );
  const currentUserRoles = currentUserMember?.roles || [];
  const hasManageRolesPermission = roles.some(
    r => currentUserRoles.includes(r.id) && r.permissions?.includes("MANAGE_ROLES")
  );
  const canManageRoles = isOwner || hasManageRolesPermission;

  // Member's current roles (reactive)
  const memberRoles = currentMember?.roles || [];


  // Sort roles by order (highest first)
  const sortedRoles = [...roles].sort((a, b) => (b.order || 0) - (a.order || 0));

  // Adjust menu position to stay within viewport
  useEffect(() => {
    let newLeft = x;
    let newTop = y;

    const menuWidth = 260; // Slightly wider for new design
    const menuHeight = 400; // Approximate max height

    if (x + menuWidth > window.innerWidth) {
      newLeft = x - menuWidth;
    }

    if (y + menuHeight > window.innerHeight) {
      newTop = y - menuHeight;
    }

    // Ensure not negative
    if (newLeft < 0) newLeft = 10;
    if (newTop < 0) newTop = 10;

    setCoords({ top: newTop, left: newLeft });
  }, [x, y]);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };

    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  // Toggle role for member
  const handleToggleRole = async (roleId) => {
    if (isLoading) return;
    
    setIsLoading(true);
    const hasRole = memberRoles.includes(roleId);
    
    try {
      if (hasRole) {
        // Rolü kaldır
        const result = await removeRoleFromMember(member.id, roleId);
        if (result.success) {
          toast.success("Rol kaldırıldı");
        } else {
          toast.error("Rol kaldırılamadı: " + result.error);
        }
      } else {
        // Rol Ata - TEKİL SEÇİM MANTIĞI
        // Kullanıcının mevcut default (varsayılan) rollerini koru, diğerlerini sil ve yenisini ekle.
        
        // 1. Hedef rol varsayılan mı?
        const targetRole = roles.find(r => r.id === roleId);
        if (targetRole?.isDefault) {
             // Varsayılan rol ekleniyorsa normal ekle (buna dokunmuyoruz)
             const result = await assignRoleToMember(member.id, roleId);
             if (result.success) toast.success("Varsayılan rol atandı");
             else toast.error("Hata: " + result.error);
        } else {
             // 2. Özel rol ekleniyorsa: Diğer özel rolleri temizle
             
             // Varsayılan rolleri bul (korunacaklar)
             const defaultRoleIds = roles.filter(r => r.isDefault).map(r => r.id);
             
             // Kullanıcının mevcut rollerinden sadece varsayılan olanları al
             const rolesToKeep = memberRoles.filter(id => defaultRoleIds.includes(id));
             
             // Yeni rol listesi = Korunanlar + Yeni Rol
             const newRoles = [...new Set([...rolesToKeep, roleId])];
             
             const result = await setMemberRoles(member.id, newRoles);
             if (result.success) {
               toast.success("Rol değiştirildi");
             } else {
               toast.error("Rol değiştirilemedi: " + result.error);
             }
        }
      }
    } catch (error) {
      console.error(error);
      toast.error("Bir hata oluştu");
    }
    
    setIsLoading(false);
  };

  // Check if this is the current user
  const isSelf = member.id === user?.uid || member.userId === user?.uid;

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] w-64 bg-gradient-to-br from-[#1a1b1e] via-[#16171a] to-[#111214] border border-white/10 rounded-xl shadow-[0_0_20px_rgba(0,0,0,0.5)] overflow-hidden animate-in fade-in zoom-in-95 duration-200 backdrop-blur-xl"
      style={{ top: coords.top, left: coords.left }}
      onContextMenu={(e) => e.preventDefault()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header with member info */}
      <div className="p-4 bg-white/5 border-b border-white/5 backdrop-blur-md relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
        
        <div className="flex items-center gap-3 relative z-10">
          <Avatar 
             src={member.photoURL}
             name={member.displayName}
             size="md"
             status={member.status || "offline"}
             className="ring-2 ring-white/10 shadow-lg"
          />
          <div className="flex-1 min-w-0">
            <div className="font-bold text-white truncate text-sm">
              {member.displayName}
            </div>
            <div className="text-[11px] font-medium text-indigo-400 flex items-center gap-1">
              {isOwner && member.id === currentServer?.ownerId ? (
                <>
                  <Crown size={12} />
                  <span>Sunucu Sahibi</span>
                </>
              ) : (
                <span>Üye</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <div className="p-2 space-y-1">
        {/* Only show role management if user has permission */}
        {canManageRoles && (
          <div className="relative group">
            <button
              onClick={() => setShowRoles(!showRoles)}
              className={`
                w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all duration-200
                ${showRoles 
                  ? 'bg-gradient-to-r from-indigo-500/20 to-indigo-600/10 text-white border border-indigo-500/20' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                }
              `}
            >
              <div className="flex items-center gap-2.5">
                <Shield size={16} className={showRoles ? "text-indigo-400" : "text-gray-500 group-hover:text-indigo-400 transition-colors"} />
                <span className="font-medium">Roller</span>
                {isSelf && <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-gray-400">(Sen)</span>}
              </div>
              <ChevronRight 
                size={14} 
                className={`transform transition-transform duration-300 ${showRoles ? 'rotate-90 text-indigo-400' : 'text-gray-600 group-hover:text-white'}`}
              />
            </button>

            {/* Roles Submenu */}
            {showRoles && (
              <div className="mt-2 mb-1 ml-1 pl-2 border-l-2 border-indigo-500/20 space-y-1 max-h-64 overflow-y-auto scrollbar-thin animate-in slide-in-from-top-2 duration-200">
                {sortedRoles.length === 0 ? (
                  <div className="text-xs text-gray-500 px-3 py-2 italic">Rol bulunamadı</div>
                ) : (
                  sortedRoles.map(role => {
                    const hasRole = memberRoles.includes(role.id);
                    return (
                      <div key={role.id} className="px-1">
                      <button
                        onClick={() => handleToggleRole(role.id)}
                        disabled={isLoading}
                        className={`
                          w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 border
                          ${hasRole 
                            ? 'bg-indigo-500/10 text-white border-indigo-500/30 shadow-[0_0_10px_rgba(99,102,241,0.1)]' 
                            : 'text-gray-400 border-transparent hover:bg-white/5 hover:text-gray-200 hover:border-white/5'
                          }
                          ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                        `}
                      >
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <div 
                            className="w-2 h-2 rounded-full flex-shrink-0 shadow-[0_0_6px_currentColor]"
                            style={{ backgroundColor: role.color, color: role.color }}
                          />
                          <span className="truncate">{role.name}</span>
                        </div>
                        {hasRole && (
                          <div className="bg-indigo-500/20 p-0.5 rounded-full animate-in zoom-in duration-200">
                            <Check size={10} className="text-indigo-400" />
                          </div>
                        )}
                      </button>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

        {/* If no permissions, show a message */}
        {!canManageRoles && (
          <div className="px-3 py-3 text-xs text-gray-500 italic text-center bg-white/5 rounded-lg border border-dashed border-white/10 m-1">
            Bu menüyü kullanma yetkiniz yok
          </div>
        )}
      </div>
    </div>
  );
}
