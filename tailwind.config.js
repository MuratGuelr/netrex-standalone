/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Custom dark theme colors matching the Discord-like aesthetic
        gray: {
          900: "#1e1e1e", // Main background
          800: "#252526", // Secondary background
          700: "#333333", // Hover states
          600: "#3e3e42", // Borders
        },
        // Modern accent colors
        accent: {
          primary: "#5865f2",
          secondary: "#4752c4",
          success: "#23a559",
          danger: "#da373c",
          warning: "#faa61a",
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'shimmer': 'shimmer 2s infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glow': '0 0 20px rgba(99, 102, 241, 0.3)',
        'glow-green': '0 0 20px rgba(35, 165, 89, 0.3)',
        'glow-red': '0 0 20px rgba(218, 55, 60, 0.3)',
        'soft': '0 4px 20px rgba(0, 0, 0, 0.15)',
        'soft-lg': '0 10px 40px rgba(0, 0, 0, 0.2)',
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
};
