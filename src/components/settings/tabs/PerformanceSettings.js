import { Cpu, Palette, Zap } from "lucide-react";
import ToggleSwitch from "../ToggleSwitch";
import { useSettingsStore } from "@/src/store/settingsStore";

export default function PerformanceSettings() {
  const {
    hardwareAcceleration,
    setHardwareAcceleration,
    graphicsQuality,
    setGraphicsQuality,
    disableAnimations,
    toggleDisableAnimations,
    disableBackgroundEffects,
    toggleDisableBackgroundEffects,
    videoCodec,
    setVideoCodec
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

      {/* Görsel Kalite Presetleri */}
      <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 mb-4 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
        <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-emerald-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>

        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-4 flex items-center gap-2 relative z-10">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center">
            <Palette size={14} className="text-emerald-400" />
          </div>
          Görsel Kalite Modu
        </h4>
        <div className="relative z-10 space-y-3">
          <p className="text-sm text-[#949ba4] leading-relaxed mb-4">
            Bilgisayarınızın performansına göre bir mod seçin veya ayarları aşağıdan manuel olarak özelleştirin.
          </p>
          
          <div className="grid grid-cols-3 gap-2">
            {/* Yüksek */}
            <button
              onClick={() => setGraphicsQuality("high")}
              className={`relative overflow-hidden rounded-xl p-3 border transition-all duration-300 text-left group/opt focus:outline-none flex flex-col justify-between ${
                graphicsQuality === "high"
                  ? "bg-green-500/10 border-green-500/50"
                  : "bg-[#1e1f22] border-white/5 hover:border-white/20 hover:bg-[#2b2d31]"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`font-bold text-sm ${graphicsQuality === "high" ? "text-green-400" : "text-white"}`}>Yüksek</span>
                {graphicsQuality === "high" && <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse"></div>}
              </div>
              <div className="text-[10px] text-[#949ba4] group-hover/opt:text-[#b5bac1] leading-tight">
                Her şey açık. Tam görsel deneyim.
              </div>
            </button>

            {/* Performans (Düşük) */}
            <button
              onClick={() => setGraphicsQuality("low")}
              className={`relative overflow-hidden rounded-xl p-3 border transition-all duration-300 text-left group/opt focus:outline-none flex flex-col justify-between ${
                graphicsQuality === "low"
                  ? "bg-yellow-500/10 border-yellow-500/50"
                  : "bg-[#1e1f22] border-white/5 hover:border-white/20 hover:bg-[#2b2d31]"
              }`}
            >
               <div className="flex items-center justify-between mb-1">
                <span className={`font-bold text-sm ${graphicsQuality === "low" ? "text-yellow-400" : "text-white"}`}>Performans</span>
                {graphicsQuality === "low" && <div className="w-2 h-2 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)] animate-pulse"></div>}
              </div>
              <div className="text-[10px] text-[#949ba4] group-hover/opt:text-[#b5bac1] leading-tight">
                Blur efektleri kapalı. Denge modu.
              </div>
            </button>

            {/* Patates */}
            <button
              onClick={() => setGraphicsQuality("potato")}
              className={`relative overflow-hidden rounded-xl p-3 border transition-all duration-300 text-left group/opt focus:outline-none flex flex-col justify-between ${
                graphicsQuality === "potato"
                  ? "bg-red-500/10 border-red-500/50"
                  : "bg-[#1e1f22] border-white/5 hover:border-white/20 hover:bg-[#2b2d31]"
              }`}
            >
               <div className="flex items-center justify-between mb-1">
                <span className={`font-bold text-sm ${graphicsQuality === "potato" ? "text-red-400" : "text-white"}`}>Patates</span>
                {graphicsQuality === "potato" && <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse"></div>}
              </div>
              <div className="text-[10px] text-[#949ba4] group-hover/opt:text-[#b5bac1] leading-tight">
                Minimum kaynak. Animasyonlar kapalı.
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Detaylı Performans Ayarları */}
      <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 mb-4 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
        <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-emerald-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>

        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-4 flex items-center gap-2 relative z-10">
          <div className="w-6 h-6 rounded-lg bg-green-500/20 flex items-center justify-center">
            <Zap size={14} className="text-green-400" />
          </div>
          Manuel Optimizasyon
        </h4>
        <div className="relative z-10 bg-[#1e1f22] rounded-xl p-4 border border-white/5 hover:border-green-500/20 transition-colors duration-300 space-y-4">
          <ToggleSwitch
            label="Donanım Hızlandırma"
            description="Mümkün olan yerlerde GPU kullanır. Kapatırsanız tüm yük işlemciye (CPU) biner."
            checked={hardwareAcceleration}
            onChange={() => setHardwareAcceleration(!hardwareAcceleration)}
          />

          <div className="h-px bg-white/5 my-2"></div>

          <ToggleSwitch
            label="Animasyonları Kapat"
            description="Geçiş efektlerini ve animasyonları kapatarak CPU kullanımını düşürür."
            checked={disableAnimations}
            onChange={toggleDisableAnimations}
          />
          
          <ToggleSwitch
            label="Arka Plan Efektlerini Kapat"
            description="Hareketli arka plan ışıklarını (orbs) kapatarak GPU kullanımını düşürür."
            checked={disableBackgroundEffects}
            onChange={toggleDisableBackgroundEffects}
          />
        </div>
      </div>

       {/* Video Codec Ayarları */}
       <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 mb-4 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-cyan-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>

        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-4 flex items-center gap-2 relative z-10">
          <div className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <Cpu size={14} className="text-blue-400" />
          </div>
          Video Kodlama (Codec)
        </h4>

        <div className="relative z-10 bg-[#1e1f22] rounded-xl p-4 border border-white/5 hover:border-blue-500/20 transition-colors duration-300">
           <div className="mb-3">
              <label className="block text-xs font-bold text-[#b5bac1] uppercase mb-2">
                Tercih Edilen Codec
              </label>
              <select
                value={videoCodec}
                onChange={(e) => setVideoCodec(e.target.value)}
                className="w-full bg-[#2b2d31] border border-white/10 text-white p-3 rounded-xl hover:border-blue-500/50 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 outline-none appearance-none cursor-pointer transition-all duration-300"
              >
                <option value="vp8">VP8 (Varsayılan - En Uyumlu)</option>
                <option value="h264">H.264 (Donanım Hızlandırma)</option>
                <option value="av1">AV1 (Yeni Nesil - Yüksek Sıkıştırma)</option>
              </select>
           </div>
        </div>
      </div>

    </div>
  );
}
