import { and, eq, ne } from "drizzle-orm";
import { getServerSession } from "next-auth";

import { db } from "@/db";
import { reservedSlugs, weddings } from "@/db/schema";
import { authOptions } from "@/lib/auth";
import { DEFAULT_SECTIONS } from "@/lib/design";
import { autoSlug, cleanSlug, MIN_SLUG_LENGTH, RESERVED_SLUGS } from "@/lib/slug";

export type WeddingRow = typeof weddings.$inferSelect;

/**
 * The single gate the intake's server-side step lock rests on. Every server
 * action calls this first; step 2 onward is unreachable without it, which is
 * what "enforce this server-side too" in the intake spec asks for.
 */
export async function requireGoogleSub(): Promise<string> {
  const session = await getServerSession(authOptions);
  const sub = session?.user?.googleSub;
  if (!sub) throw new Error("Not signed in");
  return sub;
}

/** The couple's wedding row, or null if they haven't saved anything yet. */
export async function findWedding(googleSub: string): Promise<WeddingRow | null> {
  const [row] = await db
    .select()
    .from(weddings)
    .where(eq(weddings.ownerGoogleSub, googleSub))
    .limit(1);
  return row ?? null;
}

/**
 * Finds the couple's wedding or creates an empty one. Called on the first save
 * after Google sign-in, so a refresh mid-intake resumes rather than restarts.
 */
export async function findOrCreateWedding(
  googleSub: string,
  seed: { nameOne?: string | null; nameTwo?: string | null } = {},
): Promise<WeddingRow> {
  const existing = await findWedding(googleSub);
  if (existing) return existing;

  // Empty names are normal here — the row is created by the first autosave,
  // which can land before the couple has typed anything. The placeholder is
  // replaced by the derived slug as soon as they do.
  const desired = autoSlug(seed.nameOne?.trim() || "our", seed.nameTwo?.trim() || "wedding");
  const slug = await claimFreeSlug(desired);

  const [created] = await db
    .insert(weddings)
    .values({
      slug,
      ownerGoogleSub: googleSub,
      nameOne: seed.nameOne ?? null,
      nameTwo: seed.nameTwo ?? null,
      sections: DEFAULT_SECTIONS,
      layout: "botanical",
      palette: "brass",
    })
    .returning();

  return created;
}

/**
 * Finds a free slug near `desired` by appending -2, -3, … This only runs for the
 * placeholder assigned at row creation; the couple's own choice is checked and
 * reported back to them rather than silently renamed.
 */
async function claimFreeSlug(desired: string): Promise<string> {
  const base = cleanSlug(desired) || "our-wedding";
  for (let n = 1; n < 50; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    if (await slugIsFree(candidate, null)) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

async function slugIsFree(slug: string, exceptWeddingId: string | null): Promise<boolean> {
  if (RESERVED_SLUGS.has(slug)) return false;

  const [reserved] = await db
    .select({ slug: reservedSlugs.slug })
    .from(reservedSlugs)
    .where(eq(reservedSlugs.slug, slug))
    .limit(1);
  if (reserved) return false;

  const [taken] = await db
    .select({ id: weddings.id })
    .from(weddings)
    .where(
      exceptWeddingId
        ? and(eq(weddings.slug, slug), ne(weddings.id, exceptWeddingId))
        : eq(weddings.slug, slug),
    )
    .limit(1);

  return !taken;
}

export type SlugVerdict = {
  slug: string;
  ok: boolean;
  reason: "ok" | "short" | "taken";
};

/**
 * Reserved list plus a real uniqueness check, as the interaction notes require.
 * `exceptWeddingId` keeps a couple's own slug from reading as taken by them.
 */
export async function checkSlug(raw: string, exceptWeddingId: string | null): Promise<SlugVerdict> {
  const slug = cleanSlug(raw) || "our-wedding";

  if (slug.length < MIN_SLUG_LENGTH) return { slug, ok: false, reason: "short" };
  if (!(await slugIsFree(slug, exceptWeddingId))) return { slug, ok: false, reason: "taken" };

  return { slug, ok: true, reason: "ok" };
}
