import { eq } from "drizzle-orm";

import { db } from "@/db";
import { photos } from "@/db/schema";
import { driveFor, googleClientForGoogleSub } from "@/lib/google";
import type { WeddingRow } from "@/lib/wedding";

/**
 * The photo vault, per "Where the photos live" in README.md.
 *
 * The guest's phone uploads *directly to Drive* — the server only mints a
 * resumable session URI scoped to one file. Bytes never pass through here, so
 * serverless body limits don't apply and a 40MB burst off a rooftop costs
 * nothing in bandwidth.
 *
 * Quality is non-negotiable: nothing in this path resizes, re-encodes, or strips
 * metadata. The file the picker hands the browser is the file that lands in
 * Drive, byte for byte. Do not add a canvas, a resize library, or an image CDN
 * anywhere on the way in.
 */

/** "Before the day" / "October 10" / "After", per the folder sketch. */
export function datedSubfolderName(weddingDate: Date | null, now: Date): string {
  if (!weddingDate) return "Before the day";

  const dayKey = (d: Date) => Math.floor(d.getTime() / 86_400_000);
  const weddingDay = dayKey(weddingDate);
  const today = dayKey(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));

  if (today < weddingDay) return "Before the day";
  if (today > weddingDay) return "After";
  return weddingDate.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
}

/** Find-or-create a subfolder of the vault. drive.file sees only what it made. */
export async function ensureSubfolder(
  googleSub: string,
  parentId: string,
  name: string,
): Promise<string> {
  const drive = await driveFor(googleSub);

  const escaped = name.replace(/'/g, "\\'");
  const found = await drive.files.list({
    q: `'${parentId}' in parents and name = '${escaped}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id)",
    pageSize: 1,
  });

  const existing = found.data.files?.[0]?.id;
  if (existing) return existing;

  const created = await drive.files.create({
    requestBody: { name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] },
    fields: "id",
  });

  return created.data.id!;
}

export type QuotaVerdict = { ok: true; freeBytes: number } | { ok: false; freeBytes: number };

/**
 * Checked before a slot is minted. An upload must never fail silently because
 * the couple's Drive is full — that is the worst bug this product can have.
 */
export async function checkQuota(googleSub: string, needBytes: number): Promise<QuotaVerdict> {
  const drive = await driveFor(googleSub);
  const about = await drive.about.get({ fields: "storageQuota" });

  const limit = Number(about.data.storageQuota?.limit ?? 0);
  const usage = Number(about.data.storageQuota?.usage ?? 0);

  // An unlimited/pooled account reports no limit — nothing to enforce.
  if (!limit) return { ok: true, freeBytes: Number.MAX_SAFE_INTEGER };

  const free = limit - usage;
  return free > needBytes ? { ok: true, freeBytes: free } : { ok: false, freeBytes: free };
}

/**
 * Mints a resumable upload session for exactly one file and returns the URI the
 * phone PUTs to. Google's session URIs are CORS-enabled, which is what lets the
 * browser talk to Drive directly.
 */
export async function createUploadSession(input: {
  googleSub: string;
  parentId: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<string> {
  const client = await googleClientForGoogleSub(input.googleSub);
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("Could not mint an access token for the vault");

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": input.mimeType,
        "X-Upload-Content-Length": String(input.sizeBytes),
      },
      body: JSON.stringify({ name: input.name, parents: [input.parentId] }),
    },
  );

  if (!response.ok) {
    throw new Error(`Drive refused the upload slot (${response.status}): ${await response.text()}`);
  }

  const location = response.headers.get("location");
  if (!location) throw new Error("Drive did not return an upload session URI");

  return location;
}

/** Records who sent what, so "who sent this" never needs a Drive read. */
export async function recordPhoto(input: {
  wedding: WeddingRow;
  householdId: string;
  driveFileId: string;
  takenAt: Date | null;
}): Promise<void> {
  await db
    .insert(photos)
    .values({
      weddingId: input.wedding.id,
      householdId: input.householdId,
      driveFileId: input.driveFileId,
      takenAt: input.takenAt,
    })
    .onConflictDoNothing({ target: photos.driveFileId });
}

export async function householdPhotos(householdId: string) {
  return db.select().from(photos).where(eq(photos.householdId, householdId));
}
