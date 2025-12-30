import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useRoomContext } from "@livekit/components-react";
import {
  Mic,
  Keyboard,
  X,
  User,
  Speaker,
  Check,
  Info,
  LogOut,
  Volume2,
  Palette,
  Mail,
  Pipette,
  Zap,
  AppWindow,
  Video,
  VideoOff,
  Camera,
  ShieldAlert,
  Bell,
  Monitor,
  Type,
  ExternalLink,
  Github,
  Youtube,
  ChevronRight,
  Cpu,
} from "lucide-react";
import { useSettingsStore } from "@/src/store/settingsStore";
import { useAuthStore } from "@/src/store/authStore";
import { getKeyLabel, isModifierKey, getMouseLabel } from "@/src/utils/keyMap";
import { useSoundEffects } from "@/src/hooks/useSoundEffects";
import { toastOnce } from "@/src/utils/toast";
import { getCommonFonts } from "@/src/utils/fontDetector";
import { toast } from "sonner";

// ... (PRESET_GRADIENTS, SOLID_COLORS, formatKeybinding AYNI KALSIN) ...
const PRESET_GRADIENTS = [
  "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",
  "linear-gradient(135deg, #3b82f6 0%, #2dd4bf 100%)",
  "linear-gradient(135deg, #f97316 0%, #eab308 100%)",
  "linear-gradient(135deg, #ec4899 0%, #ef4444 100%)",
  "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
  "linear-gradient(135deg, #111827 0%, #4b5563 100%)",
];
const SOLID_COLORS = [
  "#6366f1",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#a855f7",
  "#ec4899",
  "#14b8a6",
];

const formatKeybinding = (keybinding) => {
  if (!keybinding) return "Atanmadı";
  if (keybinding.type === "mouse" || keybinding.mouseButton)
    return getMouseLabel(keybinding.mouseButton);
  if (typeof keybinding.keycode !== "number") return "Atanmadı";
  const keyLabel = getKeyLabel(keybinding.keycode);
  const isStandaloneModifier = isModifierKey(keybinding.keycode);
  if (isStandaloneModifier) return keyLabel;
  const modifiers = [];
  if (keybinding.ctrlKey) modifiers.push("Ctrl");
  if (keybinding.shiftKey) modifiers.push("Shift");
  if (keybinding.altKey) modifiers.push("Alt");
  if (keybinding.metaKey) modifiers.push("Win");
  if (modifiers.length > 0) return [...modifiers, keyLabel].join(" + ");
  return keyLabel;
};

