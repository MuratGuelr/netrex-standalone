"use client";

/**
 * 🎮 useGameActivity - Oyun Algılama Hook
 * 
 * ⚠️ DEVRE DIŞI: Oyun algılama sistemi kaldırıldı
 * CPU ve RAM tasarrufu için devre dışı bırakıldı.
 * Hook uyumluluk için korunuyor ama hiçbir şey yapmıyor.
 */

import { useState, useCallback } from "react";

export function useGameActivity() {
  const [currentGame] = useState(null);
  const [isEnabled, setIsEnabled] = useState(false);

  // Oyun durumunu toggle et (artık hiçbir şey yapmıyor)
  const toggleGameDetection = useCallback(async (enabled) => {
    setIsEnabled(enabled);
  }, []);

  return {
    currentGame: null, // Her zaman null
    isEnabled,
    toggleGameDetection,
  };
}

export default useGameActivity;
