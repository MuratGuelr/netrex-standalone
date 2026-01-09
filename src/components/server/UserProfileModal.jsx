"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { 
  X, 
  Crown, 
  Award, 
  MoreHorizontal,
  Calendar,
  Clock,
  Edit3,
  Gamepad2,
  Quote,
  Sparkles
} from "lucide-react";
import Avatar from "@/src/components/ui/Avatar";
import GameDuration from "@/src/components/ui/GameDuration";
import GameIcon from "@/src/components/ui/GameIcon";
import { useAuthStore } from "@/src/store/authStore";
import { useServerStore } from "@/src/store/serverStore";
import { useSettingsStore } from "@/src/store/settingsStore";
import { db } from "@/src/lib/firebase";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { getEffectivePresence } from "@/src/hooks/usePresence";

const BADGES = {
  owner: {
    id: "owner",
    name: "Sunucu Kurucusu",
    icon: Crown,
    color: "#f59e0b",
    bgColor: "rgba(245, 158, 11, 0.15)",
    description: "Bu sunucunun kurucusu"
  }
};

const formatDate = (timestamp) => {
  if (!timestamp) return "Bilinmiyor";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
};

export default function UserProfileModal({ member, position, onClose }) {
  const modalRef = useRef(null);
  const { user: currentUser } = useAuthStore();
  const { currentServer, roles, badges: serverBadges } = useServerStore();
  const { openSettingsToSection } = useSettingsStore();
  const [userProfile, setUserProfile] = useState(null);
  const [modalPosition, setModalPosition] = useState(position || { x: 0, y: 0 });
  const [isPositioned, setIsPositioned] = useState(false);

  const isOwnProfile = currentUser?.uid === (member?.id || member?.userId);
  const isOwner = currentServer?.ownerId === (member?.id || member?.userId);

  useEffect(() => {
    if (!member) return;
    const userId = member.id || member.userId;
    if (!userId) return;

    // Listen to user updates in real-time
    const unsub = onSnapshot(doc(db, "users", userId), (doc) => {
      if (doc.exists()) {
        setUserProfile(doc.data());
      }
    }, (error) => {
      console.error("Error fetching profile:", error);
    });

    return () => unsub();
  }, [member]);

  // Pozisyon Hesaplama
  useEffect(() => {
    if (!position || !modalRef.current) return;
    requestAnimationFrame(() => {
      if (!modalRef.current) return;
      const modal = modalRef.current;
      const modalRect = modal.getBoundingClientRect();
      if (modalRect.width === 0) return;
      
      const padding = 16;
      let x = position.x + 10;
      let y = position.y;

      if (x + modalRect.width + padding > window.innerWidth) x = position.x - modalRect.width - 10;
      if (y + modalRect.height + padding > window.innerHeight) y = window.innerHeight - modalRect.height - padding;
      if (x < padding) x = padding;
      if (y < padding) y = padding;

      setModalPosition({ x, y });
      setIsPositioned(true);
    });
  }, [position]);

  // --- DÜZELTİLEN KISIM BAŞLANGIÇ ---
  // Tıklama ile kapatma mantığı (Anında Tepki)
  useEffect(() => {
    const handleEsc = (e) => { 
      if (e.key === "Escape") onClose(); 
    };

    const handleClickOutside = (e) => {
      // Eğer tıklanan yer modalın kendisi veya içindekiler DEĞİLSE kapat
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        e.preventDefault(); // İstenmeyen seçimleri engelle
        e.stopPropagation(); // Event'in yukarı taşmasını engelle
        onClose();
      }
    };

    window.addEventListener("keydown", handleEsc);

    // setTimeout(..., 0) kullanmak, bu listener'ın modalı AÇAN tıklama eventinden
    // sonra eklenmesini sağlar. Böylece açıldığı an kapanmaz ama hemen sonrasında aktiftir.
    // 100ms gecikmeyi kaldırdık, "mousedown" kullanarak tıklama başlar başlamaz yakalıyoruz.
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("contextmenu", handleClickOutside); // Sağ tıkta da kapansın
    }, 0);

    return () => {
      window.removeEventListener("keydown", handleEsc);
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("contextmenu", handleClickOutside);
    };
  }, [onClose]);
  // --- DÜZELTİLEN KISIM BİTİŞ ---

  if (!member) return null;

  const getMemberBadges = () => {
    const badges = [];
    if (isOwner) badges.push(BADGES.owner);
    if (member.badges && serverBadges) {
      member.badges.forEach(badgeId => {
        const sb = serverBadges.find(b => b.id === badgeId);
        if (sb) badges.push({ ...sb, isCustom: true, bgColor: `${sb.color || "#f59e0b"}25` });
      });
    }
    return badges;
  };

  const getMemberRoles = () => {
    if (!member.roles || !roles) return [];
    return member.roles.map(rId => roles.find(r => r.id === rId)).filter(Boolean).filter(r => !r.isDefault);
  };

  const memberBadges = getMemberBadges();
  const memberRoles = getMemberRoles();
  const effectivePresence = getEffectivePresence(userProfile || member);
  
  const bannerColor = userProfile?.bannerColor || member.profileColor || "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)";
  const profileBgImage = userProfile?.profileBgImage;
  const nameColor = member.color || "#ffffff";

  const modalContent = (
    <div
      ref={modalRef}
      className={`fixed z-[500] duration-300 ease-out ${isPositioned ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}
      style={{ left: modalPosition.x, top: modalPosition.y }}
      onMouseDown={(e) => e.stopPropagation()} // Modal içine tıklanınca document listener'ı tetikleme
    >
      <div className="w-[320px] rounded-[18px] overflow-hidden bg-[#0f0f11] border border-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] flex flex-col relative group/modal">
        
        {/* Banner Section */}
        <div className="h-[130px] relative w-full group/banner bg-[#1e1f22]">
           {profileBgImage ? (
             <>
               <img 
                 src={profileBgImage} 
                 className="absolute inset-0 w-full h-full object-cover" 
                 alt="banner" 
               />
               <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f11] via-transparent to-black/30"></div>
             </>
           ) : (
             <>
               <div className="absolute inset-0" style={{ background: bannerColor }}></div>
               <div className="absolute inset-0 opacity-[0.15] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
               <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-[#0f0f11]/80"></div>
             </>
           )}

           {/* Actions */}
           <div className="absolute top-3 right-3 flex gap-2 z-20">
              {isOwnProfile ? (
                <button 
                  onClick={() => { onClose(); openSettingsToSection("profileInfo"); }}
                  className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white/90 hover:text-white backdrop-blur-md flex items-center justify-center border border-white/10 transition-all hover:scale-105"
                  title="Profili Düzenle"
                >
                  <Edit3 size={14} />
                </button>
              ) : (
                <button className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white/90 hover:text-white backdrop-blur-md flex items-center justify-center border border-white/10 transition-all">
                   <MoreHorizontal size={16} />
                </button>
              )}
           </div>
        </div>

        {/* Avatar & Badges */}
        <div className="px-5 relative z-10 -mt-[54px] mb-3">
           <div className="flex justify-between items-end">
              <div className="relative group/avatar">
                 <Avatar 
                    src={member.photoURL || userProfile?.photoURL} 
                    name={member.displayName} 
                    size="xl" 
                    status={effectivePresence}
                    className="ring-[4px] ring-[#0f0f11] rounded-full relative z-10 transition-transform duration-300 group-hover/avatar:scale-[1.02]"
                 />
                 {isOwner && (
                    <div className="absolute -top-1 -right-1 z-20 bg-[#0f0f11] rounded-full p-1 ring-2 ring-[#0f0f11]">
                       <div className="bg-gradient-to-br from-amber-300 to-amber-600 rounded-full p-1 shadow-lg shadow-amber-500/40">
                          <Crown size={12} className="text-white" />
                       </div>
                    </div>
                 )}
              </div>

              {/* Badges */}
              {memberBadges.length > 0 && (
                 <div className="flex flex-wrap justify-end gap-1.5 mb-2 max-w-[150px]">
                    {memberBadges.map((badge) => (
                       <div 
                          key={badge.id}
                          className="w-8 h-8 rounded-xl bg-[#1e1f22] border border-white/10 flex items-center justify-center hover:scale-110 transition-transform cursor-help shadow-md relative overflow-hidden group/badge"
                          title={badge.name}
                       >
                          <div className="absolute inset-0 opacity-20 group-hover/badge:opacity-40 transition-opacity" style={{ backgroundColor: badge.color }}></div>
                          {badge.icon ? (
                             <badge.icon size={15} color={badge.color} className="relative z-10" />
                          ) : (
                             <img src={badge.iconUrl} className="w-4 h-4 object-contain relative z-10" />
                          )}
                       </div>
                    ))}
                 </div>
              )}
           </div>
        </div>

        {/* User Info Body */}
        <div className="px-5 pb-5 bg-[#0f0f11] flex-1">
           
           <div className="mb-4">
              <h3 
                className="text-[22px] font-bold leading-tight flex items-center gap-2"
                style={{ color: nameColor }} 
              >
                 {member.displayName}
              </h3>
              <p className="text-sm font-medium text-[#949ba4]">@{member.displayName?.toLowerCase().replace(/\s/g, '')}</p>
           </div>

           <div className="space-y-4">
              
              {/* Custom Status */}
              {(userProfile?.customStatus || member.customStatus) && (
                 <div className="relative overflow-hidden bg-[#1e1f22] p-3 rounded-xl border border-white/5 group/status">
                    <div className="absolute left-0 top-0 w-1 h-full bg-gradient-to-b from-indigo-500 to-purple-500"></div>
                    <p 
                className="text-sm text-[#dbdee1] leading-relaxed font-medium"
                style={{ color: userProfile?.customStatusColor || "inherit" }}
              >
                {userProfile?.customStatus || member.customStatus}
              </p>
                 </div>
              )}


              {/* Game Activity */}
              {userProfile?.gameActivity && (
                 <div>
                    <h4 className="text-[11px] font-bold text-[#949ba4] uppercase mb-2 flex items-center gap-1.5">
                      <Gamepad2 size={12} /> Aktivite
                    </h4>
                    <div className="relative rounded-xl p-0.5 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-lg shadow-purple-500/10 group/game">
                       <div className="bg-[#111214]/95 backdrop-blur-xl rounded-[10px] p-3 h-full relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/20 blur-[50px] rounded-full translate-x-10 -translate-y-10"></div>
                          
                          <div className="flex items-center gap-3 relative z-10">
                             <div className="relative">
                                <GameIcon 
                                   iconUrl={userProfile.gameActivity.iconUrl} 
                                   icon={userProfile.gameActivity.icon}
                                   name={userProfile.gameActivity.name}
                                   className="w-12 h-12 rounded-lg object-cover shadow-md"
                                   emojiClassName="text-3xl"
                                />
                                <div className="absolute -bottom-1 -right-1 bg-green-500 border-[2px] border-[#111214] w-3.5 h-3.5 rounded-full"></div>
                             </div>
                             
                             <div className="min-w-0 flex-1">
                                <div className="text-[10px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 uppercase tracking-wide mb-0.5">Oynuyor</div>
                                <div className="text-sm font-bold text-white truncate">{userProfile.gameActivity.name}</div>
                                <div className="text-xs text-[#949ba4] flex items-center gap-1.5 mt-0.5">
                                   <Clock size={10} />
                                   <GameDuration startTime={userProfile.gameActivity.startedAt} />
                                </div>
                             </div>
                          </div>
                       </div>
                    </div>
                 </div>
              )}

              {/* Bio */}
              {userProfile?.bio && (
                 <div>
                    <h4 className="text-[11px] font-bold text-[#949ba4] uppercase mb-1.5">Hakkında</h4>
                    <div className="bg-[#1e1f22]/50 rounded-xl p-3 border border-white/5">
                      <p className="text-[13px] text-[#dbdee1] leading-relaxed whitespace-pre-wrap">
                         {userProfile.bio}
                      </p>
                    </div>
                 </div>
              )}

              {/* Roles */}
              {memberRoles.length > 0 && (
                 <div>
                    <h4 className="text-[11px] font-bold text-[#949ba4] uppercase mb-2">Roller</h4>
                    <div className="flex flex-wrap gap-1.5">
                       {memberRoles.map((role) => (
                          <div 
                             key={role.id} 
                             className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1e1f22] border border-white/5 hover:border-white/10 hover:bg-[#25272a] transition-colors cursor-default"
                          >
                             <div className="w-2 h-2 rounded-full shadow-[0_0_5px_currentColor]" style={{ color: role.color, backgroundColor: role.color }}></div>
                             <span className="text-xs text-[#dbdee1] font-medium">{role.name}</span>
                          </div>
                       ))}
                    </div>
                 </div>
              )}

              {/* Footer Dates */}
              <div className="pt-2 border-t border-white/5 space-y-2">
                 <div className="flex items-center gap-3 bg-gradient-to-r from-[#1e1f22] to-[#16171a] p-2.5 rounded-xl border border-white/5 hover:border-indigo-500/30 transition-colors group/date">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center group-hover:bg-indigo-500/20 transition-colors">
                       <Calendar size={14} className="text-indigo-400" />
                    </div>
                    <div className="flex flex-col flex-1">
                       <span className="text-[10px] font-bold text-[#949ba4] uppercase tracking-wide">Sunucuya Katıldı</span>
                       <span className="text-xs font-medium text-white">{formatDate(member.joinedAt)}</span>
                    </div>
                 </div>

                 {userProfile?.createdAt && (
                    <div className="flex items-center gap-3 bg-gradient-to-r from-[#1e1f22] to-[#16171a] p-2.5 rounded-xl border border-white/5 hover:border-green-500/30 transition-colors group/date">
                       <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
                          <Sparkles size={14} className="text-green-400" />
                       </div>
                       <div className="flex flex-col flex-1">
                          <span className="text-[10px] font-bold text-[#949ba4] uppercase tracking-wide">Netrex'e Katıldı</span>
                          <span className="text-xs font-medium text-white">{formatDate(userProfile.createdAt)}</span>
                       </div>
                    </div>
                 )}
              </div>

           </div>
        </div>
      </div>
    </div>
  );

  if (typeof window === "undefined") return null;
  return createPortal(modalContent, document.body);
}