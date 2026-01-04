import { useRef, useEffect, useState, useImperativeHandle, forwardRef } from "react";
import { Track } from "livekit-client";

// Helper to play individual track
function HiddenSourceVideo({ trackRef, onReady }) {
  const videoRef = useRef(null);
  const track = trackRef?.publication?.track;
  const sid = trackRef?.participant?.sid;

  useEffect(() => {
    const el = videoRef.current;
    if (el && track) {
      track.attach(el);
      el.play().catch((e) => {}); // Ignore play errors for hidden elements
      
      if (sid) onReady(sid, el);
    }
    return () => {
      if (el && track) {
        track.detach(el);
      }
    };
  }, [track, sid, onReady]);

  return <video ref={videoRef} muted autoPlay playsInline style={{ display: 'none' }} />;
}

const PipGrid = forwardRef(({ tracks, isSelfSharing }, ref) => {
  const canvasRef = useRef(null);
  const masterVideoRef = useRef(null);
  const sourceVideosRef = useRef(new Map()); // Map<sid, HTMLVideoElement>
  const loopRef = useRef(null);
  const isActiveRef = useRef(false);
  const [isPipActive, setIsPipActive] = useState(false);
  
  // Store tracks in ref to avoid restarting loop on prop change
  const tracksRef = useRef(tracks);
  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  // Update source refs map
  const handleSourceReady = (sid, el) => {
    sourceVideosRef.current.set(sid, el);
  };

  // Canvas Loop with Double Buffering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    
    // Create offscreen canvas for double-buffering (prevents flicker)
    const offscreen = document.createElement('canvas');
    offscreen.width = canvas.width;
    offscreen.height = canvas.height;
    const offCtx = offscreen.getContext("2d", { alpha: false });
    const draw = () => {
      if (!isActiveRef.current) return;

      const currentTracks = tracksRef.current || [];
      const activeSources = currentTracks
        .filter(t => sourceVideosRef.current.has(t.participant.sid))
        .map(t => ({
          video: sourceVideosRef.current.get(t.participant.sid),
          identity: t.participant.identity,
          name: t.participant.name || t.participant.identity
        }));

      const count = activeSources.length;
      
      // Check if ALL videos are ready before drawing
      // This prevents partial frames (some cells black) from ever being shown
      const allVideosReady = count === 0 || activeSources.every(s => s.video && s.video.videoWidth > 0);
      
      if (!allVideosReady) {
        // Skip this frame, keep showing previous good frame
        loopRef.current = requestAnimationFrame(draw);
        return;
      }
      
      // Draw to OFFSCREEN canvas first (double-buffering)
      offCtx.fillStyle = "#1a1b1f";
      offCtx.fillRect(0, 0, offscreen.width, offscreen.height);

      if (count === 0) {
        offCtx.fillStyle = "#ffffff";
        offCtx.font = "40px sans-serif";
        offCtx.textAlign = "center";
        offCtx.fillText("Kamera yok", offscreen.width / 2, offscreen.height / 2);
      } else {
        const cols = Math.ceil(Math.sqrt(count));
        const rows = Math.ceil(count / cols);
        
        const cellW = offscreen.width / cols;
        const cellH = offscreen.height / rows;

        activeSources.forEach((source, index) => {
          const { video, name } = source;
          const col = index % cols;
          const row = Math.floor(index / cols);
          
          const x = col * cellW;
          const y = row * cellH;

          const vw = video.videoWidth;
          const vh = video.videoHeight;
          const videoAspect = vw / vh;
          const cellAspect = cellW / cellH;

          let drawW, drawH, drawX, drawY;

          if (videoAspect > cellAspect) {
            drawW = cellW;
            drawH = cellW / videoAspect;
            drawX = x;
            drawY = y + (cellH - drawH) / 2;
          } else {
            drawH = cellH;
            drawW = cellH * videoAspect;
            drawY = y;
            drawX = x + (cellW - drawW) / 2;
          }

          offCtx.drawImage(video, drawX, drawY, drawW, drawH);

          // Draw Name Badge
          const fontSize = Math.max(16, Math.min(32, cellH / 10));
          offCtx.font = `bold ${fontSize}px sans-serif`;
          const padding = fontSize / 2;
          const textWidth = offCtx.measureText(name).width;
          
          offCtx.fillStyle = "rgba(0,0,0,0.6)";
          offCtx.beginPath();
          offCtx.roundRect(
            drawX + 10, 
            drawY + drawH - fontSize - padding - 10, 
            textWidth + padding * 2, 
            fontSize + padding, 
            8
          );
          offCtx.fill();

          offCtx.fillStyle = "#ffffff";
          offCtx.textAlign = "left";
          offCtx.fillText(
            name, 
            drawX + 10 + padding, 
            drawY + drawH - 10 - padding/2
          );
        });
      }

      // ATOMIC COPY: Blit offscreen buffer to main canvas
      ctx.drawImage(offscreen, 0, 0);

      loopRef.current = requestAnimationFrame(draw);
    };

    // If active, start loop
    if (isPipActive) {
        isActiveRef.current = true;
        draw();
    } else {
        isActiveRef.current = false;
        if (loopRef.current) cancelAnimationFrame(loopRef.current);
    }

    return () => {
      isActiveRef.current = false;
      if (loopRef.current) cancelAnimationFrame(loopRef.current);
    };
  }, [isPipActive]); // Only re-run if pip state changes (loop persistence)

  // Auto-close PiP if no tracks are available
  useEffect(() => {
    if (isPipActive && tracks.length === 0) {
      if (document.pictureInPictureElement) {
        document.exitPictureInPicture().catch(() => {});
      }
      setIsPipActive(false);
    }
  }, [tracks, isPipActive]);

  // Initialize master video stream
  useEffect(() => {
    const canvas = canvasRef.current;
    const master = masterVideoRef.current;
    if (canvas && master) {
        // Set fixed size once
        canvas.width = 1920;
        canvas.height = 1080;
        
        const stream = canvas.captureStream(); // Auto FPS
        master.srcObject = stream;
        master.play().catch(() => {});
    }
  }, []);

  // Expose methods
  useImperativeHandle(ref, () => ({
    togglePip: async () => {
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
          setIsPipActive(false);
        } else if (masterVideoRef.current) {
          // Start the loop BEFORE requesting PiP to ensure content
          setIsPipActive(true);
          // Small delay to ensure canvas has drawn at least one frame
          requestAnimationFrame(async () => {
             try {
                await masterVideoRef.current.play();
                await masterVideoRef.current.requestPictureInPicture();
             } catch(e) {
                console.error("PiP Request Fail", e);
                setIsPipActive(false);
             }
          });
        }
      } catch (e) {
        console.error("PiP Toggle Error", e);
        setIsPipActive(false);
      }
    }
  }));

  // Handle external exit
  useEffect(() => {
      const master = masterVideoRef.current;
      if (!master) return;
      
      const onLeave = () => setIsPipActive(false);
      master.addEventListener('leavepictureinpicture', onLeave);
      return () => master.removeEventListener('leavepictureinpicture', onLeave);
  }, []);

  return (
    <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', visibility: 'hidden' }}>
      {/* Canvas for compositing */}
      <canvas ref={canvasRef} />
      
      {/* Master Video (Canvas Stream) - The one we send to PiP */}
      <video ref={masterVideoRef} muted autoPlay playsInline />

      {/* Source Videos (Hidden) */}
      {tracks.map(t => (
        <HiddenSourceVideo 
            key={t.participant.sid} 
            trackRef={t} 
            onReady={handleSourceReady} 
        />
      ))}
    </div>
  );
});

export default PipGrid;
