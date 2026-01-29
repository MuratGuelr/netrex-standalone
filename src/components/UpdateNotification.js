import { useState, useEffect } from "react";
import {
  Rocket,
  RefreshCw,
  X,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Download,
  Zap,
  ChevronDown,
  Minimize2
} from "lucide-react";

export default function UpdateNotification() {
  const [status, setStatus] = useState("idle"); // idle, checking, available, downloading, downloaded, error
  const [progress, setProgress] = useState(0);
  const [show, setShow] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false); // New: Expand/Collapse state
  const [updateInfo, setUpdateInfo] = useState(null);

  useEffect(() => {
    if (!window.netrex) return;

    // Durum dinleyicisi
    window.netrex.onUpdateStatus((newStatus, data) => {
      console.log("Updater:", newStatus, data);
      setStatus(newStatus);

      if (data && typeof data === 'object' && data.version) {
        setUpdateInfo(data);
      }

      if (
        newStatus === "available" ||
        newStatus === "downloading" ||
        newStatus === "downloaded"
      ) {
        setShow(true);
        // Yeni bir durum olduğunda dikkat çekmek için kısa süreliğine açılabilir
        // Ama kullanıcı "yukarıda ikon" istediği için kapalı (pill) başlatıyoruz.
        if (newStatus === "downloaded") {
            setIsExpanded(true); // İndirme bittiğinde aç
        }
      }
    });

    // İlerleme dinleyicisi
    window.netrex.onUpdateProgress((percent) => {
      setStatus("downloading");
      setProgress(Math.round(percent));
    });
  }, []);

  // Development Test
  useEffect(() => {
    const handleTest = (e) => {
      const { status: testStatus, progress: testProgress } = e.detail;
      if (testStatus) setStatus(testStatus);
      if (testProgress !== undefined) setProgress(testProgress);
      if (["available", "downloading", "downloaded"].includes(testStatus)) {
        setShow(true);
      }
    };
    window.addEventListener("NETREX_TEST_UPDATE", handleTest);
    return () => window.removeEventListener("NETREX_TEST_UPDATE", handleTest);
  }, []);

  const handleRestart = () => {
    if (window.netrex) window.netrex.quitAndInstall();
  };

  const handleClose = (e) => {
    e?.stopPropagation();
    setShow(false);
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  if (
    !show ||
    status === "idle" ||
    status === "checking" ||
    status === "not-available"
  )
    return null;

  // --- PILL VIEW (Collapsed) ---
  if (!isExpanded) {
    return (
      <div 
        onClick={toggleExpand}
        className="fixed top-14 right-6 z-[9999] animate-in slide-in-from-top-4 fade-in duration-500 cursor-pointer group"
      >
        <div className="relative overflow-hidden bg-[#1a1b1e]/90 backdrop-blur-md border border-white/10 rounded-full shadow-lg hover:shadow-indigo-500/20 transition-all duration-300 hover:scale-105 active:scale-95 pr-4 pl-3 py-2 flex items-center gap-3">
            
            {/* Status Icon */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                status === 'downloaded' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-indigo-500/20 text-indigo-400'
            }`}>
                {status === 'downloaded' ? (
                    <CheckCircle2 size={16} />
                ) : status === 'downloading' ? (
                    <div className="relative">
                        <Download size={16} />
                        <span className="absolute -bottom-1 -right-1 flex h-2 w-2">
                           <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                           <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                        </span>
                    </div>
                ) : (
                    <Rocket size={16} />
                )}
            </div>

            {/* Info Text */}
            <div className="flex flex-col">
                <span className="text-white text-xs font-bold leading-none mb-0.5">
                    {status === 'downloaded' ? 'Güncelleme Hazır' : 'Güncelleniyor...'}
                </span>
                <span className="text-[10px] text-white/50 leading-none font-medium">
                    {status === 'downloading' ? `%${progress} İndiriliyor` : status === 'available' ? 'Başlatılıyor...' : 'Yeniden Başlat'}
                </span>
            </div>

            {/* Mini Progress (Background) if downloading */}
            {status === 'downloading' && (
                <div className="absolute bottom-0 left-0 h-[2px] bg-indigo-500" style={{ width: `${progress}%`, transition: 'width 0.5s' }} />
            )}
        </div>
      </div>
    );
  }

  // --- CARD VIEW (Expanded) ---
  return (
    <div
      className="fixed top-14 right-6 z-[9999] animate-in slide-in-from-top-4 fade-in duration-500 perspective-1000"
    >
      {/* Outer Glow Effect */}
      <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500/30 to-purple-600/30 rounded-[2rem] blur-2xl opacity-0 hover:opacity-100 transition-opacity duration-1000"></div>

      {/* Main Card */}
      <div className="relative w-[22rem] bg-[#0e0f12]/95 backdrop-blur-2xl rounded-3xl border border-white/[0.08] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] overflow-hidden">
        
        {/* Decorative Grid Background */}
        <div className="absolute inset-0 opacity-[0.15]" 
             style={{ 
               backgroundImage: 'linear-gradient(#6366f1 1px, transparent 1px), linear-gradient(90deg, #6366f1 1px, transparent 1px)', 
               backgroundSize: '24px 24px',
               maskImage: 'radial-gradient(circle at top right, black, transparent 70%)' 
             }}>
        </div>

        {/* Top Highlight Line */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent"></div>

        {/* Content Container */}
        <div className="relative p-6 pt-5">
          
          {/* Header */}
          <div className="flex justify-between items-start mb-5">
            <div className="flex items-center gap-3.5">
              <div className={`relative w-11 h-11 rounded-2xl flex items-center justify-center border transition-all duration-300 ${
                status === "downloaded"
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                  : "bg-indigo-500/10 border-indigo-500/20 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]"
              }`}>
                {status === "downloaded" ? (
                  <>
                    <Sparkles size={20} className="animate-pulse" />
                    <div className="absolute inset-0 bg-emerald-400/20 rounded-2xl blur-md opacity-50"></div>
                  </>
                ) : (
                  <>
                    <Rocket size={20} />
                    <div className="absolute inset-0 bg-indigo-400/20 rounded-2xl blur-md opacity-50"></div>
                  </>
                )}
              </div>
              <div className="cursor-pointer" onClick={toggleExpand}>
                <h4 className="text-white font-bold text-[15px] tracking-tight leading-tight flex items-center gap-2">
                  {status === "downloaded" ? "Güncelleme Hazır!" : "Yeni Sürüm Mevcut"}
                  <Minimize2 size={12} className="text-white/30" />
                </h4>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${status === "downloaded" ? "bg-emerald-500 animate-pulse" : "bg-indigo-500"}`}></span>
                  <span className="text-[11px] text-[#949ba4] font-medium uppercase tracking-wider">
                    {status === "downloaded" 
                      ? (updateInfo?.version ? `v${updateInfo.version} Hazır` : "Kurulum Hazır")
                      : (updateInfo?.version ? `Netrex v${updateInfo.version}` : "Netrex Güncellemesi")
                    }
                  </span>
                </div>
              </div>
            </div>
            
            <button
              onClick={handleClose}
              className="text-[#949ba4] hover:text-white transition-all duration-200 bg-white/5 hover:bg-white/10 p-2 rounded-xl border border-transparent hover:border-white/10 active:scale-95"
            >
              <X size={16} />
            </button>
          </div>

          {/* DOWNLOADING STATE */}
          {(status === "available" || status === "downloading") && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="bg-[#1a1b1e]/60 rounded-2xl p-4 border border-white/[0.06] backdrop-blur-sm relative overflow-hidden">
                <div className="flex justify-between items-end text-xs mb-2.5">
                  <span className="text-[#dbdee1] font-semibold flex items-center gap-2">
                    <Download size={12} className="text-indigo-400" />
                    {status === "available" ? "Hazırlanıyor..." : "İndiriliyor..."}
                  </span>
                  <span className="text-indigo-300 font-mono font-bold bg-indigo-500/10 px-2 py-0.5 rounded-lg border border-indigo-500/20">{progress}%</span>
                </div>

                {/* Premium Progress Bar */}
                <div className="relative w-full h-2 bg-[#0e0f12] rounded-full overflow-hidden shadow-inner border border-white/[0.02]">
                  <div
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 rounded-full transition-all duration-300 ease-out relative"
                    style={{ width: `${progress}%` }}
                  >
                    <div className="absolute top-0 right-0 bottom-0 w-20 bg-gradient-to-r from-transparent to-white/70 blur-sm transform skew-x-12 translate-x-full animate-progress-shimmer"></div>
                    <div className="absolute inset-0 bg-white/10 opacity-50"></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* DOWNLOADED STATE */}
          {status === "downloaded" && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="bg-emerald-500/5 p-4 rounded-2xl border border-emerald-500/20 flex gap-3.5 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="mt-0.5 shrink-0 relative z-10">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <CheckCircle2 size={14} className="text-emerald-400" />
                  </div>
                </div>
                <div className="relative z-10">
                  <h5 className="text-emerald-400 text-xs font-bold mb-1">Kurulum Hazır</h5>
                  <p className="text-xs text-[#dbdee1]/90 leading-relaxed font-medium">
                    Güncelleme başarıyla indirildi. Yeni özellikleri kullanmak için yeniden başlatın.
                  </p>
                </div>
              </div>

              <button
                onClick={handleRestart}
                className="group w-full relative overflow-hidden rounded-xl p-[1px] transition-all duration-300 active:scale-[0.98] shadow-lg hover:shadow-emerald-500/25"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 animate-gradient-x"></div>
                <div className="relative bg-[#1a1b1e] group-hover:bg-[#1a1b1e]/90 rounded-[11px] h-full transition-colors">
                  <div className="relative px-4 py-3.5 flex items-center justify-center gap-2.5">
                    <div className="absolute inset-0 bg-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <RefreshCw
                      size={16}
                      className="text-emerald-400 group-hover:rotate-180 transition-transform duration-700"
                    />
                    <span className="text-white font-bold text-sm tracking-wide group-hover:text-emerald-100 transition-colors">Şimdi Yeniden Başlat</span>
                    <Zap size={14} className="text-yellow-400 fill-yellow-400 ml-1 animate-pulse" />
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* ERROR STATE */}
          {status === "error" && (
            <div className="bg-red-500/10 p-4 rounded-2xl border border-red-500/20 flex items-center gap-3.5 relative z-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="bg-red-500/20 p-2 rounded-xl text-red-500 shrink-0">
                <AlertCircle size={18} />
              </div>
              <div className="flex-1">
                <h5 className="text-red-400 text-xs font-bold mb-0.5">Hata Oluştu</h5>
                <p className="text-xs text-[#dbdee1]/80 leading-snug">
                  Güncelleme başarısız oldu. Otomatik olarak tekrar denenecek.
                </p>
              </div>
            </div>
          )}
        </div>
        
        {/* Bottom Progress Pulse for 'downloaded' state */}
        {status === 'downloaded' && (
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 animate-shimmer opacity-50"></div>
        )}
      </div>

      <style jsx>{`
        @keyframes progress-shimmer {
          0% { transform: translateX(-100%) skewX(-12deg); }
          100% { transform: translateX(300%) skewX(-12deg); }
        }
        .animate-progress-shimmer {
          animation: progress-shimmer 1.5s infinite linear;
        }
        @keyframes gradient-x {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-gradient-x {
          background-size: 200% 200%;
          animation: gradient-x 3s ease infinite;
        }
      `}</style>
    </div>
  );
}
