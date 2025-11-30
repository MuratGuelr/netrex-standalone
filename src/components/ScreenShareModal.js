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

  // Varsayılan Ayarlar
  const [resolution, setResolution] = useState(720);
  const [fps, setFps] = useState(30);

  // YENİ: Ses Paylaşım Ayarı
  const [withAudio, setWithAudio] = useState(true);

  // Modal açıldığında kaynakları yükle
  useEffect(() => {
    if (isOpen && window.netrex) {
      setStep(1);
      setSources([]);
      setSelectedSourceId(null);
      // Varsayılan olarak ses açık başlasın
      setWithAudio(true);

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
    // YENİ: withAudio bilgisini de gönderiyoruz
    onStart({ resolution, fps, sourceId: selectedSourceId, withAudio });
    onClose();
  };

  const currentList =
    activeTab === "screens"
      ? categorizedSources.screens
      : categorizedSources.apps;

  return (
    <div className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#313338] w-full max-w-4xl h-[600px] rounded-xl shadow-2xl border border-[#1e1f22] overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-300">
        {/* --- HEADER --- */}
        <div className="p-6 pb-2 shrink-0 flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-[#f2f3f5] mb-1">
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
            className="text-[#b5bac1] hover:text-[#dbdee1] bg-[#2b2d31] p-2 rounded-full hover:bg-[#404249] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* --- CONTENT AREA --- */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {/* STEP 1: KAYNAK SEÇİMİ */}
          {step === 1 && (
            <>
              <div className="px-6 border-b border-[#26272d] flex gap-8 mt-2">
                <button
                  onClick={() => setActiveTab("apps")}
                  className={`pb-3 text-sm font-bold transition-all relative flex items-center gap-2 ${
                    activeTab === "apps"
                      ? "text-white"
                      : "text-[#949ba4] hover:text-[#dbdee1]"
                  }`}
                >
                  <AppWindow size={18} /> Uygulamalar
                  <span className="bg-[#1e1f22] text-[10px] px-1.5 py-0.5 rounded text-[#b5bac1]">
                    {categorizedSources.apps.length}
                  </span>
                  {activeTab === "apps" && (
                    <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[#5865f2] rounded-t-full"></div>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("screens")}
                  className={`pb-3 text-sm font-bold transition-all relative flex items-center gap-2 ${
                    activeTab === "screens"
                      ? "text-white"
                      : "text-[#949ba4] hover:text-[#dbdee1]"
                  }`}
                >
                  <Monitor size={18} /> Ekranlar
                  <span className="bg-[#1e1f22] text-[10px] px-1.5 py-0.5 rounded text-[#b5bac1]">
                    {categorizedSources.screens.length}
                  </span>
                  {activeTab === "screens" && (
                    <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[#5865f2] rounded-t-full"></div>
                  )}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-[#2b2d31]">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {currentList.map((source) => (
                    <div
                      key={source.id}
                      onClick={() => setSelectedSourceId(source.id)}
                      className={`
                        group relative cursor-pointer rounded-xl overflow-hidden border-2 transition-all duration-200 flex flex-col bg-[#1e1f22]
                        ${
                          selectedSourceId === source.id
                            ? "border-[#5865f2] ring-2 ring-[#5865f2]/20 translate-y-[-2px]"
                            : "border-transparent hover:border-[#404249] hover:bg-[#232428] hover:translate-y-[-2px]"
                        }
                      `}
                    >
                      <div className="w-full aspect-video bg-[#111214] flex items-center justify-center p-2 relative overflow-hidden">
                        <img
                          src={source.thumbnail}
                          alt={source.name}
                          className="w-full h-full object-contain shadow-sm group-hover:scale-105 transition-transform duration-300"
                        />
                        {selectedSourceId === source.id && (
                          <div className="absolute inset-0 bg-[#5865f2]/10 flex items-center justify-center backdrop-blur-[1px]">
                            <div className="w-10 h-10 bg-[#5865f2] rounded-full flex items-center justify-center shadow-lg animate-in zoom-in duration-200">
                              <Check
                                size={24}
                                className="text-white"
                                strokeWidth={3}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="p-3 border-t border-[#26272d] flex items-center gap-3 bg-[#2b2d31] group-hover:bg-[#313338] transition-colors">
                        {source.appIcon && activeTab === "apps" ? (
                          <img
                            src={source.appIcon}
                            className="w-5 h-5"
                            alt=""
                          />
                        ) : (
                          <div className="w-5 h-5 rounded bg-[#404249] flex items-center justify-center">
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
                    <Layers size={64} className="mb-4 stroke-1" />
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
            <div className="flex-1 bg-[#2b2d31] p-8 flex flex-col gap-6 overflow-y-auto">
              {/* Preview */}
              <div className="bg-[#1e1f22] p-4 rounded-lg border border-[#111214] flex items-center gap-4 shadow-sm">
                <div className="h-16 aspect-video bg-black rounded overflow-hidden border border-[#2b2d31]">
                  <img
                    src={selectedSourceData?.thumbnail}
                    className="w-full h-full object-contain"
                    alt=""
                  />
                </div>
                <div className="flex-1">
                  <div className="text-[10px] font-bold text-[#949ba4] uppercase mb-0.5">
                    SEÇİLEN KAYNAK
                  </div>
                  <div className="text-white font-bold text-base truncate w-64">
                    {selectedSourceData?.name}
                  </div>
                </div>
                <button
                  onClick={() => setStep(1)}
                  className="text-xs font-medium text-[#00a8fc] hover:underline px-4 py-2 hover:bg-[#00a8fc]/10 rounded transition-colors"
                >
                  Değiştir
                </button>
              </div>

              <div className="flex gap-8">
                {/* Çözünürlük */}
                <div className="flex-1">
                  <label className="text-xs font-bold text-[#b5bac1] uppercase mb-3 flex items-center gap-2">
                    <Monitor size={14} /> Çözünürlük
                  </label>
                  <div className="space-y-2">
                    {[480, 720, 1080].map((res) => (
                      <button
                        key={res}
                        onClick={() => setResolution(res)}
                        className={`w-full flex items-center justify-between p-3 rounded-lg border-2 transition-all group ${
                          resolution === res
                            ? "bg-[#5865f2]/10 border-[#5865f2]"
                            : "bg-[#313338] border-transparent hover:border-[#404249]"
                        }`}
                      >
                        <div className="flex flex-col items-start">
                          <span
                            className={`font-bold text-base ${
                              resolution === res
                                ? "text-white"
                                : "text-[#dbdee1]"
                            }`}
                          >
                            {res}p
                          </span>
                        </div>
                        {resolution === res && (
                          <div className="w-2.5 h-2.5 bg-[#5865f2] rounded-full shadow-[0_0_10px_#5865f2]"></div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* FPS */}
                <div className="flex-1">
                  <label className="text-xs font-bold text-[#b5bac1] uppercase mb-3 flex items-center gap-2">
                    <Zap size={14} /> Kare Hızı (FPS)
                  </label>
                  <div className="space-y-2">
                    {[5, 15, 30].map((f) => {
                      const isDisabled = resolution === 1080 && f > 5;
                      return (
                        <button
                          key={f}
                          onClick={() => setFps(f)}
                          disabled={isDisabled}
                          className={`w-full flex items-center justify-between p-3 rounded-lg border-2 transition-all ${
                            isDisabled
                              ? "opacity-40 cursor-not-allowed bg-[#2b2d31] border-transparent grayscale"
                              : fps === f
                              ? "bg-[#5865f2]/10 border-[#5865f2]"
                              : "bg-[#313338] border-transparent hover:border-[#404249]"
                          }`}
                        >
                          <div className="flex flex-col items-start">
                            <span
                              className={`font-bold text-base ${
                                fps === f && !isDisabled
                                  ? "text-white"
                                  : "text-[#dbdee1]"
                              }`}
                            >
                              {f} FPS
                            </span>
                          </div>
                          {!isDisabled && fps === f && (
                            <div className="w-2.5 h-2.5 bg-[#5865f2] rounded-full shadow-[0_0_10px_#5865f2]"></div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* YENİ: SES AYARLARI */}
              <div className="bg-[#1e1f22] p-4 rounded-lg border border-[#111214] flex items-center justify-between shadow-sm hover:border-[#404249] transition-colors">
                <div className="flex items-center gap-4">
                  <div
                    className={`p-2 rounded-full ${
                      withAudio
                        ? "bg-[#23a559]/20 text-[#23a559]"
                        : "bg-[#da373c]/20 text-[#da373c]"
                    }`}
                  >
                    {withAudio ? <Volume2 size={20} /> : <VolumeX size={20} />}
                  </div>
                  <div>
                    <div className="text-white font-bold text-sm">
                      Sistem Sesini Paylaş
                    </div>
                    <div className="text-[#949ba4] text-xs">
                      Uygulama veya bilgisayar sesini de yayına ekle.
                    </div>
                  </div>
                </div>
                {/* Toggle Switch */}
                <button
                  onClick={() => setWithAudio(!withAudio)}
                  className={`w-12 h-6 rounded-full relative transition-colors duration-200 ease-in-out border border-transparent ${
                    withAudio ? "bg-[#23a559]" : "bg-[#404249]"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-md transition-transform duration-200 ${
                      withAudio
                        ? "translate-x-6.5 left-0.5"
                        : "translate-x-0.5 left-0.5"
                    }`}
                  ></div>
                </button>
              </div>

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
        <div className="bg-[#1e1f22] p-5 flex justify-between items-center shrink-0 border-t border-[#111214]">
          <div className="flex items-center gap-2 text-xs text-[#949ba4]">
            {step === 2 && withAudio ? (
              <span className="flex items-center gap-1.5 text-[#23a559] bg-[#23a559]/10 px-2 py-1 rounded font-medium">
                <Volume2 size={12} /> Ses Açık
              </span>
            ) : step === 2 ? (
              <span className="flex items-center gap-1.5 text-[#da373c] bg-[#da373c]/10 px-2 py-1 rounded font-medium">
                <VolumeX size={12} /> Ses Kapalı
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Settings2 size={12} /> Ayarlar yapılandırılıyor...
              </span>
            )}
          </div>

          <div className="flex gap-3">
            {step === 1 ? (
              <button
                onClick={selectedSourceId ? () => setStep(2) : null}
                disabled={!selectedSourceId}
                className={`px-8 py-2.5 rounded text-sm font-bold transition-all duration-200 flex items-center gap-2 ${
                  selectedSourceId
                    ? "bg-[#5865f2] hover:bg-[#4752c4] text-white shadow-lg transform hover:-translate-y-0.5"
                    : "bg-[#3f4147] text-[#949ba4] cursor-not-allowed"
                }`}
              >
                Ayarlara Git <ChevronRight size={16} />
              </button>
            ) : (
              <button
                onClick={handleStart}
                className="px-8 py-2.5 bg-[#23a559] hover:bg-[#1b8746] text-white rounded text-sm font-bold transition-all duration-200 shadow-[0_4px_14px_rgba(35,165,89,0.3)] hover:shadow-[0_6px_20px_rgba(35,165,89,0.4)] transform hover:-translate-y-0.5 flex items-center gap-2"
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
