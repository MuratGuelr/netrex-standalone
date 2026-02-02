import { useCallback } from "react";
import { useSettingsStore } from "@/src/store/settingsStore";
import { useSoundManagerStore } from "@/src/store/soundManagerStore";

export function useSoundEffects() {
  const { sfxVolume } = useSettingsStore();
  const { play, init, isLoaded } = useSoundManagerStore();

  const playSound = useCallback(
    (soundName) => {
      // Ses kapalıysa çalma
      if (sfxVolume === 0) return;

      // Lazy init (Eğer henüz yüklenmediyse)
      if (!isLoaded) {
        init();
      }

      try {
        // 🚀 v5.3: RAM'den (AudioBuffer) anlık çalma
        // 0-100 arasını 0.0-1.0 arasına çevir
        play(soundName, sfxVolume / 100);
      } catch (error) {
        console.error("Ses çalma hatası:", error);
      }
    },
    [sfxVolume, play, init, isLoaded]
  );

  return { playSound };
}
