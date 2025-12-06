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

  // Optional: If you use trailing slashes in your file system routing
  trailingSlash: true,

  // Electron için asset prefix'i göreceli yap
  assetPrefix: process.env.NODE_ENV === 'production' ? './' : undefined,

  // Environment variables - build sırasında bake edilir
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
    // LiveKit URL'ini .env.local'dan oku ve build'e göm
    NEXT_PUBLIC_LIVEKIT_URL: process.env.NEXT_PUBLIC_LIVEKIT_URL,
  },
};

module.exports = nextConfig;

