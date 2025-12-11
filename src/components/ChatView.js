"use client";
import { useEffect, useState, useRef, useMemo, useCallback, memo } from "react";
import { createPortal } from "react-dom";
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
        const notification = new Notification(
          `${incomingMessage.username || "Bir kullanıcı"} - #${channelName}`,
          {
            body: body,
            icon: "/logo.ico",
            badge: "/logo.ico",
            tag: `channel-${channelId}`,
            silent: true,
          }
        );
        
        // Bildirime tıklanınca pencereyi focus et
        notification.onclick = () => {
          if (window.netrex?.focusWindow) {
            window.netrex.focusWindow();
          } else {
            window.focus();
          }
          notification.close();
        };
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
            const message = data.message;
            addIncomingMessage(message);
            
            // Toast bildirimi GlobalChatListener tarafından gösteriliyor
            // Masaüstü bildirim göster (ayarlardan açtıysa ve pencere aktif değilse)
            showDesktopNotification(message);
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
      x: e.clientX, 
      y: e.clientY, 
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
    <div className="flex flex-col bg-gradient-to-br from-[#1a1b1f] via-[#141518] to-[#0e0f12] h-full w-full relative overflow-hidden">
      {/* Subtle background decorations */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-purple-500/[0.05] rounded-full blur-[120px]" />
        <div className="absolute bottom-1/3 left-1/3 w-[400px] h-[400px] bg-cyan-500/[0.04] rounded-full blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/[0.03] rounded-full blur-[140px]" />
      </div>
      
      {shouldShowNotificationBanner && (
        <div className="px-4 pt-4 relative z-10">
          <div className="flex items-center justify-between bg-gradient-to-br from-indigo-500/10 to-purple-500/5 backdrop-blur-sm border border-indigo-500/20 rounded-2xl px-4 py-3 text-sm text-white/90 gap-3 shadow-[0_4px_20px_rgba(99,102,241,0.1)]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                <Bell size={16} className="text-indigo-400" />
              </div>
              <span className="font-medium">
                Yeni mesajlarda masaüstü bildirimi almak için izni etkinleştirin.
              </span>
            </div>
            <button
              onClick={handleEnableNotifications}
              className="px-4 py-2 bg-gradient-to-br from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white rounded-xl font-semibold text-sm transition-all duration-200 hover:scale-105 active:scale-95 shadow-[0_4px_12px_rgba(99,102,241,0.3)]"
            >
              Bildirimleri Aç
            </button>
          </div>
        </div>
      )}

      {/* Mesaj Alanı */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto scrollbar-thin flex flex-col min-h-0 px-4 relative z-10"
      >
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-white/60 text-sm gap-3 flex-col">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center backdrop-blur-sm">
              <Loader2 className="animate-spin text-indigo-400" size={24} />
            </div>
            <span className="font-medium">Mesajlar yükleniyor...</span>
          </div>
        ) : messages.length === 0 ? (
          /* BOŞ KANAL KARŞILAMA EKRANI */
          <div className="flex-1 flex flex-col justify-end pb-12 select-none animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="w-20 h-20 bg-gradient-to-br from-indigo-500/20 via-purple-500/15 to-cyan-500/10 rounded-3xl flex items-center justify-center mb-6 shadow-[0_8px_32px_rgba(99,102,241,0.15)] border border-white/10 backdrop-blur-sm">
              <Hash size={44} className="text-white/90" />
            </div>
            <h1 className="text-3xl font-extrabold text-white mb-3 tracking-tight">
              {currentChannel?.name || "sohbet"} kanalına hoş geldin!
            </h1>
            <p className="text-white/60 text-base max-w-lg leading-relaxed">
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
                className="mx-auto mb-4 px-4 py-1.5 text-caption font-semibold text-nds-text-secondary bg-nds-bg-deep rounded-full border border-nds-border-light hover:border-nds-info hover:text-nds-text-primary transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
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
      <div className="px-4 sm:px-5 pb-5 sm:pb-6 pt-3 bg-gradient-to-t from-[#0e0f12] via-[#12131a] to-transparent shrink-0 z-20 relative">
        {/* Cooldown Banner */}
        {cooldownRemaining > 0 && (
          <div className="mb-3 bg-gradient-to-br from-red-500/15 to-red-600/10 backdrop-blur-md border border-red-500/30 rounded-2xl px-4 sm:px-5 py-3 flex items-center gap-3 sm:gap-4 animate-fadeIn shadow-[0_4px_20px_rgba(239,68,68,0.2)]">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 sm:w-11 sm:h-11 bg-red-500/20 rounded-xl flex items-center justify-center border border-red-500/30">
                <Loader2 className="w-5 h-5 text-red-400 animate-spin" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-red-400 truncate">
                  Lütfen bekleyin, yeni mesaj göndermeden önce
                </p>
                <p className="text-xs text-red-400/70 mt-0.5">
                  {cooldownRemaining} saniye sonra mesaj gönderebileceksiniz
                </p>
              </div>
            </div>
            <div className="bg-red-500/20 rounded-xl px-4 sm:px-5 py-2 sm:py-2.5 min-w-[60px] sm:min-w-[70px] text-center border border-red-500/30 flex-shrink-0">
              <span className="text-lg sm:text-xl font-bold text-red-400">
                {cooldownRemaining}
              </span>
              <span className="text-xs text-red-400/70 ml-1">sn</span>
            </div>
          </div>
        )}

        <div className="backdrop-blur-xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] rounded-2xl px-4 sm:px-5 py-3 flex items-center gap-2 sm:gap-3 relative shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)] border border-white/[0.08] focus-within:border-indigo-500/50 focus-within:shadow-[0_8px_32px_rgba(99,102,241,0.2)] transition-all duration-300">
          {/* Sol İkon (Emoji Picker) */}
          <div className="relative" ref={emojiPickerRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowEmojiPicker(!showEmojiPicker);
              }}
              className={`text-white/60 hover:text-white transition-all duration-200 p-2 rounded-xl hover:bg-white/[0.05] hover:scale-110 active:scale-95 ${
                showEmojiPicker ? "text-white bg-white/[0.05]" : ""
              }`}
            >
              <Smile
                size={20}
                fill={showEmojiPicker ? "currentColor" : "none"}
                className={showEmojiPicker ? "fill-white" : ""}
              />
            </button>
            
            {/* Emoji Picker Popup */}
            {showEmojiPicker && (
              <div 
                className="absolute bottom-full left-0 mb-3 backdrop-blur-2xl bg-gradient-to-br from-[#1a1b1f]/95 via-[#141518]/95 to-[#0e0f12]/95 rounded-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] w-[300px] sm:w-[320px] h-[260px] sm:h-[280px] overflow-hidden z-[100] animate-scaleIn origin-bottom-left"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-3 border-b border-white/5 bg-[#0a0a0c]/50 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white/90">Emoji Seç</h3>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowEmojiPicker(false);
                    }}
                    className="text-white/50 hover:text-white/90 transition-colors text-xs px-2 py-1 rounded-lg hover:bg-white/[0.05]"
                  >
                    Kapat
                  </button>
                </div>
                <div className="p-2 overflow-y-auto h-[calc(100%-60px)] scrollbar-thin">
                  <div className="grid grid-cols-8 gap-1">
                    {popularEmojis.map((emoji, index) => (
                      <button
                        key={index}
                        data-emoji-button
                        onClick={(e) => handleEmojiClick(emoji, e)}
                        className="text-2xl hover:bg-white/[0.05] rounded-xl p-1.5 transition-all duration-200 hover:scale-125 active:scale-95 flex items-center justify-center aspect-square"
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
              className="w-full bg-transparent text-white/90 placeholder-white/40 focus:outline-none font-medium disabled:opacity-60 disabled:cursor-not-allowed"
              autoComplete="off"
              autoFocus
              disabled={cooldownRemaining > 0}
            />
          </form>

          {/* Sağ İkonlar (Send Button) */}
          <div className="flex items-center gap-2 text-white/60">
            {messageInput.trim() && cooldownRemaining === 0 && (
              <button
                onClick={handleSendMessage}
                disabled={isSending || cooldownRemaining > 0}
                className="text-white/60 hover:text-indigo-400 hover:scale-110 transition-all duration-200 ml-1 flex items-center justify-center w-9 h-9 rounded-xl hover:bg-indigo-500/10 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 active:scale-95"
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
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          {/* Animated background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-orange-500/5 to-transparent pointer-events-none"></div>
          
          <div className="glass-strong w-full max-w-md rounded-3xl shadow-2xl border border-white/20 overflow-hidden animate-scaleIn backdrop-blur-2xl bg-gradient-to-br from-[#1e1f22]/95 via-[#25272a]/95 to-[#2b2d31]/95 relative">
            {/* Top glow effect */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent z-10"></div>
            
            <div className="p-8 relative z-10">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center border border-amber-500/30 shadow-soft">
                  <AlertTriangle className="text-amber-300" size={24} />
                </div>
                <h3 className="text-2xl font-bold text-white tracking-tight">
                  Dikkat et!
                </h3>
              </div>
              <p className="text-[#b5bac1] text-sm mb-5 leading-relaxed">
                Netrex'ten ayrılıyorsun. Lütfen tıkladığın bağlantının güvenli
                olduğundan emin ol.
              </p>
              <div className="mb-2 text-xs font-bold text-[#949ba4] uppercase tracking-wide">
                Gidilen Bağlantı
              </div>
              <div className="bg-[#1e1f22] p-4 rounded-xl border border-white/10 mb-2 shadow-soft">
                <a
                  href={linkModal.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400 hover:underline text-sm break-all font-mono"
                  onClick={(e) => e.preventDefault()}
                >
                  {linkModal.url}
                </a>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 bg-gradient-to-t from-[#1e1f22] via-[#25272a] to-transparent p-6 border-t border-white/10 rounded-b-3xl backdrop-blur-xl relative">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
              <button
                onClick={() => setLinkModal({ isOpen: false, url: "" })}
                onMouseDown={(e) => e.preventDefault()}
                className="px-6 py-3 text-sm font-semibold text-[#b5bac1] hover:text-white transition-all duration-300 rounded-xl hover:bg-white/5 focus:outline-none"
              >
                Vazgeç
              </button>
              <button
                onClick={confirmOpenLink}
                onMouseDown={(e) => e.preventDefault()}
                className="px-8 py-3 gradient-primary hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] text-white rounded-xl font-semibold transition-all duration-300 hover:scale-105 relative overflow-hidden group/save focus:outline-none"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 opacity-0 group-hover/save:opacity-100 transition-opacity duration-300"></div>
                <span className="relative z-10">Siteye Git</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SAĞ TIK MENÜSÜ */}
      {contextMenu && typeof document !== 'undefined' && createPortal(
        <div
          className={`fixed glass-strong border border-white/10 rounded-xl w-56 py-2 shadow-soft-lg z-[9999] text-[#dbdee1] text-sm animate-scaleIn ${
            contextMenu.y + 220 > window.innerHeight ? "origin-bottom-left" : "origin-top-left"
          }`}
          style={{ 
            top: contextMenu.y + 220 > window.innerHeight ? 'auto' : contextMenu.y,
            bottom: contextMenu.y + 220 > window.innerHeight ? window.innerHeight - contextMenu.y : 'auto',
            left: contextMenu.x 
          }}
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
        </div>,
        document.body
      )}
    </div>
  );
}
