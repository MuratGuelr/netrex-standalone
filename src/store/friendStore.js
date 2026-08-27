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
  updateDoc,
  serverTimestamp,
  onSnapshot,
  orderBy,
  limit,
  or,
  and,
  startAt,
  endAt,
} from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import { toast } from "@/src/utils/toast";
import { useSoundManagerStore } from "./soundManagerStore";
import { useSettingsStore } from "./settingsStore";

let friendsUnsubscribe = null;
let requestsUnsubscribe = null;

export const useFriendStore = create((set, get) => ({
  friends: [],           // { id, friendId, friendData, friendshipId }
  incomingRequests: [],   // Pending gelen istekler
  outgoingRequests: [],   // Pending giden istekler
  searchResults: [],
  isSearching: false,
  isLoading: false,
  error: null,

  // ── LISTENERS ─────────────────────────────────────────────

  /**
   * Start listening to accepted friendships for current user
   */
  startFriendListener: (userId) => {
    if (!userId) return;
    if (friendsUnsubscribe) friendsUnsubscribe();

    // Query friendships where user is involved and status is accepted
    // Firestore doesn't support OR on different fields in same query easily,
    // so we use two queries and merge results
    const q1 = query(
      collection(db, "friendships"),
      where("senderId", "==", userId),
      where("status", "==", "accepted")
    );

    const q2 = query(
      collection(db, "friendships"),
      where("receiverId", "==", userId),
      where("status", "==", "accepted")
    );

    // Track both snapshots
    let results1 = [];
    let results2 = [];

    const mergeFriends = () => {
      const allFriends = [...results1, ...results2];
      // Deduplicate by friendship ID
      const seen = new Set();
      const unique = allFriends.filter(f => {
        if (seen.has(f.friendshipId)) return false;
        seen.add(f.friendshipId);
        return true;
      });
      set({ friends: unique });
    };

    const unsub1 = onSnapshot(q1, async (snapshot) => {
      const friendships = snapshot.docs.map(d => ({
        friendshipId: d.id,
        friendId: d.data().receiverId,
        ...d.data(),
      }));

      // Fetch friend user data
      const withData = await Promise.all(
        friendships.map(async (f) => {
          try {
            const userDoc = await getDoc(doc(db, "users", f.friendId));
            return {
              ...f,
              friendData: userDoc.exists() ? { uid: userDoc.id, ...userDoc.data() } : null,
            };
          } catch {
            return { ...f, friendData: null };
          }
        })
      );
      results1 = withData.filter(f => f.friendData);
      mergeFriends();
    });

    const unsub2 = onSnapshot(q2, async (snapshot) => {
      const friendships = snapshot.docs.map(d => ({
        friendshipId: d.id,
        friendId: d.data().senderId,
        ...d.data(),
      }));

      const withData = await Promise.all(
        friendships.map(async (f) => {
          try {
            const userDoc = await getDoc(doc(db, "users", f.friendId));
            return {
              ...f,
              friendData: userDoc.exists() ? { uid: userDoc.id, ...userDoc.data() } : null,
            };
          } catch {
            return { ...f, friendData: null };
          }
        })
      );
      results2 = withData.filter(f => f.friendData);
      mergeFriends();
    });

    friendsUnsubscribe = () => {
      unsub1();
      unsub2();
    };
  },

  /**
   * Start listening to pending friend requests (incoming + outgoing)
   */
  startRequestListener: (userId) => {
    if (!userId) return;
    if (requestsUnsubscribe) requestsUnsubscribe();

    // Incoming requests (where I am the receiver)
    const incomingQ = query(
      collection(db, "friendships"),
      where("receiverId", "==", userId),
      where("status", "==", "pending")
    );

    // Outgoing requests (where I am the sender)
    const outgoingQ = query(
      collection(db, "friendships"),
      where("senderId", "==", userId),
      where("status", "==", "pending")
    );

    const unsub1 = onSnapshot(incomingQ, async (snapshot) => {
      const requests = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
      }));

      const withData = await Promise.all(
        requests.map(async (r) => {
          try {
            const userDoc = await getDoc(doc(db, "users", r.senderId));
            return {
              ...r,
              senderData: userDoc.exists() ? { uid: userDoc.id, ...userDoc.data() } : null,
            };
          } catch {
            return { ...r, senderData: null };
          }
        })
      );
      set({ incomingRequests: withData.filter(r => r.senderData) });
    });

    const unsub2 = onSnapshot(outgoingQ, async (snapshot) => {
      const requests = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
      }));

      const withData = await Promise.all(
        requests.map(async (r) => {
          try {
            const userDoc = await getDoc(doc(db, "users", r.receiverId));
            return {
              ...r,
              receiverData: userDoc.exists() ? { uid: userDoc.id, ...userDoc.data() } : null,
            };
          } catch {
            return { ...r, receiverData: null };
          }
        })
      );
      set({ outgoingRequests: withData.filter(r => r.receiverData) });
    });

    requestsUnsubscribe = () => {
      unsub1();
      unsub2();
    };
  },

  stopListeners: () => {
    if (friendsUnsubscribe) {
      friendsUnsubscribe();
      friendsUnsubscribe = null;
    }
    if (requestsUnsubscribe) {
      requestsUnsubscribe();
      requestsUnsubscribe = null;
    }
  },

  // ── ACTIONS ─────────────────────────────────────────────

  /**
   * Search users by displayName
   */
  searchUsers: async (searchTerm, currentUserId) => {
    if (!searchTerm || searchTerm.trim().length < 2) {
      set({ searchResults: [] });
      return;
    }

    set({ isSearching: true });

    try {
      // Firestore'da prefix araması yapmak için paralel sorgular kuruyoruz.
      // Her alanda limit(20) kullanarak hem performansı hem de veritabanı okuma maliyetlerini koruyoruz.
      const normalizedTerm = searchTerm.trim().toLowerCase();
      const originalTerm = searchTerm.trim();

      const usersRef = collection(db, "users");
      const qUsername = query(usersRef, orderBy("username"), startAt(normalizedTerm), endAt(normalizedTerm + "\uf8ff"), limit(20));
      const qEmail = query(usersRef, orderBy("email"), startAt(normalizedTerm), endAt(normalizedTerm + "\uf8ff"), limit(20));
      const qDisplayName = query(usersRef, orderBy("displayName"), startAt(originalTerm), endAt(originalTerm + "\uf8ff"), limit(20));

      const [snapUsername, snapEmail, snapDisplayName] = await Promise.all([
        getDocs(qUsername).catch(() => ({ docs: [] })),
        getDocs(qEmail).catch(() => ({ docs: [] })),
        getDocs(qDisplayName).catch(() => ({ docs: [] }))
      ]);

      const mergedDocsMap = new Map();
      const addDocsToMap = (snapshot) => {
        if (snapshot && snapshot.docs) {
          snapshot.docs.forEach(docSnap => {
            if (docSnap.id !== currentUserId) {
              mergedDocsMap.set(docSnap.id, docSnap);
            }
          });
        }
      };

      addDocsToMap(snapUsername);
      addDocsToMap(snapEmail);
      addDocsToMap(snapDisplayName);

      const results = [];
      const { friends, incomingRequests, outgoingRequests } = get();

      mergedDocsMap.forEach((docSnap) => {
        const data = docSnap.data();
        
        // Check friendship status
        const isFriend = friends.some(f => f.friendId === docSnap.id);
        const hasPendingIncoming = incomingRequests.some(r => r.senderId === docSnap.id);
        const hasPendingOutgoing = outgoingRequests.some(r => r.receiverId === docSnap.id);

        let relationshipStatus = "none";
        if (isFriend) relationshipStatus = "friend";
        else if (hasPendingIncoming) relationshipStatus = "incoming";
        else if (hasPendingOutgoing) relationshipStatus = "outgoing";

        results.push({
          uid: docSnap.id,
          displayName: data.displayName || "User",
          username: data.username || null,
          photoURL: data.photoURL || null,
          email: data.email || null,
          presence: data.presence || "offline",
          relationshipStatus,
        });
      });

      set({ searchResults: results.slice(0, 20), isSearching: false });
    } catch (error) {
      console.error("User search error:", error);
      set({ isSearching: false, searchResults: [] });
    }
  },

  clearSearch: () => set({ searchResults: [], isSearching: false }),

  /**
   * Send a friend request
   */
  sendFriendRequest: async (senderId, receiverId) => {
    try {
      // Check if friendship already exists
      const { friends, incomingRequests, outgoingRequests } = get();

      if (friends.some(f => f.friendId === receiverId)) {
        toast.info("Bu kullanıcı zaten arkadaşınız.");
        return { success: false };
      }

      if (outgoingRequests.some(r => r.receiverId === receiverId)) {
        toast.info("Arkadaşlık isteği zaten gönderildi.");
        return { success: false };
      }

      // If there's an incoming request from this user, auto-accept
      const existingIncoming = incomingRequests.find(r => r.senderId === receiverId);
      if (existingIncoming) {
        return await get().acceptRequest(existingIncoming.id);
      }

      // Check Firestore for existing friendship (any status)
      const existingQ = query(
        collection(db, "friendships"),
        where("senderId", "==", senderId),
        where("receiverId", "==", receiverId)
      );
      const existingSnap = await getDocs(existingQ);
      
      if (!existingSnap.empty) {
        toast.info("Bu kullanıcıyla zaten bir ilişki mevcut.");
        return { success: false };
      }

      // Check reverse direction too
      const reverseQ = query(
        collection(db, "friendships"),
        where("senderId", "==", receiverId),
        where("receiverId", "==", senderId)
      );
      const reverseSnap = await getDocs(reverseQ);
      
      if (!reverseSnap.empty) {
        toast.info("Bu kullanıcıyla zaten bir ilişki mevcut.");
        return { success: false };
      }

      await addDoc(collection(db, "friendships"), {
        senderId,
        receiverId,
        status: "pending",
        createdAt: serverTimestamp(),
      });

      // Play ping sound on success
      const volume = (useSettingsStore.getState().sfxVolume || 100) / 100;
      useSoundManagerStore.getState().play('discord-ping', volume);

      toast.success("Arkadaşlık isteği gönderildi!");
      return { success: true };
    } catch (error) {
      console.error("Send friend request error:", error);
      toast.error("Arkadaşlık isteği gönderilemedi.");
      return { success: false, error: error.message };
    }
  },

  /**
   * Accept a friend request
   */
  acceptRequest: async (friendshipId) => {
    try {
      await updateDoc(doc(db, "friendships", friendshipId), {
        status: "accepted",
        acceptedAt: serverTimestamp(),
      });
      toast.success("Arkadaşlık isteği kabul edildi!");
      return { success: true };
    } catch (error) {
      console.error("Accept request error:", error);
      toast.error("İstek kabul edilemedi.");
      return { success: false };
    }
  },

  /**
   * Reject/cancel a friend request
   */
  rejectRequest: async (friendshipId) => {
    try {
      await deleteDoc(doc(db, "friendships", friendshipId));
      toast.info("Arkadaşlık isteği reddedildi.");
      return { success: true };
    } catch (error) {
      console.error("Reject request error:", error);
      return { success: false };
    }
  },

  /**
   * Remove a friend
   */
  removeFriend: async (friendshipId) => {
    try {
      await deleteDoc(doc(db, "friendships", friendshipId));
      toast.info("Arkadaş silindi.");
      return { success: true };
    } catch (error) {
      console.error("Remove friend error:", error);
      return { success: false };
    }
  },

  /**
   * Block a user
   */
  blockUser: async (friendshipId) => {
    try {
      await updateDoc(doc(db, "friendships", friendshipId), {
        status: "blocked",
        blockedAt: serverTimestamp(),
      });
      toast.info("Kullanıcı engellendi.");
      return { success: true };
    } catch (error) {
      console.error("Block user error:", error);
      return { success: false };
    }
  },

  reset: () => {
    get().stopListeners();
    set({
      friends: [],
      incomingRequests: [],
      outgoingRequests: [],
      searchResults: [],
      isSearching: false,
      isLoading: false,
      error: null,
    });
  },
}));
