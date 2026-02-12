import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useTracks,
  AudioTrack,
} from "@livekit/components-react";
import {
  Track,
  DisconnectReason,
} from "livekit-client";
import "@livekit/components-styles";
import {
  MessageSquare,
  Users,
  ChevronLeft,
  ChevronRight,
  Volume2,
} from "lucide-react";
import SettingsModal from "./SettingsModal";
import UserContextMenu from "./UserContextMenu";

import { useSettingsStore } from "@/src/store/settingsStore";
import { useVoiceProcessor } from "@/src/hooks/useVoiceProcessor";
import { useSoundEffects } from "@/src/hooks/useSoundEffects";
import { useAuthStore } from "@/src/store/authStore";
import { useChatStore } from "@/src/store/chatStore";
import { useServerStore } from "@/src/store/serverStore";
import { useApplyParticipantVolumes } from "@/src/hooks/useApplyParticipantVolumes";
import { db } from "@/src/lib/firebase";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { styleInjection } from "./active-room/ActiveRoomStyles";

import BottomControls from "./active-room/BottomControls";
import StageManager from "./active-room/StageManager";
import ScreenShareManager from "./active-room/ScreenShareManager";
import GlobalChatListener from "./active-room/GlobalChatListener";
import SettingsUpdater from "./active-room/SettingsUpdater";
import ConnectionStatusIndicator from "./active-room/ConnectionStatusIndicator";
import RoomEventsHandler from "./active-room/RoomEventsHandler";
import ModerationHandler from "./active-room/ModerationHandler";

// --- STYLES ---
// Styles moved to active-room/ActiveRoomStyles.js
const MemoizedBackground = React.memo(({ disableEffects }) => {
  if (disableEffects) return null;
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Animasyonları azalttık, static render */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-indigo-500/[0.04] rounded-full blur-[100px] will-change-opacity" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-500/[0.03] rounded-full blur-[80px] will-change-opacity" />
    </div>
  );
});

// 2. İzole Edilmiş Mikrofon Yöneticisi
const MemoizedMicrophoneManager = React.memo(() => {
  const audioTracks = useTracks([Track.Source.Microphone]);
  const { userVolumes } = useSettingsStore();

  return (
    <>
      {audioTracks.map((trackRef) => {
        const isRemote = !trackRef.participant.isLocal;
        const volumePercent = isRemote ? userVolumes[trackRef.participant.identity] ?? 100 : undefined;
        
        // Hesaplamayı render içinde yap, component dışında değil
        const volume = volumePercent !== undefined
            ? volumePercent === 0
              ? 0
              : volumePercent <= 100
              ? Math.pow(volumePercent / 100, 2.5)
              : Math.min(1.0 - ((200 - volumePercent) / 100) * 0.2, 1.0)
            : undefined;

        return (
          <AudioTrack
            key={trackRef.publication.trackSid}
            trackRef={trackRef}
            volume={isRemote ? volume : undefined}
          />
        );
      })}
    </>
  );
});



// GlobalChatListener moved to active-room/GlobalChatListener.js

// VoiceProcessorHandler
function VoiceProcessorHandler() {
  const { rawAudioMode } = useSettingsStore();
  
  // ✅ Volume applicator - Store'daki volume değerlerini track'lere uygula
  useApplyParticipantVolumes();
  
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.log("🎤 VoiceProcessorHandler mounted, rawAudioMode:", rawAudioMode);
    }
  }, [rawAudioMode]);

  if (!rawAudioMode) useVoiceProcessor();
  return null;
}

// Inline styles backup to ensure animations work even if import fails
const criticalStyles = `
  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 15px var(--pulse-color); border-color: var(--pulse-color); }
    50% { box-shadow: 0 0 25px var(--pulse-color); border-color: var(--pulse-color); }
  }
`;

