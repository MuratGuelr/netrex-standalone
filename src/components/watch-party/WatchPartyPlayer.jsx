// src/components/watch-party/WatchPartyPlayer.jsx
"use client";

import React, {
  useRef, useState, useCallback, useEffect, useMemo,
} from "react";
import { createPortal } from "react-dom";
import ReactPlayer from "react-player";
import { motion, AnimatePresence } from "framer-motion";
import { useMaybeRoomContext } from "@livekit/components-react";
import { useWatchPartyStore } from "@/src/store/watchPartyStore";
import { useWatchPartySync } from "@/src/hooks/useWatchPartySync";
import { useWatchPartyDrift } from "@/src/hooks/useWatchPartyDrift";
import { useWatchPartyPermission } from "@/src/hooks/useWatchPartyPermission";
import { WatchPartyControls } from "./WatchPartyControls";
import { WatchPartyPlaylist } from "./WatchPartyPlaylist";
import { WatchPartyUserPrefs } from "./WatchPartyUserPrefs";
import { formatTime } from "@/src/utils/formatTime";
import {
  Minimize, Music, MonitorPlay,
  Play, Pause, SkipForward, SkipBack,
} from "lucide-react";

// ─── Yardımcı ───
function getYouTubeId(url) {
  if (!url) return null;
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([^&?\s#/]+)/
  );
  return m?.[1] || null;
}

// ════════════════════════════════════════════════════════════
// SoundCloud Player
// ════════════════════════════════════════════════════════════
function SoundCloudPlayer({
  trackUrl, shouldPlay, effectiveVolume,
  videoMode, videoFS, playerApiRef,
  onDuration, onProgress, onEnded, onReady,
}) {
  const iframeRef    = useRef(null);
  const isReadyRef   = useRef(false);
  const durationRef  = useRef(0);
  const currentTimeRef = useRef(0);
  const shouldPlayRef  = useRef(shouldPlay);
  const volumeRef      = useRef(effectiveVolume);
  // Duration polling timer ref - leak önlemi
  const durationTimerRef = useRef(null);

  shouldPlayRef.current = shouldPlay;
  volumeRef.current     = effectiveVolume;

  const post = useCallback((method, value) => {
    try {
      const msg = value !== undefined ? { method, value } : { method };
      iframeRef.current?.contentWindow?.postMessage(JSON.stringify(msg), "*");
    } catch {}
  }, []);

  // Message handler
  useEffect(() => {
    const handler = (event) => {
      if (!event.origin?.includes("soundcloud.com")) return;
      let data;
      try {
        data = typeof event.data === "string"
          ? JSON.parse(event.data) : event.data;
      } catch { return; }
      if (!data?.method) return;

      switch (data.method) {
        case "ready":
          isReadyRef.current = true;
          post("addEventListener", "playProgress");
          post("addEventListener", "finish");
          post("getDuration");
          post("setVolume", volumeRef.current * 100);
          playerApiRef.current = {
            seekTo: (s) => post("seekTo", s * 1000),
            getCurrentTime: () => currentTimeRef.current,
            getDuration: () => durationRef.current,
          };
          if (shouldPlayRef.current) setTimeout(() => post("play"), 500);
          onReady();
          break;

        case "getDuration":
          if (data.value > 0) {
            durationRef.current = data.value / 1000;
            onDuration(durationRef.current);
            // Duration alındı, timer'ı durdur
            if (durationTimerRef.current) {
              clearInterval(durationTimerRef.current);
              durationTimerRef.current = null;
            }
          }
          break;

        case "playProgress": {
          const ms  = data.value?.currentPosition || 0;
          const rel = data.value?.relativePosition || 0;
          currentTimeRef.current = ms / 1000;
          onProgress({ played: rel, playedSeconds: currentTimeRef.current });
          if (durationRef.current === 0 && rel > 0 && currentTimeRef.current > 0) {
            const est = currentTimeRef.current / rel;
            durationRef.current = est;
            onDuration(est);
          }
          break;
        }

        case "finish":
          onEnded();
          break;

        case "play":
          post("setVolume", volumeRef.current * 100);
          if (durationRef.current === 0) post("getDuration");
          break;
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [post, playerApiRef, onReady, onProgress, onDuration, onEnded]);

  // shouldPlay değişince play/pause
  useEffect(() => {
    if (!isReadyRef.current) return;
    post(shouldPlay ? "play" : "pause");
  }, [shouldPlay, post]);

  // Volume değişince set
  useEffect(() => {
    if (!isReadyRef.current) return;
    post("setVolume", effectiveVolume * 100);
  }, [effectiveVolume, post]);

  // Duration polling (ready olduğunda, henüz duration 0 ise)
  const handleIframeLoad = useCallback(() => {
    setTimeout(() => {
      post("addEventListener", "ready");
      post("addEventListener", "playProgress");
      post("addEventListener", "play");
      post("addEventListener", "pause");
      post("addEventListener", "finish");
      post("getDuration");

      // ✅ Cleanup'lı polling
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      durationTimerRef.current = setInterval(() => {
        if (durationRef.current > 0) {
          clearInterval(durationTimerRef.current);
          durationTimerRef.current = null;
          return;
        }
        if (isReadyRef.current) post("getDuration");
      }, 2000);
    }, 800);
  }, [post]);

  // Unmount temizliği
  useEffect(() => {
    return () => {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
    };
  }, []);

  const cleanUrl = trackUrl.split("?")[0];
  const src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(cleanUrl)}&color=%2350c878&auto_play=false&hide_related=true&show_comments=false&show_user=false&show_reposts=false&show_teaser=false&visual=${videoFS ? "true" : "false"}`;

  return (
    <iframe
      ref={iframeRef}
      src={src}
      onLoad={handleIframeLoad}
      width="100%"
      frameBorder="no"
      allow="autoplay"
      title="SoundCloud Player"
      className={videoFS ? "absolute inset-0 w-full h-full z-0" : ""}
      style={
        videoFS
          ? { height: "100%" }
          : videoMode
            ? { height: 166 }
            : { height: 1, opacity: 0, pointerEvents: "none", position: "absolute" }
      }
    />
  );
}

// ════════════════════════════════════════════════════════════
// YouTube Player
// ════════════════════════════════════════════════════════════
function YouTubePlayer({
  videoId, shouldPlay, effectiveVolume,
  videoMode, videoFS, ytQuality,
  onReady, onStateChange, onError, playerApiRef, ytPlayerRef,
}) {
  const wrapperRef       = useRef(null);
  const mountTargetRef   = useRef(null);
  const isReadyRef       = useRef(false);
  const currentVideoIdRef = useRef(null);
  const volumeRef        = useRef(effectiveVolume);
  const progressTimerRef = useRef(null); // ✅ leak önlemi

  volumeRef.current = effectiveVolume;

  // YT API yükle
  const [apiLoaded, setApiLoaded] = useState(() => !!window.YT?.Player);
  useEffect(() => {
    if (window.YT?.Player) { setApiLoaded(true); return; }
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
    const id = setInterval(() => {
      if (window.YT?.Player) { setApiLoaded(true); clearInterval(id); }
    }, 300);
    return () => clearInterval(id);
  }, []);

  // Player oluştur / videoId değişince loadVideoById
  useEffect(() => {
    if (!apiLoaded || !videoId || !wrapperRef.current) return;

    // Aynı video, player hazır → loadVideoById yeterli
    if (currentVideoIdRef.current === videoId && isReadyRef.current && ytPlayerRef.current) {
      try { ytPlayerRef.current.loadVideoById({ videoId, startSeconds: 0 }); } catch {}
      return;
    }

    // Önceki DOM node'unu kaldır
    if (mountTargetRef.current && wrapperRef.current.contains(mountTargetRef.current)) {
      try { wrapperRef.current.removeChild(mountTargetRef.current); } catch {}
    }

    const target = document.createElement("div");
    wrapperRef.current.appendChild(target);
    mountTargetRef.current  = target;
    currentVideoIdRef.current = videoId;
    isReadyRef.current      = false;

    const playerVars = {
      autoplay: 0, controls: 0, modestbranding: 1, rel: 0,
      playsinline: 1, iv_load_policy: 3, enablejsapi: 1,
      vq: ytQuality || "auto",
    };
    const isFile = window.location.protocol.startsWith("file");
    if (!isFile) playerVars.origin = window.location.origin;

    try {
      ytPlayerRef.current = new window.YT.Player(target, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars,
        events: {
          onReady: (e) => {
            isReadyRef.current = true;
            try {
              const iframe = e.target.getIframe();
              if (iframe) {
                iframe.style.cssText = "width:100%;height:100%;border:none;";
                iframe.setAttribute("allow",
                  "autoplay; encrypted-media; accelerometer; gyroscope; picture-in-picture");
                iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
              }
              const vol = Math.round(volumeRef.current * 100);
              e.target.setVolume(vol);
              if (vol === 0) e.target.mute(); else e.target.unMute();
            } catch {}

            // playerRef'i doldur
            playerApiRef.current = {
              seekTo: (s) => { try { ytPlayerRef.current?.seekTo(s, true); } catch {} },
              getCurrentTime: () => { try { return ytPlayerRef.current?.getCurrentTime() || 0; } catch { return 0; } },
              getDuration: () => { try { return ytPlayerRef.current?.getDuration() || 0; } catch { return 0; } },
            };

            onReady(e);
          },
          onStateChange: (e) => {
            if (e.data === window.YT?.PlayerState?.PLAYING) {
              const vol = Math.round(volumeRef.current * 100);
              try { e.target.setVolume(vol); if (vol === 0) e.target.mute(); else e.target.unMute(); } catch {}
            }
            onStateChange(e);
          },
          onError: onError,
        },
      });
    } catch (err) {
      console.error("[WatchParty] YT create error:", err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiLoaded, videoId]);

  // shouldPlay değişince play/pause
  useEffect(() => {
    if (!isReadyRef.current || !ytPlayerRef.current) return;
    try {
      if (shouldPlay) ytPlayerRef.current.playVideo();
      else ytPlayerRef.current.pauseVideo();
    } catch {}
  }, [shouldPlay, ytPlayerRef]);

  // Volume
  useEffect(() => {
    if (!isReadyRef.current || !ytPlayerRef.current) return;
    try {
      const vol = Math.round(effectiveVolume * 100);
      ytPlayerRef.current.setVolume(vol);
      if (vol === 0) ytPlayerRef.current.mute(); else ytPlayerRef.current.unMute();
    } catch {}
  }, [effectiveVolume, ytPlayerRef]);

  // Quality
  useEffect(() => {
    if (!isReadyRef.current || !ytPlayerRef.current) return;
    try { ytPlayerRef.current.setPlaybackQuality(ytQuality || "auto"); } catch {}
  }, [ytQuality, ytPlayerRef]);

  // ✅ Cleanup
  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      isReadyRef.current = false;
      currentVideoIdRef.current = null;
      try { ytPlayerRef.current?.destroy(); } catch {}
      ytPlayerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={wrapperRef}
      className={`w-full bg-black pointer-events-none select-none
        ${videoFS ? "absolute inset-0 h-full z-0" : ""}`}
      style={videoFS ? { height: "100%" } : { height: videoMode ? 190 : 0 }}
    />
  );
}

// ════════════════════════════════════════════════════════════
// Ana Player
// ════════════════════════════════════════════════════════════
export function WatchPartyPlayer({ serverId, channelId }) {
  const room        = useMaybeRoomContext();
  const playerRef   = useRef(null);
  const ytPlayerRef = useRef(null);
  const lastSeekTimeRef = useRef(0);
  const seekingRef  = useRef(false);

  const [progress, setProgress] = useState({ played: 0, playedSeconds: 0 });
  const [duration,  setDuration]  = useState(0);
  const [buffering, setBuffering] = useState(false);
  const [activePanel, setActivePanel] = useState(null); // 'playlist' | 'prefs' | null
  const [isMouseIdle, setIsMouseIdle] = useState(false);
  const idleTimerRef = useRef(null);
  // SSR guard
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // ─── Store ───
  const currentTrack  = useWatchPartyStore((s) => s.currentTrack);
  const isPlaying     = useWatchPartyStore((s) => s.playbackState.isPlaying);
  const isMuted       = useWatchPartyStore((s) => s.localPreferences.isMuted);
  const localVolume   = useWatchPartyStore((s) => s.localPreferences.volume);
  const videoMode     = useWatchPartyStore((s) => s.localPreferences.videoMode);
  const videoFS       = useWatchPartyStore((s) => s.localPreferences.videoFullscreen);
  const showPlayer    = useWatchPartyStore((s) => s.localPreferences.showPlayer);
  const ytQuality     = useWatchPartyStore((s) => s.localPreferences.videoQuality) || "auto";
  const playlist      = useWatchPartyStore((s) => s.playlist);
  const toggleFS      = useWatchPartyStore((s) => s.toggleFullscreen);
  const setLocalPref  = useWatchPartyStore((s) => s.setLocalPref);

  const effectiveVolume = isMuted ? 0 : localVolume / 100;
  const shouldPlay      = isPlaying;

  const videoId      = useMemo(() => getYouTubeId(currentTrack?.url), [currentTrack?.url]);
  const isYouTube    = !!videoId;
  const isSoundCloud = !isYouTube && !!currentTrack?.url?.includes("soundcloud.com");
  const isGeneric    = !isYouTube && !isSoundCloud && !!currentTrack?.url;

  const permissions = useWatchPartyPermission(serverId);
  const { hostPlay, hostPause, hostSeek, hostSkip, autoAdvance } =
    useWatchPartySync(room, playerRef, serverId, channelId);
  useWatchPartyDrift(playerRef);

  const handleTogglePanel = useCallback(
    (panel) => setActivePanel((p) => (p === panel ? null : panel)),
    []
  );

  // ─── YouTube ilerleme polling (cleanup'lı) ───
  const ytProgressTimerRef = useRef(null);
  useEffect(() => {
    if (!isYouTube) return;
    ytProgressTimerRef.current = setInterval(() => {
      try {
        if (!ytPlayerRef.current?.getCurrentTime) return;
        const t = ytPlayerRef.current.getCurrentTime() || 0;
        const d = ytPlayerRef.current.getDuration()    || 0;
        if (d > 0 && duration === 0) setDuration(d);
        if (!seekingRef.current && Date.now() - lastSeekTimeRef.current > 1000)
          setProgress({ played: d > 0 ? t / d : 0, playedSeconds: t });
      } catch {}
    }, 500);
    return () => {
      if (ytProgressTimerRef.current) {
        clearInterval(ytProgressTimerRef.current);
        ytProgressTimerRef.current = null;
      }
    };
  }, [isYouTube, duration]);

  // ─── YouTube callbacks ───
  const handleYTReady = useCallback(() => {
    setBuffering(false);
    try {
      const d = ytPlayerRef.current?.getDuration();
      if (d > 0) setDuration(d);
    } catch {}
    const { playbackState } = useWatchPartyStore.getState();
    if (playbackState.isPlaying && playbackState.startedAt) {
      const pos = (Date.now() - playbackState.startedAt) / 1000;
      try { ytPlayerRef.current?.seekTo(pos, true); } catch {}
      try { ytPlayerRef.current?.playVideo(); } catch {}
    }
  }, []);

  const handleYTState = useCallback((event) => {
    const s = event.data;
    const YTState = window.YT?.PlayerState;
    if (s === YTState?.ENDED && permissions.canControl) autoAdvance();
    if (s === YTState?.BUFFERING) setBuffering(true);
    if (s === YTState?.PLAYING) {
      setBuffering(false);
      try {
        const d = ytPlayerRef.current?.getDuration();
        if (d > 0 && duration === 0) setDuration(d);
      } catch {}
    }
    if (s === YTState?.PAUSED) setBuffering(false);
  }, [permissions.canControl, autoAdvance, duration]);

  // ─── SoundCloud callbacks ───
  const handleSCReady = useCallback(() => {
    setBuffering(false);
    const { playbackState } = useWatchPartyStore.getState();
    if (playbackState.isPlaying && playbackState.startedAt) {
      const pos = (Date.now() - playbackState.startedAt) / 1000;
      setTimeout(() => { try { playerRef.current?.seekTo?.(pos); } catch {} }, 300);
    }
  }, []);

  const handleSCDuration = useCallback((dur) => {
    if (dur > 0) setDuration(dur);
  }, []);

  const handleSCProgress = useCallback((state) => {
    if (!seekingRef.current && Date.now() - lastSeekTimeRef.current > 1000) setProgress(state);
  }, []);

  const handleSCEnded = useCallback(() => {
    if (permissions.canControl) autoAdvance();
  }, [permissions.canControl, autoAdvance]);

  // ─── Generic ReactPlayer callbacks ───
  const handleRPReady = useCallback(() => {
    setBuffering(false);
    const d = playerRef.current?.getDuration?.();
    if (d > 0) setDuration(d);
    const { playbackState } = useWatchPartyStore.getState();
    if (playbackState.isPlaying && playbackState.startedAt) {
      const pos = (Date.now() - playbackState.startedAt) / 1000;
      playerRef.current?.seekTo?.(Math.max(0, pos), "seconds");
    }
  }, []);

  const handleRPProgress = useCallback((state) => {
    if (!seekingRef.current && Date.now() - lastSeekTimeRef.current > 1000) setProgress(state);
    if (duration === 0 && playerRef.current?.getDuration) {
      const d = playerRef.current.getDuration();
      if (d > 0 && isFinite(d)) setDuration(d);
    }
  }, [duration]);

  const handleRPEnded = useCallback(() => {
    if (permissions.canControl) autoAdvance();
  }, [permissions.canControl, autoAdvance]);

  const handleRPError = useCallback((err) => {
    setBuffering(false);
    const msg = err?.message || String(err || "");
    if (msg.includes("AbortError") || msg.includes("interrupted")) return;
    console.warn("[WatchParty] ReactPlayer error:", err);
  }, []);

  // ─── Generic duration polling (cleanup'lı) ───
  const genericDurTimerRef = useRef(null);
  useEffect(() => {
    if (isYouTube || isSoundCloud || !currentTrack?.url || duration > 0) return;
    genericDurTimerRef.current = setInterval(() => {
      if (playerRef.current?.getDuration) {
        const d = playerRef.current.getDuration();
        if (d > 0 && isFinite(d)) {
          setDuration(d);
          clearInterval(genericDurTimerRef.current);
          genericDurTimerRef.current = null;
        }
      }
    }, 1000);
    return () => {
      if (genericDurTimerRef.current) {
        clearInterval(genericDurTimerRef.current);
        genericDurTimerRef.current = null;
      }
    };
  }, [currentTrack?.url, duration, isYouTube, isSoundCloud]);

  // ─── Track sıfırla ───
  const prevTrackUrlRef = useRef(null);
  useEffect(() => {
    const url = currentTrack?.url;
    if (!url || url === prevTrackUrlRef.current) return;
    prevTrackUrlRef.current = url;
    setBuffering(true);
    setProgress({ played: 0, playedSeconds: 0 });
    setDuration(0);
    setLocalPref("videoMode", true);
  }, [currentTrack?.url, setLocalPref]);

  useEffect(() => {
    if (!currentTrack) setLocalPref("videoMode", false);
  }, [currentTrack, setLocalPref]);

  // ─── Kontrol handlers ───
  const handleSeekChange = useCallback((e) => {
    if (!permissions.canControl) return;
    const val = parseFloat(e.target.value);
    setProgress({ played: val, playedSeconds: val * duration });
  }, [permissions.canControl, duration]);

  const handleSeekStart = useCallback(() => {
    if (permissions.canControl) seekingRef.current = true;
  }, [permissions.canControl]);

  const handleSeekCommit = useCallback((e) => {
    if (!permissions.canControl) return;
    seekingRef.current = false;
    lastSeekTimeRef.current = Date.now();
    hostSeek(parseFloat(e.target.value) * duration);
  }, [permissions.canControl, duration, hostSeek]);

  const handlePlayPause = useCallback(() => {
    if (!permissions.canControl) return;
    if (isPlaying) hostPause();
    else hostPlay(currentTrack, progress.playedSeconds);
  }, [permissions.canControl, isPlaying, hostPause, hostPlay, currentTrack, progress.playedSeconds]);

  const handleSkipNext = useCallback(() => {
    if (!permissions.canControl) return;
    const sorted = useWatchPartyStore.getState().getSortedPlaylist();
    const idx    = sorted.findIndex((t) => t.id === currentTrack?.id);
    const next   = sorted[idx + 1] || sorted[0];
    if (next && next.id !== currentTrack?.id) hostSkip(next);
  }, [permissions.canControl, currentTrack, hostSkip]);

  const handleSkipPrev = useCallback(() => {
    if (!permissions.canControl) return;
    const idx = playlist.findIndex((t) => t.id === currentTrack?.id);
    if (idx > 0) hostSkip(playlist[idx - 1]);
  }, [permissions.canControl, playlist, currentTrack, hostSkip]);

  // ─── Fullscreen ───
  useEffect(() => {
    const h = () => {
      const fs = !!document.fullscreenElement;
      const { localPreferences, setLocalPref: set } = useWatchPartyStore.getState();
      if (localPreferences.videoFullscreen !== fs) set("videoFullscreen", fs);
    };
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  useEffect(() => {
    const el = document.getElementById("wp-player-root");
    if (!el) return;
    if (videoFS && !document.fullscreenElement)
      el.requestFullscreen?.().catch(() => {});
    else if (!videoFS && document.fullscreenElement)
      document.exitFullscreen?.().catch(() => {});
  }, [videoFS]);

  useEffect(() => {
    if (!videoFS) return;
    const h = (e) => {
      if (e.key === "Escape" && !document.fullscreenElement) toggleFS();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [videoFS, toggleFS]);

  // ─── Mouse idle (fullscreen'de kontrolleri gizle) ───
  useEffect(() => {
    if (!videoFS) { setIsMouseIdle(false); return; }

    const reset = () => {
      setIsMouseIdle(false);
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => setIsMouseIdle(true), 3000);
    };
    reset();
    window.addEventListener("mousemove", reset);
    window.addEventListener("mousedown", reset);
    window.addEventListener("keydown",   reset);
    return () => {
      clearTimeout(idleTimerRef.current);
      window.removeEventListener("mousemove", reset);
      window.removeEventListener("mousedown", reset);
      window.removeEventListener("keydown",   reset);
    };
  }, [videoFS]);

  // ═══════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════
  if (!mounted) return null;

  const videoAreaHeight = videoFS ? "100%" : videoMode ? 190 : 0;

  const content = (
    <motion.div
      id="wp-player-root"
      initial={false}
      animate={
        showPlayer
          ? { opacity: 1, y: 0, scale: 1, pointerEvents: "auto" }
          : { opacity: 0, y: 16, scale: 0.97, pointerEvents: "none" }
      }
      transition={{ type: "spring", damping: 28, stiffness: 320 }}
      className={
        videoFS
          ? "fixed inset-0 z-[200] flex bg-black"
          : "fixed top-16 right-4 z-[100] flex flex-row-reverse items-start gap-3"
      }
    >
      {/* ── ANA OYNATICI KARTI ── */}
      <div
        className={`relative flex pointer-events-auto transition-all duration-300
          ${videoFS
            ? "flex-col w-full h-full"
            : "flex-col w-[340px] bg-zinc-900/95 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl"
          }`}
      >
        {/* Arka plan görseli (sadece normal modda) */}
        {!videoFS && currentTrack?.thumbnail && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
            <img
              src={currentTrack.thumbnail}
              alt=""
              className="w-full h-full object-cover blur-2xl scale-125 opacity-15"
            />
          </div>
        )}

        {/* ══ VİDEO ALANI ══ */}
        <div
          className={`relative transition-all duration-300 bg-black
            ${videoFS ? "absolute inset-0 w-full h-full z-0" : "w-full rounded-t-2xl overflow-hidden"}`}
          style={{ height: videoAreaHeight }}
        >
          {/* Küçült butonu */}
          {!videoFS && (
            <button
              onClick={() => useWatchPartyStore.getState().togglePlayer()}
              className="absolute top-2.5 right-2.5 z-[50] p-1.5
                         bg-black/50 hover:bg-black/70 backdrop-blur-sm
                         rounded-lg border border-white/10 text-white/50 hover:text-white
                         transition-all active:scale-90 shadow-lg"
              title="Küçült"
            >
              <Minimize size={13} strokeWidth={2.5} />
            </button>
          )}

          {/* ── Player Container (Always Mounted if track exists) ── */}
          <div className="w-full h-full relative">
            <AnimatePresence>
              {(!currentTrack || (!videoMode && !videoFS)) && (
                <motion.div
                  key="placeholder"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex flex-col items-center justify-center
                             text-white/20 bg-zinc-900 z-10"
                >
                  <MonitorPlay size={40} className="mb-2 opacity-40" />
                  <span className="text-xs font-medium">
                    {!currentTrack ? "Video bekleniyor..." : "Video gizli"}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {currentTrack && (
              <div
                className="w-full h-full transition-opacity duration-300"
                style={{
                  opacity: (videoMode || videoFS) ? 1 : 0,
                  pointerEvents: (videoMode || videoFS) ? "auto" : "none"
                }}
              >
                {isYouTube && (
                  <YouTubePlayer
                    videoId={videoId}
                    shouldPlay={shouldPlay}
                    effectiveVolume={effectiveVolume}
                    videoMode={videoMode}
                    videoFS={videoFS}
                    ytQuality={ytQuality}
                    onReady={handleYTReady}
                    onStateChange={handleYTState}
                    onError={(e) => console.warn("[WatchParty] YT error:", e?.data)}
                    playerApiRef={playerRef}
                    ytPlayerRef={ytPlayerRef}
                  />
                )}
                {isSoundCloud && (
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
                  <div className="w-full h-full">
                    <ReactPlayer
                      ref={playerRef}
                      url={currentTrack.url}
                      playing={shouldPlay}
                      volume={effectiveVolume}
                      muted={effectiveVolume === 0}
                      onReady={handleRPReady}
                      onProgress={handleRPProgress}
                      onEnded={handleRPEnded}
                      onError={handleRPError}
                      progressInterval={500}
                      width="100%"
                      height="100%"
                      config={{
                        file: { attributes: { crossOrigin: "anonymous", preload: "auto" } },
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ══ KONTROL PANELİ ══ */}
        <div
          className={`flex flex-col z-[150] transition-all duration-500
            ${videoFS
              ? `absolute bottom-0 left-0 right-0 px-10 pt-8 pb-8
                 bg-gradient-to-t from-black/90 via-black/60 to-transparent
                 ${isMouseIdle ? "opacity-0 pointer-events-none" : "opacity-100"}`
              : "relative p-4 gap-3"
            }`}
        >
          <div className={`flex items-center gap-3 ${videoFS ? "mb-4" : ""}`}>
            <div className={`relative rounded-xl overflow-hidden shrink-0 border border-white/10
              ${videoFS ? "w-16 h-16" : "w-12 h-12"}`}>
              {currentTrack?.thumbnail ? (
                <img src={currentTrack.thumbnail} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-white/5 flex items-center justify-center">
                  <Music size={18} className="text-white/20" />
                </div>
              )}
              {buffering && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className={`font-bold text-white truncate ${videoFS ? "text-xl" : "text-sm"}`}>
                {currentTrack?.title || "Parça seçilmedi"}
              </p>
              {currentTrack?.addedByName && (
                <p className={`text-white/50 truncate mt-0.5 ${videoFS ? "text-sm" : "text-xs"}`}>
                  {currentTrack.addedByName}
                </p>
              )}
            </div>
          </div>

          {currentTrack && (
            <div className="flex flex-col gap-1">
              <div
                className="relative group/seek h-5 flex items-center cursor-pointer"
                onMouseDown={handleSeekStart}
                onTouchStart={handleSeekStart}
                onMouseUp={handleSeekCommit}
                onTouchEnd={handleSeekCommit}
                onMouseMove={(e) => { if (seekingRef.current) handleSeekChange(e); }}
              >
                <div className="absolute inset-x-0 h-1 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 rounded-full transition-all duration-75"
                    style={{ width: `${(progress.played || 0) * 100}%` }}
                  />
                </div>
                <input
                  type="range" min={0} max={1} step={0.0001}
                  value={progress.played || 0}
                  onChange={handleSeekChange}
                  disabled={!permissions.canControl}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-default"
                />
                <div
                  className="absolute w-3 h-3 bg-white rounded-full shadow-md
                             opacity-0 group-hover/seek:opacity-100 transition-opacity pointer-events-none"
                  style={{ left: `calc(${(progress.played || 0) * 100}% - 6px)` }}
                />
              </div>

              <div className="flex justify-between px-0.5">
                <span className="text-[11px] tabular-nums font-mono text-white/40">
                  {formatTime(progress.playedSeconds)}
                </span>
                <span className="text-[11px] tabular-nums font-mono text-white/40">
                  {formatTime(duration)}
                </span>
              </div>
            </div>
          )}

          <div className={`flex items-center ${videoFS ? "gap-6" : "gap-2"}`}>
            <button
              onClick={handleSkipPrev}
              disabled={!permissions.canControl}
              className="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white
                         transition-all active:scale-90 disabled:opacity-30 disabled:cursor-default"
            >
              <SkipBack size={videoFS ? 22 : 18} fill="currentColor" />
            </button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.93 }}
              onClick={handlePlayPause}
              disabled={!permissions.canControl}
              className={`flex items-center justify-center rounded-full bg-white text-black
                           shadow-lg hover:bg-gray-100 transition-colors
                           disabled:opacity-40 disabled:cursor-default
                           ${videoFS ? "w-14 h-14" : "w-9 h-9"}`}
            >
              {isPlaying
                ? <Pause size={videoFS ? 24 : 18} fill="currentColor" />
                : <Play  size={videoFS ? 24 : 18} fill="currentColor" className="ml-0.5" />
              }
            </motion.button>

            <button
              onClick={handleSkipNext}
              disabled={!permissions.canControl}
              className="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white
                         transition-all active:scale-90 disabled:opacity-30 disabled:cursor-default"
            >
              <SkipForward size={videoFS ? 22 : 18} fill="currentColor" />
            </button>

            <div className="ml-auto">
              <WatchPartyControls
                videoFS={videoFS}
                hasVideo={!!currentTrack}
                onTogglePlaylist={() => handleTogglePanel("playlist")}
                onTogglePrefs={() => handleTogglePanel("prefs")}
                activePanel={activePanel}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── YAN PANEL (Sol taraf) ── */}
      <AnimatePresence mode="sync">
        {activePanel === "playlist" && (
          <WatchPartyPlaylist
            key="panel-playlist"
            serverId={serverId}
            channelId={channelId}
            permissions={permissions}
            videoFS={videoFS}
            onPlayTrack={(t) => {
              if (permissions.canControl) hostSkip(t);
              setActivePanel(null);
            }}
            onClose={() => setActivePanel(null)}
          />
        )}
        {activePanel === "prefs" && (
          <WatchPartyUserPrefs
            key="panel-prefs"
            videoFS={videoFS}
            onClose={() => setActivePanel(null)}
          />
        )}
      </AnimatePresence>

      {/* Backdrop (fullscreen panel kapatma) */}
      <AnimatePresence>
        {activePanel && videoFS && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[140]"
            onClick={() => setActivePanel(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );

  return createPortal(content, document.body);
}