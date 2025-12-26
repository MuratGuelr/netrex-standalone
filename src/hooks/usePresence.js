"use client";

/**
 * 🟢 usePresence - User Presence Management Hook
 * Tracks user's online/idle/offline status and syncs to Firebase
 * 
 * States:
 * - online: User is active in the app
 * - idle: App is minimized or not focused (set after delay)
 * - offline: App is closed
 */

import { useEffect, useRef, useCallback } from 'react';
import { doc, updateDoc, serverTimestamp, onDisconnect, getDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuthStore } from '@/src/store/authStore';
import { useServerStore } from '@/src/store/serverStore';
import { useSettingsStore } from '@/src/store/settingsStore';

// Idle timeout in milliseconds (5 minutes of no focus)
const IDLE_TIMEOUT = 5 * 60 * 1000;
// Debounce for focus/blur events (avoid rapid switches)
const FOCUS_DEBOUNCE = 3000;

export function usePresence() {
  const { user } = useAuthStore();
  const { currentServer } = useServerStore();
  const { userStatus } = useSettingsStore();
  
  const idleTimeoutRef = useRef(null);
  const lastUpdateRef = useRef(0);
  const currentStatusRef = useRef('online');
  const isElectronRef = useRef(false);

  // Update presence in Firebase
  const updatePresence = useCallback(async (status) => {
    if (!user?.uid || !currentServer?.id) return;
    
    // Debounce - avoid too many writes
    const now = Date.now();
    if (now - lastUpdateRef.current < FOCUS_DEBOUNCE && status === currentStatusRef.current) {
      return;
    }
    
    // If user manually set status to invisible, don't override
    if (userStatus === 'invisible') {
      status = 'offline';
    }
    
    lastUpdateRef.current = now;
    currentStatusRef.current = status;

    try {
      const memberRef = doc(db, 'servers', currentServer.id, 'members', user.uid);
      await updateDoc(memberRef, {
        presence: status,
        lastSeen: serverTimestamp()
      });
      console.log(`👤 Presence updated: ${status}`);
    } catch (error) {
      console.error('Failed to update presence:', error);
    }
  }, [user?.uid, currentServer?.id, userStatus]);

  // Set offline on all servers when app closes
  const setOfflineOnAllServers = useCallback(async () => {
    if (!user?.uid) return;
    
    try {
      const { servers } = useServerStore.getState();
      const updatePromises = servers.map(server => 
        updateDoc(doc(db, 'servers', server.id, 'members', user.uid), {
          presence: 'offline',
          lastSeen: serverTimestamp()
        }).catch(() => {}) // Ignore errors for individual servers
      );
      await Promise.allSettled(updatePromises);
      console.log('👤 Presence set to offline on all servers');
    } catch (error) {
      console.error('Failed to set offline status:', error);
    }
  }, [user?.uid]);

  // Handle userStatus changes from settingsStore (driven by useIdleDetection or manual toggle)
  useEffect(() => {
    if (user?.uid && currentServer?.id) {
        // userStatus değiştiğinde Firebase'i güncelle
        // 'invisible' durumunu zaten updatePresence içinde kontrol ediyoruz ama burada da userStatus direkt geliyor
        updatePresence(userStatus);
    }
  }, [userStatus, user?.uid, currentServer?.id, updatePresence]);

  // Window focus handler - just triggers detection reset via hook usually, 
  // but here we can just ensure we are online if we were auto-idle
  // Actually useIdleDetection handles switching back to online on activity.
  // So we don't need manual focus/blur here anymore for idle state.
  // We keep beforeunload for offline status.
  
  // Setup listeners for offline status
  useEffect(() => {
    if (!user?.uid) return;

    isElectronRef.current = typeof window !== 'undefined' && !!window.netrex;

    // Beforeunload - try to set offline
    const handleBeforeUnload = () => {
      setOfflineOnAllServers();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Electron-specific: register cleanup task
    if (isElectronRef.current) {
        const { registerCleanupTask } = require('@/src/utils/cleanup');
        // Register the offline setter
        const unregister = registerCleanupTask(async () => {
             console.log("👤 Setting offline status before quit...");
             await setOfflineOnAllServers();
        });
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            setOfflineOnAllServers();
            unregister();
        };
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      setOfflineOnAllServers();
    };
  }, [user?.uid, setOfflineOnAllServers]);

  return {
    updatePresence,
    setOffline: () => updatePresence('offline'),
    setOnline: () => updatePresence('online'),
    setIdle: () => updatePresence('idle')
  };
}

export default usePresence;
