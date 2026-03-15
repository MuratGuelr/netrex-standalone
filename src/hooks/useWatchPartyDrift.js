// src/hooks/useWatchPartyDrift.js
import { useEffect, useRef } from 'react';
import { useWatchPartyStore } from '@/src/store/watchPartyStore';
import {
  DRIFT_THRESHOLD_SECONDS,
  DRIFT_CHECK_INTERVAL_MS,
} from '@/src/constants/watchPartyConstants';

export function useWatchPartyDrift(playerRef) {
  const playbackState = useWatchPartyStore((s) => s.playbackState);
  const isListening   = useWatchPartyStore((s) => s.localPreferences.isListening);
  const intervalRef   = useRef(null);

  useEffect(() => {
    if (!isListening) return;

    intervalRef.current = setInterval(() => {
      if (!playbackState.isPlaying || !playbackState.startedAt) return;
      if (!playerRef.current?.getCurrentTime) return;

      const expected = (Date.now() - playbackState.startedAt) / 1000;
      const actual   = playerRef.current.getCurrentTime();
      const drift    = Math.abs(expected - actual);

      if (drift > DRIFT_THRESHOLD_SECONDS) {
        console.warn(`[WatchParty] Drift: ${drift.toFixed(2)}s → düzeltiliyor`);
        // seekTo doğrudan çağrılır — AbortError riski yok
        playerRef.current.seekTo(expected, 'seconds');
      }
    }, DRIFT_CHECK_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playbackState.isPlaying, playbackState.startedAt,
      isListening, playerRef]);
}