function DeafenManager({ isDeafened, serverDeafened }) {
  useEffect(() => {
    const muteAll = () => {
      document.querySelectorAll("audio").forEach((el) => {
        el.muted = isDeafened || serverDeafened;
      });
    };
    muteAll();
    const obs = new MutationObserver(muteAll);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, [isDeafened, serverDeafened]);
  return null;
}

// --- ANA BİLEŞEN ---
export default function ActiveRoom({
  roomName,
  displayName,
  username,
  onLeave,
  currentTextChannel,
  userId,
}) {
  // --- GLOBAL INPUT LISTENER (CPU OPTIMIZATION) ---
  useEffect(() => {
    let timeoutId;
    if (window.netrex) {
      // 🚀 Bağlantı başlangıcında Main Process'i yormamak için biraz beklet
      // Bu, WebRTC handshake'inin (bağlantı kurma) takılmadan tamamlanmasını sağlar
      console.log("🎤 Global input dinleyicisi için bekleniyor (Handshake koruması)...");
      timeoutId = setTimeout(() => {
         console.log("🎤 Odaya girildi: Global input dinleyicisi başlatılıyor...");
         window.netrex.startInputListener();
      }, 1500);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (window.netrex) {
        console.log("👋 Odadan çıkıldı: Global input dinleyicisi durduruluyor...");
        window.netrex.stopInputListener();
      }
    };
  }, []);

  const { user } = useAuthStore();
  const [token, setToken] = useState("");
  const [showSettingsLocal, setShowSettingsLocal] = useState(false);
  
  // Voice State and Settings Modal - Global Store'dan al
  const isMuted = useSettingsStore(state => state.isMuted);
  const isDeafened = useSettingsStore(state => state.isDeafened);
  const toggleMute = useSettingsStore(state => state.toggleMute);
  const toggleDeaf = useSettingsStore(state => state.toggleDeaf);
  const showSettingsModal = useSettingsStore(state => state.showSettingsModal);
  const setSettingsOpen = useSettingsStore(state => state.setSettingsOpen);
  
  // Settings modal: hem lokal state hem de store'dan açılabilir
  const showSettings = showSettingsLocal || showSettingsModal;
  const setShowSettings = (value) => {
    setShowSettingsLocal(value);
    if (!value) setSettingsOpen(false); // Kapatırken store'u da sıfırla
  };

  const [isCameraOn, setIsCameraOn] = useState(false);
  const [hideIncomingVideo, setHideIncomingVideo] = useState(false);
  const [serverMuted, setServerMuted] = useState(false);
  const [serverDeafened, setServerDeafened] = useState(false);
  // New States for enhanced moderation feedback
  const [mutedBy, setMutedBy] = useState(null);
  const [deafenedBy, setDeafenedBy] = useState(null);
  const [mutedAt, setMutedAt] = useState(null);
  const [deafenedAt, setDeafenedAt] = useState(null);

  const [showVoicePanel, setShowVoicePanel] = useState(true);
  const {
    showChatPanel,
    setShowChatPanel,
    currentChannel,
    clearCurrentChannel,
  } = useChatStore();
  const [chatPosition, setChatPosition] = useState("right");
  const [chatWidth, setChatWidth] = useState(400); // Chat genişliği (pixel)
  const [contextMenu, setContextMenu] = useState(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [activeStreamId, setActiveStreamId] = useState(null);
  const [connectionError, setConnectionError] = useState(null);
  const [hasConnectedOnce, setHasConnectedOnce] = useState(false); // Bağlantı başarılı oldu mu?
  const connectionTimeoutRef = useRef(null); // Bağlantı timeout'u
  const hasConnectedOnceRef = useRef(false); // Ref ile takip (timeout için)
  
  // 🚀 v5.2: LiveKit Server Pool
  const [serverUrl, setServerUrl] = useState(process.env.NEXT_PUBLIC_LIVEKIT_URL || '');
  const [serverIndex, setServerIndex] = useState(0);
  const [serverPoolMode, setServerPoolMode] = useState(false);
  const [serverCount, setServerCount] = useState(1);
  const rotationCountRef = useRef(0); // Sonsuz döngüyü önlemek için sayaç
  const MAX_ROTATIONS = 3; // Maksimum rotation sayısı
  const poolDocRef = useRef(null); // Firebase pool document reference
  const serverIndexRef = useRef(serverIndex); // Ref ile takip (callback'lerde güncel değer için)
  
  // serverIndex değiştiğinde ref'i güncelle
  useEffect(() => {
    serverIndexRef.current = serverIndex;
  }, [serverIndex]);

  // RESET STATE ON MOUNT/UPDATE
  // Odadan çıkıp tekrar girildiğinde veya key değiştiğinde state'in temiz olduğundan emin ol
  useEffect(() => {
    setConnectionError(null);
    setHasConnectedOnce(false);
    hasConnectedOnceRef.current = false;
    // Token'ı burda sıfırlama, alttaki useEffect token alacak
  }, [roomName]); // Oda ismi değiştiğinde (zaten key değişiyor ama yine de)


  // 🚀 v5.2: Firebase'den aktif sunucu indeksini dinle (tüm kullanıcılar senkronize olsun)
  useEffect(() => {
    if (!serverPoolMode) return;
    
    poolDocRef.current = doc(db, "system", "livekitPool");
    
    // Real-time listener
    const unsubscribe = onSnapshot(poolDocRef.current, async (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        const firebaseIndex = data.activeServerIndex || 0;
        
        // Eğer Firebase'deki index farklıysa, değiştir (ref kullan - güncel değer için)
        if (firebaseIndex !== serverIndexRef.current) {
          console.log(`🔄 Firebase'den sunucu değişikliği algılandı: ${serverIndexRef.current} → ${firebaseIndex}`);
          
          try {
            const serverInfo = await window.netrex.getLiveKitServerInfo(firebaseIndex);
            if (serverInfo && serverInfo.url) {
              setServerIndex(firebaseIndex);
              setServerUrl(serverInfo.url);
              // NOT: Token useEffect tarafından otomatik yenilenecek
            }
          } catch (e) {
            console.error("Firebase sunucu değişikliği uygulanamadı:", e);
          }
        }
      }
    }, (error) => {
      console.error("Firebase pool listener hatası:", error);
    });
    
    return () => unsubscribe();
  }, [serverPoolMode]); // serverIndex dependency'den kaldırıldı - ref kullanıyoruz

  // Firebase'de pool document'ı oluştur/güncelle (ilk bağlantıda)
  useEffect(() => {
    if (!serverPoolMode || serverCount <= 1) return;
    
    const initializePoolDoc = async () => {
      try {
        const poolRef = doc(db, "system", "livekitPool");
        const poolDoc = await getDoc(poolRef);
        
        if (!poolDoc.exists()) {
          // İlk kez oluştur
          await setDoc(poolRef, {
            activeServerIndex: 0,
            serverCount: serverCount,
            lastRotation: serverTimestamp(),
            createdAt: serverTimestamp(),
          });
          console.log("✅ Firebase LiveKit pool oluşturuldu");
        }
      } catch (e) {
        console.error("Firebase pool init hatası:", e);
      }
    };
    
    initializePoolDoc();
  }, [serverPoolMode, serverCount]);


  const noiseSuppression = useSettingsStore(state => state.noiseSuppression);
  const echoCancellation = useSettingsStore(state => state.echoCancellation);
  const autoGainControl = useSettingsStore(state => state.autoGainControl);
  const disableAnimations = useSettingsStore(state => state.disableAnimations);
  const disableBackgroundEffects = useSettingsStore(state => state.disableBackgroundEffects);
  const videoCodec = useSettingsStore(state => state.videoCodec);
  const videoResolution = useSettingsStore(state => state.videoResolution);
  const videoFrameRate = useSettingsStore(state => state.videoFrameRate);
  const enableCamera = useSettingsStore(state => state.enableCamera);
  const videoId = useSettingsStore(state => state.videoId);

  // Inject Global Animation Disable Config
  useEffect(() => {
    if (disableAnimations) {
      const styleId = 'disable-animations-global';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
          *, *::before, *::after {
            transition-duration: 0s !important;
            transition-delay: 0s !important;
            animation-duration: 0s !important;
            animation-delay: 0s !important;
            scroll-behavior: auto !important;
          }
        `;
        document.head.appendChild(style);
      }
      return () => {
        const el = document.getElementById(styleId);
        if (el) el.remove();
      };
    }
  }, [disableAnimations]);
  const { playSound } = useSoundEffects();
  const { channels } = useServerStore();

  // NOT: useLocalParticipant hook'u sadece LiveKitRoom içinde çalışır.
  // Mikrofon senkronizasyonu MicrophoneSyncHandler bileşeninde yapılır (LiveKitRoom içinde).

  const roomDisplayName = useMemo(() => {
    if (displayName) return displayName;
    const channel = channels?.find(c => c.id === roomName);
    return channel?.name || roomName;
  }, [displayName, channels, roomName]);

  // currentTextChannel null olduğunda paneli kapat
  useEffect(() => {
    if (!currentTextChannel && showChatPanel) {
      setShowChatPanel(false);
    }
  }, [currentTextChannel, showChatPanel, setShowChatPanel]);

  // currentTextChannel ile currentChannel senkronizasyonu
  useEffect(() => {
    if (currentTextChannel && currentChannel?.id !== currentTextChannel) {
      // currentTextChannel set edilmiş ama currentChannel farklıysa, currentChannel'ı güncelle
      // Bu durumda loadChannelMessages zaten çağrılmış olmalı, sadece kontrol ediyoruz
    } else if (!currentTextChannel && currentChannel) {
      // currentTextChannel null ama currentChannel set edilmişse, temizle
      clearCurrentChannel();
    }
  }, [currentTextChannel, currentChannel, clearCurrentChannel]);

  // Not: Metin kanalına tıklama artık RoomList'te handle ediliyor (toggle mantığı ile)
  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener("mousedown", closeMenu);
    return () => window.removeEventListener("mousedown", closeMenu);
  }, []);

  // settingsStore'dan mute/deafen durumlarını sıfırlamak için set fonksiyonunu al
  const settingsStore = useSettingsStore;
  
  useEffect(() => {
    // Room değiştiğinde state'leri sıfırla (eski room'dan temiz çıkış için)
    setToken(""); // Token'ı sıfırla ki eski room'dan disconnect olsun
    setConnectionError(null);
    setIsReconnecting(false);
    setHasConnectedOnce(false);
    hasConnectedOnceRef.current = false;
    setActiveStreamId(null); // Aktif stream'i sıfırla
    setIsCameraOn(false); // Kamera durumunu sıfırla
    
    // ÖNEMLİ: Odaya her bağlanıldığında mute/deafen durumlarını sıfırla
    // Bu, önceki oturumdan kalan görsel durumun gerçek durumla senkronize olmasını sağlar
    settingsStore.setState({ isMuted: false, isDeafened: false });

    // Timeout'u temizle
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
  }, [roomName, username, userId]);

  // Token fetch useEffect - SADECE ilk bağlantıda çalışmalı
  useEffect(() => {
    // ✅ FIX: Eğer zaten bağlandıysa token'ı yeniden alma
    if (hasConnectedOnce) {
      return;
    }
    
    (async () => {
      try {
        if (window.netrex) {
          // 🚀 v5.2: Server pool - önce sunucu bilgisini al
          let currentServerIndex = serverIndex;
          let currentServerUrl = serverUrl;
          
          try {
            // Önce electron'dan pool bilgisini al
            const serverInfo = await window.netrex.getLiveKitServerInfo(currentServerIndex);
            
            if (serverInfo && serverInfo.poolMode) {
              // Pool modu aktif - Firebase'den aktif sunucu indeksini oku
              try {
                const poolRef = doc(db, "system", "livekitPool");
                const poolDoc = await getDoc(poolRef);
                
                if (poolDoc.exists()) {
                  const firebaseIndex = poolDoc.data().activeServerIndex || 0;
                  console.log(`📡 Firebase'den aktif sunucu okundu: ${firebaseIndex}`);
                  
                  // Firebase'deki indekse göre sunucu bilgisini al
                  const activeServerInfo = await window.netrex.getLiveKitServerInfo(firebaseIndex);
                  if (activeServerInfo && activeServerInfo.url) {
                    currentServerUrl = activeServerInfo.url;
                    currentServerIndex = activeServerInfo.serverIndex;
                  }
                }
              } catch (firebaseError) {
                console.warn("Firebase pool okunamadı, varsayılan sunucu kullanılıyor:", firebaseError);
              }
              
              setServerPoolMode(true);
              setServerCount(serverInfo.serverCount || 1);
            } else if (serverInfo) {
              // Tek sunucu modu - serverInfo'dan URL al
              currentServerUrl = serverInfo.url || currentServerUrl;
              currentServerIndex = serverInfo.serverIndex || 0;
            }
            
            setServerUrl(currentServerUrl);
            setServerIndex(currentServerIndex);
            rotationCountRef.current = 0; // Başarılı bağlantıda sayacı sıfırla
            console.log(`🔌 LiveKit server: ${currentServerUrl} (index: ${currentServerIndex}, pool: ${serverInfo?.poolMode}, count: ${serverInfo?.serverCount})`);
          } catch (serverInfoError) {
            console.warn('⚠️ Server info alınamadı, default kullanılıyor:', serverInfoError);
          }
          
          // Use userId directly as identity to prevent ghost participants
          // generateLiveKitIdentity adds device suffix which causes duplicates on refresh
          const identity = userId;
          
          // Get token with stable identity, display name, and server index
          const t = await window.netrex.getLiveKitToken(roomName, identity, username, currentServerIndex);
          setToken(t);

          // 20 saniye içinde bağlantı kurulamazsa hata göster
          connectionTimeoutRef.current = setTimeout(() => {
            // Eğer hala bağlanmadıysa hata göster
            if (!hasConnectedOnceRef.current) {
              setConnectionError(`Odaya bağlanılamadı (Timeout). URL: ${currentServerUrl}`);
            }
          }, 20000); // 20 saniye
        }
      } catch (e) {
        console.error("Token alma hatası:", e);
        // Token alınamazsa hemen hata göster (bu farklı bir durum)
        setConnectionError("Token alınamadı. Lütfen tekrar deneyin.");
      }
    })();

    return () => {
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
    };
  }, [roomName, username, userId, hasConnectedOnce]); // ✅ Removed serverIndex/serverUrl - they're set INSIDE this effect

  // Component unmount veya room değiştiğinde cleanup
  useEffect(() => {
    return () => {
      // Component unmount olduğunda Firebase'den temizle - Optimize: cleanup
      if (userId && roomName) {
        const presenceRef = doc(db, "room_presence", roomName);
        updateDoc(presenceRef, {
          users: arrayRemove({ 
            userId, 
            username,
            photoURL: user?.photoURL || null
          }),
        }).catch((error) => {
          // Document yoksa veya zaten silinmişse sessizce devam et
          if (error.code !== "not-found") {
            console.error("Room presence cleanup hatası (unmount):", error);
          }
        });
      }
    };
  }, [roomName, username, userId]);

  const handleManualLeave = async () => {
    playSound("left");

    // Firebase'den kullanıcıyı çıkar (room presence) - Optimize: timestamp yok
    if (userId && roomName) {
      try {
        const presenceRef = doc(db, "room_presence", roomName);
        await updateDoc(presenceRef, {
          users: arrayRemove({ 
            userId, 
            username,
            photoURL: user?.photoURL || null
          }),
        });
      } catch (error) {
        console.error("Room presence çıkarma hatası:", error);
      }
    }

    onLeave();
  };

  // Bağlantı başarılı olduğunda
  const handleConnected = async () => {
    hasConnectedOnceRef.current = true;
    setHasConnectedOnce(true);
    setIsReconnecting(false);
    setConnectionError(null);
    // Timeout'u temizle
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    console.log("LiveKit bağlantısı başarılı");

    // Firebase'e kullanıcıyı ekle (room presence) - Optimize: sadece userId ve username
    if (userId && roomName) {
      try {
        const presenceRef = doc(db, "room_presence", roomName);
        // photoURL'i de ekle
        const userData = { 
          userId, 
          username,
          photoURL: user?.photoURL || null
        };
        await updateDoc(presenceRef, {
          users: arrayUnion(userData),
        }).catch(async (error) => {
          // Document yoksa oluştur
          if (error.code === "not-found") {
            await setDoc(presenceRef, {
              users: [userData],
            });
          }
        });
      } catch (error) {
        console.error("Room presence ekleme hatası:", error);
      }
    }
  };

  // Bağlantı koptuğunda (sadece başarılı bağlantıdan sonra)
  const handleDisconnect = async (reason) => {
    console.log("LiveKit bağlantısı koptu:", reason);
    
    // 🚀 v5.2: Disconnect reason'ı kontrol et - quota/limit hatası olabilir
    // LiveKit quota aşıldığında doğrudan disconnect eder, "error" event'i fırlatmaz
    
    // Enum kontrolü (daha güvenli)
    const reasonNum = Number(reason);
    
    // KESİNLİKLE ROTATION YAPILMAMASI GEREKEN DURUMLAR
    // 1: CLIENT_INITIATED (Kullanıcı kendi çıktı)
    // 2: DUPLICATE_IDENTITY (Başka yerden girdi)
    // 10: ROOM_CLOSED (Oda kapandı - normal kapanış)
    if (
      reasonNum === DisconnectReason.CLIENT_INITIATED || 
      reasonNum === DisconnectReason.DUPLICATE_IDENTITY ||
      reasonNum === DisconnectReason.ROOM_CLOSED
    ) {
      console.log(`ℹ️ Normal disconnect (${reason}), rotation yapılmayacak.`);
      return;
    }

    // ROTATION YAPILMASI GEREKEN KRİTİK DURUMLAR
    // 3: SERVER_SHUTDOWN (Sunucu kapandıysa/restart atıldıysa kesin değişim gerekir)
    // NOT: JOIN_FAILURE (7) tek başına yeterli değil, internet kopukluğu da olabilir.
    // O yüzden sadece SERVER_SHUTDOWN'u enum olarak kabul ediyoruz.
    const isCriticalDisconnect = reasonNum === DisconnectReason.SERVER_SHUTDOWN;

    // String kontrolü (EN ÖNEMLİ KISIM)
    // Kullanıcının belirttiği kesin "kota/limit" hataları buraya eklenmeli
    const reasonStr = String(reason || '').toLowerCase();
    const quotaDisconnectReasons = [
      'quota', 
      'rate limit', 
      'limit exceeded', 
      'limit reached',
      'resource exhausted', 
      'too many requests', 
      '429',
      'connection limit', 
      'participant limit', 
      'free tier',
      'server_shutdown'
    ];
    
    // Sadece tam eşleşme varsa (veya server shutdown ise)
    const isQuotaTextMatch = quotaDisconnectReasons.some(q => reasonStr.includes(q));
    
    if ((isCriticalDisconnect || isQuotaTextMatch) && serverPoolMode) {
      console.warn(`⚠️ Critical Disconnect (${reason}) indicates STRICT quota error, triggering pool rotation...`);
      
      let errorDesc = `Disconnect: ${reason}`;
      if (reasonNum === DisconnectReason.SERVER_SHUTDOWN) errorDesc += " (server_shutdown)";
      if (isQuotaTextMatch) errorDesc += " (quota_limit_detected)";

      // handleError quota kontrolünü ve rotation'ı yapacak
      await handleError(new Error(errorDesc));
      return; 
    }
    
    // Sadece başarılı bağlantıdan sonra koparsa "Bağlantı Koptu" göster
    if (hasConnectedOnce) {
      setIsReconnecting(true);
    }

    // Firebase'den kullanıcıyı çıkar (cleanup) - Optimize: bağlantı koptuğunda da temizle
    if (userId && roomName) {
      try {
        const presenceRef = doc(db, "room_presence", roomName);
        await updateDoc(presenceRef, {
          users: arrayRemove({ 
            userId, 
            username,
            photoURL: user?.photoURL || null
          }),
        });
      } catch (error) {
        // Document yoksa veya zaten silinmişse sessizce devam et
        if (error.code !== "not-found") {
          console.error("Room presence cleanup hatası:", error);
        }
      }
    }
    // İlk bağlantı başarısız olduysa zaten timeout'ta hata gösterilecek
  };

  // Bağlantı hatası (sadece kritik hatalar için)
  // 🚀 v5.2: Server pool - hata durumunda sonraki sunucuya geç
  const handleError = async (error) => {
    console.error("LiveKit bağlantı hatası:", error);
    
    const errorMessage = error?.message || '';
    
    // Quota/limit hataları - server pool ile çözülebilir
    const quotaErrors = [
      'quota',
      'rate limit',
      'limit exceeded',
      'limit reached',
      'resource exhausted',
      'too many requests',
      'connection limit',
      'participant limit',
      'minutes exceeded',
      'free tier',
      '429',
      '503',
      'server_shutdown',
    ];
    
    const isQuotaError = quotaErrors.some(q => 
      errorMessage.toLowerCase().includes(q.toLowerCase())
    );
    
    // Server pool modunda ve quota hatası aldıysak
    // NOT: isQuotaError false olsa bile, bağlantı hatası da rotation tetikleyebilir
    const isConnectionFailure = !isQuotaError && [
      'connection failed', 'could not connect', 'websocket error',
      'timeout', 'network error', 'disconnect:',
    ].some(c => errorMessage.toLowerCase().includes(c.toLowerCase()));
    
    if (serverPoolMode && (isQuotaError || isConnectionFailure)) {
      // Sonsuz döngü koruması
      if (rotationCountRef.current >= MAX_ROTATIONS) {
        console.error(`❌ Maksimum rotation sayısına ulaşıldı (${MAX_ROTATIONS}). Tüm sunucular dolu olabilir.`);
        setConnectionError(`Tüm LiveKit sunucuları dolu. Lütfen daha sonra tekrar deneyin.`);
        return;
      }
      
      rotationCountRef.current++;
      console.warn(`⚠️ LiveKit quota hatası algılandı, sunucu değiştiriliyor... (rotation ${rotationCountRef.current}/${MAX_ROTATIONS})`);
      
      try {
        // Sonraki sunucuyu al (modulo ile döngüsel)
        // serverCount en az 2 olmalı rotation için
        if (serverCount < 2) {
          console.warn('⚠️ Sadece 1 sunucu var, rotation yapılamaz');
          // Tek sunucu modunda hata göster
          if (hasConnectedOnce) {
            setConnectionError(`Bağlantı hatası: ${errorMessage || "Sunucu kotası dolmuş olabilir."}`);
          }
          return;
        }
        const nextIndex = (serverIndex + 1) % serverCount;
        const serverInfo = await window.netrex.getLiveKitServerInfo(nextIndex);
        
        if (serverInfo && serverInfo.url) {
          // 🚀 v5.2: Firebase'i güncelle - TÜM kullanıcılar bu sunucuya geçecek
          try {
            const poolRef = doc(db, "system", "livekitPool");
            // setDoc with merge: true - doküman yoksa oluşturur, varsa günceller
            await setDoc(poolRef, {
              activeServerIndex: serverInfo.serverIndex,
              lastRotation: serverTimestamp(),
              lastError: errorMessage,
              lastErrorTime: serverTimestamp(),
            }, { merge: true });
            console.log(`📡 Firebase güncellendi: activeServerIndex = ${serverInfo.serverIndex}`);
          } catch (firebaseError) {
            console.error("Firebase güncelleme hatası:", firebaseError);
          }
          
          // Yeni sunucuya geç (bu useEffect'i tetikleyecek ve yeni token alınacak)
          setServerIndex(serverInfo.serverIndex);
          setServerUrl(serverInfo.url);
          setConnectionError(null); // Hatayı temizle
          console.log(`🔄 LiveKit server rotated: ${serverIndex} → ${serverInfo.serverIndex}`);
          return; // Hata gösterme, yeniden dene
        }
      } catch (rotationError) {
        console.error('Server rotation hatası:', rotationError);
      }
    }
    
    // Sadece başarılı bağlantıdan sonra hata olursa göster
    if (hasConnectedOnce) {
      setConnectionError(`${errorMessage || "Bağlantı hatası oluştu."} (URL: ${serverUrl})`);
    }
    // İlk bağlantı hatasında sadece timeout'ta hata göster
  };
  useEffect(() => {
    if (token) playSound("join");
  }, [token]);
  const handleUserContextMenu = (e, participant) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      participant,
      isLocal: participant.isLocal,
      roomName: roomName,
    });
  };

  // 🔴 ÖNCELİKLİ HATA KONTROLÜ
  // Eğer connectionError varsa, Token olmasa bile hatayı göster!
  if (connectionError && !hasConnectedOnce) {
    return (
      <div className="absolute inset-0 z-50 bg-[#0a0a0c]/95 flex flex-col items-center justify-center backdrop-blur-md p-4 animate-nds-fade-in">
        {/* Animated background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/3 left-1/3 w-[400px] h-[400px] bg-red-500/10 rounded-full blur-[120px] animate-pulse" />
        </div>
        
        {/* Error Card */}
        <div className="relative z-10 w-full max-w-md">
          {/* Card glow */}
          <div className="absolute -inset-1 bg-gradient-to-r from-red-500/20 to-orange-500/20 rounded-3xl blur-xl opacity-60" />
          
          {/* Card */}
          <div className="relative bg-gradient-to-br from-[#1a1b1e]/95 to-[#111214]/95 backdrop-blur-xl rounded-2xl border border-red-500/20 p-6 sm:p-8 text-center">
            {/* Icon */}
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-red-500/20 to-red-600/10 flex items-center justify-center border border-red-500/20">
              <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            
            <h2 className="text-xl font-bold mb-2 text-white">Bağlantı Hatası</h2>
            <p className="text-[#949ba4] mb-6 text-sm">{connectionError}</p>
            
            <div className="flex gap-3 justify-center flex-wrap">
              <button
                onClick={() => {
                  setConnectionError(null);
                  setHasConnectedOnce(false);
                  hasConnectedOnceRef.current = false;
                  setToken(""); // Token'ı sıfırla ki yeniden fetch etsin
                  
                  if (window.netrex) {
                    const identity = userId;
                    // Token alma işlemini yeniden başlat
                    window.netrex
                      .getLiveKitToken(roomName, identity, username, serverIndex)
                      .then((t) => {
                        setToken(t);
                        if (connectionTimeoutRef.current) {
                          clearTimeout(connectionTimeoutRef.current);
                        }
                        connectionTimeoutRef.current = setTimeout(() => {
                          if (!hasConnectedOnceRef.current) {
                            setConnectionError("Odaya bağlanılamadı. Lütfen tekrar deneyin.");
                          }
                        }, 20000);
                      })
                      .catch((e) => {
                        console.error("Token hatası:", e);
                        setConnectionError("Token alınamadı. Lütfen tekrar deneyin.");
                      });
                  }
                }}
                className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl font-medium text-white text-sm hover:shadow-[0_0_30px_rgba(99,102,241,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
              >
                Tekrar Dene
              </button>
              <button
                onClick={handleManualLeave}
                className="px-6 py-2.5 bg-white/5 border border-white/10 rounded-xl font-medium text-[#949ba4] text-sm hover:bg-white/10 hover:text-white transition-all duration-200"
              >
                Çık
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Token yoksa Skeleton Loading göster
  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#0a0a0c] relative overflow-hidden p-8 animate-nds-fade-in">
        <MemoizedBackground disableEffects={disableBackgroundEffects} />
        
        {/* 🦴 v5.5 Premium Skeleton Grid */}
        <div className="w-full max-w-[1000px] grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse opacity-40">
           {[...Array(6)].map((_, i) => (
             <div key={i} className="aspect-[16/9] rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col items-center justify-center relative overflow-hidden">
                <div className="w-20 h-20 rounded-2xl bg-white/5 mb-4" />
                <div className="w-24 h-3 bg-white/5 rounded-full mb-2" />
                <div className="w-16 h-2 bg-white/5 rounded-full" />
                
                {/* Shimmer Effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
             </div>
           ))}
        </div>

        {/* Floating Label */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
           <div className="w-10 h-1 border-[2px] border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-4" />
           <p className="text-white/60 font-medium text-sm tracking-widest uppercase">Güvenli Hat Kuruluyor</p>
        </div>
      </div>
    );
  }


  return (
    <LiveKitRoom
      // KEY: ONLY roomName changes should remount - serverIndex changes are handled by serverUrl prop
      key={roomName}
      // DÜZELTME: video={false} yapıyoruz ki otomatik yönetim manuel fonksiyonumuzla çakışmasın.
      video={false}
      audio={true}
      token={token}
      // 🚀 v5.2: Server pool - dinamik URL
      serverUrl={serverUrl}
      data-lk-theme="default"
      className="flex-1 flex flex-col bg-gradient-to-b from-[#1a1b1f] to-[#0e0f12]"
      // Quota-Efficient Connection Options
      connectOptions={{ 
        autoSubscribe: true, 
        // Adaptive streaming for lower bandwidth usage
        dynacast: true,
        // Faster participant timeout (seconds) - helps clear ghost participants quicker
        // Note: This affects server-side participant timeout
        peerConnectionTimeout: 10000, // 10 seconds to establish WebRTC connection
      }}
      // Room options for robust reconnection handling
      options={{
        audioCaptureDefaults: {
          echoCancellation,
          noiseSuppression,
          autoGainControl,
        },
        // Enable automatic reconnection
        reconnect: true,
        // Disconnect cleanly when window closes
        disconnectOnPageLeave: true,
        // Stop tracks when disconnecting (prevents lingering audio)
        stopLocalTrackOnUnpublish: true,
        // Adaptive stream for bandwidth efficiency
        adaptiveStream: true,
      }}
      // Handle disconnect event immediately
      onDisconnected={(reason) => {
        console.log("🔌 LiveKitRoom disconnected:", reason);
      }}
      // 🚀 v5.2: LiveKitRoom built-in onError - bağlantı hataları için
      // Bu, LiveKit SDK'nın kendi error handling mekanizması
      onError={(error) => {
        console.error("🔌 LiveKitRoom onError:", error);
        handleError(error);
      }}
    >
      <MemoizedBackground disableEffects={disableBackgroundEffects} />
      <GlobalChatListener
        showChatPanel={showChatPanel}
        setShowChatPanel={setShowChatPanel}
      />
      <VoiceProcessorHandler />
      <SettingsUpdater 
        isMuted={isMuted}
        serverMuted={serverMuted}
        isDeafened={isDeafened}
        serverDeafened={serverDeafened}
      />
      <RoomEventsHandler
        onConnected={handleConnected}
        onDisconnected={handleDisconnect}
        onError={handleError}
        roomName={roomName}
        roomDisplayName={roomDisplayName}
        userId={userId}
        username={username}
      />
      <MemoizedMicrophoneManager />
      <ModerationHandler 
        setServerMuted={setServerMuted} 
        setServerDeafened={setServerDeafened}
        setMutedBy={setMutedBy}
        setDeafenedBy={setDeafenedBy}
        setMutedAt={setMutedAt}
        setDeafenedAt={setDeafenedAt}
        serverMuted={serverMuted}
        serverDeafened={serverDeafened}
        isDeafened={isDeafened}
        isMuted={isMuted}
        playSound={playSound}
      />

      {/* LiveKit bağlantısı kurulana kadar loading overlay */}
      {!hasConnectedOnce && !connectionError && (
        <div className="absolute inset-0 z-50 bg-[#0a0a0c]/95 flex flex-col items-center justify-center backdrop-blur-md">
          {/* Animated background */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-1/3 left-1/3 w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-1/3 right-1/3 w-[300px] h-[300px] bg-purple-500/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
          </div>
          
          {/* Content */}
          <div className="relative z-10 flex flex-col items-center">
            {/* Spinner with glow */}
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-indigo-500/30 rounded-full blur-2xl animate-pulse" />
              <div className="relative w-14 h-14 border-[3px] border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            </div>
            
            {/* Text */}
            <h3 className="text-white font-semibold text-base sm:text-lg mb-2">Bağlantı Kuruluyor</h3>
            <p className="text-[#5c5e66] text-sm">Lütfen bekleyin...</p>
          </div>
        </div>
      )}

      {/* İlk bağlantı hatası (Artık yukarıda handle ediliyor, burası LiveKitRoom error'ları için) */}
       {connectionError && !hasConnectedOnce && (
         <div className="absolute inset-0 z-50 bg-transparent" />
       )}

      {/* Bağlantı koptu (başarılı bağlantıdan sonra) */}
      {isReconnecting && hasConnectedOnce && (
        <div className="absolute inset-0 z-50 bg-[#0a0a0c]/95 flex flex-col items-center justify-center backdrop-blur-md p-4">
          {/* Animated background */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-1/3 left-1/3 w-[400px] h-[400px] bg-amber-500/10 rounded-full blur-[120px] animate-pulse" />
          </div>
          
          {/* Content */}
          <div className="relative z-10 flex flex-col items-center">
            {/* Pulsing icon */}
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-amber-500/20 rounded-full blur-2xl animate-pulse" />
              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-600/10 flex items-center justify-center border border-amber-500/20 animate-pulse">
                <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
            </div>
            
            <h2 className="text-xl font-bold text-white mb-2">Bağlantı Koptu</h2>
            <p className="text-[#949ba4] mb-6 text-sm">Yeniden bağlanmaya çalışılıyor...</p>
            
            <button
              onClick={handleManualLeave}
              className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-red-700 rounded-xl font-medium text-white text-sm hover:shadow-[0_0_30px_rgba(239,68,68,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
            >
              Vazgeç ve Çık
            </button>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: styleInjection + criticalStyles }} />
      <RoomAudioRenderer />
      <DeafenManager isDeafened={isDeafened} serverDeafened={serverDeafened} />
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      {/* ÜST BAR - Premium Glassmorphism Tasarım */}
      <div className="h-14 sm:h-16 relative flex items-center px-4 sm:px-6 justify-between shrink-0 z-20 select-none overflow-hidden">
        {/* Premium gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a1b1f]/95 via-[#141518]/95 to-[#0e0f12]/95 backdrop-blur-xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent" />
        
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 left-1/4 w-[200px] h-[80px] bg-indigo-500/[0.06] blur-[60px]" />
          <div className="absolute top-0 right-1/4 w-[200px] h-[80px] bg-purple-500/[0.04] blur-[60px]" />
        </div>

        {/* Top glow line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />
        
        {/* Bottom border */}
        <div className="absolute bottom-0 left-0 right-0 h-px">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent animate-pulse-slow" />
        </div>

        {/* Sol taraf - Kanal bilgisi */}
        <div className="flex items-center gap-3 sm:gap-4 overflow-hidden relative z-10 min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 group">
            {/* Kanal icon container - Premium */}
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-indigo-500/15 via-purple-500/10 to-transparent flex items-center justify-center border border-indigo-500/20 shadow-lg backdrop-blur-sm group-hover:border-indigo-500/40 transition-all duration-300 group-hover:shadow-[0_0_20px_rgba(99,102,241,0.25)] group-hover:scale-105">
                <Volume2
                  size={18}
                  className="text-indigo-400 group-hover:text-indigo-300 transition-colors duration-300"
                />
              </div>
              {/* Online pulse indicator */}
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-gradient-to-br from-[#1a1b1f] to-[#0e0f12] rounded-full flex items-center justify-center shadow-lg">
                <div className="w-2 h-2 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
              </div>
            </div>

            {/* Kanal adı */}
            <div className="flex flex-col min-w-0">
              <span className="text-white font-bold text-sm sm:text-base tracking-tight truncate group-hover:text-indigo-100 transition-colors duration-300">
                {roomDisplayName}
              </span>
              <span className="text-[10px] sm:text-xs text-white/50 font-medium tracking-wide">
                Ses Kanalı
              </span>
            </div>
          </div>

          {/* Ayırıcı */}
          <div className="w-px h-8 sm:h-10 bg-gradient-to-b from-transparent via-white/10 to-transparent mx-1 hidden md:block" />

          {/* Bağlantı durumu */}
          <div className="hidden md:block">
            <ConnectionStatusIndicator />
          </div>
        </div>

        {/* Sağ taraf - Kontrol butonları */}
        <div className="flex items-center gap-1 relative z-10 bg-gradient-to-br from-white/[0.05] to-white/[0.02] rounded-2xl p-1 backdrop-blur-sm border border-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          {/* Kullanıcılar butonu */}
          <button
            onClick={() => setShowVoicePanel(!showVoicePanel)}
            title="Kişiler"
            className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-200 ${
              showVoicePanel
                ? "bg-gradient-to-br from-indigo-500/20 to-purple-500/10 text-white border border-indigo-500/30 shadow-[0_0_12px_rgba(99,102,241,0.2)]"
                : "text-white/60 hover:text-white hover:bg-white/[0.05]"
            }`}
          >
            <Users size={16} />
          </button>
        </div>
      </div>

      <ScreenShareManager
        setActiveStreamId={setActiveStreamId}
        renderStageManager={(stopScreenShare) => (
          <StageManager
            showVoicePanel={showVoicePanel}
            showChatPanel={showChatPanel}
            currentTextChannel={currentTextChannel}
            chatPosition={chatPosition}
            chatWidth={chatWidth}
            setChatWidth={setChatWidth}
            username={username}
            userId={userId}
            onUserContextMenu={handleUserContextMenu}
            activeStreamId={activeStreamId}
            setActiveStreamId={setActiveStreamId}
            hideIncomingVideo={hideIncomingVideo}
            stopScreenShare={stopScreenShare}
          />
        )}
        renderBottomControls={(stopScreenShare) => (
          <BottomControls
            username={username}
            onLeave={handleManualLeave}
            onOpenSettings={() => setShowSettings(true)}
            isDeafened={isDeafened}
            onDeafenToggle={toggleDeaf}
            isMuted={isMuted}
            onMuteToggle={toggleMute}
            serverMuted={serverMuted}
            serverDeafened={serverDeafened}
            playSound={playSound}
            setActiveStreamId={setActiveStreamId}
            isCameraOn={isCameraOn}
            setIsCameraOn={setIsCameraOn}
            stopScreenShare={stopScreenShare}
            chatPosition={chatPosition}
            mutedBy={mutedBy}
            deafenedBy={deafenedBy}
            mutedAt={mutedAt}
            deafenedAt={deafenedAt}
          />
        )}
      />
      {contextMenu && (
        <UserContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          participant={contextMenu.participant}
          isLocal={contextMenu.isLocal}
          roomName={contextMenu.roomName}
          onClose={() => setContextMenu(null)}
        />
      )}
    </LiveKitRoom>
  );
}
