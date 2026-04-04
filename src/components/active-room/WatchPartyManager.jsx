// src/components/active-room/WatchPartyManager.jsx
import React from 'react';
import { WatchPartyPlayer } from '../watch-party/WatchPartyPlayer';
import { WatchPartyMiniBadge } from '../watch-party/WatchPartyMiniBadge';
import { useWatchPartyFirebase } from '../../hooks/useWatchPartyFirebase';
import { useWatchPartyStore } from '../../store/watchPartyStore';
import { useSettingsStore } from '../../store/settingsStore';

function WatchPartyInner({ serverId, channelId }) {
  // Firebase dinleyicileri başlat
  useWatchPartyFirebase(serverId, channelId);

  const isActive      = useWatchPartyStore((s) => s.isActive);
  const isInVoiceRoom = useSettingsStore((s) => s.isInVoiceRoom);

  return (
    <>
      {/* Player: sadece party aktif ve ses odasındayken */}
      {isActive && isInVoiceRoom && (
        <WatchPartyPlayer serverId={serverId} channelId={channelId} />
      )}
      {/* Mini rozet: party aktif ama player gizliyken */}
      {isActive && <WatchPartyMiniBadge />}
    </>
  );
}

export default function WatchPartyManager({ serverId, channelId }) {
  const enabled = useSettingsStore((s) => s.watchPartyEnabled);
  if (!enabled) return null;
  return <WatchPartyInner serverId={serverId} channelId={channelId} />;
}