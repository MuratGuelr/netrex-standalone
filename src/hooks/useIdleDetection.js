import { useEffect, useRef } from 'react';
import { useSettingsStore } from '@/src/store/settingsStore';

export function useIdleDetection() {
  const { setIsAutoIdle, idleTimeout } = useSettingsStore();
  
  // Timeout referansı
  const timeoutRef = useRef(null);

  useEffect(() => {
    const handleActivity = () => {
      // Aktivite olduğunda:
      // 1. Önceki timeout'u temizle
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // 2. Kullanıcıyı aktif yap (Eğer auto-idle ise online'a döner)
      setIsAutoIdle(false);

      // 3. Yeni timeout başlat
      timeoutRef.current = setTimeout(() => {
        // Süre dolduğunda idle yap
        setIsAutoIdle(true);
      }, idleTimeout || 300000); // Varsayılan 5 dk
    };

    // İlk yüklemede sayacı başlat
    handleActivity();

    // Event listener'lar
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('mousedown', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('focus', handleActivity);
    // window.addEventListener('scroll', handleActivity); // Scroll gereksiz performans kaybı yaratabilir

    // Blur olduğunda hemen idle yapma, sadece aktivite sayacı işlemeye devam eder.
    // İsterseniz blur olduğunda daha kısa bir süre sonra idle yapabilirsiniz.

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('mousedown', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('focus', handleActivity);
    };
  }, [idleTimeout, setIsAutoIdle]);
}
