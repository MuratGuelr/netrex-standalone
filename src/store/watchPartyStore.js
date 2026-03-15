// src/store/watchPartyStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useWatchPartyStore = create(
  persist(
    (set, get) => ({

      // ══════════════════════════════════════
      // UZAK STATE
      // ══════════════════════════════════════
      isActive: false,
      hostId: null,
      coHosts: [],
      coHostPermissions: {},
      currentTrack: null,
      playbackState: {
        isPlaying: false,
        startedAt: null,
        seekPosition: 0,
        lastUpdated: null,
      },
      playlist: [],
      votes: {},

      // ══════════════════════════════════════
      // YEREL STATE
      // ══════════════════════════════════════
      localPreferences: {
        isListening: true,
        volume: 80,
        isMuted: false,
        videoMode: false,
        videoFullscreen: false,
        videoQuality: 'auto',
        showPlayer: true,
        showPlaylist: false,
      },

      // ══════════════════════════════════════
      // ✅ FIX: SHALLOW COMPARE ile setRemoteState
      //
      // Firebase listener her tetiklendiğinde yeni obje
      // oluşturuyordu → Zustand yeni referans görüyordu →
      // TÜM subscriber'lar re-render oluyordu →
      // debounce effect tekrar çalışıyordu →
      // stablePlaying flip-flop → AbortError
      //
      // Artık değerler GERÇEKTEN değişmediyse set() çağrılmaz.
      // ══════════════════════════════════════
      setRemoteState: (data) => {
        const current = get();

        const newIsActive     = data.isActive ?? false;
        const newHostId       = data.hostId ?? null;
        const newCoHosts      = data.coHosts ?? [];
        const newCurrentTrack = data.currentTrack ?? null;
        const newPlaylist     = data.playlist ?? [];
        const newVotes        = data.votes ?? {};
        const newCoHostPerms  = data.coHostPermissions ?? {};

        const newPB = data.playbackState ?? current.playbackState;
        const newIsPlaying    = newPB.isPlaying ?? false;

        // ─── Track değişti mi? ───
        const trackChanged =
          current.currentTrack?.id  !== newCurrentTrack?.id ||
          current.currentTrack?.url !== newCurrentTrack?.url;

        // ─── Playback state isPlaying değişti mi? ───
        const isPlayingChanged = current.playbackState.isPlaying !== newIsPlaying;
        
        // EGER Track veya Oynatma Durumu degismediyse,
        // Firebase'den gelen startedAt ve seekPosition surekli YOK SAYILMALIDIR!
        // Cunku Firebase'deki Timestamp'ler Host'un saatidir, 10s ileri olabilir!
        // WebRTC zaten milisaniye hizinda bu isleri local Date.now() ile senkronize ediyor.
        let effectivePlaybackState = current.playbackState;
        let pbChanged = false;
        
        if (isPlayingChanged || trackChanged) {
          effectivePlaybackState = {
            isPlaying: newIsPlaying,
            startedAt: newPB.startedAt ?? null,
            seekPosition: newPB.seekPosition ?? 0,
            lastUpdated: newPB.lastUpdated ?? null,
          };
          pbChanged = true;
        }

        // ─── Playlist değişti mi? (length + son eleman id) ───
        const playlistChanged =
          current.playlist.length !== newPlaylist.length ||
          current.playlist[current.playlist.length - 1]?.id !==
            newPlaylist[newPlaylist.length - 1]?.id;

        // ─── Diğerleri ───
        const otherChanged =
          current.isActive !== newIsActive ||
          current.hostId   !== newHostId ||
          current.coHosts.length !== newCoHosts.length;

        // ─── Co-Host izinleri değişti mi? (deep compare) ───
        const coHostPermsChanged =
          JSON.stringify(current.coHostPermissions || {}) !==
          JSON.stringify(newCoHostPerms || {});

        // ─── Votes (basit length check) ───
        const votesChanged =
          Object.keys(current.votes).length !== Object.keys(newVotes).length ||
          JSON.stringify(current.votes) !== JSON.stringify(newVotes);

        // Hiçbir şey değişmediyse → SET ÇAĞIRMA → re-render YOK
        if (!pbChanged && !trackChanged && !playlistChanged &&
            !otherChanged && !votesChanged && !coHostPermsChanged) {
          return;
        }

        set({
           isActive: newIsActive,
           hostId: newHostId,
           coHosts: newCoHosts,
           currentTrack: trackChanged ? newCurrentTrack : current.currentTrack,
           playbackState: effectivePlaybackState,
           playlist: playlistChanged ? newPlaylist : current.playlist,
           votes: votesChanged ? newVotes : current.votes,
           coHostPermissions: coHostPermsChanged ? newCoHostPerms : current.coHostPermissions,
        });
      },

      setPlaybackState: (patch) => set((s) => {
        const newPB = { ...s.playbackState, ...patch };
        // Değişim yoksa skip
        if (
          s.playbackState.isPlaying    === newPB.isPlaying &&
          s.playbackState.startedAt    === newPB.startedAt &&
          s.playbackState.seekPosition === newPB.seekPosition
        ) {
          return s; // Değişiklik yok
        }
        return { playbackState: newPB };
      }),

      setCurrentTrack: (track) => set((s) => {
        if (s.currentTrack?.id === track?.id &&
            s.currentTrack?.url === track?.url) {
          return s;
        }
        return { currentTrack: track };
      }),

      setPlaylist:     (list)  => set({ playlist: list }),
      setVotes:        (votes) => set({ votes }),
      setCoHosts:      (arr)   => set({ coHosts: arr }),

      // ══════════════════════════════════════
      // YEREL TERCİH YAZICILARI
      // ══════════════════════════════════════
      setLocalPref: (key, value) => set((s) => ({
        localPreferences: { ...s.localPreferences, [key]: value },
      })),

      toggleListening: () => set((s) => ({
        localPreferences: {
          ...s.localPreferences,
          isListening: !s.localPreferences.isListening,
        },
      })),

      toggleMute: () => set((s) => ({
        localPreferences: {
          ...s.localPreferences,
          isMuted: !s.localPreferences.isMuted,
        },
      })),

      toggleVideoMode: () => set((s) => ({
        localPreferences: {
          ...s.localPreferences,
          videoMode: !s.localPreferences.videoMode,
        },
      })),

      toggleFullscreen: () => set((s) => ({
        localPreferences: {
          ...s.localPreferences,
          videoFullscreen: !s.localPreferences.videoFullscreen,
        },
      })),

      togglePlayer: () => set((s) => ({
        localPreferences: {
          ...s.localPreferences,
          showPlayer: !s.localPreferences.showPlayer,
        },
      })),

      togglePlaylist: () => set((s) => ({
        localPreferences: {
          ...s.localPreferences,
          showPlaylist: !s.localPreferences.showPlaylist,
        },
      })),

      // ══════════════════════════════════════
      // HESAPLANAN DEĞERLER
      // ══════════════════════════════════════
      getEffectiveVolume: () => {
        const { localPreferences } = get();
        if (!localPreferences.isListening) return 0;
        if (localPreferences.isMuted) return 0;
        return localPreferences.volume / 100;
      },

      getTrackVoteScore: (trackId) => {
        const trackVotes = get().votes[trackId];
        if (!trackVotes) return 0;
        return Object.values(trackVotes).reduce((sum, v) => sum + v, 0);
      },

      getUserVote: (trackId, userId) => {
        return get().votes[trackId]?.[userId] ?? 0;
      },

      getSortedPlaylist: () => {
        const { playlist, votes } = get();
        return [...playlist].sort((a, b) => {
          const scoreA = Object.values(votes[a.id] || {}).reduce((s, v) => s + v, 0);
          const scoreB = Object.values(votes[b.id] || {}).reduce((s, v) => s + v, 0);
          return scoreB - scoreA;
        });
      },

      // ══════════════════════════════════════
      // SIFIRLAMA
      // ══════════════════════════════════════
      resetWatchParty: () => set({
        isActive: false,
        hostId: null,
        coHosts: [],
        coHostPermissions: {},
        currentTrack: null,
        playbackState: {
          isPlaying: false,
          startedAt: null,
          seekPosition: 0,
          lastUpdated: null,
        },
        playlist: [],
        votes: {},
      }),
    }),
    {
      name: 'netrex-watchparty-local',
      partialize: (state) => ({
        localPreferences: state.localPreferences,
      }),
    }
  )
);