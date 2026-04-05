import React, { useMemo } from "react";
import { useParticipants, useTracks } from "@livekit/components-react";
import { Track } from "livekit-client";
import UserCard from "./UserCard";
import { motion, AnimatePresence } from "framer-motion";
import { useSettingsStore } from "@/src/store/settingsStore";
import { useServerStore } from "@/src/store/serverStore";

// --- KATILIMCI LİSTESİ ---
const ParticipantList = React.memo(({
  onUserContextMenu,
  compact,
  hideIncomingVideo,
  setPinnedStreamIds,
  pinnedStreamIds,
}) => {
  const participants = useParticipants();
  const count = participants.length;

  const disableAnimations = useSettingsStore(s => s.disableAnimations);
  const graphicsQuality = useSettingsStore(s => s.graphicsQuality);

  // ✅ OPTIMIZATION: useTracks'i parent'ta BİR KEZ çağır (N kez yerine)
  const allScreenShareTracks = useTracks([Track.Source.ScreenShare]);
  const allCameraTracks = useTracks([Track.Source.Camera]);

  // ✅ Map'e dönüştür - O(1) lookup (O(N) find yerine)
  const screenShareTrackMap = useMemo(() => {
    const map = new Map();
    allScreenShareTracks.forEach(t => map.set(t.participant.sid, t));
    return map;
  }, [allScreenShareTracks]);

  const cameraTrackMap = useMemo(() => {
    const map = new Map();
    allCameraTracks.forEach(t => map.set(t.participant.sid, t));
    return map;
  }, [allCameraTracks]);

  // ✅ OPTIMIZATION: members'ı parent'ta bir kez al
  const members = useServerStore(s => s.members);

  // Potato/Low quality: Animasyon yok
  const shouldAnimate = !disableAnimations && 
                        graphicsQuality !== 'potato' && 
                        graphicsQuality !== 'low';

  // ✅ Memoized grid class
  const gridClass = useMemo(() => {
    if (count === 1) return "grid-cols-1 w-full max-w-[800px] aspect-video max-h-[600px]";
    if (count === 2) return "grid-cols-1 md:grid-cols-2 w-full max-w-[1000px] gap-5";
    if (count <= 4) return "grid-cols-2 w-full max-w-[900px] gap-5";
    if (count <= 6) return "grid-cols-2 md:grid-cols-3 w-full max-w-[1100px] gap-4";
    return "grid-cols-3 md:grid-cols-4 w-full max-w-[1200px] gap-4";
  }, [count]);

  if (count === 0) return null;

  if (compact) {
    return (
      <div
        className="flex items-center gap-3 h-full px-2"
        style={{ overflow: "visible" }}
      >
        {shouldAnimate ? (
          <AnimatePresence mode="sync">
            {participants.map((p) => (
              <motion.div
                key={p.sid}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="min-w-[140px] h-full"
                style={{ overflow: "visible", padding: "2px" }}
              >
                <UserCard
                  participant={p}
                  totalCount={count}
                  onContextMenu={(e) => onUserContextMenu(e, p)}
                  compact={true}
                  hideIncomingVideo={hideIncomingVideo}
                  setPinnedStreamIds={setPinnedStreamIds}
                  pinnedStreamIds={pinnedStreamIds}
                  screenShareTrackMap={screenShareTrackMap}
                  cameraTrackMap={cameraTrackMap}
                  members={members}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        ) : (
           participants.map((p) => (
            <div
                key={p.sid}
                className="min-w-[140px] h-full"
                style={{ overflow: "visible", padding: "2px" }}
            >
                <UserCard
                  participant={p}
                  totalCount={count}
                  onContextMenu={(e) => onUserContextMenu(e, p)}
                  compact={true}
                  hideIncomingVideo={hideIncomingVideo}
                  setPinnedStreamIds={setPinnedStreamIds}
                  pinnedStreamIds={pinnedStreamIds}
                  screenShareTrackMap={screenShareTrackMap}
                  cameraTrackMap={cameraTrackMap}
                  members={members}
                />
            </div>
           ))
        )}
      </div>
    );
  }

  return (
    <div
      className={`grid ${gridClass} items-center justify-center content-center w-full p-4`}
      style={{ overflow: "visible" }} // Glow efektlerinin kesilmemesi için
    >
      {shouldAnimate ? (
        <AnimatePresence mode="sync">
            {participants.map((p) => (
            <motion.div
                key={p.sid}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="w-full h-full aspect-[16/9] min-h-[180px]"
                style={{ overflow: "visible", padding: "4px" }}
            >
                <UserCard
                    participant={p}
                    totalCount={count}
                    onContextMenu={(e) => onUserContextMenu(e, p)}
                    hideIncomingVideo={hideIncomingVideo}
                    setPinnedStreamIds={setPinnedStreamIds}
                    pinnedStreamIds={pinnedStreamIds}
                    screenShareTrackMap={screenShareTrackMap}
                    cameraTrackMap={cameraTrackMap}
                    members={members}
                />
            </motion.div>
            ))}
        </AnimatePresence>
      ) : (
        participants.map((p) => (
            <div
                key={p.sid}
                className="w-full h-full aspect-[16/9] min-h-[180px]"
                style={{ overflow: "visible", padding: "4px" }}
            >
             <UserCard
                  participant={p}
                  totalCount={count}
                  onContextMenu={(e) => onUserContextMenu(e, p)}
                  hideIncomingVideo={hideIncomingVideo}
                  setPinnedStreamIds={setPinnedStreamIds}
                  pinnedStreamIds={pinnedStreamIds}
                  screenShareTrackMap={screenShareTrackMap}
                  cameraTrackMap={cameraTrackMap}
                  members={members}
                />
            </div>
        ))
      )}
    </div>
  );
});

export default ParticipantList;