// --- ANA BİLEŞEN ---
export default function SettingsModal({ isOpen, onClose }) {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState("account");
  const contentRef = useRef(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Custom smooth scroll with easing
  const smoothScrollToTop = useCallback((element, duration = 600) => {
    const start = element.scrollTop;
    const startTime = performance.now();
    
    // easeOutQuart - very smooth deceleration
    const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);
    
    const animateScroll = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = easeOutQuart(progress);
      
      element.scrollTop = start * (1 - easeProgress);
      
      if (progress < 1) {
        requestAnimationFrame(animateScroll);
      }
    };
    
    requestAnimationFrame(animateScroll);
  }, []);

  // Scroll to top when tab changes (ultra smooth animation)
  useEffect(() => {
    if (contentRef.current && contentRef.current.scrollTop > 0) {
      smoothScrollToTop(contentRef.current, 500);
    }
  }, [activeTab, smoothScrollToTop]);
  useEffect(() => {
    const handleEsc = (e) => {
      if (isOpen && e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center backdrop-blur-md animate-nds-fade-in">
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-transparent pointer-events-none"></div>

      <div className="glass-modal w-[900px] h-[700px] rounded-3xl shadow-nds-elevated flex overflow-hidden border border-nds-border-medium animate-nds-scale-in backdrop-blur-2xl bg-gradient-to-br from-nds-bg-deep/95 via-nds-bg-secondary/95 to-nds-bg-tertiary/95 relative">
        {/* ESC Close Button - En üstte */}
        <div
          className="absolute top-6 right-6 flex flex-col items-center group cursor-pointer z-[10000]"
          onClick={onClose}
        >
          <div className="w-10 h-10 rounded-xl glass-strong border border-nds-border-light flex items-center justify-center text-nds-text-tertiary group-hover:bg-gradient-to-br group-hover:from-nds-danger/20 group-hover:to-nds-danger/30 group-hover:text-nds-danger group-hover:border-nds-danger/30 transition-all duration-medium hover:scale-110 hover:shadow-[0_0_15px_rgba(239,68,68,0.4)] relative group/close">
            <X
              size={20}
              strokeWidth={2.5}
              className="relative z-10 group-hover/close:rotate-90 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-white/5 rounded-xl opacity-0 group-hover/close:opacity-100 transition-opacity duration-300"></div>
          </div>
          <span className="text-nano font-bold text-nds-text-tertiary mt-1.5 group-hover:text-nds-text-secondary transition-colors">
            ESC
          </span>
        </div>
        
        {/* Top glow effect */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent z-10"></div>

        <div className="w-64 bg-gradient-to-b from-[#1a1b1e] via-[#16171a] to-[#111214] p-3 flex flex-col border-r border-white/10 relative overflow-hidden">
          {/* Sidebar background glow */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-indigo-500/10 to-transparent"></div>
            <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-purple-500/5 to-transparent"></div>
          </div>

          {/* Logo/Header */}
          <div className="relative z-10 px-3 py-4 mb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <img src="/logo.png" alt="Netrex" className="w-10 h-10" />
              </div>
              <div>
                <h1 className="text-white font-bold text-lg leading-none">Ayarlar</h1>
                <span className="text-[10px] text-[#949ba4] font-medium">Netrex Client</span>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mx-2 mb-3 relative z-10"></div>

          {/* Kullanıcı Ayarları */}
          <div className="px-3 pt-2 pb-2 relative z-10">
            <h2 className="text-[10px] font-bold text-[#5c5e66] uppercase tracking-wider flex items-center gap-2">
              <div className="w-4 h-0.5 bg-gradient-to-r from-indigo-500 to-transparent rounded-full"></div>
              Kullanıcı Ayarları
            </h2>
          </div>
          <SidebarItem
            label="Hesabım"
            icon={<User size={18} />}
            active={activeTab === "account"}
            onClick={() => setActiveTab("account")}
            color="indigo"
          />
          
          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mx-2 my-3 relative z-10"></div>
          
          {/* Uygulama Ayarları */}
          <div className="px-3 pt-2 pb-2 relative z-10">
            <h2 className="text-[10px] font-bold text-[#5c5e66] uppercase tracking-wider flex items-center gap-2">
              <div className="w-4 h-0.5 bg-gradient-to-r from-purple-500 to-transparent rounded-full"></div>
              Uygulama Ayarları
            </h2>
          </div>
          <SidebarItem
            label="Genel"
            icon={<AppWindow size={18} />}
            active={activeTab === "application"}
            onClick={() => setActiveTab("application")}
            color="purple"
          />
          <SidebarItem
            label="Performans"
            icon={<Cpu size={18} />}
            active={activeTab === "performance"}
            onClick={() => setActiveTab("performance")}
            color="green"
          />
          <SidebarItem
            label="Ses ve Görüntü"
            icon={<Mic size={18} />}
            active={activeTab === "voice"}
            onClick={() => setActiveTab("voice")}
            color="cyan"
          />
          <SidebarItem
            label="Tuş Atamaları"
            icon={<Keyboard size={18} />}
            active={activeTab === "keybinds"}
            onClick={() => setActiveTab("keybinds")}
            color="orange"
          />
          <SidebarItem
            label="Bildirimler"
            icon={<Bell size={18} />}
            active={activeTab === "notifications"}
            onClick={() => setActiveTab("notifications")}
            color="yellow"
          />
          
          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mx-2 my-3 relative z-10"></div>
          
          <SidebarItem
            label="Uygulama Hakkında"
            icon={<Info size={18} />}
            active={activeTab === "about"}
            onClick={() => setActiveTab("about")}
            color="pink"
          />
          
          {/* Footer */}
          <div className="mt-auto px-2 pt-3 relative z-10">
            <div className="glass-strong rounded-xl p-3 border border-white/10 flex items-center gap-2.5">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
              <div className="flex-1">
                <div className="text-[11px] text-white font-medium">Netrex</div>
                <div className="text-[10px] text-[#949ba4]">v{process.env.NEXT_PUBLIC_APP_VERSION || "3.0.0"}</div>
              </div>
          </div>
          </div>
        </div>
        <div className="flex-1 bg-gradient-to-br from-nds-bg-tertiary to-nds-bg-primary relative flex flex-col min-w-0">
          {/* Header */}
          <div className="relative z-10 p-6 pb-4 border-b border-nds-border-light bg-gradient-to-r from-nds-bg-secondary/50 to-transparent">
          </div>

          <div ref={contentRef} className="flex-1 overflow-y-auto scrollbar-thin p-8 pr-12 pb-24 relative">
            {/* Animated background particles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl animate-pulse-slow"></div>
              <div
                className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl animate-pulse-slow"
                style={{ animationDelay: "1s" }}
              ></div>
            </div>

            <div className="relative z-10" key={activeTab}>
              {/* Page transition wrapper with staggered animations */}
              <div className="animate-page-enter">
                {activeTab === "account" && <AccountSettings onClose={onClose} />}
                {activeTab === "application" && <ApplicationSettings />}
                {activeTab === "performance" && <PerformanceSettings />}
                {activeTab === "voice" && <VoiceSettings />}
                {activeTab === "keybinds" && <KeybindSettings />}
                {activeTab === "notifications" && <NotificationSettings />}
                {activeTab === "about" && <AboutSettings />}
              </div>
            </div>
          </div>

          {/* Footer with save button */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-nds-bg-tertiary via-nds-bg-secondary to-transparent border-t border-nds-border-light p-6 flex justify-end backdrop-blur-xl relative">
            {/* Top glow */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>

            <button
              onClick={() => {
                toast.success("Ayarlar kaydedildi!");
                setTimeout(() => {
                  onClose();
                }, 500);
              }}
              onMouseDown={(e) => e.preventDefault()}
              className="px-8 py-3 gradient-primary hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] text-white rounded-xl font-semibold transition-all duration-300 hover:scale-110 relative overflow-hidden group/save focus:outline-none"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 opacity-0 group-hover/save:opacity-100 transition-opacity duration-300"></div>
              <span className="relative z-10">Ayarları Kaydet</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarItem({ label, icon, active, onClick, color = "indigo" }) {
  const colorClasses = {
    indigo: {
      activeBg: "from-indigo-500/20 to-indigo-600/10",
      activeBorder: "border-indigo-500/40",
      activeIcon: "text-indigo-400",
      activeDot: "bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.6)]",
      hoverBg: "group-hover/item:from-indigo-500/10 group-hover/item:to-indigo-600/5",
    },
    purple: {
      activeBg: "from-purple-500/20 to-purple-600/10",
      activeBorder: "border-purple-500/40",
      activeIcon: "text-purple-400",
      activeDot: "bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.6)]",
      hoverBg: "group-hover/item:from-purple-500/10 group-hover/item:to-purple-600/5",
    },
    cyan: {
      activeBg: "from-cyan-500/20 to-cyan-600/10",
      activeBorder: "border-cyan-500/40",
      activeIcon: "text-cyan-400",
      activeDot: "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]",
      hoverBg: "group-hover/item:from-cyan-500/10 group-hover/item:to-cyan-600/5",
    },
    orange: {
      activeBg: "from-orange-500/20 to-orange-600/10",
      activeBorder: "border-orange-500/40",
      activeIcon: "text-orange-400",
      activeDot: "bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.6)]",
      hoverBg: "group-hover/item:from-orange-500/10 group-hover/item:to-orange-600/5",
    },
    yellow: {
      activeBg: "from-yellow-500/20 to-yellow-600/10",
      activeBorder: "border-yellow-500/40",
      activeIcon: "text-yellow-400",
      activeDot: "bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.6)]",
      hoverBg: "group-hover/item:from-yellow-500/10 group-hover/item:to-yellow-600/5",
    },
    pink: {
      activeBg: "from-pink-500/20 to-pink-600/10",
      activeBorder: "border-pink-500/40",
      activeIcon: "text-pink-400",
      activeDot: "bg-pink-400 shadow-[0_0_8px_rgba(236,72,153,0.6)]",
      hoverBg: "group-hover/item:from-pink-500/10 group-hover/item:to-pink-600/5",
    },
    green: {
      activeBg: "from-green-500/20 to-green-600/10",
      activeBorder: "border-green-500/40",
      activeIcon: "text-green-400",
      activeDot: "bg-green-400 shadow-[0_0_8px_rgba(34,197,94,0.6)]",
      hoverBg: "group-hover/item:from-green-500/10 group-hover/item:to-green-600/5",
    },
  };

  const colors = colorClasses[color] || colorClasses.indigo;

  return (
    <button
      onClick={onClick}
      onMouseDown={(e) => e.preventDefault()}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 w-full text-left mb-0.5 relative group/item overflow-hidden focus:outline-none ${
        active
          ? `bg-gradient-to-r ${colors.activeBg} text-white border ${colors.activeBorder}`
          : "text-[#949ba4] hover:text-white border border-transparent hover:bg-white/5"
      }`}
    >
      {/* Hover glow background */}
      <div
        className={`absolute inset-0 bg-gradient-to-r from-transparent to-transparent transition-all duration-300 ${
          active ? "" : colors.hoverBg
        }`}
      ></div>

      {/* Icon container */}
      <div
        className={`relative z-10 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 ${
          active
            ? `bg-white/10 ${colors.activeIcon}`
            : "bg-white/5 text-[#949ba4] group-hover/item:bg-white/10 group-hover/item:text-white"
        }`}
      >
        {icon}
      </div>
      
      <span className="relative z-10 flex-1">{label}</span>

      {/* Active indicator */}
      {active && (
        <div className={`relative z-10 w-2 h-2 rounded-full animate-pulse ${colors.activeDot}`}></div>
      )}
      
      {/* Hover arrow indicator */}
      {!active && (
        <ChevronRight 
          size={14} 
          className="relative z-10 text-[#949ba4] opacity-0 group-hover/item:opacity-100 group-hover/item:translate-x-0 -translate-x-1 transition-all duration-300" 
        />
      )}
    </button>
  );
}

// ... (ToggleSwitch, ApplicationSettings, AccountSettings, KeybindSettings AYNI KALSIN) ...
function ToggleSwitch({ label, description, checked, onChange }) {
  return (
    <div className="flex items-center justify-between py-2 group/toggle">
      <div className="pr-4 flex-1">
        <div className="font-medium text-nds-text-primary mb-0.5 group-hover/toggle:text-nds-text-secondary transition-colors">
          {label}
        </div>
        <div className="text-caption text-nds-text-tertiary group-hover/toggle:text-nds-text-secondary transition-colors">
          {description}
        </div>
      </div>
      <button
        onClick={onChange}
        className={`w-14 h-7 rounded-full relative transition-all duration-slow ease-in-out border-2 shrink-0 focus:outline-none ${
          checked
            ? "bg-gradient-to-r from-nds-success to-nds-success/90 border-nds-success/50 shadow-nds-glow-success"
            : "bg-nds-bg-secondary border-nds-border-light hover:border-nds-border-medium"
        }`}
      >
        <div
          className={`absolute top-0 left-[3px] w-6 h-6 bg-white rounded-full shadow-lg transform transition-all duration-500 ease-in-out flex items-center justify-center ${
            checked ? "translate-x-[26px]" : "translate-x-0"
          }`}
        >
          {checked && (
            <div className="w-2 h-2 bg-nds-success rounded-full animate-pulse"></div>
          )}
        </div>
        {/* Glow effect */}
        {checked && (
          <div className="absolute inset-0 bg-nds-success/20 rounded-full blur-sm animate-pulse"></div>
        )}
      </button>
    </div>
  );
}

function AboutSettings() {
  // Versiyon bilgilerini package.json'dan al
  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0";
  const appName = "Netrex";
  const appDescription = "Güvenli Masaüstü Sesli Sohbet Uygulaması";
  const githubUrl = "https://github.com/MuratGuelr/netrex-standalone";
  const youtubeUrl = "https://www.youtube.com/@ConsolAktif";

  // Teknoloji versiyonları
  const techVersions = {
    nextjs: "14.2.16",
    electron: "Latest",
    react: "19.2.0",
    livekit: "Latest",
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 pb-10">
      <h3 className="text-2xl font-bold text-white mb-6 relative">
        <span className="relative z-10">Uygulama Hakkında</span>
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 opacity-0 hover:opacity-100 transition-opacity duration-300 blur-sm"></div>
      </h3>

      {/* Logo ve Uygulama Bilgileri */}
      <div className="glass-strong rounded-2xl overflow-hidden border border-white/20 shadow-soft-lg hover:shadow-xl transition-all duration-300 mb-6 relative group/card">
        {/* Hover glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 z-10 pointer-events-none"></div>

        <div className="h-32 w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 relative overflow-hidden">
          {/* Animated background pattern */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.1)_0%,transparent_50%)]"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(255,255,255,0.1)_0%,transparent_50%)]"></div>
          </div>
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/30"></div>
          {/* Shine effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/card:translate-x-full transition-transform duration-1000"></div>
        </div>
        <div className="px-6 pb-6 relative">
          <div className="flex justify-between items-end -mt-10 mb-5">
            <div className="flex items-end gap-4">
              {/* Logo Container */}
              <div className="p-2 bg-gradient-to-br from-[#1e1f22] to-[#2b2d31] rounded-2xl shadow-xl border border-white/10">
                <div className="w-24 h-24 rounded-xl overflow-hidden shadow-2xl relative group/logo">
                  <img
                    src="/logo.png"
                    alt="Netrex Logo"
                    className="w-full h-full object-contain bg-gradient-to-br from-nds-bg-secondary to-nds-bg-tertiary p-2 transition-transform duration-300 group-hover/logo:scale-110"
                  />
                  {/* Logo glow */}
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 opacity-0 group-hover/logo:opacity-100 transition-opacity duration-300"></div>
                </div>
              </div>
              <div className="mb-2">
                <h2 className="text-2xl font-bold text-white leading-none mb-2 flex items-center gap-2">
                  {appName}
                  <span className="px-2 py-0.5 text-xs font-bold bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full text-white shadow-lg">
                    v{appVersion}
                  </span>
                </h2>
                <span className="text-sm text-[#949ba4] font-medium flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
                  Aktif Sürüm
                </span>
              </div>
            </div>
          </div>
          <div className="glass-strong rounded-xl p-4 border border-white/10 relative z-10 bg-gradient-to-r from-nds-bg-secondary/50 to-transparent">
            <p className="text-white text-sm leading-relaxed font-medium">
              {appDescription}
            </p>
            <p className="text-[#949ba4] text-xs mt-2">
              Gizliliğinize önem veren, açık kaynak kodlu masaüstü sesli iletişim platformu.
            </p>
          </div>
        </div>
      </div>

      {/* Versiyon Bilgileri */}
      <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 mb-4 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
        {/* Hover glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>

        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-4 flex items-center gap-2 relative z-10">
          <div className="w-1 h-1 bg-indigo-400 rounded-full"></div>
          Versiyon Bilgileri
        </h4>
        <div className="grid grid-cols-2 gap-3 relative z-10">
          <div className="bg-[#1e1f22] rounded-xl p-3 border border-white/5 hover:border-indigo-500/30 transition-colors duration-300 group/tech">
            <span className="text-[10px] font-bold text-[#949ba4] uppercase block mb-1">Uygulama</span>
            <span className="text-white text-sm font-bold group-hover/tech:text-indigo-400 transition-colors">{appVersion}</span>
          </div>
          <div className="bg-[#1e1f22] rounded-xl p-3 border border-white/5 hover:border-purple-500/30 transition-colors duration-300 group/tech">
            <span className="text-[10px] font-bold text-[#949ba4] uppercase block mb-1">Next.js</span>
            <span className="text-white text-sm font-bold group-hover/tech:text-purple-400 transition-colors">{techVersions.nextjs}</span>
          </div>
          <div className="bg-[#1e1f22] rounded-xl p-3 border border-white/5 hover:border-cyan-500/30 transition-colors duration-300 group/tech">
            <span className="text-[10px] font-bold text-[#949ba4] uppercase block mb-1">Electron</span>
            <span className="text-white text-sm font-bold group-hover/tech:text-cyan-400 transition-colors">{techVersions.electron}</span>
          </div>
          <div className="bg-[#1e1f22] rounded-xl p-3 border border-white/5 hover:border-blue-500/30 transition-colors duration-300 group/tech">
            <span className="text-[10px] font-bold text-[#949ba4] uppercase block mb-1">React</span>
            <span className="text-white text-sm font-bold group-hover/tech:text-blue-400 transition-colors">{techVersions.react}</span>
          </div>
        </div>
      </div>

      {/* Geliştirici Bilgileri */}
      <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 mb-4 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
        {/* Hover glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>

        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-4 flex items-center gap-2 relative z-10">
          <div className="w-1 h-1 bg-green-400 rounded-full"></div>
          Geliştirici
        </h4>
        <div className="space-y-3 relative z-10">
          <div className="flex items-center justify-between py-1.5">
            <span className="text-[#b5bac1] text-sm">Geliştirici</span>
            <span className="text-white text-sm font-semibold">ConsolAktif</span>
          </div>
          <div className="h-px bg-white/10"></div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-[#b5bac1] text-sm">Lisans</span>
            <span className="text-white text-sm font-semibold">MIT</span>
          </div>
          <div className="h-px bg-white/10"></div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-[#b5bac1] text-sm">Teknolojiler</span>
            <span className="text-white text-sm font-semibold">Next.js, Electron, LiveKit</span>
          </div>
        </div>
      </div>

      {/* Linkler */}
      <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
        {/* Hover glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>

        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-4 flex items-center gap-2 relative z-10">
          <div className="w-1 h-1 bg-purple-400 rounded-full"></div>
          Linkler
        </h4>
        <div className="space-y-2 relative z-10">
          <button
            onClick={() => {
              if (window.netrex?.openExternalLink) {
                window.netrex.openExternalLink(githubUrl);
              } else {
                window.open(githubUrl, "_blank", "noopener,noreferrer");
              }
            }}
            onMouseDown={(e) => e.preventDefault()}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#1e1f22] border border-white/10 hover:bg-gradient-to-r hover:from-indigo-500/10 hover:to-purple-500/10 hover:border-indigo-500/30 text-[#b5bac1] hover:text-white transition-all duration-300 group/link w-full text-left relative overflow-hidden focus:outline-none"
          >
            <div className="absolute inset-0 bg-white/5 opacity-0 group-hover/link:opacity-100 transition-opacity duration-300"></div>
            <Github
              size={18}
              className="relative z-10 group-hover/link:scale-110 transition-transform duration-300"
            />
            <span className="text-sm font-medium relative z-10">
              GitHub Repository
            </span>
            <ExternalLink
              size={14}
              className="ml-auto opacity-0 group-hover/link:opacity-100 transition-opacity relative z-10"
            />
          </button>
          <button
            onClick={() => {
              if (window.netrex?.openExternalLink) {
                window.netrex.openExternalLink(youtubeUrl);
              } else {
                window.open(youtubeUrl, "_blank", "noopener,noreferrer");
              }
            }}
            onMouseDown={(e) => e.preventDefault()}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#1e1f22] border border-white/10 hover:bg-gradient-to-r hover:from-red-500/10 hover:to-red-600/10 hover:border-red-500/30 text-[#b5bac1] hover:text-white transition-all duration-300 group/link w-full text-left relative overflow-hidden focus:outline-none"
          >
            <div className="absolute inset-0 bg-white/5 opacity-0 group-hover/link:opacity-100 transition-opacity duration-300"></div>
            <Youtube
              size={18}
              className="relative z-10 group-hover/link:scale-110 transition-transform duration-300 text-red-500"
            />
            <span className="text-sm font-medium relative z-10">
              YouTube Kanalı
            </span>
            <ExternalLink
              size={14}
              className="ml-auto opacity-0 group-hover/link:opacity-100 transition-opacity relative z-10"
            />
          </button>
        </div>
      </div>
    </div>
  );
}

function ApplicationSettings() {
  const {
    closeToTray,
    setCloseToTray,
    checkUpdatesOnStartup,
    setCheckUpdatesOnStartup,
  } = useSettingsStore();
  
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 pb-10">
      <h3 className="text-2xl font-bold text-white mb-6 relative">
        <span className="relative z-10">Uygulama Ayarları</span>
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 opacity-0 hover:opacity-100 transition-opacity duration-300 blur-sm"></div>
      </h3>

      {/* Header Banner */}
      <div className="glass-strong rounded-2xl overflow-hidden border border-white/20 shadow-soft-lg hover:shadow-xl transition-all duration-300 mb-6 relative group/card">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 z-10 pointer-events-none"></div>
        
        <div className="h-20 w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 relative overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.1)_0%,transparent_50%)]"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(255,255,255,0.1)_0%,transparent_50%)]"></div>
          </div>
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/30"></div>
          <div className="absolute inset-0 flex items-center px-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-lg">
                <AppWindow size={24} className="text-white" />
              </div>
              <div>
                <h4 className="text-white font-bold text-lg">Genel Tercihler</h4>
                <p className="text-white/70 text-sm">Uygulama davranışını özelleştirin</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pencere Davranışı */}
      <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 mb-4 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>

        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-4 flex items-center gap-2 relative z-10">
          <div className="w-6 h-6 rounded-lg bg-indigo-500/20 flex items-center justify-center">
            <Monitor size={14} className="text-indigo-400" />
          </div>
          Pencere Davranışı
        </h4>
        <div className="relative z-10 bg-[#1e1f22] rounded-xl p-4 border border-white/5 hover:border-indigo-500/20 transition-colors duration-300">
          <ToggleSwitch
            label="Sistem Tepsisine Küçült"
            description="Kapat (X) butonuna bastığında uygulama kapanmak yerine sağ alt köşedeki (saat yanı) simge durumuna küçülür."
            checked={closeToTray}
            onChange={() => setCloseToTray(!closeToTray)}
          />
        </div>
      </div>

      {/* Güncellemeler */}
      <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>

        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-4 flex items-center gap-2 relative z-10">
          <div className="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <Zap size={14} className="text-purple-400" />
          </div>
          Güncellemeler
        </h4>
        <div className="relative z-10 bg-[#1e1f22] rounded-xl p-4 border border-white/5 hover:border-purple-500/20 transition-colors duration-300">
          <ToggleSwitch
            label="Açılışta Güncelleme Kontrolü"
            description="Uygulama açıldığında otomatik olarak güncellemeleri kontrol eder."
            checked={checkUpdatesOnStartup}
            onChange={() => setCheckUpdatesOnStartup(!checkUpdatesOnStartup)}
          />
        </div>
        
        {/* Güncelleme durumu */}
        <div className="mt-4 pt-4 border-t border-white/10 relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
              <span className="text-sm text-[#949ba4]">Güncel sürümü kullanıyorsunuz</span>
            </div>
            <span className="text-xs text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded-lg font-medium">
              v{process.env.NEXT_PUBLIC_APP_VERSION || "3.0.0"}
            </span>
          </div>
        </div>
      </div>

      {/* Test Simulation Button (Development Only) */}
      {process.env.NODE_ENV === "development" && (
        <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card mt-4">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-blue-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>

          <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-4 flex items-center gap-2 relative z-10">
            <div className="w-6 h-6 rounded-lg bg-cyan-500/20 flex items-center justify-center">
              <Zap size={14} className="text-cyan-400" />
            </div>
            Geliştirici Araçları
          </h4>
          
          <button
            onClick={() => {
              // 1. Available
              window.dispatchEvent(
                new CustomEvent("NETREX_TEST_UPDATE", {
                  detail: { status: "available", progress: 0 },
                })
              );

              // 2. Download Simulation
              let p = 0;
              const interval = setInterval(() => {
                p += 5;
                if (p > 100) {
                  clearInterval(interval);
                  // 3. Downloaded
                  window.dispatchEvent(
                    new CustomEvent("NETREX_TEST_UPDATE", {
                      detail: { status: "downloaded", progress: 100 },
                    })
                  );
                } else {
                  window.dispatchEvent(
                    new CustomEvent("NETREX_TEST_UPDATE", {
                      detail: { status: "downloading", progress: p },
                    })
                  );
                }
              }, 200);
            }}
            className="w-full bg-[#1e1f22] hover:bg-[#2b2d31] border border-white/10 hover:border-cyan-500/30 rounded-xl p-3 flex items-center justify-center gap-2 text-cyan-400 text-sm font-semibold transition-all duration-300 relative z-10 group/btn"
          >
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>
            <span>Güncelleme Bildirimini Test Et (Simülasyon)</span>
            <div className="ml-auto opacity-0 group-hover/btn:opacity-100 transition-opacity">
              <ChevronRight size={14} />
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

function AccountSettings({ onClose }) {
  const { user, logout } = useAuthStore();
  const { profileColor, setProfileColor } = useSettingsStore();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Admin kontrolü (sadece UID)
  const ADMIN_UID = process.env.NEXT_PUBLIC_ADMIN_UID?.trim() || "";
  const isAdmin = user && ADMIN_UID && user.uid === ADMIN_UID;

  // DevTools açma
  const handleOpenDevTools = async () => {
    if (window.netrex && isAdmin) {
      try {
        const result = await window.netrex.openDevTools(user?.uid);
        if (!result.success) {
          console.error("DevTools açılamadı:", result.error);
        }
      } catch (error) {
        console.error("DevTools açma hatası:", error);
      }
    }
  };

  // profileColor'dan mevcut değerleri parse et
  const parseProfileColor = useCallback((color) => {
    if (!color)
      return {
        mode: "solid",
        solidColor: "#6366f1",
        start: "#6366f1",
        end: "#a855f7",
        angle: 135,
      };

    if (color.includes("gradient")) {
      // linear-gradient(135deg, #6366f1 0%, #a855f7 100%) formatını parse et
      const angleMatch = color.match(/(\d+)deg/);
      const colorMatches = color.match(/#[0-9a-fA-F]{6}/g);
      const angle = angleMatch ? parseInt(angleMatch[1]) : 135;
      const start =
        colorMatches && colorMatches[0] ? colorMatches[0] : "#6366f1";
      const end = colorMatches && colorMatches[1] ? colorMatches[1] : "#a855f7";
      return { mode: "gradient", solidColor: start, start, end, angle };
    } else {
      return {
        mode: "solid",
        solidColor: color,
        start: "#6366f1",
        end: "#a855f7",
        angle: 135,
      };
    }
  }, []);

  const parsed = useMemo(
    () => parseProfileColor(profileColor),
    [profileColor, parseProfileColor]
  );
  const [colorMode, setColorMode] = useState(parsed.mode);
  const [gradStart, setGradStart] = useState(parsed.start);
  const [gradEnd, setGradEnd] = useState(parsed.end);
  const [gradAngle, setGradAngle] = useState(parsed.angle);
  const isUpdatingFromStore = useRef(false);

  // profileColor değiştiğinde state'leri güncelle (dışarıdan değişiklik olursa)
  useEffect(() => {
    if (isUpdatingFromStore.current) {
      isUpdatingFromStore.current = false;
      return;
    }
    const newParsed = parseProfileColor(profileColor);
    if (newParsed.mode !== colorMode) {
      setColorMode(newParsed.mode);
    }
    if (newParsed.start !== gradStart) {
      setGradStart(newParsed.start);
    }
    if (newParsed.end !== gradEnd) {
      setGradEnd(newParsed.end);
    }
    if (newParsed.angle !== gradAngle) {
      setGradAngle(newParsed.angle);
    }
  }, [profileColor, parseProfileColor]);

  useEffect(() => {
    if (colorMode === "gradient") {
      isUpdatingFromStore.current = true;
      setProfileColor(
        `linear-gradient(${gradAngle}deg, ${gradStart} 0%, ${gradEnd} 100%)`
      );
    }
  }, [gradStart, gradEnd, gradAngle, colorMode, setProfileColor]);
  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    onClose();
    await logout();
  };
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 pb-10">
      <h3 className="text-2xl font-bold text-white mb-6 relative">
        <span className="relative z-10">Hesabım</span>
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 opacity-0 hover:opacity-100 transition-opacity duration-300 blur-sm"></div>
      </h3>
      <div className="glass-strong rounded-2xl overflow-hidden border border-white/20 shadow-soft-lg mb-8 relative group/card hover:shadow-xl transition-all duration-300">
        {/* Hover glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 z-10 pointer-events-none"></div>

        <div
          className="h-28 w-full transition-all duration-300 relative"
          style={{ background: profileColor }}
        >
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/20"></div>
        </div>
        <div className="px-5 pb-5 relative">
          <div className="flex justify-between items-end -mt-10 mb-4">
            <div className="flex items-end gap-3">
              <div className="p-1.5 bg-[#1e1f22] rounded-full">
                <div
                  className="w-24 h-24 rounded-full flex items-center justify-center text-white text-4xl font-bold shadow-sm relative overflow-hidden"
                  style={{ background: profileColor }}
                >
                  {user?.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    user?.displayName?.charAt(0).toUpperCase() || "?"
                  )}
                </div>
              </div>
              <div className="mb-1">
                <h2 className="text-xl font-bold text-white leading-none">
                  {user?.displayName || "Misafir Kullanıcı"}
                </h2>
                <span className="text-sm text-[#949ba4] font-medium">
                  #{user?.uid?.substring(0, 4)}
                </span>
              </div>
            </div>
          </div>
          <div className="glass-strong rounded-xl p-5 space-y-4 border border-white/10 relative z-10">
            <div className="flex justify-between items-center group">
              <div>
                <label className="text-[11px] font-bold text-[#949ba4] uppercase mb-1.5 flex items-center gap-1.5">
                  <User size={12} className="text-indigo-400" /> Görünen Ad
                </label>
                <div className="text-white text-sm font-medium">
                  {user?.displayName || "Belirtilmemiş"}
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
                  {user?.email || (
                    <span className="text-[#949ba4] italic">Anonim Hesap</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Admin DevTools Button */}
      {isAdmin && window.netrex && (
        <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 mb-6 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>
          
          <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-4 flex items-center gap-2 relative z-10">
            <div className="w-6 h-6 rounded-lg bg-red-500/20 flex items-center justify-center">
              <ShieldAlert size={14} className="text-red-400" />
            </div>
            Admin Araçları
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-bold bg-red-500/10 text-red-400 border border-red-500/30">
              ADMIN
            </span>
          </h4>
          <div className="relative z-10">
            <button
              onClick={handleOpenDevTools}
              onMouseDown={(e) => e.preventDefault()}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2 shadow-lg hover:shadow-[0_0_20px_rgba(99,102,241,0.4)] focus:outline-none"
            >
              <Monitor size={16} />
              Developer Tools'u Aç
            </button>
            <p className="text-xs text-[#949ba4] mt-3 text-center">
              Build edilmiş uygulamada console'u açmak için
            </p>
          </div>
        </div>
      )}

      {/* Profil Teması */}
      <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 mb-6 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>
        
        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-4 flex items-center gap-2 relative z-10">
          <div className="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <Palette size={14} className="text-purple-400" />
          </div>
          Profil Teması
        </h4>
        
        <div className="relative z-10">
          <div className="flex gap-2 mb-4 bg-[#1e1f22] p-1.5 rounded-xl w-fit border border-white/5">
            <button
              onClick={() => {
                setColorMode("solid");
                if (profileColor.includes("gradient")) {
                  const parsed = parseProfileColor(profileColor);
                  setProfileColor(parsed.solidColor);
                }
              }}
              onMouseDown={(e) => e.preventDefault()}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 flex items-center gap-2 focus:outline-none ${
                colorMode === "solid"
                  ? "bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-white shadow border border-indigo-500/30"
                  : "text-[#949ba4] hover:text-white hover:bg-white/5"
              }`}
            >
              <Pipette size={14} /> Düz Renk
            </button>
            <button
              onClick={() => {
                setColorMode("gradient");
                if (!profileColor.includes("gradient")) {
                  const parsed = parseProfileColor(profileColor);
                  setGradStart(parsed.solidColor);
                  setProfileColor(
                    `linear-gradient(${gradAngle}deg, ${parsed.solidColor} 0%, ${gradEnd} 100%)`
                  );
                }
              }}
              onMouseDown={(e) => e.preventDefault()}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 flex items-center gap-2 focus:outline-none ${
                colorMode === "gradient"
                  ? "bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-white shadow border border-indigo-500/30"
                  : "text-[#949ba4] hover:text-white hover:bg-white/5"
              }`}
            >
              <Zap size={14} /> Gradient
            </button>
          </div>
          
          {colorMode === "solid" && (
            <div className="animate-in fade-in zoom-in-95 duration-200 bg-[#1e1f22] rounded-xl p-4 border border-white/5">
              <div className="flex flex-wrap gap-3">
                <label className="w-10 h-10 rounded-full bg-[#2b2d31] border-2 border-dashed border-[#4e5058] flex items-center justify-center cursor-pointer hover:border-indigo-500 transition group relative overflow-hidden">
                  <input
                    type="color"
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    onChange={(e) => setProfileColor(e.target.value)}
                  />
                  <Pipette
                    size={16}
                    className="text-[#949ba4] group-hover:text-indigo-400 transition-colors"
                  />
                </label>
                {SOLID_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setProfileColor(color)}
                    onMouseDown={(e) => e.preventDefault()}
                    className={`w-10 h-10 rounded-full transition-all duration-200 relative focus:outline-none ${
                      profileColor === color
                        ? "ring-2 ring-white ring-offset-2 ring-offset-[#1e1f22] scale-110"
                        : "hover:scale-110"
                    }`}
                    style={{ backgroundColor: color }}
                  >
                    {profileColor === color && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Check
                          size={16}
                          className="text-white drop-shadow-md"
                          strokeWidth={3}
                        />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {colorMode === "gradient" && (
            <div className="animate-in fade-in zoom-in-95 duration-200 bg-[#1e1f22] p-4 rounded-xl border border-white/5">
              <div className="flex items-center gap-4 mb-6">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-[#949ba4] uppercase">
                    Başlangıç
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={gradStart}
                      onChange={(e) => setGradStart(e.target.value)}
                      className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                    />
                    <span className="text-xs text-mono text-[#dbdee1]">
                      {gradStart}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-[#949ba4] uppercase">
                    Bitiş
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={gradEnd}
                      onChange={(e) => setGradEnd(e.target.value)}
                      className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                    />
                    <span className="text-xs text-mono text-[#dbdee1]">
                      {gradEnd}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1 flex-1 ml-4">
                  <span className="text-[10px] font-bold text-[#949ba4] uppercase">
                    Açı ({gradAngle}°)
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={gradAngle}
                    onChange={(e) => setGradAngle(e.target.value)}
                    className="w-full h-2 bg-[#404249] rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-[#949ba4] uppercase">
                  Hızlı Seçim
                </span>
                <div className="flex flex-wrap gap-3">
                  {PRESET_GRADIENTS.map((grad, i) => (
                    <button
                      key={i}
                      onClick={() => setProfileColor(grad)}
                      onMouseDown={(e) => e.preventDefault()}
                      className={`w-12 h-12 rounded-lg transition-all duration-200 relative shadow-sm focus:outline-none ${
                        profileColor === grad
                          ? "ring-2 ring-white ring-offset-2 ring-offset-[#1e1f22]"
                          : "hover:scale-105"
                      }`}
                      style={{ background: grad }}
                    >
                      {profileColor === grad && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Check
                            size={20}
                            className="text-white drop-shadow-md"
                            strokeWidth={3}
                          />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hesap İşlemleri */}
      <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
        <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 via-transparent to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>
        
        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-4 flex items-center gap-2 relative z-10">
          <div className="w-6 h-6 rounded-lg bg-red-500/20 flex items-center justify-center">
            <LogOut size={14} className="text-red-400" />
          </div>
          Hesap İşlemleri
        </h4>
        
        <button
          onClick={handleLogout}
          onMouseDown={(e) => e.preventDefault()}
          className="relative z-10 flex items-center justify-between p-4 rounded-xl bg-[#1e1f22] border-2 border-red-500/30 hover:border-red-500 hover:bg-gradient-to-r hover:from-red-500/10 hover:to-red-600/10 group transition-all duration-300 cursor-pointer text-left w-full overflow-hidden focus:outline-none"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center group-hover:bg-red-500/30 transition-colors">
              <LogOut size={18} className="text-red-400 group-hover:scale-110 transition-transform duration-300" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-white group-hover:text-red-300 transition-colors">
                Çıkış Yap
              </span>
              <span className="text-xs text-[#949ba4] group-hover:text-[#b5bac1] transition-colors">
                Oturumunu kapat ve giriş ekranına dön.
              </span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center relative z-10 group-hover:bg-red-500/20 transition-colors">
            <ChevronRight size={18} className="text-red-400" />
          </div>
        </button>
      </div>
      {/* Logout Confirmation Modal */}
      {showLogoutModal && createPortal(
        <div className="fixed inset-0 z-[10050] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-nds-fade-in" onClick={() => setShowLogoutModal(false)}></div>
          <div className="glass-strong bg-[#1e1f22] border border-red-500/20 rounded-2xl w-full max-w-md p-0 relative z-10 animate-nds-scale-in shadow-2xl overflow-hidden">
            <div className="p-6">
                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                    <LogOut size={24} className="text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Çıkış Yap</h3>
                <p className="text-[#949ba4] leading-relaxed">
                  Hesabından çıkış yapmak istediğine emin misin? Tekrar giriş yapana kadar bildirim almayacaksın.
                </p>
            </div>
            <div className="p-4 bg-white/5 flex justify-end gap-3 border-t border-white/5">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="px-4 py-2.5 rounded-xl text-[#dbdee1] hover:bg-white/5 transition-colors font-medium text-sm"
              >
                Vazgeç
              </button>
              <button
                onClick={confirmLogout}
                className="px-6 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 active:scale-95 text-white transition-all font-medium text-sm shadow-lg shadow-red-500/20 flex items-center gap-2"
              >
                Çıkış Yap
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function KeybindSettings() {
  const [recording, setRecording] = useState(null);
  const [muteKeybinding, setMuteKeybinding] = useState(null);
  const [deafenKeybinding, setDeafenKeybinding] = useState(null);
  const [cameraKeybinding, setCameraKeybinding] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (window.netrex) {
      window.netrex.getHotkey("mute").then((k) => setMuteKeybinding(k || null));
      window.netrex
        .getHotkey("deafen")
        .then((k) => setDeafenKeybinding(k || null));
      window.netrex
        .getHotkey("camera")
        .then((k) => setCameraKeybinding(k || null));
    }
  }, []);
  useEffect(() => {
    if (!recording || !window.netrex) return;
    window.netrex.setRecordingMode(true);
    const handleRawKeydown = async (event) => {
      setError(null);
      let keybinding;
      if (event.type === "mouse")
        keybinding = { type: "mouse", mouseButton: event.mouseButton };
      else {
        const isModifier = isModifierKey(event.keycode);
        keybinding = {
          type: "keyboard",
          keycode: event.keycode,
          ctrlKey: isModifier ? false : event.ctrlKey || false,
          shiftKey: isModifier ? false : event.shiftKey || false,
          altKey: isModifier ? false : event.altKey || false,
          metaKey: isModifier ? false : event.metaKey || false,
        };
      }
      try {
        const result = await window.netrex.updateHotkey(recording, keybinding);
        if (result.success) {
          if (recording === "mute") setMuteKeybinding(keybinding);
          if (recording === "deafen") setDeafenKeybinding(keybinding);
          if (recording === "camera") setCameraKeybinding(keybinding);
          setRecording(null);
        } else {
          setError(result.error || "Bu tuş atanamadı.");
          setRecording(null);
        }
      } catch (err) {
        console.error(err);
        setRecording(null);
      }
    };
    window.netrex.onRawKeydown(handleRawKeydown);
    return () => {
      window.netrex.setRecordingMode(false);
      window.netrex.removeListener("raw-keydown");
    };
  }, [recording]);
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 pb-10">
      <h3 className="text-2xl font-bold text-white mb-6 relative">
        <span className="relative z-10">Tuş Atamaları</span>
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 opacity-0 hover:opacity-100 transition-opacity duration-300 blur-sm"></div>
      </h3>

      {/* Header Banner */}
      <div className="glass-strong rounded-2xl overflow-hidden border border-white/20 shadow-soft-lg hover:shadow-xl transition-all duration-300 mb-6 relative group/card">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 z-10 pointer-events-none"></div>
        
        <div className="h-20 w-full bg-gradient-to-r from-orange-600 via-red-600 to-orange-600 relative overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.1)_0%,transparent_50%)]"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(255,255,255,0.1)_0%,transparent_50%)]"></div>
          </div>
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/30"></div>
          <div className="absolute inset-0 flex items-center px-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-lg">
                <Keyboard size={24} className="text-white" />
              </div>
              <div>
                <h4 className="text-white font-bold text-lg">Kısayol Tuşları</h4>
                <p className="text-white/70 text-sm">Hızlı erişim için tuş kombinasyonları</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-gradient-to-r from-red-500/15 to-red-600/15 text-red-300 p-4 rounded-xl mb-4 flex items-center gap-3 text-sm border border-red-500/30 shadow-soft backdrop-blur-sm animate-fadeIn relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-transparent"></div>
          <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center relative z-10">
            <Info size={16} className="text-red-400" />
          </div>
          <span className="relative z-10 font-medium">{error}</span>
        </div>
      )}

      <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
        
        <div className="flex bg-gradient-to-r from-[#1a1b1e] via-[#25272a] to-[#1a1b1e] p-4 border-b border-white/10">
          <div className="flex-1 text-xs font-bold text-[#949ba4] uppercase flex items-center gap-2">
            <div className="w-1 h-1 bg-indigo-400 rounded-full"></div>
            Eylem
          </div>
          <div className="w-44 text-center text-xs font-bold text-[#949ba4] uppercase flex items-center justify-center gap-2">
            <div className="w-1 h-1 bg-purple-400 rounded-full"></div>
            Tuş Kombinasyonu
          </div>
        </div>
        
        <KeybindRow
          label="Mikrofonu Sustur (Mute)"
          description="Kendi sesini kapatır/açar."
          shortcut={formatKeybinding(muteKeybinding)}
          isRecording={recording === "mute"}
          icon={<Mic size={16} className="text-indigo-400" />}
          onClick={() => {
            setRecording("mute");
            setError(null);
          }}
          onRemove={async () => {
            if (window.netrex) {
              const result = await window.netrex.updateHotkey("mute", null);
              if (result?.success) {
                setMuteKeybinding(null);
                toastOnce("Tuş ataması kaldırıldı.", "success");
              } else {
                toastOnce(
                  result?.error || "Tuş ataması kaldırılamadı.",
                  "error"
                );
              }
            }
          }}
        />
        <KeybindRow
          label="Sağırlaştır (Deafen)"
          description="Hem mikrofonu hem hoparlörü kapatır."
          shortcut={formatKeybinding(deafenKeybinding)}
          isRecording={recording === "deafen"}
          icon={<Volume2 size={16} className="text-purple-400" />}
          onClick={() => {
            setRecording("deafen");
            setError(null);
          }}
          onRemove={async () => {
            if (window.netrex) {
              const result = await window.netrex.updateHotkey("deafen", null);
              if (result?.success) {
                setDeafenKeybinding(null);
                toastOnce("Tuş ataması kaldırıldı.", "success");
              } else {
                toastOnce(
                  result?.error || "Tuş ataması kaldırılamadı.",
                  "error"
                );
              }
            }
          }}
        />
        <KeybindRow
          label="Kamerayı Aç/Kapat"
          description="Kamerayı açıp kapatır."
          shortcut={formatKeybinding(cameraKeybinding)}
          isRecording={recording === "camera"}
          icon={<Camera size={16} className="text-cyan-400" />}
          onClick={() => {
            setRecording("camera");
            setError(null);
          }}
          onRemove={async () => {
            if (window.netrex) {
              const result = await window.netrex.updateHotkey("camera", null);
              if (result?.success) {
                setCameraKeybinding(null);
                toastOnce("Tuş ataması kaldırıldı.", "success");
              } else {
                toastOnce(
                  result?.error || "Tuş ataması kaldırılamadı.",
                  "error"
                );
              }
            }
          }}
        />
      </div>

      {/* Info Box */}
      <div className="mt-4 glass-strong rounded-xl p-4 border border-white/10 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0">
          <Info size={16} className="text-indigo-400" />
        </div>
        <p className="text-xs text-[#949ba4]">
          Netrex, uygulama simge durumuna küçültülmüş veya arka planda olsa bile bu tuşları algılar.
        </p>
      </div>
    </div>
  );
}

function KeybindRow({
  label,
  description,
  shortcut,
  isRecording,
  onClick,
  onRemove,
  icon,
}) {
  return (
    <div className="flex items-center justify-between p-4 hover:bg-white/5 transition-all duration-300 group/item border-b border-white/5 last:border-b-0">
      <div className="pr-4 flex-1 flex items-center gap-3">
        {icon && (
          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/10 group-hover/item:border-white/20 transition-colors shrink-0">
            {icon}
          </div>
        )}
        <div>
          <div className="font-medium text-white mb-0.5 group-hover/item:text-[#dbdee1] transition-colors">
            {label}
          </div>
          <div className="text-xs text-[#949ba4] group-hover/item:text-[#b5bac1] transition-colors">
            {description}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {shortcut && shortcut !== "Atanmadı" && !isRecording && (
          <button
            onClick={onRemove}
            onMouseDown={(e) => e.preventDefault()}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#949ba4] hover:text-[#f04747] hover:bg-[#f04747]/10 transition-all duration-300 focus:outline-none border border-transparent hover:border-red-500/30"
            title="Tuş atamasını kaldır"
          >
            <X size={16} />
          </button>
        )}
        <button
          onClick={onClick}
          onMouseDown={(e) => e.preventDefault()}
          className={`w-44 py-2.5 rounded-xl border-2 text-sm font-mono transition-all duration-300 relative overflow-hidden focus:outline-none ${
            isRecording
              ? "bg-gradient-to-r from-red-500/10 to-red-600/10 border-red-500 text-red-400 shadow-[0_0_15px_rgba(240,71,71,0.3)]"
              : shortcut && shortcut !== "Atanmadı"
              ? "bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-indigo-500/50 text-indigo-300 hover:border-indigo-400 hover:shadow-[0_0_10px_rgba(99,102,241,0.2)]"
              : "bg-[#1e1f22] border-white/10 text-[#949ba4] hover:border-white/20 hover:text-white"
          }`}
        >
          <span className="relative z-10 flex items-center justify-center gap-2">
            {isRecording && (
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            )}
            {isRecording ? "Tuşa Basın..." : shortcut || "Atanmadı"}
          </span>
          {isRecording && (
            <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-red-600/5 animate-pulse"></div>
          )}
        </button>
      </div>
    </div>
  );
}

export function PerformanceSettings() {
  const {
    hardwareAcceleration,
    setHardwareAcceleration,
    graphicsQuality,
    setGraphicsQuality,
  } = useSettingsStore();

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 pb-10">
      <h3 className="text-2xl font-bold text-white mb-6 relative">
        <span className="relative z-10">Performans Ayarları</span>
        <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-emerald-500/20 opacity-0 hover:opacity-100 transition-opacity duration-300 blur-sm"></div>
      </h3>

      {/* Header Banner */}
      <div className="glass-strong rounded-2xl overflow-hidden border border-white/20 shadow-soft-lg hover:shadow-xl transition-all duration-300 mb-6 relative group/card">
        <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-emerald-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 z-10 pointer-events-none"></div>

        <div className="h-20 w-full bg-gradient-to-r from-green-600 via-emerald-600 to-green-600 relative overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.1)_0%,transparent_50%)]"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(255,255,255,0.1)_0%,transparent_50%)]"></div>
          </div>
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/30"></div>
          <div className="absolute inset-0 flex items-center px-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-lg">
                <Cpu size={24} className="text-white" />
              </div>
              <div>
                <h4 className="text-white font-bold text-lg">Performans ve Kalite</h4>
                <p className="text-white/70 text-sm">
                  Uygulamanın kaynak kullanımını ve görsel kalitesini yönetin
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Donanım Hızlandırma */}
      <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 mb-4 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
        <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-emerald-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>

        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-4 flex items-center gap-2 relative z-10">
          <div className="w-6 h-6 rounded-lg bg-green-500/20 flex items-center justify-center">
            <Zap size={14} className="text-green-400" />
          </div>
          GPU Hızlandırma
        </h4>
        <div className="relative z-10 bg-[#1e1f22] rounded-xl p-4 border border-white/5 hover:border-green-500/20 transition-colors duration-300">
          <ToggleSwitch
            label="Donanım Hızlandırma"
            description="Animasyonları ve efektleri grafik kartınızda (GPU) işleyerek işlemci (CPU) yükünü azaltır."
            checked={hardwareAcceleration}
            onChange={() => setHardwareAcceleration(!hardwareAcceleration)}
          />
        </div>
      </div>

      {/* Görsel Kalite */}
      <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 mb-4 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
        <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-emerald-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>

        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-4 flex items-center gap-2 relative z-10">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center">
            <Palette size={14} className="text-emerald-400" />
          </div>
          Görsel Kalite
        </h4>
        <div className="relative z-10 space-y-3">
          <p className="text-sm text-[#949ba4] leading-relaxed">
            Düşük sistem özelliklerine sahipseniz "Performans" modunu seçerek bulanıklık (blur) efektlerini kapatabilir ve daha akıcı bir deneyim elde edebilirsiniz.
          </p>
          
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setGraphicsQuality("high")}
              className={`relative overflow-hidden rounded-xl p-4 border transition-all duration-300 text-left group/opt focus:outline-none ${
                graphicsQuality === "high"
                  ? "bg-green-500/10 border-green-500/50"
                  : "bg-[#1e1f22] border-white/5 hover:border-white/20 hover:bg-[#2b2d31]"
              }`}
            >
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <span className={`font-bold ${graphicsQuality === "high" ? "text-green-400" : "text-white"}`}>Yüksek Kalite</span>
                  {graphicsQuality === "high" && <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse"></div>}
                </div>
                <div className="text-xs text-[#949ba4] group-hover/opt:text-[#b5bac1]">
                  Tam görsel deneyim. Bulanıklık (Glassmorphism) ve tüm animasyonlar aktiftir.
                </div>
              </div>
            </button>

            <button
              onClick={() => setGraphicsQuality("low")}
              className={`relative overflow-hidden rounded-xl p-4 border transition-all duration-300 text-left group/opt focus:outline-none ${
                graphicsQuality === "low"
                  ? "bg-yellow-500/10 border-yellow-500/50"
                  : "bg-[#1e1f22] border-white/5 hover:border-white/20 hover:bg-[#2b2d31]"
              }`}
            >
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <span className={`font-bold ${graphicsQuality === "low" ? "text-yellow-400" : "text-white"}`}>Performans</span>
                  {graphicsQuality === "low" && <div className="w-2 h-2 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)] animate-pulse"></div>}
                </div>
                <div className="text-xs text-[#949ba4] group-hover/opt:text-[#b5bac1]">
                  Maksimum performans. Bulanıklık efektleri kapatılır ve animasyonlar basitleştirilir.
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- SES VE GÖRÜNTÜ AYARLARI ---
function VoiceSettings() {
  let room;
  try {
    room = useRoomContext();
  } catch (e) {
    // Room context yoksa (ayarlar modal açıkken room dışındaysa) sessizce yoksay
    // Bu normal bir durum olabilir
  }

  const [audioInputs, setAudioInputs] = useState([]);
  const [audioOutputs, setAudioOutputs] = useState([]);
  const [videoInputs, setVideoInputs] = useState([]);
  const [micVolume, setMicVolume] = useState(0);

  const settings = useSettingsStore();
  const { playSound } = useSoundEffects();
  const animationRef = useRef();
  const videoRef = useRef(null);

  const [localSfxVolume, setLocalSfxVolume] = useState(settings.sfxVolume);
  const [localThreshold, setLocalThreshold] = useState(settings.voiceThreshold);

  useEffect(() => {
    setLocalSfxVolume(settings.sfxVolume);
  }, [settings.sfxVolume]);
  useEffect(() => {
    setLocalThreshold(settings.voiceThreshold);
  }, [settings.voiceThreshold]);

  useEffect(() => {
    const getDevices = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        const devs = await navigator.mediaDevices.enumerateDevices();
        setAudioInputs(devs.filter((d) => d.kind === "audioinput"));
        setAudioOutputs(devs.filter((d) => d.kind === "audiooutput"));
        setVideoInputs(devs.filter((d) => d.kind === "videoinput"));
      } catch (err) {
        console.error(err);
      }
    };
    getDevices();
  }, []);

  // RMS değerini 0-100 arası yüzdeye dönüştür (useVoiceProcessor ile uyumlu)
  const rmsToPercentage = useCallback((rms) => {
    // useVoiceProcessor'daki CONFIG değerleri ile aynı
    const MIN_RMS = 0.002;
    const MAX_RMS = 0.12;

    // RMS değerini normalize et (0-1 arası)
    const normalized = Math.max(
      0,
      Math.min(1, (rms - MIN_RMS) / (MAX_RMS - MIN_RMS))
    );
    // Yüzdeye çevir (0-100)
    return normalized * 100;
  }, []);

  useEffect(() => {
    let audioContext, analyser, stream;
    const initAudio = async () => {
      try {
        if (!settings.audioInputId) return;
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId:
              settings.audioInputId !== "default"
                ? { exact: settings.audioInputId }
                : undefined,
          },
        });
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048; // useVoiceProcessor ile aynı
        analyser.smoothingTimeConstant = 0.25; // useVoiceProcessor ile aynı
        audioContext.createMediaStreamSource(stream).connect(analyser);
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateMeter = () => {
          analyser.getByteTimeDomainData(dataArray);
          // RMS hesapla (useVoiceProcessor ile aynı yöntem)
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const x = (dataArray[i] - 128) / 128.0;
            sum += x * x;
          }
          const rms = Math.sqrt(sum / dataArray.length);

          // RMS'yi yüzdeye dönüştür (slider ile uyumlu)
          const percentage = rmsToPercentage(rms);
          setMicVolume(percentage);

          animationRef.current = requestAnimationFrame(updateMeter);
        };
        updateMeter();
      } catch (error) {
        console.error(error);
      }
    };
    initAudio();
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (audioContext) audioContext.close();
    };
  }, [settings.audioInputId, rmsToPercentage]);

  // Kamera Önizleme
  useEffect(() => {
    let stream;
    // YENİ: Eğer kamera devre dışıysa stream başlatma
    if (!settings.enableCamera) return;

    const initVideo = async () => {
      if (videoInputs.length === 0) return;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId:
              settings.videoId !== "default"
                ? { exact: settings.videoId }
                : undefined,
            width: { ideal: 640 },
            height: { ideal: 360 },
          },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (e) {
        console.error("Kamera önizleme hatası:", e);
      }
    };

    initVideo();
    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [settings.videoId, videoInputs, settings.enableCamera]); // dependency'e enableCamera ekledik

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 pb-10">
      <h3 className="text-2xl font-bold text-white mb-6 relative">
        <span className="relative z-10">Ses ve Görüntü</span>
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 opacity-0 hover:opacity-100 transition-opacity duration-300 blur-sm"></div>
      </h3>

      {/* Header Banner */}
      <div className="glass-strong rounded-2xl overflow-hidden border border-white/20 shadow-soft-lg hover:shadow-xl transition-all duration-300 mb-6 relative group/card">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 z-10 pointer-events-none"></div>
        
        <div className="h-20 w-full bg-gradient-to-r from-cyan-600 via-blue-600 to-cyan-600 relative overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.1)_0%,transparent_50%)]"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(255,255,255,0.1)_0%,transparent_50%)]"></div>
          </div>
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/30"></div>
          <div className="absolute inset-0 flex items-center px-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-lg">
                <Mic size={24} className="text-white" />
              </div>
              <div>
                <h4 className="text-white font-bold text-lg">Ses ve Görüntü</h4>
                <p className="text-white/70 text-sm">Mikrofon, hoparlör ve kamera ayarları</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KAMERA AYARLARI */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold text-[#949ba4] uppercase flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Camera size={14} className="text-purple-400" />
            </div>
            Video Ayarları
          </h4>
          <span
            className={`text-[10px] px-3 py-1 rounded-full font-bold flex items-center gap-1.5 ${
              settings.enableCamera
                ? "bg-green-500/15 text-green-400 border border-green-500/30"
                : "bg-red-500/15 text-red-400 border border-red-500/30"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${settings.enableCamera ? "bg-green-400" : "bg-red-400"}`}></span>
            {settings.enableCamera ? "AÇIK" : "DEVRE DIŞI"}
          </span>
        </div>

        <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
          {/* Hover glow */}
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>

          {/* YENİ: KAMERA AÇ/KAPA TOGGLE */}
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10 relative z-10">
            <div>
              <div className="font-bold text-sm text-white">
                Kamerayı Etkinleştir
              </div>
              <div className="text-xs text-[#949ba4]">
                Kapatırsanız uygulama içinde kamera butonu devre dışı kalır.
              </div>
            </div>
            <ToggleSwitch
              checked={settings.enableCamera}
              onChange={settings.toggleEnableCamera}
            />
          </div>

          {/* Sadece kamera etkinse göster */}
          {settings.enableCamera ? (
            <>
              <div className="mb-4">
                <label className="block text-xs font-bold text-[#b5bac1] uppercase mb-2">
                  Kamera
                </label>
                <div className="relative">
                  <select
                    value={settings.videoId}
                    onChange={(e) => {
                      settings.setVideoInput(e.target.value);
                      if (room?.localParticipant)
                        room.switchActiveDevice("videoinput", e.target.value);
                    }}
                    className="w-full bg-[#1e1f22] border border-white/10 text-white p-2.5 rounded-lg hover:border-indigo-500/50 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 outline-none appearance-none cursor-pointer pl-9 transition-all duration-300 relative z-10"
                  >
                    {videoInputs.length > 0 ? (
                      videoInputs.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {d.label || `Kamera ${d.deviceId.slice(0, 5)}`}
                        </option>
                      ))
                    ) : (
                      <option disabled>Kamera Bulunamadı</option>
                    )}
                  </select>
                  <div className="absolute left-3 top-2.5 pointer-events-none text-gray-400">
                    <Video size={16} />
                  </div>
                </div>
              </div>

              <div className="relative w-full aspect-video bg-[#0a0a0c] rounded-xl overflow-hidden border-2 border-white/10 shadow-lg flex items-center justify-center relative z-10">
                {videoInputs.length > 0 ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover transform scale-x-[-1]"
                  />
                ) : (
                  <div className="flex flex-col items-center text-[#949ba4] opacity-50">
                    <VideoOff size={48} className="mb-2" />
                    <span className="text-sm font-bold">Kamera Yok</span>
                  </div>
                )}
                {videoInputs.length > 0 && (
                  <div className="absolute top-2 left-2 bg-red-500/80 text-white text-[10px] font-bold px-2 py-0.5 rounded backdrop-blur-sm">
                    ÖNİZLEME
                  </div>
                )}
              </div>

              {/* Ayna Efekti */}
              <div className="mt-4 pt-4 border-t border-white/10 relative z-10">
                <ToggleSwitch
                  label="Ayna Efekti"
                  description="Kamera görüntüsünü yatay olarak çevir (kendini aynada görür gibi)."
                  checked={settings.cameraMirrorEffect}
                  onChange={() =>
                    settings.setCameraMirrorEffect(!settings.cameraMirrorEffect)
                  }
                />
              </div>

              {/* Video Kalite Ayarları */}
              <div className="mt-4 pt-4 border-t border-white/10 relative z-10">
                <h5 className="text-xs font-bold text-[#949ba4] uppercase mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                  Video Kalitesi
                </h5>

                {/* Çözünürlük Seçimi */}
                <div className="mb-4">
                  <label className="block text-xs font-bold text-[#b5bac1] uppercase mb-2">
                    Çözünürlük
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[ 
                      { value: "240p", label: "240p", desc: "Temel" },
                    ].map((res) => (
                      <button
                        key={res.value}
                        onClick={() => settings.setVideoResolution(res.value)}
                        onMouseDown={(e) => e.preventDefault()}
                        className={`p-3 rounded-xl border-2 transition-all duration-300 flex flex-col items-center justify-center gap-1 focus:outline-none ${
                          settings.videoResolution === res.value
                            ? "border-indigo-500 bg-indigo-500/10 text-white"
                            : "border-white/10 bg-white/5 text-[#949ba4] hover:border-white/20 hover:bg-white/10"
                        }`}
                      >
                        <span className="font-bold text-sm">{res.label}</span>
                        <span className="text-[10px] opacity-70">{res.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* FPS Seçimi */}
                <div className="mb-2">
                  <label className="block text-xs font-bold text-[#b5bac1] uppercase mb-2">
                    Kare Hızı (FPS)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 10, label: "10 FPS", desc: "Düşük" },
                      { value: 15, label: "15 FPS", desc: "Normal" },
                      { value: 18, label: "18 FPS", desc: "Yüksek" },
                    ].map((fps) => (
                      <button
                        key={fps.value}
                        onClick={() => settings.setVideoFrameRate(fps.value)}
                        onMouseDown={(e) => e.preventDefault()}
                        className={`p-3 rounded-xl border-2 transition-all duration-300 flex flex-col items-center justify-center gap-1 focus:outline-none ${
                          settings.videoFrameRate === fps.value
                            ? "border-indigo-500 bg-indigo-500/10 text-white"
                            : "border-white/10 bg-white/5 text-[#949ba4] hover:border-white/20 hover:bg-white/10"
                        }`}
                      >
                        <span className="font-bold text-sm">{fps.label}</span>
                        <span className="text-[10px] opacity-70">{fps.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-[#949ba4] mt-3 flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">⚠️</span>
                  <span>Yüksek kalite daha fazla bant genişliği kullanır. Bağlantı sorunları yaşarsanız kaliteyi düşürün.</span>
                </p>
              </div>
            </>
          ) : (
            // Kamera Devre Dışı İse Gösterilecek Mesaj
            <div className="flex flex-col items-center justify-center py-8 text-[#949ba4] opacity-70">
              <ShieldAlert size={48} className="mb-3 text-[#da373c]" />
              <p className="text-sm font-medium text-center max-w-[200px]">
                Gizlilik ayarlarından kamera erişimi kapatıldı.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-6"></div>

      {/* SES AYARLARI */}
      <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 mb-6 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>
        
        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-4 flex items-center gap-2 relative z-10">
          <div className="w-6 h-6 rounded-lg bg-cyan-500/20 flex items-center justify-center">
            <Mic size={14} className="text-cyan-400" />
          </div>
          Ses Cihazları
        </h4>
        
        <div className="relative z-10 space-y-4">
          {/* Mikrofon */}
          <div className="bg-[#1e1f22] rounded-xl p-4 border border-white/5 hover:border-cyan-500/20 transition-colors duration-300">
            <label className="block text-xs font-bold text-[#b5bac1] uppercase mb-2 flex items-center gap-2">
              <Mic size={12} className="text-cyan-400" />
              Giriş Cihazı (Mikrofon)
            </label>
            <div className="relative">
              <select
                value={settings.audioInputId}
                onChange={(e) => {
                  settings.setAudioInput(e.target.value);
                  if (room?.localParticipant)
                    room.switchActiveDevice("audioinput", e.target.value);
                }}
                className="w-full bg-[#2b2d31] border border-white/10 text-white p-3 rounded-xl hover:border-cyan-500/50 focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 outline-none appearance-none cursor-pointer transition-all duration-300 pr-10"
              >
                <option value="default">Varsayılan</option>
                {audioInputs.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Mikrofon ${d.deviceId.slice(0, 5)}`}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-cyan-400">
                <Mic size={16} />
              </div>
            </div>
          </div>
          
          {/* Hoparlör */}
          <div className="bg-[#1e1f22] rounded-xl p-4 border border-white/5 hover:border-indigo-500/20 transition-colors duration-300">
            <label className="block text-xs font-bold text-[#b5bac1] uppercase mb-2 flex items-center gap-2">
              <Speaker size={12} className="text-indigo-400" />
              Çıkış Cihazı (Hoparlör)
            </label>
            <div className="relative">
              <select
                value={settings.audioOutputId}
                onChange={(e) => {
                  settings.setAudioOutput(e.target.value);
                  if (room)
                    room.switchActiveDevice("audiooutput", e.target.value);
                }}
                className="w-full bg-[#2b2d31] border border-white/10 text-white p-3 rounded-xl hover:border-indigo-500/50 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 outline-none appearance-none cursor-pointer transition-all duration-300 pr-10"
              >
                <option value="default">Varsayılan</option>
                {audioOutputs.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Hoparlör ${d.deviceId.slice(0, 5)}`}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-indigo-400">
                <Speaker size={16} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* UYGULAMA SESLERİ */}
      <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 mb-6 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>
        
        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-4 flex items-center gap-2 relative z-10">
          <div className="w-6 h-6 rounded-lg bg-indigo-500/20 flex items-center justify-center">
            <Volume2 size={14} className="text-indigo-400" />
          </div>
          Uygulama Sesleri
          <span className="ml-auto text-xs text-indigo-400 font-bold bg-indigo-500/10 px-2 py-0.5 rounded-lg">
            %{localSfxVolume}
          </span>
        </h4>
        
        <div className="relative z-10 bg-[#1e1f22] rounded-xl p-4 border border-white/5">
          <div className="relative w-full h-10 flex items-center select-none">
            <div className="absolute w-full h-3 bg-[#2b2d31] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-75 rounded-full"
                style={{ width: `${localSfxVolume}%` }}
              ></div>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={localSfxVolume}
              onChange={(e) => setLocalSfxVolume(parseInt(e.target.value))}
              onMouseUp={() => {
                settings.setSfxVolume(localSfxVolume);
                playSound("join");
              }}
              onTouchEnd={() => {
                settings.setSfxVolume(localSfxVolume);
                playSound("join");
              }}
              className="w-full absolute z-20 opacity-0 cursor-pointer h-full"
            />
            <div
              className="absolute h-5 w-5 bg-white rounded-full shadow-lg pointer-events-none transition-all z-30 border-2 border-indigo-500"
              style={{
                left: `${localSfxVolume}%`,
                transform: "translateX(-50%)",
              }}
            ></div>
          </div>
          <p className="text-xs text-[#949ba4] mt-3">
            Giriş, çıkış, mute ve diğer bildirim seslerinin yüksekliği.
          </p>
        </div>
      </div>

      {/* GİRİŞ HASSASİYETİ */}
      <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 mb-6 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>
        
        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-2 flex items-center gap-2 relative z-10">
          <div className="w-6 h-6 rounded-lg bg-green-500/20 flex items-center justify-center">
            <Zap size={14} className="text-green-400" />
          </div>
          Giriş Hassasiyeti (Noise Gate)
          <span className="ml-auto text-xs text-green-400 font-bold bg-green-500/10 px-2 py-0.5 rounded-lg">
            {localThreshold}%
          </span>
        </h4>
        <p className="text-xs text-[#949ba4] mb-4 ml-8 relative z-10">
          Mikrofonunuz ne kadar ses algıladığında devreye girsin?
        </p>
        
        <div className="relative z-10 bg-[#1e1f22] rounded-xl p-5 border border-white/5">
          <div className="h-4 w-full bg-[#2b2d31] rounded-full overflow-hidden relative mb-4 shadow-inner">
            <div
              className="absolute inset-0 w-full h-full"
              style={{
                background:
                  "linear-gradient(to right, #da373c 0%, #da373c 10%, #f0b232 40%, #23a559 100%)",
                opacity: 0.3,
              }}
            ></div>
            <div
              className="absolute top-0 bottom-0 w-1 bg-white z-20 shadow-[0_0_10px_rgba(255,255,255,0.8)] rounded-full"
              style={{ left: `${localThreshold}%` }}
            ></div>
            <div
              className="h-full transition-all duration-75 ease-out z-10 rounded-full"
              style={{
                width: `${micVolume}%`,
                backgroundColor:
                  micVolume > localThreshold ? "#23a559" : "#da373c",
                boxShadow: micVolume > localThreshold ? "0 0 10px rgba(35,165,89,0.5)" : "0 0 10px rgba(218,55,60,0.5)",
              }}
            ></div>
          </div>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="0"
              max="100"
              value={localThreshold}
              onChange={(e) => setLocalThreshold(Number(e.target.value))}
              onMouseUp={() => settings.setVoiceThreshold(localThreshold)}
              onTouchEnd={() => settings.setVoiceThreshold(localThreshold)}
              className="w-full h-2 bg-[#404249] rounded-lg appearance-none cursor-pointer accent-green-500"
            />
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-[#949ba4]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded-full"></span> Gürültü</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-yellow-500 rounded-full"></span> Geçiş</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full"></span> Konuşma</span>
          </div>
        </div>
      </div>

      {/* GÜRÜLTÜ AZALTMA MODU */}
      <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 mb-6 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>
        
        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-2 flex items-center gap-2 relative z-10">
          <div className="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <Zap size={14} className="text-purple-400" />
          </div>
          Gürültü Azaltma
        </h4>
        <p className="text-xs text-[#949ba4] mb-4 ml-8 relative z-10">
          Mikrofonunun algıladığı arka plan seslerini bastır.
        </p>

        <div className="relative z-10 grid grid-cols-3 gap-2">
          {/* Yok */}
          <label className={`flex flex-col items-center justify-center p-4 rounded-xl cursor-pointer transition-all duration-300 border-2 ${
            settings.noiseSuppressionMode === "none"
              ? "bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.3)]"
              : "bg-[#1e1f22] border-white/10 hover:border-white/20 hover:bg-white/5"
          }`}>
            <input
              type="radio"
              name="noiseSuppressionMode"
              value="none"
              checked={settings.noiseSuppressionMode === "none"}
              onChange={(e) => settings.setNoiseSuppressionMode(e.target.value)}
              className="sr-only"
            />
            <div className={`w-6 h-6 rounded-full border-2 mb-2 flex items-center justify-center transition-all ${
              settings.noiseSuppressionMode === "none"
                ? "border-indigo-500 bg-indigo-500"
                : "border-[#80848e]"
            }`}>
              {settings.noiseSuppressionMode === "none" && (
                <div className="w-2.5 h-2.5 rounded-full bg-white"></div>
              )}
            </div>
            <span className="text-sm text-white font-medium">Yok</span>
            <span className="text-[10px] text-[#949ba4] mt-1">Kapalı</span>
          </label>

          {/* Standart */}
          <label className={`flex flex-col items-center justify-center p-4 rounded-xl cursor-pointer transition-all duration-300 border-2 ${
            settings.noiseSuppressionMode === "standard"
              ? "bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.3)]"
              : "bg-[#1e1f22] border-white/10 hover:border-white/20 hover:bg-white/5"
          }`}>
            <input
              type="radio"
              name="noiseSuppressionMode"
              value="standard"
              checked={settings.noiseSuppressionMode === "standard"}
              onChange={(e) => settings.setNoiseSuppressionMode(e.target.value)}
              className="sr-only"
            />
            <div className={`w-6 h-6 rounded-full border-2 mb-2 flex items-center justify-center transition-all ${
              settings.noiseSuppressionMode === "standard"
                ? "border-indigo-500 bg-indigo-500"
                : "border-[#80848e]"
            }`}>
              {settings.noiseSuppressionMode === "standard" && (
                <div className="w-2.5 h-2.5 rounded-full bg-white"></div>
              )}
            </div>
            <span className="text-sm text-white font-medium">Standart</span>
            <span className="text-[10px] text-[#949ba4] mt-1">Temel</span>
          </label>

          {/* Krisp (RNNoise) */}
          <label className={`flex flex-col items-center justify-center p-4 rounded-xl cursor-pointer transition-all duration-300 border-2 relative ${
            settings.noiseSuppressionMode === "krisp"
              ? "bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.3)]"
              : "bg-[#1e1f22] border-white/10 hover:border-white/20 hover:bg-white/5"
          }`}>
            <span className="absolute -top-1 -right-1 text-[8px] px-1.5 py-0.5 rounded font-bold bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
              AI
            </span>
            <input
              type="radio"
              name="noiseSuppressionMode"
              value="krisp"
              checked={settings.noiseSuppressionMode === "krisp"}
              onChange={(e) => settings.setNoiseSuppressionMode(e.target.value)}
              className="sr-only"
            />
            <div className={`w-6 h-6 rounded-full border-2 mb-2 flex items-center justify-center transition-all ${
              settings.noiseSuppressionMode === "krisp"
                ? "border-indigo-500 bg-indigo-500"
                : "border-[#80848e]"
            }`}>
              {settings.noiseSuppressionMode === "krisp" && (
                <div className="w-2.5 h-2.5 rounded-full bg-white"></div>
              )}
            </div>
            <span className="text-sm text-white font-medium">Krisp</span>
            <span className="text-[10px] text-[#949ba4] mt-1">Gelişmiş</span>
          </label>
        </div>
      </div>

      {/* GELİŞMİŞ SES İŞLEME */}
      <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>
        
        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-4 flex items-center gap-2 relative z-10">
          <div className="w-6 h-6 rounded-lg bg-orange-500/20 flex items-center justify-center">
            <Zap size={14} className="text-orange-400" />
          </div>
          Gelişmiş Ses İşleme
        </h4>
        
        <div className="relative z-10 space-y-1">
          <div className="bg-[#1e1f22] rounded-xl p-4 border border-white/5 hover:border-cyan-500/20 transition-colors duration-300">
            <ToggleSwitch
              label="Yankı Engelleme"
              description="Sesinin yankılanmasını önler. Kulaklık kullanmıyorsan kesinlikle aç."
              checked={settings.echoCancellation}
              onChange={settings.toggleEchoCancellation}
            />
          </div>
          <div className="bg-[#1e1f22] rounded-xl p-4 border border-white/5 hover:border-indigo-500/20 transition-colors duration-300">
            <ToggleSwitch
              label="Gürültü Bastırma (Noise Suppression)"
              description="Klavye sesi, fan sesi gibi arka plan gürültülerini filtreler."
              checked={settings.noiseSuppression}
              onChange={settings.toggleNoiseSuppression}
            />
          </div>
          <div className="bg-[#1e1f22] rounded-xl p-4 border border-white/5 hover:border-purple-500/20 transition-colors duration-300">
            <ToggleSwitch
              label="Otomatik Kazanç Kontrolü"
              description="Ses seviyeni otomatik olarak dengeler (Bağırdığında kısar, fısıldadığında açar)."
              checked={settings.autoGainControl}
              onChange={settings.toggleAutoGainControl}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// --- BİLDİRİM AYARLARI ---
function NotificationSettings() {
  const {
    desktopNotifications,
    notificationSound,
    notifyOnMessage,
    notifyOnJoin,
    notifyOnLeave,
    setDesktopNotifications,
    setNotificationSound,
    setNotifyOnMessage,
    setNotifyOnJoin,
    setNotifyOnLeave,
  } = useSettingsStore();

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 pb-10">
      <h3 className="text-2xl font-bold text-white mb-6 relative">
        <span className="relative z-10">Bildirim Ayarları</span>
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 opacity-0 hover:opacity-100 transition-opacity duration-300 blur-sm"></div>
      </h3>

      {/* Header Banner */}
      <div className="glass-strong rounded-2xl overflow-hidden border border-white/20 shadow-soft-lg hover:shadow-xl transition-all duration-300 mb-6 relative group/card">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 z-10 pointer-events-none"></div>
        
        <div className="h-20 w-full bg-gradient-to-r from-yellow-600 via-orange-600 to-yellow-600 relative overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.1)_0%,transparent_50%)]"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(255,255,255,0.1)_0%,transparent_50%)]"></div>
          </div>
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/30"></div>
          <div className="absolute inset-0 flex items-center px-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-lg relative">
                <Bell size={24} className="text-white" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse border-2 border-white/20"></span>
              </div>
              <div>
                <h4 className="text-white font-bold text-lg">Bildirimler</h4>
                <p className="text-white/70 text-sm">Uyarı ve ses tercihlerinizi yönetin</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Genel Bildirimler */}
      <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 mb-4 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>

        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-4 flex items-center gap-2 relative z-10">
          <div className="w-6 h-6 rounded-lg bg-indigo-500/20 flex items-center justify-center">
            <Monitor size={14} className="text-indigo-400" />
          </div>
          Genel Bildirimler
        </h4>
        <div className="relative z-10 space-y-1">
          <div className="bg-[#1e1f22] rounded-xl p-4 border border-white/5 hover:border-indigo-500/20 transition-colors duration-300">
            <ToggleSwitch
              label="Masaüstü Bildirimleri"
              description="Yeni mesajlar ve diğer olaylar için masaüstü bildirimleri göster."
              checked={desktopNotifications}
              onChange={() => setDesktopNotifications(!desktopNotifications)}
            />
          </div>
          <div className="bg-[#1e1f22] rounded-xl p-4 border border-white/5 hover:border-purple-500/20 transition-colors duration-300">
            <ToggleSwitch
              label="Bildirim Sesi"
              description="Bildirimler geldiğinde ses çal."
              checked={notificationSound}
              onChange={() => setNotificationSound(!notificationSound)}
            />
          </div>
        </div>
      </div>

      {/* Bildirim Olayları */}
      <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>

        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-4 flex items-center gap-2 relative z-10">
          <div className="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <Zap size={14} className="text-purple-400" />
          </div>
          Bildirim Olayları
        </h4>
        <div className="relative z-10 space-y-1">
          <div className="bg-[#1e1f22] rounded-xl p-4 border border-white/5 hover:border-blue-500/20 transition-colors duration-300">
            <ToggleSwitch
              label="Yeni Mesaj Bildirimi"
              description="Yeni mesaj geldiğinde bildirim göster."
              checked={notifyOnMessage}
              onChange={() => setNotifyOnMessage(!notifyOnMessage)}
            />
          </div>
          <div className="bg-[#1e1f22] rounded-xl p-4 border border-white/5 hover:border-green-500/20 transition-colors duration-300">
            <ToggleSwitch
              label="Katılım Bildirimi"
              description="Birisi odaya katıldığında bildirim göster."
              checked={notifyOnJoin}
              onChange={() => setNotifyOnJoin(!notifyOnJoin)}
            />
          </div>
          <div className="bg-[#1e1f22] rounded-xl p-4 border border-white/5 hover:border-red-500/20 transition-colors duration-300">
            <ToggleSwitch
              label="Ayrılış Bildirimi"
              description="Birisi odadan ayrıldığında bildirim göster."
              checked={notifyOnLeave}
              onChange={() => setNotifyOnLeave(!notifyOnLeave)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// --- GÖRÜNÜM AYARLARI ---
function AppearanceSettings({ onSave }) {
  const {
    uiScale,
    fontSize,
    fontFamily,
    setUIScale,
    setFontSize,
    setFontFamily,
  } = useSettingsStore();

  const fontOptions = getCommonFonts();

  const fontSizeOptions = [
    { value: "small", label: "Küçük", size: "14px" },
    { value: "medium", label: "Orta", size: "16px" },
    { value: "large", label: "Büyük", size: "18px" },
  ];

  const scaleOptions = [
    { value: 75, label: "Küçük (75%)" },
    { value: 100, label: "Normal (100%)" },
    { value: 125, label: "Büyük (125%)" },
    { value: 150, label: "Çok Büyük (150%)" },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <h3 className="text-2xl font-bold text-white mb-6 relative">
        <span className="relative z-10">Görünüm Ayarları</span>
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 opacity-0 hover:opacity-100 transition-opacity duration-300 blur-sm"></div>
      </h3>

      <div className="bg-[#2b2d31] rounded-lg border border-[#1f2023] overflow-hidden p-4 mb-4">
        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-4">
          Ölçeklendirme ve Font
        </h4>

        <div className="mb-4">
          <label className="block text-sm font-medium text-[#dbdee1] mb-2">
            UI Ölçeklendirme
          </label>
          <select
            value={uiScale}
            onChange={(e) => setUIScale(Number(e.target.value))}
            className="w-full bg-[#1e1f22] border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-300 relative z-10"
          >
            {scaleOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-[#949ba4] mt-1">
            Arayüzün genel boyutunu ayarlar.
          </p>
        </div>

        <div className="h-px bg-white/10 my-3 relative z-10"></div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-[#dbdee1] mb-2">
            Font Boyutu
          </label>
          <select
            value={fontSize}
            onChange={(e) => setFontSize(e.target.value)}
            className="w-full bg-[#1e1f22] border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-300 relative z-10"
          >
            {fontSizeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label} ({opt.size})
              </option>
            ))}
          </select>
          <p className="text-xs text-[#949ba4] mt-1">Metin boyutunu ayarlar.</p>
        </div>

        <div className="h-px bg-white/10 my-3 relative z-10"></div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-[#dbdee1] mb-2">
            Font Ailesi
          </label>
          <select
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
            className="w-full bg-[#1e1f22] border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-300 relative z-10"
          >
            {fontOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-[#949ba4] mt-1">
            Uygulama genelinde kullanılacak font ailesini seçin.
          </p>
        </div>
      </div>
    </div>
  );
}
