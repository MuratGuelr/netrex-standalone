"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
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
}) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const {
    textChannels,
    createTextChannel,
    deleteTextChannel,
    unreadCounts, // YENİ: Okunmamış mesaj sayıları
    startTextChannelListener,
  } = useChatStore();

  const { profileColor } = useSettingsStore();

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
              rooms.map((room) => (
                <div
                  key={room.id}
                  onClick={() => onJoin(room.name)}
                  onMouseEnter={() => setHoveredChannel(`voice-${room.id}`)}
                  onMouseLeave={() => setHoveredChannel(null)}
                  className="group flex items-center justify-between px-3 py-2 rounded-xl hover:bg-[#35373c]/80 hover:text-[#dbdee1] text-[#949ba4] cursor-pointer transition-all duration-200 active:bg-[#3f4147] hover-lift hover:shadow-soft"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Volume2
                      size={18}
                      className="text-[#80848e] group-hover:text-[#dbdee1]"
                    />
                    <span className="font-medium truncate text-[15px] group-hover:text-white transition-colors">
                      {room.name}
                    </span>
                  </div>

                    {showCreateButton &&
                      hoveredChannel === `voice-${room.id}` && (
                        <button
                          onClick={(e) => handleDeleteRoom(e, room)}
                        className="text-[#949ba4] hover:text-[#dbdee1] p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Odayı Sil"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                </div>
              ))
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
      <div className="bg-[#232428] h-[52px] flex items-center px-2 justify-between shrink-0 border-t border-[#1e1f22] select-none">
        <div
          onClick={onOpenSettings}
          className="flex items-center gap-2.5 hover:bg-[#3f4147]/60 p-1.5 rounded-md cursor-pointer transition-all duration-200 min-w-0 overflow-hidden group w-full"
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
              <div className="w-2.5 h-2.5 bg-[#23a559] rounded-full"></div>
            </div>
          </div>

          <div className="flex flex-col overflow-hidden flex-1">
            <div className="text-[13px] font-semibold text-white truncate leading-tight group-hover:text-[#dbdee1]">
              {user?.displayName || "Misafir"}
            </div>
            <div className="text-[11px] text-[#b5bac1] truncate leading-tight flex items-center gap-1 group-hover:text-[#dbdee1]">
              #{user?.uid?.substring(0, 4) || "0000"}
            </div>
          </div>

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
        </div>
      </div>

      {/* 4. MODALLAR (AYNI) */}
      {showTextChannelModal && (
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
        </div>
      )}

      {showVoiceRoomModal && (
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
        </div>
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
