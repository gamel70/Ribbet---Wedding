"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { LOCKED_SECTIONS, SECTION_KEYS, weddings } from "@/db/schema";
import type { Layout, Palette, SectionKey, Sections } from "@/db/schema";
import { parseDateText } from "@/lib/dates";
import { LAYOUTS, PALETTES, resolveSections } from "@/lib/design";
import { provisionWedding, type ProvisionResult } from "@/lib/provision";
import { cleanDomain } from "@/lib/slug";
import { checkSlug, findOrCreateWedding, findWedding, requireGoogleSub } from "@/lib/wedding";

/**
 * Every action here starts with `requireGoogleSub()`. That is the server-side
 * half of "steps 2-5 are unreachable until Google sign-in succeeds" — the step
 * rail dims them in the UI, but nothing is writable without a session, and
 * Server Actions are reachable by direct POST.
 */

export type IntakePatch = {
  step?: number;
  nameOne?: string;
  nameTwo?: string;
  dateText?: string;
  venue?: string;
  guestCount?: string;
  slug?: string;
  domainMode?: "own" | "free";
  domain?: string;
  layout?: Layout;
  palette?: Palette;
  /** null clears the override and falls back to the palette's own accent. */
  accent?: string | null;
  sections?: Partial<Sections>;
};

export type SaveResult = {
  /** The slug now on the row — may differ from what was asked for. */
  slug: string;
  /** False when the requested slug was short or taken, so the row kept its old one. */
  slugAccepted: boolean;
};

function isLayout(value: unknown): value is Layout {
  return typeof value === "string" && value in LAYOUTS;
}

function isPalette(value: unknown): value is Palette {
  return typeof value === "string" && PALETTES.some((p) => p.key === value);
}

/** Only #rrggbb survives; anything else clears the override. */
function normalizeAccent(value: string | null | undefined): string | null {
  if (!value) return null;
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : null;
}

/**
 * The locked sections are forced on here, not just in the UI — the data model
 * sketch calls for exactly that.
 */
function normalizeSections(input: Partial<Sections> | undefined, current: Partial<Sections>): Sections {
  const merged: Partial<Sections> = { ...resolveSections(current) };
  for (const key of SECTION_KEYS) {
    const value = input?.[key as SectionKey];
    if (typeof value === "boolean") merged[key as SectionKey] = value;
  }
  for (const key of LOCKED_SECTIONS) merged[key] = true;
  return merged as Sections;
}

/**
 * Saves one step's worth of intake. Called on every change (debounced client
 * side) so closing the tab halfway and reopening /setup resumes where it left off.
 */
export async function saveIntake(patch: IntakePatch): Promise<SaveResult> {
  const googleSub = await requireGoogleSub();
  const wedding = await findOrCreateWedding(googleSub, {
    nameOne: patch.nameOne,
    nameTwo: patch.nameTwo,
  });

  const updates: Partial<typeof weddings.$inferInsert> = { updatedAt: new Date() };

  if (patch.nameOne !== undefined) updates.nameOne = patch.nameOne.slice(0, 120);
  if (patch.nameTwo !== undefined) updates.nameTwo = patch.nameTwo.slice(0, 120);
  if (patch.venue !== undefined) updates.venue = patch.venue.slice(0, 240);
  if (patch.dateText !== undefined) updates.date = parseDateText(patch.dateText);

  if (patch.guestCount !== undefined) {
    const n = parseInt(patch.guestCount.replace(/[^0-9]/g, ""), 10);
    updates.guestEstimate = Number.isFinite(n) ? Math.min(n, 5000) : null;
  }

  if (isLayout(patch.layout)) updates.layout = patch.layout;
  if (isPalette(patch.palette)) updates.palette = patch.palette;
  if (patch.accent !== undefined) updates.accent = normalizeAccent(patch.accent);
  if (patch.sections !== undefined) updates.sections = normalizeSections(patch.sections, wedding.sections);

  if (patch.step !== undefined) {
    updates.intakeStep = Math.min(5, Math.max(1, Math.round(patch.step)));
  }

  // The domain mode is carried by customDomain itself: a value means "their own
  // domain", null means the free ribbet.app address.
  if (patch.domainMode === "free") {
    updates.customDomain = null;
  } else if (patch.domainMode === "own" || patch.domain !== undefined) {
    const bare = cleanDomain(patch.domain ?? "");
    updates.customDomain = bare ? `${bare}.com` : null;
  }

  // The slug is the one field that can be refused: it has to be unique.
  let slug = wedding.slug;
  let slugAccepted = true;
  if (patch.slug !== undefined) {
    const verdict = await checkSlug(patch.slug, wedding.id);
    if (verdict.ok) {
      slug = verdict.slug;
      updates.slug = verdict.slug;
    } else {
      slugAccepted = false;
    }
  }

  await db.update(weddings).set(updates).where(eq(weddings.id, wedding.id));

  return { slug, slugAccepted };
}

export type SlugCheckResult = {
  slug: string;
  ok: boolean;
  reason: "ok" | "short" | "taken";
};

/**
 * Live availability for the address picker. Debounced to 300ms client side, per
 * the interaction notes; the reserved list and a real uniqueness check both run.
 */
export async function checkSlugAvailability(raw: string): Promise<SlugCheckResult> {
  const googleSub = await requireGoogleSub();
  const wedding = await findWedding(googleSub);
  return checkSlug(raw, wedding?.id ?? null);
}

export type BuildResult =
  | { ok: true; result: ProvisionResult; slug: string; publicUrl: string }
  | { ok: false; error: string };

/**
 * "Create it" — the real thing. Creates the Drive folder, creates the
 * spreadsheet with its tabs, formats and protects it, files it into the folder,
 * then commits the ids to the wedding row.
 */
export async function buildWedding(): Promise<BuildResult> {
  const googleSub = await requireGoogleSub();
  const wedding = await findWedding(googleSub);
  if (!wedding) return { ok: false, error: "Nothing saved yet — fill in the details first." };

  try {
    const result = await provisionWedding(wedding.id);

    revalidatePath("/setup");
    revalidatePath(`/${wedding.slug}`);

    return {
      ok: true,
      result,
      slug: wedding.slug,
      publicUrl: wedding.customDomain ?? `ribbet.app/${wedding.slug}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
}
