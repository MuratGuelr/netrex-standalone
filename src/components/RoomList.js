"use client";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  collection,
  onSnapshot,
  addDoc,
  serverTimestamp,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import {
  Plus,
  Volume2,
  Settings,
  Hash,
  Trash2,
  Shield,
  ChevronDown,
  Loader2,
  HelpCircle,
  Circle,
  CircleOff,
  Eye,
  EyeOff,
} from "lucide-react";
import { useChatStore } from "@/src/store/chatStore";
import { useSettingsStore } from "@/src/store/settingsStore";
import { toast } from "sonner";
import {
  CHANNEL_NAME_MAX_LENGTH,
  CHANNEL_NAME_MIN_LENGTH,
  ROOM_NAME_MAX_LENGTH,
  ROOM_NAME_MIN_LENGTH,
} from "@/src/constants/appConfig";
import ConfirmDialog from "./ConfirmDialog";
import ShortcutHelpModal from "./ShortcutHelpModal";

const ADMIN_UID = process.env.NEXT_PUBLIC_ADMIN_UID?.trim() || "";

const sanitizeChannelNameInput = (value) =>
  value
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "")
    .slice(0, CHANNEL_NAME_MAX_LENGTH);

const sanitizeRoomNameInput = (value) =>
  value.replace(/[<>]/g, "").slice(0, ROOM_NAME_MAX_LENGTH);

