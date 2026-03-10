import { useEffect, useRef } from 'react';
import { useParticipants } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { useParticipantVolumeStore } from '@/src/store/participantVolumeStore';

/**
 * 🔊 Apply Participant Volumes Hook v2.0
 *
 * - Volume 0–1.0  → LiveKit native setVolume() (HTML element, no extra overhead)
 * - Volume >1.0   → GainNode boost (AudioContext MediaElementSource → GainNode → destination)
 *
 * MediaElementSource her audio element için yalnızca bir kez oluşturulabilir; ref'te cache'lenir.
 */
export function useApplyParticipantVolumes() {
  const participants = useParticipants();
  const volumes = useParticipantVolumeStore(s => s.volumes);

  // Gain boost için AudioContext (sadece boost gerektiğinde yaratılır)
  const gainContextRef = useRef(null);
  // identity → { source: MediaElementSourceNode, gainNode: GainNode, audioEl: HTMLElement }
  const gainNodesRef = useRef({});

  useEffect(() => {
    if (!participants || participants.length === 0) return;

    participants.forEach(participant => {
      if (participant.isLocal) return;

      try {
        const micPub = participant.getTrackPublication(Track.Source.Microphone);
        if (!micPub?.track) return;
        if (micPub.track.kind !== 'audio') return;

        const volume = volumes[participant.identity] ?? 1.0;
        const identity = participant.identity;

        if (volume <= 1.0) {
          // ─── Standart mod: LiveKit native API (0–1) ───
          if (typeof micPub.track.setVolume === 'function') {
            micPub.track.setVolume(volume);
          }

          // Daha önce GainNode varsa temizle
          if (gainNodesRef.current[identity]) {
            try { gainNodesRef.current[identity].gainNode.gain.value = 1.0; } catch(e) {}
            delete gainNodesRef.current[identity];
          }

        } else {
          // ─── Boost mod: GainNode ile 100%+ ses ───
          const audioEl = micPub.track.attachedElements?.[0];
          if (!audioEl) {
            // Henüz element yok, sonraki render'da tekrar denenecek
            return;
          }

          // AudioContext yarat
          if (!gainContextRef.current || gainContextRef.current.state === 'closed') {
            gainContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
          }
          const ctx = gainContextRef.current;
          if (ctx.state === 'suspended') ctx.resume().catch(() => {});

          if (!gainNodesRef.current[identity]) {
            // MediaElementSource yalnızca bir kez oluşturulabilir
            try {
              const source = ctx.createMediaElementSource(audioEl);
              const gainNode = ctx.createGain();
              gainNode.gain.value = volume;
              source.connect(gainNode);
              gainNode.connect(ctx.destination);
              gainNodesRef.current[identity] = { source, gainNode, audioEl };
              // HTML element artık GainNode üzerinden çalışıyor, native volume 1'de bırak
              audioEl.volume = 1.0;
            } catch(e) {
              if (process.env.NODE_ENV === 'development') {
                console.warn(`⚠️ GainNode kurulumu başarısız ${identity}:`, e);
              }
            }
          } else {
            // Sadece gain değerini güncelle
            gainNodesRef.current[identity].gainNode.gain.value = volume;
          }
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`⚠️ Volume uygulanamadı ${participant.identity}:`, error);
        }
      }
    });
  }, [participants, volumes]);

  // Cleanup
  useEffect(() => {
    return () => {
      Object.values(gainNodesRef.current).forEach(({ gainNode, source }) => {
        try { gainNode.disconnect(); } catch(e) {}
        try { source.disconnect(); } catch(e) {}
      });
      gainNodesRef.current = {};

      if (gainContextRef.current && gainContextRef.current.state !== 'closed') {
        gainContextRef.current.close().catch(() => {});
      }
      gainContextRef.current = null;
    };
  }, []);
}
