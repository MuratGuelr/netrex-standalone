import { useEffect, useRef, useCallback } from 'react';
import { useSettingsStore } from '@/src/store/settingsStore';

/**
 * Idle Detection Hook (OPTIMIZED)
 * 
 * Sets user as "idle" under these conditions:
 * 1. Window is minimized for more than MINIMIZED_IDLE_DELAY
 * 2. Window is hidden (sent to tray) - immediately idle
 * 3. No user activity (mouse/keyboard) for idleTimeout duration
 * 
 * User returns to "online" when:
 * 1. Any activity is detected (mouse move, keypress, etc.)
 * 2. Window is restored/focused/shown
 * 
 * OPTIMIZATION: Mousemove events are throttled to reduce CPU usage
 */

// Delay before setting idle when minimized (30 seconds)
const MINIMIZED_IDLE_DELAY = 30 * 1000;

// Throttle delay for mousemove events (CPU optimization)
const MOUSEMOVE_THROTTLE_MS = 150;

export function useIdleDetection() {
  const { setIsAutoIdle, idleTimeout } = useSettingsStore();
  const lastMouseMoveRef = useRef(0); // Throttle için son hareket zamanı
  
  // Timeout referansları
  const inactivityTimeoutRef = useRef(null);
  const minimizedTimeoutRef = useRef(null);
  const isMinimizedRef = useRef(false);
  const isHiddenRef = useRef(false);

  useEffect(() => {
    // Aktivite olduğunda idle'dan çık (throttled for mousemove)
    const handleActivity = (isMouseMove = false) => {
      // Eğer pencere gizli veya minimize ise aktivite önemli değil
      if (isHiddenRef.current || isMinimizedRef.current) return;
      
      // 🚀 THROTTLE: Mousemove için throttle uygula (CPU optimizasyonu)
      if (isMouseMove) {
        const now = Date.now();
        if (now - lastMouseMoveRef.current < MOUSEMOVE_THROTTLE_MS) {
          return; // Throttle süresi içinde, atla
        }
        lastMouseMoveRef.current = now;
      }
      
      // Önceki inaktivite timeout'unu temizle
      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
      }

      // Kullanıcıyı aktif yap (Eğer auto-idle ise online'a döner)
      setIsAutoIdle(false);

      // Yeni timeout başlat (inaktivite için)
      inactivityTimeoutRef.current = setTimeout(() => {
        // Süre dolduğunda idle yap (pencere aktifken inaktivite)
        setIsAutoIdle(true);
      }, idleTimeout || 300000); // Varsayılan 5 dk
    };
    
    // Throttled mousemove handler
    const handleMouseMove = () => handleActivity(true);
    // Non-throttled handlers (keydown, mousedown, focus)
    const handleOtherActivity = () => handleActivity(false);

    // Pencere durumu değiştiğinde
    const handleWindowStateChange = (state) => {
      console.log('🪟 Window state changed:', state);
      
      switch (state) {
        case 'hidden':
          // Tray'e gönderildi - HEMEN idle yap
          isHiddenRef.current = true;
          isMinimizedRef.current = false;
          
          // Tüm timeout'ları temizle
          if (inactivityTimeoutRef.current) {
            clearTimeout(inactivityTimeoutRef.current);
          }
          if (minimizedTimeoutRef.current) {
            clearTimeout(minimizedTimeoutRef.current);
          }
          
          // Hemen idle yap
          setIsAutoIdle(true);
          break;
          
        case 'minimized':
          // Minimize edildi - belirli süre sonra idle yap
          isMinimizedRef.current = true;
          
          // Önceki minimize timeout'u varsa temizle
          if (minimizedTimeoutRef.current) {
            clearTimeout(minimizedTimeoutRef.current);
          }
          
          // Belirli süre sonra idle yap
          minimizedTimeoutRef.current = setTimeout(() => {
            if (isMinimizedRef.current) {
              setIsAutoIdle(true);
            }
          }, MINIMIZED_IDLE_DELAY);
          break;
          
        case 'restored':
        case 'focused':
        case 'shown':
          // Pencere tekrar görünür/aktif oldu
          isHiddenRef.current = false;
          isMinimizedRef.current = false;
          
          // Minimize timeout'unu temizle
          if (minimizedTimeoutRef.current) {
            clearTimeout(minimizedTimeoutRef.current);
          }
          
          // Kullanıcıyı aktif yap
          setIsAutoIdle(false);
          
          // İnaktivite sayacını yeniden başlat
          handleActivity();
          break;
      }
    };

    // İlk yüklemede sayacı başlat
    handleOtherActivity();

    // Browser event listener'ları (mousemove throttled)
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mousedown', handleOtherActivity);
    window.addEventListener('keydown', handleOtherActivity);
    window.addEventListener('focus', handleOtherActivity);

    // Electron window state listener
    if (typeof window !== 'undefined' && window.netrex?.onWindowStateChanged) {
      window.netrex.onWindowStateChanged(handleWindowStateChange);
    }

    // Visibility change (browser tab değişimi için)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Sayfa gizlendi ama bu minimize/tray ile aynı değil
        // Sadece inaktivite timeout devam etsin
      } else {
        // Sayfa görünür oldu
        handleActivity();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
      }
      if (minimizedTimeoutRef.current) {
        clearTimeout(minimizedTimeoutRef.current);
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleOtherActivity);
      window.removeEventListener('keydown', handleOtherActivity);
      window.removeEventListener('focus', handleOtherActivity);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      // Electron listener cleanup
      if (typeof window !== 'undefined' && window.netrex?.removeListener) {
        window.netrex.removeListener('window-state-changed');
      }
    };
  }, [idleTimeout, setIsAutoIdle]);
}
