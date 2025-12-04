import { toast as sonnerToast } from "sonner";

// Son gösterilen toast mesajlarını takip et (mesaj -> zaman)
const lastToastMap = new Map();
const TOAST_COOLDOWN_MS = 2000; // 2 saniye içinde aynı mesaj tekrar gösterilmez

/**
 * Aynı mesajı kısa süre içinde tekrar göstermeyen toast wrapper
 * @param {string} message - Toast mesajı
 * @param {string} type - Toast tipi ('success', 'error', 'info', 'warning')
 * @param {object} options - Ek toast seçenekleri
 */
export function toastOnce(message, type = "success", options = {}) {
  const now = Date.now();
  const lastTime = lastToastMap.get(message);

  // Eğer aynı mesaj son 2 saniye içinde gösterildiyse, yeni toast gösterme
  if (lastTime && now - lastTime < TOAST_COOLDOWN_MS) {
    return;
  }

  // Son gösterilme zamanını güncelle
  lastToastMap.set(message, now);

  // Toast'ı göster
  switch (type) {
    case "success":
      sonnerToast.success(message, options);
      break;
    case "error":
      sonnerToast.error(message, options);
      break;
    case "info":
      sonnerToast.info(message, options);
      break;
    case "warning":
      sonnerToast.warning(message, options);
      break;
    default:
      sonnerToast(message, options);
  }
}

/**
 * Chat mesajları için özel toast bildirimi
 * @param {object} params - Toast parametreleri
 * @param {string} params.username - Gönderen kullanıcı adı
 * @param {string} params.message - Mesaj içeriği
 * @param {string} params.channelName - Kanal adı
 * @param {string} params.avatarColor - Avatar arka plan rengi
 * @param {function} params.onClick - Tıklama handler'ı (opsiyonel)
 */
export function chatToast({ username, message, channelName, avatarColor, onClick }) {
  const now = Date.now();
  const toastKey = `chat-${username}-${message?.slice(0, 20)}`;
  const lastTime = lastToastMap.get(toastKey);

  // Cooldown kontrolü
  if (lastTime && now - lastTime < TOAST_COOLDOWN_MS) {
    return;
  }
  lastToastMap.set(toastKey, now);

  // Mesajı kısalt
  const truncatedMessage = message?.length > 80 
    ? message.slice(0, 80) + "..." 
    : message || "Yeni mesaj";

  // Avatar harfi
  const avatarLetter = username?.charAt(0)?.toUpperCase() || "?";

  // Default renk
  const bgColor = avatarColor || "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)";

  sonnerToast.custom(
    (t) => (
      <div
        onClick={() => {
          if (onClick) onClick();
          sonnerToast.dismiss(t);
        }}
        className="flex items-start gap-3 p-3 cursor-pointer group"
      >
        {/* Avatar */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-lg"
          style={{ background: bgColor }}
        >
          {avatarLetter}
        </div>

        {/* İçerik */}
        <div className="flex-1 min-w-0">
          {/* Üst satır: kullanıcı adı + kanal */}
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-semibold text-white text-sm truncate">
              {username || "Birisi"}
            </span>
            <span className="text-xs text-[#5c6370]">•</span>
            <span className="text-xs text-indigo-400 font-medium truncate">
              #{channelName || "sohbet"}
            </span>
          </div>
          
          {/* Mesaj */}
          <p className="text-[13px] text-[#b5bac1] leading-snug line-clamp-2 group-hover:text-[#dbdee1] transition-colors">
            {truncatedMessage}
          </p>
        </div>

        {/* Sağ ok işareti */}
        <div className="text-[#5c6370] group-hover:text-indigo-400 transition-colors shrink-0 self-center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>
      </div>
    ),
    {
      duration: 5000,
      className: "!bg-[#1e1f22] !border !border-[#2b2d31] !rounded-xl !shadow-xl !p-0 !min-w-[320px] !max-w-[400px]",
      style: {
        background: "linear-gradient(135deg, #1e1f22 0%, #25272a 100%)",
        border: "1px solid rgba(99, 102, 241, 0.2)",
      },
    }
  );
}

/**
 * Sistem bildirimi için toast (kullanıcı katıldı/ayrıldı vb.)
 * @param {object} params - Toast parametreleri
 * @param {string} params.title - Başlık
 * @param {string} params.message - Mesaj içeriği
 * @param {string} params.type - Tip ('join', 'leave', 'stream', 'info')
 * @param {function} params.onClick - Tıklama handler'ı (opsiyonel)
 */
export function systemToast({ title, message, type = "info", onClick }) {
  const now = Date.now();
  const toastKey = `system-${title}-${message?.slice(0, 20)}`;
  const lastTime = lastToastMap.get(toastKey);

  if (lastTime && now - lastTime < TOAST_COOLDOWN_MS) {
    return;
  }
  lastToastMap.set(toastKey, now);

  // Tip'e göre ikon ve renk
  const config = {
    join: {
      icon: "👋",
      color: "#23a559",
      bgColor: "rgba(35, 165, 89, 0.1)",
      borderColor: "rgba(35, 165, 89, 0.3)",
    },
    leave: {
      icon: "👋",
      color: "#f59e0b",
      bgColor: "rgba(245, 158, 11, 0.1)",
      borderColor: "rgba(245, 158, 11, 0.3)",
    },
    stream: {
      icon: "📺",
      color: "#ef4444",
      bgColor: "rgba(239, 68, 68, 0.1)",
      borderColor: "rgba(239, 68, 68, 0.3)",
    },
    info: {
      icon: "ℹ️",
      color: "#6366f1",
      bgColor: "rgba(99, 102, 241, 0.1)",
      borderColor: "rgba(99, 102, 241, 0.3)",
    },
  }[type] || config.info;

  sonnerToast.custom(
    (t) => (
      <div
        onClick={() => {
          if (onClick) onClick();
          sonnerToast.dismiss(t);
        }}
        className="flex items-center gap-3 p-3 cursor-pointer group"
      >
        {/* İkon */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
          style={{ background: config.bgColor, border: `1px solid ${config.borderColor}` }}
        >
          {config.icon}
        </div>

        {/* İçerik */}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-white text-sm mb-0.5">
            {title}
          </div>
          <p className="text-xs text-[#949ba4] group-hover:text-[#b5bac1] transition-colors truncate">
            {message}
          </p>
        </div>
      </div>
    ),
    {
      duration: 4000,
      className: "!bg-[#1e1f22] !border !border-[#2b2d31] !rounded-xl !shadow-xl !p-0 !min-w-[280px] !max-w-[360px]",
      style: {
        background: "#1e1f22",
        borderLeft: `3px solid ${config.color}`,
      },
    }
  );
}

// Orijinal toast fonksiyonunu da export et (bazı yerlerde normal toast gerekebilir)
export { toast } from "sonner";
