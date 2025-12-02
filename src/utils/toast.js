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

// Orijinal toast fonksiyonunu da export et (bazı yerlerde normal toast gerekebilir)
export { toast } from "sonner";

