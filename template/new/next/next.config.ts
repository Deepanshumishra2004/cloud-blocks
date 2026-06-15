import type { NextConfig } from "next";

// PREVIEW_HOST is injected by the execution-layer run command (see appRuntime.ts).
// Next 15+/16 block cross-origin dev requests (HMR, dev scripts, server actions)
// unless the request origin is allow-listed here. Without this the preview iframe
// renders blank because the dev runtime rejects the proxied preview host.
const previewHost = process.env.PREVIEW_HOST;

const nextConfig: NextConfig = {
  allowedDevOrigins: previewHost ? [previewHost] : [],
};

export default nextConfig;
