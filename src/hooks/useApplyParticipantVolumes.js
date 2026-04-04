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

  // ✅ Önceki volume değerlerini cache'le (gereksiz setVolume çağrılarını önle)
  const appliedVolumesRef = useRef({});

  useEffect(() => {
    if (!participants || participants.length === 0) return;

    participants.forEach(participant => {
      if (participant.isLocal) return;

      try {
        const micPub = participant.getTrackPublication(Track.Source.Microphone);
        if (!micPub?.track || micPub.track.kind !== 'audio') return;

        const volume = volumes[participant.identity] ?? 1.0;
        const identity = participant.identity;

        // ✅ Volume değişmediyse hiçbir şey yapma!
        if (appliedVolumesRef.current[identity] === volume) {
          // Eğer track attached elements değişmişse ama volume aynıysa,
          // Boost modunda element kontrolü gerekebilir. 
          // Ancak standart setVolume için kesinlikle gerek yok.
          if (volume <= 1.0) return;
          // Boost modunda ise node zaten varsa return, yoksa devam (re-attach durumu)
          if (gainNodesRef.current[identity]) return;
        }

        appliedVolumesRef.current[identity] = volume;

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
          if (!audioEl) return;

          // AudioContext yarat
          if (!gainContextRef.current || gainContextRef.current.state === 'closed') {
            gainContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
          }
          const ctx = gainContextRef.current;
          if (ctx.state === 'suspended') ctx.resume().catch(() => {});

          if (!gainNodesRef.current[identity]) {
            try {
              const source = ctx.createMediaElementSource(audioEl);
              const gainNode = ctx.createGain();
              gainNode.gain.value = volume;
              source.connect(gainNode);
              gainNode.connect(ctx.destination);
              gainNodesRef.current[identity] = { source, gainNode, audioEl };
              audioEl.volume = 1.0;
            } catch(e) {
              if (process.env.NODE_ENV === 'development') {
                console.warn(`⚠️ GainNode kurulumu başarısız ${identity}:`, e);
              }
            }
          } else {
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

  // ✅ Katılımcı ayrıldığında cache'den sil
  useEffect(() => {
    const identities = new Set(participants.map(p => p.identity));
    Object.keys(appliedVolumesRef.current).forEach(identity => {
      if (!identities.has(identity)) {
        delete appliedVolumesRef.current[identity];
      }
    });
  }, [participants]);

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
