
import { useEffect, useCallback, useRef } from "react";
import { useRoomContext } from "@livekit/components-react";
import { ConnectionState, RoomEvent, Track } from "livekit-client";
import { useSoundEffects } from "@/src/hooks/useSoundEffects";
import { useSettingsStore } from "@/src/store/settingsStore";
import { useAuthStore } from "@/src/store/authStore";
import { doc, updateDoc, arrayRemove } from "firebase/firestore";
import { db } from "@/src/lib/firebase";

export default function RoomEventsHandler({
  onConnected,
  onDisconnected,
  onError,
  roomName,
  roomDisplayName,
  userId,
  username,
}) {
  const room = useRoomContext();
  const { playSound } = useSoundEffects();
  const desktopNotifications = useSettingsStore(state => state.desktopNotifications);
  const notifyOnJoin = useSettingsStore(state => state.notifyOnJoin);
  const notifyOnLeave = useSettingsStore(state => state.notifyOnLeave);
  const notificationSound = useSettingsStore(state => state.notificationSound);
  const setInVoiceRoom = useSettingsStore(state => state.setInVoiceRoom);
  const { user } = useAuthStore();

  // Bildirim izni kontrolü ve isteği
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default" && desktopNotifications) {
      // İzin henüz istenmemişse ve bildirimler açıksa, izin iste
      Notification.requestPermission().catch((error) => {
        console.error("Bildirim izni hatası:", error);
      });
    }
  }, [desktopNotifications]);

  // Bildirim gösterme fonksiyonu
  const showNotification = useCallback(
    (title, body, silent = false) => {
      if (!desktopNotifications) return;
      if (typeof window === "undefined" || !("Notification" in window)) return;
      if (Notification.permission !== "granted") {
        // İzin yoksa sessizce devam et (kullanıcı reddetmiş olabilir)
        return;
      }

      // Eğer pencere aktifse bildirim gösterme
      if (document && !document.hidden && document.hasFocus()) return;

      try {
        const notification = new Notification(title, {
          body,
          icon: "/logo.ico",
          badge: "/logo.ico",
          tag: `netrex-${Date.now()}`, // Her bildirimi benzersiz yap
          silent: silent || !notificationSound,
        });

        // Bildirime tıklanınca pencereyi focus et
        notification.onclick = () => {
          if (window.netrex?.focusWindow) {
            window.netrex.focusWindow();
          } else {
            window.focus();
          }
          notification.close();
        };

        // 5 saniye sonra otomatik kapat
        setTimeout(() => notification.close(), 5000);
      } catch (error) {
        console.error("Bildirim hatası:", error);
      }
    },
    [desktopNotifications, notificationSound]
  );


  // ✅ Store callbacks and values in refs to avoid re-registering on every change
  const callbacksRef = useRef({});
  const valuesRef = useRef({});
  
  // Update refs when values change (but don't trigger useEffect)
  useEffect(() => {
    callbacksRef.current = {
      playSound,
      showNotification,
      onConnected,
      onDisconnected,
      setInVoiceRoom,
    };
    valuesRef.current = {
      notifyOnJoin,
      notifyOnLeave,
      userDisplayName: user?.displayName,
      roomDisplayName,
      roomName,
    };
  });

  // ✅ CRITICAL: mikrofon publish guard - sadece 1 kez publish edilsin
  const micPublishedRef = useRef(false);
  
  useEffect(() => {
    if (!room) return;

    // Her yeni room instance'ında mic guard'ı sıfırla
    micPublishedRef.current = false;
    console.log("✅ Registering room event listeners");

    // ✅ FIX: Define callbacks INSIDE useEffect, using refs for fresh values
    const handleJoin = (participant) => {
      const { playSound, showNotification } = callbacksRef.current;
      const { notifyOnJoin, userDisplayName, roomDisplayName, roomName } = valuesRef.current;
      
      playSound("join");

      // Bildirim göster (sadece remote participant'lar için)
      if (
        notifyOnJoin &&
        participant &&
        !participant.isLocal &&
        participant.name !== userDisplayName
      ) {
        showNotification(
          "Kullanıcı Katıldı",
          `${participant.name || "Bir kullanıcı"} ${
            roomDisplayName || roomName ? `"${roomDisplayName || roomName}"` : ""
          } odasına katıldı`,
          false
        );
      }
    };

    const handleLeave = (participant) => {
      const { playSound, showNotification } = callbacksRef.current;
      const { notifyOnLeave, userDisplayName, roomDisplayName, roomName } = valuesRef.current;
      
      setTimeout(() => {
        if (callbacksRef.current && callbacksRef.current.playSound) {
          callbacksRef.current.playSound("left");
        }
      }, 50);

      // ✅ CRITICAL: Explicit track cleanup to prevent resource leak
      // ⚠️ Manual track cleanup REMOVED: LiveKit SDK handles this automatically.
      // Calling stop() manually was causing CPU spikes due to resource conflict.
      if (process.env.NODE_ENV === 'development') {
        console.log(`👤 Participant ${participant?.identity} left - trusting SDK for cleanup`);
      }

      // 🔔 Notification geri açıldı
      if (
        notifyOnLeave &&
        participant &&
        !participant.isLocal &&
        participant.name !== userDisplayName
      ) {
        showNotification(
          "Kullanıcı Ayrıldı",
          `${participant.name || "Bir kullanıcı"} ${
            roomDisplayName || roomName ? `"${roomDisplayName || roomName}"` : ""
          } odasından ayrıldı`,
          false
        );
      }
    };

    // Bağlantı event'leri
    const onRoomConnected = async () => {
      const { setInVoiceRoom, onConnected } = callbacksRef.current;
      
      setInVoiceRoom(true);
      
      // ✅ CRITICAL: Guard ile sadece 1 kez mikrofon publish et
      // Önceki kod: hem Connected event hem ConnectionStateChanged tetikleyince
      // setMicrophoneEnabled 2-3 kez çağrılıyordu = WebRTC renegotiation = CPU spike
      if (micPublishedRef.current) {
        console.log("🎤 Mikrofon zaten publish edildi, atlanıyor");
      } else {
        micPublishedRef.current = true;
        try {
          if (room?.localParticipant) {
            await room.localParticipant.setMicrophoneEnabled(true, {
              echoCancellation: true,
              noiseSuppression: false,
              autoGainControl: true,
              sampleRate: 48000,
              channelCount: 1,
            }, {
              audioBitrate: 96000,
            });
            console.log("🎤 Mikrofon publish edildi (onRoomConnected)");
          }
        } catch (micError) {
          micPublishedRef.current = false; // hata olursa tekrar denenebilsin
          console.warn("⚠️ Mikrofon publish hatası:", micError);
        }
      }

      if (onConnected) onConnected();
    };

    const onRoomDisconnected = (reason) => {
      const { setInVoiceRoom, onDisconnected } = callbacksRef.current;
      
      // 🚀 v5.2: Ses odasından ayrıldı - idle detection'a bildir
      setInVoiceRoom(false);
      
      // Her zaman log göster (önemli bir event)
      console.log("Room disconnected - idle detection enabled:", reason);
      if (onDisconnected) onDisconnected(reason);
    };

    // 🚀 v5.2: LiveKit SDK'da generic "error" eventi yoktur
    // Hatalar genellikle MediaDevicesError veya disconnect olarak gelir
    // MediaDevicesError'u da yakalayıp onError'a yönlendir
    const onMediaDevicesError = (error) => {
      console.error("Room MediaDevicesError:", error);
      // Media device hataları pool rotation tetiklememeli
      // Sadece log'la
    };
    
    // SignalReconnecting - bağlantı sinyalı koptuğunda
    const onSignalReconnecting = () => {
      console.warn("⚠️ Signal connection lost, reconnecting...");
    };

    // Video track publish/unpublish event'lerini dinle (debug için)
    const onTrackPublished = (pub) => {
      if (pub?.source === Track.Source.Camera && pub?.participant?.isLocal) {
        // Sadece development'ta log göster
        if (process.env.NODE_ENV === "development") {
          console.log("📹 Camera track published:", pub.trackSid);
        }
      }
    };

    const onTrackUnpublished = (pub) => {
      if (pub?.source === Track.Source.Camera && pub?.participant?.isLocal) {
        if (process.env.NODE_ENV === "development") {
          console.log("📹 Camera track unpublished");
        }
      }
    };

    // Remote participant'ların track'i subscribe ettiğinde
    const onTrackSubscribed = (track, publication, participant) => {
      console.log("TRACK SUB", participant?.identity);
      if (publication?.source === Track.Source.Camera && participant) {
        if (process.env.NODE_ENV === "development") {
          if (participant.isLocal) {
            console.log(
              "📹 Local participant'ın camera track'i remote tarafından subscribe edildi:",
              {
                trackSid: publication.trackSid,
                subscriber: "remote participant",
              }
            );
          } else {
            console.log(
              "📹 Remote participant'ın camera track'i subscribe edildi:",
              {
                participant: participant.identity,
                trackSid: publication.trackSid,
              }
            );
          }
        }
      }
    };

    // ✅ CRITICAL FIX: checkConnectionState + ConnectionStateChanged kaldırıldı!
    // Eski kod: Connected event + ConnectionStateChanged + ilk checkConnectionState =
    // onRoomConnected 3 kez çağrılıyordu = "already connected to room" log spam
    // ve her seferinde setMicrophoneEnabled → WebRTC renegotiation → CPU spike
    //
    // Yeni davranış: Sadece RoomEvent.Connected dinlenir.
    // Component zaten bağlıyken mount olursa (chat/üyeler aç-kapa),
    // aşağıdaki tek seferlik kontrol devreye girer (guard ile korunmuş).
    if (room.state === ConnectionState.Connected) {
      console.log("ℹ️ Room zaten Connected, tek seferlik init");
      onRoomConnected();
    }

    // Reconnecting ve Reconnected handler'larını sakla (cleanup için)
    const onReconnecting = () => {
      if (process.env.NODE_ENV === "development") {
        console.log("Room reconnecting...");
      }
    };
    const onReconnected = () => {
      const { onConnected } = callbacksRef.current;
      
      if (process.env.NODE_ENV === "development") {
        console.log("Room reconnected");
      }
      if (onConnected) onConnected();
    };

    // Event'leri dinle - Connected ve ConnectionStateChanged AYNI ANDA OLMAMALI
    room.on(RoomEvent.Connected, onRoomConnected);
    room.on(RoomEvent.Disconnected, onRoomDisconnected);
    room.on(RoomEvent.Reconnecting, onReconnecting);
    room.on(RoomEvent.Reconnected, onReconnected);
    // ✅ ConnectionStateChanged kaldırıldı - Connected event yeterli
    room.on(RoomEvent.ParticipantConnected, handleJoin);
    room.on(RoomEvent.ParticipantDisconnected, handleLeave);
    room.on(RoomEvent.TrackPublished, onTrackPublished);
    room.on(RoomEvent.TrackUnpublished, onTrackUnpublished);
    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
    room.on(RoomEvent.MediaDevicesError, onMediaDevicesError);
    room.on(RoomEvent.SignalReconnecting, onSignalReconnecting);

    return () => {
      console.log("🧹 Cleaning up room event listeners");

      room.off(RoomEvent.Connected, onRoomConnected);
      room.off(RoomEvent.Disconnected, onRoomDisconnected);
      room.off(RoomEvent.Reconnecting, onReconnecting);
      room.off(RoomEvent.Reconnected, onReconnected);
      room.off(RoomEvent.ParticipantConnected, handleJoin);
      room.off(RoomEvent.ParticipantDisconnected, handleLeave);
      room.off(RoomEvent.TrackPublished, onTrackPublished);
      room.off(RoomEvent.TrackUnpublished, onTrackUnpublished);
      room.off(RoomEvent.TrackSubscribed, onTrackSubscribed);
      room.off(RoomEvent.MediaDevicesError, onMediaDevicesError);
      room.off(RoomEvent.SignalReconnecting, onSignalReconnecting);
    };
  }, [room]); // ✅ ONLY room dependency - all other values accessed via refs

  // Uygulama kapatıldığında cleanup (beforeunload event + Electron IPC)
  useEffect(() => {
    const cleanup = async () => {
      // LiveKit room'u disconnect et
      if (room && room.state !== ConnectionState.Disconnected) {
        try {
          await room.disconnect();
          console.log("✅ LiveKit room disconnect edildi (app close)");
        } catch (error) {
          console.error("❌ LiveKit disconnect hatası:", error);
        }
      }

      // Firebase'den kullanıcıyı çıkar (keepalive ile gönder - async işlemler tamamlanabilir)
      if (userId && roomName && username) {
        try {
          const presenceRef = doc(db, "room_presence", roomName);
          // beforeunload'da async işlemler tamamlanmayabilir, bu yüzden fetch ile keepalive kullan
          const userData = { 
            userId, 
            username,
            photoURL: user?.photoURL || null
          };
          // Firestore REST API ile cleanup (daha güvenilir)
          await updateDoc(presenceRef, {
            users: arrayRemove(userData),
          });
          console.log("✅ Firestore presence temizlendi (app close)");
        } catch (error) {
          // Document yoksa veya zaten silinmişse sessizce devam et
          if (error.code !== "not-found") {
            console.error("❌ Firestore cleanup hatası:", error);
          }
        }
      }
    };

    // Handle standard browser unload (refresh/close tab)
    const handleBeforeUnload = (e) => {
      // Synchronous/Fast cleanup for browser close
      cleanup().catch(console.error);
    };

    // Electron IPC event listener: Register cleanup task
    let unregisterCleanup = null;
    if (typeof window !== "undefined" && window.netrex) {
      // require instead of import because this is conditional and potentially isomorphic code
      // although imports are usually hoisted, this pattern implies dynamic logic, 
      // but standard import is safer if filepath is static. 
      // Assuming existing code used require for a reason or simply legacy.
      // We will keep similar logic but ensure imports work.
      // Since we are in a module, we should avoid require if possible, but the original code used it.
      // We will try dynamic import for safety or just keep require if this is electron-only part.
      try {
          // Dynamic require or import handled at file level is cleaner
          // but for now keeping logic close to original.
          // Note: In React/Vite, require might not be available. 
          // We will assume the original code worked, but we should probably use window.netrex directly if possible.
          
          if (window.netrex.registerCleanupTask) {
             unregisterCleanup = window.netrex.registerCleanupTask(async () => {
                console.log("🛑 ActiveRoom App closing cleanup started...");
                await cleanup();
             });
          }
      } catch (e) {
          console.error("Cleanup registration failed", e);
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (unregisterCleanup) unregisterCleanup();
      
      // Critical: Explicitly disconnect room on unmount to prevent ghost participants
      if (room && room.state !== ConnectionState.Disconnected) {
          room.disconnect();
      }
    };
  }, [room, roomName, userId, username]);

  return null;
}
