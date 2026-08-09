import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev runs behind the Codespace port-forwarding proxy, so requests arrive from
  // *.app.github.dev rather than localhost. Harmless in production — this only
  // affects `next dev`.
  allowedDevOrigins: ["*.app.github.dev"],

  experimental: {
    // Server Actions compare `Origin` against `X-Forwarded-Host`. The Codespace
    // proxy rewrites the forwarded host to the public *.app.github.dev name
    // while the browser still sends `localhost:3000`, so every action — the
    // intake's autosave, the slug check, "Create it" — was being rejected as
    // cross-origin. Naming both origins as safe restores the CSRF check rather
    // than disabling it.
    serverActions: {
      allowedOrigins: ["localhost:3000", "*.app.github.dev"],
    },
  },

  async headers() {
    return [
      {
        // The guest app's service worker. It must never be served from the HTTP
        // cache: a stale copy would keep serving a stale app shell and holding
        // on to queued photos with old code. `updateViaCache: "none"` at
        // registration says the same thing from the other side.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
