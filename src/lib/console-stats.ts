import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { guestMeals, guestbookNotes, guests, households, photos, pledges, rsvps, songRequests } from "@/db/schema";

/**
 * The console's live numbers, straight out of the database — the same source of
 * truth the Sheet mirrors, so the console and the spreadsheet can never disagree.
 */
export type ConsoleStats = {
  households: number;
  replied: number;
  noReply: number;
  comingHouseholds: number;
  declinedHouseholds: number;
  guestsComing: number;
  meals: Array<{ main: string; count: number }>;
  dietaryFlags: number;
  pledgedCents: number;
  pledgeCount: number;
  photos: number;
  songs: number;
  guestbook: number;
};

export async function consoleStats(weddingId: string): Promise<ConsoleStats> {
  const householdRows = await db
    .select({
      id: households.id,
      reply: rsvps.reply,
      attending: rsvps.attendingCount,
      submittedAt: rsvps.submittedAt,
    })
    .from(households)
    .leftJoin(rsvps, eq(rsvps.householdId, households.id))
    .where(eq(households.weddingId, weddingId));

  const replied = householdRows.filter((h) => h.submittedAt).length;
  const comingHouseholds = householdRows.filter((h) => h.reply === "yes").length;
  const declinedHouseholds = householdRows.filter((h) => h.reply === "no").length;
  const guestsComing = householdRows.reduce((sum, h) => sum + (h.reply === "yes" ? (h.attending ?? 0) : 0), 0);

  const mealRows = await db
    .select({ main: guestMeals.main, dietary: guestMeals.dietary })
    .from(guestMeals)
    .innerJoin(guests, eq(guests.id, guestMeals.guestId))
    .innerJoin(households, eq(households.id, guests.householdId))
    .where(eq(households.weddingId, weddingId));

  const mealCounts = new Map<string, number>();
  let dietaryFlags = 0;
  for (const row of mealRows) {
    if (row.main) mealCounts.set(row.main, (mealCounts.get(row.main) ?? 0) + 1);
    if (row.dietary?.length) dietaryFlags += 1;
  }

  const [pledgeTotals] = await db
    .select({
      total: sql<number>`coalesce(sum(${pledges.amountCents}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(pledges)
    .innerJoin(households, eq(households.id, pledges.householdId))
    .where(eq(households.weddingId, weddingId));

  const [photoCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(photos)
    .where(eq(photos.weddingId, weddingId));

  const [songCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(songRequests)
    .innerJoin(households, eq(households.id, songRequests.householdId))
    .where(eq(households.weddingId, weddingId));

  const [noteCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(guestbookNotes)
    .where(eq(guestbookNotes.weddingId, weddingId));

  return {
    households: householdRows.length,
    replied,
    noReply: householdRows.length - replied,
    comingHouseholds,
    declinedHouseholds,
    guestsComing,
    meals: [...mealCounts.entries()]
      .map(([main, count]) => ({ main, count }))
      .sort((a, b) => b.count - a.count),
    dietaryFlags,
    pledgedCents: Number(pledgeTotals?.total ?? 0),
    pledgeCount: Number(pledgeTotals?.count ?? 0),
    photos: Number(photoCount?.count ?? 0),
    songs: Number(songCount?.count ?? 0),
    guestbook: Number(noteCount?.count ?? 0),
  };
}

export type GuestTableRow = {
  household: string;
  names: string;
  reply: "yes" | "no" | null;
  attending: number | null;
  dietary: string;
  note: string;
  submittedAt: Date | null;
};

/** The console's guest table, one row per household. */
export async function guestTable(weddingId: string): Promise<GuestTableRow[]> {
  const rows = await db
    .select({
      id: households.id,
      label: households.label,
      reply: rsvps.reply,
      attending: rsvps.attendingCount,
      note: rsvps.note,
      submittedAt: rsvps.submittedAt,
    })
    .from(households)
    .leftJoin(rsvps, eq(rsvps.householdId, households.id))
    .where(eq(households.weddingId, weddingId));

  const people = await db
    .select({
      householdId: guests.householdId,
      name: guests.name,
      dietary: guestMeals.dietary,
    })
    .from(guests)
    .leftJoin(guestMeals, eq(guestMeals.guestId, guests.id))
    .innerJoin(households, eq(households.id, guests.householdId))
    .where(eq(households.weddingId, weddingId));

  return rows
    .map((row) => {
      const mine = people.filter((p) => p.householdId === row.id);
      return {
        household: row.label,
        names: mine.map((p) => p.name).join(", "),
        reply: (row.reply as "yes" | "no" | null) ?? null,
        attending: row.attending,
        dietary: [...new Set(mine.flatMap((p) => p.dietary ?? []))].join(", "),
        note: row.note ?? "",
        submittedAt: row.submittedAt,
      };
    })
    .sort((a, b) => a.household.localeCompare(b.household));
}
