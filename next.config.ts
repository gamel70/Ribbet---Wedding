import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev runs behind the Codespace port-forwarding proxy, so requests arrive from
  // *.app.github.dev rather than localhost. Harmless in production — this only
  // affects `next dev`.
  allowedDevOrigins: ["*.app.github.dev"],
};

export default nextConfig;
