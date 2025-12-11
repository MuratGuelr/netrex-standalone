import type { Config } from "tailwindcss";

/**
 * 🎨 Netrex Design System (NDS) v2.0 - Tailwind Configuration
 * 
 * Premium Dark-Only UI System for Voice Chat Applications
 * - Ultra-Premium Glassmorphism
 * - Deep Space Theme (darker than Discord)
 * - Neon/Gradient Accents (Indigo/Purple)
 * - Micro-Interactions everywhere
 */

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // ═══════════════════════════════════════════════════════════════
      // 🎨 COLOR SYSTEM - NDS v2.0 Palette
      // ═══════════════════════════════════════════════════════════════
      colors: {
        // Background Colors (Deep Space Theme)
        nds: {
          // Core Backgrounds - Layered depth system
          bg: {
            deep: "#0f0f11",        // Deepest black - modal overlays
            primary: "#1e1f22",     // Main app background
            secondary: "#25272a",   // Secondary panels
            tertiary: "#2b2d31",    // Tertiary surfaces
            quaternary: "#313338",  // Elevated surfaces
            elevated: "#35373c",    // Highest elevation
            surface: "rgba(30, 31, 34, 0.95)", // Glass surface
          },

          // Text Colors - Clear hierarchy
          text: {
            primary: "#ffffff",     // Primary text
            secondary: "#dbdee1",   // Secondary text
            tertiary: "#949ba4",    // Tertiary/muted text
            muted: "#6b7280",       // Very muted (placeholders)
            disabled: "#5c6370",    // Disabled state
            veryMuted: "#5e626a",   // Ultra muted
          },

          // Accent Colors - Neon vibes
          accent: {
            primary: "#6366f1",         // Indigo - Main accent
            primaryHover: "#5558eb",    // Indigo hover
            secondary: "#a855f7",       // Purple - Secondary accent
            tertiary: "#ec4899",        // Pink - Tertiary accent
          },

          // Semantic Colors
          success: "#23a559",
          successHover: "#1a8047",
          danger: "#da373c",
          dangerHover: "#c4292f",
          warning: "#faa61a",
          info: "#5865f2",

          // Status Colors
          online: "#23a559",
          offline: "#80848e",
          invisible: "#5865f2",

          // Border Colors
          border: {
            subtle: "rgba(255, 255, 255, 0.05)",
            light: "rgba(255, 255, 255, 0.10)",
            medium: "rgba(255, 255, 255, 0.20)",
            accent: "rgba(99, 102, 241, 0.30)",
            glow: "rgba(99, 102, 241, 0.50)",
          },

          // Glass Effect Colors
          glass: {
            strong: "rgba(30, 31, 34, 0.95)",
            medium: "rgba(30, 31, 34, 0.80)",
            light: "rgba(255, 255, 255, 0.05)",
            ultraLight: "rgba(255, 255, 255, 0.03)",
          },
        },
      },

      // ═══════════════════════════════════════════════════════════════
      // 📝 TYPOGRAPHY - Inter font system
      // ═══════════════════════════════════════════════════════════════
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "'Segoe UI'",
          "Roboto",
          "Oxygen",
          "Ubuntu",
          "Cantarell",
          "'Open Sans'",
          "'Helvetica Neue'",
          "sans-serif",
        ],
      },

      fontSize: {
        // NDS Typography Scale
        "nano": ["10px", { lineHeight: "1.4", fontWeight: "700" }],
        "micro": ["11px", { lineHeight: "1.4", fontWeight: "600" }],
        "caption": ["12px", { lineHeight: "1.5", fontWeight: "500" }],
        "small": ["13px", { lineHeight: "1.5", fontWeight: "500" }],
        "body": ["14px", { lineHeight: "1.6", fontWeight: "500" }],
        "h4": ["20px", { lineHeight: "1.4", fontWeight: "700" }],
        "h3": ["24px", { lineHeight: "1.3", fontWeight: "700" }],
        "h2": ["30px", { lineHeight: "1.2", fontWeight: "700" }],
        "h1": ["36px", { lineHeight: "1.2", fontWeight: "700" }],
      },

      // ═══════════════════════════════════════════════════════════════
      // 📏 SPACING - 4px Grid System
      // ═══════════════════════════════════════════════════════════════
      spacing: {
        "nds-xs": "4px",
        "nds-sm": "8px",
        "nds-md": "12px",
        "nds-lg": "16px",
        "nds-xl": "24px",
        "nds-2xl": "32px",
        "nds-3xl": "48px",
        // Layout specific
        "sidebar": "240px",
        "titlebar": "36px",
        "userpanel": "52px",
        "controls": "72px",
      },

      // ═══════════════════════════════════════════════════════════════
      // 🔘 BORDER RADIUS - Consistent rounding
      // ═══════════════════════════════════════════════════════════════
      borderRadius: {
        "nds-sm": "4px",
        "nds-md": "8px",
        "nds-lg": "12px",
        "nds-xl": "16px",
        "nds-2xl": "20px",
        "nds-3xl": "24px",
      },

      // ═══════════════════════════════════════════════════════════════
      // 💫 SHADOWS - Soft shadows & glows
      // ═══════════════════════════════════════════════════════════════
      boxShadow: {
        // Soft shadows for depth
        "nds-soft": "0 4px 20px rgba(0, 0, 0, 0.15)",
        "nds-soft-lg": "0 10px 40px rgba(0, 0, 0, 0.2)",
        "nds-elevated": "0 8px 30px rgba(0, 0, 0, 0.25)",
        "nds-deep": "0 20px 60px rgba(0, 0, 0, 0.4)",

        // Glow effects for premium feel
        "nds-glow": "0 0 20px rgba(99, 102, 241, 0.3)",
        "nds-glow-lg": "0 0 40px rgba(99, 102, 241, 0.4)",
        "nds-glow-green": "0 0 20px rgba(35, 165, 89, 0.3)",
        "nds-glow-green-lg": "0 0 30px rgba(35, 165, 89, 0.5)",
        "nds-glow-red": "0 0 20px rgba(218, 55, 60, 0.3)",
        "nds-glow-purple": "0 0 20px rgba(168, 85, 247, 0.3)",

        // Inset shadows for depth
        "nds-inset": "inset 0 2px 10px rgba(0, 0, 0, 0.2)",
        "nds-inner-glow": "inset 0 0 20px rgba(99, 102, 241, 0.1)",
      },

      // ═══════════════════════════════════════════════════════════════
      // 🎬 ANIMATIONS - Smooth micro-interactions
      // ═══════════════════════════════════════════════════════════════
      animation: {
        // Entry animations
        "nds-fade-in": "ndsFadeIn 200ms ease-out forwards",
        "nds-scale-in": "ndsScaleIn 200ms ease-out forwards",
        "nds-slide-in": "ndsSlideIn 300ms ease-out forwards",
        "nds-slide-up": "ndsSlideUp 300ms ease-out forwards",
        "nds-slide-down": "ndsSlideDown 300ms ease-out forwards",
        
        // State animations
        "nds-pulse": "ndsPulse 3s ease-in-out infinite",
        "nds-pulse-border": "ndsPulseBorder 2s ease-in-out infinite",
        "nds-spin-slow": "spin 3s linear infinite",
        "nds-bounce-subtle": "ndsBounceSubtle 2s ease-in-out infinite",

        // Speaking/Active state
        "nds-speaking": "ndsSpeakingGlow 2s ease-in-out infinite",
        "nds-speaking-ring": "ndsSpeakingRing 1.5s ease-out infinite",

        // Interactive
        "nds-ripple": "ndsRipple 600ms ease-out forwards",
        "nds-shimmer": "ndsShimmer 2s linear infinite",

        // Background decorations
        "nds-float": "ndsFloat 6s ease-in-out infinite",
        "nds-float-slow": "ndsFloat 10s ease-in-out infinite",
      },

      keyframes: {
        // Entry animations
        ndsFadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        ndsScaleIn: {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        ndsSlideIn: {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        ndsSlideUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        ndsSlideDown: {
          "0%": { transform: "translateY(-10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },

        // State animations
        ndsPulse: {
          "0%, 100%": { opacity: "0.3", transform: "scale(1)" },
          "50%": { opacity: "0.5", transform: "scale(1.05)" },
        },
        ndsPulseBorder: {
          "0%, 100%": { borderColor: "rgba(99, 102, 241, 0.4)" },
          "50%": { borderColor: "rgba(99, 102, 241, 0.8)" },
        },
        ndsBounceSubtle: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },

        // Speaking animations
        ndsSpeakingGlow: {
          "0%, 100%": { 
            boxShadow: "0 0 15px rgba(34, 197, 94, 0.3)",
            borderColor: "rgba(34, 197, 94, 0.6)",
          },
          "50%": { 
            boxShadow: "0 0 25px rgba(34, 197, 94, 0.5)",
            borderColor: "rgba(34, 197, 94, 1)",
          },
        },
        ndsSpeakingRing: {
          "0%": { transform: "scale(1)", opacity: "0.6" },
          "100%": { transform: "scale(1.5)", opacity: "0" },
        },

        // Interactive
        ndsRipple: {
          "0%": { transform: "scale(0)", opacity: "1" },
          "100%": { transform: "scale(4)", opacity: "0" },
        },
        ndsShimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },

        // Background decorations
        ndsFloat: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "33%": { transform: "translate(10px, -10px) scale(1.02)" },
          "66%": { transform: "translate(-5px, 5px) scale(0.98)" },
        },
      },

      // ═══════════════════════════════════════════════════════════════
      // ⏱️ TRANSITIONS - Timing functions
      // ═══════════════════════════════════════════════════════════════
      transitionDuration: {
        "fast": "150ms",
        "normal": "200ms",
        "medium": "300ms",
        "slow": "500ms",
      },

      transitionTimingFunction: {
        "nds-smooth": "cubic-bezier(0.4, 0, 0.2, 1)",
        "nds-bounce": "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
        "nds-ease-out": "cubic-bezier(0, 0, 0.2, 1)",
      },

      // ═══════════════════════════════════════════════════════════════
      // 🌫️ BACKDROP BLUR - Glassmorphism effects
      // ═══════════════════════════════════════════════════════════════
      backdropBlur: {
        xs: "2px",
        sm: "4px",
        md: "10px",
        lg: "16px",
        xl: "20px",
        "2xl": "30px",
        "3xl": "40px",
      },

      // ═══════════════════════════════════════════════════════════════
      // 🖼️ BACKGROUND - Gradients & patterns
      // ═══════════════════════════════════════════════════════════════
      backgroundImage: {
        // Primary gradients
        "nds-gradient-primary": "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",
        "nds-gradient-primary-hover": "linear-gradient(135deg, #5558eb 0%, #9333ea 100%)",
        "nds-gradient-secondary": "linear-gradient(135deg, #a855f7 0%, #ec4899 100%)",
        "nds-gradient-success": "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
        "nds-gradient-danger": "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
        
        // Background gradients
        "nds-gradient-bg": "linear-gradient(180deg, #0f0f11 0%, #1a1b1e 50%, #1e1f22 100%)",
        "nds-gradient-surface": "linear-gradient(135deg, rgba(37, 39, 42, 0.95) 0%, rgba(43, 45, 49, 0.95) 100%)",
        
        // Glass gradients
        "nds-gradient-glass": "linear-gradient(135deg, rgba(30, 31, 34, 0.95) 0%, rgba(37, 39, 42, 0.9) 50%, rgba(43, 45, 49, 0.95) 100%)",
        
        // Text gradients
        "nds-gradient-text": "linear-gradient(90deg, #818cf8 0%, #c084fc 50%, #f472b6 100%)",

        // Shimmer effect
        "nds-shimmer": "linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.05) 50%, transparent 100%)",
      },

      // ═══════════════════════════════════════════════════════════════
      // 📐 Z-INDEX - Layering system
      // ═══════════════════════════════════════════════════════════════
      zIndex: {
        "titlebar": "100",
        "sidebar": "50",
        "dropdown": "200",
        "modal": "300",
        "toast": "400",
        "tooltip": "500",
      },
    },
  },
  plugins: [],
};

export default config;
