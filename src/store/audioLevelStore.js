import { create } from 'zustand';

/**
 * ✅ Merkezi Audio Level Store
 * Tek bir interval ile tüm participant'ların audio level'larını yönetir
 * Her UserCard için ayrı interval yerine tek bir global listener
 */
export const useAudioLevelStore = create((set, get) => ({
  audioLevels: {}, // { participantSid: audioLevel }
  _room: null,
  _intervalId: null,

  // Room bağlandığında çağrılır
  startTracking: (room) => {
    const state = get();
    if (state._intervalId) return; // Zaten çalışıyor

    set({ _room: room });

    const updateLevels = () => {
      const currentRoom = get()._room;
      if (!currentRoom) return;

      const newLevels = {};
      currentRoom.remoteParticipants.forEach((participant) => {
        const micPub = participant.getTrackPublication('microphone');
        if (micPub?.track) {
          newLevels[participant.sid] = micPub.track.audioLevel ?? 0;
        }
      });

      // Sadece değişiklik varsa güncelle
      const oldLevels = get().audioLevels;
      const hasChanges = Object.keys(newLevels).some(
        sid => newLevels[sid] !== oldLevels[sid]
      ) || Object.keys(oldLevels).some(
        sid => !(sid in newLevels)
      );

      if (hasChanges) {
        set({ audioLevels: newLevels });
      }
    };

    // Tek bir global interval - 100ms
    const intervalId = setInterval(updateLevels, 100);
    set({ _intervalId: intervalId });
  },

  // Room ayrıldığında çağrılır
  stopTracking: () => {
    const { _intervalId } = get();
    if (_intervalId) {
      clearInterval(_intervalId);
    }
    set({ audioLevels: {}, _room: null, _intervalId: null });
  },

  // Belirli bir participant için audio level al
  getLevel: (participantSid) => {
    return get().audioLevels[participantSid] ?? 0;
  }
}));
