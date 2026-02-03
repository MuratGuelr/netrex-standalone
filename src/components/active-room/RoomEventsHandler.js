
import { useEffect, useCallback } from "react";
import { useRoomContext } from "@livekit/components-react";
import { ConnectionState, RoomEvent, Track } from "livekit-client";
import { useSoundEffects } from "@/src/hooks/useSoundEffects";
import { useSettingsStore } from "@/src/store/settingsStore";
import { useAuthStore } from "@/src/store/authStore";
import { useAudioLevelStore } from "@/src/store/audioLevelStore";
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
  const {
    desktopNotifications,
    notifyOnJoin,
    notifyOnLeave,
    notificationSound,
    setInVoiceRoom,
  } = useSettingsStore();
  const { user } = useAuthStore();
  const { startTracking, stopTracking } = useAudioLevelStore();

  // ✅ Merkezi audio level tracking
  useEffect(() => {
    if (room?.state === ConnectionState.Connected) {
      startTracking(room);
    }
    return () => stopTracking();
  }, [room, room?.state, startTracking, stopTracking]);

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

  useEffect(() => {
    if (!room) return;

    const onJoin = (participant) => {
      playSound("join");

      // Bildirim göster (sadece remote participant'lar için)
      if (
        notifyOnJoin &&
        participant &&
        !participant.isLocal &&
        participant.name !== user?.displayName
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

    const onLeave = (participant) => {
      playSound("someone-left");

      // Bildirim göster (sadece remote participant'lar için)
      if (
        notifyOnLeave &&
        participant &&
        !participant.isLocal &&
        participant.name !== user?.displayName
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
    const onRoomConnected = () => {
      // 🚀 v5.2: Ses odasına bağlandı - idle detection'a bildir
      setInVoiceRoom(true);
      
      // Sadece development'ta log göster (spam'i önlemek için)
      if (process.env.NODE_ENV === "development") {
        console.log("Room connected - idle detection disabled");
      }
      if (onConnected) onConnected();
    };

    const onRoomDisconnected = (reason) => {
      // 🚀 v5.2: Ses odasından ayrıldı - idle detection'a bildir
      setInVoiceRoom(false);
      
      // Her zaman log göster (önemli bir event)
      console.log("Room disconnected - idle detection enabled:", reason);
      if (onDisconnected) onDisconnected(reason);
    };

    const onRoomError = (error) => {
      console.error("Room error:", error);
      if (onError) onError(error);
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

    // Room state değişikliklerini izle (güvenli yöntem)
    let lastState = room?.state;
    const checkConnectionState = () => {
      if (!room) return;
      const currentState = room.state;
      // Sadece state gerçekten değiştiğinde işlem yap
      if (currentState !== lastState) {
        lastState = currentState;
        if (currentState === ConnectionState.Connected) {
          onRoomConnected();
        } else if (currentState === ConnectionState.Disconnected) {
          onRoomDisconnected("Connection state changed");
        }
      }
    };

    // İlk kontrol
    checkConnectionState();

    // Reconnecting ve Reconnected handler'larını sakla (cleanup için)
    const onReconnecting = () => {
      if (process.env.NODE_ENV === "development") {
        console.log("Room reconnecting...");
      }
    };
    const onReconnected = () => {
      if (process.env.NODE_ENV === "development") {
        console.log("Room reconnected");
      }
      if (onConnected) onConnected();
    };

    // Event'leri dinle
    room.on(RoomEvent.Connected, onRoomConnected);
    room.on(RoomEvent.Disconnected, onRoomDisconnected);
    room.on(RoomEvent.Reconnecting, onReconnecting);
    room.on(RoomEvent.Reconnected, onReconnected);
    room.on(RoomEvent.ConnectionStateChanged, checkConnectionState);
    room.on(RoomEvent.ParticipantConnected, onJoin);
    room.on(RoomEvent.ParticipantDisconnected, onLeave);
    room.on(RoomEvent.TrackPublished, onTrackPublished);
    room.on(RoomEvent.TrackUnpublished, onTrackUnpublished);
    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);

    // Error event'leri
    if (room.on) {
      // LiveKit room error handling
      room.on("error", onRoomError);
    }

    return () => {
      room.off(RoomEvent.Connected, onRoomConnected);
      room.off(RoomEvent.Disconnected, onRoomDisconnected);
      room.off(RoomEvent.Reconnecting, onReconnecting);
      room.off(RoomEvent.Reconnected, onReconnected);
      room.off(RoomEvent.ConnectionStateChanged, checkConnectionState);
      room.off(RoomEvent.ParticipantConnected, onJoin);
      room.off(RoomEvent.ParticipantDisconnected, onLeave);
      room.off(RoomEvent.TrackPublished, onTrackPublished);
      room.off(RoomEvent.TrackUnpublished, onTrackUnpublished);
      room.off(RoomEvent.TrackSubscribed, onTrackSubscribed);
      if (room.off) {
        room.off("error", onRoomError);
      }
    };
  }, [
    room,
    playSound,
    onConnected,
    onDisconnected,
    onError,
    roomName,
    desktopNotifications,
    notifyOnJoin,
    notifyOnLeave,
    notificationSound,
    showNotification,
    user,
  ]);

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
