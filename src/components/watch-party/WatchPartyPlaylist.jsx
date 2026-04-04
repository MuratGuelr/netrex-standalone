// src/components/watch-party/WatchPartyPlaylist.jsx
'use client';

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import ReactPlayer from 'react-player';
import { useWatchPartyStore } from '@/src/store/watchPartyStore';
import { useWatchPartyVote } from '@/src/hooks/useWatchPartyVote';
import { useAuthStore } from '@/src/store/authStore';
import {
  addTrackToPlaylist,
  removeTrackFromPlaylist,
  clearCurrentTrackInDb,
} from '@/src/services/watchPartyService';
import {
  Plus, Trash2, Play, Link, Loader2,
  ThumbsUp, ThumbsDown, X, Music, ListMusic,
} from 'lucide-react';

export function WatchPartyPlaylist({
  serverId, channelId, permissions,
  onPlayTrack, onClose, videoFS,
}) {
  const currentTrack = useWatchPartyStore((s) => s.currentTrack);
  const playlist     = useWatchPartyStore((s) => s.playlist);
  const currentUser  = useAuthStore((s) => s.user);

  const { toggleUpvote, toggleDownvote, getScore, getMyVote } =
    useWatchPartyVote(serverId, channelId);

  const [inputUrl, setInputUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError]       = useState('');

  // ─── Skor'a göre sırala (store'daki getSortedPlaylist kullan) ───
  const sortedPlaylist = useWatchPartyStore((s) => s.getSortedPlaylist());

  // ─── Parça Ekle ───
  const handleAdd = useCallback(async () => {
    let finalUrl = inputUrl.trim();
    if (!finalUrl || !permissions.canManageTracks) return;

    setError('');

    // Shorts → normal URL
    if (finalUrl.includes('youtube.com/shorts/')) {
      finalUrl = finalUrl.replace('youtube.com/shorts/', 'youtube.com/watch?v=');
    }

    const isSoundcloud = finalUrl.includes('soundcloud.com/');
    const isYouTube    = finalUrl.includes('youtube.com/') || finalUrl.includes('youtu.be/');

    // SoundCloud playlist kontrolü
    if (isSoundcloud && finalUrl.includes('/sets/')) {
      setError('SoundCloud playlist desteklenmiyor. Tek parça linki girin.');
      return;
    }

    // SoundCloud query string temizle
    if (isSoundcloud && finalUrl.includes('?')) {
      finalUrl = finalUrl.split('?')[0];
    }

    // YouTube playlist parametrelerini temizle
    if (isYouTube) {
      try {
        const urlObj = new URL(finalUrl);
        const hasVideoId  = urlObj.searchParams.get('v');
        const hasPlaylist = urlObj.searchParams.get('list');

        if (!hasVideoId && hasPlaylist) {
          setError('YouTube playlist desteklenmiyor. Tek video linki girin.');
          return;
        }
        if (hasVideoId && hasPlaylist) {
          urlObj.searchParams.delete('list');
          urlObj.searchParams.delete('index');
          urlObj.searchParams.delete('start_radio');
          finalUrl = urlObj.toString();
        }
      } catch {
        setError('Geçersiz URL formatı.');
        return;
      }
    }

    // ReactPlayer desteği kontrolü (SoundCloud hariç)
    if (!isSoundcloud && !ReactPlayer.canPlay(finalUrl)) {
      setError('Bu link desteklenmiyor. YouTube, SoundCloud, Vimeo vb. deneyin.');
      return;
    }

    setIsAdding(true);

    try {
      let title     = finalUrl;
      let thumbnail = '';

      // YouTube meta
      const ytMatch = finalUrl.match(
        /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([^&?\s#/]+)/
      );
      if (ytMatch) {
        thumbnail = `https://img.youtube.com/vi/${ytMatch[1]}/mqdefault.jpg`;
        try {
          const res  = await fetch(
            `https://www.youtube.com/oembed?url=${encodeURIComponent(finalUrl)}&format=json`
          );
          const data = await res.json();
          if (data.title)         title     = data.title;
          if (data.thumbnail_url) thumbnail = data.thumbnail_url;
        } catch {
          try {
            const res  = await fetch(
              `https://noembed.com/embed?url=${encodeURIComponent(finalUrl)}`
            );
            const data = await res.json();
            if (data.title)         title     = data.title;
            if (data.thumbnail_url) thumbnail = data.thumbnail_url;
          } catch {}
        }
      }

      // SoundCloud meta
      else if (isSoundcloud) {
        try {
          const res  = await fetch(
            `https://soundcloud.com/oembed?url=${encodeURIComponent(finalUrl)}&format=json`
          );
          const data = await res.json();
          if (data.title)         title     = data.title;
          if (data.thumbnail_url) thumbnail = data.thumbnail_url;
          // Gerçek track URL'ini çek
          if (data.html) {
            const m = data.html.match(/url=([^&"'>]+)/);
            if (m?.[1]) finalUrl = decodeURIComponent(m[1]);
          }
        } catch {}
      }

      // Diğerleri
      else {
        try {
          const res  = await fetch(
            `https://noembed.com/embed?url=${encodeURIComponent(finalUrl)}`
          );
          const data = await res.json();
          if (data.title)         title     = data.title;
          if (data.thumbnail_url) thumbnail = data.thumbnail_url;
        } catch {}
      }

      await addTrackToPlaylist(serverId, channelId, {
        url:         finalUrl,
        title,
        thumbnail,
        duration:    0,
        addedBy:     currentUser?.uid || '',
        addedByName: currentUser?.displayName || 'Bilinmeyen',
      });

      setInputUrl('');
    } catch (err) {
      console.error('[WatchPartyPlaylist] Ekleme hatası:', err);
      setError('Eklenirken hata oluştu.');
    } finally {
      setIsAdding(false);
    }
  }, [inputUrl, serverId, channelId, permissions, currentUser]);

  // ─── Animasyon varyantları ───
  const variants = videoFS
    ? {
        initial: { opacity: 0, y: 10, scale: 0.95 },
        animate: { opacity: 1, y: 0,  scale: 1 },
        exit:    { opacity: 0, y: 10, scale: 0.95 },
      }
    : {
        initial: { width: 0, opacity: 0 },
        animate: { width: 400, opacity: 1 },
        exit:    { width: 0, opacity: 0 },
      };

  return (
    <motion.div
      {...variants}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className={
        videoFS
          ? `absolute bottom-36 right-12 w-[400px] h-[calc(100vh-200px)] flex flex-col
             bg-zinc-900/95 backdrop-blur-3xl rounded-3xl border border-white/10
             shadow-2xl z-[160] overflow-hidden`
          : `overflow-hidden border border-white/10 bg-zinc-900/95 backdrop-blur-3xl
             flex flex-col shrink-0 z-[150] h-[370px] rounded-2xl shadow-2xl`
      }
      style={videoFS ? {} : { width: 400 }}
    >
      {/* ── Başlık ── */}
      <div className="flex items-center justify-between px-5 py-4
                      border-b border-white/5 bg-white/5 shrink-0">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <ListMusic size={16} className="text-emerald-400" />
          Çalma Listesi
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/40 bg-white/5 px-2 py-0.5 rounded-lg">
            {playlist.length} parça
          </span>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-full transition-all text-white/50 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ── URL Ekleme ── */}
      {permissions.canManageTracks ? (
        <div className="px-4 py-3 border-b border-white/5 bg-black/20 shrink-0">
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2.5
                            border border-white/5 focus-within:border-emerald-500/40
                            focus-within:bg-white/8 transition-all">
              <Link size={14} className="text-white/30 shrink-0" />
              <input
                type="text"
                placeholder="YouTube veya SoundCloud linki..."
                value={inputUrl}
                onChange={(e) => { setInputUrl(e.target.value); setError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                className="flex-1 bg-transparent text-sm text-white outline-none
                           placeholder:text-white/25"
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={isAdding || !inputUrl.trim()}
              className="px-3 py-2.5 bg-emerald-500 hover:bg-emerald-400 rounded-xl
                         transition-all disabled:opacity-30 disabled:cursor-not-allowed
                         active:scale-95 shadow-lg shadow-emerald-500/20"
            >
              {isAdding
                ? <Loader2 size={16} className="text-white animate-spin" />
                : <Plus size={16} className="text-white" />
              }
            </button>
          </div>
          {error && (
            <p className="text-[11px] text-red-400 mt-1.5 ml-1">{error}</p>
          )}
        </div>
      ) : (
        <div className="px-4 py-2.5 border-b border-white/5 bg-black/20 shrink-0">
          <p className="text-xs text-white/35 text-center">
            Parça eklemek için yetki gerekli
          </p>
        </div>
      )}

      {/* ── Liste ── */}
      <div className="flex-1 overflow-y-auto overscroll-contain p-2 min-h-0">
        {sortedPlaylist.length === 0 ? (
          <div className="py-14 flex flex-col items-center justify-center text-white/20">
            <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mb-3">
              <Music size={22} className="opacity-50" />
            </div>
            <p className="text-sm font-medium">Henüz parça yok</p>
            <p className="text-xs mt-1 opacity-60">Bir link ekleyin</p>
          </div>
        ) : (
          (() => {
            const activeIdx = sortedPlaylist.findIndex((t) => t.id === currentTrack?.id);
            return sortedPlaylist.map((track, index) => {
              const isActive = track.id === currentTrack?.id;
              const isNext   = activeIdx === -1 ? index === 0 : index === activeIdx + 1;
              const score    = getScore(track.id);
              const myVote   = getMyVote(track.id);

              return (
                <motion.div
                  key={track.id}
                  layout
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl
                    hover:bg-white/5 transition-all group relative
                    ${isActive ? 'bg-emerald-500/10' : ''}`}
                >
                  {/* Thumbnail */}
                  <div className="relative w-11 h-11 rounded-xl overflow-hidden
                                  shrink-0 border border-white/10 bg-zinc-800">
                    {track.thumbnail ? (
                      <img src={track.thumbnail} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Music size={14} className="text-white/20" />
                      </div>
                    )}

                    {/* Hover: Oynat */}
                    {permissions.canControl && !isActive && (
                      <button
                        onClick={() => onPlayTrack(track)}
                        className="absolute inset-0 bg-black/60 flex items-center justify-center
                                   opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Play size={18} className="text-white" fill="white" />
                      </button>
                    )}

                    {/* Aktif animasyonu */}
                    {isActive && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <div className="flex gap-[3px] items-end h-4">
                          {[0, 1, 2].map((i) => (
                            <motion.div
                              key={i}
                              className="w-1 bg-emerald-400 rounded-full"
                              animate={{ height: ['20%', '100%', '20%'] }}
                              transition={{
                                repeat: Infinity,
                                duration: 0.8,
                                delay: i * 0.15,
                                ease: 'easeInOut',
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bilgi */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate
                      ${isActive ? 'text-emerald-400' : 'text-white/90'}`}>
                      {track.title}
                    </p>
                    <p className="text-xs text-white/40 mt-0.5 truncate flex items-center gap-1.5">
                      {track.addedByName && (
                        <>
                          <span className="w-3.5 h-3.5 rounded-full bg-white/10
                                           flex items-center justify-center text-[8px] text-white/60">
                            {track.addedByName[0]?.toUpperCase()}
                          </span>
                          {track.addedByName}
                        </>
                      )}
                      {isNext && !isActive && (
                        <span className="ml-1 text-[10px] bg-amber-500/20 text-amber-400
                                         px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                          Sıradaki
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Oy */}
                  <div className="flex items-center gap-0.5 bg-black/20 rounded-xl p-1
                                  border border-white/5">
                    <button
                      onClick={() => toggleUpvote(track.id)}
                      className={`p-1.5 rounded-lg transition-all
                        ${myVote === 1
                          ? 'text-emerald-400 bg-emerald-500/20'
                          : 'text-white/40 hover:text-white hover:bg-white/10'}`}
                    >
                      <ThumbsUp size={13} />
                    </button>
                    <span className={`text-xs font-bold tabular-nums min-w-[1.25rem] text-center
                      ${score > 0 ? 'text-emerald-400' : score < 0 ? 'text-red-400' : 'text-white/40'}`}>
                      {score}
                    </span>
                    <button
                      onClick={() => toggleDownvote(track.id)}
                      className={`p-1.5 rounded-lg transition-all
                        ${myVote === -1
                          ? 'text-red-400 bg-red-500/20'
                          : 'text-white/40 hover:text-white hover:bg-white/10'}`}
                    >
                      <ThumbsDown size={13} />
                    </button>
                  </div>

                  {/* Sil */}
                  {permissions.canManageTracks && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isActive) {
                          const remaining = sortedPlaylist.filter((t) => t.id !== track.id);
                          if (remaining.length > 0) onPlayTrack(remaining[0]);
                          else clearCurrentTrackInDb(serverId, channelId);
                        }
                        removeTrackFromPlaylist(serverId, channelId, track);
                      }}
                      className="p-1.5 rounded-xl hover:bg-red-500/20
                                 opacity-0 group-hover:opacity-100 transition-all
                                 absolute right-3 bg-zinc-800 border border-white/10 shadow-lg"
                    >
                      <Trash2 size={14} className="text-red-400" />
                    </button>
                  )}
                </motion.div>
              );
            });
          })()
        )}
      </div>
    </motion.div>
  );
}