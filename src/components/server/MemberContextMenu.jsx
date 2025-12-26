"use client";

import { useEffect, useRef, useState } from "react";
import { useServerStore } from "@/src/store/serverStore";
import { useAuthStore } from "@/src/store/authStore";
import { Shield, Crown, Check, ChevronRight, User } from "lucide-react";
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

  // Yetki Kontrolü
  const isOwner = currentServer?.ownerId === user?.uid;
  const currentUserMember = members.find(
    m => m.id === user?.uid || m.userId === user?.uid
  );
  const currentUserRoles = currentUserMember?.roles || [];
  const hasManageRolesPermission = roles.some(
    r => currentUserRoles.includes(r.id) && r.permissions?.includes("MANAGE_ROLES")
  );
  const canManageRoles = isOwner || hasManageRolesPermission;

  // Üyenin rolleri
  const memberRoles = currentMember?.roles || [];

  // Rolleri sıraya diz
  const sortedRoles = [...roles].sort((a, b) => (b.order || 0) - (a.order || 0));

  // --- POZİSYONLAMA MANTIĞI ---
  useEffect(() => {
    let newLeft = x;
    let newTop = y;

    const menuWidth = 280;
    const menuHeight = 400; 

    if (x + menuWidth > window.innerWidth) {
      newLeft = x - menuWidth;
    }

    if (y + menuHeight > window.innerHeight) {
      newTop = y - menuHeight;
    }

    if (newLeft < 0) newLeft = 10;
    if (newTop < 0) newTop = 10;

    setCoords({ top: newTop, left: newLeft });
  }, [x, y]);

  // --- DIŞARI TIKLAMA İLE KAPATMA ---
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  // Rol İşlemleri
  const handleToggleRole = async (roleId) => {
    if (isLoading) return;
    
    setIsLoading(true);
    const hasRole = memberRoles.includes(roleId);
    
    try {
      if (hasRole) {
        const result = await removeRoleFromMember(member.id, roleId);
        if (result.success) toast.success("Rol kaldırıldı");
        else toast.error("Hata: " + result.error);
      } else {
        const targetRole = roles.find(r => r.id === roleId);
        if (targetRole?.isDefault) {
             const result = await assignRoleToMember(member.id, roleId);
             if (result.success) toast.success("Rol atandı");
             else toast.error("Hata: " + result.error);
        } else {
             const defaultRoleIds = roles.filter(r => r.isDefault).map(r => r.id);
             const rolesToKeep = memberRoles.filter(id => defaultRoleIds.includes(id));
             const newRoles = [...new Set([...rolesToKeep, roleId])];
             
             const result = await setMemberRoles(member.id, newRoles);
             if (result.success) toast.success("Rol değiştirildi");
             else toast.error("Hata: " + result.error);
        }
      }
    } catch (error) {
      console.error(error);
      toast.error("Bir hata oluştu");
    }
    setIsLoading(false);
  };

  const isSelf = member.id === user?.uid || member.userId === user?.uid;
  const isServerOwner = member.id === currentServer?.ownerId;

  return (
    <div
      ref={menuRef}
      // ANIMASYON GÜNCELLEMESİ:
      // animate-in: Giriş animasyonunu aktifleştirir.
      // fade-in: Opaklık 0'dan 1'e gelir.
      // zoom-in-95: Boyut %95'ten %100'e gelir (hafif büyüme efekti).
      // duration-150: 150ms sürer (daha seri hissettirir).
      // ease-out: Başlangıç hızlı, bitiş yavaştır (doğal his).
      className="fixed z-[9999] w-72 rounded-2xl overflow-hidden border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.6)] animate-in fade-in zoom-in-95 duration-150 ease-out backdrop-blur-2xl"
      style={{ 
        top: coords.top, 
        left: coords.left,
        background: 'rgba(17, 18, 20, 0.95)'
      }}
      onContextMenu={(e) => e.preventDefault()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Decorative Glow Effect */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

      {/* --- HEADER --- */}
      <div className="p-4 border-b border-white/5 relative z-10">
        <div className="flex items-center gap-3">
          <div className="relative group cursor-pointer">
            {/* Status göstergesi kaldırıldı */}
            <Avatar 
               src={member.photoURL}
               name={member.displayName}
               size="md"
               className="ring-2 ring-white/10 shadow-lg transition-transform duration-300 group-hover:scale-105"
            />
            {/* Owner Crown Indicator */}
            {isServerOwner && (
              <div className="absolute -top-1 -right-1 bg-[#111214] rounded-full p-0.5 border border-amber-500/30">
                <Crown size={10} className="text-amber-400 fill-amber-400/20" />
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="font-bold text-white truncate text-sm flex items-center gap-2">
              {member.displayName}
              {isSelf && <span className="text-[9px] bg-white/10 text-gray-400 px-1.5 rounded-sm font-medium tracking-wide">SEN</span>}
            </div>
            
            {/* Alt Bilgi / Rol */}
            <div className="text-[11px] font-medium mt-0.5 flex items-center gap-1.5">
              {isServerOwner ? (
                <span className="text-amber-400 flex items-center gap-1 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                  <Crown size={10} />
                  Sunucu Sahibi
                </span>
              ) : (
                <span className="text-[#949ba4] flex items-center gap-1">
                  <User size={10} />
                  Üye
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* --- MENU ITEMS --- */}
      <div className="p-2 space-y-1 relative z-10">
        
        {/* ROLLER (Accordion) */}
        {canManageRoles && (
          <div className="relative">
            <button
              onClick={() => setShowRoles(!showRoles)}
              className={`
                w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300
                ${showRoles 
                  ? 'bg-gradient-to-r from-indigo-500/10 to-purple-500/10 text-white border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.1)]' 
                  : 'text-[#949ba4] hover:text-white hover:bg-white/5 border border-transparent'
                }
              `}
            >
              <div className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${showRoles ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/5 text-[#949ba4] group-hover:text-white'}`}>
                    <Shield size={14} />
                </div>
                <span>Roller</span>
              </div>
              <ChevronRight 
                size={14} 
                className={`transform transition-transform duration-300 ${showRoles ? 'rotate-90 text-indigo-400' : 'text-[#6b7280]'}`}
              />
            </button>

            {/* Roles Submenu List */}
            {showRoles && (
              <div className="mt-2 mb-1 pl-2 space-y-1 max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20 animate-in slide-in-from-top-2 duration-200">
                <div className="px-1 space-y-1">
                  {sortedRoles.length === 0 ? (
                    <div className="text-xs text-[#6b7280] px-3 py-2 italic text-center border border-dashed border-white/5 rounded-lg">Rol bulunamadı</div>
                  ) : (
                    sortedRoles.map(role => {
                      const hasRole = memberRoles.includes(role.id);
                      return (
                        <button
                          key={role.id}
                          onClick={() => handleToggleRole(role.id)}
                          disabled={isLoading}
                          className={`
                            w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 border group/role
                            ${hasRole 
                              ? 'bg-[#1e1f22] border-indigo-500/30 text-white shadow-sm' 
                              : 'text-[#949ba4] border-transparent hover:bg-white/5 hover:text-gray-200'
                            }
                            ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                          `}
                        >
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            {/* Role Color Dot */}
                            <div 
                              className={`w-2 h-2 rounded-full flex-shrink-0 transition-shadow duration-300 ${hasRole ? 'shadow-[0_0_8px_currentColor]' : ''}`}
                              style={{ backgroundColor: role.color || '#949ba4', color: role.color || '#949ba4' }}
                            />
                            <span className="truncate">{role.name}</span>
                          </div>
                          
                          {/* Check Indicator */}
                          <div className={`
                            w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200
                            ${hasRole ? 'bg-indigo-500 text-white scale-100' : 'bg-white/5 text-transparent scale-0 group-hover/role:scale-100 group-hover/role:bg-white/10'}
                          `}>
                            <Check size={10} strokeWidth={3} />
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}