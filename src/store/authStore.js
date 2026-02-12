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
          // Firestore'a yazmayı dene
          await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            displayName: user.displayName || "User",
            email: user.email,
            photoURL: user.photoURL,
            lastSeen: serverTimestamp()
          }, { merge: true });
          
          // Yazma başarılı, state'i güncelle
          set({ user, isAuth: true, isLoading: false });
        } catch (error) {
          console.error("Error syncing user to Firestore (User might be deleted):", error);
          // Eğer Firestore'a yazamıyorsak (muhtemelen kullanıcı silindi), çıkış yap
          await signOut(auth).catch(() => {});
          set({ user: null, isAuth: false, isLoading: false });
          if (typeof window !== 'undefined') {
             // Kullanıcıya bilgi ver ve login'e at
             toast.error("Oturum süresi doldu veya kullanıcı silindi. Lütfen tekrar giriş yapın.");
             // window.location.href = "/"; // Gerekirse
          }
        }
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
            displayName: username, 
            email: result.user.email,
            photoURL: result.user.photoURL,
            lastSeen: serverTimestamp()
          }, { merge: true });
          
          // UI güncelle (Sadece başarı durumunda)
          const user = { ...result.user, displayName: username };
          set({ user, isAuth: true });
        } catch (firestoreError) {
          console.error("Error saving anonymous user to Firestore:", firestoreError);
          toast.error("Kullanıcı oluşturulamadı. Lütfen tekrar deneyin.");
          // Temizlik: Auth kullanıcısını sil
          await deleteUser(result.user).catch(() => {});
          return; // İşlemi durdur
        }
      } else {
         // Username yoksa bile auth başarılıysa set et (Bu durum pek olmaz ama)
         set({ user: result.user, isAuth: true });
      }
    } catch (error) {
      console.error("Anon Signin Error:", error);
    }
  },

  logout: async () => {
    try {
      // 0. Modalları kapat (UI crash önlemek için)
      try {
        const { useSettingsStore } = require("./settingsStore");
        useSettingsStore.getState().setSettingsOpen(false);
      } catch (e) { 
        console.warn("Settings modal kapatılamadı:", e); 
      }

      const currentUser = auth.currentUser;
      
      if (currentUser) {
        const { servers } = useServerStore.getState();
        console.log(`Logout işlemi başladı. User: ${currentUser.uid}, Anonim: ${currentUser.isAnonymous}`);

        // 1. Anonim Kullanıcı İse: Tamamen Sil
        if (currentUser.isAnonymous) {
             // A. Sunucu üyeliklerini sil (Hata olursa devam et)
             if (servers && servers.length > 0) {
                 console.log("Sunucu üyelikleri siliniyor...");
                 const deletePromises = servers.map(server => 
                     deleteDoc(doc(db, 'servers', server.id, 'members', currentUser.uid))
                         .catch((err) => console.warn(`Üyelik silme hatası (${server.id}):`, err))
                 );
                 await Promise.allSettled(deletePromises);
             }

             // B. Users koleksiyonundaki dökümanı sil (Hata olursa devam et)
             try {
                await deleteDoc(doc(db, "users", currentUser.uid));
                console.log("Firestore kullanıcı dökümanı silindi.");
             } catch (err) {
                console.warn("Kullanıcı dökümanı silinemedi:", err);
             }

             // C. Auth kullanıcısını sil (En kritik adım)
             console.log("Auth kullanıcısı siliniyor...");
             try {
               await deleteUser(currentUser);
               console.log("Auth kullanıcısı başarıyla silindi.");
             } catch (err) {
               console.error("Auth kullanıcısı silinemedi (Yetki/Token sorunu olabilir):", err);
               // Silinemiyorsa en azından çıkış yap
               await signOut(auth).catch(() => {});
             }
        } else {
            // 2. Normal Kullanıcı
            try {
              if (servers && servers.length > 0) {
                  const updatePromises = servers.map(server => 
                      updateDoc(doc(db, 'servers', server.id, 'members', currentUser.uid), {
                          presence: 'offline',
                          lastSeen: serverTimestamp()
                      }).catch(() => {})
                  );
                  await Promise.allSettled(updatePromises);
              }
              
              await updateDoc(doc(db, 'users', currentUser.uid), {
                  presence: 'offline',
                  lastSeen: serverTimestamp()
              }).catch(() => {});
            } catch (e) {
              console.warn("Offline durumu ayarlanamadı:", e);
            }

            await signOut(auth);
        }
      }
    } catch (error) {
      console.error("Logout Genel Hatası:", error);
      await signOut(auth).catch(() => {});
    } finally {
      // Store reset
      try {
        useServerStore.getState().reset();
        set({ user: null, isAuth: false });
      } catch (e) {
        console.warn("Store reset hatası:", e);
      }
    }
  },
}));
