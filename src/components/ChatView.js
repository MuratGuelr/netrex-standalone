"use client";
import { useEffect, useState, useRef, useMemo, useCallback, memo, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useOptionalRoomContext } from "@/src/hooks/useOptionalRoomContext";
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
  Paperclip,
  Image as ImageIcon,
  X,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RefreshCw,
  Minus,
  Plus,
  Download
} from "lucide-react";
import { toast } from "sonner";
import { MESSAGE_SEQUENCE_THRESHOLD } from "@/src/constants/appConfig";
import { useSettingsStore } from "@/src/store/settingsStore";
import { uploadImageToCloudinary } from "@/src/utils/imageUpload";

// --- MESAJ ÖĞESİ BİLEŞENİ ---
const MessageItem = memo(({ 
  message, 
  prevMessage, 
  messageIndex, 
  onContextMenu, 
  renderText, 
  formatTime, 
  formatDateHeader, 
  isInSequence, 
  onImageClick 
}) => {
  const isSequence =
    prevMessage &&
    prevMessage.userId === message.userId &&
    message.timestamp - prevMessage.timestamp < MESSAGE_SEQUENCE_THRESHOLD;
  const showDateSeparator =
    !prevMessage ||
    new Date(message.timestamp).toDateString() !==
      new Date(prevMessage.timestamp).toDateString();

  return (
    <div className="relative group/message">
      {/* TARİH AYIRICI */}
      {showDateSeparator && (
        <div className="relative flex items-center justify-center my-6 select-none animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/[0.05]"></div>
          </div>
          <span className="relative bg-[#1e1f22] px-3 py-1 rounded-full text-[11px] font-bold text-[#949ba4] border border-white/[0.05] shadow-sm uppercase tracking-wider">
            {formatDateHeader(message.timestamp)}
          </span>
        </div>
      )}

      {/* MESAJ KARTI */}
      <div
        className={`
          group flex pr-4 pl-[72px] relative w-full
          ${!isSequence ? "mt-[17px]" : "mt-[2px]"}
          hover:bg-white/[0.03] -mx-4 px-4 py-0.5 transition-all duration-75
        `}
        onContextMenu={(e) => onContextMenu(e, message, isInSequence)}
      >
        {/* SOL TARA: AVATAR VEYA SAAT */}
        <div className="absolute left-4 w-[50px] flex justify-start select-none">
          {!isSequence || showDateSeparator ? (
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center text-white font-bold text-lg shadow-sm group-hover:scale-105 transition-transform">
              {message.username?.charAt(0).toUpperCase()}
            </div>
          ) : (
            <span className="text-[10px] text-[#949ba4] hidden group-hover:inline-block w-full text-left pl-2 mt-1.5 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
              {formatTime(message.timestamp)}
            </span>
          )}
        </div>

        {/* SAĞ TARA: İÇERİK */}
        <div className="flex-1 min-w-0">
          {(!isSequence || showDateSeparator) && (
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[15px] font-bold text-white hover:underline cursor-pointer tracking-tight">
                {message.username}
              </span>
              <span className="text-[11px] text-[#949ba4] font-bold ml-1 select-none uppercase tracking-tighter opacity-60">
                {formatTime(message.timestamp)}
              </span>
            </div>
          )}
          
          {message.type === 'image' && message.imageUrl && (
              <div className="mt-1.5 mb-2 max-w-[320px] sm:max-w-[450px] overflow-hidden rounded-2xl shadow-xl border border-white/10 bg-black/20 group/image relative">
                  <img 
                    src={message.imageUrl} 
                    alt="Uploaded content" 
                    className="w-full h-auto max-h-[300px] sm:max-h-[450px] object-cover hover:scale-[1.01] transition-transform duration-500 cursor-zoom-in"
                    onClick={(e) => {
                      e.stopPropagation();
                      onImageClick(message.imageUrl);
                    }}
                    loading="lazy"
                  />
                  {/* Subtle hover overlay for image */}
                  <div className="absolute inset-0 bg-black/0 group-hover/image:bg-black/5 transition-colors pointer-events-none" />
              </div>
          )}
          
          {message.text && (
            <p
              className={`
                text-[14px] leading-[1.4] whitespace-pre-wrap break-words font-medium
                ${isSequence ? "text-[#dbdee1]" : "text-[#dcddde]"}
              `}
            >
              {renderText(message.text)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
});

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
  const room = useOptionalRoomContext();
  const containerRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingImage, setPendingImage] = useState(null);
  const [pendingImageFile, setPendingImageFile] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  
  // Image Viewer Manipulation States
  const [imgZoom, setImgZoom] = useState(1);
  const [imgRotation, setImgRotation] = useState(0);
  const [imgIsDragging, setImgIsDragging] = useState(false);
  const [imgPosition, setImgPosition] = useState({ x: 0, y: 0 });
  const [imgDragStart, setImgDragStart] = useState({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Drag & Drop State
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const dragCounter = useRef(0);

  useEffect(() => {
    const handleDragEnter = (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current += 1;
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        setIsDraggingFile(true);
      }
    };

    const handleDragLeave = (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current -= 1;
      if (dragCounter.current === 0) {
        setIsDraggingFile(false);
      }
    };

    const handleDragOver = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingFile(false);
      dragCounter.current = 0;

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (ev) => {
              setPendingImage(ev.target.result);
              setPendingImageFile(file);
          };
          reader.readAsDataURL(file);
        } else {
          toast.error("Sadece resim dosyaları yüklenebilir.");
        }
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

  const handleImgZoomIn = useCallback(() => setImgZoom(prev => Math.min(prev + 0.25, 5)), []);
  const handleImgZoomOut = useCallback(() => setImgZoom(prev => Math.max(prev - 0.25, 0.5)), []);
  const handleImgRotate = useCallback(() => setImgRotation(prev => (prev + 90) % 360), []);
  const handleImgReset = useCallback(() => {
    setImgZoom(1);
    setImgRotation(0);
    setImgPosition({ x: 0, y: 0 });
    setIsSpacePressed(false);
  }, []);

  const handleImgMouseDown = (e) => {
    if (imgZoom > 1 || isSpacePressed) {
      setImgIsDragging(true);
      setImgDragStart({ x: e.clientX - imgPosition.x, y: e.clientY - imgPosition.y });
    }
  };

  const handleImgMouseMove = useCallback((e) => {
    if (imgIsDragging && (imgZoom > 1 || isSpacePressed)) {
      const newX = e.clientX - imgDragStart.x;
      const newY = e.clientY - imgDragStart.y;
      
      // Boundaries: Prevent dragging too far off screen (limit to 80% of window size)
      const limitX = window.innerWidth * 0.8;
      const limitY = window.innerHeight * 0.8;

      setImgPosition({
        x: Math.max(Math.min(newX, limitX), -limitX),
        y: Math.max(Math.min(newY, limitY), -limitY)
      });
    }
  }, [imgIsDragging, imgZoom, isSpacePressed, imgDragStart]);

  const handleImgMouseUp = () => setImgIsDragging(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === "Space" && selectedImage) {
        if (e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
            e.preventDefault();
            setIsSpacePressed(true);
        }
      }
      if (e.key === "Escape" && selectedImage) {
        setSelectedImage(null);
      }
    };
    const handleKeyUp = (e) => {
      if (e.code === "Space") {
        setIsSpacePressed(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [selectedImage]);

  useEffect(() => {
    if (!selectedImage) {
      handleImgReset();
    }
  }, [selectedImage, handleImgReset]);

  useEffect(() => {
    if (selectedImage) {
      const handleWheel = (e) => {
        if (e.ctrlKey) {
          e.preventDefault();
          if (e.deltaY < 0) setImgZoom(prev => Math.min(prev + 0.2, 5));
          else setImgZoom(prev => Math.max(prev - 0.2, 0.5));
        } else {
          // Pan with wheel
          setImgPosition(prev => {
            const newX = prev.x - e.deltaX;
            const newY = prev.y - e.deltaY;
            const limitX = window.innerWidth * 0.8;
            const limitY = window.innerHeight * 0.8;
            
            return {
              x: Math.max(Math.min(newX, limitX), -limitX),
              y: Math.max(Math.min(newY, limitY), -limitY)
            };
          });
        }
      };
      window.addEventListener('wheel', handleWheel, { passive: false });
      return () => window.removeEventListener('wheel', handleWheel);
    }
  }, [selectedImage]);

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
          
          // Bildirim içeriğinde link varsa güvenlik modalını aç
          if (incomingMessage.text) {
             const urlRegex = /(https?:\/\/[^\s]+)/g;
             const matches = incomingMessage.text.match(urlRegex);
             if (matches && matches.length > 0) {
                 // İlk bulunan linki açmak için modalı tetikle
                 setLinkModal({ isOpen: true, url: matches[0] });
             }
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

  // Scroll Restorasyonu için state
  const [preservingScroll, setPreservingScroll] = useState(false);
  const [prevScrollHeight, setPrevScrollHeight] = useState(0);

  useEffect(() => {
    const handleClick = (e) => {
      setContextMenu(null);
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
    if ((!messageInput.trim() && !pendingImageFile) || isSending || cooldownRemaining > 0) return;

    const textToSend = messageInput;
    const fileToSend = pendingImageFile;

    setMessageInput("");
    setPendingImage(null);
    setPendingImageFile(null);
    setIsSending(true);

    try {
      let imageUrl = null;
      if (fileToSend) {
         const toastId = toast.loading("Resim yükleniyor...");
         try {
            imageUrl = await uploadImageToCloudinary(fileToSend);
            toast.dismiss(toastId);
         } catch(err) {
            toast.error("Resim yüklenemedi: " + err.message, { id: toastId });
            setIsSending(false);
            setPendingImage(URL.createObjectURL(fileToSend));
            setPendingImageFile(fileToSend);
            setMessageInput(textToSend);
            return;
         }
      }

      const result = await sendMessage(
        channelId,
        textToSend,
        userId,
        username,
        room,
        currentChannel?.serverId,
        { type: imageUrl ? 'image' : 'text', imageUrl }
      );
      
      if (!result?.success) {
        setMessageInput(textToSend);
        if (fileToSend) {
            setPendingImage(URL.createObjectURL(fileToSend));
            setPendingImageFile(fileToSend);
        }

        if (result?.cooldownRemaining) {
          setCooldownRemaining(result.cooldownRemaining);
        } else {
          toast.error(result?.error || "Mesaj gönderilemedi.");
        }
      }
    } catch (error) {
      console.error("Message send error:", error);
      setMessageInput(textToSend);
      if (fileToSend) {
          setPendingImage(URL.createObjectURL(fileToSend));
          setPendingImageFile(fileToSend);
      }
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

  const handleLoadOlderMessages = useCallback(async () => {
    if (!currentChannel || !containerRef.current) return;
    
    // Yükleme öncesi scroll yüksekliğini kaybet
    setPrevScrollHeight(containerRef.current.scrollHeight);
    setPreservingScroll(true);
    
    await loadOlderMessages(currentChannel.id);
  }, [currentChannel, loadOlderMessages]);

  const shouldShowNotificationBanner =
    canUseNotifications && notificationPermission !== "granted";

  const hasScrolledToBottomRef = useRef(false);

  // Kanal değiştiğinde scroll durumunu sıfırla
  useEffect(() => {
    hasScrolledToBottomRef.current = false;
  }, [channelId]);

  // Akıllı Scroll Yönetimi
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Durum: Eski mesajlar yüklendiğinde pozisyonu koru
    if (preservingScroll && prevScrollHeight > 0) {
      const newScrollHeight = container.scrollHeight;
      const heightDifference = newScrollHeight - prevScrollHeight;
      
      // Scroll'u aşağı kaydırarak kullanıcının kaldığı yeri koru
      container.scrollTop = heightDifference;
      
      setPreservingScroll(false);
      setPrevScrollHeight(0);
      return;
    }

    // 2. Durum: İlk yüklemede scroll (Agresif Yöntem)
    // Mesajlar yüklendiğinde, resimler ve layout oturana kadar (1 sn) aşağı scroll'u zorla
    // Bu, "biraz scroll yapıp kalma" sorununu çözer
    if (!hasScrolledToBottomRef.current && messages.length > 0) {
        
        // Hemen en alta al
        container.scrollTop = container.scrollHeight;

        // Asenkron yüklemeler (resim vb.) için sürekli kontrol et
        const intervalId = setInterval(() => {
            if (container) {
                // Sadece scroll aşağıda değilse müdahale et (titremeyi önlemek için)
                if (container.scrollHeight - container.scrollTop > container.clientHeight + 5) {
                    container.scrollTop = container.scrollHeight;
                }
            }
        }, 50);

        // 1 saniye sonra serbest bırak
        const timeoutId = setTimeout(() => {
            clearInterval(intervalId);
            hasScrolledToBottomRef.current = true;
            // Son bir kez scroll
            if (container) container.scrollTop = container.scrollHeight;
        }, 1000);
        
        return () => {
            clearInterval(intervalId);
            clearTimeout(timeoutId);
        };
    }

    // 3. Durum: Yeni mesaj geldiğinde
    const threshold = 300; // Threshold daha da artırıldı
    // Eğer kullanıcı en alttan threshold kadar yukarıdaysa "Near Bottom" sayılır
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const isNearBottom = distanceFromBottom < threshold;
    
    if (messages.length > 0) {
       const lastMessage = messages[messages.length - 1];
       const isMyMessage = lastMessage?.userId === userId;

       // Benim mesajımsa veya kullanıcı zaten aşağıdaysa kaydır
       if (isMyMessage || isNearBottom) {
           // Smooth scroll yerine requestAnimationFrame ile doğal kaydırma daha iyi
           if (isMyMessage) {
              container.scrollTop = container.scrollHeight;
           } else {
              // Smooth scroll için
               setTimeout(() => {
                   messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
               }, 50);
           }
       }
    }
    
  }, [messages, preservingScroll, prevScrollHeight, userId, channelId]);

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

  const handleCopyImageLink = () => {
    if (contextMenu?.message?.imageUrl) {
      navigator.clipboard.writeText(contextMenu.message.imageUrl);
      toast.success("Resim linki kopyalandı.");
    }
    setContextMenu(null);
  };

  const handleCopyImage = async () => {
    if (contextMenu?.message?.imageUrl) {
      const toastId = toast.loading("Resim hazırlanıyor...");
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = contextMenu.message.imageUrl;
        });

        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        canvas.toBlob(async (blob) => {
          if (!blob) {
            toast.error("Resim oluşturulamadı.", { id: toastId });
            return;
          }
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            toast.success("Resim kopyalandı.", { id: toastId });
          } catch (err) {
            console.error("Clipboard write error:", err);
            toast.error("Panoya yazılamadı.", { id: toastId });
          }
        }, 'image/png');

      } catch (error) {
        console.error("Resim kopyalama hatası:", error);
        toast.error("Resim kopyalanamadı.", { id: toastId });
      }
    }
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

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
        toast.error("Lütfen geçerli bir resim dosyası seçin.");
        return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
        setPendingImage(ev.target.result);
        setPendingImageFile(file);
    };
    reader.readAsDataURL(file);
    // Reset input value to allow selecting same file again
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
             setPendingImage(ev.target.result);
             setPendingImageFile(file);
          };
          reader.readAsDataURL(file);
          e.preventDefault(); 
        }
      }
    }
  }, []);

  const removePendingImage = useCallback(() => {
    setPendingImage(null);
    setPendingImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

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

  MessageItem.displayName = 'MessageItem';

  return (

    <div className="flex flex-col bg-gradient-to-br from-[#1a1b1f] via-[#141518] to-[#0e0f12] h-full w-full relative overflow-hidden">
      {/* DRAG OVERLAY - PORTALED TO BODY TO COVER EVERYTHING */}
      {isDraggingFile && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-md border-4 border-indigo-500/50 border-dashed m-4 rounded-3xl flex items-center justify-center pointer-events-none animate-in fade-in duration-200">
           <div className="flex flex-col items-center gap-6 p-10 bg-[#0f0f12]/90 backdrop-blur-2xl rounded-[2rem] shadow-2xl border border-white/10 transform scale-105">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-indigo-500/30 animate-bounce shadow-lg shadow-indigo-500/20">
                <ImageIcon size={48} className="text-indigo-400" />
              </div>
              <div className="text-center">
                <h3 className="text-3xl font-bold text-white mb-2 tracking-tight">Resmi Bırak</h3>
                <p className="text-white/60 text-lg font-medium">Yüklemek için herhangi bir yere bırakın</p>
              </div>
           </div>
        </div>,
        document.body
      )}
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

      {/* Mesaj Alanı ve Member List Container */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative z-10">
        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto scrollbar-thin flex flex-col px-4 relative"
        >
          {isLoading ? (
            /* SKELETON LOADING - Tüm ekranı kaplayan gerçekçi mesaj yüklenme animasyonu */
            <div className="flex flex-col h-full py-6 animate-in fade-in duration-300 overflow-hidden">
              {/* Skeleton Messages - Ekranı dolduracak kadar */}
              {[
                { isSequence: false, nameWidth: 85, textWidth: 75, hasSecondLine: true, secondWidth: 45 },
                { isSequence: true, nameWidth: 0, textWidth: 40, hasSecondLine: false, secondWidth: 0 },
                { isSequence: false, nameWidth: 110, textWidth: 85, hasSecondLine: true, secondWidth: 30 },
                { isSequence: false, nameWidth: 70, textWidth: 55, hasSecondLine: false, secondWidth: 0 },
                { isSequence: true, nameWidth: 0, textWidth: 65, hasSecondLine: true, secondWidth: 25 },
                { isSequence: false, nameWidth: 95, textWidth: 90, hasSecondLine: true, secondWidth: 50 },
                { isSequence: true, nameWidth: 0, textWidth: 35, hasSecondLine: false, secondWidth: 0 },
                { isSequence: false, nameWidth: 75, textWidth: 60, hasSecondLine: false, secondWidth: 0 },
                { isSequence: true, nameWidth: 0, textWidth: 80, hasSecondLine: true, secondWidth: 40 },
                { isSequence: false, nameWidth: 100, textWidth: 70, hasSecondLine: true, secondWidth: 35 },
                { isSequence: false, nameWidth: 65, textWidth: 45, hasSecondLine: false, secondWidth: 0 },
                { isSequence: true, nameWidth: 0, textWidth: 55, hasSecondLine: false, secondWidth: 0 },
                { isSequence: false, nameWidth: 90, textWidth: 95, hasSecondLine: true, secondWidth: 55 },
                { isSequence: true, nameWidth: 0, textWidth: 30, hasSecondLine: false, secondWidth: 0 },
                { isSequence: false, nameWidth: 80, textWidth: 65, hasSecondLine: true, secondWidth: 28 },
              ].map((skeleton, i) => (
                <div key={i} className={`flex pr-4 pl-[72px] relative w-full ${!skeleton.isSequence ? 'mt-[17px]' : 'mt-[2px]'}`}>
                  {/* Avatar Skeleton */}
                  {!skeleton.isSequence && (
                    <div className="absolute left-4 w-[50px] flex justify-start">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/[0.08] to-white/[0.04] animate-pulse" />
                    </div>
                  )}
                  
                  {/* Content Skeleton */}
                  <div className="flex-1 min-w-0">
                    {/* Username & Time Skeleton */}
                    {!skeleton.isSequence && (
                      <div className="flex items-center gap-2 mb-2">
                        <div 
                          className="h-4 rounded-md bg-gradient-to-r from-white/[0.1] to-white/[0.05] animate-pulse"
                          style={{ width: `${skeleton.nameWidth}px` }}
                        />
                        <div className="h-3 w-10 rounded-md bg-white/[0.05] animate-pulse" style={{ animationDelay: '150ms' }} />
                      </div>
                    )}
                    
                    {/* Message Text Skeleton */}
                    <div className="space-y-1.5">
                      <div 
                        className="h-4 rounded-md bg-gradient-to-r from-white/[0.08] to-white/[0.03] animate-pulse"
                        style={{ 
                          width: `${skeleton.textWidth}%`,
                          animationDelay: `${i * 50}ms`
                        }}
                      />
                      {skeleton.hasSecondLine && (
                        <div 
                          className="h-4 rounded-md bg-gradient-to-r from-white/[0.06] to-white/[0.02] animate-pulse"
                          style={{ 
                            width: `${skeleton.secondWidth}%`,
                            animationDelay: `${i * 50 + 25}ms`
                          }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              ))}
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
            <div className="flex flex-col min-h-full pb-4 pt-6">
              {/* Spacer to push messages to bottom when content is less than container height */}
              <div className="flex-grow" />
              
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
                  onImageClick={setSelectedImage}
                />
              ))}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Right Sidebar: Member List removed */}
      </div>

      {/* INPUT ALANI */}
      <div className="px-4 sm:px-5 pb-5 sm:pb-6 pt-3 bg-gradient-to-t from-[#0e0f12] via-[#12131a] to-transparent shrink-0 z-20 relative">
        {pendingImage && (
          <div className="mb-3 bg-[#1e1f22]/90 backdrop-blur-md border border-white/10 rounded-2xl p-3 flex items-start gap-3 animate-fadeIn shadow-lg relative max-w-fit mx-auto sm:mx-0">
            <div className="relative group">
                <img src={pendingImage} alt="Preview" className="h-40 rounded-lg object-contain bg-black/50" />
                <button 
                    onClick={removePendingImage}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors z-10"
                >
                    <Trash2 size={14} />
                </button>
            </div>
            <div className="flex flex-col gap-1 max-w-[200px]">
                <span className="text-white text-sm font-medium truncate">{pendingImageFile?.name || "Pasted Image"}</span>
                <span className="text-white/50 text-xs text-left">Gönderilmeye hazır</span>
            </div>
          </div>
        )}
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

        <div className="backdrop-blur-xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] rounded-2xl px-4 sm:px-5 py-3 flex items-center gap-0.5 sm:gap-1 relative shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)] border border-white/[0.08] focus-within:border-indigo-500/50 focus-within:shadow-[0_8px_32px_rgba(99,102,241,0.2)] transition-all duration-300">
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

          {/* Upload Button */}
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/png, image/jpeg, image/webp, image/gif"
            onChange={handleImageSelect}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className={`text-white/60 hover:text-white transition-all duration-200 p-2 rounded-xl hover:bg-white/[0.05] hover:scale-110 active:scale-95 ml-1 flex-shrink-0 ${
                isUploading ? "opacity-50 cursor-not-allowed" : ""
            }`}
            title="Resim Yükle"
          >
             {isUploading ? <Loader2 size={20} className="animate-spin" /> : <Paperclip size={20} />}
          </button>

          <form
            onSubmit={handleSendMessage}
            className="flex-1 flex items-center"
          >
            <input
              ref={inputRef}
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onPaste={handlePaste}
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
      {/* LINK GÜVENLİK MODALI */}
      {linkModal.isOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
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
        </div>,
        document.body
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
          {contextMenu.message.type === 'image' ? (
            <>
              <div
                className="mx-2 px-2 py-1.5 hover:bg-[#5865F2] hover:text-white rounded cursor-pointer flex items-center gap-2 group select-none transition-colors"
                onClick={handleCopyImage}
              >
                <ImageIcon size={16} className="text-[#b5bac1] group-hover:text-white" />
                <span className="font-medium">Resmi Kopyala</span>
              </div>
              <div
                className="mx-2 px-2 py-1.5 hover:bg-[#5865F2] hover:text-white rounded cursor-pointer flex items-center gap-2 group select-none transition-colors"
                onClick={handleCopyImageLink}
              >
                <Copy size={16} className="text-[#b5bac1] group-hover:text-white" />
                <span className="font-medium">Linki Kopyala</span>
              </div>
            </>
          ) : (
            <div
              className="mx-2 px-2 py-1.5 hover:bg-[#5865F2] hover:text-white rounded cursor-pointer flex items-center gap-2 group select-none transition-colors"
              onClick={handleCopyText}
            >
              <Copy size={16} className="text-[#b5bac1] group-hover:text-white" />
              <span className="font-medium">Metni Kopyala</span>
            </div>
          )}
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
      
      {/* IMAGE PREVIEW MODAL */}
      {selectedImage && typeof document !== 'undefined' && createPortal(
        <div 
            className="fixed inset-0 z-[10000] bg-[#0f0f11]/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 animate-fadeIn select-none overflow-hidden"
            onClick={() => setSelectedImage(null)}
            onMouseMove={handleImgMouseMove}
            onMouseUp={handleImgMouseUp}
            onMouseLeave={handleImgMouseUp}
            onContextMenu={(e) => e.preventDefault()}
        >
            {/* Background Decorations */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full animate-float-slow" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full animate-float" />

            {/* Top Toolbar */}
            <div className="absolute top-8 left-8 right-8 z-50 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-indigo-500/20">
                    <ImageIcon className="text-white" size={20} />
                  </div>
                  <div className="hidden sm:block">
                    <h1 className="text-lg font-bold text-white tracking-tight">Netrex Görüntüleyici</h1>
                    <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest leading-none mt-1">Premium Media Experience</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button 
                    onClick={async () => {
                      try {
                        const response = await fetch(selectedImage);
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `netrex-media-${Date.now()}.png`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        window.URL.revokeObjectURL(url);
                      } catch (error) {
                        toast.error("İndirme başarısız oldu.");
                        window.open(selectedImage, '_blank');
                      }
                    }}
                    className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white px-4 py-2.5 rounded-xl border border-white/5 transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg"
                  >
                    <Download size={18} />
                    <span className="text-sm font-semibold">İndir</span>
                  </button>
                  
                  

                  <button
                      onClick={() => setSelectedImage(null)}
                      className="bg-white/5 hover:bg-red-500/80 text-white/80 hover:text-white p-2.5 rounded-xl border border-white/5 transition-all duration-300 hover:scale-110 active:scale-90 shadow-lg group/close"
                  >
                      <X size={20} className="group-hover/close:rotate-90 transition-transform" />
                  </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 w-full flex items-center justify-center relative z-10 overflow-hidden">
                <div 
                  className={`relative ${imgIsDragging ? 'transition-none' : 'transition-transform duration-200'} ease-out ${
                    isSpacePressed ? (imgIsDragging ? 'cursor-grabbing' : 'cursor-grab') :
                    (imgZoom > 1 ? 'cursor-move' : 'cursor-default')
                  }`}
                  style={{
                    transform: `translate(${imgPosition.x}px, ${imgPosition.y}px) scale(${imgZoom}) rotate(${imgRotation}deg)`,
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={handleImgMouseDown}
                >
                  <div className="absolute inset-0 bg-indigo-500/20 blur-[100px] opacity-50 pointer-events-none" />
                  <div className="relative glass-card p-1.5 rounded-2xl shadow-2xl animate-scaleIn">
                    <img 
                        src={selectedImage} 
                        alt="Full View" 
                        className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-inner pointer-events-none"
                    />
                  </div>
                </div>
            </div>

            {/* Bottom Floating Controls */}
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-50" onClick={(e) => e.stopPropagation()}>
              <div className="glass-modal px-6 py-3 rounded-2xl flex items-center gap-6 shadow-2xl border border-white/10 backdrop-blur-2xl">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleImgZoomOut}
                    className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-all disabled:opacity-20"
                    disabled={imgZoom <= 0.5}
                  >
                    <Minus size={20} />
                  </button>
                  <span className="min-w-[4rem] text-center text-sm font-bold text-white/80 tabular-nums">
                    %{Math.round(imgZoom * 100)}
                  </span>
                  <button 
                    onClick={handleImgZoomIn}
                    className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-all disabled:opacity-20"
                    disabled={imgZoom >= 5}
                  >
                    <Plus size={20} />
                  </button>
                </div>

                <div className="w-px h-6 bg-white/10" />

                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleImgRotate}
                    title="Döndür"
                    className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-all"
                  >
                    <RotateCw size={20} />
                  </button>
                  <button 
                    onClick={handleImgReset}
                    title="Sıfırla"
                    className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-all"
                  >
                    <RefreshCw size={20} />
                  </button>
                </div>
              </div>
            </div>

            {/* Status Footer */}
            <div className="absolute bottom-6 px-10 w-full flex items-center justify-between pointer-events-none opacity-40">
                <div className="flex gap-6 text-[10px] text-white/50 font-bold uppercase tracking-[0.2em]">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] self-center" />
                  <span>Secure Stream Protocol</span>
                </div>
                <div className="text-[10px] text-white font-bold uppercase tracking-widest">
                  {imgRotation !== 0 && `${imgRotation}°`}
                  {imgZoom !== 1 && (imgRotation !== 0 ? ` • ` : "") + `%${Math.round(imgZoom * 100)}`}
                </div>
            </div>
        </div>,
        document.body
      )}

    </div>
  );
}
