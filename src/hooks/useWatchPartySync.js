// src/hooks/useWatchPartySync.js
import { useEffect, useCallback, useRef } from 'react';
import { DataPacket_Kind } from 'livekit-client';
import { useWatchPartyStore } from '@/src/store/watchPartyStore';
import { useWatchPartyPermission } from '@/src/hooks/useWatchPartyPermission';
import { WP_ACTIONS } from '@/src/constants/watchPartyConstants';
import {
  setCurrentTrackInDb,
  updatePlaybackInDb,
} from '@/src/services/watchPartyService';

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

// ─── Güvenli seek helper — sadece property ataması, AbortError üretmez ───
function seekPlayer(playerRef, seconds) {
  try {
    playerRef.current?.seekTo?.(seconds, 'seconds');
  } catch (err) {
    console.warn('[WatchParty] seekTo error:', err);
  }
}

export function useWatchPartySync(room, playerRef, serverId, channelId) {
  const {
    setPlaybackState,
    setCurrentTrack,
    playbackState,
    currentTrack,
    getSortedPlaylist,
  } = useWatchPartyStore();

  const permissions = useWatchPartyPermission(serverId);
  const permRef     = useRef(permissions);

  useEffect(() => {
    permRef.current = permissions;
  }, [permissions]);

  // ═══════════════════════════════════════
  // BROADCAST
  // ═══════════════════════════════════════
  const broadcast = useCallback((action, payload = {}) => {
    if (!room) return;

    const message = JSON.stringify({
      type: 'WATCH_PARTY',
      action,
      payload: { ...payload, timestamp: Date.now() },
    });

    room.localParticipant.publishData(
      ENCODER.encode(message),
      DataPacket_Kind.RELIABLE
    );
  }, [room]);

  // ═══════════════════════════════════════
  // KONTROL FONKSİYONLARI
  // ═══════════════════════════════════════

  const hostPlay = useCallback((track, seekPos = 0) => {
    if (!permRef.current.canControl) return;

    const now = Date.now();
    const state = {
      isPlaying: true,
      startedAt: now - (seekPos * 1000),
      seekPosition: seekPos,
      lastUpdated: now,
    };

    setPlaybackState(state);
    if (track) setCurrentTrack(track);

    broadcast(WP_ACTIONS.PLAY, {
      track: track || currentTrack,
      startedAt: state.startedAt,
      seekPosition: seekPos,
    });

    // Firebase: sadece yeni track başladığında snapshot güncelle
    if (track) {
      setCurrentTrackInDb(serverId, channelId, track).catch(console.error);
    }
  }, [broadcast, currentTrack, setPlaybackState, setCurrentTrack,
      serverId, channelId]);

  const hostPause = useCallback(() => {
    if (!permRef.current.canControl) return;
    if (!playerRef.current) return;

    const currentTime = playerRef.current.getCurrentTime?.() || 0;
    const state = {
      isPlaying: false,
      seekPosition: currentTime,
      lastUpdated: Date.now(),
    };

    setPlaybackState(state);
    broadcast(WP_ACTIONS.PAUSE, { position: currentTime });

    // Firebase'e sadece durduğumuz son konumu checkpoint olarak yaz
    updatePlaybackInDb(serverId, channelId, state).catch(console.error);
  }, [broadcast, setPlaybackState, playerRef, serverId, channelId]);

  const hostSeek = useCallback((position) => {
    if (!permRef.current.canControl) return;

    const now = Date.now();
    const state = {
      isPlaying: true,
      startedAt: now - (position * 1000),
      seekPosition: position,
      lastUpdated: now,
    };

    setPlaybackState(state);
    broadcast(WP_ACTIONS.SEEK, { position, startedAt: state.startedAt });

    // Kendi player'ımızı da seek et
    seekPlayer(playerRef, position);
  }, [broadcast, setPlaybackState, serverId, channelId, playerRef]);

  const hostSkip = useCallback((nextTrack) => {
    if (!permRef.current.canControl) return;

    setCurrentTrack(nextTrack);
    const now = Date.now();
    const state = {
      isPlaying: true,
      startedAt: now,
      seekPosition: 0,
      lastUpdated: now,
    };

    setPlaybackState(state);
    broadcast(WP_ACTIONS.SKIP, { track: nextTrack });
    // Firebase: sadece track değişimini yansıt (snapshot)
    setCurrentTrackInDb(serverId, channelId, nextTrack).catch(console.error);
  }, [broadcast, setPlaybackState, setCurrentTrack, serverId, channelId]);

  const autoAdvance = useCallback(() => {
    if (!permRef.current.canControl) return;

    const sorted = getSortedPlaylist();
    const remaining = sorted.filter((t) => t.id !== currentTrack?.id);

    if (remaining.length > 0) {
      hostSkip(remaining[0]);
    } else {
      hostPause();
    }
  }, [getSortedPlaylist, currentTrack, hostSkip, hostPause]);

  // ═══════════════════════════════════════
  // ALMA (DataChannel)
  // ═══════════════════════════════════════
  useEffect(() => {
    if (!room) return;

    const handleData = (payload, participant) => {
      if (participant?.identity === room.localParticipant.identity) return;

      try {
        const msg = JSON.parse(DECODER.decode(payload));
        if (msg.type !== 'WATCH_PARTY') return;

        const { action, payload: data } = msg;

        // BILGISAYAR SAATLERI FARKI OLDUGU ICIN (örn: biri 10s ileri)
        // Karsi tarafin yolladigi startedAt veya timestamp DEGERINI DIKKATE ALMIYORUZ.
        // Mesaj aninda (50ms) gelir. O andaki yerel Date.now() gercek zamandir.
        
        switch (action) {
          case WP_ACTIONS.PLAY: {
            if (data.track) setCurrentTrack(data.track);
            const localStartedAt = Date.now() - ((data.seekPosition || 0) * 1000);
            
            setPlaybackState({
              isPlaying: true,
              startedAt: localStartedAt,
              seekPosition: data.seekPosition,
              lastUpdated: Date.now(),
            });
            // Oynatici gecikmesi toleransi icerisinde baslar
            seekPlayer(playerRef, data.seekPosition);
            break;
          }

          case WP_ACTIONS.PAUSE: {
            setPlaybackState({
              isPlaying: false,
              seekPosition: data.position,
              lastUpdated: Date.now(),
            });
            seekPlayer(playerRef, data.position);
            break;
          }

          case WP_ACTIONS.SEEK: {
            const localStartedAt = Date.now() - ((data.position || 0) * 1000);
            
            setPlaybackState({
              isPlaying: true,
              startedAt: localStartedAt,
              seekPosition: data.position,
              lastUpdated: Date.now(),
            });
            seekPlayer(playerRef, data.position);
            break;
          }

          case WP_ACTIONS.SKIP: {
            if (data.track) setCurrentTrack(data.track);
            
            setPlaybackState({
              isPlaying: true,
              startedAt: Date.now(),
              seekPosition: 0,
              lastUpdated: Date.now(),
            });
            break;
          }

          case WP_ACTIONS.SYNC_REQ: {
            if (permRef.current.canControl && playerRef.current) {
              const curTime = playerRef.current.getCurrentTime?.() || 0;
              broadcast(WP_ACTIONS.SYNC_RESP, {
                track: useWatchPartyStore.getState().currentTrack,
                isPlaying: useWatchPartyStore.getState().playbackState.isPlaying,
                position: curTime,
                // Karsi taraf hesaplayacak ama DB geriye donuklugu icin tut
                startedAt: Date.now() - (curTime * 1000),
              });
            }
            break;
          }

          case WP_ACTIONS.SYNC_RESP: {
            if (data.track) setCurrentTrack(data.track);
            
            const pos = data.position || 0;
            const localStartedAt = Date.now() - (pos * 1000);
            
            setPlaybackState({
              isPlaying: data.isPlaying,
              startedAt: localStartedAt,
              seekPosition: pos,
              lastUpdated: Date.now(),
            });
            setTimeout(() => seekPlayer(playerRef, pos), 200);
            break;
          }
        }
      } catch (err) {
        console.error('[WatchParty] DataChannel error:', err);
      }
    };

    room.on('dataReceived', handleData);
    return () => room.off('dataReceived', handleData);
  }, [room, playerRef, setPlaybackState, setCurrentTrack, broadcast]);

  // ═══════════════════════════════════════
  // İLK KATILIM SYNC
  // ═══════════════════════════════════════
  useEffect(() => {
    if (!room || permRef.current.canControl) return;
    const t = setTimeout(() => broadcast(WP_ACTIONS.SYNC_REQ), 1200);
    return () => clearTimeout(t);
  }, [room, broadcast]);

  return {
    hostPlay,
    hostPause,
    hostSeek,
    hostSkip,
    autoAdvance,
    broadcast,
  };
}
