"use client";

import { useEffect } from "react";
import { useSettingsStore } from "@/src/store/settingsStore";

/**
 * Ayarları uygulayan global component
 * UI ölçeklendirme, font, tema gibi ayarları uygular
 */
export function SettingsApplier() {
  const { uiScale, fontSize, fontFamily } = useSettingsStore();

  useEffect(() => {
    // UI ölçeklendirme
    const root = document.documentElement;
    root.style.setProperty("--ui-scale", `${uiScale / 100}`);
    root.style.fontSize = `${uiScale / 100}rem`;

    // Font boyutu
    const fontSizeMap = {
      small: "14px",
      medium: "16px",
      large: "18px",
    };
    const baseFontSize = fontSizeMap[fontSize] || "16px";
    root.style.setProperty("--base-font-size", baseFontSize);
    // Tüm body'ye font boyutunu uygula
    document.body.style.fontSize = baseFontSize;

    // Font ailesi
    let fontFamilyValue;
    if (fontFamily === "system") {
      fontFamilyValue = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
    } else {
      // Font adını düzgün formata çevir (kebab-case'den Title Case'e)
      const fontName = fontFamily
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
      fontFamilyValue = `"${fontName}", -apple-system, BlinkMacSystemFont, sans-serif`;
    }
    root.style.setProperty("--font-family", fontFamilyValue);
    // Tüm body'ye font ailesini uygula
    document.body.style.fontFamily = fontFamilyValue;
  }, [uiScale, fontSize, fontFamily]);

  return null;
}

