import type { NextRequest } from "next/server";

import { currentHousehold, weddingBySlug } from "@/lib/guest";
import { recordPhoto } from "@/lib/vault";

/**
 * POST /api/vault/<slug>/complete
 *
 * The phone reports the fileId once Drive has the bytes, and we write the
 * attribution row — wedding, household, fileId, takenAt — so "who sent this"
 * never needs a Drive read.
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/vault/[slug]/complete">) {
  const { slug } = await ctx.params;

  const wedding = await weddingBySlug(slug);
  if (!wedding) return Response.json({ error: "Unknown wedding" }, { status: 404 });

  const household = await currentHousehold(wedding.id);
  if (!household) return Response.json({ error: "No upload session" }, { status: 403 });

  let body: { fileId?: string; takenAt?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }

  const fileId = (body.fileId ?? "").trim();
  if (!fileId) return Response.json({ error: "Bad request" }, { status: 400 });

  const takenAt = body.takenAt ? new Date(body.takenAt) : null;

  await recordPhoto({
    wedding,
    householdId: household.id,
    driveFileId: fileId,
    takenAt: takenAt && !Number.isNaN(takenAt.getTime()) ? takenAt : null,
  });

  return Response.json({ ok: true });
}
