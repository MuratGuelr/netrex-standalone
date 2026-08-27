import React, { memo } from 'react';
import { useCursorShareStore } from '@/src/store/cursorShareStore';
import { shallow } from 'zustand/shallow';

/**
 * 🖱️ Remote Cursor Overlay
 * 
 * Ekran paylaşımı görüntüsü üzerine bindirilir.
 * Gelen cursor pozisyonlarını normalize'den piksel'e çevirip
 * yarı saydam avatar cursor olarak gösterir.
 * 
 * Props:
 *   - containerRef: Video container'ın ref'i (boyut hesaplama)
 *   - videoWidth/videoHeight: Video elementinin gerçek boyutları
 */

// ──────────────────────────────────────
// CURSOR SIZES
// ──────────────────────────────────────
const CURSOR_SIZES = {
  sm: { cursor: 16, label: 9, offset: 18 },
  md: { cursor: 22, label: 10, offset: 24 },
  lg: { cursor: 30, label: 11, offset: 32 },
};

// ──────────────────────────────────────
// SINGLE CURSOR COMPONENT (Isolated Subscription)
// ──────────────────────────────────────
const RemoteCursorWrapper = memo(({ 
  participantId, containerWidth, containerHeight 
}) => {
  // ⚡ SADECE bu katılımcının verisini dinle. Diğerleri hareket ettiğinde bu component RE-RENDER OLMAZ.
  const cursor = useCursorShareStore(s => s.remoteCursors[participantId]);
  const cursorOpacity = useCursorShareStore(s => s.cursorOpacity);
  const cursorSize = useCursorShareStore(s => s.cursorSize);
  const cursorStyle = useCursorShareStore(s => s.cursorStyle);
  const showCursorLabel = useCursorShareStore(s => s.showCursorLabel);

  if (!cursor) return null;

  return (
    <RemoteCursor
      x={cursor.x}
      y={cursor.y}
      displayName={cursor.displayName}
      color={cursor.color}
      opacity={cursorOpacity}
      size={cursorSize}
      style={cursorStyle}
      showLabel={showCursorLabel}
      containerWidth={containerWidth}
      containerHeight={containerHeight}
    />
  );
});

const RemoteCursor = memo(({ 
  x, y, displayName, color, opacity, size, style, showLabel, containerWidth, containerHeight 
}) => {
  const sizeConfig = CURSOR_SIZES[size] || CURSOR_SIZES.md;
  
  // Normalize'den piksel'e çevir
  const pixelX = x * containerWidth;
  const pixelY = y * containerHeight;

  // Sınır kontrolü
  if (pixelX < 0 || pixelX > containerWidth || pixelY < 0 || pixelY > containerHeight) {
    return null;
  }

  const initial = (displayName || '?').charAt(0).toUpperCase();

  return (
    <div
      className="absolute pointer-events-none z-30 transition-all duration-75 ease-out"
      style={{
        left: pixelX,
        top: pixelY,
        opacity: opacity,
        transform: 'translate(-2px, -2px)',
      }}
    >
      {/* Cursor shape */}
      {style === 'dot' ? (
        // Dot cursor
        <div
          className="rounded-full shadow-lg"
          style={{
            width: sizeConfig.cursor * 0.6,
            height: sizeConfig.cursor * 0.6,
            backgroundColor: color,
            boxShadow: `0 0 ${sizeConfig.cursor * 0.4}px ${color}60, 0 2px 8px rgba(0,0,0,0.3)`,
          }}
        />
      ) : style === 'crosshair' ? (
        // Crosshair cursor
        <div className="relative" style={{ width: sizeConfig.cursor, height: sizeConfig.cursor }}>
          <div
            className="absolute top-1/2 left-0 w-full -translate-y-1/2"
            style={{ height: 2, backgroundColor: color, opacity: 0.9 }}
          />
          <div
            className="absolute top-0 left-1/2 h-full -translate-x-1/2"
            style={{ width: 2, backgroundColor: color, opacity: 0.9 }}
          />
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              width: 4, height: 4,
              backgroundColor: color,
              boxShadow: `0 0 6px ${color}80`,
            }}
          />
        </div>
      ) : (
        // Default arrow cursor
        <svg
          width={sizeConfig.cursor}
          height={sizeConfig.cursor}
          viewBox="0 0 24 24"
          fill="none"
          className="drop-shadow-lg"
          style={{ filter: `drop-shadow(0 2px 4px rgba(0,0,0,0.4)) drop-shadow(0 0 8px ${color}40)` }}
        >
          {/* Cursor gövdesi */}
          <path
            d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-5.07a.5.5 0 0 1 .36-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.85a.5.5 0 0 0-.85.36z"
            fill={color}
            stroke="white"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      )}

      {/* User label */}
      {showLabel && displayName && (
        <div
          className="absolute whitespace-nowrap rounded-md px-1.5 py-0.5 font-semibold shadow-lg border"
          style={{
            left: sizeConfig.offset,
            top: style === 'dot' ? -2 : sizeConfig.cursor * 0.5 - 2,
            fontSize: sizeConfig.label,
            backgroundColor: `${color}dd`,
            color: 'white',
            borderColor: `${color}40`,
            maxWidth: 120,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            textShadow: '0 1px 2px rgba(0,0,0,0.3)',
          }}
        >
          {displayName}
        </div>
      )}

      {/* Ripple efekti — tıklama sırasında (gelecek feature) */}
    </div>
  );
});
RemoteCursor.displayName = 'RemoteCursor';

