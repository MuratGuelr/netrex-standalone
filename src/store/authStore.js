import { create } from "zustand";
import { toast } from "sonner";
import {
  GoogleAuthProvider,
  signInWithCredential,
  signInAnonymously,
  onAuthStateChanged,
  signOut,
  deleteUser,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/src/lib/firebase"; // Added db

export const useAuthStore = create((set) => ({
  user: null,
  isAuth: false,
  isLoading: true,

  initializeAuth: () => {
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
        await updateProfile(result.user, { displayName: username });
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
        if (currentUser.isAnonymous) {
          // Anonim ise sil
          await deleteUser(currentUser);
        } else {
          // Google ise sadece çık
          await signOut(auth);
        }
      } catch (error) {
        console.error("Logout Error:", error);
        // Hata olsa bile çıkışı zorla
        await signOut(auth).catch(() => {});
      }
    }
    set({ user: null, isAuth: false });
  },
}));
