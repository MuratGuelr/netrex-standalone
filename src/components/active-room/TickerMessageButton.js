import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { MessageSquareText, Send, X } from "lucide-react";
import { useLocalParticipant } from "@livekit/components-react";
import { toast } from "@/src/utils/toast";
import {
  TICKER_TOPIC,
  TICKER_MAX_CHARS,
  TICKER_SEND_COOLDOWN_MS,
  sanitizeTickerText,
} from "@/src/hooks/useCursorShareController";

/**
 * 💬 Yayıncıya kayan mesaj gönder
 *
 * Mikrofonunu o an açamayan izleyici, yayıncıya kısa bir yazı gönderir; yayıncının ekranında
 * (hangi uygulamada olursa olsun) en üstte kayan yazı olarak görünür.
 *
 * Mesaj kutusu `document.body`'ye (tam ekrandaysa tam ekran elemanına) taşınır; böylece yayın
 * kutusunun üst çubuğu fare hareketsizliğinde gizlense bile yazarken kaybolmaz.
 */
export default function TickerMessageButton({ targetParticipant }) {
  const { localParticipant } = useLocalParticipant();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [host, setHost] = useState(null);
  const inputRef = useRef(null);
  const lastSentRef = useRef(0);

  const targetId = targetParticipant?.identity;

  const openBox = () => {
    // Tam ekrandayken yalnızca tam ekran elemanının içeriği görünür
    setHost(document.fullscreenElement || document.body);
    setOpen(true);
  };
  const closeBox = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Tam ekran durumu değişirse kutu yanlış yerde kalmasın
  useEffect(() => {
    if (!open) return;
    const onFs = () => setOpen(false);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, [open]);

  const send = () => {
    const clean = sanitizeTickerText(text);
    if (!clean || !localParticipant || !targetId) return;

    const now = Date.now();
    if (now - lastSentRef.current < TICKER_SEND_COOLDOWN_MS) {
      toast.info("Biraz bekleyin, mesajlar arasında kısa bir ara gerekiyor.");
      return;
    }

    try {
      localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({ type: TICKER_TOPIC, text: clean })),
        { topic: TICKER_TOPIC, reliable: true, destinationIdentities: [targetId] },
      );
      lastSentRef.current = now;
      setText("");
      setOpen(false);
      toast.success("Mesaj gönderildi.");
    } catch (e) {
      toast.error("Mesaj gönderilemedi.");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => (open ? closeBox() : openBox())}
        className={`ml-2 px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all duration-200 border ${
          open
            ? "bg-sky-500/20 text-sky-300 border-sky-500/30"
            : "bg-white/5 text-[#b5bac1] border-white/5 hover:bg-white/10 hover:text-white"
        }`}
        title="Yayıncıya kayan yazı olarak kısa bir mesaj gönder (mikrofonunuz kapalıyken işe yarar)"
      >
        <MessageSquareText size={14} />
        <span>Mesaj</span>
      </button>

      {open &&
        host &&
        createPortal(
          <div
            className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[100000] w-[min(92vw,460px)] rounded-2xl border border-white/15 bg-[#111214]/95 backdrop-blur-xl shadow-2xl p-3 animate-in fade-in slide-in-from-bottom-2 duration-200"
            // Tıklamalar altındaki yayın kutusuna (çift tıkla tam ekran vb.) geçmesin
            onMouseDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#949ba4]">
                {targetParticipant?.name || targetParticipant?.identity || "Yayıncı"} ekranında kayan yazı
              </span>
              <button
                type="button"
                onClick={closeBox}
                className="w-5 h-5 rounded-md flex items-center justify-center text-[#949ba4] hover:text-white hover:bg-white/10"
                title="Kapat (Esc)"
              >
                <X size={12} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                value={text}
                maxLength={TICKER_MAX_CHARS}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation(); // yazarken uygulama kısayolları tetiklenmesin
                  if (e.key === "Enter") send();
                  else if (e.key === "Escape") closeBox();
                }}
                placeholder="Söylemek istediğin kısa mesaj..."
                className="flex-1 bg-[#1e1f22] border border-white/10 text-white text-sm px-3 py-2 rounded-xl outline-none focus:border-sky-500/60 focus:ring-2 focus:ring-sky-500/20"
              />
              <button
                type="button"
                onClick={send}
                disabled={!sanitizeTickerText(text)}
                className="px-3 py-2 rounded-xl bg-sky-500 text-white text-sm font-semibold flex items-center gap-1.5 hover:bg-sky-400 disabled:opacity-40 disabled:hover:bg-sky-500 transition-colors"
              >
                <Send size={14} />
              </button>
            </div>
            <div className="mt-1.5 text-[10px] text-[#72767d] text-right tabular-nums">
              {text.length}/{TICKER_MAX_CHARS}
            </div>
          </div>,
          host,
        )}
    </>
  );
}
