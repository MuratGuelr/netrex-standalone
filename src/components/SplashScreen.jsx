"use client";

/**
 * 🚀 SplashScreen - Production-Ready Animated Splash Screen
 * 
 * Features:
 * - Phase 1 (Draw): SVG path draws continuously with pathLength
 * - Phase 2 (Fill): Logo fades to solid fill color
 * - Phase 3 (Exit): Splash screen fades out and unmounts
 * 
 * Tech: React + Framer Motion + Tailwind CSS
 * For: Next.js (App Router) + Electron
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ============================================================================
// CONFIGURATION - Easy customization
// ============================================================================
const CONFIG = {
  // Timing (in seconds)
  drawDuration: 2.0,        // How long the SVG path takes to draw
  fillDelay: 0.3,           // Delay before fill animation starts
  fillDuration: 0.8,        // How long the fill transition takes
  holdDuration: 0.5,        // How long to show the filled logo
  exitDuration: 0.6,        // Fade out duration
  
  // Colors
  strokeColor: "#a855f7",   // Purple stroke while drawing
  fillColor: "#a855f7",     // Final fill color
  bgGradientFrom: "#0a0a0f", // Background gradient start
  bgGradientTo: "#111118",   // Background gradient end
  
  // SVG Settings
  strokeWidth: 2,
  viewBox: "0 0 2560 2560",   // Netrex logo viewBox
  logoSize: 120,            // Logo container size in pixels
};

// ============================================================================
// NETREX LOGO PATH - Actual Netrex logo from logo.svg
// ============================================================================
// This is the actual Netrex logo path extracted from public/logo.svg
const LOGO_PATH = "M470 2469 c-126 -21 -259 -116 -318 -227 -63 -119 -62 -98 -62 -952 0 -451 4 -800 10 -835 20 -127 120 -269 232 -330 102 -56 87 -55 954 -55 703 0 807 2 855 16 149 44 264 158 315 314 17 51 19 114 22 825 2 540 0 794 -8 850 -29 204 -181 362 -380 394 -81 13 -1540 13 -1620 0z m816 -1035 l339 -396 3 71 c3 70 2 72 -38 120 l-40 48 2 274 3 274 132 3 c131 3 133 2 137 -20 3 -13 4 -257 3 -543 l-2 -520 -105 -3 -105 -2 -235 276 c-129 153 -281 331 -337 396 l-103 119 0 -75 c0 -73 1 -76 40 -121 l40 -47 -2 -271 -3 -272 -135 0 -135 0 -3 530 c-1 292 0 536 3 543 3 8 33 12 103 12 l98 0 340 -396z";

// ViewBox for the logo (original SVG uses scale transform)
const LOGO_VIEWBOX = "0 0 2560 2560";

// ============================================================================
// ANIMATION VARIANTS
// ============================================================================

// SVG Path Draw Animation
const pathVariants = {
  hidden: {
    pathLength: 0,
    opacity: 0,
  },
  draw: {
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: {
        duration: CONFIG.drawDuration,
        ease: "easeInOut",
      },
      opacity: {
        duration: 0.3,
      },
    },
  },
};

// Fill Animation (stroke to fill transition)
const fillVariants = {
  stroke: {
    fill: "transparent",
    stroke: CONFIG.strokeColor,
    strokeWidth: CONFIG.strokeWidth,
  },
  filled: {
    fill: CONFIG.fillColor,
    stroke: CONFIG.fillColor,
    strokeWidth: 0,
    transition: {
      duration: CONFIG.fillDuration,
      ease: "easeOut",
    },
  },
};

// Container fade out
const containerVariants = {
  visible: {
    opacity: 1,
    scale: 1,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: {
      duration: CONFIG.exitDuration,
      ease: [0.4, 0, 0.2, 1],
    },
  },
};

// Logo container animation
const logoContainerVariants = {
  hidden: {
    scale: 0.8,
    opacity: 0,
  },
  visible: {
    scale: 1,
    opacity: 1,
    transition: {
      duration: 0.5,
      ease: "easeOut",
    },
  },
};

// Glow pulse animation
const glowVariants = {
  initial: {
    opacity: 0.3,
    scale: 1,
  },
  animate: {
    opacity: [0.3, 0.6, 0.3],
    scale: [1, 1.1, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

// Loading dots animation
const dotsVariants = {
  animate: {
    transition: {
      staggerChildren: 0.2,
    },
  },
};

const dotVariants = {
  initial: { opacity: 0.3 },
  animate: {
    opacity: [0.3, 1, 0.3],
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

// ============================================================================
// SPLASH SCREEN COMPONENT
// ============================================================================
export default function SplashScreen({ 
  onComplete,
  showLoadingText = true,
  loadingText = "Yükleniyor",
}) {
  const [phase, setPhase] = useState("draw"); // "draw" | "fill" | "exit"
  const [isVisible, setIsVisible] = useState(true);

  // Animation sequence controller
  useEffect(() => {
    const timeline = async () => {
      // Phase 1: Draw (wait for draw animation to complete)
      await new Promise((resolve) => 
        setTimeout(resolve, CONFIG.drawDuration * 1000)
      );
      
      // Phase 2: Fill
      setPhase("fill");
      await new Promise((resolve) => 
        setTimeout(resolve, (CONFIG.fillDelay + CONFIG.fillDuration + CONFIG.holdDuration) * 1000)
      );
      
      // Phase 3: Exit
      setPhase("exit");
      await new Promise((resolve) => 
        setTimeout(resolve, CONFIG.exitDuration * 1000)
      );
      
      // Unmount
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
          style={{
            background: `linear-gradient(135deg, ${CONFIG.bgGradientFrom} 0%, ${CONFIG.bgGradientTo} 100%)`,
          }}
          variants={containerVariants}
          initial="visible"
          animate="visible"
          exit="exit"
        >
          {/* Animated Background Elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Primary Glow */}
            <motion.div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full"
              style={{
                background: `radial-gradient(circle, ${CONFIG.strokeColor}20 0%, transparent 70%)`,
              }}
              variants={glowVariants}
              initial="initial"
              animate="animate"
            />
            
            {/* Secondary Glow */}
            <motion.div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
              style={{
                background: `radial-gradient(circle, ${CONFIG.strokeColor}10 0%, transparent 60%)`,
              }}
              animate={{
                rotate: 360,
              }}
              transition={{
                duration: 20,
                repeat: Infinity,
                ease: "linear",
              }}
            />

            {/* Grid Pattern */}
            <div 
              className="absolute inset-0 opacity-[0.02]"
              style={{
                backgroundImage: `
                  linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
                `,
                backgroundSize: "50px 50px",
              }}
            />
          </div>

          {/* Main Content */}
          <div className="relative z-10 flex flex-col items-center gap-8">
            {/* Logo Container */}
            <motion.div
              className="relative"
              variants={logoContainerVariants}
              initial="hidden"
              animate="visible"
            >
              {/* Glow Ring */}
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{
                  width: CONFIG.logoSize + 40,
                  height: CONFIG.logoSize + 40,
                  left: -20,
                  top: -20,
                  border: `2px solid ${CONFIG.strokeColor}40`,
                }}
                animate={{
                  rotate: 360,
                  borderColor: [
                    `${CONFIG.strokeColor}40`,
                    `${CONFIG.strokeColor}80`,
                    `${CONFIG.strokeColor}40`,
                  ],
                }}
                transition={{
                  rotate: {
                    duration: 8,
                    repeat: Infinity,
                    ease: "linear",
                  },
                  borderColor: {
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  },
                }}
              />

              {/* SVG Logo */}
              <motion.svg
                width={CONFIG.logoSize}
                height={CONFIG.logoSize}
                viewBox={CONFIG.viewBox}
                className="relative z-10"
                style={{
                  filter: phase === "fill" 
                    ? `drop-shadow(0 0 30px ${CONFIG.fillColor}80)` 
                    : `drop-shadow(0 0 15px ${CONFIG.strokeColor}60)`,
                }}
              >
                <g transform="translate(0, 2560) scale(1, -1)">
                  {/* Drawing stroke animation */}
                  <motion.path
                    d={LOGO_PATH}
                    fill="transparent"
                    stroke={CONFIG.strokeColor}
                    strokeWidth={50}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ 
                      pathLength: 1, 
                      opacity: 1,
                    }}
                    transition={{
                      pathLength: { duration: CONFIG.drawDuration, ease: "easeInOut" },
                      opacity: { duration: 0.5 },
                    }}
                  />
                  
                  {/* Fill overlay - appears after draw */}
                  <motion.path
                    d={LOGO_PATH}
                    stroke="transparent"
                    strokeWidth={0}
                    initial={{ fill: "transparent" }}
                    animate={{ 
                      fill: phase === "fill" || phase === "exit" 
                        ? CONFIG.fillColor 
                        : "transparent" 
                    }}
                    transition={{ duration: CONFIG.fillDuration, ease: "easeOut" }}
                  />
                </g>
              </motion.svg>
            </motion.div>

            {/* Loading Text */}
            {showLoadingText && (
              <motion.div
                className="flex items-center gap-1 text-white/60 text-sm font-medium"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.5 }}
              >
                <span>{loadingText}</span>
                <motion.div
                  className="flex gap-1"
                  variants={dotsVariants}
                  animate="animate"
                >
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="w-1 h-1 rounded-full bg-white/60"
                      variants={dotVariants}
                      initial="initial"
                      animate="animate"
                      style={{ animationDelay: `${i * 0.2}s` }}
                    />
                  ))}
                </motion.div>
              </motion.div>
            )}

            {/* Progress Bar */}
            <motion.div
              className="w-48 h-1 bg-white/10 rounded-full overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${CONFIG.strokeColor}, ${CONFIG.fillColor})`,
                }}
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{
                  duration: CONFIG.drawDuration + CONFIG.fillDuration + CONFIG.holdDuration,
                  ease: "easeInOut",
                }}
              />
            </motion.div>
          </div>

          {/* Version Badge */}
          <motion.div
            className="absolute bottom-8 text-white/30 text-xs font-mono"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            Netrex v{process.env.NEXT_PUBLIC_APP_VERSION || "3.0.0"}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// USAGE EXAMPLE
