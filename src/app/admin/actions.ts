"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { LOCKED_SECTIONS, SECTION_KEYS, guestRequests, guests, households, weddings } from "@/db/schema";
import type { Layout, Palette, ScheduleEntry, SectionKey, SectionMetaMap, Sections } from "@/db/schema";
import { parseDateText } from "@/lib/dates";
import { LAYOUTS, PALETTES, resolveSections } from "@/lib/design";
import { logRsvpEvent, newInviteToken } from "@/lib/guest";
import { minutesOf } from "@/lib/schedule";
import { findWedding, requireGoogleSub } from "@/lib/wedding";

/**
 * Couple console writes.
 *
 * Every action re-derives the wedding from the signed-in Google account rather
 * than trusting an id from the client, so the only wedding a session can ever
 * edit is the one it owns. Server Actions are reachable by direct POST, so this
 * is the boundary that matters — not the fact that the console is behind a link
 * guests don't see.
 */

async function requireOwnedWedding() {
  const googleSub = await requireGoogleSub();
  const wedding = await findWedding(googleSub);
  if (!wedding) throw new Error("This Google account doesn't own a wedding yet");
  return wedding;
}

/** Guest pages are server-rendered per request, so this is belt and braces. */
function goLive(slug: string) {
  revalidatePath(`/${slug}`, "layout");
  revalidatePath("/admin");
}

export type SaveResult = { ok: true } | { ok: false; error: string };

export type DetailsInput = {
  nameOne: string;
  nameTwo: string;
  dateText: string;
  venue: string;
  guestEstimate: string;
};

export async function saveDetails(input: DetailsInput): Promise<SaveResult> {
  const wedding = await requireOwnedWedding();

  const guests = parseInt(input.guestEstimate.replace(/[^0-9]/g, ""), 10);

  await db
    .update(weddings)
    .set({
      nameOne: input.nameOne.trim().slice(0, 120) || null,
      nameTwo: input.nameTwo.trim().slice(0, 120) || null,
      date: parseDateText(input.dateText),
      venue: input.venue.trim().slice(0, 240) || null,
      guestEstimate: Number.isFinite(guests) ? Math.min(guests, 5000) : null,
      updatedAt: new Date(),
    })
    .where(eq(weddings.id, wedding.id));

  goLive(wedding.slug);
  return { ok: true };
}

export async function saveSchedule(entries: ScheduleEntry[]): Promise<SaveResult> {
  const wedding = await requireOwnedWedding();

  const cleaned = entries
    .map((e) => ({
      time: String(e.time).trim(),
      title: String(e.title).trim().slice(0, 120),
      detail: String(e.detail).trim().slice(0, 200),
    }))
    .filter((e) => e.title && /^\d{1,2}:\d{2}$/.test(e.time))
    .sort((a, b) => minutesOf(a.time) - minutesOf(b.time))
    .slice(0, 30);

  await db
    .update(weddings)
    .set({ schedule: cleaned, updatedAt: new Date() })
    .where(eq(weddings.id, wedding.id));

  goLive(wedding.slug);
  return { ok: true };
}

export type SectionsInput = {
  on: Partial<Sections>;
  meta: SectionMetaMap;
};

export async function saveSections(input: SectionsInput): Promise<SaveResult> {
  const wedding = await requireOwnedWedding();

  const on = resolveSections(wedding.sections);
  for (const key of SECTION_KEYS) {
    const value = input.on[key as SectionKey];
    if (typeof value === "boolean") on[key as SectionKey] = value;
  }
  // Home, RSVP and The Day are the app; the console can rename and reorder them
  // but it cannot switch them off.
  for (const key of LOCKED_SECTIONS) on[key] = true;

  const meta: SectionMetaMap = {};
  for (const key of SECTION_KEYS) {
    const entry = input.meta[key as SectionKey];
    if (!entry) continue;
    const label = entry.label?.trim().slice(0, 40);
    const order = typeof entry.order === "number" ? Math.round(entry.order) : undefined;
    if (label || order !== undefined) {
      meta[key as SectionKey] = { ...(label ? { label } : {}), ...(order !== undefined ? { order } : {}) };
    }
  }

  await db
    .update(weddings)
    .set({ sections: on, sectionMeta: meta, updatedAt: new Date() })
    .where(eq(weddings.id, wedding.id));

  goLive(wedding.slug);
  return { ok: true };
}

