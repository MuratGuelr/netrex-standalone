import { create } from "zustand";

/**
 * 🚀 UpdateStore - Application Update Tracking
 * Centralizes update status and progress for the entire UI.
 */
export const useUpdateStore = create((set) => ({
  status: "idle", // idle, checking, available, downloading, downloaded, error
  progress: 0,
  updateInfo: null,

  setStatus: (status) => set({ status }),
  setProgress: (progress) => set({ progress }),
  setUpdateInfo: (updateInfo) => set({ updateInfo }),

  initialize: () => {
    if (typeof window === "undefined" || !window.netrex) return;

    window.netrex.onUpdateStatus((status, info) => {
      set({ status });
      if (info && typeof info === 'object') {
        set({ updateInfo: info });
      }
    });

    window.netrex.onUpdateProgress((percent) => {
      set({ status: "downloading", progress: Math.round(percent) });
    });

    // Development Simulation Support
    window.addEventListener("NETREX_TEST_UPDATE", (e) => {
      const { status, progress, info } = e.detail;
      if (status) set({ status });
      if (progress !== undefined) set({ progress });
      if (info) set({ updateInfo: info });
    });
  },

  reset: () => set({ status: "idle", progress: 0, updateInfo: null }),
}));
