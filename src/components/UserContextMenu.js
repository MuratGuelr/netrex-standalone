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
  const [volume, setVolume] = useState(currentVol);
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
    if (volume === 0) return <VolumeX size={16} className="text-red-500" />;
    if (volume < 50) return <Volume1 size={16} className="text-[#b5bac1]" />;
    return <Volume2 size={16} className="text-[#b5bac1]" />;
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] w-64 bg-[#111214] border border-[#1e1f22] rounded-lg shadow-xl p-3 flex flex-col gap-2 select-none"
      style={{ top: coords.top, left: coords.left }}
      onContextMenu={(e) => e.preventDefault()}
      // ÇÖZÜM BURADA:
      // Menü içine yapılan tıklamaların yukarı (window) tırmanmasını engelliyoruz.
      // Böylece window listener tetiklenmiyor ve menü kapanmıyor.
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Başlık */}
      <div className="flex items-center gap-2 px-2 pb-2 border-b border-[#1f2023] mb-1">
        <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
          {participant.identity?.charAt(0).toUpperCase()}
        </div>
        <span className="text-sm font-bold text-white truncate">
          {participant.identity}
        </span>
      </div>

      {/* Ses Slider */}
      {!isLocal ? (
        <div className="px-2 py-1">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-[#b5bac1] uppercase">
              Kullanıcı Sesi
            </span>
            <span className="text-xs font-mono text-indigo-400">{volume}%</span>
          </div>

          <div className="flex items-center gap-3">
            {getIcon()}
            <div className="relative flex-1 h-6 flex items-center w-full group">
              {/* Arka Plan Bar */}
              <div className="absolute w-full h-1.5 bg-[#2b2d31] rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 transition-all duration-75"
                  style={{ width: `${volume}%` }}
                ></div>
              </div>

              {/* Input - Z-Index ve Pointer Events ayarları kritik */}
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={handleVolumeChange}
                // Input'a da stopPropagation ekledik garanti olsun diye
                onMouseDown={(e) => e.stopPropagation()}
                className="w-full absolute z-20 opacity-0 cursor-pointer h-full m-0 p-0"
                title="Ses Seviyesi"
              />

              {/* Thumb (Görsel Tutamaç) */}
              <div
                className="absolute h-3.5 w-3.5 bg-white rounded-full shadow pointer-events-none z-10"
                style={{ left: `${volume}%`, transform: "translateX(-50%)" }}
              ></div>
            </div>
          </div>
        </div>
      ) : (
        <div className="px-2 py-2 text-xs text-[#949ba4] italic text-center">
          Kendi sesini buradan ayarlayamazsın.
        </div>
      )}
    </div>
  );
}
