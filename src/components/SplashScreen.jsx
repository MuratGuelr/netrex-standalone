"use client";

/**
 * 🚀 SplashScreen - Premium Animated Splash Screen
 * Restored after git conflict. 
 * Features: Aurora background, floating particles, interactive mouse glow, sequential loading text.
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const CONFIG = {
  drawDuration: 1.2,
  fillDelay: 0.1,
  fillDuration: 0.4,
  holdDuration: 0.2,
  exitDuration: 0.4,
  strokeColor: "#a855f7",
  fillColor: "#a855f7",
  bgGradientFrom: "#050508",
  bgGradientTo: "#0a0a0f",
  strokeWidth: 2,
  viewBox: "0 0 2560 2560",
  logoSize: 120,
};

const LOGO_PATH = "M470 2469 c-126 -21 -259 -116 -318 -227 -63 -119 -62 -98 -62 -952 0 -451 4 -800 10 -835 20 -127 120 -269 232 -330 102 -56 87 -55 954 -55 703 0 807 2 855 16 149 44 264 158 315 314 17 51 19 114 22 825 2 540 0 794 -8 850 -29 204 -181 362 -380 394 -81 13 -1540 13 -1620 0z m816 -1035 l339 -396 3 71 c3 70 2 72 -38 120 l-40 48 2 274 3 274 132 3 c131 3 133 2 137 -20 3 -13 4 -257 3 -543 l-2 -520 -105 -3 -105 -2 -235 276 c-129 153 -281 331 -337 396 l-103 119 0 -75 c0 -73 1 -76 40 -121 l40 -47 -2 -271 -3 -272 -135 0 -135 0 -3 530 c-1 292 0 536 3 543 3 8 33 12 103 12 l98 0 340 -396z";

const LOADING_TEXTS = [
  "Hazırlanıyor",
  "Kontrol Ediliyor",
  "Başlatılıyor"
];

const containerVariants = {
  visible: { opacity: 1, scale: 1 },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: CONFIG.exitDuration, ease: [0.4, 0, 0.2, 1] },
  },
};

const logoContainerVariants = {
  hidden: { scale: 0.8, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: { duration: 0.5, ease: "easeOut" },
  },
};

const dotsVariants = {
  animate: { transition: { staggerChildren: 0.2 } },
};

const dotVariants = {
  initial: { opacity: 0.3 },
  animate: {
    opacity: [0.3, 1, 0.3],
    transition: { duration: 1, repeat: Infinity, ease: "easeInOut" },
  },
};

export default function SplashScreen({ 
  onComplete,
  showLoadingText = true,
}) {
  const [phase, setPhase] = useState("draw");
  const [isVisible, setIsVisible] = useState(true);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [loadingStep, setLoadingStep] = useState(0);

  useEffect(() => {
    const handleMouseMove = (e) => {
        setMousePos({
            x: (e.clientX / window.innerWidth - 0.5) * 20,
            y: (e.clientY / window.innerHeight - 0.5) * 20
        });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    const textInterval = setInterval(() => {
        setLoadingStep(prev => prev < LOADING_TEXTS.length - 1 ? prev + 1 : prev);
    }, 1200);
    return () => clearInterval(textInterval);
  }, []);

  useEffect(() => {
    const timeline = async () => {
      await new Promise((resolve) => setTimeout(resolve, CONFIG.drawDuration * 1000));
      setPhase("fill");
      await new Promise((resolve) => 
        setTimeout(resolve, (CONFIG.fillDelay + CONFIG.fillDuration + CONFIG.holdDuration) * 1000)
      );
      setPhase("exit");
      await new Promise((resolve) => setTimeout(resolve, CONFIG.exitDuration * 1000));
      setIsVisible(false);
      onComplete?.();
    };
    timeline();
  }, [onComplete]);

  return (
    <AnimatePresence mode="wait">
      {isVisible && (
        <motion.div
          key="splash-screen"
          className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
          style={{ background: "#050508" }}
          variants={containerVariants}
          initial="visible"
          animate="visible"
          exit="exit"
        >
          {/* Backgrounds */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <motion.div
               animate={{ x: [0, 50, 0], y: [0, 30, 0], scale: [1, 1.2, 1] }}
               transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
               className="absolute top-[-20%] left-[-10%] w-[80%] h-[70%] rounded-full bg-indigo-600/10 blur-[120px]"
            />
            <motion.div
               animate={{ x: [0, -40, 0], y: [0, 60, 0], scale: [1.2, 1, 1.2] }}
               transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
               className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[60%] rounded-full bg-purple-600/10 blur-[120px]"
            />
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.05] contrast-150 brightness-150" />
            <motion.div 
               className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-indigo-500/5 blur-[100px]"
               animate={{ x: mousePos.x, y: mousePos.y }}
            />
          </div>

          {/* Particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-white rounded-full"
                style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, opacity: Math.random() * 0.3 }}
                animate={{ y: [0, -100], opacity: [0, 0.3, 0], scale: [0, 1.5, 0] }}
                transition={{ duration: 3 + Math.random() * 5, repeat: Infinity, delay: Math.random() * 5, ease: "easeInOut" }}
              />
            ))}
          </div>

          {/* Main Content */}
          <div className="relative z-10 flex flex-col items-center gap-12">
            <motion.div className="relative" variants={logoContainerVariants} initial="hidden" animate="visible">
              <motion.div
                className="absolute inset-0 rounded-[40px]"
                style={{
                  width: CONFIG.logoSize + 60, height: CONFIG.logoSize + 60, left: -30, top: -30,
                  border: `1px solid transparent`,
                  background: `linear-gradient(45deg, ${CONFIG.strokeColor}20, transparent, ${CONFIG.strokeColor}10) border-box`,
                  WebkitMask: `linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)`,
                  WebkitMaskComposite: 'xor', maskComposite: 'exclude',
                }}
                animate={{ rotate: 360, opacity: phase === "fill" ? 1 : 0.4 }}
                transition={{ rotate: { duration: 12, repeat: Infinity, ease: "linear" }, opacity: { duration: 1 } }}
              />
              <div className="absolute inset-0 rounded-[35px] border border-white/5" style={{ width: CONFIG.logoSize + 40, height: CONFIG.logoSize + 40, left: -20, top: -20 }} />
              <motion.svg
                width={CONFIG.logoSize} height={CONFIG.logoSize} viewBox={CONFIG.viewBox} className="relative z-10"
                style={{ filter: phase === "fill" ? `drop-shadow(0 0 35px ${CONFIG.fillColor}60)` : `drop-shadow(0 0 20px ${CONFIG.strokeColor}40)` }}
              >
                <g transform="translate(0, 2560) scale(1, -1)">
                  <motion.path
                    d={LOGO_PATH} fill="transparent" stroke={CONFIG.strokeColor} strokeWidth={40} strokeLinecap="round" strokeLinejoin="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: phase === "fill" ? 0.3 : 1 }}
                    transition={{ pathLength: { duration: CONFIG.drawDuration, ease: [0.45, 0.05, 0.55, 0.95] }, opacity: { duration: 0.8 } }}
                  />
                  <motion.path
                    d={LOGO_PATH} stroke="transparent" strokeWidth={0} fill={CONFIG.fillColor}
                    initial={{ fillOpacity: 0, scale: 0.95 }}
                    animate={{ fillOpacity: phase === "fill" || phase === "exit" ? 1 : 0, scale: phase === "fill" ? 1 : 0.95 }}
                    transition={{ fillOpacity: { duration: 0.8 }, scale: { duration: 1, ease: "easeOut" } }}
                  />
                </g>
              </motion.svg>
            </motion.div>

            {/* Brand & Loading Info */}
            <div className="flex flex-col items-center gap-8">
                <motion.h1 
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                  className="text-3xl font-black text-white tracking-[0.3em] ml-[0.3em] text-center"
                >
                  NETREX
                </motion.h1>

                <div className="relative w-56 h-[6px] bg-white/[0.03] rounded-full p-[1px] border border-white/5 overflow-hidden">
                   <motion.div className="absolute inset-0 bg-white/[0.02]" animate={{ x: ['-100%', '100%'] }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} />
                   <motion.div
                    className="h-full rounded-full relative z-10"
                    style={{ background: `linear-gradient(90deg, ${CONFIG.strokeColor}, ${CONFIG.fillColor}, ${CONFIG.strokeColor})`, backgroundSize: '200% 100%' }}
                    initial={{ width: "0%" }}
                    animate={{ width: "100%", backgroundPosition: ['0% 0%', '200% 0%'] }}
                    transition={{ width: { duration: CONFIG.drawDuration + CONFIG.fillDuration, ease: "easeInOut" }, backgroundPosition: { duration: 3, repeat: Infinity, ease: "linear" } }}
                   />
                </div>

                {showLoadingText && (
                  <motion.div className="flex flex-col items-center gap-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
                    <span className="text-white/40 text-[10px] font-bold uppercase tracking-[0.4em] ml-[0.4em] text-center">
                        {LOADING_TEXTS[loadingStep]}
                    </span>
                    <motion.div className="flex gap-2" variants={dotsVariants} animate="animate">
                      {[0, 1, 2].map((i) => (
                        <motion.span key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-500/40" variants={dotVariants} />
                      ))}
                    </motion.div>
                  </motion.div>
                )}
            </div>
          </div>

          <div className="absolute bottom-12 left-12 flex flex-col gap-1">
             <div className="w-12 h-[1px] bg-white/10" />
             <div className="w-8 h-[1px] bg-white/5" />
          </div>
          <div className="absolute top-12 right-12 flex flex-col items-end gap-1">
             <span className="text-white/10 font-mono text-[10px] tracking-widest uppercase">Initializing System</span>
             <div className="w-24 h-[1px] bg-white/10" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