// ──────────────────────────────────────
// CURSOR SETTINGS PANEL (mini)
// ──────────────────────────────────────
export const CursorSettingsPanel = memo(({ compact = false }) => {
  const showRemoteCursors = useCursorShareStore(s => s.showRemoteCursors);
  const cursorOpacity = useCursorShareStore(s => s.cursorOpacity);
  const cursorSize = useCursorShareStore(s => s.cursorSize);
  const cursorStyle = useCursorShareStore(s => s.cursorStyle);
  const showCursorLabel = useCursorShareStore(s => s.showCursorLabel);

  const setShowRemoteCursors = useCursorShareStore(s => s.setShowRemoteCursors);
  const setCursorOpacity = useCursorShareStore(s => s.setCursorOpacity);
  const setCursorSize = useCursorShareStore(s => s.setCursorSize);
  const setCursorStyle = useCursorShareStore(s => s.setCursorStyle);
  const setShowCursorLabel = useCursorShareStore(s => s.setShowCursorLabel);

  if (compact) {
    return (
      <button
        onClick={() => setShowRemoteCursors(!showRemoteCursors)}
        className={`p-1.5 rounded-lg transition-all text-[10px] font-medium ${
          showRemoteCursors
            ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
            : 'bg-white/5 text-white/40 border border-white/10 hover:text-white/60'
        }`}
        title={showRemoteCursors ? 'Cursor gösteriliyor' : 'Cursor gizli'}
      >
        🖱️
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-3 bg-[#111214]/95 backdrop-blur-xl border border-white/10 rounded-xl">
      <div className="text-[10px] uppercase tracking-widest text-white/30 font-bold">
        Cursor Ayarları
      </div>

      {/* Toggle */}
      <label className="flex items-center justify-between gap-2 cursor-pointer">
        <span className="text-[11px] text-white/70">Cursor'ları göster</span>
        <input
          type="checkbox"
          checked={showRemoteCursors}
          onChange={e => setShowRemoteCursors(e.target.checked)}
          className="w-4 h-4 accent-indigo-500 rounded"
        />
      </label>

      {/* Opaklık */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-white/50 w-14">Opaklık</span>
        <input
          type="range"
          min="10"
          max="100"
          step="5"
          value={cursorOpacity * 100}
          onChange={e => setCursorOpacity(parseInt(e.target.value) / 100)}
          className="flex-1 h-1 accent-indigo-500"
        />
        <span className="text-[10px] text-white/40 w-8 text-right">
          {Math.round(cursorOpacity * 100)}%
        </span>
      </div>

      {/* Boyut */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-white/50 w-14">Boyut</span>
        <div className="flex gap-1">
          {['sm', 'md', 'lg'].map(s => (
            <button
              key={s}
              onClick={() => setCursorSize(s)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                cursorSize === s
                  ? 'bg-indigo-500/30 text-indigo-300 border border-indigo-500/40'
                  : 'bg-white/5 text-white/40 border border-white/10 hover:text-white/60'
              }`}
            >
              {s === 'sm' ? 'Küçük' : s === 'md' ? 'Orta' : 'Büyük'}
            </button>
          ))}
        </div>
      </div>

      {/* Stil */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-white/50 w-14">Stil</span>
        <div className="flex gap-1">
          {[
            { value: 'default', label: '↗ Ok' },
            { value: 'dot', label: '● Nokta' },
            { value: 'crosshair', label: '+ Artı' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setCursorStyle(opt.value)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                cursorStyle === opt.value
                  ? 'bg-indigo-500/30 text-indigo-300 border border-indigo-500/40'
                  : 'bg-white/5 text-white/40 border border-white/10 hover:text-white/60'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* İsim etiketi */}
      <label className="flex items-center justify-between gap-2 cursor-pointer">
        <span className="text-[11px] text-white/70">İsim etiketi</span>
        <input
          type="checkbox"
          checked={showCursorLabel}
          onChange={e => setShowCursorLabel(e.target.checked)}
          className="w-4 h-4 accent-indigo-500 rounded"
        />
      </label>
    </div>
  );
});
CursorSettingsPanel.displayName = 'CursorSettingsPanel';

// ──────────────────────────────────────
// MAIN OVERLAY COMPONENT
// ──────────────────────────────────────
export default function CursorOverlay({ containerRef, sharerId }) {
  const showRemoteCursors = useCursorShareStore(s => s.showRemoteCursors);
  
  // ⚡ SADECE ID listesini dinle. 
  // Sharer'ın kendi imlecini de listeden çıkarıyoruz (çünkü videonun içinde zaten v5.4)
  const cursorIds = useCursorShareStore(
    s => Object.keys(s.remoteCursors).filter(id => {
      if (id === sharerId) return false;
      return s.remoteCursors[id]?.targetId === sharerId;
    }),
    shallow
  );

  if (!showRemoteCursors || cursorIds.length === 0) return null;

  // Container boyutlarını al
  const rect = containerRef?.current?.getBoundingClientRect();
  const containerWidth = rect?.width || 0;
  const containerHeight = rect?.height || 0;

  if (containerWidth === 0 || containerHeight === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
      {cursorIds.map((participantId) => (
        <RemoteCursorWrapper
          key={participantId}
          participantId={participantId}
          containerWidth={containerWidth}
          containerHeight={containerHeight}
        />
      ))}
    </div>
  );
}
