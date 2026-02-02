/** @type {import('next').NextConfig} */
const packageJson = require("./package.json");

// Build sırasında .env.local'dan değişkenleri oku
require("dotenv").config({ path: ".env.local" });

const nextConfig = {
  // Required for Electron (generates static html/css/js in /out)
  output: "export",

  // Disables Next.js Image Optimization API (incompatible with static export)
  images: {
    unoptimized: true,
  },

  // Electron için trailing slash kapalı olmalı (dizin yapısı yerine dosya yapısı)
  trailingSlash: false,

  // Electron için asset prefix'i göreceli yap
  assetPrefix: process.env.NODE_ENV === 'production' ? './' : undefined,

  // 🚀 v5.3 PRODUCTION OPTİMİZASYONU:
  // Console.log'ları production'da kaldır (CPU ve memory tasarrufu)
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'], // Sadece error ve warn'ları tut
    } : false,
  },

  // React Strict Mode production'da kapalı (double render yok)
  reactStrictMode: false,
  
  // SWC minifier (daha hızlı ve küçük bundle)
  swcMinify: true,

  // Environment variables - build sırasında bake edilir
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
    // LiveKit URL'ini .env.local'dan oku ve build'e göm
    NEXT_PUBLIC_LIVEKIT_URL: process.env.NEXT_PUBLIC_LIVEKIT_URL,
  },
};

module.exports = nextConfig;

