import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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

  if (!mounted || !isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center backdrop-blur-sm animate-fadeIn">
      <div className="glass-strong w-[850px] h-[650px] rounded-2xl shadow-soft-lg flex overflow-hidden border border-white/10 animate-scaleIn">
        <div className="w-60 bg-gradient-to-b from-[#25272a] to-[#2b2d31] p-3 flex flex-col gap-1 border-r border-white/10">
          <div className="px-3 pt-4 pb-2">
            <h2 className="text-xs font-bold text-[#949ba4] uppercase tracking-wide">
              Kullanıcı Ayarları
            </h2>
          </div>
          <SidebarItem
            label="Hesabım"
            icon={<User size={18} />}
            active={activeTab === "account"}
            onClick={() => setActiveTab("account")}
          />
          <div className="h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent mx-3 my-3"></div>
          <div className="px-3 pt-2 pb-2">
            <h2 className="text-xs font-bold text-[#949ba4] uppercase tracking-wide">
              Uygulama Ayarları
            </h2>
          </div>
          <SidebarItem
            label="Genel"
            icon={<AppWindow size={18} />}
            active={activeTab === "application"}
            onClick={() => setActiveTab("application")}
          />
          <SidebarItem
            label="Ses ve Görüntü"
            icon={<Mic size={18} />}
            active={activeTab === "voice"}
            onClick={() => setActiveTab("voice")}
          />
          <SidebarItem
            label="Tuş Atamaları"
            icon={<Keyboard size={18} />}
            active={activeTab === "keybinds"}
            onClick={() => setActiveTab("keybinds")}
          />
          <SidebarItem
            label="Bildirimler"
            icon={<Bell size={18} />}
            active={activeTab === "notifications"}
            onClick={() => setActiveTab("notifications")}
          />
          <SidebarItem
            label="Görünüm"
            icon={<Palette size={18} />}
            active={activeTab === "appearance"}
            onClick={() => setActiveTab("appearance")}
          />
          <div className="mt-auto px-2 pb-2">
            <div className="text-[10px] text-[#5e626a] text-center">
              Netrex v{process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0"}
            </div>
          </div>
        </div>
        <div className="flex-1 bg-gradient-to-br from-[#2b2d31] to-[#313338] relative flex flex-col min-w-0">
          <div
            className="absolute top-5 right-5 z-10 flex flex-col items-center group cursor-pointer"
            onClick={onClose}
          >
            <div className="w-10 h-10 rounded-xl glass border border-white/10 flex items-center justify-center text-[#949ba4] group-hover:bg-red-500/20 group-hover:text-red-400 group-hover:border-red-500/30 transition-all duration-200 hover:scale-110 hover:shadow-soft">
              <X size={20} strokeWidth={2.5} />
            </div>
            <span className="text-[10px] font-bold text-[#949ba4] mt-1.5 group-hover:text-[#dbdee1] transition-colors">
              ESC
            </span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-10 pr-16 pb-20">
            {activeTab === "account" && <AccountSettings onClose={onClose} />}
            {activeTab === "application" && <ApplicationSettings />}
            {activeTab === "voice" && <VoiceSettings />}
            {activeTab === "keybinds" && <KeybindSettings />}
            {activeTab === "notifications" && <NotificationSettings />}
            {activeTab === "appearance" && (
              <AppearanceSettings onSave={onClose} />
            )}
          </div>
          {/* Ayarları Kaydet Butonu */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#2b2d31] to-transparent border-t border-white/5 p-5 flex justify-end backdrop-blur-sm">
            <button
              onClick={() => {
                toast.success("Ayarlar kaydedildi!");
                // Ayarlar zaten otomatik kaydediliyor (zustand persist), sadece feedback veriyoruz
                setTimeout(() => {
                  onClose();
                }, 500);
              }}
              className="px-8 py-3 gradient-primary hover:shadow-glow text-white rounded-xl font-semibold transition-all duration-200 hover-lift btn-modern"
            >
              Ayarları Kaydet
            </button>
          </div>
        </div>
      </div>
      {/* Alt padding - blur altında kalmaması için */}
      <div className="h-20"></div>
    </div>
  );
}

function SidebarItem({ label, icon, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[15px] font-medium transition-all duration-200 w-full text-left mb-1 hover-lift ${
        active
          ? "glass-strong text-white shadow-soft border border-white/10"
          : "text-[#b5bac1] hover:bg-[#35373c]/60 hover:text-[#dbdee1]"
      }`}
    >
      <div className={active ? "text-white" : "text-[#b5bac1]"}>{icon}</div>
      <span>{label}</span>
    </button>
  );
}

// ... (ToggleSwitch, ApplicationSettings, AccountSettings, KeybindSettings AYNI KALSIN) ...
function ToggleSwitch({ label, description, checked, onChange }) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="pr-4">
        <div className="font-medium text-[#dbdee1] mb-0.5">{label}</div>
        <div className="text-xs text-[#949ba4]">{description}</div>
      </div>
      <button
        onClick={onChange}
        className={`w-12 h-6 rounded-full relative transition-colors duration-300 ease-in-out border-2 border-transparent shrink-0 focus:outline-none ${
          checked ? "bg-[#23a559]" : "bg-[#80848e]"
        }`}
      >
        <div
          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ease-in-out flex items-center justify-center ${
            checked ? "translate-x-6" : "translate-x-0"
          }`}
        >
          {checked ? (
            <Check size={10} className="text-[#23a559] stroke-[4]" />
          ) : (
            <X size={10} className="text-[#80848e] stroke-[4]" />
          )}
        </div>
      </button>
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
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <h3 className="text-xl font-bold text-white mb-6">Uygulama Ayarları</h3>
      <div className="bg-[#2b2d31] rounded-lg border border-[#1f2023] overflow-hidden p-4 mb-4">
        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-4">
          Pencere Davranışı
        </h4>
        <ToggleSwitch
          label="Sistem Tepsisine Küçült"
          description="Kapat (X) butonuna bastığında uygulama kapanmak yerine sağ alt köşedeki (saat yanı) simge durumuna küçülür."
          checked={closeToTray}
          onChange={() => setCloseToTray(!closeToTray)}
        />
      </div>
      <div className="bg-[#2b2d31] rounded-lg border border-[#1f2023] overflow-hidden p-4">
        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-4">
          Güncellemeler
        </h4>
        <ToggleSwitch
          label="Açılışta Güncelleme Kontrolü"
          description="Uygulama açıldığında otomatik olarak güncellemeleri kontrol eder."
          checked={checkUpdatesOnStartup}
          onChange={() => setCheckUpdatesOnStartup(!checkUpdatesOnStartup)}
        />
      </div>
    </div>
  );
}

