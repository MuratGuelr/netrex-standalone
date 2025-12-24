"use client";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Input from "@/src/components/ui/Input";
import Button from "@/src/components/ui/Button";
import { useServerStore } from "@/src/store/serverStore";
import { useAuthStore } from "@/src/store/authStore";
import { 
  Settings, 
  Shield, 
  Users, 
  Trash2, 
  Plus, 
  Save,
  Link,
  X,
  ChevronRight,
  Crown,
  Check,
  Copy,
  Calendar,
  Infinity
} from "lucide-react";
import { toast } from "sonner";

import { useServerPermission } from "@/src/hooks/useServerPermission";

export default function ServerSettingsModal({ isOpen, onClose, initialTab }) {
  const { currentServer, updateServer, deleteServer, roles, createRole, updateRole, deleteRole, members, createInvite, activeInvites, fetchServerInvites } = useServerStore();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState(initialTab || "overview");
  const [showCreateRoleModal, setShowCreateRoleModal] = useState(false);
  const [mounted, setMounted] = useState(false);
  const contentRef = useRef(null);

  // Permissions
  const canManageServer = useServerPermission("MANAGE_SERVER");
  const canManageRoles = useServerPermission("MANAGE_ROLES");
  const canKickMembers = useServerPermission("KICK_MEMBERS");
  const canBanMembers = useServerPermission("BAN_MEMBERS");
  const isOwner = currentServer?.ownerId === user?.uid;

  // Access checks
  const canViewOverview = isOwner || canManageServer;
  const canViewRoles = isOwner || canManageRoles;
  const canViewMembers = isOwner || canManageServer || canKickMembers || canBanMembers;
  
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleEsc = (e) => {
      if (isOpen && e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  // Scroll to top when tab changes
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [activeTab]);
  
  // If user lands on a tab they can't see, redirect to one they can (prefer invites if that's what triggers it)
  useEffect(() => {
      if (!isOwner && initialTab === 'invites') return; // Stay on invites if explicitly asked
      
      // Safety fallbacks if current tab is restricted
      if (activeTab === 'overview' && !canViewOverview) {
          if (canViewRoles) setActiveTab('roles');
          else if (canViewMembers) setActiveTab('members');
          else setActiveTab('invites');
      }
  }, [activeTab, canViewOverview, canViewRoles, canViewMembers, isOwner, initialTab]);

  if (!mounted || !isOpen || !currentServer) return null;

  const renderContent = () => {
    switch (activeTab) {
      case "overview":
        return canViewOverview ? <OverviewTab server={currentServer} onUpdate={updateServer} onDelete={deleteServer} isOwner={isOwner} onClose={onClose} /> : null;
      case "roles":
        return canViewRoles ? <RolesTab roles={roles} onCreate={createRole} onUpdate={updateRole} onDelete={deleteRole} showCreateModal={showCreateRoleModal} setShowCreateModal={setShowCreateRoleModal} /> : null;
      case "members":
        return canViewMembers ? <MembersTab members={members} roles={roles} /> : null;
      case "invites":
        return <InvitesTab invites={activeInvites} onCreate={createInvite} serverId={currentServer.id} userId={user.uid} fetchInvites={fetchServerInvites} />;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center backdrop-blur-md animate-nds-fade-in">
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-transparent pointer-events-none"></div>

      <div className="glass-modal w-[800px] h-[600px] rounded-3xl shadow-nds-elevated flex overflow-hidden border border-nds-border-medium animate-nds-scale-in backdrop-blur-2xl bg-gradient-to-br from-nds-bg-deep/95 via-nds-bg-secondary/95 to-nds-bg-tertiary/95 relative">
        {/* ESC Close Button */}
        <div
          className="absolute top-5 right-5 flex flex-col items-center group cursor-pointer z-[10000]"
          onClick={onClose}
        >
          <div className="w-9 h-9 rounded-xl glass-strong border border-nds-border-light flex items-center justify-center text-nds-text-tertiary group-hover:bg-gradient-to-br group-hover:from-nds-danger/20 group-hover:to-nds-danger/30 group-hover:text-nds-danger group-hover:border-nds-danger/30 transition-all duration-medium hover:scale-110 hover:shadow-[0_0_15px_rgba(239,68,68,0.4)] relative group/close">
            <X
              size={18}
              strokeWidth={2.5}
              className="relative z-10 group-hover/close:rotate-90 transition-transform duration-300"
            />
          </div>
          <span className="text-[9px] font-bold text-nds-text-tertiary mt-1 group-hover:text-nds-text-secondary transition-colors">
            ESC
          </span>
        </div>
        
        {/* Top glow effect */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent z-10"></div>

        {/* Sidebar */}
        <div className="w-56 bg-gradient-to-b from-[#1a1b1e] via-[#16171a] to-[#111214] p-3 flex flex-col border-r border-white/10 relative overflow-hidden">
          {/* Sidebar background glow */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-indigo-500/10 to-transparent"></div>
            <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-purple-500/5 to-transparent"></div>
          </div>

          {/* Header */}
          <div className="relative z-10 px-3 py-4 mb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 text-white font-bold">
                {currentServer.name?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-white font-bold text-sm leading-none truncate">{currentServer.name}</h1>
                <span className="text-[10px] text-[#949ba4] font-medium">Sunucu Ayarları</span>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mx-2 mb-3 relative z-10"></div>

          {/* Menu Items */}
          <div className="relative z-10 space-y-0.5">
            {canViewOverview && (
              <SidebarItem
                label="Genel Bakış"
                icon={<Settings size={16} />}
                active={activeTab === "overview"}
                onClick={() => setActiveTab("overview")}
                color="indigo"
              />
            )}
            
            {canViewRoles && (
              <SidebarItem
                label="Roller"
                icon={<Shield size={16} />}
                active={activeTab === "roles"}
                onClick={() => setActiveTab("roles")}
                color="purple"
              />
            )}
            
            {canViewMembers && (
              <SidebarItem
                label="Üyeler"
                icon={<Users size={16} />}
                active={activeTab === "members"}
                onClick={() => setActiveTab("members")}
                color="cyan"
              />
            )}
            
            <SidebarItem
              label="Davetler"
              icon={<Link size={16} />}
              active={activeTab === "invites"}
              onClick={() => setActiveTab("invites")}
              color="orange"
            />
          </div>

          {/* Footer */}
          <div className="mt-auto px-2 pt-3 relative z-10">
            <div className="glass-strong rounded-xl p-3 border border-white/10 flex items-center gap-2.5">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
              <div className="flex-1">
                <div className="text-[11px] text-white font-medium">{members.length} Üye</div>
                <div className="text-[10px] text-[#949ba4]">{roles.length} Rol</div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 bg-gradient-to-br from-nds-bg-tertiary to-nds-bg-primary relative flex flex-col min-w-0">
          <div ref={contentRef} className="flex-1 overflow-y-auto scrollbar-thin p-6 pb-20 relative">
            {/* Animated background particles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl animate-pulse-slow"></div>
              <div
                className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl animate-pulse-slow"
                style={{ animationDelay: "1s" }}
              ></div>
            </div>

            <div className="relative z-10" key={activeTab}>
              <div className="animate-page-enter">
                {renderContent()}
              </div>
            </div>
          </div>
        </div>
        
        {/* Global Floating Action Buttons */}
        {activeTab === "roles" && (
          <div className="absolute bottom-8 right-8 z-[100] animate-nds-fade-in">
            <Button 
              onClick={() => setShowCreateRoleModal(true)} 
              className="shadow-[0_10px_30px_rgba(99,102,241,0.3)] hover:scale-105 active:scale-95 group transition-all h-12 px-6 rounded-2xl border-0"
            >
              <Plus size={20} className="mr-2 group-hover:rotate-90 transition-transform duration-300" />
              Rol Oluştur
            </Button>
          </div>
        )}

        {activeTab === "invites" && (
          <div className="absolute bottom-8 right-8 z-[100] animate-nds-fade-in">
            <Button 
              onClick={() => createInvite(currentServer.id, { userId: user.uid })} 
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-[0_10px_30px_rgba(249,115,22,0.3)] hover:scale-105 active:scale-95 group transition-all h-12 px-6 rounded-2xl border-0"
            >
              <Plus size={20} className="mr-2 group-hover:rotate-90 transition-transform duration-300" />
              Davet Oluştur
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// Sidebar Item Component
function SidebarItem({ label, icon, active, onClick, color = "indigo" }) {
  const colorClasses = {
    indigo: {
      activeBg: "from-indigo-500/20 to-indigo-600/10",
      activeBorder: "border-indigo-500/40",
      activeIcon: "text-indigo-400",
      activeDot: "bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.6)]",
    },
    purple: {
      activeBg: "from-purple-500/20 to-purple-600/10",
      activeBorder: "border-purple-500/40",
      activeIcon: "text-purple-400",
      activeDot: "bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.6)]",
    },
    cyan: {
      activeBg: "from-cyan-500/20 to-cyan-600/10",
      activeBorder: "border-cyan-500/40",
      activeIcon: "text-cyan-400",
      activeDot: "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]",
    },
    orange: {
      activeBg: "from-orange-500/20 to-orange-600/10",
      activeBorder: "border-orange-500/40",
      activeIcon: "text-orange-400",
      activeDot: "bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.6)]",
    },
  };

  const colors = colorClasses[color] || colorClasses.indigo;

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-300 w-full text-left relative group/item overflow-hidden ${
        active
          ? `bg-gradient-to-r ${colors.activeBg} text-white border ${colors.activeBorder}`
          : "text-[#949ba4] hover:text-white border border-transparent hover:bg-white/5"
      }`}
    >
      <div
        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-300 ${
          active
            ? `bg-white/10 ${colors.activeIcon}`
            : "bg-white/5 text-[#949ba4] group-hover/item:bg-white/10 group-hover/item:text-white"
        }`}
      >
        {icon}
      </div>
      
      <span className="flex-1">{label}</span>

      {active && (
        <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${colors.activeDot}`}></div>
      )}
      
      {!active && (
        <ChevronRight 
          size={14} 
          className="text-[#949ba4] opacity-0 group-hover/item:opacity-100 transition-all duration-300" 
        />
      )}
    </button>
  );
}

// Overview Tab
function OverviewTab({ server, onUpdate, onDelete, isOwner, onClose }) {
  const [name, setName] = useState(server.name);
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleUpdate = async () => {
    if (!name.trim() || name === server.name) return;
    setIsLoading(true);
    await onUpdate(server.id, { name });
    setIsLoading(false);
    toast.success("Sunucu güncellendi");
  };

  const handleDelete = async () => {
    await onDelete(server.id);
    toast.success("Sunucu silindi");
    onClose();
  };

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <Settings size={20} className="text-indigo-400" />
        Genel Bakış
      </h3>

      {/* Server Name */}
      <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 shadow-soft-lg">
        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-4 flex items-center gap-2">
          <div className="w-1 h-1 bg-indigo-400 rounded-full"></div>
          Sunucu Adı
        </h4>
        <div className="flex gap-3">
          <Input 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            className="flex-1"
            placeholder="Sunucu adı..."
          />
          <Button 
            onClick={handleUpdate} 
            loading={isLoading} 
            disabled={name === server.name}
            className="px-4"
          >
            <Save size={16} />
          </Button>
        </div>
      </div>

      {/* Danger Zone */}
      {isOwner && (
        <div className="glass-strong rounded-2xl border border-red-500/30 overflow-hidden p-5 shadow-soft-lg bg-red-500/5">
          <h4 className="text-xs font-bold text-red-400 uppercase mb-4 flex items-center gap-2">
            <div className="w-1 h-1 bg-red-400 rounded-full"></div>
            Tehlikeli Bölge
          </h4>
          <p className="text-sm text-gray-400 mb-4">
            Bu işlem geri alınamaz. Sunucu ve tüm içeriği kalıcı olarak silinecektir.
          </p>
          <Button 
            variant="danger" 
            onClick={() => setShowDeleteModal(true)}
          >
            <Trash2 size={16} className="mr-2" />
            Sunucuyu Sil
          </Button>
        </div>
      )}

      {/* Delete Server Confirmation Modal */}
      {showDeleteModal && createPortal(
        <div className="fixed inset-0 z-[10020] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-nds-fade-in" onClick={() => setShowDeleteModal(false)}></div>
          
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
                
                <h3 className="text-2xl font-bold text-white mb-3">Sunucuyu Sil</h3>
                
                <p className="text-gray-400 text-base mb-8 leading-relaxed">
                   <span className="text-white font-bold">{server.name}</span> sunucusunu silmek istediğinize emin misiniz? <br/>
                   <span className="text-red-400/80 text-sm mt-2 block">Bu işlem geri alınamaz ve tüm kanal/mesaj verileri silinir.</span>
                </p>
                
                <div className="flex gap-4 justify-center">
                    <Button 
                      variant="ghost" 
                      onClick={() => setShowDeleteModal(false)}
                      className="hover:bg-white/5 text-gray-400 hover:text-white px-6 h-11"
                    >
                      İptal
                    </Button>
                    <Button 
                      onClick={handleDelete}
                      className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg shadow-red-500/25 px-8 h-11 border-0"
                    >
                      Evet, Sunucuyu Sil
                    </Button>
                </div>
             </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// Members Tab
function MembersTab({ members, roles }) {
  const { user: currentUser } = useAuthStore();
  
  // Enrich members with fallback data
  const enrichedMembers = members.map(member => {
    if (currentUser && (member.id === currentUser.uid || member.userId === currentUser.uid)) {
      return {
        ...member,
        displayName: member.displayName || member.nickname || currentUser.displayName || "User",
        photoURL: member.photoURL || currentUser.photoURL || null
      };
    }
    return {
      ...member,
      displayName: member.displayName || member.nickname || `User${member.id?.slice(-4) || ''}`,
      photoURL: member.photoURL || null
    };
  });

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <Users size={20} className="text-cyan-400" />
        Üyeler ({enrichedMembers.length})
      </h3>

      <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 shadow-soft-lg">
        <div className="space-y-2">
          {enrichedMembers.map(member => (
            <div key={member.id} className="flex items-center justify-between p-3 hover:bg-white/5 rounded-xl transition-colors group">
              <div className="flex items-center gap-3">
                {member.photoURL ? (
                  <img 
                    src={member.photoURL} 
                    alt={member.displayName} 
                    className="w-10 h-10 rounded-xl object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                    {member.displayName?.charAt(0).toUpperCase() || '?'}
                  </div>
                )}
                <div>
                  <span className="text-white font-medium">{member.displayName}</span>
                  <div className="flex gap-1 mt-1">
                    {member.roles?.slice(0, 3).map(roleId => {
                      const role = roles.find(r => r.id === roleId);
                      return role ? (
                        <span 
                          key={roleId}
                          className="text-[10px] px-1.5 py-0.5 rounded-full"
                          style={{ backgroundColor: role.color + '30', color: role.color }}
                        >
                          {role.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const PERMISSIONS = [
  { id: "MANAGE_SERVER", label: "Sunucuyu Yönet" },
  { id: "MANAGE_CHANNELS", label: "Kanalları Yönet" },
  { id: "MANAGE_ROLES", label: "Rolleri Yönet" },
  { id: "KICK_MEMBERS", label: "Üyeleri At" },
  { id: "BAN_MEMBERS", label: "Üyeleri Yasakla" },
];

const ROLE_COLOR_PRESETS = [
  "#6366f1", "#8b5cf6", "#d946ef", "#f43f5e", "#f59e0b", "#10b981", "#06b6d4", "#3b82f6", "#94a3b8", "#1e1f22", "#2b2d31", "#ffffff"
];

function ColorPicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {ROLE_COLOR_PRESETS.map((preset, idx) => {
        const isGradient = preset.includes("gradient");
        const isActive = value === preset;
        
        return (
          <button
            key={idx}
            onClick={() => onChange(preset)}
            className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 active:scale-90 ${isActive ? 'border-white scale-110 shadow-[0_0_10px_rgba(255,255,255,0.3)]' : 'border-transparent opacity-80 hover:opacity-100'}`}
            style={{ 
              background: preset,
            }}
            title={isGradient ? "Gradient Renk" : preset}
          />
        );
      })}
    </div>
  );
}

function PremiumColorInput({ value, onChange }) {
  const inputRef = useRef(null);
  
  return (
    <div className="flex items-center gap-3">
      {/* Visual Color Box */}
      <button 
        onClick={() => inputRef.current?.click()}
        className="w-12 h-12 rounded-xl border border-white/20 shadow-lg group relative overflow-hidden transition-transform hover:scale-105 active:scale-95 flex-shrink-0"
        style={{ background: value }}
        title="Renk Seç"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity scale-75 group-hover:scale-100 duration-300">
           <Plus size={16} className="text-white drop-shadow-md" />
        </div>
        {/* Hidden Native Input */}
        <input 
          ref={inputRef}
          type="color" 
          value={value?.startsWith('linear') ? '#6366f1' : value} 
          onChange={(e) => onChange(e.target.value)} 
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        />
      </button>

      {/* Hex Input */}
      <div className="flex-1 relative group">
        <Input 
          value={value} 
          onChange={(e) => onChange(e.target.value)}
          className="pl-9 font-mono tracking-wider"
          placeholder="#000000"
        />
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-nds-text-muted font-mono text-sm group-focus-within:text-nds-accent-primary transition-colors">
          #
        </div>
      </div>
    </div>
  );
}

// Roles Tab
function RolesTab({ roles, onCreate, onUpdate, onDelete, showCreateModal, setShowCreateModal }) {
  const sortedRoles = [...roles].sort((a, b) => (b.order || 0) - (a.order || 0));
  const [editingRole, setEditingRole] = useState(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleColor, setNewRoleColor] = useState("#6366f1");

  const handleCreate = async () => {
    if (!newRoleName.trim()) {
      toast.error("Rol adı boş olamaz");
      return;
    }
    await onCreate(newRoleName, newRoleColor);
    toast.success("Rol oluşturuldu");
    setNewRoleName("");
    setNewRoleColor("#6366f1");
    setShowCreateModal(false);
  };

  if (editingRole) {
    const role = roles.find(r => r.id === editingRole);
    if (!role) {
      setEditingRole(null);
      return null;
    }

    const togglePermission = (permId) => {
      const currentPerms = role.permissions || [];
      const newPerms = currentPerms.includes(permId) 
        ? currentPerms.filter(p => p !== permId)
        : [...currentPerms, permId];
      onUpdate(role.id, { permissions: newPerms });
    };

    return (
      <div className="space-y-6 animate-in slide-in-from-right-4 duration-200">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="sm" onClick={() => setEditingRole(null)}>
            ← Geri
          </Button>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: role.color }}></div>
            {role.name} Düzenle
          </h3>
        </div>
        
        {/* Role Name & Color */}
        <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 shadow-soft-lg">
          <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-4">Rol Bilgileri</h4>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase block mb-2">Rol Adı</label>
              <Input 
                value={role.name} 
                onChange={(e) => onUpdate(role.id, { name: e.target.value })} 
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase block mb-2">Renk</label>
              <PremiumColorInput 
                value={role.color} 
                onChange={(color) => onUpdate(role.id, { color })} 
              />
              <ColorPicker value={role.color} onChange={(color) => onUpdate(role.id, { color })} />
            </div>
          </div>
        </div>
        
        {/* Permissions */}
        <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 shadow-soft-lg">
          <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-4">İzinler</h4>
          <div className="space-y-2">
            {PERMISSIONS.map(perm => (
              <div 
                key={perm.id} 
                className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-colors" 
                onClick={() => togglePermission(perm.id)}
              >
                <span className="text-gray-300">{perm.label}</span>
                <div className={`w-12 h-7 rounded-full relative transition-colors ${role.permissions?.includes(perm.id) ? "bg-green-500" : "bg-gray-600"}`}>
                  <div className={`w-5 h-5 rounded-full bg-white absolute top-1 transition-all ${role.permissions?.includes(perm.id) ? "left-6" : "left-1"}`}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Delete Role */}
        {!role.isDefault && (
          <div className="glass-strong rounded-2xl border border-red-500/30 overflow-hidden p-5 shadow-soft-lg bg-red-500/5">
            <Button 
              variant="danger" 
              onClick={() => {
                if(window.confirm("Bu rolü silmek istediğinize emin misiniz?")) {
                  onDelete(role.id);
                  setEditingRole(null);
                  toast.success("Rol silindi");
                }
              }}
            >
              <Trash2 size={16} className="mr-2" />
              Rolü Sil
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <Shield size={20} className="text-purple-400" />
          Roller
        </h3>
      </div>

      {/* Create Role Modal */}
      {showCreateModal && (
        <div className="glass-strong rounded-2xl border border-indigo-500/30 overflow-hidden p-5 shadow-soft-lg bg-indigo-500/5 animate-in fade-in slide-in-from-top-2 duration-200">
          <h4 className="text-sm font-bold text-white mb-4">Yeni Rol Oluştur</h4>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase block mb-2">Rol Adı</label>
              <Input 
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="Rol adını girin..."
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase block mb-2">Renk</label>
              <PremiumColorInput 
                value={newRoleColor} 
                onChange={setNewRoleColor} 
              />
              <ColorPicker value={newRoleColor} onChange={setNewRoleColor} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowCreateModal(false)}>
                İptal
              </Button>
              <Button onClick={handleCreate}>
                <Check size={14} className="mr-1" />
                Oluştur
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Roles List */}
      <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 shadow-soft-lg">
        <div className="space-y-2">
          {sortedRoles.map(role => (
            <div 
              key={role.id} 
              onClick={() => setEditingRole(role.id)} 
              className="flex items-center justify-between p-3 bg-[#1e1f22] rounded-xl border border-white/5 hover:border-white/10 group cursor-pointer hover:bg-[#2b2d31] transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: role.color }}></div>
                <span className="font-medium text-gray-200">{role.name}</span>
                {role.isDefault && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400">Varsayılan</span>
                )}
              </div>
              <div className="flex gap-2 items-center">
                <Settings size={14} className="text-gray-400 group-hover:text-white transition-colors" />
                {!role.isDefault && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      if(window.confirm("Rolü sil?")) onDelete(role.id);
                    }} 
                    className="p-1 hover:bg-red-500/20 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={14} className="text-red-400" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

// Invites Tab
function InvitesTab({ invites, onCreate, serverId, userId, fetchInvites }) {
  const { deleteInvite } = useServerStore();
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    fetchInvites(serverId);
  }, [serverId, fetchInvites]);
  
  const handleCreate = async () => {
    await onCreate(serverId, { userId });
    toast.success("Davet kodu oluşturuldu");
  };

  const handleConfirmDelete = async () => {
    if (deleteId) {
       await deleteInvite(deleteId, serverId);
       toast.success("Davet silindi");
       setDeleteId(null);
    }
  };

  const copyToClipboard = (code) => {
    const link = `netrex://${code}`;
    navigator.clipboard.writeText(link)
      .then(() => toast.success("Davet linki kopyalandı"))
      .catch(() => toast.error("Kopyalama başarısız"));
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <Link size={20} className="text-orange-400" />
          Davetler
        </h3>
      </div>

      <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 shadow-soft-lg min-h-[400px]">
        <div className="space-y-3">
          {invites && invites.length > 0 ? invites.map(invite => (
            <div 
              key={invite.code} 
              className="group relative overflow-hidden rounded-xl bg-[#1e1f22]/50 border border-white/5 hover:border-orange-500/30 transition-all duration-300 hover:shadow-[0_0_20px_rgba(249,115,22,0.1)]"
            >
              {/* Hover Gradient Background */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              
              <div className="relative p-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <div 
                      onClick={() => copyToClipboard(invite.code)}
                      className="h-9 px-3 rounded-lg bg-[#111214] border border-white/10 flex items-center gap-2 cursor-pointer group/code hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-all"
                    >
                      <span className="text-gray-500 text-xs font-mono select-none">netrex://</span>
                      <span className="text-indigo-300 text-sm font-mono font-bold tracking-wide group-hover/code:text-indigo-200 transition-colors">
                        {invite.code}
                      </span>
                    </div>

                    <button 
                      onClick={() => copyToClipboard(invite.code)}
                      className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100 translate-x-[-10px] group-hover:translate-x-0 duration-200"
                      title="Kopyala"
                    >
                      <Copy size={16} />
                    </button>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-500 font-medium pl-1">
                     <div className="flex items-center gap-1.5">
                        <Users size={12} className="text-gray-400" />
                        <span className="text-gray-300">{invite.uses}</span>
                        <span className="text-gray-600">/</span>
                        <span className="text-gray-400">{invite.maxUses || <Infinity size={12} />}</span>
                     </div>
                     <div className="w-1 h-1 rounded-full bg-gray-700"></div>
                     <div className="flex items-center gap-1.5">
                        <Calendar size={12} className="text-gray-400" />
                        <span className="text-gray-400">
                          {invite.expiresAt ? 'Süreli' : 'Süresiz'}
                        </span>
                     </div>
                  </div>
                </div>
                
                <button 
                  onClick={() => setDeleteId(invite.code)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:scale-105 transition-all opacity-0 group-hover:opacity-100"
                  title="Daveti Sil"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          )) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500/20 to-red-600/20 flex items-center justify-center mb-4 animate-pulse-slow">
                <Link size={32} className="text-orange-400" />
              </div>
              <h4 className="text-white font-bold text-lg mb-2">Henüz Davet Yok</h4>
              <p className="text-gray-400 text-sm max-w-[250px] leading-relaxed">
                Arkadaşlarını sunucuna davet etmek için yeni bir davet kodu oluştur.
              </p>
              <Button 
                onClick={handleCreate} 
                className="mt-6 bg-white/5 hover:bg-white/10 border-white/10"
                variant="outline"
              >
                <Plus size={14} className="mr-2" />
                İlk Daveti Oluştur
              </Button>
            </div>
          )}
        </div>
      </div>


      {/* Delete Confirmation Modal */}
      {deleteId && createPortal(
        <div className="fixed inset-0 z-[10020] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-nds-fade-in" onClick={() => setDeleteId(null)}></div>
          
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
                
                <h3 className="text-2xl font-bold text-white mb-3">Daveti Sil</h3>
                
                <p className="text-gray-400 text-base mb-8 leading-relaxed">
                   <span className="text-indigo-300 font-mono font-bold bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20 mx-1 select-all">{deleteId}</span> 
                   kodlu daveti silmek istediğinize emin misiniz? <br/>
                   <span className="text-red-400/80 text-sm mt-2 block">Bu işlem geri alınamaz.</span>
                </p>
                
                <div className="flex gap-4 justify-center">
                    <Button 
                      variant="ghost" 
                      onClick={() => setDeleteId(null)}
                      className="hover:bg-white/5 text-gray-400 hover:text-white px-6 h-11"
                    >
                      İptal
                    </Button>
                    <Button 
                      onClick={handleConfirmDelete}
                      className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg shadow-red-500/25 px-8 h-11 border-0"
                    >
                      Evet, Sil
                    </Button>
                </div>
             </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
