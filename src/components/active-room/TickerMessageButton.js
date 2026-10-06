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
 * Görünüm "Hızlı Durum" kısayollarıyla aynı dilde, küçük ve sade: emojili kareler + tek satırlık yazma alanı.
 * Kutu, izlenen yayının kendi kutusunun içine (alt orta) açılır; tam ekranda da aynı yerde kalır ve üst çubuk
 * gizlense bile yazarken kaybolmaz.
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

  // Hazır mesajlarla hızlıca gönderilebildiği için yazma alanına odaklanmıyoruz; yazmak isteyen tıklar.

  // Kutu açıkken bekleme geri sayımı canlı kalsın (menüden ya da buradan gönderilmiş olabilir)
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => forceTick((n) => n + 1), 500);
    return () => clearInterval(t);
  }, [open]);

  // Esc ile kapat (yazma alanında değilken de çalışsın)
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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
            className="absolute left-1/2 -translate-x-1/2 bottom-16 z-[60] w-[232px] max-w-[94%] rounded-2xl border border-white/10 bg-[#111214]/95 backdrop-blur-xl shadow-2xl p-2.5 animate-in fade-in slide-in-from-bottom-2 duration-150"
            // Tıklamalar altındaki yayın kutusuna (çift tıkla tam ekran, sağ tık menüsü vb.) geçmesin
            onMouseDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.stopPropagation()}
          >
            {/* Başlık: "Hızlı Durum" ile aynı küçük büyük harfli stil */}
            <div className="flex items-center justify-between px-1 mb-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <MessageSquareText size={12} className="text-indigo-400 shrink-0" />
                <span className="text-[10px] font-bold text-[#949ba4] uppercase tracking-wider truncate">
                  {targetName}
                </span>
              </div>
              <button
                type="button"
                onClick={closeBox}
                className="w-5 h-5 rounded-md flex items-center justify-center text-[#5c5e66] hover:text-white hover:bg-white/10 transition-colors shrink-0"
                title="Kapat (Esc)"
              >
                <X size={11} />
              </button>
            </div>

            {/* Hazır mesajlar: Hızlı Durum kareleri gibi emoji + küçük etiket */}
            <div className="grid grid-cols-3 gap-1.5">
              {QUICK_MESSAGES.map((m) => (
                <button
                  key={m.text}
                  type="button"
                  onClick={() => send(m.text)}
                  disabled={cooling}
                  title={m.text}
                  className="group/q flex flex-col items-center justify-center h-[52px] rounded-xl border bg-[#1a1b1e] border-white/5 hover:border-white/10 hover:bg-[#202225] active:scale-95 disabled:opacity-40 disabled:hover:bg-[#1a1b1e] disabled:hover:border-white/5 disabled:active:scale-100 transition-all duration-150"
                >
                  <span className="text-lg leading-none mb-0.5 transition-transform duration-150 group-hover/q:scale-110 group-disabled/q:scale-100">
                    {m.icon}
                  </span>
                  <span className="text-[9px] font-semibold text-[#949ba4] group-hover/q:text-white w-full px-1 text-center truncate transition-colors">
                    {m.text}
                  </span>
                </button>
              ))}
            </div>

            {/* Kendin yaz */}
            <div className="flex items-center gap-1.5 mt-2">
              <div className="relative flex-1 min-w-0">
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
                  placeholder="Kendin yaz..."
                  className="w-full h-8 bg-[#1a1b1e] border border-white/5 text-white text-xs pl-2.5 pr-8 rounded-lg outline-none placeholder:text-[#5c5e66] focus:border-[#5865f2]/50 transition-colors"
                />
                {remaining <= 30 && (
                  <span
                    className={`absolute right-2 top-1/2 -translate-y-1/2 text-[9px] tabular-nums font-semibold ${
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
                className="w-8 h-8 rounded-lg bg-[#5865f2] text-white flex items-center justify-center shrink-0 hover:bg-[#4752c4] active:scale-95 disabled:opacity-35 disabled:hover:bg-[#5865f2] disabled:active:scale-100 transition-all"
                title={cooling ? `${waitSec} sn sonra gönderebilirsin` : "Gönder (Enter)"}
              >
                {cooling ? <span className="text-[10px] font-bold tabular-nums">{waitSec}</span> : <Send size={13} />}
              </button>
            </div>

            {cooling && (
              <p className="mt-1.5 px-1 text-[10px] text-amber-300/90 leading-snug">
                {wait.limit
                  ? `Dakikada en fazla ${TICKER_MAX_PER_MINUTE} mesaj. ${waitSec} sn sonra tekrar.`
                  : `Kısa bir ara gerekiyor (${waitSec} sn).`}
              </p>
            )}
          </div>,
          host,
        )}
    </>
  );
}
