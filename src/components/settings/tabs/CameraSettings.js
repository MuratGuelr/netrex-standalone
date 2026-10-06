import { useState, useEffect } from "react";
import { Video } from "lucide-react";
import { TabBanner } from "../SettingsCard";
import VideoSettingsSection from "./voice/VideoSettingsSection";
import VideoCodecSection from "./voice/VideoCodecSection";

export default function CameraSettings() {
  const [videoInputs, setVideoInputs] = useState([]);

  useEffect(() => {
    const getDevices = async () => {
      let tempStream;
      try {
        // Yalnızca kamera izni iste (mikrofon burada gerekmez)
        tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const devs = await navigator.mediaDevices.enumerateDevices();
        setVideoInputs(devs.filter((d) => d.kind === "videoinput"));
      } catch (err) {
        console.error("Video device permission/enumeration error:", err);
      } finally {
        if (tempStream) tempStream.getTracks().forEach((track) => track.stop());
      }
    };
    getDevices();
  }, []);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 pb-10">
      <h3 className="text-xl font-bold text-white mb-3 relative">
        <span className="relative z-10">Kamera</span>
      </h3>

      <TabBanner
        icon={<Video size={24} className="text-white" />}
        title="Kamera"
        description="Kamera seçimi, görüntü kalitesi ve video kodlama"
        gradient="from-emerald-600 via-teal-600 to-emerald-600"
      />

      <VideoSettingsSection videoInputs={videoInputs} />

      <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-6"></div>

      <VideoCodecSection />
    </div>
  );
}