function AccountSettings({ onClose }) {
  const { user, logout } = useAuthStore();
  const { profileColor, setProfileColor } = useSettingsStore();

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
  const handleLogout = async () => {
    if (window.confirm("Çıkış yapmak istediğinize emin misiniz?")) {
      await logout();
      onClose();
    }
  };
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 pb-10">
      <h3 className="text-xl font-bold text-white mb-6">Hesabım</h3>
      <div className="bg-[#1e1f22] rounded-lg overflow-hidden border border-[#1f2023] shadow-md mb-8">
        <div
          className="h-24 w-full transition-all duration-300"
          style={{ background: profileColor }}
        ></div>
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
          <div className="bg-[#2b2d31] rounded-lg p-4 space-y-4">
            <div className="flex justify-between items-center group">
              <div>
                <label className="text-[11px] font-bold text-[#949ba4] uppercase mb-1 flex items-center gap-1">
                  <User size={12} /> Görünen Ad
                </label>
                <div className="text-[#dbdee1] text-sm">
                  {user?.displayName || "Belirtilmemiş"}
                </div>
              </div>
            </div>
            <div className="flex justify-between items-center group">
              <div>
                <label className="text-[11px] font-bold text-[#949ba4] uppercase mb-1 flex items-center gap-1">
                  <Mail size={12} /> E-Posta
                </label>
                <div className="text-[#dbdee1] text-sm">
                  {user?.email || (
                    <span className="text-[#949ba4] italic">Anonim Hesap</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="h-[1px] bg-[#3f4147] my-6"></div>
      <div className="mb-8">
        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-4 flex items-center gap-2">
          <Palette size={14} /> Profil Teması
        </h4>
        <div className="flex gap-2 mb-4 bg-[#1e1f22] p-1 rounded-lg w-fit">
          <button
            onClick={() => {
              setColorMode("solid");
              // Solid mode'a geçerken mevcut rengi kullan (gradient ise ilk rengi)
              if (profileColor.includes("gradient")) {
                const parsed = parseProfileColor(profileColor);
                setProfileColor(parsed.solidColor);
              }
            }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition flex items-center gap-2 ${
              colorMode === "solid"
                ? "bg-[#404249] text-white shadow"
                : "text-[#949ba4] hover:text-[#dbdee1]"
            }`}
          >
            <Pipette size={14} /> Düz Renk
          </button>
          <button
            onClick={() => {
              setColorMode("gradient");
              // Gradient mode'a geçerken mevcut rengi başlangıç rengi olarak kullan
              if (!profileColor.includes("gradient")) {
                const parsed = parseProfileColor(profileColor);
                setGradStart(parsed.solidColor);
                setProfileColor(
                  `linear-gradient(${gradAngle}deg, ${parsed.solidColor} 0%, ${gradEnd} 100%)`
                );
              }
            }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition flex items-center gap-2 ${
              colorMode === "gradient"
                ? "bg-[#404249] text-white shadow"
                : "text-[#949ba4] hover:text-[#dbdee1]"
            }`}
          >
            <Zap size={14} /> Gradient
          </button>
        </div>
        {colorMode === "solid" && (
          <div className="animate-in fade-in zoom-in-95 duration-200">
            <div className="flex flex-wrap gap-3 mb-4">
              <label className="w-10 h-10 rounded-full bg-[#1e1f22] border-2 border-dashed border-[#4e5058] flex items-center justify-center cursor-pointer hover:border-white transition group relative overflow-hidden">
                <input
                  type="color"
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  onChange={(e) => setProfileColor(e.target.value)}
                />
                <Pipette
                  size={16}
                  className="text-[#949ba4] group-hover:text-white"
                />
              </label>
              {SOLID_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setProfileColor(color)}
                  className={`w-10 h-10 rounded-full transition-all duration-200 relative ${
                    profileColor === color
                      ? "ring-2 ring-white ring-offset-2 ring-offset-[#313338] scale-110"
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
          <div className="animate-in fade-in zoom-in-95 duration-200 bg-[#1e1f22] p-4 rounded-lg border border-[#2b2d31]">
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
                    className="w-10 h-10 rounded cursor-pointer bg-transparent border-0 p-0"
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
                    className="w-10 h-10 rounded cursor-pointer bg-transparent border-0 p-0"
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
                    className={`w-12 h-12 rounded-lg transition-all duration-200 relative shadow-sm ${
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
      <div className="h-[1px] bg-[#3f4147] my-6"></div>
      <div className="flex flex-col gap-2">
        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-2">
          Hesap İşlemleri
        </h4>
        <button
          onClick={handleLogout}
          className="flex items-center justify-between p-4 rounded bg-[#2b2d31] hover:bg-[#35373c] border border-[#da373c] group transition cursor-pointer text-left w-full"
        >
          <div className="flex flex-col">
            <span className="font-bold text-white group-hover:text-red-400 transition-colors">
              Çıkış Yap
            </span>
            <span className="text-xs text-gray-400">
              Oturumunu kapat ve giriş ekranına dön.
            </span>
          </div>
          <LogOut size={20} className="text-[#da373c]" />
        </button>
      </div>
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
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <h3 className="text-xl font-bold text-white mb-6">Tuş Atamaları</h3>
      {error && (
        <div className="bg-[#f04747]/10 text-[#f04747] p-3 rounded mb-4 flex items-center gap-2 text-sm border border-[#f04747]/30">
          <Info size={16} /> {error}
        </div>
      )}
      <div className="bg-[#2b2d31] rounded-lg border border-[#1f2023] overflow-hidden">
        <div className="flex bg-[#2b2d31] p-3 border-b border-[#1f2023] text-xs font-bold text-[#949ba4] uppercase">
          <div className="flex-1">Eylem</div>
          <div className="w-40 text-center">Tuş Kombinasyonu</div>
        </div>
        <KeybindRow
          label="Mikrofonu Sustur (Mute)"
          description="Kendi sesini kapatır/açar."
          shortcut={formatKeybinding(muteKeybinding)}
          isRecording={recording === "mute"}
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
        <div className="h-[1px] bg-[#1f2023] mx-4"></div>
        <KeybindRow
          label="Sağırlaştır (Deafen)"
          description="Hem mikrofonu hem hoparlörü kapatır."
          shortcut={formatKeybinding(deafenKeybinding)}
          isRecording={recording === "deafen"}
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
        <div className="h-[1px] bg-[#1f2023] mx-4"></div>
        <KeybindRow
          label="Kamerayı Aç/Kapat"
          description="Kamerayı açıp kapatır."
          shortcut={formatKeybinding(cameraKeybinding)}
          isRecording={recording === "camera"}
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
      <div className="mt-4 flex items-center gap-2 px-1">
        <Info size={14} className="text-[#949ba4]" />
        <p className="text-xs text-[#949ba4]">
          Netrex, uygulama simge durumuna küçültülmüş olsa bile bu tuşları
          algılar.
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
}) {
  return (
    <div className="flex items-center justify-between p-4 hover:bg-[#35373c] transition-colors group">
      <div className="pr-4">
        <div className="font-medium text-[#dbdee1] mb-0.5">{label}</div>
        <div className="text-xs text-[#949ba4]">{description}</div>
      </div>
      <div className="flex items-center gap-2">
        {shortcut && !isRecording && (
          <button
            onClick={onRemove}
            className="p-1.5 rounded text-[#949ba4] hover:text-[#f04747] hover:bg-[#f04747]/10 transition-colors"
            title="Tuş atamasını kaldır"
          >
            <X size={16} />
          </button>
        )}
        <button
          onClick={onClick}
          className={`w-40 py-2 rounded border text-sm font-mono transition-all relative overflow-hidden ${
            isRecording
              ? "bg-[#313338] border-[#f04747] text-[#f04747] shadow-[0_0_10px_rgba(240,71,71,0.2)]"
              : "bg-[#1e1f22] border-[#1e1f22] text-[#dbdee1] group-hover:border-[#4e5058] group-hover:bg-[#1e1f22]"
          }`}
        >
          <span className="relative z-10">
            {isRecording ? "Tuşa Basın..." : shortcut || "Atanmadı"}
          </span>
          {isRecording && (
            <div className="absolute inset-0 bg-[#f04747]/5 animate-pulse"></div>
          )}
        </button>
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
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <h3 className="text-xl font-bold text-white mb-6">Ses ve Görüntü</h3>

      {/* KAMERA AYARLARI */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold text-[#949ba4] uppercase flex items-center gap-2">
            <Camera size={14} /> Video Ayarları
          </h4>
          <span
            className={`text-[10px] px-2 py-0.5 rounded font-bold ${
              settings.enableCamera
                ? "bg-green-500/10 text-green-500"
                : "bg-red-500/10 text-red-500"
            }`}
          >
            {settings.enableCamera ? "AÇIK" : "DEVRE DIŞI"}
          </span>
        </div>

        <div className="bg-[#2b2d31] p-4 rounded-lg border border-[#1f2023]">
          {/* YENİ: KAMERA AÇ/KAPA TOGGLE */}
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-[#1f2023]">
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
                    className="w-full bg-[#1e1f22] border border-[#1e1f22] text-[#dbdee1] p-2.5 rounded hover:border-[#000] focus:border-[#000] outline-none appearance-none cursor-pointer pl-9"
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

              <div className="relative w-full aspect-video bg-[#111214] rounded-lg overflow-hidden border border-[#1e1f22] flex items-center justify-center">
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
              <div className="mt-4 pt-4 border-t border-[#1f2023]">
                <ToggleSwitch
                  label="Ayna Efekti"
                  description="Kamera görüntüsünü yatay olarak çevir (kendini aynada görür gibi)."
                  checked={settings.cameraMirrorEffect}
                  onChange={() =>
                    settings.setCameraMirrorEffect(!settings.cameraMirrorEffect)
                  }
                />
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

      <div className="h-[1px] bg-[#3f4147] my-6"></div>

      {/* SES AYARLARI (AYNI) */}
      <div className="space-y-6">
        <div>
          <label className="block text-xs font-bold text-[#b5bac1] uppercase mb-2">
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
              className="w-full bg-[#1e1f22] border border-[#1e1f22] text-[#dbdee1] p-2.5 rounded hover:border-[#000] focus:border-[#000] outline-none appearance-none cursor-pointer"
            >
              <option value="default">Varsayılan</option>
              {audioInputs.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Mikrofon ${d.deviceId.slice(0, 5)}`}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-3 pointer-events-none text-gray-400">
              <Mic size={16} />
            </div>
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-[#b5bac1] uppercase mb-2">
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
              className="w-full bg-[#1e1f22] border border-[#1e1f22] text-[#dbdee1] p-2.5 rounded hover:border-[#000] focus:border-[#000] outline-none appearance-none cursor-pointer"
            >
              <option value="default">Varsayılan</option>
              {audioOutputs.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Hoparlör ${d.deviceId.slice(0, 5)}`}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-3 pointer-events-none text-gray-400">
              <Speaker size={16} />
            </div>
          </div>
        </div>
      </div>

      {/* ... (Diğer ses ayarları aynı kalacak) ... */}
      <div className="h-[1px] bg-[#3f4147] my-6"></div>
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <label className="text-xs font-bold text-[#b5bac1] uppercase flex items-center gap-2">
            Uygulama Sesleri <Volume2 size={14} className="text-indigo-400" />
          </label>
          <span className="text-xs text-indigo-400 font-bold bg-indigo-500/10 px-2 py-0.5 rounded">
            %{localSfxVolume}
          </span>
        </div>
        <div className="relative w-full h-8 flex items-center select-none">
          <div className="absolute w-full h-2 bg-[#1e1f22] rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 transition-all duration-75"
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
            className="absolute h-4 w-4 bg-white rounded-full shadow pointer-events-none transition-all z-30"
            style={{
              left: `${localSfxVolume}%`,
              transform: "translateX(-50%)",
            }}
          ></div>
        </div>
        <p className="text-xs text-[#949ba4] mt-1">
          Giriş, çıkış, mute ve diğer bildirim seslerinin yüksekliği.
        </p>
      </div>
      <div className="h-[1px] bg-[#3f4147] my-6"></div>
      <div className="mb-6">
        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-2 flex items-center gap-2">
          Giriş Hassasiyeti (Noise Gate)
        </h4>
        <p className="text-xs text-[#949ba4] mb-4">
          Mikrofonunuz ne kadar ses algıladığında devreye girsin? Sarı bölge
          gürültüdür, yeşil bölge konuşmadır.
        </p>
        <div className="bg-[#1e1f22] p-4 rounded-lg border border-[#2b2d31]">
          <div className="h-3 w-full bg-[#313338] rounded-full overflow-hidden relative mb-4">
            <div
              className="absolute inset-0 w-full h-full"
              style={{
                background:
                  "linear-gradient(to right, #da373c 0%, #da373c 10%, #f0b232 40%, #23a559 100%)",
                opacity: 0.2,
              }}
            ></div>
            <div
              className="absolute top-0 bottom-0 w-1 bg-white z-20 shadow-[0_0_10px_rgba(255,255,255,0.8)]"
              style={{ left: `${localThreshold}%` }}
            ></div>
            <div
              className="h-full transition-all duration-75 ease-out z-10"
              style={{
                width: `${micVolume}%`,
                backgroundColor:
                  micVolume > localThreshold ? "#23a559" : "#da373c",
                boxShadow: "0 0 10px rgba(0,0,0,0.5)",
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
              className="w-full h-2 bg-[#404249] rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <span className="text-sm font-mono text-white w-8 text-right">
              {localThreshold}%
            </span>
          </div>
        </div>
      </div>

      {/* GÜRÜLTÜ AZALTMA MODU (Discord benzeri) */}
      <div className="h-[1px] bg-[#3f4147] my-6"></div>
      <div className="space-y-4">
        <div className="mb-2">
          <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-1">
            Gürültü Azaltma
          </h4>
          <p className="text-xs text-[#949ba4]">
            Mikrofonunun algıladığı arka plan seslerini bastır.
          </p>
        </div>

        {/* Radio Button Seçimi */}
        <div className="space-y-3">
          {/* Yok */}
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className="relative">
              <input
                type="radio"
                name="noiseSuppressionMode"
                value="none"
                checked={settings.noiseSuppressionMode === "none"}
                onChange={(e) =>
                  settings.setNoiseSuppressionMode(e.target.value)
                }
                className="sr-only"
              />
              <div
                className={`w-5 h-5 rounded-full border-2 transition-all duration-200 flex items-center justify-center ${
                  settings.noiseSuppressionMode === "none"
                    ? "border-indigo-500 bg-indigo-500"
                    : "border-[#80848e] group-hover:border-[#b5bac1]"
                }`}
              >
                {settings.noiseSuppressionMode === "none" && (
                  <div className="w-2.5 h-2.5 rounded-full bg-white"></div>
                )}
              </div>
            </div>
            <span className="text-sm text-[#dbdee1] font-medium">Yok</span>
          </label>

          {/* Standart */}
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className="relative">
              <input
                type="radio"
                name="noiseSuppressionMode"
                value="standard"
                checked={settings.noiseSuppressionMode === "standard"}
                onChange={(e) =>
                  settings.setNoiseSuppressionMode(e.target.value)
                }
                className="sr-only"
              />
              <div
                className={`w-5 h-5 rounded-full border-2 transition-all duration-200 flex items-center justify-center ${
                  settings.noiseSuppressionMode === "standard"
                    ? "border-indigo-500 bg-indigo-500"
                    : "border-[#80848e] group-hover:border-[#b5bac1]"
                }`}
              >
                {settings.noiseSuppressionMode === "standard" && (
                  <div className="w-2.5 h-2.5 rounded-full bg-white"></div>
                )}
              </div>
            </div>
            <span className="text-sm text-[#dbdee1] font-medium">Standart</span>
          </label>

          {/* Krisp (RNNoise) */}
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className="relative">
              <input
                type="radio"
                name="noiseSuppressionMode"
                value="krisp"
                checked={settings.noiseSuppressionMode === "krisp"}
                onChange={(e) =>
                  settings.setNoiseSuppressionMode(e.target.value)
                }
                className="sr-only"
              />
              <div
                className={`w-5 h-5 rounded-full border-2 transition-all duration-200 flex items-center justify-center ${
                  settings.noiseSuppressionMode === "krisp"
                    ? "border-indigo-500 bg-indigo-500"
                    : "border-[#80848e] group-hover:border-[#b5bac1]"
                }`}
              >
                {settings.noiseSuppressionMode === "krisp" && (
                  <div className="w-2.5 h-2.5 rounded-full bg-white"></div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#dbdee1] font-medium">Krisp</span>
              <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-indigo-500/10 text-indigo-400">
                AI
              </span>
            </div>
          </label>
        </div>
      </div>

      <div className="h-[1px] bg-[#3f4147] my-6"></div>
      <div className="space-y-4">
        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-2 flex items-center gap-2">
          Gelişmiş Ses İşleme
        </h4>
        <ToggleSwitch
          label="Yankı Engelleme"
          description="Sesinin yankılanmasını önler. Kulaklık kullanmıyorsan kesinlikle aç."
          checked={settings.echoCancellation}
          onChange={settings.toggleEchoCancellation}
        />
        <div className="h-[1px] bg-[#2b2d31]"></div>
        <ToggleSwitch
          label="Gürültü Bastırma (Noise Suppression)"
          description="Klavye sesi, fan sesi gibi arka plan gürültülerini filtreler."
          checked={settings.noiseSuppression}
          onChange={settings.toggleNoiseSuppression}
        />
        <div className="h-[1px] bg-[#2b2d31]"></div>
        <ToggleSwitch
          label="Otomatik Kazanç Kontrolü"
          description="Ses seviyeni otomatik olarak dengeler (Bağırdığında kısar, fısıldadığında açar)."
          checked={settings.autoGainControl}
          onChange={settings.toggleAutoGainControl}
        />
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
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <h3 className="text-xl font-bold text-white mb-6">Bildirim Ayarları</h3>

      <div className="bg-[#2b2d31] rounded-lg border border-[#1f2023] overflow-hidden p-4 mb-4">
        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-4">
          Genel Bildirimler
        </h4>
        <ToggleSwitch
          label="Masaüstü Bildirimleri"
          description="Yeni mesajlar ve diğer olaylar için masaüstü bildirimleri göster."
          checked={desktopNotifications}
          onChange={() => setDesktopNotifications(!desktopNotifications)}
        />
        <div className="h-[1px] bg-[#1f2023] my-3"></div>
        <ToggleSwitch
          label="Bildirim Sesi"
          description="Bildirimler geldiğinde ses çal."
          checked={notificationSound}
          onChange={() => setNotificationSound(!notificationSound)}
        />
      </div>

      <div className="bg-[#2b2d31] rounded-lg border border-[#1f2023] overflow-hidden p-4">
        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-4">
          Bildirim Olayları
        </h4>
        <ToggleSwitch
          label="Yeni Mesaj Bildirimi"
          description="Yeni mesaj geldiğinde bildirim göster."
          checked={notifyOnMessage}
          onChange={() => setNotifyOnMessage(!notifyOnMessage)}
        />
        <div className="h-[1px] bg-[#1f2023] my-3"></div>
        <ToggleSwitch
          label="Katılım Bildirimi"
          description="Birisi odaya katıldığında bildirim göster."
          checked={notifyOnJoin}
          onChange={() => setNotifyOnJoin(!notifyOnJoin)}
        />
        <div className="h-[1px] bg-[#1f2023] my-3"></div>
        <ToggleSwitch
          label="Ayrılış Bildirimi"
          description="Birisi odadan ayrıldığında bildirim göster."
          checked={notifyOnLeave}
          onChange={() => setNotifyOnLeave(!notifyOnLeave)}
        />
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
      <h3 className="text-xl font-bold text-white mb-6">Görünüm Ayarları</h3>

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
            className="w-full bg-[#1e1f22] border border-[#2b2d31] rounded px-3 py-2 text-[#dbdee1] focus:outline-none focus:border-[#5865f2]"
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

        <div className="h-[1px] bg-[#1f2023] my-3"></div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-[#dbdee1] mb-2">
            Font Boyutu
          </label>
          <select
            value={fontSize}
            onChange={(e) => setFontSize(e.target.value)}
            className="w-full bg-[#1e1f22] border border-[#2b2d31] rounded px-3 py-2 text-[#dbdee1] focus:outline-none focus:border-[#5865f2]"
          >
            {fontSizeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label} ({opt.size})
              </option>
            ))}
          </select>
          <p className="text-xs text-[#949ba4] mt-1">Metin boyutunu ayarlar.</p>
        </div>

        <div className="h-[1px] bg-[#1f2023] my-3"></div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-[#dbdee1] mb-2">
            Font Ailesi
          </label>
          <select
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
            className="w-full bg-[#1e1f22] border border-[#2b2d31] rounded px-3 py-2 text-[#dbdee1] focus:outline-none focus:border-[#5865f2]"
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
