import { useEffect, useRef } from "react";
import { useRoomContext, useLocalParticipant } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { useCursorShareStore } from "@/src/store/cursorShareStore";
import { useSettingsStore } from "@/src/store/settingsStore";
import { useSoundManagerStore } from "@/src/store/soundManagerStore";
import { toast } from "@/src/utils/toast";
import {
  addClick,
  addStrokePoints,
  clearStrokesOf,
  clearFxForTarget,
  clearAllFx,
} from "@/src/utils/pointerFx";

/**
 * 🖱️ İşaretçi paylaşımı denetleyicisi — odada TEK KEZ çalışır (ActiveRoom'da bir kez bağlanır).
 *
 * Eskiden bu mantık her video kutusunda (useCursorBroadcast) ayrı çalışıyordu: dinleyiciler tekrarlanıyor,
 * kutu yeniden bağlanınca izinler siliniyor ve overlay kendi kendine kapanıyordu.
 *
 * Sorumluluklar:
 *  - Gelen tüm işaretçi mesajlarını işlemek (konum, istek, izin, tıklama, çizim, oturum bitişi)
 *  - Ekran paylaşan kişinin masaüstü overlay'ini senkron tutmak (imleçler + izin istekleri)
 *  - Overlay'deki "İzin Ver / Reddet / Kaldır" düğmelerini işlemek
 *  - Yayın başlayınca/bitince izleyicileri bilgilendirmek, odadan çıkınca temizlenmek
 */

export const CURSOR_TOPICS = {
  POSITION: "cursor_position",
  HIDE: "cursor_hide",
  REQUEST: "cursor_request",
  PERMISSION: "cursor_permission",
  CLICK: "cursor_click",
  DRAW: "cursor_draw",
  DRAW_CLEAR: "cursor_draw_clear",
  SESSION_START: "cursor_session_start",
  SESSION_END: "cursor_session_end",
};

const CURSOR_STALE_TIMEOUT = 3000; // 3 saniye hareketsizlik → imleç gizle
const MAX_PAYLOAD_BYTES = 16 * 1024;

const encode = (obj) => new TextEncoder().encode(JSON.stringify(obj));

function publish(localParticipant, topic, obj, reliable = true) {
  try {
    localParticipant?.publishData(encode({ type: topic, ...obj }), { topic, reliable });
  } catch (e) {}
}

function readMeta(participant) {
  try {
    return participant?.metadata ? JSON.parse(participant.metadata) : {};
  } catch (e) {
    return {};
  }
}

function resolveName(participant, fallbackName, id) {
  if (fallbackName && fallbackName !== id) return fallbackName;
  const md = readMeta(participant);
  return participant?.name || md.displayName || md.username || id;
}

// ──────────────────────────────────────
// Eylemler (izleyici ↔ yayıncı) — kutulardaki useCursorBroadcast da bunları kullanır
// ──────────────────────────────────────
export function sendPointingRequest(localParticipant, targetIdentity) {
  if (!localParticipant) return;
  const md = readMeta(localParticipant);
  publish(localParticipant, CURSOR_TOPICS.REQUEST, {
    participantId: localParticipant.identity,
    displayName: md.displayName || localParticipant.name || localParticipant.identity,
  });
  useCursorShareStore.getState().addPendingRequest(targetIdentity);
  toast.info("İşaretçi izni istendi, bekleniyor...");
}

export function sendPointingGrant(localParticipant, room, targetIdentity) {
  if (!localParticipant || !room) return;
  const store = useCursorShareStore.getState();
  const requester = store.pointingRequests[targetIdentity];
  const displayName = resolveName(
    room.remoteParticipants.get(targetIdentity),
    requester?.displayName,
    targetIdentity,
  );
  publish(localParticipant, CURSOR_TOPICS.PERMISSION, { targetId: targetIdentity, value: true });
  store.grantPointingPermission(targetIdentity, displayName);
  toast.success(`${displayName} için işaretçi izni verildi.`);
}

