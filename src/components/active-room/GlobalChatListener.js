
import { useEffect } from "react";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { useChatStore } from "@/src/store/chatStore";
import { useSettingsStore } from "@/src/store/settingsStore";
import { useAuthStore } from "@/src/store/authStore";
import { useSoundEffects } from "@/src/hooks/useSoundEffects";
import { chatToast } from "@/src/utils/toast";

// --- GLOBAL CHAT & EVENTS ---
export default function GlobalChatListener({ showChatPanel, setShowChatPanel }) {
  const room = useRoomContext();
  const { incrementUnread, currentChannel, textChannels, loadChannelMessages, setTypingStatus } =
    useChatStore();
  const { user } = useAuthStore();
  const { playSound } = useSoundEffects();
  const { desktopNotifications, notifyOnMessage } = useSettingsStore();

  useEffect(() => {
    if (!room) return;
    const handleData = (payload, participant, kind, topic) => {
      if (topic !== "chat" && topic !== "typing") return;
      try {
        const decoder = new TextDecoder();
        const data = JSON.parse(decoder.decode(payload));
        if (data.type === "chat" && data.message.userId !== user?.uid) {
          const message = data.message;
          const channelId = data.channelId;
          // Mesajın geldiği kanalın adını bul
          const messageChannel = textChannels.find((ch) => ch.id === channelId);
          const channelName = messageChannel?.name || "sohbet";

          // Toast bildirim göster (uygulama içindeyse VE sohbet paneli kapalıysa)
          if (
            typeof document !== "undefined" &&
            !document.hidden &&
            document.hasFocus() &&
            !showChatPanel // Sohbet paneli açıksa toast gösterme
          ) {
            chatToast({
              username: message.username || "Bir kullanıcı",
              message: message.text,
              channelName: channelName,
              avatarColor: message.profileColor,
              onClick: () => {
                // Tıklanınca sohbet panelini aç ve mesajın geldiği kanala git
                if (setShowChatPanel) {
                  setShowChatPanel(true);
                }
                // Mesajın geldiği kanala geç
                if (channelId && channelId !== currentChannel?.id) {
                  loadChannelMessages(channelId);
                }
              },
            });
          }

          // Masaüstü bildirim göster (ayarlardan açtıysa)
          if (desktopNotifications && notifyOnMessage) {
            if (typeof window !== "undefined" && "Notification" in window) {
              if (Notification.permission === "granted") {
                // Pencere arka plandaysa VEYA sohbet paneli kapalıysa masaüstü bildirim göster
                const isAppInBackground =
                  typeof document !== "undefined" &&
                  (document.hidden || !document.hasFocus());
                const shouldNotify = isAppInBackground || !showChatPanel;

                if (shouldNotify) {
                  const body = message.text
                    ? message.text.length > 120
                      ? message.text.slice(0, 120) + "..."
                      : message.text
                    : "Yeni mesaj";

                  try {
                    const notification = new Notification(
                      `${
                        message.username || "Bir kullanıcı"
                      } - #${channelName}`,
                      {
                        body: body,
                        icon: "/favicon.ico",
                        badge: "/favicon.ico",
                        tag: `message-${channelId}-${Date.now()}`,
                        silent: false,
                      }
                    );

                    // Bildirime tıklanınca pencereyi focus et ve sohbeti aç
                    notification.onclick = () => {
                      if (window.netrex?.focusWindow) {
                        window.netrex.focusWindow();
                      } else {
                        window.focus();
                      }
                      // Sohbet panelini aç
                      if (setShowChatPanel) {
                        setShowChatPanel(true);
                      }
                      // Mesajın geldiği kanala geç
                      if (channelId && channelId !== currentChannel?.id) {
                        loadChannelMessages(channelId);
                      }
                      notification.close();
                    };

                    // 5 saniye sonra otomatik kapat
                    setTimeout(() => notification.close(), 5000);
                  } catch (error) {
                    console.error("Masaüstü bildirim hatası:", error);
                  }
                }
              }
            }
          }

          if (
            !currentChannel ||
            currentChannel.id !== channelId ||
            !showChatPanel
          ) {
            incrementUnread(channelId);
            playSound("message");
          }
        } else if (data.type === "typing") {
          // Yazıyor bilgisi
          setTypingStatus(data.channelId, data.userId, data.username, data.isTyping);
        }
      } catch (e) {
        console.error(e);
      }
    };
    room.on(RoomEvent.DataReceived, handleData);
    return () => room.off(RoomEvent.DataReceived, handleData);
  }, [
    room,
    currentChannel,
    incrementUnread,
    user,
    showChatPanel,
    setShowChatPanel,
    playSound,
    desktopNotifications,
    notifyOnMessage,
    textChannels,
    loadChannelMessages,
  ]);
  return null;
}
