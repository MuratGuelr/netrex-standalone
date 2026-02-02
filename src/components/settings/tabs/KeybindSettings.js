import { useState, useEffect } from "react";
import { Keyboard, Info, Mic, Volume2, Camera } from "lucide-react";
import { useRoomContext } from "@livekit/components-react";
import { useSettingsStore } from "@/src/store/settingsStore";
import { getKeyLabel, isModifierKey, getMouseLabel } from "@/src/utils/keyMap";
import { toastOnce } from "@/src/utils/toast";
import KeybindRow from "../KeybindRow";

const formatKeybinding = (keybinding) => {
  if (!keybinding) return "Atanmadı";
  if (keybinding.type === "mouse" || keybinding.mouseButton)
    return getMouseLabel(keybinding.mouseButton);
  if (typeof keybinding.keycode !== "number") return "Atanmadı";
  const keyLabel = getKeyLabel(keybinding.keycode);
  const isStandaloneModifier = isModifierKey(keybinding.keycode);
  
  const modifiers = [];
  if (keybinding.ctrlKey) modifiers.push("Ctrl");
  if (keybinding.shiftKey) modifiers.push("Shift");
  if (keybinding.altKey) modifiers.push("Alt");
  if (keybinding.metaKey) modifiers.push("Win");

  if (isStandaloneModifier) {
      if (modifiers.length > 0) return modifiers.join(" + ");
      return keyLabel;
  }
  
  if (modifiers.length > 0) return [...modifiers, keyLabel].join(" + ");
  return keyLabel;
};

