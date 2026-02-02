import { create } from "zustand";
import { toast } from "@/src/utils/toast";
import {
  GoogleAuthProvider,
  signInWithCredential,
  signInAnonymously,
  onAuthStateChanged,
  signOut,
  deleteUser,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/src/lib/firebase"; // Added db

import { useServerStore } from "@/src/store/serverStore";

export const useAuthStore = create((set) => ({
  user: null,
  isAuth: false,
  isLoading: true,

  initializeAuth: () => {
    // Listen for OAuth success from Electron (Google login)
    if (typeof window !== 'undefined' && window.netrex?.onOAuthSuccess) {
      window.netrex.onOAuthSuccess(async (token) => {
        console.log("OAuth token received, logging in...");
        try {
          const credential = GoogleAuthProvider.credential(token);
          await signInWithCredential(auth, credential);
          toast.success("Google ile giriş başarılı!");
        } catch (error) {
          console.error("OAuth login error:", error);
          toast.error("Google ile giriş başarısız: " + error.message);
        }
      });
    }

    return onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Sync user data to Firestore
        try {
          await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            displayName: user.displayName || "User",
            email: user.email,
            photoURL: user.photoURL,
            lastSeen: serverTimestamp()
          }, { merge: true });
        } catch (error) {
          console.error("Error syncing user to Firestore:", error);
        }

        set({ user, isAuth: true, isLoading: false });
      } else {
        set({ user: null, isAuth: false, isLoading: false });
      }
    });
  },

  // Electron'dan gelen token ile giriş
  loginWithGoogleToken: async (idToken) => {
    try {
      console.log("Token ile giriş yapılıyor...");
      const credential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(auth, credential);
    } catch (error) {
      console.error("Google Token Login Error:", error);
      toast.error("Giriş yapılamadı: " + error.message);
    }
  },

  loginAnonymously: async (username) => {
    try {
      const result = await signInAnonymously(auth);
      if (username) {
        // Önce Firebase Auth profile'ını güncelle
        await updateProfile(result.user, { displayName: username });
        
        // Sonra Firestore'a da manuel olarak kaydet (onAuthStateChanged'i bekleme)
        // Bu önemli çünkü onAuthStateChanged, updateProfile tamamlanmadan önce tetiklenebilir
        try {
          await setDoc(doc(db, "users", result.user.uid), {
            uid: result.user.uid,
            displayName: username, // Kullanıcının girdiği ismi kullan
            email: result.user.email,
            photoURL: result.user.photoURL,
            lastSeen: serverTimestamp()
          }, { merge: true });
        } catch (firestoreError) {
          console.error("Error saving anonymous user to Firestore:", firestoreError);
        }
      }
      // UI hemen güncellensin diye manuel set ediyoruz
      const user = { ...result.user, displayName: username };
      set({ user, isAuth: true });
    } catch (error) {
      console.error("Anon Signin Error:", error);
    }
  },

  logout: async () => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      try {
        const { servers } = useServerStore.getState();

        // 1. Anonim Kullanıcı İse: Tamamen Sil (Auth + Firestore)
        if (currentUser.isAnonymous) {
             // A. Sunucu üyeliklerini sil
             if (servers && servers.length > 0) {
                 const deletePromises = servers.map(server => 
                     deleteDoc(doc(db, 'servers', server.id, 'members', currentUser.uid))
                         .catch((err) => console.warn(`Failed to remove member from server ${server.id}:`, err))
                 );
                 await Promise.allSettled(deletePromises);
             }

             // B. Users koleksiyonundaki dökümanı sil
             try {
                await deleteDoc(doc(db, "users", currentUser.uid));
             } catch (err) {
                console.error("Failed to delete user doc:", err);
             }

             // C. Auth kullanıcısını sil
             await deleteUser(currentUser);
        } else {
            // 2. Normal Kullanıcı İse: Sadece Offline Yap ve Çık
            if (servers && servers.length > 0) {
                const updatePromises = servers.map(server => 
                    updateDoc(doc(db, 'servers', server.id, 'members', currentUser.uid), {
                        presence: 'offline',
                        lastSeen: serverTimestamp()
                    }).catch((err) => console.warn(`Failed to set offline on server ${server.id}:`, err))
                );
                await Promise.allSettled(updatePromises);
            }
            // Offline status update for users collection is handled by usePresence hook mostly, 
            // but explicitly setting it here too is good practice before signout
            try {
                await updateDoc(doc(db, 'users', currentUser.uid), {
                    presence: 'offline',
                    lastSeen: serverTimestamp()
                });
            } catch (e) {}

            await signOut(auth);
        }

      } catch (error) {
        console.error("Logout Error:", error);
        // Hata olsa bile çıkışı zorla
        await signOut(auth).catch(() => {});
      }
    }
    
    // Reset stores
    useServerStore.getState().reset();
    set({ user: null, isAuth: false });
  },
}));
