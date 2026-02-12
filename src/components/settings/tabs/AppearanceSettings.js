import { useState, useRef, useEffect } from "react";
import { useSettingsStore } from "@/src/store/settingsStore";
import { getCommonFonts } from "@/src/utils/fontDetector";
import { Plus, Trash2, Clock, Smile } from "lucide-react";
import { toastOnce } from "@/src/utils/toast";
import EmojiPicker from "@/src/components/ui/EmojiPicker";

export default function AppearanceSettings() {
  const uiScale = useSettingsStore(state => state.uiScale);
  const fontSize = useSettingsStore(state => state.fontSize);
  const fontFamily = useSettingsStore(state => state.fontFamily);
  const setUIScale = useSettingsStore(state => state.setUIScale);
  const setFontSize = useSettingsStore(state => state.setFontSize);
  const setFontFamily = useSettingsStore(state => state.setFontFamily);
  
  // Quick Status Store
  const presets = useSettingsStore(state => state.quickStatusPresets);
  const updatePreset = useSettingsStore(state => state.updateQuickStatusPreset);
  const addPreset = useSettingsStore(state => state.addQuickStatusPreset);
  const removePreset = useSettingsStore(state => state.removeQuickStatusPreset);

  const [activeEmojiPicker, setActiveEmojiPicker] = useState(null); // 'p1', 'p2', etc.
  const pickerRef = useRef(null);
  const buttonRefs = useRef({}); // Store button refs to position the picker

  useEffect(() => {
    const handleClick = (e) => {
        if (pickerRef.current && !pickerRef.current.contains(e.target)) {
            setActiveEmojiPicker(null);
        }
    };
    if (activeEmojiPicker) {
        window.addEventListener("mousedown", handleClick);
    }
    return () => window.removeEventListener("mousedown", handleClick);
  }, [activeEmojiPicker]);

  // Calculate picker position based on the active button
  const getPickerStyle = () => {
      if (!activeEmojiPicker || !buttonRefs.current[activeEmojiPicker]) return {};
      const rect = buttonRefs.current[activeEmojiPicker].getBoundingClientRect();
      const pickerHeight = 320; // Approx height
      
      // Check if it fits below, otherwise show above
      const showAbove = (rect.bottom + pickerHeight) > window.innerHeight;
      
      return {
          position: 'fixed',
          top: showAbove ? (rect.top - pickerHeight - 8) : (rect.bottom + 8),
          left: rect.left,
          zIndex: 99999
      };
  };

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
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 pb-20">
      <h3 className="text-2xl font-bold text-white mb-6 relative px-1">
        <span className="relative z-10">Görünüm Ayarları</span>
      </h3>

      {/* 🚀 Hızlı Durum Mesajları Yönetimi */}
      <div className="glass-strong rounded-2xl border border-white/10 overflow-hidden p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
            <h4 className="text-xs font-bold text-[#949ba4] uppercase flex items-center gap-2">
                <Clock size={14} className="text-indigo-400" />
                Hızlı Durum Slotları
            </h4>
            <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#5c5e66] font-medium">{presets.length}/6 Slot</span>
                <span className="text-[10px] text-indigo-400/60 bg-indigo-500/5 px-2.5 py-1 rounded-full border border-indigo-500/10 font-bold">Özelleştirilebilir</span>
            </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
            {presets.map((preset, index) => (
                <div key={preset.id} className="relative">
                    <div className="flex items-center gap-3 bg-white/[0.02] border border-white/5 p-2 rounded-2xl group/preset hover:border-white/10 transition-all">
                        {/* Emoji Button */}
                        <button 
                            ref={el => buttonRefs.current[preset.id] = el}
                            onClick={() => setActiveEmojiPicker(activeEmojiPicker === preset.id ? null : preset.id)}
                            className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 transition-all text-2xl shadow-sm ${
                                activeEmojiPicker === preset.id 
                                ? "bg-indigo-500/20 border-indigo-500/50 scale-105 shadow-indigo-500/20" 
                                : "bg-white/5 border-white/5 hover:bg-white/10"
                            }`}
                        >
                            {preset.icon}
                        </button>
                        
                        {/* Label Input */}
                        <div className="flex-1">
                            <input 
                                type="text"
                                value={preset.label || ""}
                                onChange={(e) => updatePreset(preset.id, { label: e.target.value })}
                                placeholder="Mesajınızı yazın..."
                                className="w-full bg-transparent border-none px-2 py-2 text-sm text-white focus:outline-none font-medium placeholder:text-white/10"
                            />
                        </div>

                        {/* Delete Button (Show on Hover) */}
                        <button 
                            onClick={() => removePreset(preset.id)}
                            className="p-3 text-red-500/20 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all opacity-0 group-hover/preset:opacity-100"
                            title="Bu slotu sil"
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>
                </div>
            ))}

            {/* + Add Slot Button */}
            {presets.length < 6 && (
                <button 
                    onClick={() => addPreset()}
                    className="flex items-center justify-center gap-2 w-full py-4 border border-dashed border-white/10 rounded-2xl text-[#5c5e66] hover:text-white hover:border-white/20 hover:bg-white/[0.02] transition-all group/add"
                >
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover/add:bg-indigo-500 group-hover/add:text-white transition-colors">
                        <Plus size={16} />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wide">Yeni Slot Ekle</span>
                </button>
            )}
        </div>
        
        {/* Emoji Picker Portal (Fixed Position) */}
        {activeEmojiPicker && (
            <div 
                ref={pickerRef} 
                style={getPickerStyle()}
                className="w-[280px] drop-shadow-2xl animate-nds-scale-up origin-top-left"
            >
                <EmojiPicker 
                    onSelect={(emoji) => {
                        updatePreset(activeEmojiPicker, { icon: emoji });
                        setActiveEmojiPicker(null);
                    }}
                    onClose={() => setActiveEmojiPicker(null)}
                />
            </div>
        )}

        <p className="mt-6 text-[11px] text-[#5c5e66] leading-relaxed flex items-center gap-2 px-1">
            <Smile size={14} className="text-indigo-500/50" />
            İkonu değiştirmek için butona tıklayın, metni değiştirmek için yazıya tıklayın. En fazla 6 durum ekleyebilirsiniz.
        </p>
      </div>

      {/* Ölçeklendirme ve Font */}
      <div className="glass-strong rounded-2xl border border-white/10 overflow-hidden p-6 mb-8">
        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-5 flex items-center gap-2">
          <div className="w-1 h-3 bg-indigo-500 rounded-full" />
          Ölçeklendirme ve Font
        </h4>

        <div className="space-y-6">
            <div>
            <label className="block text-sm font-medium text-[#dbdee1] mb-2">
                UI Ölçeklendirme
            </label>
            <select
                value={uiScale}
                onChange={(e) => setUIScale(Number(e.target.value))}
                className="w-full bg-[#1e1f22] border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50 transition-all"
            >
                {scaleOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                    {opt.label}
                </option>
                ))}
            </select>
            </div>

            <div>
            <label className="block text-sm font-medium text-[#dbdee1] mb-2">
                Font Boyutu
            </label>
            <select
                value={fontSize}
                onChange={(e) => setFontSize(e.target.value)}
                className="w-full bg-[#1e1f22] border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50 transition-all"
            >
                {fontSizeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                    {opt.label} ({opt.size})
                </option>
                ))}
            </select>
            </div>

            <div>
            <label className="block text-sm font-medium text-[#dbdee1] mb-2">
                Font Ailesi
            </label>
            <select
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                className="w-full bg-[#1e1f22] border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50 transition-all"
            >
                {fontOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                    {opt.label}
                </option>
                ))}
            </select>
            </div>
        </div>
      </div>
    </div>
  );
}
