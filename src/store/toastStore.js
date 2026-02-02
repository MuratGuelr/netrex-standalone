import { create } from 'zustand';

/**
 * 🍬 ToastStore - Global Toast Notification System (NDS v5.5)
 * Premium notification management without external libraries.
 */
export const useToastStore = create((set) => ({
  toasts: [],
  
  // Add a new toast and return its ID
  addToast: (toast) => {
    const id = toast.id || Math.random().toString(36).substring(2, 9);
    set((state) => ({
      toasts: [...state.toasts, {
        id,
        type: 'info',
        duration: 5000,
        ...toast,
        createdAt: Date.now(),
      }]
    }));
    return id;
  },

  // Update an existing toast
  updateToast: (id, updates) => set((state) => ({
    toasts: state.toasts.map(t => t.id === id ? { ...t, ...updates } : t)
  })),

  // Remove a specific toast
  removeToast: (id) => set((state) => ({
    toasts: state.toasts.filter(t => t.id !== id)
  })),

  // Alias for removeToast to match sonner/react-hot-toast API
  dismiss: (id) => set((state) => ({
    toasts: state.toasts.filter(t => t.id !== id)
  })),

  // Clear all toasts
  clearToasts: () => set({ toasts: [] })
}));
