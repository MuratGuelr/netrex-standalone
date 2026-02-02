"use client";

/**
 * 🚀 ExitSplashScreen - Production-Ready Animated Exit Screen
 * Premium Edition - Matches SplashScreen aesthetics
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ============================================================================
// CONFIGURATION
// ============================================================================
const CONFIG = {
  // Timing
  introDuration: 0.3,
  stepDuration: 0.6,
  exitDuration: 0.2,

  // Colors
  strokeColor: "#ef4444",   // Red for exit/stop
  fillColor: "#ef4444",     
  bgBase: "#050508",
  
  // SVG Settings
  strokeWidth: 2,
  viewBox: "0 0 2560 2560",
  logoSize: 120,
};

const LOGO_PATH = "M470 2469 c-126 -21 -259 -116 -318 -227 -63 -119 -62 -98 -62 -952 0 -451 4 -800 10 -835 20 -127 120 -269 232 -330 102 -56 87 -55 954 -55 703 0 807 2 855 16 149 44 264 158 315 314 17 51 19 114 22 825 2 540 0 794 -8 850 -29 204 -181 362 -380 394 -81 13 -1540 13 -1620 0z m816 -1035 l339 -396 3 71 c3 70 2 72 -38 120 l-40 48 2 274 3 274 132 3 c131 3 133 2 137 -20 3 -13 4 -257 3 -543 l-2 -520 -105 -3 -105 -2 -235 276 c-129 153 -281 331 -337 396 l-103 119 0 -75 c0 -73 1 -76 40 -121 l40 -47 -2 -271 -3 -272 -135 0 -135 0 -3 530 c-1 292 0 536 3 543 3 8 33 12 103 12 l98 0 340 -396z";

const EXIT_STEPS = [
  "Bağlantılar kesiliyor...",
  "Oda durumu güncelleniyor...",
  "Veriler senkronize ediliyor...",
  "Görüşmek üzere!"
];

const containerVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

const logoVariants = {
  hidden: { scale: 0.8, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: { duration: 0.5, ease: "easeOut" }
  }
};

const textVariants = {
  initial: { opacity: 0 },
  animate: { 
    opacity: 1, 
    transition: { duration: 0.4 }
  },
  exit: { 
    opacity: 0, 
    transition: { duration: 0.3 }
  }
};

export default function ExitSplashScreen({ onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

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
    const runSteps = async () => {
      await new Promise(r => setTimeout(r, CONFIG.stepDuration * 1000));
      setCurrentStep(1);
      await new Promise(r => setTimeout(r, CONFIG.stepDuration * 1000));
      setCurrentStep(2);
      await new Promise(r => setTimeout(r, CONFIG.stepDuration * 1000));
      setCurrentStep(3);
      await new Promise(r => setTimeout(r, CONFIG.stepDuration * 1000));
      onComplete?.();
    };
    runSteps();
  }, [onComplete]);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[10000] flex items-center justify-center overflow-hidden"
        style={{ background: CONFIG.bgBase }}
        variants={containerVariants}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        {/* 🌌 Aurora Backgrounds (Red Theme) */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
             animate={{ x: [0, -30, 0], y: [0, 50, 0], scale: [1, 1.1, 1] }}
             transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
             className="absolute top-[-10%] right-[-10%] w-[70%] h-[70%] rounded-full bg-red-600/10 blur-[120px]"
          />
          <motion.div
             animate={{ x: [0, 40, 0], y: [0, -30, 0], scale: [1.1, 1, 1.1] }}
             transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
             className="absolute bottom-[-20%] left-[-10%] w-[80%] h-[60%] rounded-full bg-rose-900/10 blur-[120px]"
          />
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.04] contrast-125" />
          
          <motion.div 
             className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-red-500/5 blur-[100px]"
             animate={{ x: mousePos.x, y: mousePos.y }}
          />
        </div>

        {/* ✨ Floating Particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(15)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-red-300 rounded-full"
              style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, opacity: 0 }}
              animate={{ y: [0, 100], opacity: [0, 0.2, 0], scale: [0, 1.2, 0] }}
              transition={{ duration: 4 + Math.random() * 4, repeat: Infinity, delay: Math.random() * 5, ease: "easeInOut" }}
            />
          ))}
        </div>

        <div className="relative z-10 flex flex-col items-center gap-12">
          {/* Logo Section */}
          <motion.div className="relative" variants={logoVariants} initial="hidden" animate="visible">
            {/* Spinning Ring */}
            <motion.div
              className="absolute inset-0 rounded-[40px]"
              style={{
                width: CONFIG.logoSize + 60, height: CONFIG.logoSize + 60, left: -30, top: -30,
                border: `1px solid transparent`,
                background: `linear-gradient(45deg, ${CONFIG.strokeColor}20, transparent, ${CONFIG.strokeColor}10) border-box`,
                WebkitMask: `linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)`,
                WebkitMaskComposite: 'xor', maskComposite: 'exclude',
              }}
              animate={{ rotate: -360 }}
              transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
            />
            
            <motion.svg
              width={CONFIG.logoSize} height={CONFIG.logoSize} viewBox={CONFIG.viewBox} className="relative z-10"
              style={{ filter: `drop-shadow(0 0 30px ${CONFIG.fillColor}40)` }}
            >
              <g transform="translate(0, 2560) scale(1, -1)">
                  <motion.path
                  d={LOGO_PATH} fill={CONFIG.fillColor} stroke={CONFIG.fillColor} strokeWidth={20}
                  initial={{ pathLength: 1, fillOpacity: 0.5 }}
                  animate={{ pathLength: [1, 0.8, 1], fillOpacity: [0.5, 0.3, 0.5] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  />
              </g>
            </motion.svg>
          </motion.div>

          {/* Info Section */}
          <div className="flex flex-col items-center gap-8">
              <motion.h1 
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="text-3xl font-black text-white tracking-[0.3em] ml-[0.3em] text-center"
              >
                NETREX
              </motion.h1>

              {/* Progress */}
              <div className="relative w-56 h-[6px] bg-white/[0.03] rounded-full p-[1px] border border-white/5 overflow-hidden">
                <motion.div
                  className="h-full rounded-full relative z-10"
                  style={{ background: `linear-gradient(90deg, ${CONFIG.strokeColor}, #fca5a5, ${CONFIG.strokeColor})`, backgroundSize: '200% 100%' }}
                  initial={{ width: "0%" }}
                  animate={{ width: "100%", backgroundPosition: ['0% 0%', '200% 0%'] }}
                  transition={{ width: { duration: CONFIG.stepDuration * 4, ease: "linear" }, backgroundPosition: { duration: 3, repeat: Infinity, ease: "linear" } }}
                />
              </div>

              {/* Steps Text */}
              <div className="h-8 flex items-center justify-center relative w-72">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentStep}
                    variants={textVariants}
                    initial="initial" animate="animate" exit="exit"
                    className="text-white/40 text-[10px] font-bold uppercase tracking-[0.4em] ml-[0.4em] text-center absolute w-full"
                  >
                    {EXIT_STEPS[currentStep]}
                  </motion.div>
                </AnimatePresence>
              </div>
          </div>
        </div>

        {/* Decorative Lines */}
        <div className="absolute top-12 left-12 flex flex-col gap-1">
            <span className="text-white/10 font-mono text-[10px] tracking-widest uppercase">Closing Session</span>
            <div className="w-24 h-[1px] bg-white/10" />
        </div>
        <div className="absolute bottom-12 right-12 flex flex-col items-end gap-1">
            <div className="w-12 h-[1px] bg-white/10" />
            <div className="w-8 h-[1px] bg-white/5" />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
