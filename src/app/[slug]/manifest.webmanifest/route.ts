import { weddingBySlug } from "@/lib/guest";
import { weddingAppName, weddingShortName } from "@/lib/pwa";
import { guestTheme } from "@/lib/theme";

/**
 * GET /<slug>/manifest.webmanifest — one installable app per wedding.
 *
 * Next's `app/manifest.ts` convention only serves the root of the app, and a
 * single shared manifest is exactly wrong here: the whole point is that the
 * thing on the guest's home screen is called "Amara & Cole", not "Ribbet".
 * So this is a route handler under the same dynamic segment the app itself
 * lives in, themed from the couple's own row.
 *
 * `scope` and `start_url` are both the wedding's own path, which keeps one
 * couple's installed app from ever claiming another couple's pages — and keeps
 * /admin outside it, so the console always opens in a real browser.
 */
export async function GET(_request: Request, ctx: RouteContext<"/[slug]/manifest.webmanifest">) {
  const { slug } = await ctx.params;

  const wedding = await weddingBySlug(slug);
  if (!wedding) return new Response("Not found", { status: 404 });

  const theme = guestTheme(wedding);
  const name = weddingAppName(wedding);
  const base = `/${slug}`;

  const manifest = {
    id: base,
    name,
    short_name: weddingShortName(wedding, slug),
    description: wedding.venue ? `${name} — ${wedding.venue}` : name,
    start_url: base,
    scope: base,
    display: "standalone",
    orientation: "portrait",
    // The splash screen is the app's own background; the accent is what tints
    // the status bar, which is the couple's colour showing up in the OS.
    background_color: theme.bg,
    theme_color: theme.accent,
    icons: [192, 512].map((size) => ({
      src: `${base}/app-icon/${size}`,
      sizes: `${size}x${size}`,
      type: "image/png",
      // Full-bleed accent behind a centred monogram, so an Android mask can
      // crop it to any shape without clipping the letters.
      purpose: "any maskable",
    })),
  };

  return Response.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
