// src/components/watch-party/WatchPartyPlayer.jsx
'use client';

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import ReactPlayer from 'react-player';
import { motion, AnimatePresence } from 'framer-motion';
import { useRoomContext } from '@livekit/components-react';
import { useWatchPartyStore } from '@/src/store/watchPartyStore';
import { useWatchPartySync } from '@/src/hooks/useWatchPartySync';
import { useWatchPartyDrift } from '@/src/hooks/useWatchPartyDrift';
import { useWatchPartyPermission } from '@/src/hooks/useWatchPartyPermission';
import { WatchPartyControls } from './WatchPartyControls';
import { WatchPartyPlaylist } from './WatchPartyPlaylist';
import { WatchPartyUserPrefs } from './WatchPartyUserPrefs';
import { WatchPartyCoHostManager } from './WatchPartyCoHostManager';
import { formatTime } from '@/src/utils/formatTime';
import { Minimize, Maximize, X } from 'lucide-react';

function getYouTubeId(url) {
  if (!url) return null;
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([^&?\s#\/]+)/
  );
  return match?.[1] || null;
}

// ═══════════════════════════════════════════════════════════
// SOUNDCLOUD PLAYER — postMessage API
//
// SC Widget iframe'i postMessage ile kontrol edilir.
// Önce event'lere subscribe olunmalı (addEventListener),
// sonra widget otomatik olarak playProgress gönderir.
// ═══════════════════════════════════════════════════════════
function SoundCloudPlayer({
  trackUrl,
  shouldPlay,
  effectiveVolume,
  videoMode,
  videoFS,
  playerApiRef,
  onDuration,
  onProgress,
  onEnded,
  onReady,
}) {
  const iframeRef = useRef(null);
  const isReadyRef = useRef(false);
  const durationRef = useRef(0);
  const currentTimeRef = useRef(0);
  const shouldPlayRef = useRef(shouldPlay);
  shouldPlayRef.current = shouldPlay;

  // Widget'a komut gönder
  const post = useCallback((method, value) => {
    try {
      const msg = value !== undefined ? { method, value } : { method };
      // '*' kullan — Electron'da origin kısıtlaması sorun çıkarıyor
      iframeRef.current?.contentWindow?.postMessage(JSON.stringify(msg), '*');
    } catch {}
  }, []);

  const volumeRef = useRef(effectiveVolume);
  useEffect(() => { volumeRef.current = effectiveVolume; }, [effectiveVolume]);

  // iframe yüklendiğinde event'lere abone ol
  const handleIframeLoad = useCallback(() => {
    console.log('[WatchParty] SC iframe loaded');

    // Widget'ın initialize olması için kısa bekle
    setTimeout(() => {
      // Event subscription — BU OLMADAN playProgress gelmez
      post('addEventListener', 'ready');
      post('addEventListener', 'playProgress');
      post('addEventListener', 'play');
      post('addEventListener', 'pause');
      post('addEventListener', 'finish');

      // Duration iste
      post('getDuration');
    }, 800);
  }, [post]);

  // Widget'tan gelen mesajları dinle
  useEffect(() => {
    const handler = (event) => {
      if (!event.origin?.includes('soundcloud.com')) return;

      let data;
      try {
        data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch { return; }
      if (!data?.method) return;

      switch (data.method) {
        case 'ready':
          console.log('[WatchParty] ✅ SoundCloud Widget READY');
          isReadyRef.current = true;

          // Tekrar subscribe (ready'den sonra garantile)
          post('addEventListener', 'playProgress');
          post('addEventListener', 'finish');
          post('getDuration');
          post('setVolume', effectiveVolume * 100);

          // playerRef arayüzü
          playerApiRef.current = {
            seekTo: (secs) => post('seekTo', secs * 1000),
            getCurrentTime: () => currentTimeRef.current,
            getDuration: () => durationRef.current,
          };

          if (shouldPlayRef.current) {
            setTimeout(() => post('play'), 500);
          }

          onReady();
          break;

        case 'getDuration':
          if (data.value && data.value > 0) {
            const dur = data.value / 1000;
            console.log('[WatchParty] SC Duration:', dur.toFixed(1));
            durationRef.current = dur;
            onDuration(dur);
          }
          break;

        case 'playProgress':
          if (data.value) {
            const currentMs = data.value.currentPosition || 0;
            const relative  = data.value.relativePosition || 0;
            const current   = currentMs / 1000;
            currentTimeRef.current = current;

            onProgress({
              played: relative,
              playedSeconds: current,
            });

            // Duration henüz alınmadıysa hesapla
            if (durationRef.current === 0 && relative > 0 && current > 0) {
              const estimated = current / relative;
              durationRef.current = estimated;
              onDuration(estimated);
            }
          }
          break;

        case 'finish':
          console.log('[WatchParty] SC: ENDED');
          onEnded();
          break;

        case 'play':
          // Çalmaya başladı — duration'ı tekrar iste (bazen ready'de 0 geliyor)
          if (durationRef.current === 0) {
            post('getDuration');
          }
          // Tekrar volume gönder ki SC bazen cookie volume veriyor
          post('setVolume', volumeRef.current * 100);
          break;
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [post, playerApiRef, onReady, onProgress, onDuration, onEnded]);

  // Play/Pause senkronizasyonu
  useEffect(() => {
    if (!isReadyRef.current) return;
    post(shouldPlay ? 'play' : 'pause');
  }, [shouldPlay, post]);

  // Volume senkronizasyonu
  useEffect(() => {
    if (!isReadyRef.current) return;
    post('setVolume', effectiveVolume * 100);
  }, [effectiveVolume, post]);

  // Duration fallback polling (widget bazen ilk seferde 0 döndürüyor)
  useEffect(() => {
    const timer = setInterval(() => {
      if (durationRef.current > 0) { clearInterval(timer); return; }
      if (isReadyRef.current) post('getDuration');
    }, 2000);
    return () => clearInterval(timer);
  }, [post]);

  // iframe URL
  const cleanUrl = trackUrl.split('?')[0];
  // NOT: visual paramını sadece fullscreen'e göre ayarla ki
  // mini player'da monitor ikonuna basmak iframe'i yeniden yükleyip
  // şarkıyı durdurmasın.
  const src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(cleanUrl)}&color=%2350c878&auto_play=false&hide_related=true&show_comments=false&show_user=false&show_reposts=false&show_teaser=false&visual=${videoFS ? 'true' : 'false'}`;

  return (
    <iframe
      ref={iframeRef}
      src={src}
      onLoad={handleIframeLoad}
      width="100%"
      height={videoFS ? '100%' : videoMode ? 220 : 166}
      scrolling="no"
      frameBorder="no"
      allow="autoplay"
      className={videoFS ? 'absolute inset-0 w-full h-full z-0' : ''}
      style={
        videoFS ? { height: '100%' } : videoMode
          ? {}
          : { height: 1, opacity: 0, pointerEvents: 'none', position: 'absolute' }
      }
    />
  );
}

// ═══════════════════════════════════════════════════════════
// YouTube Wrapper Component
// ═══════════════════════════════════════════════════════════
function YouTubePlayer({
  videoId, shouldPlay, effectiveVolume, videoMode, videoFS, ytQuality,
  onReady, onStateChange, onError,
  playerApiRef, ytPlayerRef,
}) {
  const wrapperRef = useRef(null);
  const targetRef = useRef(null);
  const [apiLoaded, setApiLoaded] = useState(!!window.YT?.Player);
  const currentVideoIdRef = useRef(null);
  const isReadyRef = useRef(false);
  const volumeRef = useRef(effectiveVolume);

  useEffect(() => { volumeRef.current = effectiveVolume; }, [effectiveVolume]);

  useEffect(() => {
    if (window.YT?.Player) { setApiLoaded(true); return; }
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }
    const checker = setInterval(() => {
      if (window.YT?.Player) { setApiLoaded(true); clearInterval(checker); }
    }, 300);
    return () => clearInterval(checker);
  }, []);

  useEffect(() => {
    if (!apiLoaded || !videoId || !wrapperRef.current) return;
    if (currentVideoIdRef.current === videoId && isReadyRef.current) return;

    if (ytPlayerRef.current && isReadyRef.current) {
      currentVideoIdRef.current = videoId;
      try { ytPlayerRef.current.loadVideoById({ videoId, startSeconds: 0 }); } catch {}
      return;
    }

    if (targetRef.current) {
      try { wrapperRef.current.removeChild(targetRef.current); } catch {}
    }

    const target = document.createElement('div');
    target.id = `yt-target-${Date.now()}`;
    wrapperRef.current.appendChild(target);
    targetRef.current = target;
    currentVideoIdRef.current = videoId;
    isReadyRef.current = false;

    try {
      const isFileProtocol = window.location.protocol.includes('file') || window.location.protocol.includes('app');

      const playerVars = {
        autoplay: 0, controls: 0, modestbranding: 1, rel: 0,
        playsinline: 1, iv_load_policy: 3, enablejsapi: 1,
        vq: ytQuality || 'auto',
      };
      // Only set origin for http(s) — file:// can't match any origin
      // and YouTube silently rejects postMessage if origin doesn't match
      if (!isFileProtocol) {
        playerVars.origin = window.location.origin;
      }

      ytPlayerRef.current = new window.YT.Player(target, {
        videoId, width: '100%', height: '100%',
        playerVars,
        events: {
          onReady: (event) => {
            isReadyRef.current = true;
            try {
              const iframe = event.target.getIframe();
              if (iframe) {
                iframe.style.width = '100%'; iframe.style.height = '100%'; iframe.style.border = 'none';
                iframe.setAttribute('allow', 'autoplay; encrypted-media; accelerometer; gyroscope; picture-in-picture; clipboard-write');
                iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
              }
              const vol = Math.round(volumeRef.current * 100);
              event.target.setVolume(vol);
              if (vol === 0) event.target.mute(); else event.target.unMute();
            } catch {}
            onReady(event);
          },
          onStateChange: (event) => {
            if (event.data === window.YT?.PlayerState?.PLAYING) {
              const vol = Math.round(volumeRef.current * 100);
              event.target.setVolume(vol);
              if (vol === 0) event.target.mute(); else event.target.unMute();
            }
            onStateChange(event);
          },
          onError: (event) => onError(event),
        },
      });
    } catch (e) { console.error('[WatchParty] YT create error:', e); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiLoaded, videoId]);

  useEffect(() => {
    if (!isReadyRef.current || !ytPlayerRef.current) return;
    try { if (shouldPlay) ytPlayerRef.current.playVideo(); else ytPlayerRef.current.pauseVideo(); } catch {}
  }, [shouldPlay, ytPlayerRef]);

  useEffect(() => {
    if (!isReadyRef.current || !ytPlayerRef.current) return;
    try {
      const vol = Math.round(effectiveVolume * 100);
      ytPlayerRef.current.setVolume(vol);
      if (vol === 0) ytPlayerRef.current.mute(); else ytPlayerRef.current.unMute();
    } catch {}
  }, [effectiveVolume, ytPlayerRef]);

  useEffect(() => {
    if (!isReadyRef.current || !ytPlayerRef.current) return;
    try {
      ytPlayerRef.current.setPlaybackQuality(ytQuality || 'auto');
    } catch {}
  }, [ytQuality, ytPlayerRef]);

  useEffect(() => {
    return () => {
      isReadyRef.current = false;
      currentVideoIdRef.current = null;
      try { ytPlayerRef.current?.destroy(); } catch {}
      ytPlayerRef.current = null;
    };
  }, [ytPlayerRef]);

  return (
    <div 
      ref={wrapperRef} 
      className={`w-full bg-black pointer-events-none select-none ${videoFS ? 'absolute inset-0 h-full z-0' : ''}`} 
      style={videoFS ? { height: '100%' } : { height: videoMode ? 220 : 0 }} 
    />
  );
}

// ═══════════════════════════════════════════════════════════
// ANA PLAYER
// ═══════════════════════════════════════════════════════════
export function WatchPartyPlayer({ serverId, channelId }) {
  const room = useRoomContext();
  const playerRef = useRef(null);
  const ytPlayerRef = useRef(null);
  const seekingRef = useRef(false);

  const [progress, setProgress] = useState({ played: 0, playedSeconds: 0 });
  const [duration, setDuration] = useState(0);
  const [buffering, setBuffering] = useState(false);
  const [activePanel, setActivePanel] = useState(null);
  
  const [isMouseIdle, setIsMouseIdle] = useState(false);
  const idleTimeoutRef = useRef(null);

  const handleTogglePanel = useCallback((panel) => {
    setActivePanel((prev) => (prev === panel ? null : panel));
  }, []);

  const currentTrack = useWatchPartyStore((s) => s.currentTrack);
  const isPlaying    = useWatchPartyStore((s) => s.playbackState.isPlaying);
  const startedAt    = useWatchPartyStore((s) => s.playbackState.startedAt);
  const isListening  = useWatchPartyStore((s) => s.localPreferences.isListening);
  const isMuted      = useWatchPartyStore((s) => s.localPreferences.isMuted);
  const localVolume  = useWatchPartyStore((s) => s.localPreferences.volume);
  const videoMode    = useWatchPartyStore((s) => s.localPreferences.videoMode);
  const videoFS      = useWatchPartyStore((s) => s.localPreferences.videoFullscreen);
  const showPlayer   = useWatchPartyStore((s) => s.localPreferences.showPlayer);
  const ytQuality    = useWatchPartyStore((s) => s.localPreferences.videoQuality) || 'auto';
  const playlist     = useWatchPartyStore((s) => s.playlist);
  const toggleFS     = useWatchPartyStore((s) => s.toggleFullscreen);
  const toggleVideo  = useWatchPartyStore((s) => s.toggleVideoMode);
  const setLocalPref = useWatchPartyStore((s) => s.setLocalPref);

  const effectiveVolume = (!isListening || isMuted) ? 0 : localVolume / 100;
  const shouldPlay = isPlaying;

  const videoId = useMemo(() => getYouTubeId(currentTrack?.url), [currentTrack?.url]);
  const isYouTube = !!videoId;
  const isSoundCloud = !!currentTrack?.url?.includes('soundcloud.com');
  const isGeneric = !isYouTube && !isSoundCloud && !!currentTrack?.url;

  const permissions = useWatchPartyPermission(serverId);
  const { hostPlay, hostPause, hostSeek, hostSkip, autoAdvance } =
    useWatchPartySync(room, playerRef, serverId, channelId);
  useWatchPartyDrift(playerRef);

  // ═══ YouTube Callbacks ═══
  const handleYTReady = useCallback(() => {
    setBuffering(false);
    playerRef.current = {
      seekTo: (s) => { try { ytPlayerRef.current?.seekTo(s, true); } catch {} },
      getCurrentTime: () => { try { return ytPlayerRef.current?.getCurrentTime() || 0; } catch { return 0; } },
      getDuration: () => { try { return ytPlayerRef.current?.getDuration() || 0; } catch { return 0; } },
    };
    try { const d = ytPlayerRef.current?.getDuration(); if (d > 0) setDuration(d); } catch {}

    const store = useWatchPartyStore.getState();
    if (store.playbackState.isPlaying) {
      if (store.playbackState.startedAt) {
        const pos = (Date.now() - store.playbackState.startedAt) / 1000;
        try { ytPlayerRef.current?.seekTo(pos, true); } catch {}
      }
      try { ytPlayerRef.current?.playVideo(); } catch {}
    }
  }, []);

  const handleYTState = useCallback((event) => {
    const s = event.data;
    if (s === window.YT?.PlayerState?.ENDED && permissions.canControl) autoAdvance();
    if (s === window.YT?.PlayerState?.BUFFERING) setBuffering(true);
    if (s === window.YT?.PlayerState?.PLAYING) {
      setBuffering(false);
      try { const d = ytPlayerRef.current?.getDuration(); if (d > 0 && duration === 0) setDuration(d); } catch {}
    }
    if (s === window.YT?.PlayerState?.PAUSED) setBuffering(false);
  }, [permissions.canControl, autoAdvance, duration]);

  // ═══ YouTube Progress ═══
  useEffect(() => {
    if (!isYouTube) return;
    const timer = setInterval(() => {
      try {
        if (!ytPlayerRef.current?.getCurrentTime) return;
        const t = ytPlayerRef.current.getCurrentTime() || 0;
        const d = ytPlayerRef.current.getDuration() || 0;
        if (d > 0 && duration === 0) setDuration(d);
        if (!seekingRef.current) setProgress({ played: d > 0 ? t / d : 0, playedSeconds: t });
      } catch {}
    }, 500);
    return () => clearInterval(timer);
  }, [isYouTube, duration]);

  // ═══ SoundCloud Callbacks ═══
  const handleSCReady = useCallback(() => {
    setBuffering(false);
    const store = useWatchPartyStore.getState();
    if (store.playbackState.isPlaying && store.playbackState.startedAt) {
      const pos = (Date.now() - store.playbackState.startedAt) / 1000;
      setTimeout(() => { try { playerRef.current?.seekTo(pos); } catch {} }, 300);
    }
  }, []);

  const handleSCDuration = useCallback((dur) => {
    if (dur > 0) setDuration(dur);
  }, []);

  const handleSCProgress = useCallback((state) => {
    if (!seekingRef.current) setProgress(state);
  }, []);

  const handleSCEnded = useCallback(() => {
    if (permissions.canControl) autoAdvance();
  }, [permissions.canControl, autoAdvance]);

  // ═══ Track Reset ═══
  const prevTrackRef = useRef(null);
  useEffect(() => {
    const url = currentTrack?.url;
    if (!url || url === prevTrackRef.current) return;
    prevTrackRef.current = url;
    setBuffering(true);
    setProgress({ played: 0, playedSeconds: 0 });
    setDuration(0);
    
    // Otomatik olarak videoyu (monitoru) aç
    setLocalPref('videoMode', true);
  }, [currentTrack?.url, setLocalPref]);

  // Parça tamamen kaldırıldığında video modunu da kapat
  useEffect(() => {
    if (!currentTrack) {
      setLocalPref('videoMode', false);
    }
  }, [currentTrack, setLocalPref]);

  // ═══ Generic ReactPlayer ═══
  const handleRPReady = useCallback(() => {
    setBuffering(false);
    const d = playerRef.current?.getDuration?.();
    if (d && d > 0) setDuration(d);
    const store = useWatchPartyStore.getState();
    if (store.playbackState.isPlaying && store.playbackState.startedAt) {
      const pos = (Date.now() - store.playbackState.startedAt) / 1000;
      playerRef.current?.seekTo?.(Math.max(0, pos), 'seconds');
    }
  }, []);

  const handleRPProgress = useCallback((state) => {
    if (!seekingRef.current) setProgress(state);
    if (duration === 0 && playerRef.current?.getDuration) {
      const d = playerRef.current.getDuration();
      if (d && d > 0 && isFinite(d)) setDuration(d);
    }
  }, [duration]);

  const handleRPEnded = useCallback(() => {
    if (permissions.canControl) autoAdvance();
  }, [permissions.canControl, autoAdvance]);

  const handleRPError = useCallback((error) => {
    setBuffering(false);
    if (!error) return;
    const msg = error?.message || String(error) || '';
    if (msg.includes('AbortError') || msg.includes('interrupted')) return;
    console.warn('[WatchParty] ReactPlayer error:', error);
  }, []);

  // Generic duration polling
  useEffect(() => {
    if (isYouTube || isSoundCloud || !currentTrack?.url || duration > 0) return;
    const p = setInterval(() => {
      if (playerRef.current?.getDuration) {
        const d = playerRef.current.getDuration();
        if (d && d > 0 && isFinite(d)) { setDuration(d); clearInterval(p); }
      }
    }, 1000);
    return () => clearInterval(p);
  }, [currentTrack?.url, duration, isYouTube, isSoundCloud]);

  // ═══ Kontrol ═══
  const handleSeekChange = useCallback((e) => {
    if (!permissions.canControl) return;
    setProgress({ played: parseFloat(e.target.value), playedSeconds: parseFloat(e.target.value) * duration });
  }, [permissions.canControl, duration]);

  const handleSeekStart = useCallback(() => { if (permissions.canControl) seekingRef.current = true; }, [permissions.canControl]);

  const handleSeekCommit = useCallback((e) => {
    if (!permissions.canControl) return;
    seekingRef.current = false;
    hostSeek(parseFloat(e.target.value) * duration);
  }, [permissions.canControl, duration, hostSeek]);

  const handlePlayPause = useCallback(() => {
    if (!permissions.canControl) return;
    if (isPlaying) hostPause(); else hostPlay(currentTrack, progress.playedSeconds);
  }, [permissions.canControl, isPlaying, hostPause, hostPlay, currentTrack, progress.playedSeconds]);

  const handleSkipNext = useCallback(() => {
    if (!permissions.canControl) return;
    const sorted = useWatchPartyStore.getState().getSortedPlaylist();
    const remaining = sorted.filter((t) => t.id !== currentTrack?.id);
    if (remaining.length > 0) hostSkip(remaining[0]);
  }, [permissions.canControl, currentTrack, hostSkip]);

  const handleSkipPrev = useCallback(() => {
    if (!permissions.canControl) return;
    const idx = playlist.findIndex((t) => t.id === currentTrack?.id);
    if (idx > 0) hostSkip(playlist[idx - 1]);
  }, [permissions.canControl, playlist, currentTrack, hostSkip]);

  // Fullscreen
  useEffect(() => {
    const h = () => { const fs = !!document.fullscreenElement; const s = useWatchPartyStore.getState(); if (s.localPreferences.videoFullscreen !== fs) s.setLocalPref('videoFullscreen', fs); };
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  useEffect(() => {
    const el = document.getElementById('wp-player-root');
    if (!el) return;
    if (videoFS && !document.fullscreenElement) el.requestFullscreen?.().catch(() => {});
    else if (!videoFS && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  }, [videoFS]);

  useEffect(() => {
    if (!videoFS) return;
    const h = (e) => { if (e.key === 'Escape' && !document.fullscreenElement) toggleFS(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [videoFS, toggleFS]);

  // Mouse Idle for Fullscreen
  useEffect(() => {
    if (!videoFS) {
      setIsMouseIdle(false);
      return;
    }

    const resetIdleTimer = () => {
      setIsMouseIdle(false);
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = setTimeout(() => {
        setIsMouseIdle(true);
      }, 3000);
    };

    resetIdleTimer();
    window.addEventListener('mousemove', resetIdleTimer);
    window.addEventListener('mousedown', resetIdleTimer);
    window.addEventListener('keydown', resetIdleTimer);

    return () => {
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
      window.removeEventListener('mousemove', resetIdleTimer);
      window.removeEventListener('mousedown', resetIdleTimer);
      window.removeEventListener('keydown', resetIdleTimer);
    };
  }, [videoFS]);

  const videoHeight = videoFS ? '100%' : videoMode ? 220 : 0;

  const playerContent = (
    <>
      <motion.div
        id="wp-player-root"
        key="wp-player-card"
        initial={{ y: 20, opacity: 0, scale: 0.95 }}
        animate={showPlayer ? { y: 0, opacity: 1, scale: 1 } : { y: 20, opacity: 0, scale: 0.95 }}
        exit={{ y: 20, opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className={videoFS
          ? 'fixed inset-0 z-[200] flex flex-col bg-black'
          : `fixed top-24 right-6 w-[360px] max-w-[calc(100vw-32px)] ${showPlayer ? 'z-[100] pointer-events-auto' : 'z-[-1] pointer-events-none'}`
        }
      >
        <div id="wp-player-container"
          className={`relative flex flex-col group/fs transition-all duration-300
            ${videoFS ? `w-full h-full flex-1 ${isMouseIdle ? 'cursor-none' : ''}` : ''}`}
        >
          {/* AYRIK ARKA PLAN (KIRPMA EFEKTİ İÇİN) */}
          {!videoFS && (
            <div className="absolute inset-0 z-0 rounded-2xl border border-white/[0.08] bg-zinc-900/95 backdrop-blur-3xl shadow-2xl shadow-black/60 pointer-events-none overflow-hidden" />
          )}

          {/* ═══ PLAYER ALANI ═══ */}
          <div className={`transition-all duration-300 ${videoFS ? 'absolute inset-0 w-full h-full z-0' : 'relative rounded-t-2xl overflow-hidden z-10'}`}
               style={videoFS ? { height: '100%' } : { height: videoHeight }}>

            {isYouTube && videoId && (
              <YouTubePlayer videoId={videoId} shouldPlay={shouldPlay} effectiveVolume={effectiveVolume}
                videoMode={videoMode} videoFS={videoFS} ytQuality={ytQuality}
                onReady={handleYTReady} onStateChange={handleYTState}
                onError={(e) => console.warn('[WatchParty] YT error:', e.data)}
                playerApiRef={playerRef} ytPlayerRef={ytPlayerRef} />
            )}

            {isSoundCloud && currentTrack?.url && (
              <SoundCloudPlayer
                key={currentTrack.url}
                trackUrl={currentTrack.url}
                shouldPlay={shouldPlay}
                effectiveVolume={effectiveVolume}
                videoMode={videoMode}
                videoFS={videoFS}
                playerApiRef={playerRef}
                onReady={handleSCReady}
                onDuration={handleSCDuration}
                onProgress={handleSCProgress}
                onEnded={handleSCEnded}
              />
            )}

            {isGeneric && (
              <div className={videoFS ? "absolute inset-0 w-full h-full" : "w-full h-full"}>
                <ReactPlayer ref={playerRef} url={currentTrack.url} playing={shouldPlay}
                  volume={effectiveVolume} muted={effectiveVolume === 0}
                  onReady={handleRPReady} onProgress={handleRPProgress}
                  onEnded={handleRPEnded} onError={handleRPError}
                  progressInterval={500} width="100%" height="100%"
                  config={{ file: { attributes: { crossOrigin: 'anonymous', preload: 'auto' } } }} />
              </div>
            )}

            {(videoMode || videoFS) && (
              <div className={`absolute top-4 right-4 flex items-center gap-3 z-[250] transition-opacity duration-300
                ${videoFS 
                  ? (isMouseIdle ? 'opacity-0 pointer-events-none' : 'opacity-100')
                  : 'opacity-0 group-hover/fs:opacity-100'}`}
              >
                <button onClick={toggleFS}
                  className="p-2.5 rounded-xl bg-black/60 hover:bg-black/90 text-white/70 hover:text-white backdrop-blur-md transition-all border border-white/10 hover:border-white/30 hover:scale-105"
                  title={videoFS ? 'Küçült' : 'Tam Ekran'}>
                  {videoFS ? <Minimize size={18} /> : <Maximize size={18} />}
                </button>
              </div>
            )}
          </div>

          {/* ═══ KONTROL PANELİ ═══ */}
          <div className={`flex flex-col transition-all duration-500 z-[150]
            ${videoFS
              ? `absolute bottom-0 left-0 right-0 pt-32 pb-8 px-12 bg-gradient-to-t from-black/95 via-black/80 to-transparent gap-6 ${isMouseIdle ? 'opacity-0 pointer-events-none' : 'opacity-100'}`
              : 'relative p-3 bg-zinc-900/80 gap-3 border-t border-white/5'}`}>

            {!videoFS && (
              <button 
                onClick={() => useWatchPartyStore.getState().togglePlayer()}
                className="absolute top-3 right-3 p-1.5 text-white/40 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg z-[300] transition-colors"
                title="Mini rozete küçült"
              >
                <X size={14} strokeWidth={2.5} />
              </button>
            )}

            <div className={`flex items-center gap-3 ${videoFS ? '' : 'pr-8'}`}>
              <div className={`relative shrink-0 rounded-lg overflow-hidden shadow-lg border border-white/10 bg-zinc-800/50 ${videoFS ? 'w-24 h-24 rounded-xl' : 'w-12 h-12'}`}>
                {currentTrack?.thumbnail
                  ? <img src={currentTrack.thumbnail} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full bg-white/5 flex items-center justify-center text-white/20 text-xl">🎵</div>}
                {buffering && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                    <div className="w-4 h-4 border-2 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin" />
                  </div>
                )}
                {!isListening && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                    <span className={`${videoFS ? 'text-2xl' : 'text-xs'}`}>🔇</span>
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <div className="flex items-center gap-2">
                  <p className={`font-bold text-white truncate drop-shadow-sm ${videoFS ? 'text-2xl' : 'text-sm'}`}>
                    {currentTrack?.title || 'Parça seçilmedi'}
                  </p>
                  {!isListening && <span className="shrink-0 text-[9px] font-bold bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-md border border-red-500/30">SES KAPALI</span>}
                </div>
                
                {currentTrack?.addedByName && (
                  <p className={`text-white/50 truncate flex items-center gap-1.5 font-medium ${videoFS ? 'text-sm mt-1' : 'text-xs mt-0.5'}`}>
                    <span className="w-3.5 h-3.5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[8px] font-bold border border-emerald-500/30">
                      {currentTrack.addedByName[0]?.toUpperCase()}
                    </span>
                    {currentTrack.addedByName}
                    {isGeneric && <span className="ml-1 text-[9px] bg-white/10 px-1 py-0.5 rounded text-white/40">URL</span>}
                  </p>
                )}
              </div>
            </div>

            {currentTrack && permissions.canControl && (
              <div className="flex items-center gap-2 px-1">
                <span className={`tabular-nums font-medium font-mono text-right opacity-50 ${videoFS ? 'text-sm w-[45px]' : 'text-[10px] w-[32px]'}`}>
                  {formatTime(progress.playedSeconds)}
                </span>
                <div className="flex-1 relative group/seek py-1.5 flex items-center cursor-pointer"
                     onMouseDown={handleSeekStart} onTouchStart={handleSeekStart}
                     onMouseUp={handleSeekCommit} onTouchEnd={handleSeekCommit}
                     onMouseMove={(e) => {
                       if (seekingRef.current) handleSeekChange(e);
                     }}
                >
                  <input type="range" min={0} max={1} step={0.0001}
                    value={progress.played || 0}
                    onChange={handleSeekChange}
                    disabled={!permissions.canControl}
                    className={`w-full appearance-none bg-white/10 rounded-full transition-all duration-200 shadow-inner
                      ${videoFS ? 'h-1.5 group-hover/seek:h-2' : 'h-1 group-hover/seek:h-1.5'}
                      [&::-webkit-slider-thumb]:w-0 [&::-webkit-slider-thumb]:h-0 [&::-webkit-slider-thumb]:appearance-none
                      group-hover/seek:[&::-webkit-slider-thumb]:w-3 group-hover/seek:[&::-webkit-slider-thumb]:h-3
                      group-hover/seek:[&::-webkit-slider-thumb]:rounded-full group-hover/seek:[&::-webkit-slider-thumb]:bg-emerald-400
                      group-hover/seek:[&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(52,211,153,0.8)]
                      ${permissions.canControl ? 'cursor-pointer' : 'cursor-default pointer-events-none'}`}
                    style={{ background: `linear-gradient(to right, rgb(52 211 153) ${progress.played * 100}%, rgba(255,255,255,0.1) ${progress.played * 100}%)` }}
                  />
                </div>
                <span className={`tabular-nums font-medium font-mono opacity-50 ${videoFS ? 'text-sm w-[45px]' : 'text-[10px] w-[32px]'}`}>
                  {formatTime(duration)}
                </span>
              </div>
            )}

            <div className={`flex items-center justify-between w-full`}>
              <WatchPartyControls permissions={permissions} isPlaying={isPlaying}
                videoFS={videoFS}
                hasVideo={!!currentTrack}
                onPlayPause={handlePlayPause} onSkipNext={handleSkipNext} onSkipPrev={handleSkipPrev}
                onTogglePlaylist={() => handleTogglePanel('playlist')}
                onTogglePrefs={() => handleTogglePanel('prefs')}
                onToggleCoHost={() => handleTogglePanel('cohost')}
                activePanel={activePanel} />
            </div>
          </div>
        </div>

        {/* Panel açıkken dışarı tıklayınca kapansın diye tam ekran şeffaf katman */}
        <AnimatePresence>
          {activePanel && (
            <motion.div
              key="wp-panel-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[140] bg-transparent"
              onClick={() => setActivePanel(null)}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {activePanel === 'playlist' && (
            <WatchPartyPlaylist key="wp-panel-playlist" serverId={serverId} channelId={channelId}
              permissions={permissions} videoFS={videoFS}
              onPlayTrack={(t) => { if (permissions.canControl) hostSkip(t); setActivePanel(null); }}
              onClose={() => setActivePanel(null)} />
          )}
          {activePanel === 'prefs' && <WatchPartyUserPrefs key="wp-panel-prefs" videoFS={videoFS} onClose={() => setActivePanel(null)} />}
          {activePanel === 'cohost' && (
            <WatchPartyCoHostManager key="wp-panel-cohost" serverId={serverId} channelId={channelId} videoFS={videoFS}
              onClose={() => setActivePanel(null)} />
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );

  if (typeof window === "undefined") return null;
  return createPortal(playerContent, document.body);
}