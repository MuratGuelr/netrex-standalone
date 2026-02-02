import { Bell, Monitor, Zap } from "lucide-react";
import ToggleSwitch from "../ToggleSwitch";
import { useSettingsStore } from "@/src/store/settingsStore";

export default function NotificationSettings() {
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
