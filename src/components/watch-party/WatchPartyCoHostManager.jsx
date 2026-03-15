// src/components/watch-party/WatchPartyCoHostManager.jsx
import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useWatchPartyStore } from '@/src/store/watchPartyStore';
import {
  addCoHost, removeCoHost, transferHost, updateCoHostPermissions,
} from '@/src/services/watchPartyService';
import { useServerStore } from '@/src/store/serverStore';
import { Crown, UserPlus, UserMinus, ArrowRightLeft, X } from 'lucide-react';
import ConfirmDialog from '@/src/components/ConfirmDialog';

export function WatchPartyCoHostManager({ serverId, channelId, onClose, videoFS }) {
  const hostId  = useWatchPartyStore((s) => s.hostId);
  const coHosts = useWatchPartyStore((s) => s.coHosts);
  const coHostPermissions = useWatchPartyStore((s) => s.coHostPermissions || {});
  const members = useServerStore((s) => s.members);
  const voiceStates = useServerStore((s) => s.voiceStates);

  const [transferTarget, setTransferTarget] = useState(null);

  const getMemberData = (uid, fallbackName) => {
    if (!uid) return { name: '', initials: '?' };
    const m = members?.find(x => x.id === uid || x.userId === uid);
    const name = m
      ? (m.displayName || m.nickname || m.username || uid)
      : (fallbackName || uid);
    const initials = name.slice(0, 2).toUpperCase();
    return { name, initials };
  };

  const hostData = getMemberData(hostId);

  const getPermFor = (uid) => {
    const base = coHostPermissions?.[uid];
    // Varsayılan: tüm yetkiler kapalı başlasın
    if (!base) {
      return {
        canManageTracks: false,
        canControlPlayback: false,
      };
    }
    return {
      canManageTracks: !!base.canManageTracks,
      canControlPlayback: !!base.canControlPlayback,
    };
  };

  const channelUsers = voiceStates?.[channelId] || [];

  const participantRows = useMemo(
    () =>
      channelUsers.map((u) => {
        const uid = u.userId || u.id || u.uid;
        const isCoHost = coHosts.includes(uid);
        const isHost = uid === hostId;
        const member = getMemberData(uid, u.username);
        const perm = isCoHost ? getPermFor(uid) : null;
        return { uid, isCoHost, isHost, member, perm };
      }),
    [channelUsers, coHosts, hostId, coHostPermissions]
  );

  const handleRemoveCoHost = async (uid) => {
    await removeCoHost(serverId, channelId, uid);
  };

  const handleTransferHost = (uid) => {
    const member = participantRows.find((p) => p.uid === uid)?.member || getMemberData(uid);
    setTransferTarget({ uid, member });
  };

  const confirmTransferHost = async () => {
    if (!transferTarget) return;
    await transferHost(serverId, channelId, transferTarget.uid);
    setTransferTarget(null);
  };

  const cancelTransferHost = () => setTransferTarget(null);

  const handleTogglePermission = async (uid, key) => {
    const current = getPermFor(uid);
    const next = {
      ...current,
      [key]: !current[key],
    };
    await updateCoHostPermissions(serverId, channelId, uid, next);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -8, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.95 }}
        className={`absolute ${videoFS ? 'bottom-28 right-12 w-[360px]' : 'top-[calc(100%+8px)] right-0 w-full'}
                   bg-zinc-900/80 backdrop-blur-2xl rounded-2xl
                   border border-white/[0.08] shadow-2xl overflow-hidden z-[150]`}
      >
        {/* Başlık */}
        <div className="flex items-center justify-between px-4 py-3
                      border-b border-white/[0.04]">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Crown size={16} className="text-amber-400" />
            Co-Host Yönetimi
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-white/10
                                             rounded-lg transition-all">
            <X size={14} className="text-white/40" />
          </button>
        </div>
        {/* Host Bilgisi */}
        <div className="px-4 py-3 bg-amber-500/[0.05] border-b border-white/[0.04]">
          <div className="flex items-center gap-2">
            <Crown size={14} className="text-amber-400" />
            <span className="text-xs text-white/50">Host:</span>
            <span className="text-xs text-amber-400 font-medium">{hostData.name}</span>
          </div>
        </div>

        {/* Katılımcı listesi + Co-Host yönetimi */}
        <div className="max-h-64 overflow-y-auto border-t border-white/[0.04]">
          {participantRows.length === 0 ? (
            <div className="py-8 text-center text-white/15 text-sm">
              Bu kanalda şu anda kimse yok
            </div>
          ) : (
            participantRows.map(({ uid, isCoHost, isHost, member: mData, perm }) => {
              return (
              <div
                key={uid}
                className="flex items-center justify-between px-4 py-2.5
                           hover:bg-white/[0.03] group transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-500/20
                                  flex items-center justify-center border border-purple-500/30">
                    <span className="text-[11px] text-purple-400 font-bold">
                      {mData.initials}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm text-white/80 font-medium">
                      {mData.name}
                      {isHost && (
                        <span className="ml-1 text-[10px] text-amber-400 font-semibold">
                          (Host)
                        </span>
                      )}
                      {isCoHost && !isHost && (
                        <span className="ml-1 text-[10px] text-purple-300 font-semibold">
                          (Co-Host)
                        </span>
                      )}
                    </span>
                    {!isHost && !isCoHost && (
                      <span className="text-[10px] text-white/30">
                        Şu an odada
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-0
                                group-hover:opacity-100 transition-all">
                  {/* Co-Host değilse: YETKİ VER */}
                  {!isHost && !isCoHost && (
                    <button
                      onClick={() => addCoHost(serverId, channelId, uid)}
                      className="px-2 py-1 rounded-lg text-[10px] font-medium
                                 bg-emerald-500/20 text-emerald-300 border border-emerald-400/40
                                 hover:bg-emerald-500/30 transition-all flex items-center gap-1.5"
                      title="Bu kullanıcıyı co-host yap"
                    >
                      <UserPlus size={12} />
                      Yetki ver
                    </button>
                  )}

                  {/* Co-Host ise: iki ayrı yetki toggle + host devret + kaldır */}
                  {isCoHost && perm && (
                    <>
                      <button
                        onClick={() => handleTogglePermission(uid, 'canManageTracks')}
                        className={`px-2 py-1 rounded-lg text-[10px] font-medium border
                          ${perm.canManageTracks
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                            : 'bg-white/5 text-white/40 border-white/10'}
                        `}
                        title="Çalma listesine link ekleme yetkisi"
                      >
                        Playlist
                      </button>

                      <button
                        onClick={() => handleTogglePermission(uid, 'canControlPlayback')}
                        className={`px-2 py-1 rounded-lg text-[10px] font-medium border
                          ${perm.canControlPlayback
                            ? 'bg-sky-500/20 text-sky-300 border-sky-400/40'
                            : 'bg-white/5 text-white/40 border-white/10'}
                        `}
                        title="Oynatma (play/pause/atlama) kontrolü"
                      >
                        Kontrol
                      </button>

                      <button
                        onClick={() => handleTransferHost(uid)}
                        className="p-1.5 rounded-lg hover:bg-amber-500/20
                                   transition-all"
                        title="Host yetkisini devret"
                      >
                        <ArrowRightLeft size={12} className="text-amber-400" />
                      </button>

                      <button
                        onClick={() => handleRemoveCoHost(uid)}
                        className="p-1.5 rounded-lg hover:bg-red-500/20
                                   transition-all"
                        title="Co-Host'tan çıkar"
                      >
                        <UserMinus size={12} className="text-red-400" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )})
          )}
        </div>
      </motion.div>

      {/* Host devretme onayı - global ConfirmDialog stilinde */}
      <ConfirmDialog
        isOpen={!!transferTarget}
        variant="danger"
        title="Host Yetkisini Devret"
        description={
          transferTarget
            ? `${transferTarget.member?.name || 'Bu kullanıcı'} kullanıcısına Watch Party host yetkisini devretmek üzeresin. Bu işlemden sonra tam kontrol onda olacak.`
            : ''
        }
        confirmLabel="Evet, Devret"
        cancelLabel="Vazgeç"
        onConfirm={confirmTransferHost}
        onCancel={cancelTransferHost}
      />
    </>
  );
}
