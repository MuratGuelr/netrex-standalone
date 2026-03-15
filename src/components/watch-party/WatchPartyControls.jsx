// src/components/watch-party/WatchPartyControls.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { useWatchPartyStore } from '@/src/store/watchPartyStore';
import {
  Play, Pause, SkipForward, SkipBack,
  ListMusic, Settings2, Monitor, MonitorOff,
  Users,
} from 'lucide-react';

export function WatchPartyControls({
  permissions,
  isPlaying,
  videoFS,
  hasVideo,
  onPlayPause,
  onSkipNext,
  onSkipPrev,
  onTogglePlaylist,
  onTogglePrefs,
  onToggleCoHost,
  activePanel,
}) {
  const toggleVideo = useWatchPartyStore((s) => s.toggleVideoMode);
  const videoMode   = useWatchPartyStore((s) => s.localPreferences.videoMode);

  const btn = `p-2 rounded-xl transition-all duration-200 hover:bg-white/[0.08]
               active:scale-90 relative flex-shrink-0`;
  const disabledBtn = `${btn} opacity-25 cursor-not-allowed hover:bg-transparent`;

  return (
    <div className={`flex items-center w-full relative ${videoFS ? 'justify-end' : 'justify-between'}`}>
      {permissions.canControl && (
        <div className={`flex items-center ${videoFS ? 'gap-3 absolute left-1/2 -translate-x-1/2 scale-125' : 'gap-0.5'}`}>
          {/* ── Geri ── */}
          <button
            onClick={onSkipPrev}
            className={btn}
            title="Önceki"
          >
            <SkipBack size={16} className="text-white/70" />
          </button>

          {/* ── Play / Pause ── */}
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={onPlayPause}
            className={`p-2.5 rounded-xl transition-all duration-200 flex-shrink-0
              bg-emerald-500 hover:bg-emerald-400 shadow-lg shadow-emerald-500/25
            `}
            title={isPlaying ? 'Duraklat' : 'Oynat'}
          >
            {isPlaying
              ? <Pause size={18} className="text-white" fill="white" />
              : <Play  size={18} className="text-white" fill="white" />
            }
          </motion.button>

          {/* ── İleri ── */}
          <button
            onClick={onSkipNext}
            className={btn}
            title="Sonraki"
          >
            <SkipForward size={16} className="text-white/70" />
          </button>
        </div>
      )}

      {!videoFS && permissions.canControl && <div className="w-px h-6 bg-white/[0.06] mx-1" />}

      <div className={`flex items-center gap-0.5 ${videoFS ? 'opacity-50 hover:opacity-100 transition-opacity' : ''}`}>
        {/* ── Video Modu Toggle ── */}
        {!videoFS && hasVideo && (
          <button
            onClick={toggleVideo}
            className={`${btn} ${videoMode ? 'bg-purple-500/20 text-purple-400' : ''}`}
            title="Video Modu"
          >
            {videoMode
              ? <Monitor size={16} className="text-purple-400" />
              : <MonitorOff size={16} className="text-white/50" />
            }
          </button>
        )}

        {/* ── Playlist ── */}
        <button
          onClick={onTogglePlaylist}
          className={`${btn} ${activePanel === 'playlist' ? 'bg-white/10 text-white' : 'text-white/70'}`}
          title="Çalma Listesi"
        >
          <ListMusic size={16} />
        </button>

        {/* ── Prefs ── */}
        <button
          onClick={onTogglePrefs}
          className={`${btn} ${activePanel === 'prefs' ? 'bg-white/10 text-white' : 'text-white/70'}`}
          title="Kişisel Ayarlar"
        >
          <Settings2 size={16} />
        </button>

        {/* ── CoHost ── */}
        {permissions.canManageCoHosts && (
          <button
            onClick={onToggleCoHost}
            className={`${btn} ${activePanel === 'cohost' ? 'bg-white/10 text-white' : 'text-white/70'}`}
            title="Co-Host Yönetimi"
          >
            <Users size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
