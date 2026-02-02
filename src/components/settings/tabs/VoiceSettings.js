import { useState, useEffect, useRef, useCallback } from "react";
import { Mic, Speaker, Volume2, Camera, ShieldAlert, Video, VideoOff, Zap } from "lucide-react";
import { useRoomContext } from "@livekit/components-react";
import { useSettingsStore } from "@/src/store/settingsStore";
import { useSoundEffects } from "@/src/hooks/useSoundEffects";
import ToggleSwitch from "../ToggleSwitch";

export default function VoiceSettings() {
  let room;
  try {
    room = useRoomContext();
  } catch (e) {
    // Room context yoksa (ayarlar modal açıkken room dışındaysa) sessizce yoksay
    // Bu normal bir durum olabilir
  }

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

  // RMS değerini 0-100 arası yüzdeye dönüştür (useVoiceProcessor ile uyumlu)
  const rmsToPercentage = useCallback((rms) => {
    // useVoiceProcessor'daki CONFIG değerleri ile aynı
    const MIN_RMS = 0.002;
    const MAX_RMS = 0.12;

    // RMS değerini normalize et (0-1 arası)
    const normalized = Math.max(
      0,
      Math.min(1, (rms - MIN_RMS) / (MAX_RMS - MIN_RMS))
    );
    // Yüzdeye çevir (0-100)
    return normalized * 100;
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
        analyser.fftSize = 2048; // useVoiceProcessor ile aynı
        analyser.smoothingTimeConstant = 0.25; // useVoiceProcessor ile aynı
        audioContext.createMediaStreamSource(stream).connect(analyser);
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateMeter = () => {
          analyser.getByteTimeDomainData(dataArray);
          // RMS hesapla (useVoiceProcessor ile aynı yöntem)
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const x = (dataArray[i] - 128) / 128.0;
            sum += x * x;
          }
          const rms = Math.sqrt(sum / dataArray.length);

          // RMS'yi yüzdeye dönüştür (slider ile uyumlu)
          const percentage = rmsToPercentage(rms);
          setMicVolume(percentage);

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
  }, [settings.audioInputId, rmsToPercentage]);

  // Kamera Önizleme
  useEffect(() => {
    let stream;
    // YENİ: Eğer kamera devre dışıysa stream başlatma
    if (!settings.enableCamera) return;

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
  }, [settings.videoId, videoInputs, settings.enableCamera]); // dependency'e enableCamera ekledik

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 pb-10">
      <h3 className="text-2xl font-bold text-white mb-6 relative">
        <span className="relative z-10">Ses ve Görüntü</span>
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 opacity-0 hover:opacity-100 transition-opacity duration-300 blur-sm"></div>
      </h3>

      {/* Header Banner */}
      <div className="glass-strong rounded-2xl overflow-hidden border border-white/20 shadow-soft-lg hover:shadow-xl transition-all duration-300 mb-6 relative group/card">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 z-10 pointer-events-none"></div>
        
        <div className="h-20 w-full bg-gradient-to-r from-cyan-600 via-blue-600 to-cyan-600 relative overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.1)_0%,transparent_50%)]"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(255,255,255,0.1)_0%,transparent_50%)]"></div>
          </div>
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/30"></div>
          <div className="absolute inset-0 flex items-center px-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-lg">
                <Mic size={24} className="text-white" />
              </div>
              <div>
                <h4 className="text-white font-bold text-lg">Ses ve Görüntü</h4>
                <p className="text-white/70 text-sm">Mikrofon, hoparlör ve kamera ayarları</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KAMERA AYARLARI */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold text-[#949ba4] uppercase flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Camera size={14} className="text-purple-400" />
            </div>
            Video Ayarları
          </h4>
          <span
            className={`text-[10px] px-3 py-1 rounded-full font-bold flex items-center gap-1.5 ${
              settings.enableCamera
                ? "bg-green-500/15 text-green-400 border border-green-500/30"
                : "bg-red-500/15 text-red-400 border border-red-500/30"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${settings.enableCamera ? "bg-green-400" : "bg-red-400"}`}></span>
            {settings.enableCamera ? "AÇIK" : "DEVRE DIŞI"}
          </span>
        </div>

        <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
          {/* Hover glow */}
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>

          {/* YENİ: KAMERA AÇ/KAPA TOGGLE */}
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10 relative z-10">
            <div>
              <div className="font-bold text-sm text-white">
                Kamerayı Etkinleştir
              </div>
              <div className="text-xs text-[#949ba4]">
                Kapatırsanız uygulama içinde kamera butonu devre dışı kalır.
              </div>
            </div>
            <ToggleSwitch
              checked={settings.enableCamera}
              onChange={settings.toggleEnableCamera}
            />
          </div>

          {/* Sadece kamera etkinse göster */}
          {settings.enableCamera ? (
            <>
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
                    className="w-full bg-[#1e1f22] border border-white/10 text-white p-2.5 rounded-lg hover:border-indigo-500/50 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 outline-none appearance-none cursor-pointer pl-9 transition-all duration-300 relative z-10"
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

              <div className="relative w-full aspect-video bg-[#0a0a0c] rounded-xl overflow-hidden border-2 border-white/10 shadow-lg flex items-center justify-center relative z-10">
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

              {/* Ayna Efekti */}
              <div className="mt-4 pt-4 border-t border-white/10 relative z-10">
                <ToggleSwitch
                  label="Ayna Efekti"
                  description="Kamera görüntüsünü yatay olarak çevir (kendini aynada görür gibi)."
                  checked={settings.cameraMirrorEffect}
                  onChange={() =>
                    settings.setCameraMirrorEffect(!settings.cameraMirrorEffect)
                  }
                />
              </div>

              {/* Video Kalite Ayarları */}
              <div className="mt-4 pt-4 border-t border-white/10 relative z-10">
                <h5 className="text-xs font-bold text-[#949ba4] uppercase mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                  Video Kalitesi
                </h5>

                {/* Çözünürlük Seçimi */}
                <div className="mb-4">
                  <label className="block text-xs font-bold text-[#b5bac1] uppercase mb-2">
                    Çözünürlük
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[ 
                      { value: "240p", label: "240p", desc: "Düşük" },
                      { value: "360p", label: "360p", desc: "Normal" },
                      { value: "480p", label: "480p", desc: "Yüksek" },
                    ].map((res) => (
                      <button
                        key={res.value}
                        onClick={() => settings.setVideoResolution(res.value)}
                        onMouseDown={(e) => e.preventDefault()}
                        className={`p-3 rounded-xl border-2 transition-all duration-300 flex flex-col items-center justify-center gap-1 focus:outline-none ${
                          settings.videoResolution === res.value
                            ? "border-indigo-500 bg-indigo-500/10 text-white"
                            : "border-white/10 bg-white/5 text-[#949ba4] hover:border-white/20 hover:bg-white/10"
                        }`}
                      >
                        <span className="font-bold text-sm">{res.label}</span>
                        <span className="text-[10px] opacity-70">{res.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* FPS Seçimi */}
                <div className="mb-2">
                  <label className="block text-xs font-bold text-[#b5bac1] uppercase mb-2">
                    Kare Hızı (FPS)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 15, label: "15 FPS", desc: "Düşük" },
                      { value: 18, label: "18 FPS", desc: "Normal" },
                      { value: 24, label: "24 FPS", desc: "Sinematik" },
                    ].map((fps) => (
                      <button
                        key={fps.value}
                        onClick={() => settings.setVideoFrameRate(fps.value)}
                        onMouseDown={(e) => e.preventDefault()}
                        className={`p-3 rounded-xl border-2 transition-all duration-300 flex flex-col items-center justify-center gap-1 focus:outline-none ${
                          settings.videoFrameRate === fps.value
                            ? "border-indigo-500 bg-indigo-500/10 text-white"
                            : "border-white/10 bg-white/5 text-[#949ba4] hover:border-white/20 hover:bg-white/10"
                        }`}
                      >
                        <span className="font-bold text-sm">{fps.label}</span>
                        <span className="text-[10px] opacity-70">{fps.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-[#949ba4] mt-3 flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">⚠️</span>
                  <span>Yüksek kalite daha fazla bant genişliği kullanır. Bağlantı sorunları yaşarsanız kaliteyi düşürün.</span>
                </p>
              </div>
            </>
          ) : (
            // Kamera Devre Dışı İse Gösterilecek Mesaj
            <div className="flex flex-col items-center justify-center py-8 text-[#949ba4] opacity-70">
              <ShieldAlert size={48} className="mb-3 text-[#da373c]" />
              <p className="text-sm font-medium text-center max-w-[200px]">
                Gizlilik ayarlarından kamera erişimi kapatıldı.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-6"></div>

      {/* SES AYARLARI */}
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
                value={settings.audioInputId}
                onChange={(e) => {
                  settings.setAudioInput(e.target.value);
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
                value={settings.audioOutputId}
                onChange={(e) => {
                  settings.setAudioOutput(e.target.value);
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

      {/* UYGULAMA SESLERİ */}
      <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 mb-6 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>
        
        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-4 flex items-center gap-2 relative z-10">
          <div className="w-6 h-6 rounded-lg bg-indigo-500/20 flex items-center justify-center">
            <Volume2 size={14} className="text-indigo-400" />
          </div>
          Uygulama Sesleri
          <span className="ml-auto text-xs text-indigo-400 font-bold bg-indigo-500/10 px-2 py-0.5 rounded-lg">
            %{localSfxVolume}
          </span>
        </h4>
        
        <div className="relative z-10 bg-[#1e1f22] rounded-xl p-4 border border-white/5">
          <div className="relative w-full h-10 flex items-center select-none">
            <div className="absolute w-full h-3 bg-[#2b2d31] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-75 rounded-full"
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
              className="absolute h-5 w-5 bg-white rounded-full shadow-lg pointer-events-none transition-all z-30 border-2 border-indigo-500"
              style={{
                left: `${localSfxVolume}%`,
                transform: "translateX(-50%)",
              }}
            ></div>
          </div>
          <p className="text-xs text-[#949ba4] mt-3">
            Giriş, çıkış, mute ve diğer bildirim seslerinin yüksekliği.
          </p>
        </div>
      </div>

      {/* GİRİŞ HASSASİYETİ */}
      <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 mb-6 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>
        
        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-2 flex items-center gap-2 relative z-10">
          <div className="w-6 h-6 rounded-lg bg-green-500/20 flex items-center justify-center">
            <Zap size={14} className="text-green-400" />
          </div>
          Giriş Hassasiyeti (Noise Gate)
          <span className="ml-auto text-xs text-green-400 font-bold bg-green-500/10 px-2 py-0.5 rounded-lg">
            {localThreshold}%
          </span>
        </h4>
        <p className="text-xs text-[#949ba4] mb-4 ml-8 relative z-10">
          Mikrofonunuz ne kadar ses algıladığında devreye girsin?
        </p>
        
        <div className="relative z-10 bg-[#1e1f22] rounded-xl p-5 border border-white/5">
          <div className="h-4 w-full bg-[#2b2d31] rounded-full overflow-hidden relative mb-4 shadow-inner">
            <div
              className="absolute inset-0 w-full h-full"
              style={{
                background:
                  "linear-gradient(to right, #da373c 0%, #da373c 10%, #f0b232 40%, #23a559 100%)",
                opacity: 0.3,
              }}
            ></div>
            <div
              className="absolute top-0 bottom-0 w-1 bg-white z-20 shadow-[0_0_10px_rgba(255,255,255,0.8)] rounded-full"
              style={{ left: `${localThreshold}%` }}
            ></div>
            <div
              className="h-full transition-all duration-75 ease-out z-10 rounded-full"
              style={{
                width: `${micVolume}%`,
                backgroundColor:
                  micVolume > localThreshold ? "#23a559" : "#da373c",
                boxShadow: micVolume > localThreshold ? "0 0 10px rgba(35,165,89,0.5)" : "0 0 10px rgba(218,55,60,0.5)",
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
              className="w-full h-2 bg-[#404249] rounded-lg appearance-none cursor-pointer accent-green-500"
            />
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-[#949ba4]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded-full"></span> Gürültü</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-yellow-500 rounded-full"></span> Geçiş</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full"></span> Konuşma</span>
          </div>
        </div>
      </div>

      {/* GÜRÜLTÜ AZALTMA MODU */}
      <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 mb-6 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>
        
        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-2 flex items-center gap-2 relative z-10">
          <div className="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <Zap size={14} className="text-purple-400" />
          </div>
          Gürültü Azaltma
        </h4>
        <p className="text-xs text-[#949ba4] mb-4 ml-8 relative z-10">
          Mikrofonunun algıladığı arka plan seslerini bastır.
        </p>

        <div className="relative z-10 grid grid-cols-3 gap-2">
          {/* Yok */}
          <label className={`flex flex-col items-center justify-center p-4 rounded-xl cursor-pointer transition-all duration-300 border-2 ${
            settings.noiseSuppressionMode === "none"
              ? "bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.3)]"
              : "bg-[#1e1f22] border-white/10 hover:border-white/20 hover:bg-white/5"
          }`}>
            <input
              type="radio"
              name="noiseSuppressionMode"
              value="none"
              checked={settings.noiseSuppressionMode === "none"}
              onChange={(e) => settings.setNoiseSuppressionMode(e.target.value)}
              className="sr-only"
            />
            <div className={`w-6 h-6 rounded-full border-2 mb-2 flex items-center justify-center transition-all ${
              settings.noiseSuppressionMode === "none"
                ? "border-indigo-500 bg-indigo-500"
                : "border-[#80848e]"
            }`}>
              {settings.noiseSuppressionMode === "none" && (
                <div className="w-2.5 h-2.5 rounded-full bg-white"></div>
              )}
            </div>
            <span className="text-sm text-white font-medium">Yok</span>
            <span className="text-[10px] text-[#949ba4] mt-1">Kapalı</span>
          </label>

          {/* Standart */}
          <label className={`flex flex-col items-center justify-center p-4 rounded-xl cursor-pointer transition-all duration-300 border-2 ${
            settings.noiseSuppressionMode === "standard"
              ? "bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.3)]"
              : "bg-[#1e1f22] border-white/10 hover:border-white/20 hover:bg-white/5"
          }`}>
            <input
              type="radio"
              name="noiseSuppressionMode"
              value="standard"
              checked={settings.noiseSuppressionMode === "standard"}
              onChange={(e) => settings.setNoiseSuppressionMode(e.target.value)}
              className="sr-only"
            />
            <div className={`w-6 h-6 rounded-full border-2 mb-2 flex items-center justify-center transition-all ${
              settings.noiseSuppressionMode === "standard"
                ? "border-indigo-500 bg-indigo-500"
                : "border-[#80848e]"
            }`}>
              {settings.noiseSuppressionMode === "standard" && (
                <div className="w-2.5 h-2.5 rounded-full bg-white"></div>
              )}
            </div>
            <span className="text-sm text-white font-medium">Standart</span>
            <span className="text-[10px] text-[#949ba4] mt-1">Temel</span>
          </label>

          {/* Krisp (RNNoise) */}
          <label className={`flex flex-col items-center justify-center p-4 rounded-xl cursor-pointer transition-all duration-300 border-2 relative ${
            settings.noiseSuppressionMode === "krisp"
              ? "bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.3)]"
              : "bg-[#1e1f22] border-white/10 hover:border-white/20 hover:bg-white/5"
          }`}>
            <span className="absolute -top-1 -right-1 text-[8px] px-1.5 py-0.5 rounded font-bold bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
              AI
            </span>
            <input
              type="radio"
              name="noiseSuppressionMode"
              value="krisp"
              checked={settings.noiseSuppressionMode === "krisp"}
              onChange={(e) => settings.setNoiseSuppressionMode(e.target.value)}
              className="sr-only"
            />
            <div className={`w-6 h-6 rounded-full border-2 mb-2 flex items-center justify-center transition-all ${
              settings.noiseSuppressionMode === "krisp"
                ? "border-indigo-500 bg-indigo-500"
                : "border-[#80848e]"
            }`}>
              {settings.noiseSuppressionMode === "krisp" && (
                <div className="w-2.5 h-2.5 rounded-full bg-white"></div>
              )}
            </div>
            <span className="text-sm text-white font-medium">Krisp</span>
            <span className="text-[10px] text-[#949ba4] mt-1">Gelişmiş</span>
          </label>
        </div>
      </div>

      {/* GELİŞMİŞ SES İŞLEME */}
      <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>
        
        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-4 flex items-center gap-2 relative z-10">
          <div className="w-6 h-6 rounded-lg bg-orange-500/20 flex items-center justify-center">
            <Zap size={14} className="text-orange-400" />
          </div>
          Gelişmiş Ses İşleme
        </h4>
        
        <div className="relative z-10 space-y-1">
          <div className="bg-[#1e1f22] rounded-xl p-4 border border-white/5 hover:border-cyan-500/20 transition-colors duration-300">
            <ToggleSwitch
              label="Yankı Engelleme"
              description="Sesinin yankılanmasını önler. Kulaklık kullanmıyorsan kesinlikle aç."
              checked={settings.echoCancellation}
              onChange={settings.toggleEchoCancellation}
            />
          </div>
          <div className="bg-[#1e1f22] rounded-xl p-4 border border-white/5 hover:border-indigo-500/20 transition-colors duration-300">
            <ToggleSwitch
              label="Gürültü Bastırma (Noise Suppression)"
              description="Klavye sesi, fan sesi gibi arka plan gürültülerini filtreler."
              checked={settings.noiseSuppression}
              onChange={settings.toggleNoiseSuppression}
            />
          </div>
          <div className="bg-[#1e1f22] rounded-xl p-4 border border-white/5 hover:border-purple-500/20 transition-colors duration-300">
            <ToggleSwitch
              label="Otomatik Kazanç Kontrolü"
              description="Ses seviyeni otomatik olarak dengeler (Bağırdığında kısar, fısıldadığında açar)."
              checked={settings.autoGainControl}
              onChange={settings.toggleAutoGainControl}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
