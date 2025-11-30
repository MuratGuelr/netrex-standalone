"use client";
import { useEffect, useState } from "react";
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
} from "lucide-react";
import { useChatStore } from "@/src/store/chatStore";
import { useSettingsStore } from "@/src/store/settingsStore";

// BURAYA KENDİ FIREBASE UID'Nİ YAZACAKSIN
const ADMIN_UID = "BURAYA_KENDI_FIREBASE_UID_YAZ";

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
    fetchTextChannels,
    createTextChannel,
    deleteTextChannel,
    unreadCounts, // YENİ: Okunmamış mesaj sayıları
  } = useChatStore();

  const { profileColor } = useSettingsStore();

  const [isCreatingTextChannel, setIsCreatingTextChannel] = useState(false);
  const [showTextChannelModal, setShowTextChannelModal] = useState(false);
  const [showVoiceRoomModal, setShowVoiceRoomModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newRoomName, setNewRoomName] = useState("");
  const [hoveredChannel, setHoveredChannel] = useState(null);

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

    fetchTextChannels();
    const refreshInterval = setInterval(() => {
      fetchTextChannels();
    }, 5000);

    return () => {
      unsubscribe();
      clearInterval(refreshInterval);
    };
  }, []);

  // --- ODA OLUŞTURMA ---
  const createRoom = async () => {
    if (user?.uid !== ADMIN_UID) {
      alert("Bu işlem için yetkiniz yok.");
      return;
    }
    setShowVoiceRoomModal(true);
  };

  const handleCreateRoomSubmit = async (e) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;

    setIsCreating(true);
    try {
      await addDoc(collection(db, "rooms"), {
        name: newRoomName.trim(),
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });
      setNewRoomName("");
      setShowVoiceRoomModal(false);
    } catch (error) {
      console.error("Oda oluşturma hatası:", error);
      alert("Oda oluşturulamadı.");
    }
    setIsCreating(false);
  };

  // --- KANAL OLUŞTURMA ---
  const handleCreateTextChannel = () => {
    setShowTextChannelModal(true);
  };

  const handleCreateTextChannelSubmit = async (e) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;

    setIsCreatingTextChannel(true);
    const result = await createTextChannel(newChannelName.trim(), user?.uid);
    if (!result.success && result.error) {
      alert(result.error);
    } else {
      fetchTextChannels();
      setNewChannelName("");
      setShowTextChannelModal(false);
    }
    setIsCreatingTextChannel(false);
  };

  // --- KANAL SİLME ---
  const handleDeleteChannel = async (e, channelId) => {
    e.stopPropagation();
    if (window.confirm("Bu kanalı silmek istediğinize emin misiniz?")) {
      await deleteTextChannel(channelId);
      fetchTextChannels();
    }
  };

  // --- ODA SİLME ---
  const handleDeleteRoom = async (e, roomId) => {
    e.stopPropagation();
    if (window.confirm("Bu ses odasını silmek istediğinize emin misiniz?")) {
      try {
        await deleteDoc(doc(db, "rooms", roomId));
      } catch (error) {
        console.error("Oda silinemedi:", error);
      }
    }
  };

  const showCreateButton = user?.uid === ADMIN_UID;

  return (
    <div className="w-60 bg-[#2b2d31] h-full flex flex-col flex-shrink-0 select-none border-r border-[#1f2023]">
      {/* 1. ÜST BAŞLIK */}
      <div className="h-12 border-b border-[#1f2023] flex items-center justify-between px-4 shadow-sm hover:bg-[#35373c] transition-colors cursor-pointer group mb-2">
        <h1 className="font-bold text-white text-[15px] truncate">
          Netrex Client
        </h1>
        {showCreateButton && <Shield size={14} className="text-[#23a559]" />}
      </div>

      {/* 2. KANALLAR LİSTESİ */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-2 space-y-6 pt-2">
        {/* --- SES KANALLARI --- */}
        <div>
          <div className="flex items-center justify-between px-1 mb-1 group text-[#949ba4] hover:text-[#dbdee1] transition-colors">
            <div className="flex items-center gap-0.5 text-[11px] font-bold uppercase tracking-wide cursor-pointer hover:text-white">
              <ChevronDown size={12} strokeWidth={3} />
              <span className="ml-0.5">Ses Kanalları</span>
            </div>
            {showCreateButton && (
              <button
                onClick={createRoom}
                className="hover:text-white transition-colors p-0.5 rounded"
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
                  className="group flex items-center justify-between px-2 py-[6px] rounded-[4px] hover:bg-[#35373c] hover:text-[#dbdee1] text-[#949ba4] cursor-pointer transition-all active:bg-[#3f4147]"
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
                        onClick={(e) => handleDeleteRoom(e, room.id)}
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
                      group flex items-center justify-between px-2 py-[6px] rounded-[4px] cursor-pointer transition-all active:bg-[#3f4147]
                      ${
                        hasUnread
                          ? "bg-[#35373c] text-white"
                          : "text-[#949ba4] hover:bg-[#35373c] hover:text-[#dbdee1]"
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
                    {(channel.createdBy === user?.uid ||
                      user?.uid === ADMIN_UID) &&
                      hoveredChannel === `text-${channel.id}` &&
                      !hasUnread && (
                        <button
                          onClick={(e) => handleDeleteChannel(e, channel.id)}
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
                    setNewChannelName(
                      e.target.value.toLowerCase().replace(/\s+/g, "-")
                    )
                  }
                  placeholder="yeni-kanal"
                  className="w-full bg-[#1e1f22] text-[#dbdee1] p-2.5 pl-8 rounded border-none outline-none font-medium focus:ring-2 focus:ring-[#5865f2]"
                  autoFocus
                />
              </div>
              <div className="flex gap-4 justify-end bg-[#2b2d31] -mx-6 -mb-6 p-4 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowTextChannelModal(false);
                    setNewChannelName("");
                  }}
                  className="px-4 py-2 text-sm font-medium text-white hover:underline transition"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={!newChannelName.trim() || isCreatingTextChannel}
                  className="px-6 py-2 bg-[#5865f2] hover:bg-[#4752c4] text-white rounded text-sm font-medium transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Kanal Oluştur
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
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="Genel Sohbet"
                  className="w-full bg-[#1e1f22] text-[#dbdee1] p-2.5 pl-10 rounded border-none outline-none font-medium focus:ring-2 focus:ring-[#5865f2]"
                  autoFocus
                />
              </div>
              <div className="flex gap-4 justify-end bg-[#2b2d31] -mx-6 -mb-6 p-4 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowVoiceRoomModal(false);
                    setNewRoomName("");
                  }}
                  className="px-4 py-2 text-sm font-medium text-white hover:underline transition"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={!newRoomName.trim() || isCreating}
                  className="px-6 py-2 bg-[#5865f2] hover:bg-[#4752c4] text-white rounded text-sm font-medium transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Kanal Oluştur
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
