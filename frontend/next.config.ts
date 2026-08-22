import type { NextConfig } from "next";
import path from "path";

const backendUrl = process.env.API_URL || "http://localhost:4001";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  /** Avoid corrupted webpack cache when .next is cleared while dev is running */
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false;
    }
    return config;
  },
  async rewrites() {
    return [
      {
        source: "/health",
        destination: `${backendUrl}/health`,
      },
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
