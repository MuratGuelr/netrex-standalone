import { create } from "zustand";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  orderBy,
  limit,
  startAfter,
  writeBatch,
  increment,
} from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import { toast } from "@/src/utils/toast";
import { MESSAGE_SEQUENCE_THRESHOLD } from "@/src/constants/appConfig";

const DM_MESSAGE_PAGE_SIZE = 50;
const DM_MAX_STORED_MESSAGES = 300;
const DM_MESSAGE_MAX_LENGTH = 2000;

let conversationsUnsubscribe = null;
let activeMessageListener = null;
const userPresenceListeners = new Map(); // otherId -> unsubscribe function
const dmPaginationCursors = new Map();

export const useDMStore = create((set, get) => ({
  conversations: [],       // List of DM conversations
  activeConversation: null, // Currently selected conversation
  messages: [],             // Messages of active conversation
  isLoading: false,
  isLoadingOlder: false,
  hasMoreMessages: false,
  unreadDMCounts: {},       // { conversationId: count }
  users: {},                // { userId: userData } - Real-time user data for presence
  typingUsers: {},          // { conversationId: { userId: username } }
  isLoadingOlderMessages: false, // Alias for consistency with ChatView if needed

  // ── LISTENERS ─────────────────────────────────────────────

  /**
   * Listen to all DM conversations for current user
   */
  startConversationListener: (userId) => {
    if (!userId) return;
    if (conversationsUnsubscribe) conversationsUnsubscribe();

    // Listen to conversations where user is a participant
    const q = query(
      collection(db, "dm_conversations"),
      where("participantIds", "array-contains", userId)
    );

    conversationsUnsubscribe = onSnapshot(q, async (snapshot) => {
      const convos = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data({ serverTimestamps: 'estimate' }),
      }));

      // Sort in memory by lastMessageAt desc
      convos.sort((a, b) => {
        const timeA = a.lastMessageAt?.toMillis?.() || a.lastMessageAt || 0;
        const timeB = b.lastMessageAt?.toMillis?.() || b.lastMessageAt || 0;
        return timeB - timeA;
      });

      // 2. Update unreadDMCounts state based on Firestore data
      const unreadMap = {};
      convos.forEach(c => {
        if (c.unreadCounts && c.unreadCounts[userId]) {
          unreadMap[c.id] = c.unreadCounts[userId];
        }
      });

      // 3. Start presence listeners and fetch initial otherUser data
      const convosWithInitialData = await Promise.all(
        convos.map(async (convo) => {
          const otherId = convo.participantIds.find(id => id !== userId);
          if (!otherId) return convo;

          // Start real-time presence listener
          get().startUserPresenceListener(otherId);

          try {
            // One-time fetch for immediate display before listener kicks in
            const userDoc = await getDoc(doc(db, "users", otherId));
            return {
              ...convo,
              otherId, // handy for UI
              otherUser: userDoc.exists() 
                ? { uid: userDoc.id, ...userDoc.data() } 
                : { uid: otherId, displayName: "Bilinmeyen" }
            };
          } catch {
            return { ...convo, otherId, otherUser: { uid: otherId, displayName: "Bilinmeyen" } };
          }
        })
      );

      // ✅ OKUNMAMIŞ SAYILARI VE KONUŞMALARI AYNI ANDA GÜNCELLE (BİLDİRİM SENKRONİZASYONU İÇİN KRİTİK)
      set({ 
        unreadDMCounts: unreadMap,
        conversations: convosWithInitialData 
      });
    }, (error) => {
      console.error("DM conversations listener error:", error);
    });
  },

  /**
   * Listen to a specific user's data (presence, displayName, etc.) in real-time
   */
  startUserPresenceListener: (userId) => {
    if (!userId || userPresenceListeners.has(userId)) return;

    const unsub = onSnapshot(doc(db, "users", userId), (docSnap) => {
      if (docSnap.exists()) {
        set((state) => ({
          users: {
            ...state.users,
            [userId]: { uid: docSnap.id, ...docSnap.data() }
          }
        }));
      }
    });

    userPresenceListeners.set(userId, unsub);
  },

  /**
   * Start real-time message listener for a conversation
   */
  startMessageListener: (conversationId) => {
    if (!conversationId) return;
    if (activeMessageListener) activeMessageListener();

    const messagesQ = query(
      collection(db, "dm_conversations", conversationId, "messages"),
      orderBy("timestamp", "desc"),
      orderBy("__name__", "desc"),
      limit(DM_MESSAGE_PAGE_SIZE)
    );

    activeMessageListener = onSnapshot(messagesQ, (snapshot) => {
      const msgs = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .reverse();

      const hasMore = snapshot.docs.length === DM_MESSAGE_PAGE_SIZE;
      dmPaginationCursors.set(
        conversationId,
        snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null
      );

      set({ messages: msgs, hasMoreMessages: hasMore, isLoading: false });
    }, (error) => {
      console.error("DM messages listener error:", error);
      set({ isLoading: false });
    });
  },

  setTypingStatus: (conversationId, userId, username, isTyping) => {
    set((state) => {
      const typing = { ...state.typingUsers };
      if (!typing[conversationId]) typing[conversationId] = {};
      
      if (isTyping) {
        typing[conversationId][userId] = username;
      } else {
        delete typing[conversationId][userId];
      }
      
      return { typingUsers: typing };
    });
  },

  sendTypingStatus: (conversationId, userId, username, isTyping, room) => {
    // DM'de typing status genelde Firestore üzerinden gitmez (hız için)
    // Ama eğer LiveKit room'u varsa (call esnasında) oradan gidebilir.
    // Şimdilik sadece local status güncelleyelim veya ileride Firebase/Realtime DB eklenebilir.
    // get().setTypingStatus(conversationId, userId, username, isTyping);
  },

  stopMessageListener: () => {
    if (activeMessageListener) {
      activeMessageListener();
      activeMessageListener = null;
    }
  },

  stopListeners: () => {
    if (conversationsUnsubscribe) {
      conversationsUnsubscribe();
      conversationsUnsubscribe = null;
    }
    if (activeMessageListener) {
      activeMessageListener();
      activeMessageListener = null;
    }
    // Stop all user presence listeners
    userPresenceListeners.forEach(unsub => unsub());
    userPresenceListeners.clear();
    set({ users: {} });
  },

  // ── ACTIONS ─────────────────────────────────────────────

  /**
   * Open or create a DM conversation with another user
   */
  openOrCreateConversation: async (currentUserId, targetUserId) => {
    if (!currentUserId || !targetUserId) return null;

    set({ isLoading: true });

    try {
      // Check if conversation already exists
      const existingQ = query(
        collection(db, "dm_conversations"),
        where("participantIds", "array-contains", currentUserId)
      );

      const snapshot = await getDocs(existingQ);
      let existingConvo = null;

      snapshot.docs.forEach(d => {
        const data = d.data();
        if (data.participantIds.includes(targetUserId)) {
          existingConvo = { id: d.id, ...data };
        }
      });

      if (existingConvo) {
        // Fetch other user data
        const userDoc = await getDoc(doc(db, "users", targetUserId));
        const otherUser = userDoc.exists()
          ? { uid: userDoc.id, ...userDoc.data() }
          : { uid: targetUserId, displayName: "Bilinmeyen" };

        const convoWithUser = { ...existingConvo, otherUser };
        set({ activeConversation: convoWithUser, isLoading: false });
        get().startMessageListener(existingConvo.id);
        get().markDMAsRead(existingConvo.id, currentUserId);
        return existingConvo.id;
      }

      // Create new conversation
      const newConvo = {
        participantIds: [currentUserId, targetUserId].sort(), // Sort for consistency
        createdAt: serverTimestamp(),
        lastMessage: null,
        lastMessageAt: serverTimestamp(),
      };

      const convoRef = await addDoc(collection(db, "dm_conversations"), newConvo);

      // Fetch other user data
      const userDoc = await getDoc(doc(db, "users", targetUserId));
      const otherUser = userDoc.exists()
        ? { uid: userDoc.id, ...userDoc.data() }
        : { uid: targetUserId, displayName: "Bilinmeyen" };

      const convoWithUser = { id: convoRef.id, ...newConvo, otherUser };
      set({ activeConversation: convoWithUser, isLoading: false, messages: [] });
      get().startMessageListener(convoRef.id);
      return convoRef.id;
    } catch (error) {
      console.error("Open/create DM error:", error);
      set({ isLoading: false });
      toast.error("Sohbet açılamadı.");
      return null;
    }
  },

  /**
   * Select an existing conversation
   */
  selectConversation: (conversation) => {
    // Stop previous listener
    get().stopMessageListener();
    
    set({
      activeConversation: conversation,
      messages: [],
      hasMoreMessages: false,
    });

    if (conversation?.id) {
      const { user } = require("@/src/store/authStore").useAuthStore.getState();
      get().startMessageListener(conversation.id);
      get().markDMAsRead(conversation.id, user?.uid);
    }
  },

  /**
   * Send a DM message
   */
  sendMessage: async (conversationId, text, senderId, senderName, extra = {}) => {
    const cleanedText = text.trim();
    const isImage = extra.type === "image";
    
    if (!cleanedText && !isImage) return { success: false, error: "Mesaj boş olamaz" };
    if (cleanedText.length > DM_MESSAGE_MAX_LENGTH) {
      return { success: false, error: `Mesaj en fazla ${DM_MESSAGE_MAX_LENGTH} karakter olabilir.` };
    }

    try {
      // Firestore'a yaz
      const messageRef = await addDoc(collection(db, "dm_conversations", conversationId, "messages"), {
        senderId,
        senderName,
        text: cleanedText,
        timestamp: serverTimestamp(),
        isImage,
        createdAt: serverTimestamp(),
        ...extra
      });

      // Update conversation's lastMessage AND increment other participant's unread count ATOMICALLY
      const convo = get().conversations.find(c => c.id === conversationId);
      const updateData = {
        lastMessage: {
          id: messageRef.id,
          text: isImage ? "📷 Fotoğraf" : (cleanedText.length > 100 ? cleanedText.slice(0, 100) + "..." : cleanedText),
          senderId,
          senderName,
          timestamp: Date.now(), // Local timestamp for UI immediate update
        },
        lastMessageAt: serverTimestamp(),
      };

      if (convo) {
        const otherId = convo.participantIds.find(id => id !== senderId);
        if (otherId) {
          updateData[`unreadCounts.${otherId}`] = increment(1);
        }
      }

      await updateDoc(doc(db, "dm_conversations", conversationId), updateData);

      return { success: true };
    } catch (error) {
      console.error("DM send error:", error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Load older messages (pagination)
   */
  loadOlderMessages: async (conversationId) => {
    const lastDoc = dmPaginationCursors.get(conversationId);
    if (!lastDoc) {
      set({ hasMoreMessages: false });
      return;
    }

    set({ isLoadingOlder: true });

    try {
      const olderQ = query(
        collection(db, "dm_conversations", conversationId, "messages"),
        orderBy("timestamp", "desc"),
        startAfter(lastDoc),
        limit(DM_MESSAGE_PAGE_SIZE)
      );

      const snapshot = await getDocs(olderQ);
      
      if (snapshot.docs.length === 0) {
        dmPaginationCursors.set(conversationId, null);
        set({ hasMoreMessages: false, isLoadingOlder: false });
        return;
      }

      const olderMessages = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .reverse();

      dmPaginationCursors.set(
        conversationId,
        snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null
      );

      set((state) => ({
        messages: [...olderMessages, ...state.messages],
        hasMoreMessages: snapshot.docs.length === DM_MESSAGE_PAGE_SIZE,
        isLoadingOlder: false,
      }));
    } catch (error) {
      console.error("Load older DM messages error:", error);
      set({ isLoadingOlder: false });
    }
  },

  /**
   * Edit a message
   */
  editMessage: async (conversationId, messageId, newText, userId) => {
    try {
      const msgRef = doc(db, "dm_conversations", conversationId, "messages", messageId);
      await updateDoc(msgRef, {
        text: newText,
        isEdited: true,
        editedAt: serverTimestamp(),
      });

      // Update lastMessage preview if it was the last message
      const convo = get().conversations.find(c => c.id === conversationId);
      if (convo?.lastMessage?.id === messageId) {
        await updateDoc(doc(db, "dm_conversations", conversationId), {
          "lastMessage.text": newText.length > 100 ? newText.slice(0, 100) + "..." : newText
        });
      }

      return { success: true };
    } catch (error) {
      console.error("DM edit message error:", error);
      return { success: false, error: "Mesaj düzenlenemedi." };
    }
  },

  /**
   * Delete a message
   */
  deleteMessage: async (conversationId, messageId) => {
    try {
      await deleteDoc(
        doc(db, "dm_conversations", conversationId, "messages", messageId)
      );

      // Denormalized lastMessage update
      const convo = get().conversations.find(c => c.id === conversationId);
      
      // If we are deleting the message that is currently the 'lastMessage' in the conversation doc
      if (convo?.lastMessage?.id === messageId) {
         const messages = get().messages;
         const remaining = messages.filter(m => m.id !== messageId);
         const newLast = remaining[remaining.length - 1];
         
         if (newLast) {
           await updateDoc(doc(db, "dm_conversations", conversationId), {
             lastMessage: {
               id: newLast.id,
               text: newLast.text.length > 100 ? newLast.text.slice(0, 100) + "..." : newLast.text,
               senderId: newLast.senderId,
               senderName: newLast.senderName,
               timestamp: newLast.timestamp,
             },
             lastMessageAt: newLast.timestamp
           });
         } else {
           await updateDoc(doc(db, "dm_conversations", conversationId), {
             lastMessage: null,
             lastMessageAt: serverTimestamp()
           });
         }
      }

      return { success: true };
    } catch (error) {
      console.error("DM delete message error:", error);
      return { success: false };
    }
  },

  /**
   * Delete a sequence of messages from a user
   */
  deleteMessageSequence: async (conversationId, messageId) => {
    try {
      const currentMessages = get().messages;
      const targetMessage = currentMessages.find(m => m.id === messageId);
      if (!targetMessage) return { success: false, error: "Mesaj bulunamadı." };

      const sequenceIds = [];
      let startIndex = currentMessages.findIndex(m => m.id === messageId);
      
      const getTs = (ts) => ts?.toMillis?.() || (typeof ts === 'number' ? ts : (ts ? new Date(ts).getTime() : Date.now()));
      const targetTs = getTs(targetMessage.timestamp);

      // Geriye doğru sequence'ı bul (Older in index space)
      for (let i = startIndex; i >= 0; i--) {
        const msg = currentMessages[i];
        if (msg.senderId === targetMessage.senderId) {
          const timeDiff = Math.abs(targetTs - getTs(msg.timestamp));
          if (timeDiff < MESSAGE_SEQUENCE_THRESHOLD) {
            sequenceIds.push(msg.id);
          } else {
            break;
          }
        } else {
          break;
        }
      }

      // İleriye doğru sequence'ı bul (Newer in index space)
      for (let i = startIndex + 1; i < currentMessages.length; i++) {
        const msg = currentMessages[i];
        if (msg.senderId === targetMessage.senderId) {
          const timeDiff = Math.abs(getTs(msg.timestamp) - targetTs);
          if (timeDiff < MESSAGE_SEQUENCE_THRESHOLD) {
            sequenceIds.push(msg.id);
          } else {
            break;
          }
        } else {
          break;
        }
      }

      const uniqueSequenceIds = [...new Set(sequenceIds)];

      // Delete all in parallel
      await Promise.all(uniqueSequenceIds.map(id => 
        deleteDoc(doc(db, "dm_conversations", conversationId, "messages", id))
      ));

      return { success: true, deletedCount: uniqueSequenceIds.length };
    } catch (error) {
      console.error("DM delete sequence error:", error);
      return { success: false, error: "Mesajlar silinemedi." };
    }
  },

  /**
   * Toggle a reaction on a message
   */
  toggleReaction: async (conversationId, messageId, emoji, userId) => {
    try {
      const msgRef = doc(db, "dm_conversations", conversationId, "messages", messageId);
      const msgDoc = await getDoc(msgRef);
      if (!msgDoc.exists()) return;

      const data = msgDoc.data();
      const reactions = data.reactions || {};
      const emojiReactions = reactions[emoji] || [];

      let newEmojiReactions;
      if (emojiReactions.includes(userId)) {
        newEmojiReactions = emojiReactions.filter(id => id !== userId);
      } else {
        newEmojiReactions = [...emojiReactions, userId];
      }

      const newReactions = { ...reactions };
      if (newEmojiReactions.length > 0) {
        newReactions[emoji] = newEmojiReactions;
      } else {
        delete newReactions[emoji];
      }

      await updateDoc(msgRef, { reactions: newReactions });
    } catch (error) {
      console.error("DM toggle reaction error:", error);
    }
  },

  // ── UNREAD COUNTS ─────────────────────────────────────────

  incrementDMUnread: (conversationId) => {
    const active = get().activeConversation;
    if (active?.id === conversationId) return;

    set((state) => ({
      unreadDMCounts: {
        ...state.unreadDMCounts,
        [conversationId]: (state.unreadDMCounts[conversationId] || 0) + 1,
      },
    }));
  },

  markDMAsRead: async (conversationId, userId) => {
    if (!conversationId || !userId) return;

    // Local reset
    set((state) => {
      const newCounts = { ...state.unreadDMCounts };
      delete newCounts[conversationId];
      return { unreadDMCounts: newCounts };
    });

    // Firestore reset
    try {
      const updateData = {};
      updateData[`unreadCounts.${userId}`] = 0;
      await updateDoc(doc(db, "dm_conversations", conversationId), updateData);
    } catch (error) {
      console.error("Failed to mark DM as read in Firestore:", error);
    }
  },

  getTotalUnreadCount: () => {
    const counts = get().unreadDMCounts;
    return Object.values(counts).reduce((sum, c) => sum + c, 0);
  },

  // ── CALLS ───────────────────────────────────────────────

  startCall: async (conversationId, callerId) => {
    try {
      await updateDoc(doc(db, "dm_conversations", conversationId), {
        callData: {
          status: 'ringing',
          callerId,
          timestamp: serverTimestamp()
        },
        lastMessageAt: serverTimestamp() // Update to push convo to top
      });
      return true;
    } catch (error) {
      console.error("Failed to start call:", error);
      return false;
    }
  },

  acceptCall: async (conversationId) => {
    try {
      await updateDoc(doc(db, "dm_conversations", conversationId), {
        "callData.status": 'accepted',
        "callData.acceptedAt": serverTimestamp()
      });
      return true;
    } catch (error) {
      console.error("Failed to accept call:", error);
      return false;
    }
  },

  endCall: async (conversationId) => {
    try {
      await updateDoc(doc(db, "dm_conversations", conversationId), {
        callData: null
      });
      return true;
    } catch (error) {
      console.error("Failed to end call:", error);
      return false;
    }
  },

  clearConversation: async (conversationId) => {
    if (!conversationId) return { success: false, error: "Conversation ID is missing" };
    
    try {
      // 1. Get all messages for this DM
      const q = query(collection(db, "dm_conversations", conversationId, "messages"));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return { success: true };
      }

      // 2. Batch delete (max 500 per batch standard, chunked to 400 safely)
      const docs = snapshot.docs;
      const chunkSize = 400;
      for (let i = 0; i < docs.length; i += chunkSize) {
        const chunk = docs.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        chunk.forEach((docSnap) => {
          batch.delete(docSnap.ref);
        });
        await batch.commit();
      }

      // Clear from local state immediately if active
      if (get().activeConversation?.id === conversationId) {
        set({ messages: [], hasMoreMessages: false });
      }

      // 3. Reset conversation preview
      await updateDoc(doc(db, "dm_conversations", conversationId), {
        lastMessage: null,
        lastMessageAt: serverTimestamp()
      });

      return { success: true };
    } catch (error) {
      console.error("Failed to clear DM conversation:", error);
      return { success: false, error: error.message };
    }
  },

  // ── CLEANUP ─────────────────────────────────────────────

  clearActiveConversation: () => {
    get().stopMessageListener();
    set({
      activeConversation: null,
      messages: [],
      hasMoreMessages: false,
    });
  },

  reset: () => {
    get().stopListeners();
    set({
      conversations: [],
      activeConversation: null,
      messages: [],
      isLoading: false,
      isLoadingOlder: false,
      hasMoreMessages: false,
      unreadDMCounts: {},
    });
  },
}));
