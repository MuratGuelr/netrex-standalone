import { useState, useEffect, useMemo } from "react";
import {
  Monitor,
  X,
  Zap,
  Layers,
  AppWindow,
  Check,
  ChevronRight,
  Settings2,
  Rocket,
  Volume2,
  VolumeX,
} from "lucide-react";

export default function ScreenShareModal({ isOpen, onClose, onStart }) {
  const [step, setStep] = useState(1); // 1: Kaynak Seçimi, 2: Kalite Ayarı
  const [activeTab, setActiveTab] = useState("apps"); // 'apps' | 'screens'
  const [sources, setSources] = useState([]);
  const [selectedSourceId, setSelectedSourceId] = useState(null);

  // Varsayılan Ayarlar (Optimize edilmiş - daha düşük kaynak kullanımı)
  const [resolution, setResolution] = useState(720); // 720p varsayılan (480p'ye düşürülebilir)
  const [fps, setFps] = useState(15); // 15fps varsayılan (30fps'den daha tasarruflu)

  // YENİ: Ses Paylaşım Ayarı
  const [withAudio, setWithAudio] = useState(true);
  const [audioMode, setAudioMode] = useState("system"); // "system" | "app" - Ekran için sistem, uygulama için uygulama

  // Modal açıldığında kaynakları yükle
  useEffect(() => {
    if (isOpen && window.netrex) {
      setStep(1);
      setSources([]);
      setSelectedSourceId(null);
      // Varsayılan olarak ses açık başlasın
      setWithAudio(true);
      setAudioMode("system");

      window.netrex.getDesktopSources().then((srcs) => {
        setSources(srcs);
        const hasWindows = srcs.some((s) => s.id.startsWith("window"));
        setActiveTab(hasWindows ? "apps" : "screens");
      });
    }
  }, [isOpen]);

  const categorizedSources = useMemo(() => {
    return {
      screens: sources.filter((s) => s.id.startsWith("screen")),
      apps: sources.filter((s) => s.id.startsWith("window")),
    };
  }, [sources]);

  const selectedSourceData = useMemo(
    () => sources.find((s) => s.id === selectedSourceId),
    [sources, selectedSourceId]
  );

  useEffect(() => {
    if (resolution === 1080) setFps(5);
    else if (resolution === 720 && fps === 5) setFps(30);
  }, [resolution]);

  if (!isOpen) return null;

  const handleStart = () => {
    // Kaynak tipine göre audio mode belirle
    const isScreen = selectedSourceData?.id?.startsWith("screen");
    const finalAudioMode = isScreen ? "system" : "app";

    // YENİ: withAudio ve audioMode bilgisini de gönderiyoruz
    onStart({
      resolution,
      fps,
      sourceId: selectedSourceId,
      withAudio,
      audioMode: withAudio ? finalAudioMode : null, // Ses kapalıysa null
    });
    onClose();
  };

  const currentList =
    activeTab === "screens"
      ? categorizedSources.screens
      : categorizedSources.apps;

  return (
    <div className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
      <div className="glass-strong w-full max-w-4xl h-[600px] rounded-2xl shadow-soft-lg border border-white/10 overflow-hidden flex flex-col relative animate-scaleIn">
        {/* --- HEADER --- */}
        <div className="p-6 pb-3 shrink-0 flex justify-between items-start border-b border-white/5">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1.5 tracking-tight">
              {step === 1 ? "Ekran Paylaşımı" : "Yayın Kalitesi"}
            </h2>
            <p className="text-[#b5bac1] text-sm">
              {step === 1
                ? "Arkadaşlarına ne göstermek istersin?"
                : "Yayının ne kadar net ve akıcı olacağını seç."}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[#b5bac1] hover:text-red-400 glass border border-white/10 p-2.5 rounded-xl hover:bg-red-500/20 hover:border-red-500/30 transition-all duration-200 hover:scale-110"
          >
            <X size={20} />
          </button>
        </div>

        {/* --- CONTENT AREA --- */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {/* STEP 1: KAYNAK SEÇİMİ */}
          {step === 1 && (
            <>
              <div className="px-6 border-b border-white/5 flex gap-8 mt-3">
                <button
                  onClick={() => setActiveTab("apps")}
                  className={`pb-3 text-sm font-bold transition-all duration-200 relative flex items-center gap-2 ${
                    activeTab === "apps"
                      ? "text-white"
                      : "text-[#949ba4] hover:text-[#dbdee1]"
                  }`}
                >
                  <AppWindow size={18} /> Uygulamalar
                  <span className="glass-light text-[10px] px-2 py-0.5 rounded-full text-[#b5bac1]">
                    {categorizedSources.apps.length}
                  </span>
                  {activeTab === "apps" && (
                    <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-indigo-500 to-purple-500 rounded-t-full shadow-glow"></div>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("screens")}
                  className={`pb-3 text-sm font-bold transition-all duration-200 relative flex items-center gap-2 ${
                    activeTab === "screens"
                      ? "text-white"
                      : "text-[#949ba4] hover:text-[#dbdee1]"
                  }`}
                >
                  <Monitor size={18} /> Ekranlar
                  <span className="glass-light text-[10px] px-2 py-0.5 rounded-full text-[#b5bac1]">
                    {categorizedSources.screens.length}
                  </span>
                  {activeTab === "screens" && (
                    <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-indigo-500 to-purple-500 rounded-t-full shadow-glow"></div>
                  )}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-gradient-to-b from-[#25272a] to-[#2b2d31]">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {currentList.map((source) => (
                    <div
                      key={source.id}
                      onClick={() => setSelectedSourceId(source.id)}
                      className={`
                        group relative cursor-pointer rounded-2xl overflow-hidden border-2 transition-all duration-300 flex flex-col glass hover-lift
                        ${
                          selectedSourceId === source.id
                            ? "border-indigo-500/50 ring-2 ring-indigo-500/30 shadow-glow scale-105"
                            : "border-white/10 hover:border-white/20 hover:shadow-soft"
                        }
                      `}
                    >
                      <div className="w-full aspect-video bg-[#111214] flex items-center justify-center p-2 relative overflow-hidden rounded-t-2xl">
                        <img
                          src={source.thumbnail}
                          alt={source.name}
                          className="w-full h-full object-contain shadow-sm group-hover:scale-105 transition-transform duration-300"
                        />
                        {selectedSourceId === source.id && (
                          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 via-purple-500/10 to-transparent flex items-center justify-center backdrop-blur-[2px]">
                            <div className="w-12 h-12 gradient-primary rounded-full flex items-center justify-center shadow-glow animate-scaleIn">
                              <Check
                                size={24}
                                className="text-white"
                                strokeWidth={3}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="p-3 border-t border-white/5 flex items-center gap-3 glass-light group-hover:bg-white/5 transition-all duration-200">
                        {source.appIcon && activeTab === "apps" ? (
                          <img
                            src={source.appIcon}
                            className="w-5 h-5 rounded"
                            alt=""
                          />
                        ) : (
                          <div className="w-5 h-5 rounded glass-light flex items-center justify-center">
                            {activeTab === "screens" ? (
                              <Layers size={12} className="text-[#dbdee1]" />
                            ) : (
                              <AppWindow size={12} className="text-[#dbdee1]" />
                            )}
                          </div>
                        )}
                        <span className="text-xs font-semibold text-[#dbdee1] truncate flex-1 leading-tight">
                          {source.name}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                {currentList.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-[#949ba4] opacity-50 pb-20">
                    <div className="p-6 glass-strong rounded-2xl mb-4">
                      <Layers size={48} className="stroke-1 text-indigo-400/50" />
                    </div>
                    <p className="text-lg font-medium">
                      Hiçbir kaynak bulunamadı.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* STEP 2: KALİTE VE SES AYARLARI */}
          {step === 2 && (
            <div className="flex-1 bg-gradient-to-b from-[#25272a] to-[#2b2d31] p-8 flex flex-col gap-6 overflow-y-auto">
              {/* Preview */}
              <div className="glass-strong p-5 rounded-2xl border border-white/10 flex items-center gap-4 shadow-soft hover-lift">
                <div className="h-20 aspect-video bg-black rounded-xl overflow-hidden border border-white/10 shadow-soft">
                  <img
                    src={selectedSourceData?.thumbnail}
                    className="w-full h-full object-contain"
                    alt=""
                  />
                </div>
                <div className="flex-1">
                  <div className="text-[10px] font-bold text-[#949ba4] uppercase mb-1 tracking-wider">
                    SEÇİLEN KAYNAK
                  </div>
                  <div className="text-white font-bold text-base truncate w-64">
                    {selectedSourceData?.name}
                  </div>
                </div>
                <button
                  onClick={() => setStep(1)}
                  className="text-xs font-medium text-indigo-400 hover:text-indigo-300 px-5 py-2.5 glass-light hover:bg-indigo-500/20 rounded-xl transition-all duration-200 hover:scale-105"
                >
                  Değiştir
                </button>
              </div>

              <div className="flex gap-8">
                {/* Çözünürlük */}
                <div className="flex-1">
                  <label className="text-xs font-bold text-white uppercase mb-4 flex items-center gap-2 tracking-wider">
                    <Monitor size={16} className="text-indigo-400" /> Çözünürlük
                  </label>
                  <div className="space-y-3">
                    {[480, 720, 1080].map((res) => (
                      <button
                        key={res}
                        onClick={() => setResolution(res)}
                        className={`w-full flex items-center justify-between p-5 rounded-2xl border-2 transition-all duration-300 group hover-lift ${
                          resolution === res
                            ? "gradient-primary border-indigo-400/80 shadow-glow scale-105"
                            : "glass border-white/20 hover:border-indigo-500/40 hover:bg-indigo-500/10 hover:shadow-soft"
                        }`}
                      >
                        <div className="flex flex-col items-start">
                          <span
                            className={`font-bold text-lg ${
                              resolution === res
                                ? "text-white"
                                : "text-[#dbdee1] group-hover:text-white"
                            }`}
                          >
                            {res}p
                          </span>
                        </div>
                        {resolution === res && (
                          <div className="w-4 h-4 bg-white rounded-full shadow-glow flex items-center justify-center">
                            <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* FPS */}
                <div className="flex-1">
                  <label className="text-xs font-bold text-white uppercase mb-4 flex items-center gap-2 tracking-wider">
                    <Zap size={16} className="text-indigo-400" /> Kare Hızı (FPS)
                  </label>
                  <div className="space-y-3">
                    {[5, 15, 30].map((f) => {
                      const isDisabled = resolution === 1080 && f > 5;
                      return (
                        <button
                          key={f}
                          onClick={() => setFps(f)}
                          disabled={isDisabled}
                          className={`w-full flex items-center justify-between p-5 rounded-2xl border-2 transition-all duration-300 hover-lift ${
                            isDisabled
                              ? "opacity-30 cursor-not-allowed glass border-white/5 grayscale"
                              : fps === f
                              ? "gradient-primary border-indigo-400/80 shadow-glow scale-105"
                              : "glass border-white/20 hover:border-indigo-500/40 hover:bg-indigo-500/10 hover:shadow-soft"
                          }`}
                        >
                          <div className="flex flex-col items-start">
                            <span
                              className={`font-bold text-lg ${
                                fps === f && !isDisabled
                                  ? "text-white"
                                  : isDisabled
                                  ? "text-[#949ba4]"
                                  : "text-[#dbdee1] group-hover:text-white"
                              }`}
                            >
                              {f} FPS
                            </span>
                          </div>
                          {!isDisabled && fps === f && (
                            <div className="w-4 h-4 bg-white rounded-full shadow-glow flex items-center justify-center">
                              <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* YENİ: SES AYARLARI */}
              {selectedSourceData && (
                <div className="space-y-3">
                  {/* Ses Paylaşım Toggle */}
                  <div className="glass-strong p-5 rounded-2xl border border-white/10 flex items-center justify-between shadow-soft hover-lift">
                    <div className="flex items-center gap-4">
                      <div
                        className={`p-3 rounded-xl transition-all duration-200 ${
                          withAudio
                            ? "bg-green-500/20 text-green-400 shadow-glow-green"
                            : "bg-red-500/20 text-red-400"
                        }`}
                      >
                        {withAudio ? (
                          <Volume2 size={20} />
                        ) : (
                          <VolumeX size={20} />
                        )}
                      </div>
                      <div>
                        <div className="text-white font-bold text-sm mb-1">
                          {selectedSourceData.id.startsWith("screen")
                            ? "Sistem Sesini Paylaş"
                            : "Uygulama Sesini Paylaş"}
                        </div>
                        <div className="text-[#949ba4] text-xs">
                          {selectedSourceData.id.startsWith("screen")
                            ? "Bilgisayar sesini yayına ekle (Netrex sesleri hariç)."
                            : "Sadece bu uygulamanın sesini yayına ekle."}
                        </div>
                      </div>
                    </div>
                    {/* Toggle Switch */}
                    <button
                      onClick={() => setWithAudio(!withAudio)}
                      className={`w-14 h-7 rounded-full relative transition-all duration-300 ease-in-out border-2 ${
                        withAudio 
                          ? "bg-gradient-to-r from-green-500 to-green-600 border-green-400/50 shadow-glow-green" 
                          : "bg-[#404249] border-white/10"
                      }`}
                    >
                      <div
                        className={`absolute top-[2px] left-[2px] w-6 h-6 bg-white rounded-full shadow-lg transition-all duration-300 ease-in-out ${
                          withAudio ? "translate-x-[26px]" : "translate-x-0"
                        }`}
                      ></div>
                    </button>
                  </div>

                  {/* Bilgi Notu */}
                  {withAudio && selectedSourceData.id.startsWith("screen") && (
                    <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded text-[11px] text-blue-200 flex items-start gap-2">
                      <Volume2 size={14} className="shrink-0 mt-0.5" />
                      <span>
                        Sistem sesi paylaşılırken Netrex'ten gelen sesler
                        (insanların konuşması) otomatik olarak filtrelenir.
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Uyarı */}
              {resolution === 1080 && (
                <div className="p-2.5 bg-yellow-500/10 border border-yellow-500/20 rounded text-[11px] text-yellow-200 flex items-center gap-2">
                  <Zap size={14} className="shrink-0" />
                  <span>
                    Ücretsiz plan limitleri: 1080p için FPS 5 ile sınırlıdır.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* --- FOOTER --- */}
        <div className="bg-gradient-to-t from-[#1e1f22] to-transparent p-6 flex justify-between items-center shrink-0 border-t border-white/5 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-xs text-[#949ba4]">
            {step === 2 && withAudio ? (
              <span className="flex items-center gap-2 text-green-400 glass-light border border-green-500/30 px-3 py-1.5 rounded-xl font-medium shadow-soft">
                <Volume2 size={14} /> Ses Açık
              </span>
            ) : step === 2 ? (
              <span className="flex items-center gap-2 text-red-400 glass-light border border-red-500/30 px-3 py-1.5 rounded-xl font-medium shadow-soft">
                <VolumeX size={14} /> Ses Kapalı
              </span>
            ) : (
              <span className="flex items-center gap-2 glass-light px-3 py-1.5 rounded-xl">
                <Settings2 size={14} /> Ayarlar yapılandırılıyor...
              </span>
            )}
          </div>

          <div className="flex gap-3">
            {step === 1 ? (
              <button
                onClick={selectedSourceId ? () => setStep(2) : null}
                disabled={!selectedSourceId}
                className={`px-8 py-3 rounded-xl text-sm font-bold transition-all duration-200 flex items-center gap-2 btn-modern ${
                  selectedSourceId
                    ? "gradient-primary hover:shadow-glow text-white shadow-soft-lg hover-lift"
                    : "glass text-[#949ba4] cursor-not-allowed opacity-50"
                }`}
              >
                Ayarlara Git <ChevronRight size={16} />
              </button>
            ) : (
              <button
                onClick={handleStart}
                className="px-8 py-3 gradient-success hover:shadow-glow-green text-white rounded-xl text-sm font-bold transition-all duration-200 shadow-soft-lg hover-lift flex items-center gap-2 btn-modern"
              >
                <Rocket size={16} /> Yayına Başla
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
