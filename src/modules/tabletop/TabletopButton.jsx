"use client";

import { Dices } from "lucide-react";
import { useSettingsStore } from "@/src/store/settingsStore";
import { useTabletopStore } from "./store";
import { tabletopActions } from "./TabletopHandler";

/** Alt çubuktaki masa düğmesi. Modül ayarlardan kapalıysa HİÇ görünmez. */
export default function TabletopButton() {
  const enabled = useSettingsStore((s) => s.tabletopEnabled);
  const viewing = useTabletopStore((s) => s.viewing);
  const session = useTabletopStore((s) => s.session);
  if (!enabled) return null;

  const openElsewhere = !!session && !viewing; // başkası masa açmış, ben katılmadım

  return (
    <div className="relative flex items-center">
      <div className="w-px h-8 bg-white/10 mx-1" />
      <button
        type="button"
        onClick={() => tabletopActions.toggle()}
        className={`w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl transition duration-300 relative active:scale-95 ${
          viewing
            ? "bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:bg-amber-500 hover:text-white hover:border-amber-500"
            : "bg-white/5 border border-white/10 text-[#b5bac1] hover:bg-white/10 hover:text-white hover:border-white/20"
        }`}
        title={
          viewing
            ? "Masayı kapat / ayrıl"
            : openElsewhere
              ? `${session.hostName || "Biri"} bir masa açtı — katıl`
              : "Masa aç (3D, arkadaşlarla zar ve parçalar)"
        }
      >
        <Dices size={20} className="sm:w-5 sm:h-5" />
        {openElsewhere && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_6px_rgba(251,191,36,0.7)]" />
        )}
      </button>
    </div>
  );
}
