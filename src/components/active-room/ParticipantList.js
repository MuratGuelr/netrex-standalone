
import { useParticipants } from "@livekit/components-react";
import UserCard from "./UserCard";

// --- KATILIMCI LİSTESİ ---
export default function ParticipantList({
  onUserContextMenu,
  compact,
  hideIncomingVideo,
  setActiveStreamId,
  activeStreamId,
}) {
  const participants = useParticipants();
  const count = participants.length;
  if (count === 0) return null;
  if (compact) {
    return (
      <div
        className="flex items-center gap-3 h-full px-2"
        style={{ overflow: "visible" }}
      >
        {participants.map((p) => (
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
        ))}
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
      {participants.map((p) => (
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
      ))}
    </div>
  );
}
