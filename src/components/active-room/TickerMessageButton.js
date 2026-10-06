import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { MessageSquareText, Send, X } from "lucide-react";
import { useLocalParticipant } from "@livekit/components-react";
import {
  TICKER_MAX_CHARS,
  TICKER_MAX_PER_MINUTE,
  sanitizeTickerText,
} from "@/src/hooks/useCursorShareController";
import { QUICK_MESSAGES, getTickerWait, sendTickerMessage } from "@/src/utils/tickerSend";

/**
 * 💬 Yayıncıya kayan mesaj gönder
 *
 * Mikrofonunu o an açamayan izleyici, yayıncıya kısa bir yazı gönderir; yayıncının ekranında
 * (hangi uygulamada olursa olsun) en üstte kayan yazı olarak görünür.
 *
 * Mesaj kutusu, izlenen yayının KENDİ kutusunun içine (alt orta) açılır: grid/spotlight'ta o yayına ait
 * olduğu belli olur, tam ekranda da aynı yerde kalır ve üst çubuk fare hareketsizliğinde gizlense bile
 * yazarken kaybolmaz.
 *
 * En hızlı yol: yayına SAĞ TIK → "Hızlı mesaj" (işaretçi izni varsa Shift + sağ tık). Gönderme sınırları
 * (bekleme, dakika sınırı) o menüyle ortaktır: src/utils/tickerSend.js
 */
export default function TickerMessageButton({ targetParticipant }) {
  const { localParticipant } = useLocalParticipant();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [host, setHost] = useState(null);
  const [, forceTick] = useState(0);
  const buttonRef = useRef(null);
  const inputRef = useRef(null);

  const targetId = targetParticipant?.identity;
  const targetName = targetParticipant?.name || targetParticipant?.identity || "Yayıncı";

  const openBox = () => {
    // Yayının kendi kutusu; bulunamazsa tam ekran elemanı ya da sayfa
    setHost(buttonRef.current?.closest("[data-stage-container]") || document.fullscreenElement || document.body);
    setOpen(true);
  };
  const closeBox = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Kutu açıkken bekleme geri sayımı canlı kalsın (menüden ya da buradan gönderilmiş olabilir)
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => forceTick((n) => n + 1), 500);
    return () => clearInterval(t);
  }, [open]);

  const send = (override) => {
    const res = sendTickerMessage(localParticipant, targetId, override ?? text);
    if (res.ok) {
      setText("");
      setOpen(false);
    }
  };

  const remaining = TICKER_MAX_CHARS - text.length;
  const wait = getTickerWait();
  const waitSec = Math.ceil(wait.ms / 1000);
  const cooling = waitSec > 0;
  const canSend = !!sanitizeTickerText(text) && !cooling;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? closeBox() : openBox())}
        className={`ml-2 px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all duration-200 border ${
          open
            ? "bg-[#5865f2]/20 text-indigo-200 border-[#5865f2]/40"
            : "bg-white/5 text-[#b5bac1] border-white/5 hover:bg-white/10 hover:text-white"
        }`}
        title="Yayıncıya kayan yazı olarak kısa bir mesaj gönder. Daha hızlısı: yayına sağ tıkla (işaretçi izniniz varsa Shift + sağ tık)."
      >
        <MessageSquareText size={14} />
        <span>Mesaj</span>
      </button>

      {open &&
        host &&
        createPortal(
          <div
            // data-pointer-toolbar: işaretçi yakalayıcı bu kutudaki tıklamaları ekran işareti saymasın
            data-pointer-toolbar
            className="absolute left-1/2 -translate-x-1/2 bottom-20 z-[60] w-[min(94%,440px)] rounded-2xl border border-white/10 bg-[#111214]/90 backdrop-blur-2xl shadow-[0_16px_48px_rgba(0,0,0,0.6)] overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-200"
            // Tıklamalar altındaki yayın kutusuna (çift tıkla tam ekran, sağ tık menüsü vb.) geçmesin
            onMouseDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.stopPropagation()}
          >
            {/* Üst şerit: ince vurgu çizgisi (uygulamanın cam kartlarıyla aynı dil) */}
            <div className="h-px w-full bg-gradient-to-r from-transparent via-[#5865f2]/60 to-transparent" />

            <div className="p-3 sm:p-3.5">
              {/* Başlık */}
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#5865f2]/30 to-purple-500/20 border border-[#5865f2]/30 flex items-center justify-center shrink-0">
                  <MessageSquareText size={15} className="text-indigo-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-white leading-tight truncate">
                    {targetName} ekranına mesaj
                  </p>
                  <p className="text-[11px] text-[#949ba4] leading-tight">Kayan yazı olarak görünür</p>
                </div>
                <button
                  type="button"
                  onClick={closeBox}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[#949ba4] hover:text-white hover:bg-white/10 transition-colors shrink-0"
                  title="Kapat (Esc)"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Hazır mesajlar */}
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {QUICK_MESSAGES.map((msg) => (
                  <button
                    key={msg}
                    type="button"
                    onClick={() => send(msg)}
                    disabled={cooling}
                    className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-white/[0.06] text-[#dbdee1] border border-white/[0.06] hover:bg-[#5865f2]/20 hover:border-[#5865f2]/40 hover:text-white active:scale-95 disabled:opacity-40 disabled:hover:bg-white/[0.06] disabled:hover:border-white/[0.06] disabled:hover:text-[#dbdee1] disabled:active:scale-100 transition-all"
                  >
                    {msg}
                  </button>
                ))}
              </div>

              {/* Yazma alanı */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
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
                    placeholder="Kısa bir mesaj yaz..."
                    className="w-full h-10 bg-black/30 border border-white/10 text-white text-sm pl-3 pr-12 rounded-xl outline-none placeholder:text-[#5c5e66] focus:border-[#5865f2]/60 focus:shadow-[0_0_0_3px_rgba(88,101,242,0.15)] transition-all"
                  />
                  {/* Kalan karakter: 30'un altına inince görünür */}
                  {remaining <= 30 && (
                    <span
                      className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] tabular-nums font-semibold ${
                        remaining <= 10 ? "text-red-400" : "text-[#949ba4]"
                      }`}
                    >
                      {remaining}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => send()}
                  disabled={!canSend}
                  className="w-10 h-10 rounded-xl bg-[#5865f2] text-white flex items-center justify-center shrink-0 hover:bg-[#4752c4] active:scale-95 disabled:opacity-35 disabled:hover:bg-[#5865f2] disabled:active:scale-100 transition-all shadow-lg shadow-[#5865f2]/25"
                  title={cooling ? `${waitSec} sn sonra gönderebilirsin` : "Gönder (Enter)"}
                >
                  {cooling ? <span className="text-xs font-bold tabular-nums">{waitSec}</span> : <Send size={16} />}
                </button>
              </div>

              {cooling && (
                <p className="mt-2 text-[11px] text-amber-300/90">
                  {wait.limit
                    ? `Dakikada en fazla ${TICKER_MAX_PER_MINUTE} mesaj gönderebilirsin. ${waitSec} sn sonra tekrar yazabilirsin.`
                    : `Mesajlar arasında kısa bir ara gerekiyor (${waitSec} sn).`}
                </p>
              )}
            </div>
          </div>,
          host,
        )}
    </>
  );
}
