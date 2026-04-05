import { AppWindow, Monitor, Zap, ChevronRight, Film } from "lucide-react";
import ToggleSwitch from "../ToggleSwitch";
import { useSettingsStore } from "@/src/store/settingsStore";

export default function ApplicationSettings() {
  const closeToTray = useSettingsStore(state => state.closeToTray);
  const setCloseToTray = useSettingsStore(state => state.setCloseToTray);
  const checkUpdatesOnStartup = useSettingsStore(state => state.checkUpdatesOnStartup);
  const setCheckUpdatesOnStartup = useSettingsStore(state => state.setCheckUpdatesOnStartup);
  const watchPartyEnabled = useSettingsStore(state => state.watchPartyEnabled);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 pb-10">
      <h3 className="text-2xl font-bold text-white mb-6 relative">
        <span className="relative z-10">Uygulama Ayarları</span>
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

      {/* İzleme Partisi (Watch Party) */}
      <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 mb-4 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-teal-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>

        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-4 flex items-center gap-2 relative z-10">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center">
            <Film size={14} className="text-emerald-400" />
          </div>
          İzleme Partisi (Watch Party)
        </h4>

        <div className="relative z-10 bg-[#1e1f22] rounded-xl p-4 border border-white/5 hover:border-emerald-500/20 transition-colors duration-300 space-y-4">
          <ToggleSwitch
            label="Watch Party Özelliğini Etkinleştir"
            description="Bu ayar açıkken ses odalarında Watch Party simgesini görebilir ve diğer katılımcılarla birlikte senkronize olarak YouTube videoları izleyebilirsiniz."
            checked={watchPartyEnabled}
            onChange={() => useSettingsStore.getState().toggleWatchPartyEnabled()}
          />
          
          {watchPartyEnabled && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-4">
              <div className="h-px bg-white/5 my-2"></div>

              {/* Video Modu Dropdown */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                 <div className="flex flex-col flex-1 pl-1">
                    <span className="font-semibold text-white/90">Video Modu</span>
                    <span className="text-xs text-[#949ba4] mt-1 leading-snug">
                      Watch Party başladığında videonun nerede gösterileceğini seçin.
                    </span>
                 </div>
                 <div className="sm:w-[220px]">
                    <select
                      value={useSettingsStore.getState().wpVideoMode}
                      onChange={(e) => useSettingsStore.getState().setWpVideoMode(e.target.value)}
                      className="w-full bg-[#111214] border border-white/10 text-white p-2.5 rounded-xl text-sm font-medium hover:border-emerald-500/50 focus:border-emerald-500/50 outline-none appearance-none cursor-pointer transition-all duration-300"
                    >
                      <option value="player">Ana Ekran (Player)</option>
                      <option value="mini">Mini (Sağ Altta İkon)</option>
                    </select>
                 </div>
              </div>

              {/* Kalite Dropdown */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                 <div className="flex pl-1">
                    <span className="font-semibold text-xs uppercase text-[#949ba4]">YouTube Kalitesi</span>
                 </div>
                 <div className="sm:w-[220px]">
                    <select
                      value={useSettingsStore.getState().wpVideoQuality}
                      onChange={(e) => useSettingsStore.getState().setWpVideoQuality(e.target.value)}
                      className="w-full bg-[#111214] border border-white/10 text-white p-2.5 rounded-xl text-sm hover:border-emerald-500/50 focus:border-emerald-500/50 outline-none appearance-none cursor-pointer transition-all duration-300"
                    >
                      <option value="auto">Otomatik (Önerilen)</option>
                      <option value="hd1080">Maksimum (1080p/4K)</option>
                      <option value="hd720">720p Yüksek</option>
                      <option value="large">480p Orta</option>
                      <option value="medium">360p Düşük</option>
                      <option value="small">240p Çok Düşük</option>
                    </select>
                 </div>
              </div>

              {/* Varsayılan Ses Slider */}
              <div className="pl-1 pt-2">
                <div className="flex justify-between items-end mb-2">
                  <div>
                    <span className="font-semibold text-white/90">Açılış Sesi Düzeyi</span>
                    <span className="text-xs text-[#949ba4] block mt-1">Watch party başladığında videonun otomatik ses seviyesi</span>
                  </div>
                  <span className="font-bold text-emerald-400">%{useSettingsStore.getState().wpDefaultVolume}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={useSettingsStore.getState().wpDefaultVolume}
                  onChange={(e) => useSettingsStore.getState().setWpDefaultVolume(parseInt(e.target.value))}
                  className="w-full h-2 bg-black/40 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>

              <div className="h-px bg-white/5 my-2"></div>

              <ToggleSwitch
                label="Otomatik Katıl"
                description="Biri odada Watch Party başlattığında otomatik olarak player ekranına geçiş yap."
                checked={useSettingsStore.getState().wpAutoJoin}
                onChange={() => useSettingsStore.getState().setWpAutoJoin(!useSettingsStore.getState().wpAutoJoin)}
              />

              <ToggleSwitch
                label="Katılınca Mikrofonu Sustur"
                description="Watch Party başlattığında veya başladığında mikrafonunu otomatik kapatır."
                checked={useSettingsStore.getState().wpAutoMute}
                onChange={() => useSettingsStore.getState().setWpAutoMute(!useSettingsStore.getState().wpAutoMute)}
              />
            </div>
          )}
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
                  detail: { status: "available", progress: 0, info: { version: "5.2.0" } },
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
