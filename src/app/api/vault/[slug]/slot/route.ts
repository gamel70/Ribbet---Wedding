import type { NextRequest } from "next/server";

import { resolveSections } from "@/lib/design";
import { ensureHousehold, weddingBySlug } from "@/lib/guest";
import { checkQuota, createUploadSession, datedSubfolderName, ensureSubfolder } from "@/lib/vault";

/**
 * POST /api/vault/<slug>/slot
 *
 * Mints a one-file resumable upload session in the couple's vault and hands the
 * URI back to the phone, which then PUTs the bytes straight to Google. The file
 * never touches this server, and nothing here inspects or re-encodes it.
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/vault/[slug]/slot">) {
  const { slug } = await ctx.params;

  const wedding = await weddingBySlug(slug);
  if (!wedding) return Response.json({ error: "Unknown wedding" }, { status: 404 });

  if (!resolveSections(wedding.sections).photos) {
    return Response.json({ error: "Photos aren't switched on for this wedding" }, { status: 403 });
  }
  if (!wedding.driveFolderId) {
    return Response.json({ error: "The photo vault hasn't been created yet" }, { status: 409 });
  }

  let body: { name?: string; mimeType?: string; sizeBytes?: number };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  const mimeType = (body.mimeType ?? "application/octet-stream").trim();
  const sizeBytes = Number(body.sizeBytes ?? 0);

  if (!name || !Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }

  try {
    // Never mint a slot the couple's Drive can't hold — an upload failing
    // quietly during the reception is the worst outcome there is.
    const quota = await checkQuota(wedding.ownerGoogleSub, sizeBytes);
    if (!quota.ok) {
      return Response.json(
        {
          error: "full",
          message:
            "The couple's Drive is full, so your photo is queued rather than lost. They've been told — try again shortly.",
        },
        { status: 507 },
      );
    }

    const household = await ensureHousehold(wedding.id, "Guest");

    const subfolder = await ensureSubfolder(
      wedding.ownerGoogleSub,
      wedding.driveFolderId,
      datedSubfolderName(wedding.date, new Date()),
    );

    const uploadUrl = await createUploadSession({
      googleSub: wedding.ownerGoogleSub,
      parentId: subfolder,
      name,
      mimeType,
      sizeBytes,
    });

    return Response.json({ uploadUrl, householdId: household.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: "slot_failed", message }, { status: 502 });
  }
}
