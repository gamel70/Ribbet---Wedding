import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { photos } from "@/db/schema";
import { driveFor } from "@/lib/google";
import { currentHousehold, weddingBySlug } from "@/lib/guest";

/**
 * GET /api/vault/<slug>/thumb/<photoId>
 *
 * A thumbnail for one of *your own* uploads. The household check is the whole
 * point: screen 04 promises guests never see each other's photos, and this is
 * where that promise is kept — there is no endpoint anywhere that lists or
 * serves another household's files.
 *
 * Originals are never served here. Drive keeps the full-resolution file; this
 * hands back Drive's own small thumbnail.
 */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/vault/[slug]/thumb/[photoId]">,
) {
  const { slug, photoId } = await ctx.params;

  const wedding = await weddingBySlug(slug);
  if (!wedding) return new Response("Not found", { status: 404 });

  const household = await currentHousehold(wedding.id);
  if (!household) return new Response("Forbidden", { status: 403 });

  const [photo] = await db
    .select()
    .from(photos)
    .where(and(eq(photos.id, photoId), eq(photos.householdId, household.id)))
    .limit(1);

  if (!photo) return new Response("Not found", { status: 404 });

  try {
    const drive = await driveFor(wedding.ownerGoogleSub);
    const file = await drive.files.get({ fileId: photo.driveFileId, fields: "thumbnailLink" });

    const link = file.data.thumbnailLink;
    if (!link) return new Response("No thumbnail", { status: 404 });

    const upstream = await fetch(link.replace(/=s\d+$/, "=s400"));
    if (!upstream.ok || !upstream.body) return new Response("No thumbnail", { status: 404 });

    return new Response(upstream.body, {
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
        // Private: this is one household's photo, never a shared cache entry.
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new Response("No thumbnail", { status: 404 });
  }
}
