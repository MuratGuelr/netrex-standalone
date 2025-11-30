import { useState, useEffect } from "react";
import {
  Download,
  RefreshCw,
  X,
  Rocket,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from "lucide-react";

export default function UpdateNotification() {
  const [status, setStatus] = useState("idle"); // idle, checking, available, downloading, downloaded, error
  const [progress, setProgress] = useState(0);
  const [show, setShow] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (!window.netrex) return;

    // Durum dinleyicisi
    window.netrex.onUpdateStatus((newStatus, err) => {
      console.log("Updater:", newStatus);
      setStatus(newStatus);

      if (
        newStatus === "available" ||
        newStatus === "downloading" ||
        newStatus === "downloaded"
      ) {
        setShow(true);
      }
    });

    // İlerleme dinleyicisi
    window.netrex.onUpdateProgress((percent) => {
      setStatus("downloading");
      setProgress(Math.round(percent));
    });
  }, []);

  const handleRestart = () => {
    if (window.netrex) window.netrex.quitAndInstall();
  };

  // Bildirimi kapatma (Animasyonlu çıkış için state yönetimi eklenebilir ama şimdilik basit tutalım)
  const handleClose = () => {
    setShow(false);
  };

  if (
    !show ||
    status === "idle" ||
    status === "checking" ||
    status === "not-available"
  )
    return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-[9999] animate-in slide-in-from-right-10 fade-in duration-500"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Glow Effect Background */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-1000"></div>

      {/* Main Container */}
      <div className="relative w-80 bg-[#111214]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl p-5 overflow-hidden">
        {/* Header & Close Button */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
            <div
              className={`p-1.5 rounded-lg ${
                status === "downloaded"
                  ? "bg-[#23a559]/20 text-[#23a559]"
                  : "bg-indigo-500/20 text-indigo-400"
              }`}
            >
              {status === "downloaded" ? (
                <Sparkles size={16} />
              ) : (
                <Rocket size={16} />
              )}
            </div>
            <h4 className="text-white font-bold text-sm tracking-wide">
              {status === "downloaded" ? "Hazır!" : "Netrex Güncelleniyor"}
            </h4>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-1 rounded-full"
          >
            <X size={14} />
          </button>
        </div>

        {/* --- STATE: AVAILABLE / DOWNLOADING --- */}
        {(status === "available" || status === "downloading") && (
          <div className="space-y-3">
            <div className="flex justify-between items-end text-xs">
              <span className="text-gray-400 font-medium">
                {status === "available"
                  ? "İndirme başlıyor..."
                  : "Yeni sürüm indiriliyor"}
              </span>
              <span className="text-white font-mono">{progress}%</span>
            </div>

            {/* Modern Progress Bar */}
            <div className="relative w-full h-2 bg-gray-800 rounded-full overflow-hidden">
              {/* Arka plan animasyonu */}
              <div className="absolute inset-0 bg-gray-800 w-full h-full"></div>
              {/* Doluluk Barı */}
              <div
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              >
                {/* Işıltı Efekti */}
                <div className="absolute top-0 right-0 bottom-0 w-20 bg-gradient-to-r from-transparent to-white/30 blur-sm transform skew-x-12 translate-x-full animate-shimmer"></div>
              </div>
            </div>

            {status === "downloading" && (
              <p className="text-[10px] text-gray-500 text-center pt-1 animate-pulse">
                Arka planda çalışmaya devam edebilirsiniz.
              </p>
            )}
          </div>
        )}

        {/* --- STATE: DOWNLOADED (SUCCESS) --- */}
        {status === "downloaded" && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-[#23a559]/10 p-3 rounded-lg border border-[#23a559]/20">
              <CheckCircle2
                size={18}
                className="text-[#23a559] shrink-0 mt-0.5"
              />
              <p className="text-xs text-gray-200 leading-relaxed">
                İndirme tamamlandı. Yenilikleri görmek için uygulamayı yeniden
                başlatın.
              </p>
            </div>

            <button
              onClick={handleRestart}
              className="group w-full relative overflow-hidden bg-[#23a559] hover:bg-[#1b8746] text-white text-xs font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-900/20 active:scale-[0.98]"
            >
              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer"></div>
              <RefreshCw
                size={14}
                className="group-hover:rotate-180 transition-transform duration-500"
              />
              <span>Şimdi Yeniden Başlat</span>
            </button>
          </div>
        )}

        {/* --- STATE: ERROR --- */}
        {status === "error" && (
          <div className="bg-red-500/10 p-3 rounded-lg border border-red-500/20 flex items-center gap-3">
            <AlertCircle size={18} className="text-red-500 shrink-0" />
            <p className="text-xs text-red-200">
              Güncelleme sırasında bir hata oluştu. Daha sonra tekrar denenecek.
            </p>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
        .animate-shimmer {
          animation: shimmer 1.5s infinite;
        }
      `}</style>
    </div>
  );
}
