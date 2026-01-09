"use client";

/**
 * 🟢 usePresence - User Presence Management Hook
 * Tracks user's online/idle/offline status and syncs to Firebase
 * 
 * States:
 * - online: User is active in the app
 * - idle: App is minimized/hidden or not focused (set after delay)
 * - offline: App is closed
 * 
 * Heartbeat System:
 * - Updates lastSeen every HEARTBEAT_INTERVAL while user is online/idle
 * - Client-side checks if lastSeen is stale to show offline status
 * - This handles cases where computer is shut down without closing app
 */

import { useEffect, useRef, useCallback } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuthStore } from '@/src/store/authStore';
import { useServerStore } from '@/src/store/serverStore';
import { useSettingsStore } from '@/src/store/settingsStore';
import { registerCleanupTask } from '@/src/utils/cleanup';

// Debounce for presence updates (avoid rapid switches)
const PRESENCE_DEBOUNCE = 2000;

// Heartbeat interval: Update lastSeen every 2 minutes while active
// This ensures that if computer is shut down, user will appear offline after STALE_THRESHOLD
const HEARTBEAT_INTERVAL = 2 * 60 * 1000; // 2 minutes

// How long before a user is considered "stale" (offline)
// Should be > HEARTBEAT_INTERVAL to account for network delays
export const PRESENCE_STALE_THRESHOLD = 5 * 60 * 1000; // 5 minutes

export function usePresence() {
  const { user } = useAuthStore();
  const { currentServer } = useServerStore();
  const { userStatus } = useSettingsStore();
  
  const lastUpdateRef = useRef(0);
  const currentStatusRef = useRef('online');
  const cleanupRegisteredRef = useRef(false);
  const heartbeatIntervalRef = useRef(null);

  // Update presence in Firebase (both member and user collections)
  const updatePresence = useCallback(async (status) => {
    if (!user?.uid) return;
    
    // Debounce - avoid too many writes
    const now = Date.now();
    if (now - lastUpdateRef.current < PRESENCE_DEBOUNCE && status === currentStatusRef.current) {
      return;
    }
    
    // If user manually set status to invisible, don't override
    if (userStatus === 'invisible') {
      status = 'offline';
    }
    
    lastUpdateRef.current = now;
    currentStatusRef.current = status;

    try {
      // SADECE users koleksiyonunu güncelle (Merkezi Yönetim)
      const updateData = {
        presence: status,
        lastSeen: serverTimestamp()
      };

      // Eğer kullanıcı gizleniyorsa (offline/invisible), oyun aktivitesini de temizle
      if (status === 'offline' || status === 'invisible') {
        updateData.gameActivity = null;
      }

      await updateDoc(doc(db, 'users', user.uid), updateData);
      
      console.log(`👤 Presence updated: ${status}`);
    } catch (error) {
      console.error('Failed to update presence:', error);
    }
  }, [user?.uid, currentServer?.id, userStatus]);

  // Update users collection only (Optimized Heartbeat)
  const sendHeartbeat = useCallback(async () => {
    const currentUser = useAuthStore.getState().user;
    const { userStatus: currentStatus } = useSettingsStore.getState();
    
    // Don't send heartbeat if user is offline or invisible
    if (!currentUser?.uid || currentStatus === 'offline' || currentStatus === 'invisible') {
      return;
    }
    
    try {
      // SADECE users koleksiyonunu güncelle
      // (Böylece 10 sunucuya üye olan biri için 11 yazma yerine sadece 1 yazma işlemi yapılır)
      await updateDoc(doc(db, 'users', currentUser.uid), {
        lastSeen: serverTimestamp(),
        presence: currentStatus || 'online'
      });
      
      console.log('💓 Heartbeat sent (Optimized)');
    } catch (error) {
      // Silently ignore heartbeat errors
    }
  }, []);

  // Set offline on all servers AND users collection when app closes
  const setOfflineOnAllServers = useCallback(async () => {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser?.uid) {
      console.log('👤 No user to set offline');
      return;
    }
    
    try {
      const { servers } = useServerStore.getState();
      const updatePromises = [];
      
      // Update all servers
      // SADECE users koleksiyonunu güncelle (Tüm sunucular buradan okuyacak)
      await updateDoc(doc(db, 'users', currentUser.uid), {
        presence: 'offline',
        lastSeen: serverTimestamp(),
        gameActivity: null 
      });
      
      console.log('👤 Presence set to offline (Centrally)');
    } catch (error) {
      console.error('Failed to set offline status:', error);
    }
  }, []);

  // Handle userStatus changes from settingsStore (driven by useIdleDetection or manual toggle)
  useEffect(() => {
    if (user?.uid) {
      updatePresence(userStatus);
    }
  }, [userStatus, user?.uid, updatePresence]);

  // Heartbeat interval - keeps lastSeen fresh while user is active
  useEffect(() => {
    if (!user?.uid) return;
    
    // Clear any existing interval
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
    
    // Start heartbeat interval
    heartbeatIntervalRef.current = setInterval(() => {
      sendHeartbeat();
    }, HEARTBEAT_INTERVAL);
    
    // Send initial heartbeat
    sendHeartbeat();
    
    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };
  }, [user?.uid, sendHeartbeat]);

  // Register cleanup task for offline status on app quit
  useEffect(() => {
    if (!user?.uid) return;
    
    // Register cleanup task only once
    if (!cleanupRegisteredRef.current) {
      cleanupRegisteredRef.current = true;
      
      const unregister = registerCleanupTask(async () => {
        console.log("👤 Cleanup task: Setting offline status before quit...");
        await setOfflineOnAllServers();
      });
      
      return () => {
        cleanupRegisteredRef.current = false;
        unregister();
      };
    }
  }, [user?.uid, setOfflineOnAllServers]);

  // Handle beforeunload (browser/window close)
  useEffect(() => {
    if (!user?.uid) return;

    const handleBeforeUnload = (event) => {
      // Try to set offline synchronously (may not complete)
      // The cleanup task will handle async cleanup
      console.log('👤 beforeunload: attempting to set offline...');
      
      // Use sendBeacon for reliable delivery (doesn't work with Firestore directly)
      // Instead, we rely on the cleanup mechanism
      setOfflineOnAllServers();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [user?.uid, setOfflineOnAllServers]);

  return {
    updatePresence,
    setOffline: () => updatePresence('offline'),
    setOnline: () => updatePresence('online'),
    setIdle: () => updatePresence('idle'),
    setOfflineOnAllServers,
    sendHeartbeat // Expose for manual heartbeat if needed
  };
}

/**
 * Helper function to check if a user's presence is stale
 * Use this in components that display user presence
 * 
 * @param {Object} member - Member object with presence and lastSeen fields
 * @returns {string} - Effective presence status ('online', 'idle', or 'offline')
 */
export function getEffectivePresence(member) {
  if (!member) return 'offline';
  
  const { presence, lastSeen } = member;
  
  // If already offline, return offline
  if (presence === 'offline') return 'offline';
  
  // Check if lastSeen is stale
  if (lastSeen) {
    const lastSeenTime = lastSeen?.toDate?.() || new Date(lastSeen);
    const now = Date.now();
    const timeSinceLastSeen = now - lastSeenTime.getTime();
    
    // If lastSeen is older than threshold, user is effectively offline
    if (timeSinceLastSeen > PRESENCE_STALE_THRESHOLD) {
      return 'offline';
    }
  } else {
    // No lastSeen at all, consider offline
    return 'offline';
  }
  
  // Return actual presence if not stale
  return presence || 'offline';
}

export default usePresence;
