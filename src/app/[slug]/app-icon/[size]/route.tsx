import { ImageResponse } from "next/og";

import { weddingBySlug } from "@/lib/guest";
import { ICON_SIZES, weddingMonogram } from "@/lib/pwa";
import { guestTheme } from "@/lib/theme";

/**
 * GET /<slug>/app-icon/<size> — the couple's monogram, rendered as a PNG.
 *
 * An installed app needs a real raster icon: iOS won't take an SVG for a home
 * screen, so this is generated rather than shipped, once per wedding, from the
 * same accent the rest of the app is themed with.
 *
 * The glyph sits well inside the square so the icon can be declared
 * `any maskable` — Android crops a circle out of it and only ever eats accent.
 *
 * Type is `ImageResponse`'s bundled face, not the couple's display serif. The
 * three serifs are loaded through `next/font`, which doesn't hand back raw font
 * data, and fetching a TTF per icon request isn't worth a two-letter monogram.
 */
export async function GET(_request: Request, ctx: RouteContext<"/[slug]/app-icon/[size]">) {
  const { slug, size: sizeParam } = await ctx.params;

  const size = Number(sizeParam);
  if (!(ICON_SIZES as readonly number[]).includes(size)) {
    return new Response("Not found", { status: 404 });
  }

  const wedding = await weddingBySlug(slug);
  if (!wedding) return new Response("Not found", { status: 404 });

  const theme = guestTheme(wedding);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: theme.accent,
          color: theme.accentInk,
          fontSize: Math.round(size * 0.38),
          letterSpacing: Math.round(size * 0.015),
        }}
      >
        {weddingMonogram(wedding, slug)}
      </div>
    ),
    {
      width: size,
      height: size,
      headers: {
        // The couple can change their accent in the console, so this is short
        // enough to follow them within the hour and long enough that a home
        // screen isn't re-rendering it on every launch.
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    },
  );
}
