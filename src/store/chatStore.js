import { create } from "zustand";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  getDoc,
  deleteDoc,
  serverTimestamp,
  orderBy,
  onSnapshot,
  limit,
  startAfter,
  setDoc,
} from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import {
  MAX_TEXT_CHANNELS_PER_USER,
  MESSAGE_MAX_LENGTH,
  MESSAGE_COOLDOWN_MS,
  MESSAGE_SPAM_THRESHOLD_MS,
  MESSAGE_SPAM_COOLDOWN_MS,
  CHANNEL_CREATION_COOLDOWN_MS,
  MESSAGE_PAGE_SIZE,
  MESSAGE_SEQUENCE_THRESHOLD,
} from "@/src/constants/appConfig";

let textChannelsUnsubscribe = null;
let lastMessageSentAt = 0;
let spamCooldownUntil = 0; // Spam koruması aktifse bu zamana kadar mesaj gönderilemez
let lastChannelCreationAt = 0;
const messagePaginationCursors = new Map();

export const useChatStore = create((set, get) => ({
  textChannels: [],
  currentChannel: null,
  messages: [],
  isLoading: false,
  isLoadingOlderMessages: false,
  hasMoreMessages: false,
  error: null,

  // YENİ: Okunmamış Mesaj Sayıları { channelId: sayi }
  unreadCounts: {},

  startTextChannelListener: () => {
    if (textChannelsUnsubscribe) {
      textChannelsUnsubscribe();
    }

    const channelsQuery = query(
      collection(db, "text_channels"),
      orderBy("createdAt", "desc")
    );

    textChannelsUnsubscribe = onSnapshot(
      channelsQuery,
      (snapshot) => {
        const channels = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        set({ textChannels: channels, isLoading: false, error: null });
      },
      (error) => {
        console.error("Text channel listener error:", error);
        set({ error: error.message, isLoading: false });
      }
    );

    return () => {
      if (textChannelsUnsubscribe) {
        textChannelsUnsubscribe();
        textChannelsUnsubscribe = null;
      }
    };
  },

  stopTextChannelListener: () => {
    if (textChannelsUnsubscribe) {
      textChannelsUnsubscribe();
      textChannelsUnsubscribe = null;
    }
  },

  // Yeni kanal oluştur
  createTextChannel: async (name, userId) => {
    if (!userId) {
      return { success: false, error: "Kullanıcı doğrulanamadı." };
    }

    const normalizedName = name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-_]/g, "");

    if (normalizedName.length < 3 || normalizedName.length > 30) {
      return {
        success: false,
        error: "Kanal adı 3-30 karakter arasında olmalıdır.",
      };
    }

    if (Date.now() - lastChannelCreationAt < CHANNEL_CREATION_COOLDOWN_MS) {
      return {
        success: false,
        error: "Lütfen yeni bir kanal oluşturmadan önce birkaç saniye bekleyin.",
      };
    }

    set({ isLoading: true, error: null });
    try {
      const q = query(
        collection(db, "text_channels"),
        where("createdBy", "==", userId)
      );
      const snapshot = await getDocs(q);

      if (snapshot.size >= MAX_TEXT_CHANNELS_PER_USER) {
        set({
          error: "Maksimum 3 metin kanalı oluşturabilirsiniz.",
          isLoading: false,
        });
        return {
          success: false,
          error: "Maksimum 3 metin kanalı oluşturabilirsiniz.",
        };
      }

      const newChannel = {
        name: normalizedName,
        createdBy: userId,
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, "text_channels"), newChannel);

      set({ isLoading: false });
      lastChannelCreationAt = Date.now();
      return { success: true, channelId: docRef.id };
    } catch (error) {
      console.error("Error creating text channel:", error);
      set({ error: error.message, isLoading: false });
      return { success: false, error: error.message };
    }
  },

  // Kanal silme
  deleteTextChannel: async (channelId) => {
    set({ isLoading: true, error: null });
    try {
      await deleteDoc(doc(db, "text_channels", channelId));

      const updatedChannels = get().textChannels.filter(
        (c) => c.id !== channelId
      );

      const currentCh = get().currentChannel;
      if (currentCh && currentCh.id === channelId) {
        set({ currentChannel: null, messages: [] });
      }

      set({ textChannels: updatedChannels, isLoading: false });
      return { success: true };
    } catch (error) {
      console.error("Error deleting channel:", error);
      set({ error: error.message, isLoading: false });
      return { success: false, error: error.message };
    }
  },

  // Kanal mesajlarını yükle
  loadChannelMessages: async (channelId) => {
    set({
      isLoading: true,
      error: null,
      messages: [],
      hasMoreMessages: false,
    });

    // YENİ: Kanalı açtığımız için okunmamış sayısını sıfırla
    get().markAsRead(channelId);

    try {
      const channelDoc = await getDoc(doc(db, "text_channels", channelId));
      if (!channelDoc.exists()) {
        set({
          error: "Kanal bulunamadı",
          isLoading: false,
          currentChannel: null,
        });
        const updatedChannels = get().textChannels.filter(
          (c) => c.id !== channelId
        );
        set({ textChannels: updatedChannels });
        return;
      }

      const channelData = channelDoc.data();
      const messagesQuery = query(
        collection(db, "text_channels", channelId, "messages"),
        orderBy("timestamp", "desc"),
        limit(MESSAGE_PAGE_SIZE)
      );

      const snapshot = await getDocs(messagesQuery);
      const docs = snapshot.docs;
      const messages = docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .reverse();

      const hasMore = docs.length === MESSAGE_PAGE_SIZE;
      messagePaginationCursors.set(
        channelId,
        docs.length > 0 ? docs[docs.length - 1] : null
      );

      set({
        messages,
        currentChannel: { id: channelId, ...channelData },
        isLoading: false,
        hasMoreMessages: hasMore,
      });
    } catch (error) {
      console.error("Error loading channel messages:", error);
      set({ error: error.message, isLoading: false });
    }
  },

  loadOlderMessages: async (channelId) => {
    const lastDoc = messagePaginationCursors.get(channelId);
    if (!lastDoc) {
      set({ hasMoreMessages: false });
      return { success: false, error: "Daha fazla mesaj yok." };
    }

    set({ isLoadingOlderMessages: true });
    try {
      const olderMessagesQuery = query(
        collection(db, "text_channels", channelId, "messages"),
        orderBy("timestamp", "desc"),
        startAfter(lastDoc),
        limit(MESSAGE_PAGE_SIZE)
      );

      const snapshot = await getDocs(olderMessagesQuery);
      const docs = snapshot.docs;

      if (docs.length === 0) {
        messagePaginationCursors.set(channelId, null);
        set({ hasMoreMessages: false, isLoadingOlderMessages: false });
        return { success: true };
      }

      const olderMessages = docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .reverse();

      messagePaginationCursors.set(
        channelId,
        docs.length > 0 ? docs[docs.length - 1] : null
      );

      set((state) => ({
        messages: [...olderMessages, ...state.messages],
        hasMoreMessages: docs.length === MESSAGE_PAGE_SIZE,
        isLoadingOlderMessages: false,
      }));

      return { success: true };
    } catch (error) {
      console.error("Daha eski mesajlar yüklenemedi:", error);
      set({ isLoadingOlderMessages: false });
      return { success: false, error: error.message };
    }
  },

  // Mesaj Gönder
  sendMessage: async (channelId, messageText, userId, username, room) => {
    const cleanedText = messageText.trim();
    if (!cleanedText)
      return { success: false, error: "Mesaj boş olamaz" };

    if (cleanedText.length > MESSAGE_MAX_LENGTH) {
      return {
        success: false,
        error: `Mesaj en fazla ${MESSAGE_MAX_LENGTH} karakter olabilir.`,
      };
    }

    const now = Date.now();
    const timeSinceLastMessage = now - lastMessageSentAt;
    
    // Spam koruması aktifse kontrol et
    if (now < spamCooldownUntil) {
      const remainingTime = Math.ceil((spamCooldownUntil - now) / 1000);
      return {
        success: false,
        error: "Çok hızlı mesaj gönderiyorsunuz. Lütfen bekleyin.",
        cooldownRemaining: remainingTime,
      };
    }
    
    // Spam tespiti: Son mesajdan itibaren çok kısa sürede yeni mesaj gönderilmeye çalışılıyorsa
    if (timeSinceLastMessage < MESSAGE_SPAM_THRESHOLD_MS) {
      // Spam korumasını aktif et
      spamCooldownUntil = now + MESSAGE_SPAM_COOLDOWN_MS;
      const remainingTime = Math.ceil(MESSAGE_SPAM_COOLDOWN_MS / 1000);
      return {
        success: false,
        error: "Çok hızlı mesaj gönderiyorsunuz. Lütfen bekleyin.",
        cooldownRemaining: remainingTime,
      };
    }

    const message = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      text: cleanedText,
      userId,
      username,
      timestamp: Date.now(),
    };

    try {
      // LiveKit Data Channel ile gönder
      if (room) {
        const encoder = new TextEncoder();
        const data = encoder.encode(
          JSON.stringify({
            type: "chat",
            channelId,
            message,
          })
        );

        await room.localParticipant.publishData(data, {
          topic: "chat",
          reliable: true,
        });
      }

      set((state) => ({
        messages: [...state.messages, message],
      }));

      const messageRef = doc(
        collection(db, "text_channels", channelId, "messages"),
        message.id
      );

      await setDoc(messageRef, {
        ...message,
        createdAt: serverTimestamp(),
      });

      lastMessageSentAt = Date.now();

      return { success: true };
    } catch (error) {
      console.error("Error sending message:", error);
      return { success: false, error: error.message };
    }
  },

  // Gelen Mesajı Ekle
  addIncomingMessage: (message) => {
    set((state) => {
      const exists = state.messages.some((m) => m.id === message.id);
      if (exists) return state;
      return { messages: [...state.messages, message] };
    });
  },

  // YENİ: Okunmamış Sayısını Artır
  incrementUnread: (channelId) => {
    const current = get().currentChannel;
    // Eğer şu an o kanal açıksa artırma
    if (current && current.id === channelId) return;

    set((state) => ({
      unreadCounts: {
        ...state.unreadCounts,
        [channelId]: (state.unreadCounts[channelId] || 0) + 1,
      },
    }));
  },

  // YENİ: Okundu İşaretle
  markAsRead: (channelId) => {
    set((state) => {
      const newCounts = { ...state.unreadCounts };
      delete newCounts[channelId];
      return { unreadCounts: newCounts };
    });
  },

  deleteMessage: async (channelId, messageId) => {
    try {
      const currentMessages = get().messages;
      const updatedMessages = currentMessages.filter((m) => m.id !== messageId);
      set({ messages: updatedMessages });

      const messageRef = doc(
        db,
        "text_channels",
        channelId,
        "messages",
        messageId
      );
      await deleteDoc(messageRef);

      return { success: true };
    } catch (error) {
      console.error("Mesaj silinemedi:", error);
      return { success: false, error: error.message };
    }
  },

  // Sequence mesajlarını toplu silme
  deleteMessageSequence: async (channelId, messageId) => {
    try {
      const currentMessages = get().messages;
      const targetMessage = currentMessages.find((m) => m.id === messageId);
      if (!targetMessage) {
        return { success: false, error: "Mesaj bulunamadı." };
      }

      // Sequence'ı bul: Aynı kullanıcının ardışık mesajları
      const sequenceMessages = [];
      let startIndex = -1;

      // Mesajın index'ini bul
      for (let i = 0; i < currentMessages.length; i++) {
        if (currentMessages[i].id === messageId) {
          startIndex = i;
          break;
        }
      }

      if (startIndex === -1) {
        return { success: false, error: "Mesaj bulunamadı." };
      }

      // Geriye doğru sequence'ı bul
      for (let i = startIndex; i >= 0; i--) {
        const msg = currentMessages[i];
        if (msg.userId === targetMessage.userId) {
          if (i < startIndex) {
            // Önceki mesaj - zaman kontrolü yap
            const timeDiff = targetMessage.timestamp - msg.timestamp;
            if (timeDiff < MESSAGE_SEQUENCE_THRESHOLD) {
              sequenceMessages.unshift(msg);
            } else {
              break; // Sequence sonu
            }
          } else {
            // Hedef mesaj
            sequenceMessages.push(msg);
          }
        } else {
          break; // Farklı kullanıcı, sequence sonu
        }
      }

      // İleriye doğru sequence'ı bul
      for (let i = startIndex + 1; i < currentMessages.length; i++) {
        const msg = currentMessages[i];
        if (msg.userId === targetMessage.userId) {
          const timeDiff = msg.timestamp - targetMessage.timestamp;
          if (timeDiff < MESSAGE_SEQUENCE_THRESHOLD) {
            sequenceMessages.push(msg);
          } else {
            break; // Sequence sonu
          }
        } else {
          break; // Farklı kullanıcı, sequence sonu
        }
      }

      if (sequenceMessages.length === 0) {
        return { success: false, error: "Sequence bulunamadı." };
      }

      // Local state'ten sil
      const sequenceIds = sequenceMessages.map((m) => m.id);
      const updatedMessages = currentMessages.filter(
        (m) => !sequenceIds.includes(m.id)
      );
      set({ messages: updatedMessages });

      // Firestore'dan sil
      const deletePromises = sequenceMessages.map((msg) => {
        const messageRef = doc(
          db,
          "text_channels",
          channelId,
          "messages",
          msg.id
        );
        return deleteDoc(messageRef);
      });

      await Promise.all(deletePromises);

      return { success: true, deletedCount: sequenceMessages.length };
    } catch (error) {
      console.error("Sequence mesajları silinemedi:", error);
      return { success: false, error: error.message };
    }
  },

  clearCurrentChannel: () => {
    set({
      currentChannel: null,
      messages: [],
      hasMoreMessages: false,
    });
  },
}));
