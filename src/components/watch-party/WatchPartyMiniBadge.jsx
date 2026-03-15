// src/components/watch-party/WatchPartyMiniBadge.jsx
import React from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useWatchPartyStore } from '@/src/store/watchPartyStore';
import { Music } from 'lucide-react';

export function WatchPartyMiniBadge() {
  const isActive    = useWatchPartyStore((s) => s.isActive);
  const showPlayer  = useWatchPartyStore((s) => s.localPreferences.showPlayer);
  const togglePlayer = useWatchPartyStore((s) => s.togglePlayer);
  const currentTrack = useWatchPartyStore((s) => s.currentTrack);
  const isPlaying    = useWatchPartyStore((s) => s.playbackState.isPlaying);

  // Sadece party aktif AMA player gizliyken göster
  if (!isActive || showPlayer) return null;

  const content = (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={togglePlayer}
      className="fixed bottom-6 right-6 z-[100] w-12 h-12
                 bg-emerald-500 hover:bg-emerald-400
                 rounded-full shadow-xl shadow-emerald-500/30
                 flex items-center justify-center
                 transition-colors cursor-pointer pointer-events-auto"
      title={`${currentTrack?.title || 'Watch Party'} — Göster`}
    >
      <Music size={20} className="text-white" />
    </motion.button>
  );

  if (typeof window === "undefined") return null;
  return createPortal(content, document.body);
}
