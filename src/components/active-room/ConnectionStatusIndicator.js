
import { useEffect, useState } from "react";
import { useRoomContext, useLocalParticipant } from "@livekit/components-react";
import { ConnectionQuality, RoomEvent } from "livekit-client";

// Bağlantı Durumu Göstergesi (Kalite)
export default function ConnectionStatusIndicator() {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const [connectionQuality, setConnectionQuality] = useState(
    localParticipant?.connectionQuality || ConnectionQuality.Unknown
  );

  // Connection quality güncellemeleri
  useEffect(() => {
    if (!room || !localParticipant) return;

    // 🚀 v5.3: Bağlanınca direkt 'Excellent' varsay (UX için), 
    // LiveKit gerçek veriyi gönderene kadar "Bilinmiyor" demesin.
    const initialQuality = localParticipant.connectionQuality !== ConnectionQuality.Unknown 
      ? localParticipant.connectionQuality 
      : ConnectionQuality.Excellent;
    
    setConnectionQuality(initialQuality);

    // Connection quality değişikliklerini dinle
    const handleConnectionQualityChanged = (quality, participant) => {
      if (participant.isLocal) {
        setConnectionQuality(quality);
      }
    }

    room.on(RoomEvent.ConnectionQualityChanged, handleConnectionQualityChanged);

    return () => {
      room.off(
        RoomEvent.ConnectionQualityChanged,
        handleConnectionQualityChanged
      );
    };
  }, [room, localParticipant]);

  // Kalite rengi ve metni
  const getQualityInfo = (quality) => {
    switch (quality) {
      case ConnectionQuality.Excellent:
        return { color: "#23a559", label: "Mükemmel", bars: 4 };
      case ConnectionQuality.Good:
        return { color: "#23a559", label: "İyi", bars: 3 };
      case ConnectionQuality.Poor:
        return { color: "#f0b232", label: "Zayıf", bars: 2 };
      case ConnectionQuality.Lost:
        return { color: "#da373c", label: "Kesildi", bars: 1 };
      default:
        return { color: "#80848e", label: "Bilinmiyor", bars: 0 };
    }
  };

  const qualityInfo = getQualityInfo(connectionQuality);

  // Room veya localParticipant yoksa hiçbir şey gösterme
  if (!room || !localParticipant) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 cursor-help group relative">
      {/* Bağlantı durumu container */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/5 group-hover:border-white/10 transition-all duration-300">
        {/* Bağlantı Kalitesi Çubukları */}
        <div className="flex items-end gap-[2px] h-3">
          {[1, 2, 3, 4].map((bar) => (
            <div
              key={bar}
              className={`w-[3px] rounded-sm transition-all duration-300 ${
                bar <= qualityInfo.bars ? "" : "bg-[#2b2d31]"
              }`}
              style={{
                height: `${bar * 3}px`,
                backgroundColor:
                  bar <= qualityInfo.bars ? qualityInfo.color : undefined,
                boxShadow:
                  bar <= qualityInfo.bars
                    ? `0 0 4px ${qualityInfo.color}50`
                    : undefined,
              }}
            />
          ))}
        </div>

        {/* Kalite Metni */}
        <span
          className="text-[11px] font-semibold tracking-wide"
          style={{ color: qualityInfo.color }}
        >
          {qualityInfo.label}
        </span>
      </div>

      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-4 py-2.5 bg-[#0d0e10] border border-white/10 rounded-xl shadow-2xl text-xs text-[#dbdee1] opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-300 whitespace-nowrap z-50 backdrop-blur-xl">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-6">
            <span className="text-[#949ba4] font-medium">
              Bağlantı Kalitesi
            </span>
            <span className="font-bold" style={{ color: qualityInfo.color }}>
              {qualityInfo.label}
            </span>
          </div>
        </div>
        {/* Arrow */}
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
          <div className="w-2 h-2 bg-[#0d0e10] border-r border-b border-white/10 rotate-45"></div>
        </div>
      </div>
    </div>
  );
}
