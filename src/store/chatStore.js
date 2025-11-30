import { create } from "zustand";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  arrayUnion,
  serverTimestamp,
  orderBy,
} from "firebase/firestore";
import { db } from "@/src/lib/firebase";

export const useChatStore = create((set, get) => ({
  textChannels: [],
  currentChannel: null,
  messages: [],
  isLoading: false,
  error: null,

  // YENİ: Okunmamış Mesaj Sayıları { channelId: sayi }
  unreadCounts: {},

  // Metin kanallarını çek
  fetchTextChannels: async () => {
    set({ isLoading: true, error: null });
    try {
      const q = query(
        collection(db, "text_channels"),
        orderBy("createdAt", "desc")
      );
      const snapshot = await getDocs(q);
      const channels = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      set({ textChannels: channels, isLoading: false });
    } catch (error) {
      console.error("Error fetching text channels:", error);
      set({ error: error.message, isLoading: false });
    }
  },

  // Yeni kanal oluştur
  createTextChannel: async (name, userId) => {
    set({ isLoading: true, error: null });
    try {
      const q = query(
        collection(db, "text_channels"),
        where("createdBy", "==", userId)
      );
      const snapshot = await getDocs(q);

      if (snapshot.size >= 3) {
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
        name: name.trim(),
        createdBy: userId,
        createdAt: serverTimestamp(),
        messages: [],
      };

      const docRef = await addDoc(collection(db, "text_channels"), newChannel);
      await get().fetchTextChannels();

      set({ isLoading: false });
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
    set({ isLoading: true, error: null, messages: [] });

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
      const messages = channelData.messages || [];
      messages.sort((a, b) => a.timestamp - b.timestamp);

      set({
        messages,
        currentChannel: { id: channelId, ...channelData },
        isLoading: false,
      });
    } catch (error) {
      console.error("Error loading channel messages:", error);
      set({ error: error.message, isLoading: false });
    }
  },

  // Mesaj Gönder
  sendMessage: async (channelId, messageText, userId, username, room) => {
    if (!messageText.trim())
      return { success: false, error: "Mesaj boş olamaz" };

    const message = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      text: messageText.trim(),
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

      const channelRef = doc(db, "text_channels", channelId);
      await updateDoc(channelRef, {
        messages: arrayUnion(message),
      });

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

      const channelRef = doc(db, "text_channels", channelId);
      await updateDoc(channelRef, {
        messages: updatedMessages,
      });

      return { success: true };
    } catch (error) {
      console.error("Mesaj silinemedi:", error);
      return { success: false, error: error.message };
    }
  },

  clearCurrentChannel: () => {
    set({ currentChannel: null, messages: [] });
  },
}));
