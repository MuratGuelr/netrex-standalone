import { useState, useEffect, useRef } from "react";
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
} from "lucide-react";
import { useSettingsStore } from "@/src/store/settingsStore";
import { useAuthStore } from "@/src/store/authStore";
import { getKeyLabel, isModifierKey, getMouseLabel } from "@/src/utils/keyMap";
import { useSoundEffects } from "@/src/hooks/useSoundEffects";

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
    <div className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#313338] w-[850px] h-[650px] rounded-lg shadow-2xl flex overflow-hidden border border-[#1e1f22]">
        <div className="w-60 bg-[#2b2d31] p-3 flex flex-col gap-1 border-r border-[#1f2023]">
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
          <div className="h-[1px] bg-[#1f2023] mx-2 my-2"></div>
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
          <div className="mt-auto px-2 pb-2">
            <div className="text-[10px] text-[#5e626a] text-center">
              Netrex v1.0.0
            </div>
          </div>
        </div>
        <div className="flex-1 bg-[#313338] relative flex flex-col min-w-0">
          <div
            className="absolute top-4 right-4 z-10 flex flex-col items-center group cursor-pointer"
            onClick={onClose}
          >
            <div className="w-9 h-9 rounded-full border-2 border-[#949ba4] flex items-center justify-center text-[#949ba4] group-hover:bg-[#dadce0] group-hover:text-[#313338] transition-colors">
              <X size={20} strokeWidth={2.5} />
            </div>
            <span className="text-[10px] font-bold text-[#949ba4] mt-1 group-hover:text-[#dbdee1]">
              ESC
            </span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-10 pr-16">
            {activeTab === "account" && <AccountSettings onClose={onClose} />}
            {activeTab === "application" && <ApplicationSettings />}
            {activeTab === "voice" && <VoiceSettings />}
            {activeTab === "keybinds" && <KeybindSettings />}
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarItem({ label, icon, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-1.5 rounded-[4px] text-[15px] font-medium transition-all w-full text-left mb-0.5 ${
        active
          ? "bg-[#404249] text-white"
          : "text-[#b5bac1] hover:bg-[#35373c] hover:text-[#dbdee1]"
      }`}
    >
      {icon} {label}
    </button>
  );
}

// --- DÜZELTİLEN TOGGLE SWITCH ---
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

// ... (ApplicationSettings, AccountSettings, KeybindSettings AYNI KALSIN) ...
function ApplicationSettings() {
  const { closeToTray, setCloseToTray } = useSettingsStore();
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <h3 className="text-xl font-bold text-white mb-6">Uygulama Ayarları</h3>
      <div className="bg-[#2b2d31] rounded-lg border border-[#1f2023] overflow-hidden p-4">
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
    </div>
  );
}

function AccountSettings({ onClose }) {
  const { user, logout } = useAuthStore();
  const { profileColor, setProfileColor } = useSettingsStore();
  const [colorMode, setColorMode] = useState(
    profileColor.includes("gradient") ? "gradient" : "solid"
  );
  const [gradStart, setGradStart] = useState("#6366f1");
  const [gradEnd, setGradEnd] = useState("#a855f7");
  const [gradAngle, setGradAngle] = useState(135);
  useEffect(() => {
    if (colorMode === "gradient")
      setProfileColor(
        `linear-gradient(${gradAngle}deg, ${gradStart} 0%, ${gradEnd} 100%)`
      );
  }, [gradStart, gradEnd, gradAngle, colorMode]);
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
            onClick={() => setColorMode("solid")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition flex items-center gap-2 ${
              colorMode === "solid"
                ? "bg-[#404249] text-white shadow"
                : "text-[#949ba4] hover:text-[#dbdee1]"
            }`}
          >
            <Pipette size={14} /> Düz Renk
          </button>
          <button
            onClick={() => setColorMode("gradient")}
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

function VoiceSettings() {
  let room;
  try {
    room = useRoomContext();
  } catch (e) {}

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
        analyser.fftSize = 2048;
        audioContext.createMediaStreamSource(stream).connect(analyser);
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateMeter = () => {
          analyser.getByteTimeDomainData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const x = (dataArray[i] - 128) / 128.0;
            sum += x * x;
          }
          setMicVolume(Math.min(100, Math.sqrt(sum / dataArray.length) * 400));
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
  }, [settings.audioInputId]);

  useEffect(() => {
    let stream;
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
  }, [settings.videoId, videoInputs]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <h3 className="text-xl font-bold text-white mb-6">Ses ve Görüntü</h3>
      <div className="mb-6">
        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-3 flex items-center gap-2">
          <Camera size={14} /> Video Ayarları
        </h4>
        <div className="bg-[#2b2d31] p-4 rounded-lg border border-[#1f2023]">
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
        </div>
      </div>
      <div className="h-[1px] bg-[#3f4147] my-6"></div>
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
      <div className="h-[1px] bg-[#3f4147] my-6"></div>
      <div className="space-y-4">
        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-2 flex items-center gap-2">
          Gelişmiş Ses İşleme
        </h4>
        <ToggleSwitch
          label="Yankı Engelleme"
          description="Sesinin yankılanmasını önler."
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
          description="Ses seviyeni otomatik olarak dengeler."
          checked={settings.autoGainControl}
          onChange={settings.toggleAutoGainControl}
        />
      </div>
    </div>
  );
}

function KeybindSettings() {
  const [recording, setRecording] = useState(null);
  const [muteKeybinding, setMuteKeybinding] = useState(null);
  const [deafenKeybinding, setDeafenKeybinding] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (window.netrex) {
      window.netrex.getHotkey("mute").then((k) => setMuteKeybinding(k || null));
      window.netrex
        .getHotkey("deafen")
        .then((k) => setDeafenKeybinding(k || null));
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

function KeybindRow({ label, description, shortcut, isRecording, onClick }) {
  return (
    <div className="flex items-center justify-between p-4 hover:bg-[#35373c] transition-colors group">
      <div className="pr-4">
        <div className="font-medium text-[#dbdee1] mb-0.5">{label}</div>
        <div className="text-xs text-[#949ba4]">{description}</div>
      </div>
      <button
        onClick={onClick}
        className={`w-40 py-2 rounded border text-sm font-mono transition-all relative overflow-hidden ${
          isRecording
            ? "bg-[#313338] border-[#f04747] text-[#f04747] shadow-[0_0_10px_rgba(240,71,71,0.2)]"
            : "bg-[#1e1f22] border-[#1e1f22] text-[#dbdee1] group-hover:border-[#4e5058] group-hover:bg-[#1e1f22]"
        }`}
      >
        <span className="relative z-10">
          {isRecording ? "Tuşa Basın..." : shortcut}
        </span>
        {isRecording && (
          <div className="absolute inset-0 bg-[#f04747]/5 animate-pulse"></div>
        )}
      </button>
    </div>
  );
}
