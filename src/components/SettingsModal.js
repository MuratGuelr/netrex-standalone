import { useState, useEffect, useRef, useCallback } from "react";
import { X, User, AppWindow, Cpu, Mic, Keyboard, Bell, Info, Palette } from "lucide-react";
import { useSettingsStore } from "@/src/store/settingsStore";
import SidebarItem from "./settings/SidebarItem";
import AccountSettings from "./settings/tabs/AccountSettings";
import ApplicationSettings from "./settings/tabs/ApplicationSettings";
import PerformanceSettings from "./settings/tabs/PerformanceSettings";
import VoiceSettings from "./settings/tabs/VoiceSettings";
import KeybindSettings from "./settings/tabs/KeybindSettings";
import NotificationSettings from "./settings/tabs/NotificationSettings";
import AppearanceSettings from "./settings/tabs/AppearanceSettings";
import AboutSettings from "./settings/tabs/AboutSettings";
import { toast } from "@/src/utils/toast";

// --- ANA BİLEŞEN ---
export default function SettingsModal({ isOpen, onClose }) {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState("account");
  const contentRef = useRef(null);
  const accountSettingsRef = useRef(null);
  const { settingsScrollToSection, setSettingsScrollToSection } = useSettingsStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  // settingsScrollToSection varsa account tab'ına geç
  useEffect(() => {
    if (settingsScrollToSection && isOpen) {
      setActiveTab("account");
    }
  }, [settingsScrollToSection, isOpen]);

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
                <img src="logo.png" alt="Netrex" className="w-10 h-10" />
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
            label="Görünüm"
            icon={<Palette size={18} />}
            active={activeTab === "appearance"}
            onClick={() => setActiveTab("appearance")}
            color="pink"
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
            color="indigo"
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
                {activeTab === "account" && <AccountSettings ref={accountSettingsRef} onClose={onClose} scrollToSection={settingsScrollToSection} setScrollToSection={setSettingsScrollToSection} contentRef={contentRef} />}
                {activeTab === "application" && <ApplicationSettings />}
                {activeTab === "appearance" && <AppearanceSettings />}
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
                if (activeTab === "account" && accountSettingsRef.current) {
                  accountSettingsRef.current.saveProfile();
                } else {
                  toast.success("Ayarlar kaydedildi!");
                }
                
                // Profil kaydediliyorsa (zaten kendi içinde loading/toast var) 
                // Biraz bekleyip kapatalım
                setTimeout(() => {
                  onClose();
                }, 800);
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