export function sendPointingDeny(localParticipant, targetIdentity) {
  if (!localParticipant) return;
  publish(localParticipant, CURSOR_TOPICS.PERMISSION, { targetId: targetIdentity, value: false });
  const store = useCursorShareStore.getState();
  // Yayıncıya da doğru mesaj: izin vermiştiysem "kaldırıldı", bekleyen istekse "reddedildi"
  const wasAllowed = !!store.allowedPointers[targetIdentity];
  store.removePointingRequest(targetIdentity);
  store.revokePointingPermission(targetIdentity);
  store.removeRemoteCursor(targetIdentity);
  if (wasAllowed) toast.info("İşaretçi izni kaldırıldı.");
  else toast.error("İşaretçi isteği reddedildi.");
}

// ──────────────────────────────────────
// Denetleyici hook
// ──────────────────────────────────────
export function useCursorShareController() {
  const room = useRoomContext();
  const { localParticipant, isScreenShareEnabled } = useLocalParticipant();
  const identity = localParticipant?.identity;
  const isSharing = !!isScreenShareEnabled;

  // ── 1) Gelen mesajlar ──────────────────
  useEffect(() => {
    if (!room || !identity) return;

    const staleTimers = new Map();
    const store = () => useCursorShareStore.getState();
    const overlay = () => (typeof window !== "undefined" ? window.netrex : null);

    const clearStale = (id) => {
      const t = staleTimers.get(id);
      if (t) {
        clearTimeout(t);
        staleTimers.delete(id);
      }
    };

    // Yayıncı tarafı: sadece İZİNLİ kullanıcıların efektleri masaüstü overlay'ine iletilir
    const forwardToOverlay = (senderId, evt) => {
      const s = store();
      if (!s.allowedPointers[senderId]) return;
      overlay()?.sendPointerOverlayEvent?.(evt);
    };

    const handleRequest = (senderId, participant, msg) => {
      // Zaten bekleyen/izinli istek varsa tekrar rahatsız etme
      const s = store();
      if (s.pointingRequests[senderId] || s.allowedPointers[senderId]) return;

      const name = resolveName(participant, msg.displayName, senderId);
      s.addPointingRequest(senderId, name);

      try {
        const sfx = useSettingsStore.getState().sfxVolume ?? 100;
        useSoundManagerStore.getState().play("discord-ping", Math.min(1, (sfx / 100) * 0.5));
      } catch (e) {}

      const toastId = `ptr-req-${senderId}`;
      const doGrant = () => {
        sendPointingGrant(localParticipant, room, senderId);
        toast.dismiss(toastId);
      };
      const doDeny = () => {
        sendPointingDeny(localParticipant, senderId);
        toast.dismiss(toastId);
      };

      // Masaüstü uygulamasında overlay + ana süreç bildirimi devreye girer (oyunun üstünde de görünür).
      // Tarayıcıda (web) klasik bildirim denenir.
      if (!overlay()?.updatePointerOverlay) {
        try {
          if (typeof Notification !== "undefined") {
            if (Notification.permission === "granted") {
              const n = new Notification("Netrex - İşaretçi İsteği", {
                body: `${name} ekranınızda bir şey göstermek istiyor`,
                silent: true,
              });
              n.onclick = () => doGrant();
              setTimeout(() => { try { n.close(); } catch (e) {} }, 12000);
            } else if (Notification.permission === "default") {
              Notification.requestPermission();
            }
          }
        } catch (e) {}
      }

      toast.info(`${name} ekranınızda bir şey göstermek istiyor`, {
        id: toastId,
        duration: 10000,
        action: { label: "İzin Ver", onClick: doGrant },
        cancel: { label: "Reddet", onClick: doDeny },
      });
    };

    const handleData = (payload, participant, _kind, topic) => {
      // Sunucu kaynaklı mesajlarda gönderen yoktur; işaretçi mesajları her zaman bir katılımcıdan gelir
      if (!participant || !payload || payload.byteLength > MAX_PAYLOAD_BYTES) return;
      if (!topic || !topic.startsWith("cursor_")) return;

      let msg;
      try {
        msg = JSON.parse(new TextDecoder().decode(payload));
      } catch (e) {
        return;
      }
      if (!msg || typeof msg !== "object") return;

      // Gönderen kimliği LiveKit'ten gelir; mesajın içindeki iddiaya güvenilmez (taklit edilemesin)
      const senderId = participant.identity;
      if (!senderId || senderId === identity) return;
      const s = store();

      switch (topic) {
        case CURSOR_TOPICS.POSITION: {
          if (!s.showRemoteCursors) return;
          s.updateRemoteCursor(senderId, {
            x: msg.x,
            y: msg.y,
            screenWidth: msg.screenWidth,
            screenHeight: msg.screenHeight,
            displayName: msg.displayName || senderId,
            color: msg.color || "#6366f1",
            targetId: msg.targetId || senderId,
          });
          clearStale(senderId);
          staleTimers.set(
            senderId,
            setTimeout(() => {
              staleTimers.delete(senderId);
              store().removeRemoteCursor(senderId);
            }, CURSOR_STALE_TIMEOUT),
          );
          break;
        }

        case CURSOR_TOPICS.HIDE:
          s.removeRemoteCursor(senderId);
          clearStale(senderId);
          break;

        case CURSOR_TOPICS.REQUEST:
          handleRequest(senderId, participant, msg);
          break;

        case CURSOR_TOPICS.PERMISSION:
          if (msg.targetId === identity) {
            // "false" iki anlama gelir: istek reddedildi VEYA verilmiş izin geri alındı.
            // Önceden iznim varsa bu bir hata değil, normal bir kapanıştır.
            const hadPermission = !!s.myPermissions[senderId];
            s.setMyPermission(senderId, !!msg.value);
            s.removePendingRequest(senderId);
            if (msg.value) toast.success("Ekran sahibi işaretçi izni verdi!");
            else if (hadPermission) toast.info("Ekran sahibi işaretçi paylaşımını kapattı.");
            else toast.error("Ekran sahibi işaretçi isteğini reddetti.");
          }
          break;

        case CURSOR_TOPICS.CLICK: {
          const targetId = msg.targetId;
          if (!targetId) return;
          addClick({ targetId, x: msg.x, y: msg.y, color: msg.color });
          if (targetId === identity) {
            forwardToOverlay(senderId, { type: "click", x: msg.x, y: msg.y, color: msg.color });
          }
          break;
        }

        case CURSOR_TOPICS.DRAW: {
          const targetId = msg.targetId;
          if (!targetId || typeof msg.strokeId !== "string") return;
          const strokeId = msg.strokeId.slice(0, 80);
          addStrokePoints({ strokeId, pid: senderId, targetId, color: msg.color, points: msg.points });
          if (targetId === identity) {
            forwardToOverlay(senderId, {
              type: "draw",
              strokeId,
              participantId: senderId,
              color: msg.color,
              points: msg.points,
            });
          }
          break;
        }

        case CURSOR_TOPICS.DRAW_CLEAR:
          clearStrokesOf(senderId, msg.targetId);
          if (msg.targetId === identity) {
            forwardToOverlay(senderId, { type: "draw_clear", participantId: senderId });
          }
          break;

        // Yayıncı yayını başlattı/bitirdi: eski izinler geçersiz (sessizce sıfırla)
        case CURSOR_TOPICS.SESSION_START:
        case CURSOR_TOPICS.SESSION_END:
          s.setMyPermission(senderId, false);
          s.removePendingRequest(senderId);
          clearFxForTarget(senderId);
          Object.entries(s.remoteCursors).forEach(([id, c]) => {
            if (c.targetId === senderId) s.removeRemoteCursor(id);
          });
          break;

        default:
          break;
      }
    };

    // Katılımcı odadan çıktı: izni, isteği ve imleci kalmasın
    const handleParticipantLeft = (p) => {
      const id = p?.identity;
      if (!id) return;
      const s = store();
      s.removeRemoteCursor(id);
      s.removePointingRequest(id);
      s.revokePointingPermission(id);
      s.setMyPermission(id, false);
      s.removePendingRequest(id);
      clearStale(id);
      clearStrokesOf(id);
      clearFxForTarget(id);
    };

    room.on(RoomEvent.DataReceived, handleData);
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantLeft);
    return () => {
      room.off(RoomEvent.DataReceived, handleData);
      room.off(RoomEvent.ParticipantDisconnected, handleParticipantLeft);
      staleTimers.forEach((t) => clearTimeout(t));
      staleTimers.clear();
    };
  }, [room, identity, localParticipant]);

  // ── 2) Overlay senkronu (yalnızca ekran paylaşırken) ──────────────
  useEffect(() => {
    if (!isSharing || !identity) return;
    const api = typeof window !== "undefined" ? window.netrex : null;
    if (!api?.updatePointerOverlay) return;

    let timer = null;
    let last = 0;

    const push = () => {
      timer = null;
      last = Date.now();
      const s = useCursorShareStore.getState();
      // İzinli herkes listelenir; konumu varsa imleci çizilir (hareketsiz kalanı listeden düşmesin)
      const pointers = Object.entries(s.allowedPointers).map(([id, info]) => {
        const c = s.remoteCursors[id];
        const hasPos = c && c.targetId === identity;
        return {
          id,
          name: c?.displayName || info?.displayName || "Kullanıcı",
          color: c?.color || "#6366f1",
          x: hasPos ? c.x : null,
          y: hasPos ? c.y : null,
        };
      });
      const requests = Object.entries(s.pointingRequests).map(([id, r]) => ({
        id,
        name: r?.displayName || "Kullanıcı",
      }));
      api.updatePointerOverlay({ pointers, requests });
    };

    const schedule = () => {
      if (timer) return;
      timer = setTimeout(push, Math.max(0, 33 - (Date.now() - last)));
    };

    const unsub = useCursorShareStore.subscribe((state, prev) => {
      if (
        state.remoteCursors !== prev.remoteCursors ||
        state.allowedPointers !== prev.allowedPointers ||
        state.pointingRequests !== prev.pointingRequests
      ) {
        schedule();
      }
    });
    schedule();

    return () => {
      unsub();
      if (timer) clearTimeout(timer);
    };
  }, [isSharing, identity]);

  // ── 3) Overlay'deki düğmeler (İzin Ver / Reddet / Kaldır / Kapat) ──────────────
  useEffect(() => {
    const api = typeof window !== "undefined" ? window.netrex : null;
    if (!api || !room || !localParticipant) return;
    const cleanups = [];

    if (api.onPointerOverlayGranted) {
      cleanups.push(api.onPointerOverlayGranted((id) => sendPointingGrant(localParticipant, room, id)));
    }
    if (api.onPointerOverlayDenied) {
      cleanups.push(api.onPointerOverlayDenied((id) => sendPointingDeny(localParticipant, id)));
    }
    if (api.onPointerOverlayRevoked) {
      cleanups.push(api.onPointerOverlayRevoked((id) => sendPointingDeny(localParticipant, id)));
    }
    if (api.onPointerOverlayRevokeAll) {
      cleanups.push(
        api.onPointerOverlayRevokeAll(() => {
          const s = useCursorShareStore.getState();
          new Set([...Object.keys(s.allowedPointers), ...Object.keys(s.pointingRequests)]).forEach((id) =>
            sendPointingDeny(localParticipant, id),
          );
        }),
      );
    }
    return () => cleanups.forEach((c) => c && c());
  }, [room, localParticipant]);

  // ── 4) Yayın başladı / bitti ──────────────
  // İlk değer "geçiş" sayılmaz; yalnızca gerçek başlangıç/bitiş izleyicilere bildirilir
  const prevSharingRef = useRef(undefined);
  useEffect(() => {
    if (!localParticipant) return;
    const prev = prevSharingRef.current;
    prevSharingRef.current = isSharing;
    if (prev === undefined || prev === isSharing) return;

    if (isSharing) {
      publish(localParticipant, CURSOR_TOPICS.SESSION_START, { participantId: localParticipant.identity });
    } else {
      publish(localParticipant, CURSOR_TOPICS.SESSION_END, { participantId: localParticipant.identity });
      useCursorShareStore.getState().clearRemoteCursors();
      clearFxForTarget(localParticipant.identity);
      if (typeof window !== "undefined") window.netrex?.closePointerOverlay?.();
    }
  }, [isSharing, localParticipant]);

  // ── 5) Odadan çıkınca / bileşen sökülünce her şeyi temizle ──────────────
  useEffect(() => {
    if (!room) return;
    const cleanup = () => {
      useCursorShareStore.getState().clearRemoteCursors();
      clearAllFx();
      if (typeof window !== "undefined") window.netrex?.closePointerOverlay?.();
    };
    room.on(RoomEvent.Disconnected, cleanup);
    return () => {
      room.off(RoomEvent.Disconnected, cleanup);
      cleanup();
    };
  }, [room]);
}