export default function KeybindSettings() {
  const [recording, setRecording] = useState(null);
  const [muteKeybinding, setMuteKeybinding] = useState(null);
  const [deafenKeybinding, setDeafenKeybinding] = useState(null);
  const [cameraKeybinding, setCameraKeybinding] = useState(null);
  const [error, setError] = useState(null);
  const [recordedKeybinding, setRecordedKeybinding] = useState(null);
  useEffect(() => {
    if (window.netrex) {
      window.netrex.getHotkey("mute").then((k) => setMuteKeybinding(k || null));
      window.netrex
        .getHotkey("deafen")
        .then((k) => setDeafenKeybinding(k || null));
      window.netrex
        .getHotkey("camera")
        .then((k) => setCameraKeybinding(k || null));
    }
  }, []);
  /* RECORDING LOGIC */
  // Kullanıcı odada mı kontrol et (input listener zaten çalışıyor mu?)
  let inRoom = false;
  try {
    // Eğer useRoomContext hata verirse oda dışındayız demektir.
    // Hata vermezse odadayız, bu yüzden input listener zaten çalışıyor olabilir.
    useRoomContext();
    inRoom = true;
  } catch (e) {
    // Oda dışında
  }

  useEffect(() => {
    if (!recording || !window.netrex) return;
    
    // 1. Dinleyiciyi başlat (Eğer zaten çalışıyorsa IPC tarafında handled)
    window.netrex.startInputListener();
    window.netrex.setRecordingMode(true);
    
    const handleRawKeydown = async (event) => {
      setError(null);
      let keybinding;
      if (event.type === "mouse")
        keybinding = { type: "mouse", mouseButton: event.mouseButton };
      else {
        const isModifier = isModifierKey(event.keycode);
        keybinding = {
          type: "keyboard",
          keycode: event.keycode,
          ctrlKey: isModifier ? false : event.ctrlKey || false,
          shiftKey: isModifier ? false : event.shiftKey || false,
          altKey: isModifier ? false : event.altKey || false,
          metaKey: isModifier ? false : event.metaKey || false,
        };
      }
      try {
        // Çakışma kontrolü (Aynı tuş başka bir eyleme atanmış mı?)
        // Ancak kendisi ise (örneğin Mute'a Ctrl+A atanmış, tekrar Mute'a Ctrl+A atıyor) sorun yok.
        // Ama farklı eylemelerde aynı tuşa izin vermemeliyiz.
        // Basit kontrol:
        const currentMute = recording !== "mute" ? muteKeybinding : null;
        const currentDeafen = recording !== "deafen" ? deafenKeybinding : null;
        const currentCamera = recording !== "camera" ? cameraKeybinding : null;

        const isDuplicate = [currentMute, currentDeafen, currentCamera].some(existing => {
            if (!existing) return false;
            // Mouse
            if (existing.type === "mouse" && keybinding.type === "mouse") {
                return existing.mouseButton === keybinding.mouseButton;
            }
            // Keyboard
            if (existing.type === "keyboard" && keybinding.type === "keyboard") {
                return existing.keycode === keybinding.keycode &&
                       existing.ctrlKey === keybinding.ctrlKey &&
                       existing.shiftKey === keybinding.shiftKey &&
                       existing.altKey === keybinding.altKey &&
                       existing.metaKey === keybinding.metaKey;
            }
            return false;
        });

        if (isDuplicate) {
            setError("Bu tuş kombinasyonu zaten başka bir eylem için kullanılıyor.");
            // Kaydı bitir (veya kullanıcıya başka tuş seçtirmesi için devam edebiliriz ama genellikle hata verip dururuz)
            // Ama kullanıcı tekrar denemek isterse kaydı devam ettirebiliriz.
            // Biz burada kaydı durduralım.
             setRecording(null);
             setRecordedKeybinding(null);
             return;
        }

        const result = await window.netrex.updateHotkey(recording, keybinding);
        if (result.success) {
          // Canlı önizleme için state'i güncelle (sadece UI, kayıt henüz bitmedi)
          setRecordedKeybinding(keybinding);

          if (recording === "mute") setMuteKeybinding(keybinding);
          if (recording === "deafen") setDeafenKeybinding(keybinding);
          if (recording === "camera") setCameraKeybinding(keybinding);
          
          // Eğer sadece modifier tuşuna basıldıysa kaydı durdurma (Kombinasyon için bekle)
          // Örnek: Ctrl'ye bastı -> Ctrl atandı ama kayıt devam ediyor -> A'ya bastı -> Ctrl+A atandı ve kayıt bitti.
          // Mouse tuşları her zaman kaydı bitirir.
          if (event.type === "mouse" || (event.type === "keyboard" && !isModifierKey(event.keycode))) {
            setRecording(null);
            setRecordedKeybinding(null); // Kayıt bitti, temizle
          }
        } else {
          setError(result.error || "Bu tuş atanamadı.");
          setRecording(null);
        }
      } catch (err) {
        console.error(err);
        setRecording(null);
      }
    };
    window.netrex.onRawKeydown(handleRawKeydown);
    return () => {
      window.netrex.setRecordingMode(false);
      window.netrex.removeListener("raw-keydown");
      
      // 2. Eğer odada DEĞİLSEK dinleyiciyi durdur (CPU tasarrufu)
      // Odadaysak ActiveRoom.js zaten yönetiyor, dokunma.
      if (!inRoom) {
         window.netrex.stopInputListener();
      }
    };
  }, [recording, inRoom]);
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 pb-10">
      <h3 className="text-2xl font-bold text-white mb-6 relative">
        <span className="relative z-10">Tuş Atamaları</span>
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 opacity-0 hover:opacity-100 transition-opacity duration-300 blur-sm"></div>
      </h3>

      {/* Header Banner */}
      <div className="glass-strong rounded-2xl overflow-hidden border border-white/20 shadow-soft-lg hover:shadow-xl transition-all duration-300 mb-6 relative group/card">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 z-10 pointer-events-none"></div>
        
        <div className="h-20 w-full bg-gradient-to-r from-orange-600 via-red-600 to-orange-600 relative overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.1)_0%,transparent_50%)]"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(255,255,255,0.1)_0%,transparent_50%)]"></div>
          </div>
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/30"></div>
          <div className="absolute inset-0 flex items-center px-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-lg">
                <Keyboard size={24} className="text-white" />
              </div>
              <div>
                <h4 className="text-white font-bold text-lg">Kısayol Tuşları</h4>
                <p className="text-white/70 text-sm">Hızlı erişim için tuş kombinasyonları</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-gradient-to-r from-red-500/15 to-red-600/15 text-red-300 p-4 rounded-xl mb-4 flex items-center gap-3 text-sm border border-red-500/30 shadow-soft backdrop-blur-sm animate-fadeIn relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-transparent"></div>
          <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center relative z-10">
            <Info size={16} className="text-red-400" />
          </div>
          <span className="relative z-10 font-medium">{error}</span>
        </div>
      )}

      <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
        
        <div className="flex bg-gradient-to-r from-[#1a1b1e] via-[#25272a] to-[#1a1b1e] p-4 border-b border-white/10">
          <div className="flex-1 text-xs font-bold text-[#949ba4] uppercase flex items-center gap-2">
            <div className="w-1 h-1 bg-indigo-400 rounded-full"></div>
            Eylem
          </div>
          <div className="w-44 text-center text-xs font-bold text-[#949ba4] uppercase flex items-center justify-center gap-2">
            <div className="w-1 h-1 bg-purple-400 rounded-full"></div>
            Tuş Kombinasyonu
          </div>
        </div>
        
        <KeybindRow
          label="Mikrofonu Sustur (Mute)"
          description="Kendi sesini kapatır/açar."
          shortcut={formatKeybinding(muteKeybinding)}
          isRecording={recording === "mute"}
          recordedKeybinding={recording === "mute" ? recordedKeybinding : null}
          formatKeybinding={formatKeybinding}
          icon={<Mic size={16} className="text-indigo-400" />}
          onClick={() => {
            setRecording("mute");
            setRecordedKeybinding(null);
            setError(null);
          }}
          onRemove={async () => {
            if (window.netrex) {
              const result = await window.netrex.updateHotkey("mute", null);
              if (result?.success) {
                setMuteKeybinding(null);
                toastOnce("Tuş ataması kaldırıldı.", "success");
              } else {
                toastOnce(
                  result?.error || "Tuş ataması kaldırılamadı.",
                  "error"
                );
              }
            }
          }}
        />
        <KeybindRow
          label="Sağırlaştır (Deafen)"
          description="Hem mikrofonu hem hoparlörü kapatır."
          shortcut={formatKeybinding(deafenKeybinding)}
          isRecording={recording === "deafen"}
          recordedKeybinding={recording === "deafen" ? recordedKeybinding : null}
          formatKeybinding={formatKeybinding}
          icon={<Volume2 size={16} className="text-purple-400" />}
          onClick={() => {
            setRecording("deafen");
            setRecordedKeybinding(null);
            setError(null);
          }}
          onRemove={async () => {
            if (window.netrex) {
              const result = await window.netrex.updateHotkey("deafen", null);
              if (result?.success) {
                setDeafenKeybinding(null);
                toastOnce("Tuş ataması kaldırıldı.", "success");
              } else {
                toastOnce(
                  result?.error || "Tuş ataması kaldırılamadı.",
                  "error"
                );
              }
            }
          }}
        />
        <KeybindRow
          label="Kamerayı Aç/Kapat"
          description="Kamerayı açıp kapatır."
          shortcut={formatKeybinding(cameraKeybinding)}
          isRecording={recording === "camera"}
          recordedKeybinding={recording === "camera" ? recordedKeybinding : null}
          formatKeybinding={formatKeybinding}
          icon={<Camera size={16} className="text-cyan-400" />}
          onClick={() => {
            setRecording("camera");
            setRecordedKeybinding(null);
            setError(null);
          }}
          onRemove={async () => {
            if (window.netrex) {
              const result = await window.netrex.updateHotkey("camera", null);
              if (result?.success) {
                setCameraKeybinding(null);
                toastOnce("Tuş ataması kaldırıldı.", "success");
              } else {
                toastOnce(
                  result?.error || "Tuş ataması kaldırılamadı.",
                  "error"
                );
              }
            }
          }}
        />
      </div>

      {/* Info Box */}
      <div className="mt-4 glass-strong rounded-xl p-4 border border-white/10 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0">
          <Info size={16} className="text-indigo-400" />
        </div>
        <p className="text-xs text-[#949ba4]">
          Netrex, uygulama simge durumuna küçültülmüş veya arka planda olsa bile bu tuşları algılar.
        </p>
      </div>
    </div>
  );
}
