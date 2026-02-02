import React from "react";
import { useParticipants } from "@livekit/components-react";
import UserCard from "./UserCard";
import { motion, AnimatePresence } from "framer-motion";

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
  if (count === 0) return null;

  if (compact) {
    return (
      <div
        className="flex items-center gap-3 h-full px-2"
        style={{ overflow: "visible" }}
      >
        <AnimatePresence mode="popLayout">
          {participants.map((p) => (
            <motion.div
              layout
              key={p.sid}
              initial={{ opacity: 0, scale: 0.85, x: -20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.85, x: 20 }}
              transition={{ type: "spring", stiffness: 450, damping: 35 }}
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
      </div>
    );
  }

  let gridClass = "";
  if (count === 1)
    gridClass = "grid-cols-1 w-full max-w-[800px] aspect-video max-h-[600px]";
  else if (count === 2)
    gridClass = "grid-cols-1 md:grid-cols-2 w-full max-w-[1000px] gap-5";
  else if (count <= 4) gridClass = "grid-cols-2 w-full max-w-[900px] gap-5";
  else if (count <= 6)
    gridClass = "grid-cols-2 md:grid-cols-3 w-full max-w-[1100px] gap-4";
  else gridClass = "grid-cols-3 md:grid-cols-4 w-full max-w-[1200px] gap-4";

  return (
    <div
      className={`grid ${gridClass} items-center justify-center content-center w-full p-4`}
      style={{ overflow: "visible" }} // Glow efektlerinin kesilmemesi için
    >
      <AnimatePresence mode="popLayout">
        {participants.map((p) => (
          <motion.div
            layout
            key={p.sid}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ 
                type: "spring", 
                stiffness: 400, 
                damping: 30,
                opacity: { duration: 0.2 } 
            }}
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
    </div>
  );
});

export default ParticipantList;
