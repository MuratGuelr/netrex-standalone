// src/components/watch-party/WatchPartyUserPrefs.jsx
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWatchPartyStore } from '@/src/store/watchPartyStore';
import {
  Volume2, VolumeX, Headphones,
  Eye, EyeOff, Maximize, Minimize, X, EyeOff as EyeOffIcon,
  ChevronDown, Check
} from 'lucide-react';

const QUALITY_OPTIONS = [
  { value: 'auto', label: 'Otomatik (Önerilen)' },
  { value: 'highres', label: 'Maksimum (4K/2K)' },
  { value: 'hd1080', label: '1080p' },
  { value: 'hd720', label: '720p' },
  { value: 'large', label: '480p' },
  { value: 'medium', label: '360p' },
  { value: 'small', label: '240p' },
  { value: 'tiny', label: '144p' },
];

export function WatchPartyUserPrefs({ onClose, videoFS }) {
  const prefs         = useWatchPartyStore((s) => s.localPreferences);
  const currentTrack  = useWatchPartyStore((s) => s.currentTrack);
  const setLocalPref  = useWatchPartyStore((s) => s.setLocalPref);
  const toggleListen  = useWatchPartyStore((s) => s.toggleListening);
  const toggleMute    = useWatchPartyStore((s) => s.toggleMute);
  const toggleVideo   = useWatchPartyStore((s) => s.toggleVideoMode);
  const toggleFS      = useWatchPartyStore((s) => s.toggleFullscreen);
  const togglePlayer  = useWatchPartyStore((s) => s.togglePlayer);

  const [isQualityOpen, setIsQualityOpen] = useState(false);
  const qMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (qMenuRef.current && !qMenuRef.current.contains(e.target)) {
        setIsQualityOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentQuality = QUALITY_OPTIONS.find(o => o.value === (prefs.videoQuality || 'auto')) || QUALITY_OPTIONS[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.95 }}
      className={`absolute ${videoFS ? 'bottom-28 right-12 w-[360px]' : 'top-[calc(100%+8px)] right-0 w-full'}
                 bg-zinc-900/80 backdrop-blur-2xl rounded-2xl
                 border border-white/[0.08] shadow-2xl z-[150]`}
    >
      <div className="flex items-center justify-between px-4 py-3
                      border-b border-white/[0.04]">
        <h3 className="text-sm font-semibold text-white">🎧 Kişisel Ayarlar</h3>
        <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition-all">
          <X size={14} className="text-white/40" />
        </button>
      </div>

      <div className="p-4 space-y-5">

        {/* ═══ DİNLEME ═══ */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Headphones size={18} className={prefs.isListening ? 'text-emerald-400' : 'text-white/30'} />
            <div>
              <p className="text-sm text-white font-medium">Müziği Dinle</p>
              <p className="text-[11px] text-white/30">
                {prefs.isListening ? 'Müzik sende de çalıyor' : 'Müzik kapalı — sadece UI görürsün'}
              </p>
            </div>
          </div>
          <button onClick={toggleListen}
            className={`w-11 h-6 rounded-full transition-all duration-300 relative
              ${prefs.isListening ? 'bg-emerald-500' : 'bg-white/10'}`}>
            <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all duration-300 shadow-md
              ${prefs.isListening ? 'left-6' : 'left-1'}`} />
          </button>
        </div>

        {/* ═══ SES SEVİYESİ ═══ */}
        <div className={`space-y-2 transition-opacity ${!prefs.isListening ? 'opacity-30 pointer-events-none' : ''}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <button onClick={toggleMute}>
                {prefs.isMuted
                  ? <VolumeX size={18} className="text-red-400" />
                  : <Volume2 size={18} className="text-white/70" />}
              </button>
              <p className="text-sm text-white">Ses Seviyesi</p>
            </div>
            <span className="text-xs text-white/40 tabular-nums font-mono">
              {prefs.isMuted ? 'MUTE' : `${prefs.volume}%`}
            </span>
          </div>
          <input type="range" min={0} max={100}
            value={prefs.isMuted ? 0 : prefs.volume}
            onChange={(e) => setLocalPref('volume', parseInt(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none bg-white/[0.06]
                       accent-emerald-400 cursor-pointer
                       [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
                       [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-400
                       [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:shadow-md"
            style={{
              background: `linear-gradient(to right,
                rgb(52 211 153) ${prefs.isMuted ? 0 : prefs.volume}%,
                rgba(255,255,255,0.04) ${prefs.isMuted ? 0 : prefs.volume}%)`
            }}
          />
        </div>

        <div className="h-px bg-white/[0.04]" />

        {/* ═══ VİDEO MODU ═══ */}
        {currentTrack && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {prefs.videoMode
                ? <Eye size={18} className="text-purple-400" />
                : <EyeOff size={18} className="text-white/30" />}
              <div>
                <p className="text-sm text-white font-medium">Video Modu</p>
                <p className="text-[11px] text-white/30">Videoyu player'da göster</p>
              </div>
            </div>
            <button onClick={toggleVideo}
              className={`w-11 h-6 rounded-full transition-all duration-300 relative
                ${prefs.videoMode ? 'bg-purple-500' : 'bg-white/10'}`}>
              <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all duration-300 shadow-md
                ${prefs.videoMode ? 'left-6' : 'left-1'}`} />
            </button>
          </div>
        )}

        {/* ═══ VİDEO KALİTESİ ═══ */}
        {currentTrack && prefs.videoMode && (
          <div className="flex items-center justify-between pl-7 pb-2 animate-in fade-in zoom-in duration-300 relative z-[200]" ref={qMenuRef}>
            <p className="text-xs text-white/60">YouTube Kalitesi</p>
            
            <button
              onClick={() => setIsQualityOpen(!isQualityOpen)}
              className="flex items-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white/90 text-xs rounded-lg px-3 py-1.5 outline-none transition-colors"
            >
              <span className="truncate max-w-[120px] font-medium">{currentQuality?.label}</span>
              <ChevronDown size={14} className={`text-white/50 transition-transform duration-300 ${isQualityOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {isQualityOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="absolute right-0 bottom-full mb-2 w-48 bg-zinc-800/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl py-1 z-[999] max-h-56 overflow-y-auto"
                >
                  {QUALITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setLocalPref('videoQuality', opt.value);
                        setIsQualityOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 text-left text-xs hover:bg-white/10 transition-colors"
                    >
                      <span className={opt.value === prefs.videoQuality || (opt.value === 'auto' && !prefs.videoQuality) ? 'text-emerald-400 font-medium' : 'text-white/80'}>
                        {opt.label}
                      </span>
                      {(opt.value === prefs.videoQuality || (opt.value === 'auto' && !prefs.videoQuality)) && (
                        <Check size={14} className="text-emerald-400" />
                      )}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}