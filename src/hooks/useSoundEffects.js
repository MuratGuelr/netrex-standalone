import { useCallback } from "react";
import { useSettingsStore } from "@/src/store/settingsStore";

export function useSoundEffects() {
  const { sfxVolume } = useSettingsStore();

  const playSound = useCallback(
    (soundName) => {
      // Ses kapalıysa çalma
      if (sfxVolume === 0) return;

      try {
        const isFileProtocol =
          typeof window !== "undefined" && window.location.protocol === "file:";
        const soundPath = `${isFileProtocol ? "." : ""}/sounds/${soundName}.mp3`;
        const audio = new Audio(soundPath);
        // 0-100 arasını 0.0-1.0 arasına çevir
        audio.volume = sfxVolume / 100;
        audio.play().catch((e) => console.error("Ses çalma hatası:", e));
      } catch (error) {
        console.error("Ses dosyası bulunamadı:", error);
      }
    },
    [sfxVolume]
  );

  return { playSound };
}
