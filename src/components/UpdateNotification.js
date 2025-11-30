import { useState, useEffect } from "react";
import { Download, RefreshCw, X } from "lucide-react";

export default function UpdateNotification() {
  const [status, setStatus] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!window.netrex) return;

    // Durum dinleyicisi
    window.netrex.onUpdateStatus((newStatus, err) => {
      console.log("Updater:", newStatus);
      setStatus(newStatus);

      // Sadece bu durumlarda göster
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

    return () => {
      // Cleanup gerekirse buraya
    };
  }, []);

  const handleRestart = () => {
    if (window.netrex) window.netrex.quitAndInstall();
  };

  if (
    !show ||
    status === "idle" ||
    status === "checking" ||
    status === "not-available"
  )
    return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] bg-[#313338] border border-[#1e1f22] p-4 rounded-lg shadow-2xl w-80 animate-in slide-in-from-bottom-5">
      <div className="flex justify-between items-start mb-2">
        <h4 className="text-white font-bold text-sm flex items-center gap-2">
          <Download size={16} className="text-indigo-500" />
          Güncelleme Mevcut
        </h4>
        <button
          onClick={() => setShow(false)}
          className="text-gray-400 hover:text-white"
        >
          <X size={14} />
        </button>
      </div>

      {status === "available" && (
        <p className="text-xs text-gray-400 mb-2">Yeni sürüm hazırlanıyor...</p>
      )}

      {status === "downloading" && (
        <div className="w-full bg-gray-700 rounded-full h-2.5 mb-2 relative overflow-hidden">
          <div
            className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          ></div>
          <span className="text-[10px] text-white absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 mix-blend-difference">
            %{progress}
          </span>
        </div>
      )}

      {status === "downloaded" && (
        <div className="animate-in fade-in zoom-in duration-300">
          <p className="text-xs text-[#23a559] mb-3 font-medium">
            İndirme tamamlandı! Yenilikler için yeniden başlatın.
          </p>
          <button
            onClick={handleRestart}
            className="w-full bg-[#23a559] hover:bg-[#1b8746] text-white text-xs font-bold py-2.5 rounded flex items-center justify-center gap-2 transition shadow-lg"
          >
            <RefreshCw size={14} />
            Şimdi Yeniden Başlat
          </button>
        </div>
      )}

      {status === "error" && (
        <p className="text-xs text-[#da373c]">
          Bir hata oluştu. Daha sonra tekrar denenecek.
        </p>
      )}
    </div>
  );
}
