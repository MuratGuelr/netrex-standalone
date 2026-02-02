import { useSettingsStore } from "@/src/store/settingsStore";
import { getCommonFonts } from "@/src/utils/fontDetector";

export default function AppearanceSettings() {
  const {
    uiScale,
    fontSize,
    fontFamily,
    setUIScale,
    setFontSize,
    setFontFamily,
    accentColor,
    setAccentColor,
  } = useSettingsStore();

  const fontOptions = getCommonFonts();

  const fontSizeOptions = [
    { value: "small", label: "Küçük", size: "14px" },
    { value: "medium", label: "Orta", size: "16px" },
    { value: "large", label: "Büyük", size: "18px" },
  ];

  const scaleOptions = [
    { value: 75, label: "Küçük (75%)" },
    { value: 100, label: "Normal (100%)" },
    { value: 125, label: "Büyük (125%)" },
    { value: 150, label: "Çok Büyük (150%)" },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <h3 className="text-2xl font-bold text-white mb-6 relative">
        <span className="relative z-10">Görünüm Ayarları</span>
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 opacity-0 hover:opacity-100 transition-opacity duration-300 blur-sm"></div>
      </h3>

      <div className="bg-[#2b2d31] rounded-lg border border-[#1f2023] overflow-hidden p-4 mb-4">
        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-4">
          Ölçeklendirme ve Font
        </h4>

        <div className="mb-4">
          <label className="block text-sm font-medium text-[#dbdee1] mb-2">
            UI Ölçeklendirme
          </label>
          <select
            value={uiScale}
            onChange={(e) => setUIScale(Number(e.target.value))}
            className="w-full bg-[#1e1f22] border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-300 relative z-10"
          >
            {scaleOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-[#949ba4] mt-1">
            Arayüzün genel boyutunu ayarlar.
          </p>
        </div>

        <div className="h-px bg-white/10 my-3 relative z-10"></div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-[#dbdee1] mb-2">
            Font Boyutu
          </label>
          <select
            value={fontSize}
            onChange={(e) => setFontSize(e.target.value)}
            className="w-full bg-[#1e1f22] border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-300 relative z-10"
          >
            {fontSizeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label} ({opt.size})
              </option>
            ))}
          </select>
          <p className="text-xs text-[#949ba4] mt-1">Metin boyutunu ayarlar.</p>
        </div>

        <div className="h-px bg-white/10 my-3 relative z-10"></div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-[#dbdee1] mb-2">
            Font Ailesi
          </label>
          <select
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
            className="w-full bg-[#1e1f22] border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-300 relative z-10"
          >
            {fontOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-[#949ba4] mt-1">
            Uygulama genelinde kullanılacak font ailesini seçin.
          </p>
        </div>
      </div>
    </div>
  );
}
