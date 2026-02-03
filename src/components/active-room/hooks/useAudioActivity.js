import { useEffect, useState, useCallback, useRef } from "react";
import { useParticipantInfo } from "@livekit/components-react";
import { Track, RoomEvent } from "livekit-client";

// ============================================
// 🚀 SHARED AUDIO CONTEXT (Tüm hooklar paylaşır)
// ============================================
let sharedAudioContext = null;

const getSharedAudioContext = () => {
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    const AC = window.AudioContext || window.webkitAudioContext;
    sharedAudioContext = new AC({ latencyHint: 'interactive' });
  }
  if (sharedAudioContext.state === 'suspended') {
    sharedAudioContext.resume();
  }
  return sharedAudioContext;
};

export function useAudioActivity(participant) {
  const [isActive, setIsActive] = useState(false);
  const { isMuted } = useParticipantInfo({ participant });
  
  // ============================================
  // REF'LER (Cleanup için)
  // ============================================
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const intervalRef = useRef(null);
  const currentTrackRef = useRef(null);
  const lastStateRef = useRef(false);
  const visibilityHandlerRef = useRef(null);

  // ============================================
  // CLEANUP
  // ============================================
  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (visibilityHandlerRef.current) {
      document.removeEventListener('visibilitychange', visibilityHandlerRef.current);
      visibilityHandlerRef.current = null;
    }
    
    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch (e) {
        // Already disconnected
      }
      sourceRef.current = null;
    }
    
    analyserRef.current = null;
    currentTrackRef.current = null;
    lastStateRef.current = false;
  }, []);

  // ============================================
  // ACTIVITY CHECK
  // ============================================
  const checkActivity = useCallback(() => {
    if (!analyserRef.current || !currentTrackRef.current) {
      cleanup();
      setIsActive(false);
      return;
    }

    const track = currentTrackRef.current;
    if (!track.mediaStreamTrack || track.mediaStreamTrack.readyState === "ended") {
      cleanup();
      setIsActive(false);
      return;
    }

    try {
      const data = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(data);
      
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      
      const newState = sum / data.length > 8;
      
      // ✅ Sadece değiştiğinde state update
      if (newState !== lastStateRef.current) {
        lastStateRef.current = newState;
        setIsActive(newState);
      }
    } catch (e) {
      cleanup();
      setIsActive(false);
    }
  }, [cleanup]);

  // ============================================
  // SETUP
  // ============================================
  const setup = useCallback((track) => {
    if (!track?.mediaStreamTrack || track.mediaStreamTrack.kind !== "audio") {
      return;
    }

    if (track.mediaStreamTrack.readyState === "ended" || !track.mediaStreamTrack.enabled) {
      return;
    }

    // ✅ Aynı track ise skip
    if (currentTrackRef.current === track) return;

    // ✅ Eski track varsa temizle
    if (currentTrackRef.current) {
      cleanup();
    }

    currentTrackRef.current = track;

    try {
      const ctx = getSharedAudioContext();  // ✅ Shared context
      
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 32;  // ✅ 128 → 32 (sadece RMS için yeterli)
      analyser.smoothingTimeConstant = 0.3;
      analyserRef.current = analyser;

      const mediaStream = new MediaStream([track.mediaStreamTrack]);
      const audioTracks = mediaStream.getAudioTracks();
      
      if (audioTracks.length === 0 || !audioTracks[0].enabled) {
        cleanup();
        return;
      }

      const source = ctx.createMediaStreamSource(mediaStream);
      source.connect(analyser);
      sourceRef.current = source;

      // İlk kontrol
      checkActivity();
      
      // ✅ Interval: 400ms (250ms → 400ms)
      intervalRef.current = setInterval(checkActivity, 400);
      
      // ✅ Visibility handler
      const visibilityHandler = () => {
        if (document.hidden) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        } else {
          if (!intervalRef.current && currentTrackRef.current?.mediaStreamTrack?.readyState !== "ended") {
            intervalRef.current = setInterval(checkActivity, 400);
          }
        }
      };
      
      visibilityHandlerRef.current = visibilityHandler;
      document.addEventListener('visibilitychange', visibilityHandler);
      
    } catch (e) {
      cleanup();
      if (process.env.NODE_ENV === "development") {
        console.warn("Audio activity detection error:", e);
      }
    }
  }, [cleanup, checkActivity]);

  // ============================================
  // EVENT HANDLERS (useCallback ile)
  // ============================================
  const handleTrackSubscribed = useCallback((track, publication) => {
    if (publication?.source === Track.Source.Microphone && track) {
      setTimeout(() => setup(track), 100);
    }
  }, [setup]);

  const handleTrackPublished = useCallback((publication) => {
    if (publication?.source === Track.Source.Microphone && publication.track) {
      setTimeout(() => setup(publication.track), 200);
    }
  }, [setup]);

  const handleTrackUnpublished = useCallback((publication) => {
    if (publication?.source === Track.Source.Microphone) {
      cleanup();
      setIsActive(false);
    }
  }, [cleanup]);

  // ============================================
  // MAIN EFFECT
  // ============================================
  useEffect(() => {
    // ✅ Early return effect içinde
    if (!participant?.isLocal || isMuted) {
      cleanup();
      setIsActive(false);
      return;
    }

    // İlk setup
    const trySetup = async () => {
      for (let i = 0; i < 15; i++) {
        const pub = participant.getTrackPublication(Track.Source.Microphone);
        if (pub?.track?.mediaStreamTrack?.readyState !== "ended") {
          setup(pub.track);
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    };

    trySetup();

    // Event listeners
    participant.on(RoomEvent.TrackPublished, handleTrackPublished);
    
    if (!participant.isLocal) {
      participant.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
      participant.on(RoomEvent.TrackUnpublished, handleTrackUnpublished);
    }

    return () => {
      cleanup();
      participant.off(RoomEvent.TrackPublished, handleTrackPublished);
      if (!participant.isLocal) {
        participant.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
        participant.off(RoomEvent.TrackUnpublished, handleTrackUnpublished);
      }
    };
  }, [participant, isMuted, setup, cleanup, handleTrackPublished, handleTrackSubscribed, handleTrackUnpublished]);

  return isActive;
}