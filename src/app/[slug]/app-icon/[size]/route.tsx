import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { weddingBySlug } from "@/lib/guest";
import {
  ICON_SIZES,
  type IconPurpose,
  iconInscription,
  inscriptionBox,
  lineFontSize,
  ringRadius,
  scriptWidthEm,
  stackedFontSize,
} from "@/lib/pwa";
import { guestTheme } from "@/lib/theme";

/**
 * GET /<slug>/app-icon/<size>[?purpose=maskable] — the couple's names, engraved.
 *
 * An installed app needs a real raster icon, and iOS won't take an SVG for a
 * home screen, so this is generated per wedding: their two first names in a
 * script face inside a thin double rule, on their own accent. It should read as
 * an invitation on the home screen, not as another rounded-square tech app.
 *
 * The names are measured, not guessed — see `scriptWidthEm` — so the type is
 * sized to the ring rather than the ring hoping to clear the type. Names too
 * long to stay legible at 180px become script initials instead.
 */

/** Read once per process; it's the same 40KB for every wedding. */
let scriptFont: Promise<Buffer> | null = null;

function greatVibes(): Promise<Buffer> {
  // next.config.ts force-includes assets/ in this route's trace — nothing
  // imports the file, so the bundler can't find it on its own.
  scriptFont ??= readFile(join(process.cwd(), "assets", "GreatVibes-Latin.ttf"));
  return scriptFont;
}

export async function GET(request: Request, ctx: RouteContext<"/[slug]/app-icon/[size]">) {
  const { slug, size: sizeParam } = await ctx.params;

  const size = Number(sizeParam);
  if (!(ICON_SIZES as readonly number[]).includes(size)) {
    return new Response("Not found", { status: 404 });
  }

  const purpose: IconPurpose =
    new URL(request.url).searchParams.get("purpose") === "maskable" ? "maskable" : "any";

  const wedding = await weddingBySlug(slug);
  if (!wedding) return new Response("Not found", { status: 404 });

  const theme = guestTheme(wedding);
  const inscription = iconInscription(wedding, slug);
  const box = inscriptionBox(size, purpose);
  const radius = ringRadius(size, purpose);

  const ink = theme.accentInk;
  const rule = Math.max(1, Math.round(size * 0.0115));
  const hairline = Math.max(1, Math.round(size * 0.005));

  const fontSize =
    inscription.kind === "stacked"
      ? stackedFontSize(
          size,
          purpose,
          Math.max(scriptWidthEm(inscription.first), scriptWidthEm(inscription.second)),
        )
      : lineFontSize(size, purpose, scriptWidthEm(inscription.text));

  // Built as an explicit list rather than a fragment: satori flattens fragment
  // children into the parent's own flex row, which silently lays the stack out
  // side by side and off the edge of the icon.
  const rows: Array<{ text: string; size: number; lineHeight: number; opacity?: number }> =
    inscription.kind === "stacked"
      ? [
          { text: inscription.first, size: fontSize, lineHeight: 1 },
          { text: "&", size: fontSize * 0.52, lineHeight: 0.9, opacity: 0.75 },
          { text: inscription.second, size: fontSize, lineHeight: 1 },
        ]
      : [{ text: inscription.text, size: fontSize, lineHeight: 1 }];

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
          color: ink,
          fontFamily: "Great Vibes",
        }}
      >
        {/* Two concentric rules — the engraved-invitation border, not a frame. */}
        <div
          style={{
            position: "absolute",
            width: radius * 2,
            height: radius * 2,
            borderRadius: radius,
            border: `${rule}px solid ${ink}`,
            opacity: 0.55,
          }}
        />
        <div
          style={{
            position: "absolute",
            width: radius * 1.87,
            height: radius * 1.87,
            borderRadius: radius,
            border: `${hairline}px solid ${ink}`,
            opacity: 0.3,
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: box.width,
            height: box.height,
          }}
        >
          {rows.map((row, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                fontSize: row.size,
                lineHeight: row.lineHeight,
                opacity: row.opacity ?? 1,
              }}
            >
              {row.text}
            </div>
          ))}
        </div>
      </div>
    ),
    {
      width: size,
      height: size,
      fonts: [{ name: "Great Vibes", data: await greatVibes(), weight: 400, style: "normal" }],
      headers: {
        // The couple can change their accent, or their names, in the console.
        // Short enough to follow them within the hour, long enough that a home
        // screen isn't re-rendering this on every launch.
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    },
  );
}
