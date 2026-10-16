import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Data is read from ./data at build time; nothing in it contains local paths or hidden values.
  outputFileTracingIncludes: { "/*": ["./data/**/*"] },
};

export default nextConfig;
