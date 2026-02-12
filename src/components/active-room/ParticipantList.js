import React, { useMemo } from "react";
import { useParticipants } from "@livekit/components-react";
import UserCard from "./UserCard";
import { motion, AnimatePresence } from "framer-motion";
import { useSettingsStore } from "@/src/store/settingsStore";

// --- KATILIMCI LİSTESİ ---
const ParticipantList = React.memo(({
  onUserContextMenu,
  compact,
  hideIncomingVideo,
  setActiveStreamId,
  activeStreamId,
}) => {
  const participants = useParticipants();
  const count = participants.length;

  const disableAnimations = useSettingsStore(s => s.disableAnimations);
  const graphicsQuality = useSettingsStore(s => s.graphicsQuality);

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
                  setActiveStreamId={setActiveStreamId}
                  activeStreamId={activeStreamId}
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
                  setActiveStreamId={setActiveStreamId}
                  activeStreamId={activeStreamId}
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
                    setActiveStreamId={setActiveStreamId}
                    activeStreamId={activeStreamId}
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
                  setActiveStreamId={setActiveStreamId}
                  activeStreamId={activeStreamId}
                />
            </div>
        ))
      )}
    </div>
  );
});

export default ParticipantList;
