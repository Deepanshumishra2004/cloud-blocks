import type { NextConfig } from "next";

const backendUrl = process.env.BACKEND_URL ?? "http://api.127.0.0.1.sslip.io";

const nextConfig: NextConfig = {
  // Proxy API through the Next origin so auth cookies are set on localhost:3000
  // (same site as the SPA). Without this, HttpOnly cookies from :3001 are not
  // visible to Next middleware and may be blocked on cross-origin XHR.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
