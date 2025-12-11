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
import { systemToast } from "@/src/utils/toast";
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
  currentTextChannel,
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
    currentChannel,
    showChatPanel,
    toggleChatPanel,
    setShowChatPanel,
    loadChannelMessages,
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

  // Responsive user list limit
  const [maxVisibleUsers, setMaxVisibleUsers] = useState(7);

  useEffect(() => {
    const handleResize = () => {
      const height = window.innerHeight;
      if (height < 700) {
        setMaxVisibleUsers(4);
      } else if (height < 900) {
        setMaxVisibleUsers(7);
      } else {
        setMaxVisibleUsers(12);
      }
    };

    // Initial check
    handleResize();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
          (u) => !prevUsers.some((prevUser) => prevUser.userId === u.userId)
        );
        
        // Bildirim göster (ayarlar açıksa)
        if (newUsers.length > 0 && notifyOnJoin) {
          newUsers.forEach((newUser) => {
            // Kendi kullanıcımız değilse bildirim göster
            if (newUser.userId !== user?.uid) {
              const username = newUser.username || "Bir kullanıcı";
              const isAppActive = typeof document !== "undefined" && !document.hidden && document.hasFocus();
              const isInSameRoom = currentRoom === roomName;
              
              // Toast bildirimi (uygulama aktifken ve aynı odada değilsek)
              if (isAppActive && !isInSameRoom) {
                systemToast({
                  title: `${username} online oldu`,
                  message: `"${roomName}" odasına katıldı`,
                  type: "join",
                });
              }
              
              // Masaüstü bildirimi (uygulama arka plandayken veya minimizedken)
              if (!isAppActive && desktopNotifications) {
                if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
                  try {
                    const notification = new Notification(
                      `${username} online oldu`,
                      {
                        body: `"${roomName}" odasına katıldı`,
                        icon: "/favicon.ico",
                        badge: "/favicon.ico",
                        tag: `join-${roomName}-${newUser.userId}-${Date.now()}`,
                        silent: false,
                      }
                    );
                    
                    notification.onclick = () => {
                      if (window.netrex?.focusWindow) {
                        window.netrex.focusWindow();
                      } else {
                        window.focus();
                      }
                      notification.close();
                    };
                    
                    setTimeout(() => notification.close(), 5000);
                  } catch (error) {
                    console.error("Masaüstü bildirim hatası:", error);
                  }
                }
              }
            }
          });
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
      try {
          // Eğer kullanıcı bu kanalda ise önce çıkar
          if (currentRoom === room.name) {
            onJoin(null);
          }
          await deleteDoc(doc(db, "rooms", room.id));
          console.log("✅ Ses kanalı Firebase'den silindi:", room.id);
      } catch (error) {
          console.error("❌ Ses kanalı silme hatası:", error);
          throw error; // ConfirmDialog'a hata fırlat ki kullanıcıya göstersin
      }
      },
    });
  };

  const showCreateButton = isAdmin;

  return (
    <div className="w-sidebar h-full flex flex-col flex-shrink-0 select-none relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#1a1b1e] via-[#16171a] to-[#111214] pointer-events-none" />
      
      {/* Subtle glow effects */}
      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-purple-500/3 to-transparent pointer-events-none" />
      
      {/* Right border */}
      <div className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-white/10 via-white/5 to-white/10" />
      
      {/* 1. ÜST BAŞLIK - Premium */}
      <div className="relative z-10 px-3 py-4">
        {/* Header card */}
        <div className="flex items-center justify-between">
          {/* Logo ve başlık */}
          <div className="flex items-center gap-3 group">
            {/* Logo container with glow */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl blur-md opacity-40 group-hover:opacity-60 transition-opacity duration-300" />
              <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg overflow-hidden">
                <img 
                  src="/logo.png" 
                  alt="Netrex" 
                  className="w-10 h-10 object-contain" 
                  onError={(e) => { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'block'; }} 
                />
                <span className="text-white font-bold text-lg hidden">N</span>
              </div>
            </div>
            
            <div className="flex flex-col">
              <h1 className="font-bold text-white text-base tracking-tight leading-none">Netrex</h1>
              <span className="text-[10px] text-[#5c5e66] font-medium mt-0.5">Sesli Sohbet</span>
            </div>
          </div>
          
          {/* Sağ butonlar */}
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); setShowShortcutModal(true); }}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#5c5e66] hover:text-white hover:bg-white/10 transition-all duration-200"
              title="Klavye kısayolları (Ctrl + /)"
            >
              <HelpCircle size={16} />
            </button>
            {showCreateButton && (
              <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-green-500/10 border border-green-500/20">
                <Shield size={14} className="text-green-400" title="Yönetici" />
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Divider */}
      <div className="relative z-10 mx-3 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      
      {globalError && (
        <div className="relative z-10 mx-3 mt-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-medium flex items-center justify-between gap-4 animate-fadeIn">
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
      <div className="flex-1 overflow-y-auto scrollbar-thin px-3 space-y-4 pt-4 relative z-10">
        {/* --- SES KANALLARI --- */}
        <div>
          <div className="flex items-center justify-between px-1 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-1 h-3 rounded-full bg-gradient-to-b from-cyan-400 to-blue-500" />
              <span className="text-[10px] font-bold text-[#5c5e66] uppercase tracking-wider">Ses Kanalları</span>
            </div>
            {showCreateButton && (
              <button
                onClick={createRoom}
                className="w-6 h-6 flex items-center justify-center rounded-lg text-[#5c5e66] hover:text-white hover:bg-white/10 transition-all duration-200"
                title="Ses Kanalı Oluştur"
              >
                <Plus size={14} strokeWidth={2} />
              </button>
            )}
          </div>

          <div className="space-y-1">
            {loading ? (
              <div className="px-3 py-2 text-xs text-[#5c5e66] animate-pulse flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" />
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
                      className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 relative overflow-hidden ${
                        currentRoom === room.name
                          ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/10 border border-cyan-500/30 shadow-[0_0_15px_rgba(34,211,238,0.15)]"
                          : "hover:bg-white/5 border border-transparent"
                      }`}
                    >
                      {/* Active glow */}
                      {currentRoom === room.name && (
                        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-transparent pointer-events-none" />
                      )}
                      
                      <div className="flex items-center gap-3 min-w-0 flex-1 relative z-10">
                        {/* Icon container */}
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
                          currentRoom === room.name
                            ? "bg-cyan-500/20 text-cyan-400"
                            : "bg-white/5 text-[#5c5e66] group-hover:bg-white/10 group-hover:text-[#949ba4]"
                        }`}>
                          <Volume2 size={16} />
                        </div>
                        
                        <div className="flex flex-col min-w-0">
                          <span className={`truncate text-sm ${
                            currentRoom === room.name ? "font-semibold text-white" : "font-medium text-[#949ba4] group-hover:text-white"
                          }`}>
                            {room.name}
                          </span>
                          {userCount > 0 && (
                            <span className="text-[10px] text-[#5c5e66]">
                              {userCount} kullanıcı
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Active indicator dot */}
                      {currentRoom === room.name && (
                        <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)] animate-pulse mr-2" />
                      )}

                      {showCreateButton && (
                        <button
                          onClick={(e) => handleDeleteRoom(e, room)}
                          className="text-[#5c5e66] hover:text-red-400 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 shrink-0 hover:bg-red-500/10 relative z-10"
                          title="Odayı Sil"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    
                    {/* Kullanıcı listesi - Kanalın altında */}
                    {userCount > 0 && (
                      <div className="ml-4 mt-1 space-y-0.5 mb-1 border-l-2 border-white/5 pl-3">
                        {activeUsers.slice(0, maxVisibleUsers).map((activeUser, idx) => (
                          <div
                            key={activeUser.userId || idx}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors duration-200 group/user"
                          >
                            {/* Küçük Avatar */}
                            <div
                              className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shrink-0 shadow-sm"
                              style={{ background: getAvatarColor(activeUser.userId) }}
                            >
                              {activeUser.username?.charAt(0).toUpperCase() || "?"}
                            </div>
                            {/* Kullanıcı Adı */}
                            <span className="text-xs text-[#5c5e66] group-hover/user:text-[#949ba4] truncate transition-colors">
                              {activeUser.username || "Bilinmeyen"}
                            </span>
                            {/* Speaking indicator placeholder */}
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500/50 ml-auto opacity-0 group-hover/user:opacity-100 transition-opacity" />
                          </div>
                        ))}
                        {/* Fazla kullanıcı varsa "+X" göster */}
                        {userCount > maxVisibleUsers && (
                          <div className="px-2 py-1 text-[10px] text-[#5c5e66] font-medium">
                            +{userCount - maxVisibleUsers} kişi daha
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
        <div className="mt-4">
          <div className="flex items-center justify-between px-1 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-1 h-3 rounded-full bg-gradient-to-b from-purple-400 to-pink-500" />
              <span className="text-[10px] font-bold text-[#5c5e66] uppercase tracking-wider">Metin Kanalları</span>
            </div>
            <button
              onClick={handleCreateTextChannel}
              className="w-6 h-6 flex items-center justify-center rounded-lg text-[#5c5e66] hover:text-white hover:bg-white/10 transition-all duration-200"
              title="Metin Kanalı Oluştur"
            >
              <Plus size={14} strokeWidth={2} />
            </button>
          </div>

          <div className="space-y-1">
            {textChannels.length === 0 ? (
              <div className="px-3 py-2 text-xs text-[#5c5e66] italic">
                Kanal yok
              </div>
            ) : (
              textChannels.map((channel) => {
                const hasUnread = unreadCounts[channel.id] > 0;
                const isSelected = currentTextChannel === channel.id;

                return (
                  <div
                    key={channel.id}
                    onClick={async () => {
                      if (!currentRoom) {
                        onJoinTextChannel(channel.id);
                        return;
                      }
                      
                      if (currentChannel?.id === channel.id) {
                        setShowChatPanel(!showChatPanel);
                      } else {
                        setShowChatPanel(true);
                        try {
                          onJoinTextChannel(channel.id);
                          await loadChannelMessages(channel.id);
                        } catch (error) {
                          console.error("Kanal mesajları yüklenirken hata:", error);
                          toast.error("Kanal açılamadı. Lütfen tekrar deneyin.");
                          setShowChatPanel(false);
                        }
                      }
                    }}
                    onMouseEnter={() => setHoveredChannel(`text-${channel.id}`)}
                    onMouseLeave={() => setHoveredChannel(null)}
                    className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 relative overflow-hidden ${
                      isSelected
                        ? "bg-gradient-to-r from-purple-500/20 to-pink-500/10 border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.15)]"
                        : hasUnread
                          ? "bg-indigo-500/10 border border-indigo-500/20"
                          : "hover:bg-white/5 border border-transparent"
                    }`}
                  >
                    {/* Active glow */}
                    {isSelected && (
                      <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-transparent pointer-events-none" />
                    )}
                    
                    <div className="flex items-center gap-3 min-w-0 relative z-10">
                      {/* Icon container */}
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
                        isSelected
                          ? "bg-purple-500/20 text-purple-400"
                          : hasUnread
                            ? "bg-indigo-500/20 text-indigo-400"
                            : "bg-white/5 text-[#5c5e66] group-hover:bg-white/10 group-hover:text-[#949ba4]"
                      }`}>
                        <Hash size={16} />
                      </div>
                      
                      <span className={`truncate text-sm ${
                        isSelected ? "font-semibold text-white" : 
                        hasUnread ? "font-semibold text-white" : 
                        "font-medium text-[#949ba4] group-hover:text-white"
                      }`}>
                        {channel.name}
                      </span>
                    </div>

                    {/* Unread badge */}
                    {hasUnread && !isSelected && (
                      <div className="flex items-center gap-2 relative z-10">
                        <div className="px-2 py-0.5 rounded-full bg-indigo-500 text-[10px] font-bold text-white shadow-[0_0_10px_rgba(99,102,241,0.5)]">
                          {unreadCounts[channel.id]}
                        </div>
                      </div>
                    )}
                    
                    {/* Active indicator */}
                    {isSelected && (
                      <div className="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.6)] animate-pulse relative z-10" />
                    )}

                    {/* Silme Butonu */}
                    {(channel.createdBy === user?.uid || isAdmin) && !hasUnread && !isSelected && (
                      <button
                        onClick={(e) => handleDeleteChannel(e, channel)}
                        className="text-[#5c5e66] hover:text-red-400 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-red-500/10 relative z-10"
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
      {/* 3. KULLANICI PANELİ - Premium */}
      <div className="relative z-10 p-3" data-user-menu>
        {/* Top divider */}
        <div className="absolute top-0 left-3 right-3 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        
        <div className="flex items-center justify-between bg-gradient-to-br from-white/5 to-transparent rounded-2xl p-2 border border-white/5 hover:border-white/10 transition-all duration-200 group">
          {/* Profil Kısmı */}
          <div
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-3 cursor-pointer min-w-0 overflow-hidden flex-1"
          >
            <div className="relative shrink-0">
              {/* Avatar with glow */}
              <div className="absolute inset-0 rounded-xl blur-md opacity-50 transition-opacity group-hover:opacity-70" style={{ background: profileColor }} />
              <div
                className="relative w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm overflow-hidden shadow-lg border border-white/10"
                style={{ background: profileColor }}
              >
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="User" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-base">{user?.displayName?.charAt(0).toUpperCase() || "?"}</span>
                )}
              </div>
              
              {/* Status indicator */}
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-[#111214] rounded-full flex items-center justify-center">
                <div className={`w-2.5 h-2.5 rounded-full ${
                  userStatus === "online" ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" :
                  userStatus === "offline" ? "bg-gray-500" :
                  "bg-indigo-500"
                }`} />
              </div>
            </div>

            <div className="flex flex-col overflow-hidden flex-1">
              <div className="text-sm font-semibold text-white truncate leading-tight">
                {user?.displayName || "Misafir"}
              </div>
              <div className="text-[10px] text-[#5c5e66] truncate leading-tight flex items-center gap-1">
                <div className={`w-1.5 h-1.5 rounded-full ${
                  userStatus === "online" ? "bg-green-500" :
                  userStatus === "offline" ? "bg-gray-500" :
                  "bg-indigo-500"
                }`} />
                {userStatus === "online" && "Online"}
                {userStatus === "offline" && "Offline"}
                {userStatus === "invisible" && "Görünmez"}
              </div>
            </div>
          </div>

          {/* Settings Butonu */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenSettings();
            }}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-[#5c5e66] hover:text-white hover:bg-white/10 hover:rotate-90 transition-all duration-300"
            title="Kullanıcı Ayarları"
          >
            <Settings size={18} />
          </button>
        </div>

        {/* Kullanıcı Durum Menüsü */}
        {showUserMenu && (
          <div className="absolute bottom-[72px] left-3 right-3 bg-gradient-to-br from-[#1e1f22] to-[#16171a] border border-white/10 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.5)] p-2 z-50 animate-scaleIn origin-bottom backdrop-blur-xl">
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2 mb-1">
              <div className="w-1 h-3 rounded-full bg-gradient-to-b from-indigo-400 to-purple-500" />
              <span className="text-[10px] font-bold text-[#5c5e66] uppercase tracking-wider">Durumunu Değiştir</span>
            </div>
            
            {/* Online */}
            <button
              onClick={() => { setUserStatus("online"); setShowUserMenu(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                userStatus === "online" 
                  ? "bg-green-500/10 border border-green-500/30" 
                  : "hover:bg-white/5 border border-transparent"
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                userStatus === "online" ? "bg-green-500/20" : "bg-white/5"
              }`}>
                <Circle size={16} className="text-green-400" />
              </div>
              <span className="font-medium text-sm text-white">Online</span>
              {userStatus === "online" && <div className="ml-auto w-2 h-2 bg-green-400 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)]" />}
            </button>

            {/* Offline */}
            <button
              onClick={() => { setUserStatus("offline"); setShowUserMenu(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 mt-1 ${
                userStatus === "offline" 
                  ? "bg-gray-500/10 border border-gray-500/30" 
                  : "hover:bg-white/5 border border-transparent"
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                userStatus === "offline" ? "bg-gray-500/20" : "bg-white/5"
              }`}>
                <CircleOff size={16} className="text-gray-400" />
              </div>
              <span className="font-medium text-sm text-white">Offline</span>
              {userStatus === "offline" && <div className="ml-auto w-2 h-2 bg-gray-400 rounded-full" />}
            </button>

            {/* Görünmez */}
            <button
              onClick={() => { setUserStatus("invisible"); setShowUserMenu(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 mt-1 ${
                userStatus === "invisible" 
                  ? "bg-indigo-500/10 border border-indigo-500/30" 
                  : "hover:bg-white/5 border border-transparent"
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                userStatus === "invisible" ? "bg-indigo-500/20" : "bg-white/5"
              }`}>
                <EyeOff size={16} className="text-indigo-400" />
              </div>
              <span className="font-medium text-sm text-white">Görünmez</span>
              {userStatus === "invisible" && <div className="ml-auto w-2 h-2 bg-indigo-400 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.6)]" />}
            </button>
          </div>
        )}
      </div>

      {/* 4. MODALLAR (PORTAL İLE BODY'YE RENDER) */}
      {showTextChannelModal &&
        typeof window !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center backdrop-blur-md animate-fadeIn p-4">
            {/* Animated background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-transparent pointer-events-none"></div>
            
            <div className="glass-strong w-full max-w-md rounded-3xl shadow-2xl border border-white/20 animate-scaleIn backdrop-blur-2xl bg-gradient-to-br from-[#1e1f22]/95 via-[#25272a]/95 to-[#2b2d31]/95 relative overflow-hidden">
              {/* Top glow effect */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent z-10"></div>
              
              {/* Background particles */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl animate-pulse-slow"></div>
                <div className="absolute bottom-1/4 right-1/4 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl animate-pulse-slow" style={{ animationDelay: "1s" }}></div>
      </div>

              <div className="relative z-10 p-8">
                {/* Header */}
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-indigo-500/30 shadow-soft">
                      <Hash size={20} className="text-indigo-300" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white relative">
                        <span className="relative z-10">Kanal Oluştur</span>
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 opacity-0 hover:opacity-100 transition-opacity duration-300 blur-sm"></div>
                      </h3>
                      <p className="text-xs text-[#949ba4] font-medium mt-0.5">
              Metin Kanalı
            </p>
                    </div>
                  </div>
                </div>

            <form onSubmit={handleCreateTextChannelSubmit}>
                  <div className="glass-strong rounded-2xl p-6 border border-white/10 shadow-soft-lg mb-6 relative group/card hover:shadow-xl transition-all duration-300">
                    {/* Hover glow */}
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 z-10 pointer-events-none rounded-2xl"></div>
                    
                    <div className="relative z-10">
                      <label className="text-[11px] font-bold text-[#949ba4] uppercase mb-3 flex items-center gap-1.5 block">
                        <Hash size={12} className="text-indigo-400" /> Kanal Adı
              </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#949ba4] text-lg font-medium">
                  #
                </span>
                <input
                  type="text"
                  value={newChannelName}
                  onChange={(e) =>
                            setNewChannelName(sanitizeChannelNameInput(e.target.value))
                  }
                  placeholder="yeni-kanal"
                          className="w-full bg-[#1e1f22] text-white p-3.5 pl-10 rounded-xl border border-white/10 outline-none font-medium transition-all duration-300 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 focus:bg-[#25272a] placeholder:text-[#4e5058]"
                  autoFocus
                />
              </div>
                      {channelError && (
                        <div className="mt-3 bg-gradient-to-r from-red-500/15 to-red-600/15 text-red-300 p-3 rounded-xl flex items-center gap-2 text-sm border border-red-500/30 shadow-soft backdrop-blur-sm animate-fadeIn">
                          <div className="w-1 h-1 bg-red-400 rounded-full"></div>
                          <span className="font-medium">{channelError}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer buttons */}
                  <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowTextChannelModal(false);
                    setNewChannelName("");
                        setChannelError("");
                  }}
                      onMouseDown={(e) => e.preventDefault()}
                      className="px-6 py-3 text-sm font-semibold text-[#b5bac1] hover:text-white transition-all duration-300 rounded-xl hover:bg-white/5 focus:outline-none"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={!newChannelName.trim() || isCreatingTextChannel}
                      onMouseDown={(e) => e.preventDefault()}
                      className="px-8 py-3 gradient-primary hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] text-white rounded-xl font-semibold transition-all duration-300 hover:scale-105 relative overflow-hidden group/save disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 focus:outline-none"
                >
                      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 opacity-0 group-hover/save:opacity-100 transition-opacity duration-300"></div>
                      <span className="relative z-10 flex items-center gap-2">
                        {isCreatingTextChannel && (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        )}
                        {isCreatingTextChannel ? "Oluşturuluyor..." : "Kanal Oluştur"}
                      </span>
                </button>
              </div>
            </form>
          </div>
        </div>
          </div>,
          document.body
      )}

      {showVoiceRoomModal &&
        typeof window !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center backdrop-blur-md animate-fadeIn p-4">
            {/* Animated background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-transparent pointer-events-none"></div>
            
            <div className="glass-strong w-full max-w-md rounded-3xl shadow-2xl border border-white/20 animate-scaleIn backdrop-blur-2xl bg-gradient-to-br from-[#1e1f22]/95 via-[#25272a]/95 to-[#2b2d31]/95 relative overflow-hidden">
              {/* Top glow effect */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent z-10"></div>
              
              {/* Background particles */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl animate-pulse-slow"></div>
                <div className="absolute bottom-1/4 right-1/4 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl animate-pulse-slow" style={{ animationDelay: "1s" }}></div>
              </div>

              <div className="relative z-10 p-8">
                {/* Header */}
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-indigo-500/30 shadow-soft">
                      <Volume2 size={20} className="text-indigo-300" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white relative">
                        <span className="relative z-10">Kanal Oluştur</span>
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 opacity-0 hover:opacity-100 transition-opacity duration-300 blur-sm"></div>
                      </h3>
                      <p className="text-xs text-[#949ba4] font-medium mt-0.5">
              Ses Kanalı
            </p>
                    </div>
                  </div>
                </div>

            <form onSubmit={handleCreateRoomSubmit}>
                  <div className="glass-strong rounded-2xl p-6 border border-white/10 shadow-soft-lg mb-6 relative group/card hover:shadow-xl transition-all duration-300">
                    {/* Hover glow */}
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 z-10 pointer-events-none rounded-2xl"></div>
                    
                    <div className="relative z-10">
                      <label className="text-[11px] font-bold text-[#949ba4] uppercase mb-3 flex items-center gap-1.5 block">
                        <Volume2 size={12} className="text-indigo-400" /> Kanal Adı
              </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#949ba4]">
                          <Volume2 size={18} className="text-indigo-400/60" />
                </span>
                <input
                  type="text"
                  value={newRoomName}
                          onChange={(e) => setNewRoomName(sanitizeRoomNameInput(e.target.value))}
                  placeholder="Genel Sohbet"
                          className="w-full bg-[#1e1f22] text-white p-3.5 pl-12 rounded-xl border border-white/10 outline-none font-medium transition-all duration-300 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 focus:bg-[#25272a] placeholder:text-[#4e5058]"
                  autoFocus
                />
              </div>
                      {roomError && (
                        <div className="mt-3 bg-gradient-to-r from-red-500/15 to-red-600/15 text-red-300 p-3 rounded-xl flex items-center gap-2 text-sm border border-red-500/30 shadow-soft backdrop-blur-sm animate-fadeIn">
                          <div className="w-1 h-1 bg-red-400 rounded-full"></div>
                          <span className="font-medium">{roomError}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer buttons */}
                  <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowVoiceRoomModal(false);
                    setNewRoomName("");
                        setRoomError("");
                  }}
                      onMouseDown={(e) => e.preventDefault()}
                      className="px-6 py-3 text-sm font-semibold text-[#b5bac1] hover:text-white transition-all duration-300 rounded-xl hover:bg-white/5 focus:outline-none"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={!newRoomName.trim() || isCreating}
                      onMouseDown={(e) => e.preventDefault()}
                      className="px-8 py-3 gradient-primary hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] text-white rounded-xl font-semibold transition-all duration-300 hover:scale-105 relative overflow-hidden group/save disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 focus:outline-none"
                >
                      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 opacity-0 group-hover/save:opacity-100 transition-opacity duration-300"></div>
                      <span className="relative z-10 flex items-center gap-2">
                        {isCreating && <Loader2 className="w-4 h-4 animate-spin" />}
                        {isCreating ? "Oluşturuluyor..." : "Kanal Oluştur"}
                      </span>
                </button>
              </div>
            </form>
          </div>
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
