"use client";

/**
 * 🎮 useGameActivity - Oyun Algılama Hook
 * 
 * Electron'dan oyun durumu değişikliklerini dinler ve
 * Firebase'e sadece oyun BAŞLADIĞINDA ve BİTTİĞİNDE yazar.
 * 
 * Lokal kontrol: 5 saniyede bir (CPU/Memory friendly)
 * Firebase yazma: Sadece durum değişikliğinde
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuthStore } from "@/src/store/authStore";
import { useSettingsStore } from "@/src/store/settingsStore";
import { db } from "@/src/lib/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";

export function useGameActivity() {
  const { user } = useAuthStore();
  const [currentGame, setCurrentGame] = useState(null);
  const [isEnabled, setIsEnabled] = useState(true);
  const lastSavedGameRef = useRef(null);

  // Firebase'e oyun durumunu kaydet (sadece değişiklik olduğunda)
  const saveGameToFirebase = useCallback(async (game) => {
    if (!user?.uid) return;
    
    // Kullanıcı durumu "offline" veya "invisible" ise oyun bilgisini GİZLE
    const { userStatus } = useSettingsStore.getState();
    if (userStatus === 'offline' || userStatus === 'invisible') {
      console.log('🕵️ Kullanıcı gizli modda, oyun bilgisi gönderilmiyor.');
      // Eğer oyun varsa bile null gönderip temizle
      if (game) {
         // Ancak burada dikkat: Eğer zaten null ise (oyun bittiyse) yine göndermeliyiz.
         // Mantık: Gizliyken oyun açarsa -> gönderme (zaten null).
         // Gizliyken oyun kapatırsa -> gönderme (zaten null).
         // Eğer önceden oyun açıksa ve gizliye geçerse -> usePresence bunu temizlemeli.
         return; 
      }
    }
    
    // Aynı oyunu tekrar kaydetme
    const currentGameName = game?.name || null;
    const lastGameName = lastSavedGameRef.current;
    
    if (currentGameName === lastGameName) {
      return; // Değişiklik yok, Firebase'e yazma
    }
    
    lastSavedGameRef.current = currentGameName;
    
    try {
      const updateData = {
        gameActivity: game ? {
          name: game.name,
          icon: game.icon,
          iconUrl: game.iconUrl,
          startedAt: serverTimestamp(),
        } : null,
        updatedAt: serverTimestamp(),
      };
      
      await updateDoc(doc(db, "users", user.uid), updateData);
      console.log("🎮 Firebase güncellendi:", game ? game.name : "Oyun bitti");
    } catch (error) {
      console.error("🎮 Firebase oyun durumu hatası:", error);
    }
  }, [user?.uid]);

  // Oyun durumu değişikliği handler'ı
  const handleGameChange = useCallback((game) => {
    console.log("🎮 Oyun durumu değişti:", game);
    setCurrentGame(game);
    
    if (isEnabled) {
      saveGameToFirebase(game);
    }
  }, [isEnabled, saveGameToFirebase]);

  // Kullanıcı durumu değiştiğinde (Örn: Offline -> Online) oyun bilgisini tekrar senkronize et
  const userStatus = useSettingsStore(state => state.userStatus);
  useEffect(() => {
    if (!user?.uid || !currentGame) return;

    // Eğer kullanıcı görünür moda geçtiyse ve bir oyun oynuyorsa
    if (userStatus !== 'offline' && userStatus !== 'invisible') {
      console.log("🔄 Kullanıcı online oldu, mevcut oyun senkronize ediliyor:", currentGame.name);
      
      // Kayıtlı referansı temizle ki tekrar yazabilsin
      lastSavedGameRef.current = null; 
      
      // Oyunu tekrar kaydet
      saveGameToFirebase(currentGame);
    }
  }, [userStatus, user?.uid, currentGame, saveGameToFirebase]);

  // Electron'dan oyun değişikliklerini dinle
  useEffect(() => {
    if (typeof window === "undefined" || !window.netrex) return;

    // İlk oyun durumunu al
    const fetchInitialGame = async () => {
      try {
        const game = await window.netrex.getCurrentGame();
        if (game) {
          handleGameChange(game);
        }
      } catch (error) {
        console.error("🎮 İlk oyun durumu alınamadı:", error);
      }
    };

    fetchInitialGame();

    // Oyun değişikliklerini dinle
    window.netrex.onGameActivityChanged(handleGameChange);

    // Cleanup
    return () => {
      if (window.netrex?.removeListener) {
        window.netrex.removeListener("game-activity-changed");
      }
    };
  }, [handleGameChange]);

  // Kullanıcı çıkış yaptığında oyun durumunu temizle
  useEffect(() => {
    if (!user?.uid) {
      setCurrentGame(null);
      lastSavedGameRef.current = null;
    }
  }, [user?.uid]);

  // Oyun durumunu toggle et (ayarlardan kapatılabilir)
  const toggleGameDetection = useCallback(async (enabled) => {
    setIsEnabled(enabled);
    
    if (!enabled && currentGame) {
      // Kapatıldıysa mevcut oyunu Firebase'den temizle
      saveGameToFirebase(null);
    }
  }, [currentGame, saveGameToFirebase]);

  return {
    currentGame,
    isEnabled,
    toggleGameDetection,
  };
}

export default useGameActivity;
