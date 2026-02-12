import { Mic, Speaker } from "lucide-react";
import { useRoomContext } from "@livekit/components-react";
import { useSettingsStore } from "@/src/store/settingsStore";

export default function AudioDevicesSection({ audioInputs, audioOutputs }) {
  let room;
  try {
    room = useRoomContext();
  } catch (e) {
    // room context optional
  }

  const audioInputId = useSettingsStore(s => s.audioInputId);
  const setAudioInput = useSettingsStore(s => s.setAudioInput);
  const audioOutputId = useSettingsStore(s => s.audioOutputId);
  const setAudioOutput = useSettingsStore(s => s.setAudioOutput);

  return (
    <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 mb-6 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>
      
      <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-4 flex items-center gap-2 relative z-10">
        <div className="w-6 h-6 rounded-lg bg-cyan-500/20 flex items-center justify-center">
          <Mic size={14} className="text-cyan-400" />
        </div>
        Ses Cihazları
      </h4>
      
      <div className="relative z-10 space-y-4">
        {/* Mikrofon */}
        <div className="bg-[#1e1f22] rounded-xl p-4 border border-white/5 hover:border-cyan-500/20 transition-colors duration-300">
          <label className="block text-xs font-bold text-[#b5bac1] uppercase mb-2 flex items-center gap-2">
            <Mic size={12} className="text-cyan-400" />
            Giriş Cihazı (Mikrofon)
          </label>
          <div className="relative">
            <select
              value={audioInputId}
              onChange={(e) => {
                setAudioInput(e.target.value);
                if (room?.localParticipant)
                  room.switchActiveDevice("audioinput", e.target.value);
              }}
              className="w-full bg-[#2b2d31] border border-white/10 text-white p-3 rounded-xl hover:border-cyan-500/50 focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 outline-none appearance-none cursor-pointer transition-all duration-300 pr-10"
            >
              <option value="default">Varsayılan</option>
              {audioInputs.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Mikrofon ${d.deviceId.slice(0, 5)}`}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-cyan-400">
              <Mic size={16} />
            </div>
          </div>
        </div>
        
        {/* Hoparlör */}
        <div className="bg-[#1e1f22] rounded-xl p-4 border border-white/5 hover:border-indigo-500/20 transition-colors duration-300">
          <label className="block text-xs font-bold text-[#b5bac1] uppercase mb-2 flex items-center gap-2">
            <Speaker size={12} className="text-indigo-400" />
            Çıkış Cihazı (Hoparlör)
          </label>
          <div className="relative">
            <select
              value={audioOutputId}
              onChange={(e) => {
                setAudioOutput(e.target.value);
                if (room)
                  room.switchActiveDevice("audiooutput", e.target.value);
              }}
              className="w-full bg-[#2b2d31] border border-white/10 text-white p-3 rounded-xl hover:border-indigo-500/50 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 outline-none appearance-none cursor-pointer transition-all duration-300 pr-10"
            >
              <option value="default">Varsayılan</option>
              {audioOutputs.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Hoparlör ${d.deviceId.slice(0, 5)}`}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-indigo-400">
              <Speaker size={16} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