// ============================================================================
/*
import SplashScreen from "@/src/components/SplashScreen";

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <>
      {showSplash && (
        <SplashScreen 
          onComplete={() => setShowSplash(false)}
          loadingText="Başlatılıyor"
        />
      )}
      
      {!showSplash && (
        <MainApp />
      )}
    </>
  );
}
*/

// ============================================================================
// CUSTOM SVG PATHS LIBRARY
// ============================================================================
/*
You can use these paths or create your own:

// Simple "N" letter
const N_PATH = "M 20 80 L 20 20 L 50 60 L 80 20 L 80 80";

// Circle with inner design
const CIRCLE_PATH = "M 50 10 A 40 40 0 1 1 49.99 10 M 50 25 A 25 25 0 1 1 49.99 25";

// Shield shape
const SHIELD_PATH = `
  M 50 5 
  L 90 20 
  L 90 50 
  Q 90 80 50 95 
  Q 10 80 10 50 
  L 10 20 
  Z
`;

// Play button
const PLAY_PATH = "M 30 20 L 30 80 L 80 50 Z";

// Headphones
const HEADPHONES_PATH = `
  M 15 50 Q 15 20 50 20 Q 85 20 85 50
  M 15 50 L 15 70 Q 15 80 25 80 L 25 50 Q 25 40 15 50
  M 85 50 L 85 70 Q 85 80 75 80 L 75 50 Q 75 40 85 50
`;
*/
