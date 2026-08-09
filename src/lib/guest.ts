import { randomBytes } from "node:crypto";

import { and, asc, eq } from "drizzle-orm";
import { cookies } from "next/headers";

import { db } from "@/db";
import { guests, householdSessions, households, rsvps, weddings } from "@/db/schema";
import type { WeddingRow } from "@/lib/wedding";

/**
 * Guest identity while the phone + texted-code lock is parked.
 *
 * README lists the lock screens as deliberately parked work, and Test 8 expects
 * the link to keep working in a private window — so a household is identified by
 * a cookie-backed session row rather than a login. The session table is the same
 * one the code gate will use when it goes back in front of Home; only the way a
 * session gets minted changes.
 *
 * The important property either way: a household id is what scopes an RSVP and
 * what "guests see only their own uploads" is enforced on, server-side.
 */

const SESSION_DAYS = 400;

function cookieName(weddingId: string): string {
  return `ribbet_hh_${weddingId.slice(0, 8)}`;
}

export type WeddingBySlug = WeddingRow;

export async function weddingBySlug(slug: string): Promise<WeddingBySlug | null> {
  const [row] = await db.select().from(weddings).where(eq(weddings.slug, slug)).limit(1);
  return row ?? null;
}

export type HouseholdRow = typeof households.$inferSelect;
export type GuestRow = typeof guests.$inferSelect;
export type RsvpRow = typeof rsvps.$inferSelect;

/** The household this browser belongs to, or null if they've never replied. */
export async function currentHousehold(weddingId: string): Promise<HouseholdRow | null> {
  const jar = await cookies();
  const token = jar.get(cookieName(weddingId))?.value;
  if (!token) return null;

  const [row] = await db
    .select({ household: households })
    .from(householdSessions)
    .innerJoin(households, eq(households.id, householdSessions.householdId))
    .where(and(eq(householdSessions.token, token), eq(households.weddingId, weddingId)))
    .limit(1);

  if (!row) return null;
  return row.household;
}

/**
 * Returns this browser's household, creating one on first use. Only call from a
 * Server Action or Route Handler — it sets a cookie.
 */
export async function ensureHousehold(weddingId: string, label: string): Promise<HouseholdRow> {
  const existing = await currentHousehold(weddingId);
  if (existing) {
    // Keep the label in step with whatever name they last gave us.
    if (label && label !== existing.label) {
      await db.update(households).set({ label }).where(eq(households.id, existing.id));
      return { ...existing, label };
    }
    return existing;
  }

  const [household] = await db
    .insert(households)
    .values({ weddingId, label: label || "Guest" })
    .returning();

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);

  await db.insert(householdSessions).values({ token, householdId: household.id, expiresAt });

  const jar = await cookies();
  jar.set(cookieName(weddingId), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });

  return household;
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
