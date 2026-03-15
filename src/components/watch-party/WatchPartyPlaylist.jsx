// src/components/watch-party/WatchPartyPlaylist.jsx
'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  ThumbsUp, ThumbsDown, Crown, X, Music,
} from 'lucide-react';

export function WatchPartyPlaylist({
  serverId,
  channelId,
  permissions,
  onPlayTrack,
  onClose,
  videoFS,
}) {
  const currentTrack = useWatchPartyStore((s) => s.currentTrack);
  const playlist     = useWatchPartyStore((s) => s.playlist);
  const currentUser  = useAuthStore((s) => s.user);

  const { toggleUpvote, toggleDownvote, getScore, getMyVote } =
    useWatchPartyVote(serverId, channelId);

  const [inputUrl, setInputUrl]   = useState('');
  const [isAdding, setIsAdding]   = useState(false);
  const [error, setError]         = useState('');

  // ─── Skor'a göre sırala ───
  const sortedPlaylist = [...playlist].sort((a, b) => {
    const scoreA = getScore(a.id);
    const scoreB = getScore(b.id);
    return scoreB - scoreA;
  });

  // ─── Parça Ekle ───
  const handleAdd = useCallback(async () => {
    let finalUrl = inputUrl.trim();
    if (!finalUrl) return;
    if (!permissions.canManageTracks) return;

    // Shorts format düzelteci
    if (finalUrl.includes('youtube.com/shorts/')) {
      finalUrl = finalUrl.replace('youtube.com/shorts/', 'youtube.com/watch?v=');
    }

    const isSoundcloud = finalUrl.includes('soundcloud.com/');
    const isYouTube =
      finalUrl.includes('youtube.com/') || finalUrl.includes('youtu.be/');
    
    // ─── SoundCloud: playlist (sets) linklerini tekil medya modunda destekleme ───
    if (isSoundcloud && finalUrl.includes('/sets/')) {
      setError('SoundCloud playlist linkleri şu an desteklenmiyor. Lütfen tek tek parça linkleri ekleyin.');
      return;
    }

    // SoundCloud tracker ve gereksiz parametreleri temizle
    if (isSoundcloud && finalUrl.includes('?')) {
      finalUrl = finalUrl.split('?')[0];
    }

    // ─── YouTube: playlist parametreleri ───
    if (isYouTube) {
      const urlObj = new URL(finalUrl);
      const hasVideoId = urlObj.searchParams.get('v');
      const hasPlaylist = urlObj.searchParams.get('list');

      // Sadece playlist ise (v yok, list var) → destekleme
      if (!hasVideoId && hasPlaylist) {
        setError('YouTube playlist linkleri şu an desteklenmiyor. Lütfen tek bir video linki ekleyin.');
        return;
      }

      // Hem v hem list varsa → playlist parametresini temizle, sadece videoyu kullan
      if (hasVideoId && hasPlaylist) {
        urlObj.searchParams.delete('list');
        urlObj.searchParams.delete('index');
        urlObj.searchParams.delete('start_radio');
        finalUrl = urlObj.toString();
      }
    }

    if (!ReactPlayer.canPlay(finalUrl) && !isSoundcloud) {
      setError('Bu link desteklenmiyor. YouTube, SoundCloud, Vimeo vb. deneyin.');
      return;
    }

    setIsAdding(true);
    setError('');

    try {
      let thumbnail = '';
      let title = finalUrl;

      // YouTube thumbnail + title
      const ytMatch = finalUrl.match(
        /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([^&?\s#\/]+)/
      );
      
      const scMatch = finalUrl.includes('soundcloud.com');

      if (ytMatch) {
        thumbnail = `https://img.youtube.com/vi/${ytMatch[1]}/mqdefault.jpg`;
        try {
          const res = await fetch(
            `https://www.youtube.com/oembed?url=${encodeURIComponent(finalUrl)}&format=json`
          );
          const data = await res.json();
          if (data.title) title = data.title;
          if (data.thumbnail_url) thumbnail = data.thumbnail_url;
        } catch {
          // Fallback to noembed
          try {
            const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(finalUrl)}`);
            const data = await res.json();
            if (data.title) title = data.title;
            if (data.thumbnail_url) thumbnail = data.thumbnail_url;
          } catch {}
        }
      } else if (scMatch) {
        try {
          const res = await fetch(
            `https://soundcloud.com/oembed?url=${encodeURIComponent(finalUrl)}&format=json`
          );
          const data = await res.json();
          if (data.title) title = data.title;
          if (data.thumbnail_url) thumbnail = data.thumbnail_url;
          
          if (data.html) {
             const m = data.html.match(/url=([^&"'>]+)/);
             if (m && m[1]) {
                finalUrl = decodeURIComponent(m[1]);
             }
          }
        } catch {}
      } else {
        // Generic fallback for others
        try {
          const res = await fetch(
            `https://noembed.com/embed?url=${encodeURIComponent(finalUrl)}`
          );
          const data = await res.json();
          if (data.title) title = data.title;
          if (data.thumbnail_url) thumbnail = data.thumbnail_url;
        } catch {}
      }

      await addTrackToPlaylist(serverId, channelId, {
        url: finalUrl,
        title,
        thumbnail,
        duration: 0,
        addedBy: currentUser?.uid || '',
        addedByName: currentUser?.displayName || 'Bilinmeyen',
      });

      setInputUrl('');
    } catch (err) {
      setError('Eklenirken hata oluştu.');
      console.error(err);
    } finally {
      setIsAdding(false);
    }
  }, [inputUrl, serverId, channelId, permissions, currentUser]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.95 }}
      className={`absolute ${videoFS ? 'bottom-28 right-12 w-[360px]' : 'top-[calc(100%+8px)] right-0 w-full'}
                 bg-zinc-900/80 backdrop-blur-2xl rounded-2xl
                 border border-white/[0.08] shadow-2xl overflow-hidden z-[150]`}
    >
      {/* ── Başlık ── */}
      <div className="flex items-center justify-between px-4 py-3
                      border-b border-white/[0.04]">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Music size={16} className="text-emerald-400" />
          Çalma Listesi
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-white/20">
            {playlist.length} parça
          </span>
          <button onClick={onClose} className="p-1 hover:bg-white/10
                                               rounded-lg transition-all">
            <X size={14} className="text-white/40" />
          </button>
        </div>
      </div>

      {/* ── Ekleme Formu (Sadece yetkili) ── */}
      {permissions.canManageTracks ? (
        <div className="px-4 py-3 border-b border-white/[0.04]">
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 bg-white/[0.04]
                            rounded-xl px-3 py-2.5
                            focus-within:ring-1 focus-within:ring-emerald-500/40
                            transition-all">
              <Link size={14} className="text-white/20 flex-shrink-0" />
              <input
                type="text"
                placeholder="YouTube, SoundCloud, Vimeo linki..."
                value={inputUrl}
                onChange={(e) => { setInputUrl(e.target.value); setError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                className="flex-1 bg-transparent text-sm text-white
                           outline-none placeholder:text-white/15"
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={isAdding || !inputUrl.trim()}
              className="px-3.5 py-2.5 bg-emerald-500 hover:bg-emerald-400
                         rounded-xl transition-all disabled:opacity-20
                         disabled:cursor-not-allowed active:scale-95"
            >
              {isAdding
                ? <Loader2 size={16} className="text-white animate-spin" />
                : <Plus size={16} className="text-white" />
              }
            </button>
          </div>
          {error && <p className="text-[11px] text-red-400 mt-1.5">{error}</p>}
        </div>
      ) : (
        <div className="px-4 py-2 border-b border-white/[0.04]
                        bg-white/[0.02]">
          <p className="text-[11px] text-white/25 text-center">
            Parça eklemek için yetki gereklidir
          </p>
        </div>
      )}

      {/* ── Oy Açıklaması ── */}
      <div className="px-4 py-1.5 bg-white/[0.01] border-b border-white/[0.03]">
        <p className="text-[10px] text-white/20 text-center">
          👆 Oy verin — En çok oy alan parça sıradaki otomatik çalar
        </p>
      </div>

      {/* ── Parça Listesi ── */}
      <div className="max-h-80 overflow-y-auto overscroll-contain">
        {sortedPlaylist.length === 0 ? (
          <div className="py-12 text-center text-white/15 text-sm">
            <Music size={32} className="mx-auto mb-2 opacity-30" />
            Henüz parça eklenmedi
          </div>
        ) : (
          sortedPlaylist.map((track, index) => {
            const isActive = currentTrack?.id === track.id;
            const score    = getScore(track.id);
            const myVote   = getMyVote(track.id);

            return (
              <motion.div
                key={track.id}
                layout
                className={`flex items-center gap-3 px-4 py-2.5
                  hover:bg-white/[0.03] transition-all group
                  ${isActive
                    ? 'bg-emerald-500/[0.08] border-l-2 border-emerald-400'
                    : 'border-l-2 border-transparent'
                  }`}
              >
                {/* Oy Butonları (Herkes) */}
                <div className="flex flex-col items-center gap-0.5
                                flex-shrink-0">
                  <button
                    onClick={() => toggleUpvote(track.id)}
                    className={`p-1 rounded transition-all
                      ${myVote === 1
                        ? 'text-emerald-400 bg-emerald-500/20'
                        : 'text-white/20 hover:text-white/50 hover:bg-white/[0.06]'
                      }`}
                  >
                    <ThumbsUp size={12} />
                  </button>

                  <span className={`text-xs font-bold tabular-nums min-w-[1.2rem]
                                    text-center
                    ${score > 0 ? 'text-emerald-400' :
                      score < 0 ? 'text-red-400' : 'text-white/20'}`}>
                    {score}
                  </span>

                  <button
                    onClick={() => toggleDownvote(track.id)}
                    className={`p-1 rounded transition-all
                      ${myVote === -1
                        ? 'text-red-400 bg-red-500/20'
                        : 'text-white/20 hover:text-white/50 hover:bg-white/[0.06]'
                      }`}
                  >
                    <ThumbsDown size={12} />
                  </button>
                </div>

                {/* Thumbnail */}
                <div className="relative w-10 h-10 rounded-lg overflow-hidden
                                flex-shrink-0 ring-1 ring-white/[0.06]">
                  {track.thumbnail ? (
                    <img src={track.thumbnail} alt="" className="w-full h-full
                         object-cover" />
                  ) : (
                    <div className="w-full h-full bg-white/[0.04] flex
                                    items-center justify-center">
                      <Music size={14} className="text-white/15" />
                    </div>
                  )}

                  {/* Host/CoHost: Hover Play */}
                  {permissions.canControl && !isActive && (
                    <button
                      onClick={() => onPlayTrack(track)}
                      className="absolute inset-0 bg-black/60 flex
                                 items-center justify-center opacity-0
                                 group-hover:opacity-100 transition-opacity"
                    >
                      <Play size={14} className="text-white" fill="white" />
                    </button>
                  )}

                  {/* Active Animation */}
                  {isActive && (
                    <div className="absolute inset-0 bg-black/40 flex
                                    items-center justify-center">
                      <div className="flex gap-[2px]">
                        {[0, 1, 2].map((i) => (
                          <motion.div
                            key={i}
                            className="w-[3px] bg-emerald-400 rounded-full"
                            animate={{ height: [3, 14, 3] }}
                            transition={{
                              repeat: Infinity,
                              duration: 0.7,
                              delay: i * 0.12,
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
                  <p className={`text-xs font-medium truncate
                    ${isActive ? 'text-emerald-400' : 'text-white/70'}`}>
                    {track.title}
                  </p>
                  <p className="text-[10px] text-white/20 mt-0.5 truncate">
                    {track.addedByName && `Ekleyen: ${track.addedByName}`}
                    {index === 0 && !isActive && (
                      <span className="ml-1 text-amber-400/60">
                        👑 Sıradaki
                      </span>
                    )}
                  </p>
                </div>

                {/* Sil (Sadece yetkili) */}
                {permissions.canManageTracks && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      
                      if (isActive) {
                        const remaining = sortedPlaylist.filter((t) => t.id !== track.id);
                        if (remaining.length > 0) {
                          onPlayTrack(remaining[0]);
                        } else {
                          clearCurrentTrackInDb(serverId, channelId);
                        }
                      }

                      removeTrackFromPlaylist(serverId, channelId, track);
                    }}
                    className="p-1.5 rounded-lg hover:bg-red-500/20
                               opacity-0 group-hover:opacity-100
                               transition-all"
                  >
                    <Trash2 size={12} className="text-red-400" />
                  </button>
                )}
              </motion.div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}
