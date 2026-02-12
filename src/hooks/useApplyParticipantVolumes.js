import { useEffect } from 'react';
import { useParticipants } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { useParticipantVolumeStore } from '@/src/store/participantVolumeStore';

/**
 * 🔊 Apply Participant Volumes Hook
 * 
 * Store'daki volume değerlerini otomatik olarak LiveKit track'lere uygular.
 * Her participant için ses seviyesi değiştiğinde veya yeni participant geldiğinde çalışır.
 * 
 * Kullanım:
 * - ActiveRoom component içinde çağır
 * - Otomatik olarak tüm remote participant'lara volume uygular
 */
export function useApplyParticipantVolumes() {
  const participants = useParticipants();
  const volumes = useParticipantVolumeStore(s => s.volumes);
  
  useEffect(() => {
    if (!participants || participants.length === 0) return;
    
    participants.forEach(participant => {
      // Local participant için volume uygulanmaz
      if (participant.isLocal) return;
      
      try {
        const micPub = participant.getTrackPublication(Track.Source.Microphone);
        
        // Track yoksa veya audio değilse skip
        if (!micPub?.track) return;
        if (micPub.track.kind !== 'audio') return;
        
        // Store'dan volume al (default 1.0)
        const volume = volumes[participant.identity] ?? 1.0;
        
        // ✅ LiveKit native setVolume API
        // ✅ LiveKit native setVolume API
        // 🚀 CPU LEAK FIX: Asla track.attach() kullanma!
        if (typeof micPub.track.setVolume === 'function') {
          micPub.track.setVolume(volume);
          
          if (process.env.NODE_ENV === 'development') {
            // console.log(`🔊 Applied volume ${Math.round(volume * 100)}% to ${participant.identity}`);
          }
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`⚠️ Failed to apply volume for ${participant.identity}:`, error);
        }
      }
    });
  }, [participants, volumes]);
  
  // Cleanup - unmount olduğunda tüm volume'leri reset et
  useEffect(() => {
    return () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔊 Volume applicator unmounted');
      }
    };
  }, []);
}
