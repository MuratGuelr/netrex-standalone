
import React, { useCallback } from "react";
import { useLocalParticipant } from "@livekit/components-react";
import { Track } from "livekit-client";

// ScreenShareManager: stopScreenShare fonksiyonunu LiveKitRoom içinde tanımlar
export default function ScreenShareManager({
  setActiveStreamId,
  renderStageManager,
  renderBottomControls,
}) {
  const { localParticipant } = useLocalParticipant();

  const stopScreenShare = useCallback(async () => {
    try {
      if (!localParticipant) {
        console.warn("Local participant bulunamadı");
        return;
      }

      const tracks = localParticipant.getTrackPublications();
      const screenShareTracks = tracks.filter(
        (trackPub) =>
          trackPub.source === Track.Source.ScreenShare ||
          trackPub.source === Track.Source.ScreenShareAudio
      );

      if (screenShareTracks.length === 0) {
        // Track yoksa, activeStreamId'yi sıfırla
        setActiveStreamId(null);
        return;
      }

      // Tüm screen share track'lerini durdur
      const unpublishPromises = [];

      for (const trackPub of screenShareTracks) {
        try {
          // Önce track'i al
          const track = trackPub.track;

          if (track) {
            // Track'in mediaStreamTrack'ini durdur (eğer varsa)
            if (track.mediaStreamTrack) {
              track.mediaStreamTrack.stop();
            }

            // Track'i durdur
            track.stop();

            // Unpublish et (track ile)
            unpublishPromises.push(
              localParticipant.unpublishTrack(track).catch((error) => {
                // Publication zaten yoksa veya başka bir hata varsa sessizce devam et
                if (process.env.NODE_ENV === "development") {
                  console.warn(
                    "Track unpublish hatası (normal olabilir):",
                    error
                  );
                }
              })
            );
          } else {
            // Track yoksa, publication'ı unpublish et
            try {
              unpublishPromises.push(
                localParticipant.unpublishTrack(trackPub).catch((error) => {
                  if (process.env.NODE_ENV === "development") {
                    console.warn(
                      "TrackPub unpublish hatası (normal olabilir):",
                      error
                    );
                  }
                })
              );
            } catch (error) {
              if (process.env.NODE_ENV === "development") {
                console.warn("TrackPub unpublish hatası:", error);
              }
            }
          }
        } catch (error) {
          console.warn("Track durdurma hatası:", error);
        }
      }

      // Tüm unpublish işlemlerini bekle
      await Promise.all(unpublishPromises);

      // activeStreamId'yi sıfırla
      setActiveStreamId(null);

      if (process.env.NODE_ENV === "development") {
        console.log("✅ Screen share durduruldu");
      }
    } catch (error) {
      console.error("Screen share durdurma hatası:", error);
      // Hata olsa bile activeStreamId'yi sıfırla
      setActiveStreamId(null);
    }
  }, [localParticipant, setActiveStreamId]);

  return (
    <>
      {renderStageManager(stopScreenShare)}
      {renderBottomControls(stopScreenShare)}
    </>
  );
}
