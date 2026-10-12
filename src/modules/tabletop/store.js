import { create } from "zustand";

/**
 * 🎲 Masa modülü durumu (hafif; three.js / rapier BURADA YOK)
 *  - session: odada açık masa var mı? { hostId, hostName }
 *  - viewing: ben masayı açmış/izliyor muyum?
 */
export const useTabletopStore = create((set) => ({
  session: null,
  viewing: false,
  setSession: (session) => set({ session }),
  setViewing: (viewing) => set({ viewing }),
  reset: () => set({ session: null, viewing: false }),
}));
