// src/components/active-room/WatchPartyManager.jsx
import React from 'react';
import { WatchPartyPlayer } from '../watch-party/WatchPartyPlayer';
import { WatchPartyMiniBadge } from '../watch-party/WatchPartyMiniBadge';
import { useWatchPartyFirebase } from '../../hooks/useWatchPartyFirebase';
import { useWatchPartyStore } from '../../store/watchPartyStore';
import { useSettingsStore } from '../../store/settingsStore';

function WatchPartyInner({ serverId, channelId }) {
  useWatchPartyFirebase(serverId, channelId);

  const isActive = useWatchPartyStore((s) => s.isActive);
  const isInVoiceRoom = useSettingsStore((s) => s.isInVoiceRoom);

  return (
    <>
      {isActive && isInVoiceRoom && (
        <WatchPartyPlayer serverId={serverId} channelId={channelId} />
      )}
      <WatchPartyMiniBadge />
    </>
  );
}

export default function WatchPartyManager({ serverId, channelId }) {
  const watchPartyEnabled = useSettingsStore((s) => s.watchPartyEnabled);

  if (!watchPartyEnabled) return null;

  return <WatchPartyInner serverId={serverId} channelId={channelId} />;
}