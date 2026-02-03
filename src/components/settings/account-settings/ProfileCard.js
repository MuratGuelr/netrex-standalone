import { memo } from "react";
import { User, Mail } from "lucide-react";

/**
 * ✅ ProfileCard - Optimized account profile header
 * Shows user avatar, banner, display name, and basic info
 */
const ProfileCard = memo(function ProfileCard({ user, profileColor }) {
  if (!user) return null;

  return (
    <div className="glass-strong rounded-2xl overflow-hidden border border-white/20 shadow-soft-lg mb-8 relative group/card hover:shadow-xl transition-all duration-300">
      {/* Hover glow */}
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 z-10 pointer-events-none"></div>

      {/* Banner */}
      <div
        className="h-28 w-full transition-all duration-300 relative"
        style={{ background: profileColor }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/20"></div>
      </div>

      {/* Content */}
      <div className="px-5 pb-5 relative">
        <div className="flex justify-between items-end -mt-10 mb-4">
          <div className="flex items-end gap-3">
            {/* Avatar */}
            <div className="p-1.5 bg-[#1e1f22] rounded-full">
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center text-white text-4xl font-bold shadow-sm relative overflow-hidden"
                style={{ background: profileColor }}
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  user.displayName?.charAt(0).toUpperCase() || "?"
                )}
              </div>
            </div>
            
            {/* User info */}
            <div className="mb-1">
              <h2 className="text-xl font-bold text-white leading-none">
                {user.displayName || "Misafir Kullanıcı"}
              </h2>
              <span className="text-sm text-[#949ba4] font-medium">
                #{user.uid?.substring(0, 4)}
              </span>
            </div>
          </div>
        </div>

        {/* Info cards */}
        <div className="glass-strong rounded-xl p-5 space-y-4 border border-white/10 relative z-10">
          <div className="flex justify-between items-center group">
            <div>
              <label className="text-[11px] font-bold text-[#949ba4] uppercase mb-1.5 flex items-center gap-1.5">
                <User size={12} className="text-indigo-400" /> Görünen Ad
              </label>
              <div className="text-white text-sm font-medium">
                {user.displayName || "Belirtilmemiş"}
              </div>
            </div>
          </div>
          <div className="h-px bg-white/10"></div>
          <div className="flex justify-between items-center group">
            <div>
              <label className="text-[11px] font-bold text-[#949ba4] uppercase mb-1.5 flex items-center gap-1.5">
                <Mail size={12} className="text-indigo-400" /> E-Posta
              </label>
              <div className="text-white text-sm font-medium">
                {user.email || (
                  <span className="text-[#949ba4] italic">Anonim Hesap</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default ProfileCard;
