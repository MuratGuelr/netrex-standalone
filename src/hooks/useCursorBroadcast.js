import { useEffect, useRef, useCallback } from 'react';
import { useRoomContext, useLocalParticipant } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';
import { useCursorShareStore } from '@/src/store/cursorShareStore';
import { toast } from "@/src/utils/toast";

/**
 * 🖱️ Cursor Broadcasting Hook
 * 
 * Ekran paylaşımı yapan kullanıcının mouse pozisyonunu
 * LiveKit Data Channel üzerinden diğer katılımcılara gönderir.
 */

const CURSOR_SEND_INTERVAL = 33; // ~30fps
const CURSOR_STALE_TIMEOUT = 3000; // 3 saniye hareketsizlik → cursor gizle
const CURSOR_DATA_TOPIC = 'cursor_position';
const CURSOR_HIDE_TOPIC = 'cursor_hide';
const CURSOR_REQUEST_TOPIC = 'cursor_request';
const CURSOR_PERMISSION_TOPIC = 'cursor_permission'; // value: true/false


export function useCursorBroadcast({ isScreenSharing = false }) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  
  const shareMyCursor = useCursorShareStore(s => s.shareMyCursor);
  const showRemoteCursors = useCursorShareStore(s => s.showRemoteCursors);
  const updateRemoteCursor = useCursorShareStore(s => s.updateRemoteCursor);
  const removeRemoteCursor = useCursorShareStore(s => s.removeRemoteCursor);
  const clearRemoteCursors = useCursorShareStore(s => s.clearRemoteCursors);
  const setIsBroadcasting = useCursorShareStore(s => s.setIsBroadcasting);
  
  const addPointingRequest = useCursorShareStore(s => s.addPointingRequest);
  const removePointingRequest = useCursorShareStore(s => s.removePointingRequest);
  const grantPointingPermission = useCursorShareStore(s => s.grantPointingPermission);
  const revokePointingPermission = useCursorShareStore(s => s.revokePointingPermission);
  const allowedPointers = useCursorShareStore(s => s.allowedPointers);
  const pointingRequests = useCursorShareStore(s => s.pointingRequests);
  const myPermissions = useCursorShareStore(s => s.myPermissions);
  const setMyPermission = useCursorShareStore(s => s.setMyPermission);

  const lastSentRef = useRef(0);
  const lastPosRef = useRef({ x: -1, y: -1 });
  const staleTimersRef = useRef(new Map());
  const isActiveRef = useRef(false);

  // ──────────────────────────────────────
  // Electron mouse position capture
  // ──────────────────────────────────────
  useEffect(() => {
    if (!isScreenSharing || !shareMyCursor || !room || !localParticipant) {
      if (isActiveRef.current) {
        isActiveRef.current = false;
        setIsBroadcasting(false);
        try {
          const data = new TextEncoder().encode(JSON.stringify({
            type: CURSOR_HIDE_TOPIC,
            participantId: localParticipant?.identity
          }));
          localParticipant?.publishData(data, {
            topic: CURSOR_HIDE_TOPIC,
            reliable: true
          });
        } catch(e) {}
      }
      return;
    }

    isActiveRef.current = true;
    setIsBroadcasting(true);

    let metadata = {};
    try {
      metadata = localParticipant.metadata ? JSON.parse(localParticipant.metadata) : {};
    } catch(e) {}

    let mouseTracker = null;

    const sendCursorPosition = (x, y, screenWidth, screenHeight) => {
      // 🚀 OPTIMIZATION: Eğer mouse gram hareket etmediyse (inaktif) boşuna data gönderme
      if (lastPosRef.current.x === x && lastPosRef.current.y === y) return;

      const now = Date.now();
      if (now - lastSentRef.current < CURSOR_SEND_INTERVAL) return;
      
      lastSentRef.current = now;
      lastPosRef.current = { x, y };

      const normalizedX = x / screenWidth;
      const normalizedY = y / screenHeight;

      try {
        const data = new TextEncoder().encode(JSON.stringify({
          type: CURSOR_DATA_TOPIC,
          participantId: localParticipant.identity,
          targetId: localParticipant.identity,
          x: normalizedX,
          y: normalizedY,
          screenWidth,
          screenHeight,
          displayName: metadata.displayName || localParticipant.name || localParticipant.identity,
          color: metadata.profileColor || '#6366f1'
        }));

        localParticipant.publishData(data, {
          topic: CURSOR_DATA_TOPIC,
          reliable: false 
        });
      } catch (error) {}
    };

    if (typeof window !== 'undefined' && window.netrex?.getMousePosition) {
      mouseTracker = setInterval(async () => {
        try {
          const pos = await window.netrex.getMousePosition();
          if (pos) {
            sendCursorPosition(pos.x, pos.y, pos.screenWidth, pos.screenHeight);
          }
        } catch(e) {}
      }, CURSOR_SEND_INTERVAL);
    } else {
      const handleMouseMove = (e) => {
        sendCursorPosition(
          e.screenX || e.clientX,
          e.screenY || e.clientY,
          window.screen.width,
          window.screen.height
        );
      };

      document.addEventListener('mousemove', handleMouseMove, { passive: true });
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        isActiveRef.current = false;
        setIsBroadcasting(false);
      };
    }

    return () => {
      if (mouseTracker) clearInterval(mouseTracker);
      isActiveRef.current = false;
      setIsBroadcasting(false);
      // Clear global overlay
      if (window.netrex?.closePointerOverlay) {
        window.netrex.closePointerOverlay();
      }
    };
  }, [isScreenSharing, shareMyCursor, room, localParticipant, setIsBroadcasting]);

  // 🤝 Collaborative Pointer Request (Viewer -> Sharer)
  const requestPointing = useCallback((targetIdentity) => {
    if (!localParticipant || !room) return;
    try {
      let md = {};
      try { md = localParticipant.metadata ? JSON.parse(localParticipant.metadata) : {}; } catch(e) {}
      const displayNameToSend = md.displayName || localParticipant.name || localParticipant.identity;

      const data = new TextEncoder().encode(JSON.stringify({
        type: CURSOR_REQUEST_TOPIC,
        participantId: localParticipant.identity,
        displayName: displayNameToSend
      }));
      localParticipant.publishData(data, { topic: CURSOR_REQUEST_TOPIC, reliable: true });
      
      // ✅ Add to local pending requests
      useCursorShareStore.getState().addPendingRequest(targetIdentity);
      
      toast.info("İşaretçi izni istendi, bekleniyor...");
    } catch(e) {}
  }, [localParticipant, room]);

  // 🤝 Collaborative Pointer Grant (Sharer -> Viewer)
  const grantPointing = useCallback((targetIdentity) => {
    if (!localParticipant || !room) return;
    try {
      const requester = pointingRequests[targetIdentity];
      // Resolve name: first from request, then from room participants, finally UID
      let displayName = requester?.displayName;
      if (!displayName || displayName === targetIdentity) {
        const rp = room.remoteParticipants.get(targetIdentity);
        if (rp) {
          try {
            const rpMd = rp.metadata ? JSON.parse(rp.metadata) : {};
            displayName = rp.name || rpMd.displayName || rpMd.username || targetIdentity;
          } catch(e2) { displayName = rp.name || targetIdentity; }
        } else {
          displayName = targetIdentity;
        }
      }

      const data = new TextEncoder().encode(JSON.stringify({
        type: CURSOR_PERMISSION_TOPIC,
        targetId: targetIdentity,
        value: true
      }));
      localParticipant.publishData(data, { topic: CURSOR_PERMISSION_TOPIC, reliable: true });
      grantPointingPermission(targetIdentity, displayName);
      toast.success(`${displayName} için işaretçi izni verildi.`);
    } catch(e) {}
  }, [localParticipant, room, grantPointingPermission, pointingRequests]);

  const handleOverlaySync = useCallback(() => {
    if (!isScreenSharing || !window.netrex?.updatePointerOverlay) return;
    const allCursors = useCursorShareStore.getState().remoteCursors;
    const allowed = useCursorShareStore.getState().allowedPointers;
    
    const pointersToSync = Object.entries(allCursors)
      .filter(([id, c]) => id !== localParticipant?.identity && allowed[id] && c.targetId === localParticipant?.identity)
      .map(([id, c]) => ({
         id,
         x: c.x,
         y: c.y,
         name: c.displayName,
         color: c.color
      }));
    
    window.netrex.updatePointerOverlay(pointersToSync);
  }, [isScreenSharing, localParticipant]);

  // 🤝 Collaborative Pointer Deny (Sharer -> Viewer)
  const denyPointing = useCallback((targetIdentity) => {
    if (!localParticipant || !room) return;
    try {
      const data = new TextEncoder().encode(JSON.stringify({
        type: CURSOR_PERMISSION_TOPIC,
        targetId: targetIdentity,
        value: false
      }));
      localParticipant.publishData(data, { topic: CURSOR_PERMISSION_TOPIC, reliable: true });
      
      // Talebi sil
      removePointingRequest(targetIdentity);
      
      // Varsa izni de kaldır!
      revokePointingPermission(targetIdentity);
      removeRemoteCursor(targetIdentity);
      
      // Overlay UI'yi anında güncelle (kullanıcı listeden silinsin)
      handleOverlaySync();
      
      toast.error("İşaretçi izni reddedildi/kaldırıldı.");
    } catch(e) {}
  }, [localParticipant, room, removePointingRequest, revokePointingPermission, removeRemoteCursor, handleOverlaySync]);

  // 🤝 Handle IPC Revoke (overlay'den kullanıcı kaldırıldığında veya kapatıldığında)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const cleanups = [];
    
    if (window.netrex?.onPointerOverlayRevoked) {
      cleanups.push(window.netrex.onPointerOverlayRevoked((id) => {
        denyPointing(id);
      }));
    }
    
    if (window.netrex?.onPointerOverlayRevokeAll) {
      cleanups.push(window.netrex.onPointerOverlayRevokeAll(() => {
        // Overlay'i kapatan kullanıcı tüm izinleri geri alır!
        const allowed = useCursorShareStore.getState().allowedPointers;
        Object.keys(allowed).forEach(id => {
          denyPointing(id);
        });
      }));
    }
    
    return () => cleanups.forEach(c => c());
  }, [denyPointing]);

  // ──────────────────────────────────────
  // Receive remote cursors via Data Channel
  // ──────────────────────────────────────
  useEffect(() => {
    if (!room || !showRemoteCursors) return;

    const handleDataReceived = (payload, participant) => {
      try {
        const text = new TextDecoder().decode(payload);
        const msg = JSON.parse(text);

        if (msg.participantId === localParticipant?.identity) return;

        if (msg.type === CURSOR_DATA_TOPIC) {
          updateRemoteCursor(msg.participantId, {
            x: msg.x, y: msg.y,
            screenWidth: msg.screenWidth, screenHeight: msg.screenHeight,
            displayName: msg.displayName || msg.participantId,
            color: msg.color || '#6366f1',
            targetId: msg.targetId || msg.participantId
          });

          const existingTimer = staleTimersRef.current.get(msg.participantId);
          if (existingTimer) clearTimeout(existingTimer);
          staleTimersRef.current.set(msg.participantId, setTimeout(() => {
            removeRemoteCursor(msg.participantId);
            staleTimersRef.current.delete(msg.participantId);
            handleOverlaySync();
          }, CURSOR_STALE_TIMEOUT));

          // 🤝 Global Overlay Sync (Sharer side): Eğer ekran paylaşıyorsak, 
          // başkalarının işaretçilerini desktop overlay penceresine gönder
          handleOverlaySync();
        }
        
        // 🤝 Pointing Talebi Geldi (Sharer tarafı)
        else if (msg.type === CURSOR_REQUEST_TOPIC) {
          const requesterId = msg.participantId;
          const requesterName = msg.displayName;
          
          // Zaten talep varsa tekrar gösterip kastırma
          const currentRequests = useCursorShareStore.getState().pointingRequests;
          if (currentRequests[requesterId]) return;

          const remoteParticipant = room.remoteParticipants.get(requesterId) || room.participants.get(requesterId);
          const pMd = remoteParticipant?.metadata ? JSON.parse(remoteParticipant.metadata) : {};
          const resolvedName = (requesterName && requesterName !== requesterId) ? requesterName : (remoteParticipant?.name || pMd.displayName || pMd.username || requesterId);

          addPointingRequest(requesterId, resolvedName);

          // 🔔 Ses çal
          try {
            const ping = new Audio('/sounds/discord-ping.mp3');
            ping.volume = 0.5;
            ping.play().catch(() => {});
          } catch(e) {}

          // 🖥️ Masaüstü bildirimi — tıklarsa otomatik izin ver
          let nativeNotif = null;
          const toastId = `ptr-req-${requesterId}`;

          const doGrant = () => {
            grantPointing(requesterId);
            toast.dismiss(toastId);
            if (nativeNotif) try { nativeNotif.close(); } catch(e) {}
          };
          const doDeny = () => {
            denyPointing(requesterId);
            toast.dismiss(toastId);
            if (nativeNotif) try { nativeNotif.close(); } catch(e) {}
          };

          try {
            if (Notification.permission === 'granted') {
              nativeNotif = new Notification('Netrex - İşaretçi İsteği', {
                body: `${resolvedName} ekranınızda bir şey göstermek istiyor`,
                icon: '/icon.png',
                silent: true,
              });
              nativeNotif.onclick = () => doGrant();
              setTimeout(() => { if (nativeNotif) try { nativeNotif.close(); } catch(e) {} }, 12000);
            } else if (Notification.permission === 'default') {
              Notification.requestPermission();
            }
          } catch(e) {}

          toast.info(`${resolvedName} ekranınızda bir şey göstermek istiyor`, {
            id: toastId,
            duration: 10000,
            action: { label: "İzin Ver", onClick: () => doGrant() },
            cancel: { label: "Reddet", onClick: () => doDeny() }
          });
        }
        
        // 🤝 Pointing İzni Geldi (Viewer tarafı)
        else if (msg.type === CURSOR_PERMISSION_TOPIC) {
          if (msg.targetId === localParticipant?.identity) {
            setMyPermission(participant.identity, msg.value);
            // ✅ Remove from local pending requests
            useCursorShareStore.getState().removePendingRequest(participant.identity);
            if (msg.value) {
              toast.success("Ekran sahibi işaretçi izni verdi!");
            } else {
              toast.error("Ekran sahibi işaretçi iznini reddetti.");
            }
          }
        }

        else if (msg.type === CURSOR_HIDE_TOPIC) {
          removeRemoteCursor(msg.participantId);
          const timer = staleTimersRef.current.get(msg.participantId);
          if (timer) {
            clearTimeout(timer);
            staleTimersRef.current.delete(msg.participantId);
          }
          handleOverlaySync();
        }
      } catch (e) {}
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
      for (const timer of staleTimersRef.current.values()) clearTimeout(timer);
      staleTimersRef.current.clear();
    };
  }, [room, showRemoteCursors, localParticipant, updateRemoteCursor, removeRemoteCursor, grantPointing, denyPointing, addPointingRequest, setMyPermission]);

  useEffect(() => {
    return () => { 
      clearRemoteCursors(); 
      if (window.netrex?.closePointerOverlay) {
        window.netrex.closePointerOverlay();
      }
    };
  }, [clearRemoteCursors]);

  return {
    isBroadcasting: isActiveRef.current,
    requestPointing, grantPointing, denyPointing,
    myPermissions, allowedPointers, pointingRequests
  };
}
