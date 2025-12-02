import { useEffect, useRef, useState } from "react";
import { Volume2, Volume1, VolumeX } from "lucide-react";
import { useSettingsStore } from "@/src/store/settingsStore";

export default function UserContextMenu({
  x,
  y,
  participant,
  onClose,
  isLocal,
}) {
  const menuRef = useRef(null);
  const { userVolumes, setUserVolume } = useSettingsStore();

  const currentVol = (userVolumes && userVolumes[participant.identity]) ?? 100;
  // Clamp to 200 max if stored value is higher
  const [volume, setVolume] = useState(Math.min(currentVol, 200));
  const [coords, setCoords] = useState({ top: y, left: x });

  useEffect(() => {
    let newLeft = x;
    let newTop = y;

    if (x + 260 > window.innerWidth) {
      newLeft = x - 260;
    }

    if (y + 150 > window.innerHeight) {
      newTop = y - 150;
    }

    setCoords({ top: newTop, left: newLeft });
  }, [x, y]);

  // Dışarı tıklayınca kapatma mantığı
  useEffect(() => {
    const handleClick = (e) => {
      // Eğer tıklanan yer menünün içindeyse (contains) kapatma
      // Ama asıl korumayı aşağıda onMouseDown içinde yapıyoruz.
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };

    // 'mousedown' kullanıyoruz çünkü 'click' bazen sürükleme işlemlerinde geç tetiklenir
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const handleVolumeChange = (e) => {
    const newVol = parseInt(e.target.value);
    setVolume(newVol);
    setUserVolume(participant.identity, newVol);
  };

  const getIcon = () => {
    if (volume === 0) return <VolumeX size={18} className="text-red-400" />;
    if (volume < 50) return <Volume1 size={18} className="text-indigo-400" />;
    if (volume > 100) return <Volume2 size={18} className="text-yellow-400" />;
    return <Volume2 size={18} className="text-indigo-400" />;
  };

  // Calculate percentage for display (0-200 range)
  const displayPercent = Math.min((volume / 200) * 100, 100);

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] w-72 glass-strong border border-white/10 rounded-2xl shadow-soft-lg p-4 flex flex-col gap-3 select-none animate-scaleIn origin-top-left"
      style={{ top: coords.top, left: coords.left }}
      onContextMenu={(e) => e.preventDefault()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Başlık */}
      <div className="flex items-center gap-3 px-2 pb-3 border-b border-white/10 mb-1">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full blur-sm opacity-60"></div>
          <div className="relative w-8 h-8 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-xs font-extrabold text-white shrink-0 shadow-glow">
            {participant.identity?.charAt(0).toUpperCase()}
          </div>
        </div>
        <span className="text-sm font-bold text-white truncate">
          {participant.identity}
        </span>
      </div>

      {/* Ses Slider */}
      {!isLocal ? (
        <div className="px-2 py-2">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold text-[#b5bac1] uppercase tracking-wider">
              Kullanıcı Sesi
            </span>
            <span className={`text-sm font-mono font-bold ${
              volume === 0 ? "text-red-400" :
              volume > 100 ? "text-yellow-400" :
              "text-indigo-400"
            }`}>
              {volume}%
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="shrink-0">
              {getIcon()}
            </div>
            <div className="relative flex-1 h-7 flex items-center w-full group">
              {/* Arka Plan Bar */}
              <div className="absolute w-full h-2 bg-[#2b2d31] rounded-full overflow-hidden border border-white/5">
                <div
                  className={`h-full transition-all duration-150 rounded-full ${
                    volume === 0 ? "bg-red-500/50" :
                    volume > 100 ? "bg-gradient-to-r from-indigo-500 via-purple-500 to-yellow-500" :
                    "bg-gradient-to-r from-indigo-500 to-purple-500"
                  }`}
                  style={{ width: `${displayPercent}%` }}
                ></div>
              </div>

              {/* Input */}
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

              {/* Thumb (Görsel Tutamaç) */}
              <div
                className={`absolute h-4 w-4 rounded-full shadow-lg pointer-events-none z-10 transition-all ${
                  volume === 0 ? "bg-red-400 border-2 border-red-500" :
                  volume > 100 ? "bg-yellow-400 border-2 border-yellow-500" :
                  "bg-white border-2 border-indigo-400"
                }`}
                style={{ left: `${displayPercent}%`, transform: "translateX(-50%)" }}
              ></div>
            </div>
          </div>
          {volume > 100 && (
            <div className="mt-2 text-[10px] text-yellow-400/80 text-center">
              ⚠️ 100%'den yüksek ses seviyesi
            </div>
          )}
        </div>
      ) : (
        <div className="px-2 py-2 text-xs text-[#949ba4] italic text-center glass border border-white/5 rounded-xl">
          Kendi sesini buradan ayarlayamazsın.
        </div>
      )}
    </div>
  );
}
