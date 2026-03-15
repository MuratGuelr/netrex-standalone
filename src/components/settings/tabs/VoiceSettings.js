import { useState, useEffect } from "react";
import HeaderBanner from "./voice/HeaderBanner";
import VideoSettingsSection from "./voice/VideoSettingsSection";
import AudioDevicesSection from "./voice/AudioDevicesSection";
import AppSoundsSection from "./voice/AppSoundsSection";
import InputSensitivitySection from "./voice/InputSensitivitySection";
import NoiseSuppressionSection from "./voice/NoiseSuppressionSection";
import AdvancedAudioSection from "./voice/AdvancedAudioSection";

export default function VoiceSettings({ isSettingsModalOpen }) {
  const [audioInputs, setAudioInputs] = useState([]);
  const [audioOutputs, setAudioOutputs] = useState([]);
  const [videoInputs, setVideoInputs] = useState([]);

  useEffect(() => {
    const getDevices = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        const devs = await navigator.mediaDevices.enumerateDevices();
        setAudioInputs(devs.filter((d) => d.kind === "audioinput"));
        setAudioOutputs(devs.filter((d) => d.kind === "audiooutput"));
        setVideoInputs(devs.filter((d) => d.kind === "videoinput"));
      } catch (err) {
        console.error(err);
      }
    };
    getDevices();
  }, []);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 pb-10">
      <h3 className="text-2xl font-bold text-white mb-6 relative">
        <span className="relative z-10">Ses ve Görüntü</span>
      </h3>

      <HeaderBanner />

      {/* KAMERA AYARLARI */}
      <VideoSettingsSection videoInputs={videoInputs} />

      <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-6"></div>

      {/* SES AYARLARI */}
      <AudioDevicesSection
        audioInputs={audioInputs}
        audioOutputs={audioOutputs}
      />

      {/* UYGULAMA SESLERİ */}
      <AppSoundsSection />

      {/* GİRİŞ HASSASİYETİ (NOISE GATE) */}
      <InputSensitivitySection isSettingsModalOpen={isSettingsModalOpen} />

      {/* GÜRÜLTÜ AZALTMA MODU */}
      <NoiseSuppressionSection />

      {/* GELİŞMİŞ SES İŞLEME */}
      <AdvancedAudioSection />
    </div>
  );
}
