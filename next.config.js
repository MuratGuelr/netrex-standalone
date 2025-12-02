/** @type {import('next').NextConfig} */
const packageJson = require("./package.json");

const nextConfig = {
  // Required for Electron (generates static html/css/js in /out)
  output: "export",

  // Disables Next.js Image Optimization API (incompatible with static export)
  images: {
    unoptimized: true,
  },

  // Optional: If you use trailing slashes in your file system routing
  trailingSlash: true,

  // Environment variables
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
  },
};

module.exports = nextConfig;
