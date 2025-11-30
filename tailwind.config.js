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
      },
    },
  },
  plugins: [],
};
