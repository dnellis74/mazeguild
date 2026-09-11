import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow phone / LAN access to hit the Next.js HMR websocket during `next dev`.
  // Harmless if missing (only breaks hot-reload); not used in production.
  allowedDevOrigins: ["192.168.1.227", "127.0.0.1", "localhost"],
  async redirects() {
    return [
      {
        source: "/training.html",
        destination: "/training",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
