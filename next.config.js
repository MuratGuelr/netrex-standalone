/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for Electron (generates static html/css/js in /out)
  output: "export",

  // Disables Next.js Image Optimization API (incompatible with static export)
  images: {
    unoptimized: true,
  },

  // Optional: If you use trailing slashes in your file system routing
  trailingSlash: true,
};

module.exports = nextConfig;
