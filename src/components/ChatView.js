"use client";
import { useEffect, useState, useRef, useMemo, useCallback, memo } from "react";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { useChatStore } from "@/src/store/chatStore";
import {
  Send,
  Trash2,
  Copy,
  AlertTriangle,
  Gift,
  Sticker,
  Smile,
  Hash,
  Loader2,
  Bell,
} from "lucide-react";
import { toast } from "sonner";
import { MESSAGE_SEQUENCE_THRESHOLD } from "@/src/constants/appConfig";
import { useSettingsStore } from "@/src/store/settingsStore";

export default function ChatView({ channelId, username, userId }) {
  const {
    messages,
    loadChannelMessages,
    loadOlderMessages,
    sendMessage,
    addIncomingMessage,
    deleteMessage,
    deleteMessageSequence,
    currentChannel,
    hasMoreMessages,
    isLoading,
    isLoadingOlderMessages,
  } = useChatStore();
  const currentChannelName = currentChannel?.name || "sohbet";

  const [messageInput, setMessageInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [contextMenu, setContextMenu] = useState(null);
  const [linkModal, setLinkModal] = useState({ isOpen: false, url: "" });
  const [notificationPermission, setNotificationPermission] = useState(
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "default"
  );
  const [canUseNotifications, setCanUseNotifications] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const room = useRoomContext();
  const containerRef = useRef(null);
  const emojiPickerRef = useRef(null);

  useEffect(() => {
    if (channelId) loadChannelMessages(channelId);
  }, [channelId, loadChannelMessages]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const supported = "Notification" in window;
    setCanUseNotifications(supported);
    if (supported) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // Desktop notification fonksiyonu - handleDataReceived'tan önce tanımlanmalı
  const { desktopNotifications, notifyOnMessage } = useSettingsStore();
  const showDesktopNotification = useCallback(
    (incomingMessage) => {
      // Bildirim ayarları kontrolü
      if (!desktopNotifications || !notifyOnMessage) {
        return;
      }
      if (
        !canUseNotifications ||
        notificationPermission !== "granted" ||
        !incomingMessage
      ) {
        return;
      }
      if (typeof document !== "undefined") {
        if (!document.hidden && document.hasFocus()) {
          return;
        }
      }
      if (currentChannel?.id === channelId) {
        return; // Aynı kanal açıksa bildirim gösterme
      }
      const channelName = currentChannel?.name || "sohbet";
      const body = incomingMessage.text
        ? incomingMessage.text.slice(0, 120)
        : "Yeni mesaj";
      try {
        new Notification(
          `${incomingMessage.username || "Bir kullanıcı"} - #${channelName}`,
          {
            body: body,
            icon: "/logo.ico",
            badge: "/logo.ico",
            tag: `channel-${channelId}`,
            silent: true,
          }
        );
      } catch (error) {
        console.error("Notification error:", error);
      }
    },
    [
      canUseNotifications,
      notificationPermission,
      currentChannel,
      channelId,
      desktopNotifications,
      notifyOnMessage,
    ]
  );

  // Event handler'ı useCallback ile sarmala (sürekli yeniden oluşturulmasını önle)
  const handleDataReceived = useCallback(
    (payload, participant, kind, topic) => {
      if (topic !== "chat") return;
      try {
        const decoder = new TextDecoder();
        const data = JSON.parse(decoder.decode(payload));
        if (data.type === "chat" && data.channelId === channelId) {
          if (data.message.userId !== userId) {
            addIncomingMessage(data.message);
            showDesktopNotification(data.message);
          }
        }
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("Error parsing chat message:", error);
        }
      }
    },
    [channelId, userId, addIncomingMessage, showDesktopNotification]
  );

  useEffect(() => {
    if (!room) return;
    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => room.off(RoomEvent.DataReceived, handleDataReceived);
  }, [room, handleDataReceived]);

  // Scroll'u throttle et (her mesaj değişikliğinde değil, sadece gerektiğinde)
  const scrollTimeoutRef = useRef(null);
  useEffect(() => {
    // Önceki timeout'u iptal et
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    // 100ms sonra scroll yap (debounce)
    scrollTimeoutRef.current = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);

    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [messages.length]); // Sadece mesaj sayısı değiştiğinde

  useEffect(() => {
    const handleClick = (e) => {
      setContextMenu(null);
      // Emoji picker dışına tıklanırsa kapat (ama emoji butonlarına tıklanınca kapatma)
      if (
        emojiPickerRef.current && 
        !emojiPickerRef.current.contains(e.target) &&
        !e.target.closest('[data-emoji-button]')
      ) {
        setShowEmojiPicker(false);
      }
    };
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, [channelId]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageInput.trim() || isSending || cooldownRemaining > 0) return;

    const textToSend = messageInput;
    setMessageInput("");
    setIsSending(true);

    try {
      const result = await sendMessage(
        channelId,
        textToSend,
        userId,
        username,
        room
      );
      if (!result?.success) {
        setMessageInput(textToSend);
        // Cooldown hatası varsa geri sayımı başlat
        if (result?.cooldownRemaining) {
          setCooldownRemaining(result.cooldownRemaining);
        } else {
          toast.error(result?.error || "Mesaj gönderilemedi.");
        }
      }
    } catch (error) {
      console.error("Message send error:", error);
      setMessageInput(textToSend);
      toast.error("Mesaj gönderilemedi.");
    } finally {
      setIsSending(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 10);
    }
  };

  // Cooldown geri sayımı
  useEffect(() => {
    if (cooldownRemaining <= 0) return;

    const interval = setInterval(() => {
      setCooldownRemaining((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [cooldownRemaining]);

  const handleEnableNotifications = useCallback(async () => {
    if (!canUseNotifications) {
      toast.error("Bildirimler bu platformda desteklenmiyor.");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === "granted") {
        toast.success("Bildirimler etkinleştirildi.");
      } else {
        toast.error("Bildirim izni verilmedi.");
      }
    } catch (error) {
      console.error("Notification permission error:", error);
      toast.error("Bildirim izni alınamadı.");
    }
  }, [canUseNotifications]);

  const handleLoadOlderMessages = useCallback(() => {
    if (!currentChannel) return;
    loadOlderMessages(currentChannel.id);
  }, [currentChannel, loadOlderMessages]);

  const shouldShowNotificationBanner =
    canUseNotifications && notificationPermission !== "granted";

  const handleContextMenu = useCallback((e, msg, isInSequence) => {
    e.preventDefault();
    setContextMenu({ 
      x: e.pageX, 
      y: e.pageY, 
      message: msg,
      isInSequence: isInSequence || false
    });
  }, []);

  const handleCopyText = () => {
    if (contextMenu?.message?.text)
      navigator.clipboard.writeText(contextMenu.message.text);
    setContextMenu(null);
  };

  const handleDeleteMsg = async () => {
    if (contextMenu?.message) {
      await deleteMessage(channelId, contextMenu.message.id);
      toast.success("Mesaj silindi.");
    }
    setContextMenu(null);
  };

  // Sequence mesajlarını toplu silme
  const handleDeleteSequence = async () => {
    if (!contextMenu?.message) return;
    
    const result = await deleteMessageSequence(channelId, contextMenu.message.id);
    if (result.success) {
      toast.success(`${result.deletedCount} mesaj silindi.`);
    } else {
      toast.error(result.error || "Mesajlar silinemedi.");
    }
    setContextMenu(null);
  };

  // Mesajın sequence'da olup olmadığını kontrol et
  const isMessageInSequence = useCallback((message, index) => {
    if (index === 0) return false;
    const prevMessage = messages[index - 1];
    if (!prevMessage) return false;
    
    const isSequence =
      prevMessage.userId === message.userId &&
      message.timestamp - prevMessage.timestamp < MESSAGE_SEQUENCE_THRESHOLD;
    
    // Sonraki mesaj da sequence'da mı kontrol et
    const nextMessage = messages[index + 1];
    const hasNextInSequence =
      nextMessage &&
      nextMessage.userId === message.userId &&
      nextMessage.timestamp - message.timestamp < MESSAGE_SEQUENCE_THRESHOLD;
    
    return isSequence || hasNextInSequence;
  }, [messages]);

  const openLinkModal = useCallback((e, url) => {
    e.preventDefault();
    setLinkModal({ isOpen: true, url });
  }, []);

  const confirmOpenLink = useCallback(() => {
    if (linkModal.url) {
      if (window.netrex && window.netrex.openExternalLink) {
        window.netrex.openExternalLink(linkModal.url);
      } else {
        window.open(linkModal.url, "_blank");
      }
    }
    setLinkModal({ isOpen: false, url: "" });
  }, [linkModal.url]);

  // Popüler emojiler listesi
  const popularEmojis = [
    "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃",
    "😉", "😊", "😇", "🥰", "😍", "🤩", "😘", "😗", "😚", "😙",
    "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔",
    "🤐", "🤨", "😐", "😑", "😶", "😏", "😒", "🙄", "😬", "🤥",
    "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢", "🤮",
    "🤧", "🥵", "🥶", "😶‍🌫️", "😵", "🤯", "🤠", "🥳", "😎", "🤓",
    "🧐", "😕", "😟", "🙁", "😮", "😯", "😲", "😳", "🥺", "😦",
    "😧", "😨", "😰", "😥", "😢", "😭", "😱", "😖", "😣", "😞",
    "😓", "😩", "😫", "🥱", "😤", "😡", "😠", "🤬", "😈", "👿",
    "💀", "☠️", "💩", "🤡", "👹", "👺", "👻", "👽", "👾", "🤖",
    "😺", "😸", "😹", "😻", "😼", "😽", "🙀", "😿", "😾", "🙈",
    "🙉", "🙊", "💋", "💌", "💘", "💝", "💖", "💗", "💓", "💞",
    "💕", "💟", "❣️", "💔", "❤️", "🧡", "💛", "💚", "💙", "💜",
    "🖤", "🤍", "🤎", "💯", "💢", "💥", "💫", "💦", "💨", "🕳️",
    "💣", "💬", "👁️‍🗨️", "🗨️", "🗯️", "💭", "💤", "👋", "🤚", "🖐️",
    "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞", "🤟", "🤘", "🤙",
    "👈", "👉", "👆", "🖕", "👇", "☝️", "👍", "👎", "✊", "👊",
    "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "✍️", "💪",
    "🦾", "🦿", "🦵", "🦶", "👂", "🦻", "👃", "🧠", "🫀", "🫁",
    "🦷", "🦴", "👀", "👁️", "👅", "👄", "💋", "🩸", "🔥", "⭐",
    "🌟", "✨", "💫", "💥", "💢", "💯", "🎉", "🎊", "🎈", "🎁",
    "🎀", "🎂", "🎃", "🎄", "🎅", "🤶", "🧑‍🎄", "🎆", "🎇", "🧨",
    "🎊", "🎉", "🎈", "🎁", "🎀", "🎂", "🎃", "🎄", "🎅", "🤶",
  ];

  const handleEmojiClick = useCallback((emoji, e) => {
    e?.stopPropagation();
    
    // Cursor pozisyonunu al
    const input = inputRef.current;
    if (!input) return;
    
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const currentValue = messageInput;
    
    // Emojiyi cursor pozisyonuna ekle
    const newValue = 
      currentValue.substring(0, start) + 
      emoji + 
      currentValue.substring(end);
    
    setMessageInput(newValue);
    
    // Cursor pozisyonunu emoji'den sonra ayarla
    setTimeout(() => {
      input.focus();
      const newCursorPos = start + emoji.length;
      input.setSelectionRange(newCursorPos, newCursorPos);
    }, 10);
  }, [messageInput]);

  // renderMessageText'i useCallback ile memoize et
  const renderMessageText = useCallback((text) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        const fullUrl = part;
        const displayText =
          fullUrl.length > 50 ? fullUrl.substring(0, 50) + "..." : fullUrl;
        return (
          <a
            key={index}
            href={fullUrl}
            onClick={(e) => openLinkModal(e, fullUrl)}
            className="text-[#00a8fc] hover:underline cursor-pointer break-all font-medium"
            title={fullUrl}
          >
            {displayText}
          </a>
        );
      }
      return <span key={index}>{part}</span>;
    });
  }, [openLinkModal]);

  // Format fonksiyonlarını useCallback ile memoize et
  const formatTime = useCallback((timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  const formatDateHeader = useCallback((timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }, []);

  // Mesaj item'ını memoize et (sadece mesaj değiştiğinde render et)
  const MessageItem = memo(({ message, prevMessage, messageIndex, onContextMenu, renderText, formatTime, formatDateHeader, isInSequence }) => {
    const isSequence =
      prevMessage &&
      prevMessage.userId === message.userId &&
      message.timestamp - prevMessage.timestamp < MESSAGE_SEQUENCE_THRESHOLD;
    const showDateSeparator =
      !prevMessage ||
      new Date(message.timestamp).toDateString() !==
        new Date(prevMessage.timestamp).toDateString();

    return (
      <div>
        {/* TARİH AYIRICI */}
        {showDateSeparator && (
          <div className="relative flex items-center justify-center my-6 select-none group">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#3f4147]"></div>
            </div>
            <span className="relative bg-[#313338] px-2 text-[12px] font-semibold text-[#949ba4] group-hover:text-[#dbdee1] transition-colors">
              {formatDateHeader(message.timestamp)}
            </span>
          </div>
        )}

        {/* MESAJ KARTI */}
        <div
          className={`
            group flex pr-4 pl-[72px] relative w-full
            ${!isSequence ? "mt-[17px]" : "mt-[2px]"}
            hover:bg-[#2e3035]/60 -mx-4 px-4 py-0.5 transition-colors duration-75
          `}
          onContextMenu={(e) => onContextMenu(e, message, isInSequence)}
        >
          {/* SOL TARA: AVATAR VEYA SAAT */}
          <div className="absolute left-4 w-[50px] flex justify-start select-none">
            {!isSequence || showDateSeparator ? (
              <div className="w-10 h-10 rounded-full bg-indigo-500 hover:shadow-md cursor-pointer overflow-hidden mt-0.5 flex items-center justify-center text-white font-bold text-lg transition-transform hover:scale-105 active:scale-95">
                {message.username?.charAt(0).toUpperCase()}
              </div>
            ) : (
              <span className="text-[10px] text-[#949ba4] hidden group-hover:inline-block w-full text-left pl-2 mt-1.5 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                {formatTime(message.timestamp)}
              </span>
            )}
          </div>

          {/* SAĞ TARA: İÇERİK */}
          <div className="flex-1 min-w-0">
            {(!isSequence || showDateSeparator) && (
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[16px] font-medium text-white hover:underline cursor-pointer">
                  {message.username}
                </span>
                <span className="text-[12px] text-[#949ba4] font-medium ml-1 select-none">
                  {formatTime(message.timestamp)}
                </span>
              </div>
            )}
            <p
              className={`
                text-[0.95rem] leading-[1.375rem] whitespace-pre-wrap break-words 
                ${isSequence ? "text-[#dbdee1]" : "text-[#dcddde]"}
              `}
            >
              {renderText(message.text)}
            </p>
          </div>
        </div>
      </div>
    );
  });

  MessageItem.displayName = 'MessageItem';

  return (
    <div className="flex flex-col bg-[#313338] h-full w-full relative">
      {shouldShowNotificationBanner && (
        <div className="px-4 pt-4">
          <div className="flex items-center justify-between bg-[#1f2023] border border-[#2b2d31] rounded-lg px-3 py-2 text-xs text-[#c8ccd3] gap-3">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-[#f8d47e]" />
              <span>
                Yeni mesajlarda masaüstü bildirimi almak için izni etkinleştirin.
              </span>
            </div>
            <button
              onClick={handleEnableNotifications}
              className="px-3 py-1 bg-[#5865f2] hover:bg-[#4752c4] text-white rounded font-semibold text-[11px]"
            >
              Bildirimleri Aç
            </button>
          </div>
        </div>
      )}

      {/* Mesaj Alanı */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto custom-scrollbar flex flex-col min-h-0 px-4"
      >
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-[#949ba4] text-sm gap-2">
            <Loader2 className="animate-spin" size={18} />
            Mesajlar yükleniyor...
          </div>
        ) : messages.length === 0 ? (
          /* BOŞ KANAL KARŞILAMA EKRANI */
          <div className="flex-1 flex flex-col justify-end pb-8 select-none animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="w-16 h-16 bg-[#41434a] rounded-full flex items-center justify-center mb-6 shadow-lg">
              <Hash size={40} className="text-white" />
            </div>
            <h1 className="text-3xl font-extrabold text-white mb-2 tracking-tight">
              {currentChannel?.name || "sohbet"} kanalına hoş geldin!
            </h1>
            <p className="text-[#b5bac1] text-base max-w-md">
              Bu kanalın başlangıcı. Arkadaşlarına bir "Merhaba" diyerek sohbeti
              başlatabilirsin.
            </p>
          </div>
        ) : (
          <div className="flex flex-col justify-end min-h-0 pb-4 pt-6">
            {hasMoreMessages && (
              <button
                onClick={handleLoadOlderMessages}
                disabled={isLoadingOlderMessages}
                className="mx-auto mb-4 px-4 py-1.5 text-xs font-semibold text-[#dbdee1] bg-[#1f2023] rounded-full border border-[#2b2d31] hover:border-[#5865f2] hover:text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isLoadingOlderMessages && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                {isLoadingOlderMessages
                  ? "Daha fazla mesaj yükleniyor..."
                  : "Daha eski mesajları göster"}
              </button>
            )}
            {messages.map((message, index) => (
              <MessageItem
                key={message.id}
                message={message}
                prevMessage={messages[index - 1]}
                messageIndex={index}
                onContextMenu={handleContextMenu}
                renderText={renderMessageText}
                formatTime={formatTime}
                formatDateHeader={formatDateHeader}
                isInSequence={isMessageInSequence(message, index)}
              />
            ))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT ALANI */}
      <div className="px-5 pb-6 pt-3 bg-gradient-to-t from-[#2b2d31] to-[#313338] shrink-0 z-10 border-t border-white/5">
        {/* Cooldown Banner */}
        {cooldownRemaining > 0 && (
          <div className="mb-3 glass-strong border border-red-500/30 rounded-xl px-5 py-3 flex items-center gap-4 animate-fadeIn shadow-soft">
            <div className="flex items-center gap-3 flex-1">
              <div className="p-2 bg-red-500/20 rounded-lg">
                <Loader2 className="w-5 h-5 text-red-400 animate-spin" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-400">
                  Lütfen bekleyin, yeni mesaj göndermeden önce
                </p>
                <p className="text-xs text-red-400/70 mt-0.5">
                  {cooldownRemaining} saniye sonra mesaj gönderebileceksiniz
                </p>
              </div>
            </div>
            <div className="bg-red-500/20 rounded-xl px-5 py-2.5 min-w-[70px] text-center border border-red-500/30">
              <span className="text-xl font-bold text-red-400">
                {cooldownRemaining}
              </span>
              <span className="text-xs text-red-400/70 ml-1">sn</span>
            </div>
          </div>
        )}

        <div className="glass rounded-xl px-5 py-3 flex items-center gap-3 relative shadow-soft border border-white/10 focus-within:border-indigo-500/50 focus-within:shadow-glow transition-all duration-200">
          {/* Sol İkon (Emoji Picker) */}
          <div className="relative" ref={emojiPickerRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowEmojiPicker(!showEmojiPicker);
              }}
              className={`text-[#b5bac1] hover:text-white transition-all duration-200 p-2 rounded-lg hover:bg-white/10 hover:scale-110 ${
                showEmojiPicker ? "text-white bg-white/10" : ""
              }`}
            >
              <Smile
                size={22}
                fill={showEmojiPicker ? "currentColor" : "none"}
                className={showEmojiPicker ? "fill-white" : ""}
              />
            </button>
            
            {/* Emoji Picker Popup */}
            {showEmojiPicker && (
              <div 
                className="absolute bottom-full left-0 mb-2 glass-strong rounded-xl border border-white/10 shadow-soft-lg w-[320px] h-[280px] overflow-hidden z-[100] animate-scaleIn origin-bottom-left"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-3 border-b border-white/10 bg-[#1e1f22]/50 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Emoji Seç</h3>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowEmojiPicker(false);
                    }}
                    className="text-[#b5bac1] hover:text-white transition-colors text-xs px-2 py-1 rounded hover:bg-white/10"
                  >
                    Kapat
                  </button>
                </div>
                <div className="p-2 overflow-y-auto h-[calc(280px-60px)] custom-scrollbar">
                  <div className="grid grid-cols-8 gap-1">
                    {popularEmojis.map((emoji, index) => (
                      <button
                        key={index}
                        data-emoji-button
                        onClick={(e) => handleEmojiClick(emoji, e)}
                        className="text-2xl hover:bg-white/10 rounded-lg p-1.5 transition-all duration-200 hover:scale-125 active:scale-95 flex items-center justify-center aspect-square"
                        title={emoji}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={handleSendMessage}
            className="flex-1 flex items-center"
          >
            <input
              ref={inputRef}
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder={`#${
                currentChannel?.name || "sohbet"
              } kanalına mesaj gönder`}
              className="w-full bg-transparent text-[#dbdee1] placeholder-[#949ba4] focus:outline-none font-medium disabled:opacity-60 disabled:cursor-not-allowed"
              autoComplete="off"
              autoFocus
              disabled={cooldownRemaining > 0}
            />
          </form>

          {/* Sağ İkonlar (Emoji, Hediye vb.) */}
          <div className="flex items-center gap-3 text-[#b5bac1]">
            {messageInput.trim() && cooldownRemaining === 0 && (
              <button
                onClick={handleSendMessage}
                disabled={isSending || cooldownRemaining > 0}
                className="text-[#b5bac1] hover:text-indigo-400 hover:scale-110 transition-all duration-200 ml-2 flex items-center justify-center w-10 h-10 rounded-lg hover:bg-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {isSending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send size={20} />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* LINK GÜVENLİK MODALI */}
      {linkModal.isOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
          <div className="glass-strong w-full max-w-md rounded-2xl shadow-soft-lg border border-white/10 overflow-hidden animate-scaleIn">
            <div className="p-6">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
                <div className="p-2 bg-yellow-500/10 rounded-full">
                  <AlertTriangle className="text-yellow-500" size={24} />
                </div>
                Dikkat et!
              </h3>
              <p className="text-[#b5bac1] text-sm mb-4 leading-relaxed">
                Netrex'ten ayrılıyorsun. Lütfen tıkladığın bağlantının güvenli
                olduğundan emin ol.
              </p>
              <div className="mb-2 text-xs font-bold text-[#949ba4] uppercase tracking-wide">
                Gidilen Bağlantı
              </div>
              <div className="bg-[#1e1f22] p-3 rounded border border-[#2b2d31] mb-6 shadow-inner">
                <a
                  href={linkModal.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#00a8fc] hover:underline text-sm break-all font-mono"
                  onClick={(e) => e.preventDefault()}
                >
                  {linkModal.url}
                </a>
              </div>
              <div className="flex justify-end gap-3 bg-[#2b2d31] -m-6 p-4 mt-2">
                <button
                  onClick={() => setLinkModal({ isOpen: false, url: "" })}
                  className="px-5 py-2.5 rounded text-sm font-medium text-white hover:underline transition-all"
                >
                  Vazgeç
                </button>
            <button
                onClick={confirmOpenLink}
                className="px-6 py-2.5 rounded-xl gradient-primary hover:shadow-glow text-white text-sm font-medium transition-all duration-200 hover-lift btn-modern"
              >
                Siteye Git
              </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SAĞ TIK MENÜSÜ */}
      {contextMenu && (
        <div
          className="fixed glass-strong border border-white/10 rounded-xl w-56 py-2 shadow-soft-lg z-50 text-[#dbdee1] text-sm animate-scaleIn origin-top-left"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="mx-2 px-2 py-1.5 hover:bg-[#5865F2] hover:text-white rounded cursor-pointer flex items-center gap-2 group select-none transition-colors"
            onClick={handleCopyText}
          >
            <Copy size={16} className="text-[#b5bac1] group-hover:text-white" />
            <span className="font-medium">Metni Kopyala</span>
          </div>
          {contextMenu.message.userId === userId && (
            <>
              <div className="h-[1px] bg-[#1e1f22] my-1 mx-2"></div>
              <div
                className="mx-2 px-2 py-1.5 hover:bg-[#da373c] hover:text-white rounded cursor-pointer flex items-center gap-2 group text-[#da373c] select-none transition-colors"
                onClick={handleDeleteMsg}
              >
                <Trash2
                  size={16}
                  className="text-[#da373c] group-hover:text-white"
                />
                <span className="font-medium">Mesajı Sil</span>
              </div>
              {contextMenu.isInSequence && (
                <>
                  <div className="h-[1px] bg-[#1e1f22] my-1 mx-2"></div>
                  <div
                    className="mx-2 px-2 py-1.5 hover:bg-[#da373c] hover:text-white rounded cursor-pointer flex items-center gap-2 group text-[#da373c] select-none transition-colors"
                    onClick={handleDeleteSequence}
                  >
                    <Trash2
                      size={16}
                      className="text-[#da373c] group-hover:text-white"
                    />
                    <span className="font-medium">Bu Grubu Sil</span>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
