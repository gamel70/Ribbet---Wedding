import { randomBytes } from "node:crypto";

import { and, asc, desc, eq, ilike } from "drizzle-orm";
import { cookies } from "next/headers";

import { db } from "@/db";
import { guests, householdSessions, households, rsvpEvents, rsvps, weddings } from "@/db/schema";
import type { WeddingRow } from "@/lib/wedding";

/**
 * Guest identity.
 *
 * There are exactly two ways to become a household, and neither of them is
 * "started typing":
 *
 *   1. An invite link — /i/<token> — which the couple texts. The token is the
 *      household's only credential, so it has to be unguessable.
 *   2. Claiming, by finding your own name in the couple's guest list and
 *      confirming the household it belongs to.
 *
 * Nothing else mints a session. An earlier version created a household on the
 * first write of any kind, which meant posting to the guestbook silently
 * manufactured the identity the RSVP screen would later trust.
 */

const SESSION_DAYS = 400;

function cookieName(weddingId: string): string {
  return `ribbet_hh_${weddingId.slice(0, 8)}`;
}

/** 22 unguessable characters — this is the credential the couple texts. */
export function newInviteToken(): string {
  return randomBytes(16).toString("base64url");
}

export type WeddingBySlug = WeddingRow;

export async function weddingBySlug(slug: string): Promise<WeddingBySlug | null> {
  const [row] = await db.select().from(weddings).where(eq(weddings.slug, slug)).limit(1);
  return row ?? null;
}

export type HouseholdRow = typeof households.$inferSelect;
export type GuestRow = typeof guests.$inferSelect;
export type RsvpRow = typeof rsvps.$inferSelect;

/** The household this browser has proved it belongs to, or null. */
export async function currentHousehold(weddingId: string): Promise<HouseholdRow | null> {
  const jar = await cookies();
  const token = jar.get(cookieName(weddingId))?.value;
  if (!token) return null;

  const [row] = await db
    .select({ household: households, expiresAt: householdSessions.expiresAt })
    .from(householdSessions)
    .innerJoin(households, eq(households.id, householdSessions.householdId))
    .where(and(eq(householdSessions.token, token), eq(households.weddingId, weddingId)))
    .limit(1);

  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;

  return row.household;
}

/**
 * Binds this browser to a household. Only the invite route and the claim action
 * call this — it is the single place a guest session comes into existence.
 */
export async function setHouseholdSession(weddingId: string, householdId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);

  await db.insert(householdSessions).values({ token, householdId, expiresAt });

  const jar = await cookies();
  jar.set(cookieName(weddingId), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });

  await db
    .update(households)
    .set({ openedAt: new Date() })
    .where(and(eq(households.id, householdId), eq(households.weddingId, weddingId)));
}

/** Resolves an invite link to its household and wedding, or null. */
export async function householdByInviteToken(
  token: string,
): Promise<{ household: HouseholdRow; wedding: WeddingRow } | null> {
  const [row] = await db
    .select({ household: households, wedding: weddings })
    .from(households)
    .innerJoin(weddings, eq(weddings.id, households.weddingId))
    .where(eq(households.inviteToken, token))
    .limit(1);

  return row ?? null;
}

export async function householdGuests(householdId: string): Promise<GuestRow[]> {
  return db
    .select()
    .from(guests)
    .where(eq(guests.householdId, householdId))
    .orderBy(asc(guests.createdAt));
}

export async function householdRsvp(householdId: string): Promise<RsvpRow | null> {
  const [row] = await db.select().from(rsvps).where(eq(rsvps.householdId, householdId)).limit(1);
  return row ?? null;
}

export type GuestMatch = {
  guestId: string;
  guestName: string;
  householdId: string;
  householdLabel: string;
  members: string[];
  alreadyReplied: boolean;
};

/**
 * Type-ahead over the couple's guest list.
 *
 * This deliberately needs a real prefix and caps its results: the whole guest
 * list is not something anyone with the link should be able to page through.
 */
export const MIN_SEARCH_LENGTH = 2;
const MAX_MATCHES = 6;

export async function searchGuestList(weddingId: string, query: string): Promise<GuestMatch[]> {
  const trimmed = query.trim();
  if (trimmed.length < MIN_SEARCH_LENGTH) return [];

  const rows = await db
    .select({
      guestId: guests.id,
      guestName: guests.name,
      householdId: households.id,
      householdLabel: households.label,
      submittedAt: rsvps.submittedAt,
    })
    .from(guests)
    .innerJoin(households, eq(households.id, guests.householdId))
    .leftJoin(rsvps, eq(rsvps.householdId, households.id))
    .where(and(eq(households.weddingId, weddingId), ilike(guests.name, `%${trimmed}%`)))
    .orderBy(asc(guests.name))
    .limit(MAX_MATCHES);

  const out: GuestMatch[] = [];
  for (const row of rows) {
    const members = await db
      .select({ name: guests.name })
      .from(guests)
      .where(eq(guests.householdId, row.householdId))
      .orderBy(asc(guests.createdAt));

    out.push({
      guestId: row.guestId,
      guestName: row.guestName,
      householdId: row.householdId,
      householdLabel: row.householdLabel,
      members: members.map((m) => m.name),
      alreadyReplied: Boolean(row.submittedAt),
    });
  }
  return out;
}

/** Appends to the couple's RSVP feed. Never throws into the guest's path. */
export async function logRsvpEvent(
  weddingId: string,
  householdId: string | null,
  kind: string,
  summary: string,
): Promise<void> {
  try {
    await db.insert(rsvpEvents).values({ weddingId, householdId, kind, summary });
  } catch {
    // The feed is a convenience for the couple; losing a line must never cost a
    // guest their reply.
  }
}

export async function recentRsvpEvents(weddingId: string, limit = 40) {
  return db
    .select()
    .from(rsvpEvents)
    .where(eq(rsvpEvents.weddingId, weddingId))
    .orderBy(desc(rsvpEvents.createdAt))
    .limit(limit);
}
