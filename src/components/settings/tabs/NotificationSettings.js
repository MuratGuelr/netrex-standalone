import { useState, useEffect } from "react";
import { Bell, Monitor, Zap, Volume2 } from "lucide-react";
import ToggleSwitch from "../ToggleSwitch";
import { useSettingsStore } from "@/src/store/settingsStore";

export default function NotificationSettings() {
  const desktopNotifications = useSettingsStore(state => state.desktopNotifications);
  const notificationSound = useSettingsStore(state => state.notificationSound);
  const notifyOnMessage = useSettingsStore(state => state.notifyOnMessage);
  const notifyOnJoin = useSettingsStore(state => state.notifyOnJoin);
  const notifyOnLeave = useSettingsStore(state => state.notifyOnLeave);
  const setDesktopNotifications = useSettingsStore(state => state.setDesktopNotifications);
  const setNotificationSound = useSettingsStore(state => state.setNotificationSound);
  const setNotifyOnMessage = useSettingsStore(state => state.setNotifyOnMessage);
  const setNotifyOnJoin = useSettingsStore(state => state.setNotifyOnJoin);
  const setNotifyOnLeave = useSettingsStore(state => state.setNotifyOnLeave);
  const ttsEnabled = useSettingsStore(state => state.ttsEnabled);
  const setTtsEnabled = useSettingsStore(state => state.setTtsEnabled);
  const ttsVolume = useSettingsStore(state => state.ttsVolume);
  const setTtsVolume = useSettingsStore(state => state.setTtsVolume);
  const ttsVoiceURI = useSettingsStore(state => state.ttsVoiceURI);
  const setTtsVoiceURI = useSettingsStore(state => state.setTtsVoiceURI);
  const ttsOnlyUnfocused = useSettingsStore(state => state.ttsOnlyUnfocused);
  const setTtsOnlyUnfocused = useSettingsStore(state => state.setTtsOnlyUnfocused);

  const [availableVoices, setAvailableVoices] = useState([]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const fetchVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        const trVoices = voices.filter(v => v.lang.includes('tr') || v.lang.includes('TR'));
        setAvailableVoices(trVoices);
      };

      fetchVoices();
      if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = fetchVoices;
      }
    }
  }, []);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 pb-10">
      <h3 className="text-2xl font-bold text-white mb-6 relative">
        <span className="relative z-10">Bildirim Ayarları</span>
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
          <div className="bg-[#1e1f22] rounded-xl p-4 border border-white/5 hover:border-indigo-500/20 transition-colors duration-300">
            <ToggleSwitch
              label="Gelen Mesajları Sesli Oku"
              description="Yeni gelen mesajları sesli olarak otomatik okur."
              checked={ttsEnabled}
              onChange={() => {
                const newState = !ttsEnabled;
                setTtsEnabled(newState);
                if (!newState && typeof window !== 'undefined' && 'speechSynthesis' in window) {
                  window.speechSynthesis.cancel();
                }
              }}
            />
            {ttsEnabled && (
              <div className="mt-4 pt-4 border-t border-white/5 ml-12 animate-in fade-in duration-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-white/80">Ses Seviyesi</span>
                  <span className="text-sm font-bold text-indigo-500 bg-indigo-500/10 px-2 py-0.5 rounded">% {ttsVolume}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={ttsVolume}
                  onChange={(e) => setTtsVolume(Number(e.target.value))}
                  className="w-full accent-indigo-500 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer mb-6"
                />

                <div className="mb-6">
                  <ToggleSwitch
                    label="Sadece Arka Plandayken Oku"
                    description="Pencere odakta değilken (örn. oyundayken) veya arka plandayken sesi okur."
                    checked={ttsOnlyUnfocused}
                    onChange={() => setTtsOnlyUnfocused(!ttsOnlyUnfocused)}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-white/80">Tercih Edilen Ses</span>
                  <select 
                    value={ttsVoiceURI}
                    onChange={(e) => setTtsVoiceURI(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500/50 appearance-none transition-colors"
                  >
                    <option value="auto" className="bg-[#1e1f22] text-white">Otomatik (Kişilere Özel Dağıtım)</option>
                    {availableVoices.map((voice) => (
                      <option key={voice.voiceURI} value={voice.voiceURI} className="bg-[#1e1f22] text-white">
                        {voice.name} {voice.default ? '(Varsayılan)' : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-white/50 mt-1">
                    Cihazınızdaki mevcut Türkçe sentez motorları. "Otomatik" kalması, herkesi farklı bir profilde seslendirmeye çalışır.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