export default function RoomList({
  onJoin,
  user,
  onOpenSettings,
  onJoinTextChannel,
  currentRoom,
}) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [roomPresence, setRoomPresence] = useState({}); // { roomName: { users: [...] } }

  const {
    textChannels,
    createTextChannel,
    deleteTextChannel,
    unreadCounts, // YENİ: Okunmamış mesaj sayıları
    startTextChannelListener,
  } = useChatStore();

  const { profileColor, userStatus, setUserStatus } = useSettingsStore();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const [isCreatingTextChannel, setIsCreatingTextChannel] = useState(false);
  const [showTextChannelModal, setShowTextChannelModal] = useState(false);
  const [showVoiceRoomModal, setShowVoiceRoomModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newRoomName, setNewRoomName] = useState("");
  const [channelError, setChannelError] = useState("");
  const [roomError, setRoomError] = useState("");
  const [globalError, setGlobalError] = useState("");
  const [hoveredChannel, setHoveredChannel] = useState(null);
  const [showShortcutModal, setShowShortcutModal] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: "",
    description: "",
    confirmLabel: "",
    variant: "danger",
    action: null,
    successMessage: "",
    errorMessage: "",
    itemToDelete: null, // Silinecek öğenin adı
  });
  const [confirmLoading, setConfirmLoading] = useState(false);

  const openConfirmDialog = useCallback((config) => {
    setConfirmDialog({
      open: true,
      variant: "danger",
      confirmLabel: "Onayla",
      successMessage: "",
      errorMessage: "",
      action: null,
      ...config,
    });
  }, []);

  const closeConfirmDialog = useCallback(() => {
    setConfirmLoading(false);
    setConfirmDialog((prev) => ({ ...prev, open: false }));
  }, []);

  const handleConfirmDialog = useCallback(async () => {
    if (!confirmDialog.action) {
      closeConfirmDialog();
      return;
    }
    setConfirmLoading(true);
    try {
      await confirmDialog.action();
      if (confirmDialog.successMessage) {
        toast.success(confirmDialog.successMessage);
      }
      closeConfirmDialog();
    } catch (error) {
      console.error("Confirm action error:", error);
      toast.error(confirmDialog.errorMessage || "İşlem tamamlanamadı.");
      setConfirmLoading(false);
    }
  }, [confirmDialog, closeConfirmDialog]);

  const isAdmin = useMemo(
    () => Boolean(ADMIN_UID && user?.uid === ADMIN_UID),
    [user?.uid]
  );

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "rooms"), (snapshot) => {
      const roomData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      roomData.sort((a, b) => a.name.localeCompare(b.name));
      setRooms(roomData);
      setLoading(false);
    });

    const stopTextChannelListener = startTextChannelListener();

    return () => {
      unsubscribe();
      if (typeof stopTextChannelListener === "function") {
        stopTextChannelListener();
      }
    };
  }, [startTextChannelListener]);

  // Room presence'leri dinle ve yeni kullanıcı girişlerinde bildirim göster
  const { desktopNotifications, notifyOnJoin } = useSettingsStore();
  const prevPresenceRef = useRef({});
  
  useEffect(() => {
    if (rooms.length === 0) {
      setRoomPresence({});
      prevPresenceRef.current = {};
      return;
    }

    // Tüm room presence'leri tek bir listener ile dinle (daha az read işlemi)
    const roomNames = rooms.map((r) => r.name);
    const presenceRefs = roomNames.map((name) => doc(db, "room_presence", name));
    
    // Her presence için ayrı listener (ama daha optimize: sadece mevcut room'lar için)
    const unsubscribes = presenceRefs.map((presenceRef, index) => {
      return onSnapshot(presenceRef, (snapshot) => {
        const data = snapshot.data();
        const roomName = roomNames[index];
        const currentUsers = data?.users || [];
        const prevUsers = prevPresenceRef.current[roomName]?.users || [];
        
        // Yeni kullanıcıları tespit et
        const newUsers = currentUsers.filter(
          (user) => !prevUsers.some((prevUser) => prevUser.userId === user.userId)
        );
        
        // Bildirim göster (eğer kullanıcı o odada değilse ve ayarlar açıksa)
        if (newUsers.length > 0 && desktopNotifications && notifyOnJoin) {
          // Kullanıcı o odada değilse ve pencere aktif değilse bildirim göster
          if (currentRoom !== roomName) {
            if (typeof window !== "undefined" && "Notification" in window) {
              if (Notification.permission === "granted") {
                // Eğer pencere aktifse bildirim gösterme
                if (typeof document !== "undefined" && (document.hidden || !document.hasFocus())) {
                  newUsers.forEach((newUser) => {
                    // Kendi kullanıcımız değilse bildirim göster
                    if (newUser.userId !== user?.uid) {
                      try {
                        const notification = new Notification(
                          "Kullanıcı Online Oldu",
                          {
                            body: `${newUser.username || "Bir kullanıcı"} "${roomName}" odasına katıldı`,
                            icon: "/favicon.ico",
                            badge: "/favicon.ico",
                            tag: `join-${roomName}-${newUser.userId}-${Date.now()}`,
                            silent: false,
                          }
                        );
                        
                        // Bildirime tıklanınca pencereyi focus et
                        notification.onclick = () => {
                          if (window) {
                            window.focus();
                          }
                          notification.close();
                        };
                        
                        // 5 saniye sonra otomatik kapat
                        setTimeout(() => notification.close(), 5000);
                      } catch (error) {
                        console.error("Masaüstü bildirim hatası:", error);
                      }
                    }
                  });
                }
              }
            }
          }
        }
        
        // State'i güncelle
        setRoomPresence((prev) => {
          const updated = {
            ...prev,
            [roomName]: data || { users: [] },
          };
          prevPresenceRef.current = updated;
          return updated;
        });
      }, (error) => {
        // Document yoksa boş array olarak işaretle
        if (error.code === "not-found") {
          const roomName = roomNames[index];
          setRoomPresence((prev) => {
            const updated = {
              ...prev,
              [roomName]: { users: [] },
            };
            prevPresenceRef.current = updated;
            return updated;
          });
        }
      });
    });

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [rooms, currentRoom, desktopNotifications, notifyOnJoin, user?.uid]);

  useEffect(() => {
    const handleShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "/") {
        event.preventDefault();
        setShowShortcutModal(true);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  // Kullanıcı menüsü dışına tıklandığında kapat
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showUserMenu && !e.target.closest('[data-user-menu]')) {
        setShowUserMenu(false);
      }
    };
    if (showUserMenu) {
      window.addEventListener("mousedown", handleClickOutside);
      return () => window.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showUserMenu]);

  // --- ODA OLUŞTURMA ---
  const createRoom = async () => {
    if (!isAdmin) {
      setGlobalError("Bu işlem için yetkiniz yok.");
      toast.error("Bu işlem için yetkiniz yok.");
      return;
    }
    setRoomError("");
    setShowVoiceRoomModal(true);
  };

  const handleCreateRoomSubmit = async (e) => {
    e.preventDefault();
    const sanitizedName = sanitizeRoomNameInput(newRoomName.trim());
    if (sanitizedName.length < ROOM_NAME_MIN_LENGTH) {
      setRoomError("Kanal adı en az 3 karakter olmalıdır.");
      return;
    }

    setIsCreating(true);
    setRoomError("");
    try {
      await addDoc(collection(db, "rooms"), {
        name: sanitizedName,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });
      setNewRoomName("");
      setShowVoiceRoomModal(false);
      toast.success(`"${sanitizedName}" ses kanalı oluşturuldu.`);
    } catch (error) {
      console.error("Oda oluşturma hatası:", error);
      const message =
        error?.message || "Oda oluşturulamadı. Lütfen tekrar deneyin.";
      setRoomError(message);
      toast.error(message);
    }
    setIsCreating(false);
  };

  // --- KANAL OLUŞTURMA ---
  const handleCreateTextChannel = () => {
    setShowTextChannelModal(true);
  };

  const handleCreateTextChannelSubmit = async (e) => {
    e.preventDefault();
    const sanitizedName = sanitizeChannelNameInput(newChannelName);
    if (!sanitizedName || sanitizedName.length < CHANNEL_NAME_MIN_LENGTH) {
      setChannelError("Kanal adı en az 3 karakter olmalıdır.");
      return;
    }

    setIsCreatingTextChannel(true);
    setChannelError("");
    const result = await createTextChannel(sanitizedName, user?.uid);
    if (!result.success && result.error) {
      setChannelError(result.error);
      toast.error(result.error);
    } else {
      setNewChannelName("");
      setShowTextChannelModal(false);
      toast.success(`#${sanitizedName} kanalı oluşturuldu.`);
    }
    setIsCreatingTextChannel(false);
  };

  // --- KANAL SİLME ---
  const handleDeleteChannel = (e, channel) => {
    e.stopPropagation();
    openConfirmDialog({
      title: "Metin Kanalını Sil",
      description: `Bu kanalı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`,
      confirmLabel: "Kanalı Sil",
      variant: "danger",
      itemToDelete: `#${channel.name}`,
      successMessage: `#${channel.name} kanalı silindi.`,
      errorMessage: "Kanal silinemedi. Lütfen tekrar deneyin.",
      action: async () => {
        const result = await deleteTextChannel(channel.id);
        if (!result.success) {
          throw new Error(result.error || "Kanal silinemedi.");
        }
      },
    });
  };

  // --- ODA SİLME ---
  const handleDeleteRoom = (e, room) => {
    e.stopPropagation();
    openConfirmDialog({
      title: "Ses Kanalını Sil",
      description: `Bu ses kanalını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
      confirmLabel: "Kanalı Sil",
      variant: "danger",
      itemToDelete: room.name,
      successMessage: `"${room.name}" ses kanalı silindi.`,
      errorMessage: "Ses kanalı silinemedi.",
      action: async () => {
        await deleteDoc(doc(db, "rooms", room.id));
      },
    });
  };

  const showCreateButton = isAdmin;

  return (
    <div className="w-60 bg-gradient-to-b from-[#25272a] to-[#2b2d31] h-full flex flex-col flex-shrink-0 select-none border-r border-[#1f2023]/50 shadow-soft backdrop-blur-sm">
      {/* 1. ÜST BAŞLIK */}
      <div className="h-14 border-b border-[#1f2023]/50 flex items-center justify-between px-4 shadow-soft hover:bg-[#35373c]/50 transition-all duration-300 cursor-pointer group hover-lift">
        <h1 className="font-bold text-white text-[15px] truncate tracking-tight">
          Netrex Client
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowShortcutModal(true)}
            className="text-[#949ba4] hover:text-white transition-all duration-200 p-1.5 rounded-lg hover:bg-[#3a3b40]/80 hover:scale-110"
            title="Klavye kısayolları (Ctrl + /)"
          >
            <HelpCircle size={16} />
          </button>
          {showCreateButton && (
            <div className="relative">
              <Shield size={14} className="text-[#23a559] drop-shadow-[0_0_4px_rgba(35,165,89,0.5)]" title="Yönetici" />
              <div className="absolute inset-0 bg-[#23a559]/20 rounded-full blur-sm animate-pulse-slow"></div>
            </div>
          )}
        </div>
      </div>
      {globalError && (
        <div className="mx-4 mb-3 px-4 py-3 rounded-xl glass-strong border border-red-500/30 text-red-300 text-xs font-medium flex items-center justify-between gap-4 animate-fadeIn shadow-soft">
          <span>{globalError}</span>
          <button
            onClick={() => setGlobalError("")}
            className="text-red-300 hover:text-white hover:scale-110 transition-all duration-200"
          >
            ×
          </button>
        </div>
      )}

      {/* 2. KANALLAR LİSTESİ */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-2 space-y-6 pt-2">
        {/* --- SES KANALLARI --- */}
        <div>
          <div className="flex items-center justify-between px-2 mb-2 group text-[#949ba4] hover:text-[#dbdee1] transition-all duration-200">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider cursor-pointer hover:text-white transition-colors">
              <ChevronDown size={12} strokeWidth={3} className="group-hover:scale-110 transition-transform" />
              <span className="ml-0.5">Ses Kanalları</span>
            </div>
            {showCreateButton && (
              <button
                onClick={createRoom}
                className="hover:text-white transition-all duration-200 p-1.5 rounded-lg hover:bg-[#3a3b40]/60 hover:scale-110 hover:shadow-soft"
                title="Ses Kanalı Oluştur"
              >
                <Plus size={14} strokeWidth={3} />
              </button>
            )}
          </div>

          <div className="space-y-[2px]">
            {loading ? (
              <div className="px-2 py-1 text-xs text-[#949ba4] animate-pulse">
                Yükleniyor...
              </div>
            ) : (
              rooms.map((room) => {
                const presence = roomPresence[room.name];
                const activeUsers = presence?.users || [];
                const userCount = activeUsers.length;
                
                // Avatar rengi oluştur (userId'den hash)
                const getAvatarColor = (userId) => {
                  if (!userId) return "#6366f1";
                  let hash = 0;
                  for (let i = 0; i < userId.length; i++) {
                    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
                  }
                  const hue = hash % 360;
                  return `hsl(${hue}, 70%, 50%)`;
                };

                return (
                  <div key={room.id} className="mb-1">
                    {/* Kanal Başlığı */}
                    <div
                      onClick={() => onJoin(room.name)}
                      onMouseEnter={() => setHoveredChannel(`voice-${room.id}`)}
                      onMouseLeave={() => setHoveredChannel(null)}
                      className="group flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-[#35373c]/80 hover:text-[#dbdee1] text-[#949ba4] cursor-pointer transition-all duration-200 active:bg-[#3f4147]"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Volume2
                          size={16}
                          className="text-[#80848e] group-hover:text-[#dbdee1] shrink-0"
                        />
                        <span className="font-medium truncate text-[14px] group-hover:text-white transition-colors">
                          {room.name}
                        </span>
                      </div>

                      {showCreateButton &&
                        hoveredChannel === `voice-${room.id}` && (
                          <button
                            onClick={(e) => handleDeleteRoom(e, room)}
                            className="text-[#949ba4] hover:text-[#dbdee1] p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            title="Odayı Sil"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                    </div>
                    
                    {/* Discord benzeri kullanıcı listesi - Kanalın altında indent edilmiş */}
                    {userCount > 0 && (
                      <div className="ml-6 space-y-0.5 mb-1">
                        {activeUsers.slice(0, 3).map((activeUser, idx) => (
                          <div
                            key={activeUser.userId || idx}
                            className="flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-[#35373c]/60 transition-colors group/user"
                          >
                            {/* Küçük Avatar */}
                            <div
                              className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-semibold overflow-hidden shadow-sm shrink-0"
                              style={{ background: getAvatarColor(activeUser.userId) }}
                            >
                              {activeUser.username?.charAt(0).toUpperCase() || "?"}
                            </div>
                            {/* Kullanıcı Adı */}
                            <span className="text-[12px] text-[#949ba4] group-hover/user:text-[#dbdee1] truncate transition-colors">
                              {activeUser.username || "Bilinmeyen"}
                            </span>
                          </div>
                        ))}
                        {/* Fazla kullanıcı varsa "+X" göster */}
                        {userCount > 3 && (
                          <div className="px-1.5 py-0.5 text-[11px] text-[#80848e] font-medium">
                            +{userCount - 3} kişi daha
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* --- METİN KANALLARI --- */}
        <div>
          <div className="flex items-center justify-between px-1 mb-1 group text-[#949ba4] hover:text-[#dbdee1] transition-colors">
            <div className="flex items-center gap-0.5 text-[11px] font-bold uppercase tracking-wide cursor-pointer hover:text-white">
              <ChevronDown size={12} strokeWidth={3} />
              <span className="ml-0.5">Metin Kanalları</span>
            </div>
            <button
              onClick={handleCreateTextChannel}
              className="hover:text-white transition-colors p-0.5 rounded"
              title="Metin Kanalı Oluştur"
            >
              <Plus size={14} strokeWidth={3} />
            </button>
          </div>

          <div className="space-y-[2px]">
            {textChannels.length === 0 ? (
              <div className="px-2 py-1 text-xs text-[#949ba4] italic">
                Kanal yok
              </div>
            ) : (
              textChannels.map((channel) => {
                // YENİ: Okunmamış mesaj var mı?
                const hasUnread = unreadCounts[channel.id] > 0;

                return (
                  <div
                    key={channel.id}
                    onClick={() => onJoinTextChannel(channel.id)}
                    onMouseEnter={() => setHoveredChannel(`text-${channel.id}`)}
                    onMouseLeave={() => setHoveredChannel(null)}
                    className={`
                      group flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all duration-200 active:bg-[#3f4147] hover-lift hover:shadow-soft
                      ${
                        hasUnread
                          ? "glass-strong text-white shadow-glow"
                          : "text-[#949ba4] hover:bg-[#35373c]/80 hover:text-[#dbdee1]"
                      }
                    `}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Okunmamış varsa ikon beyaz olsun */}
                      <Hash
                        size={18}
                        className={
                          hasUnread
                            ? "text-white"
                            : "text-[#80848e] group-hover:text-[#dbdee1]"
                        }
                      />
                      <span
                        className={`truncate text-[15px] ${
                          hasUnread ? "font-bold text-white" : "font-medium"
                        }`}
                      >
                        {channel.name}
                      </span>
                    </div>

                    {/* YENİ: Okunmamış Noktası */}
                    {hasUnread && (
                      <div className="w-2 h-2 bg-white rounded-full shadow-sm mr-1"></div>
                    )}

                    {/* Silme Butonu */}
                    {(channel.createdBy === user?.uid || isAdmin) &&
                      hoveredChannel === `text-${channel.id}` &&
                      !hasUnread && (
                        <button
                          onClick={(e) => handleDeleteChannel(e, channel)}
                          className="text-[#949ba4] hover:text-[#dbdee1] p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Kanalı Sil"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 3. KULLANICI PANELİ */}
      <div className="bg-[#232428] h-[52px] flex items-center px-2 justify-between shrink-0 border-t border-[#1e1f22] select-none relative" data-user-menu>
        {/* Profil Kısmı - Tıklanabilir (Menü Açılır) */}
        <div
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="flex items-center gap-2.5 hover:bg-[#3f4147]/60 p-1.5 rounded-md cursor-pointer transition-all duration-200 min-w-0 overflow-hidden group flex-1"
        >
          <div className="relative shrink-0">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs overflow-hidden shadow-sm transition-transform group-hover:scale-105"
              style={{ background: profileColor }}
            >
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt="User"
                  className="w-full h-full object-cover"
                />
              ) : (
                user?.displayName?.charAt(0).toUpperCase() || "?"
              )}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-[#232428] rounded-full flex items-center justify-center">
              <div className={`w-2.5 h-2.5 rounded-full transition-colors ${
                userStatus === "online" ? "bg-[#23a559]" :
                userStatus === "offline" ? "bg-[#80848e]" :
                "bg-[#5865f2]"
              }`}></div>
            </div>
          </div>

          <div className="flex flex-col overflow-hidden flex-1">
            <div className="text-[13px] font-semibold text-white truncate leading-tight group-hover:text-[#dbdee1]">
              {user?.displayName || "Misafir"}
            </div>
            <div className="text-[11px] text-[#b5bac1] truncate leading-tight flex items-center gap-1 group-hover:text-[#dbdee1]">
              {userStatus === "online" && "Online"}
              {userStatus === "offline" && "Offline"}
              {userStatus === "invisible" && "Görünmez"}
            </div>
          </div>
        </div>

        {/* Settings Butonu - Ayrı (Menü Açmaz) */}
        <div className="flex items-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenSettings();
            }}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-[#3f4147] text-[#b5bac1] hover:text-[#dbdee1] transition-all relative overflow-hidden"
            title="Kullanıcı Ayarları"
          >
            <Settings
              size={18}
              className="transition-transform duration-500 hover:rotate-90"
            />
          </button>
        </div>

        {/* Kullanıcı Durum Menüsü */}
        {showUserMenu && (
          <div className="absolute bottom-[60px] left-2 right-2 glass-strong border border-white/10 rounded-xl shadow-soft-lg p-2 z-50 animate-scaleIn origin-bottom">
            <div className="text-[11px] font-bold text-[#949ba4] uppercase tracking-wider px-2 py-1.5 mb-1">
              Durum
            </div>
            
            {/* Online */}
            <button
              onClick={() => {
                setUserStatus("online");
                setShowUserMenu(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                userStatus === "online"
                  ? "bg-[#5865f2]/20 text-white border border-[#5865f2]/50"
                  : "text-[#b5bac1] hover:bg-[#3f4147]/60 hover:text-white"
              }`}
            >
              <div className="relative">
                <div className="absolute inset-0 bg-[#23a559] rounded-full blur-sm opacity-50"></div>
                <Circle size={18} className="relative text-[#23a559]" />
              </div>
              <span className="font-semibold text-sm">Online</span>
              {userStatus === "online" && (
                <div className="ml-auto w-2 h-2 bg-[#5865f2] rounded-full"></div>
              )}
            </button>

            {/* Offline */}
            <button
              onClick={() => {
                setUserStatus("offline");
                setShowUserMenu(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 mt-1 ${
                userStatus === "offline"
                  ? "bg-[#5865f2]/20 text-white border border-[#5865f2]/50"
                  : "text-[#b5bac1] hover:bg-[#3f4147]/60 hover:text-white"
              }`}
            >
              <CircleOff size={18} className="text-[#80848e]" />
              <span className="font-semibold text-sm">Offline</span>
              {userStatus === "offline" && (
                <div className="ml-auto w-2 h-2 bg-[#5865f2] rounded-full"></div>
              )}
            </button>

            {/* Görünmez */}
            <button
              onClick={() => {
                setUserStatus("invisible");
                setShowUserMenu(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 mt-1 ${
                userStatus === "invisible"
                  ? "bg-[#5865f2]/20 text-white border border-[#5865f2]/50"
                  : "text-[#b5bac1] hover:bg-[#3f4147]/60 hover:text-white"
              }`}
            >
              <EyeOff size={18} className="text-[#5865f2]" />
              <span className="font-semibold text-sm">Görünmez</span>
              {userStatus === "invisible" && (
                <div className="ml-auto w-2 h-2 bg-[#5865f2] rounded-full"></div>
              )}
            </button>
          </div>
        )}
      </div>

      {/* 4. MODALLAR (PORTAL İLE BODY'YE RENDER) */}
      {showTextChannelModal &&
        typeof window !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center backdrop-blur-sm p-4">
            <div className="bg-[#313338] w-full max-w-md p-6 rounded-md shadow-2xl border border-[#1e1f22] animate-in zoom-in-95 duration-200">
              <h3 className="text-xl font-bold text-white mb-2">Kanal Oluştur</h3>
              <p className="text-[#b5bac1] text-xs mb-6 uppercase font-bold">
                Metin Kanalı
              </p>
              <form onSubmit={handleCreateTextChannelSubmit}>
                <label className="text-[11px] font-bold text-[#b5bac1] uppercase mb-2 block">
                  Kanal Adı
                </label>
                <div className="relative mb-6">
                  <span className="absolute left-3 top-2.5 text-[#b5bac1] text-lg">
                    #
                  </span>
                  <input
                    type="text"
                    value={newChannelName}
                    onChange={(e) =>
                      setNewChannelName(sanitizeChannelNameInput(e.target.value))
                    }
                    placeholder="yeni-kanal"
                    className="w-full bg-[#1e1f22] text-[#dbdee1] p-2.5 pl-8 rounded border-none outline-none font-medium focus:ring-2 focus:ring-[#5865f2]"
                    autoFocus
                  />
                </div>
                {channelError && (
                  <p className="text-xs text-[#f87171] mb-2">{channelError}</p>
                )}
                <div className="flex gap-4 justify-end bg-[#2b2d31] -mx-6 -mb-6 p-4 mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowTextChannelModal(false);
                      setNewChannelName("");
                      setChannelError("");
                    }}
                    className="px-4 py-2 text-sm font-medium text-white hover:underline transition"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="submit"
                    disabled={!newChannelName.trim() || isCreatingTextChannel}
                    className="px-6 py-2 bg-[#5865f2] hover:bg-[#4752c4] text-white rounded text-sm font-medium transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isCreatingTextChannel && (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    )}
                    {isCreatingTextChannel ? "Oluşturuluyor..." : "Kanal Oluştur"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {showVoiceRoomModal &&
        typeof window !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center backdrop-blur-sm p-4">
            <div className="bg-[#313338] w-full max-w-md p-6 rounded-md shadow-2xl border border-[#1e1f22] animate-in zoom-in-95 duration-200">
              <h3 className="text-xl font-bold text-white mb-2">Kanal Oluştur</h3>
              <p className="text-[#b5bac1] text-xs mb-6 uppercase font-bold">
                Ses Kanalı
              </p>
              <form onSubmit={handleCreateRoomSubmit}>
                <label className="text-[11px] font-bold text-[#b5bac1] uppercase mb-2 block">
                  Kanal Adı
                </label>
                <div className="relative mb-6">
                  <span className="absolute left-3 top-2.5 text-[#b5bac1]">
                    <Volume2 size={20} />
                  </span>
                  <input
                    type="text"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(sanitizeRoomNameInput(e.target.value))}
                    placeholder="Genel Sohbet"
                    className="w-full bg-[#1e1f22] text-[#dbdee1] p-2.5 pl-10 rounded border-none outline-none font-medium focus:ring-2 focus:ring-[#5865f2]"
                    autoFocus
                  />
                </div>
                {roomError && (
                  <p className="text-xs text-[#f87171] -mt-4 mb-4">{roomError}</p>
                )}
                <div className="flex gap-4 justify-end bg-[#2b2d31] -mx-6 -mb-6 p-4 mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowVoiceRoomModal(false);
                      setNewRoomName("");
                      setRoomError("");
                    }}
                    className="px-4 py-2 text-sm font-medium text-white hover:underline transition"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="submit"
                    disabled={!newRoomName.trim() || isCreating}
                    className="px-6 py-2 bg-[#5865f2] hover:bg-[#4752c4] text-white rounded text-sm font-medium transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isCreating && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isCreating ? "Oluşturuluyor..." : "Kanal Oluştur"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      <ShortcutHelpModal
        isOpen={showShortcutModal}
        onClose={() => setShowShortcutModal(false)}
      />

      <ConfirmDialog
        isOpen={confirmDialog.open}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmLabel={confirmDialog.confirmLabel}
        variant={confirmDialog.variant}
        loading={confirmLoading}
        itemToDelete={confirmDialog.itemToDelete}
        onConfirm={handleConfirmDialog}
        onCancel={closeConfirmDialog}
      />
    </div>
  );
}