// ------------------------------------------------------ guest list ---------

/**
 * Creates a household and its people, and mints the invite link the couple
 * texts. This — and approving a request — are the only ways a household comes
 * into existence; guests can claim one but never invent one.
 */
export async function addHousehold(label: string, names: string[]): Promise<SaveResult> {
  const wedding = await requireOwnedWedding();

  const people = names.map((n) => n.trim()).filter(Boolean).slice(0, 12);
  const cleanLabel = label.trim().slice(0, 120) || people[0];

  if (!cleanLabel) return { ok: false, error: "Give the household a name." };
  if (!people.length) return { ok: false, error: "Add at least one person." };

  const [household] = await db
    .insert(households)
    .values({ weddingId: wedding.id, label: cleanLabel, inviteToken: newInviteToken() })
    .returning();

  await db.insert(guests).values(people.map((name) => ({ householdId: household.id, name })));

  await logRsvpEvent(wedding.id, household.id, "added", `${cleanLabel} added to the guest list`);
  goLive(wedding.slug);
  return { ok: true };
}

export async function removeHousehold(householdId: string): Promise<SaveResult> {
  const wedding = await requireOwnedWedding();

  // Scoped to this wedding, so an id from elsewhere deletes nothing.
  const result = await db
    .delete(households)
    .where(and(eq(households.id, householdId), eq(households.weddingId, wedding.id)))
    .returning({ label: households.label });

  if (result.length) {
    await logRsvpEvent(wedding.id, null, "removed", `${result[0].label} removed from the guest list`);
  }

  goLive(wedding.slug);
  return { ok: true };
}

/** Approving a request mints the household and its invite link. */
export async function approveRequest(requestId: string, label: string): Promise<SaveResult> {
  const wedding = await requireOwnedWedding();

  const [request] = await db
    .select()
    .from(guestRequests)
    .where(and(eq(guestRequests.id, requestId), eq(guestRequests.weddingId, wedding.id)))
    .limit(1);

  if (!request) return { ok: false, error: "That request is gone." };
  if (request.status !== "pending") return { ok: false, error: "That request was already dealt with." };

  const [household] = await db
    .insert(households)
    .values({
      weddingId: wedding.id,
      label: label.trim().slice(0, 120) || request.name,
      inviteToken: newInviteToken(),
    })
    .returning();

  await db.insert(guests).values({ householdId: household.id, name: request.name });

  await db
    .update(guestRequests)
    .set({ status: "approved", householdId: household.id, resolvedAt: new Date() })
    .where(eq(guestRequests.id, request.id));

  await logRsvpEvent(wedding.id, household.id, "approved", `${request.name} approved and added`);
  goLive(wedding.slug);
  return { ok: true };
}

export async function declineRequest(requestId: string): Promise<SaveResult> {
  const wedding = await requireOwnedWedding();

  const [request] = await db
    .update(guestRequests)
    .set({ status: "declined", resolvedAt: new Date() })
    .where(and(eq(guestRequests.id, requestId), eq(guestRequests.weddingId, wedding.id)))
    .returning({ name: guestRequests.name });

  if (request) await logRsvpEvent(wedding.id, null, "declined", `${request.name}'s request declined`);

  revalidatePath("/admin");
  return { ok: true };
}

export type LookInput = { layout: Layout; palette: Palette; accent: string | null };

export async function saveLook(input: LookInput): Promise<SaveResult> {
  const wedding = await requireOwnedWedding();

  if (!(input.layout in LAYOUTS)) return { ok: false, error: "Unknown layout" };
  if (!PALETTES.some((p) => p.key === input.palette)) return { ok: false, error: "Unknown palette" };

  const accent = input.accent && /^#[0-9a-fA-F]{6}$/.test(input.accent) ? input.accent.toLowerCase() : null;

  await db
    .update(weddings)
    .set({ layout: input.layout, palette: input.palette, accent, updatedAt: new Date() })
    .where(eq(weddings.id, wedding.id));

  goLive(wedding.slug);
  return { ok: true };
}
