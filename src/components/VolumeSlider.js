import { memo, useRef, useState, useCallback, useEffect, useMemo } from "react";
import { Volume2, Volume1, VolumeX } from "lucide-react";
import { useSettingsStore } from "@/src/store/settingsStore";

/**
 * ✅ OPTIMIZED VolumeSlider
 * - Isolated state - parent re-render'dan etkilenmez
 * - Debounced store update
 * - Memoized calculations
 */
const VolumeSlider = memo(({ participantIdentity }) => {
  const { userVolumes, setUserVolume } = useSettingsStore();
  
  const currentVol = (userVolumes && userVolumes[participantIdentity]) ?? 100;
  const [volume, setVolume] = useState(Math.min(currentVol, 200));
  
  const volumeTimeoutRef = useRef(null);
  const latestVolumeRef = useRef(volume);
  
  // Update ref on volume change
  useEffect(() => {
    latestVolumeRef.current = volume;
  }, [volume]);

  // Debounced volume change
  const handleVolumeChange = useCallback((e) => {
    const newVol = parseInt(e.target.value);
    setVolume(newVol);
    
    if (volumeTimeoutRef.current) {
      clearTimeout(volumeTimeoutRef.current);
    }
    volumeTimeoutRef.current = setTimeout(() => {
      setUserVolume(participantIdentity, newVol);
    }, 150);
  }, [participantIdentity, setUserVolume]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (volumeTimeoutRef.current) {
        clearTimeout(volumeTimeoutRef.current);
        setUserVolume(participantIdentity, latestVolumeRef.current);
      }
    };
  }, [participantIdentity, setUserVolume]);

  // Memoized icon
  const VolumeIcon = useMemo(() => {
    if (volume === 0) return <VolumeX size={18} className="text-red-400" />;
    if (volume < 50) return <Volume1 size={18} className="text-indigo-400" />;
    if (volume > 100) return <Volume2 size={18} className="text-yellow-400" />;
    return <Volume2 size={18} className="text-indigo-400" />;
  }, [volume]);

  const displayPercent = useMemo(() => Math.min((volume / 200) * 100, 100), [volume]);

  return (
    <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.04]">
      <div className="flex justify-between items-center mb-3">
        <span className="text-[10px] font-semibold text-[#5c5e66] uppercase tracking-wider">
          Kullanıcı Sesi
        </span>
        <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md ${
          volume === 0 ? "text-red-400 bg-red-500/10" :
          volume > 100 ? "text-yellow-400 bg-yellow-500/10" :
          "text-indigo-400 bg-indigo-500/10"
        }`}>
          {volume}%
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="shrink-0 opacity-60">
          {VolumeIcon}
        </div>
        <div className="relative flex-1 h-6 flex items-center w-full group">
          <div className="absolute w-full h-1.5 bg-[#1a1b1e] rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-150 rounded-full ${
                volume === 0 ? "bg-red-500/60" :
                volume > 100 ? "bg-gradient-to-r from-indigo-500 via-purple-500 to-yellow-500" :
                "bg-gradient-to-r from-indigo-500 to-purple-500"
              }`}
              style={{ width: `${displayPercent}%` }}
            ></div>
          </div>

          <input
            type="range"
            min="0"
            max="200"
            value={volume}
            onChange={handleVolumeChange}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full absolute z-20 opacity-0 cursor-pointer h-full m-0 p-0"
            title="Ses Seviyesi (0-200%)"
          />

          <div
            className={`absolute h-3.5 w-3.5 rounded-full shadow-lg pointer-events-none z-10 transition-all ${
              volume === 0 ? "bg-red-400 ring-2 ring-red-500/50" :
              volume > 100 ? "bg-yellow-400 ring-2 ring-yellow-500/50" :
              "bg-white ring-2 ring-indigo-500/50"
            }`}
            style={{ left: `${displayPercent}%`, transform: "translateX(-50%)" }}
          ></div>
        </div>
      </div>
      
      {volume > 100 && (
        <div className="mt-2 text-[10px] text-yellow-400/70 text-center flex items-center justify-center gap-1">
          <span>⚠️</span>
          <span>100%'den yüksek ses seviyesi</span>
        </div>
      )}
    </div>
  );
});

VolumeSlider.displayName = 'VolumeSlider';

export default VolumeSlider;
