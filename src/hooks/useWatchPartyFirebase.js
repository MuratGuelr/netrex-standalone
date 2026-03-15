// src/hooks/useWatchPartyFirebase.js
import { useEffect } from 'react';
import { subscribeToWatchParty } from '@/src/services/watchPartyService';
import { useWatchPartyStore } from '@/src/store/watchPartyStore';

export function useWatchPartyFirebase(serverId, channelId) {
  const setRemoteState   = useWatchPartyStore((s) => s.setRemoteState);
  const resetWatchParty  = useWatchPartyStore((s) => s.resetWatchParty);

  useEffect(() => {
    if (!serverId || !channelId) return;

    const unsubscribe = subscribeToWatchParty(
      serverId,
      channelId,
      (data) => {
        if (data) {
          setRemoteState(data);
        } else {
          resetWatchParty();
        }
      }
    );

    return () => unsubscribe();
  }, [serverId, channelId, setRemoteState, resetWatchParty]);
}
