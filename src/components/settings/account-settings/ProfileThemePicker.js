import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Palette, Pipette, Zap, Check } from "lucide-react";
import { PRESET_GRADIENTS, SOLID_COLORS } from "../constants";

/**
 * ✅ ProfileThemePicker - Optimized color picker
 * Handles solid colors and gradients with debounced updates
 */
export default function ProfileThemePicker({ profileColor, setProfileColor }) {
  // Parse profile color helper
  const parseProfileColor = useCallback((color) => {
    if (!color)
      return {
        mode: "solid",
        solidColor: "#6366f1",
        start: "#6366f1",
        end: "#a855f7",
        angle: 135,
      };

    if (color.includes("gradient")) {
      const angleMatch = color.match(/(\d+)deg/);
      const colorMatches = color.match(/#[0-9a-fA-F]{6}/g);
      const angle = angleMatch ? parseInt(angleMatch[1]) : 135;
      const start = colorMatches?.[0] || "#6366f1";
      const end = colorMatches?.[1] || "#a855f7";
      return { mode: "gradient", solidColor: start, start, end, angle };
    } else {
      return {
        mode: "solid",
        solidColor: color,
        start: "#6366f1",
        end: "#a855f7",
        angle: 135,
      };
    }
  }, []);

  const parsed = useMemo(
    () => parseProfileColor(profileColor),
    [profileColor, parseProfileColor]
  );

  const [colorMode, setColorMode] = useState(parsed.mode);
  const [gradStart, setGradStart] = useState(parsed.start);
  const [gradEnd, setGradEnd] = useState(parsed.end);
  const [gradAngle, setGradAngle] = useState(parsed.angle);
  const [localSolidColor, setLocalSolidColor] = useState(parsed.solidColor);
  const isUpdatingFromStore = useRef(false);

  // Sync with profileColor changes
  useEffect(() => {
    if (isUpdatingFromStore.current) {
      isUpdatingFromStore.current = false;
      return;
    }

    const newParsed = parseProfileColor(profileColor);
    
    if (newParsed.mode !== colorMode) setColorMode(newParsed.mode);
    if (newParsed.start !== gradStart) setGradStart(newParsed.start);
    if (newParsed.end !== gradEnd) setGradEnd(newParsed.end);
    if (newParsed.angle !== gradAngle) setGradAngle(newParsed.angle);
    if (newParsed.solidColor !== localSolidColor) setLocalSolidColor(newParsed.solidColor);
  }, [profileColor, parseProfileColor, colorMode, gradStart, gradEnd, gradAngle, localSolidColor]);

  // Debounced gradient update (300ms)
  useEffect(() => {
    if (colorMode === "gradient") {
      const timer = setTimeout(() => {
        isUpdatingFromStore.current = true;
        setProfileColor(
          `linear-gradient(${gradAngle}deg, ${gradStart} 0%, ${gradEnd} 100%)`
        );
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [gradStart, gradEnd, gradAngle, colorMode, setProfileColor]);

  // Debounced solid color update (300ms)
  useEffect(() => {
    if (colorMode === "solid") {
      const timer = setTimeout(() => {
        isUpdatingFromStore.current = true;
        setProfileColor(localSolidColor);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [localSolidColor, colorMode, setProfileColor]);

  return (
    <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 mb-6 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>
      
      <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-4 flex items-center gap-2 relative z-10">
        <div className="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center">
          <Palette size={14} className="text-purple-400" />
        </div>
        Profil Teması
      </h4>
      
      <div className="relative z-10">
        {/* Mode Toggle */}
        <div className="flex gap-2 mb-4 bg-[#1e1f22] p-1.5 rounded-xl w-fit border border-white/5">
          <button
            onClick={() => {
              setColorMode("solid");
              if (profileColor.includes("gradient")) {
                const parsed = parseProfileColor(profileColor);
                setLocalSolidColor(parsed.solidColor);
                setProfileColor(parsed.solidColor);
              }
            }}
            onMouseDown={(e) => e.preventDefault()}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 flex items-center gap-2 focus:outline-none ${
              colorMode === "solid"
                ? "bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-white shadow border border-indigo-500/30"
                : "text-[#949ba4] hover:text-white hover:bg-white/5"
            }`}
          >
            <Pipette size={14} /> Düz Renk
          </button>
          <button
            onClick={() => {
              setColorMode("gradient");
              if (!profileColor.includes("gradient")) {
                const parsed = parseProfileColor(profileColor);
                setGradStart(parsed.solidColor);
                setProfileColor(
                  `linear-gradient(${gradAngle}deg, ${parsed.solidColor} 0%, ${gradEnd} 100%)`
                );
              }
            }}
            onMouseDown={(e) => e.preventDefault()}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 flex items-center gap-2 focus:outline-none ${
              colorMode === "gradient"
                ? "bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-white shadow border border-indigo-500/30"
                : "text-[#949ba4] hover:text-white hover:bg-white/5"
            }`}
          >
            <Zap size={14} /> Gradient
          </button>
        </div>
        
        {/* Solid Color Picker */}
        {colorMode === "solid" && (
          <div className="animate-in fade-in zoom-in-95 duration-200 bg-[#1e1f22] rounded-xl p-4 border border-white/5">
            <div className="flex flex-wrap gap-3">
              <label className="w-10 h-10 rounded-full bg-[#2b2d31] border-2 border-dashed border-[#4e5058] flex items-center justify-center cursor-pointer hover:border-indigo-500 transition group relative overflow-hidden">
                <input
                  type="color"
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  onChange={(e) => setLocalSolidColor(e.target.value)}
                  value={localSolidColor}
                />
                <Pipette
                  size={16}
                  className="text-[#949ba4] group-hover:text-indigo-400 transition-colors"
                />
              </label>
              {SOLID_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setProfileColor(color)}
                  onMouseDown={(e) => e.preventDefault()}
                  className={`w-10 h-10 rounded-full transition-all duration-200 relative focus:outline-none ${
                    profileColor === color
                      ? "ring-2 ring-white ring-offset-2 ring-offset-[#1e1f22] scale-110"
                      : "hover:scale-110"
                  }`}
                  style={{ backgroundColor: color }}
                >
                  {profileColor === color && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Check
                        size={16}
                        className="text-white drop-shadow-md"
                        strokeWidth={3}
                      />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* Gradient Picker */}
        {colorMode === "gradient" && (
          <div className="animate-in fade-in zoom-in-95 duration-200 bg-[#1e1f22] p-4 rounded-xl border border-white/5">
            <div className="flex items-center gap-4 mb-6">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-[#949ba4] uppercase">
                  Başlangıç
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={gradStart}
                    onChange={(e) => setGradStart(e.target.value)}
                    className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                  />
                  <span className="text-xs text-mono text-[#dbdee1]">
                    {gradStart}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-[#949ba4] uppercase">
                  Bitiş
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={gradEnd}
                    onChange={(e) => setGradEnd(e.target.value)}
                    className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                  />
                  <span className="text-xs text-mono text-[#dbdee1]">
                    {gradEnd}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-1 flex-1 ml-4">
                <span className="text-[10px] font-bold text-[#949ba4] uppercase">
                  Açı ({gradAngle}°)
                </span>
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={gradAngle}
                  onChange={(e) => setGradAngle(e.target.value)}
                  className="w-full h-2 bg-[#404249] rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>
            </div>
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-[#949ba4] uppercase">
                Hızlı Seçim
              </span>
              <div className="flex flex-wrap gap-3">
                {PRESET_GRADIENTS.map((grad, i) => (
                  <button
                    key={i}
                    onClick={() => setProfileColor(grad)}
                    onMouseDown={(e) => e.preventDefault()}
                    className={`w-12 h-12 rounded-lg transition-all duration-200 relative shadow-sm focus:outline-none ${
                      profileColor === grad
                        ? "ring-2 ring-white ring-offset-2 ring-offset-[#1e1f22]"
                        : "hover:scale-105"
                    }`}
                    style={{ background: grad }}
                  >
                    {profileColor === grad && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Check
                          size={20}
                          className="text-white drop-shadow-md"
                          strokeWidth={3}
                        />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
