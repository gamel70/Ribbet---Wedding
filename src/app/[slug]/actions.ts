"use server";

import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import {
  guestMeals,
  guestRequests,
  guestbookNotes,
  guests,
  households,
  rsvps,
  songRequests,
} from "@/db/schema";
import { resolveSections } from "@/lib/design";
import {
  currentHousehold,
  logRsvpEvent,
  searchGuestList,
  setHouseholdSession,
  weddingBySlug,
  type GuestMatch,
} from "@/lib/guest";
import { pushHouseholdToSheet, pushSongsToSheet } from "@/lib/sheet-sync";

/**
 * Everything a guest can write.
 *
 * Every one of these resolves the household from the session cookie and refuses
 * without one. A household id is never accepted from the client, and nothing
 * here creates a household — that only happens from an invite link the couple
 * sent, or from a claim the guest made against the couple's own guest list.
 */

type HouseholdContext =
  | { ok: true; wedding: NonNullable<Awaited<ReturnType<typeof weddingBySlug>>>; household: NonNullable<Awaited<ReturnType<typeof currentHousehold>>> }
  | { ok: false; reason: "no_wedding" | "identify" };

async function requireHousehold(slug: string): Promise<HouseholdContext> {
  const wedding = await weddingBySlug(slug);
  if (!wedding) return { ok: false, reason: "no_wedding" };

  const household = await currentHousehold(wedding.id);
  if (!household) return { ok: false, reason: "identify" };

  return { ok: true, wedding, household };
}

// ------------------------------------------------------------- identity ----

export type ClaimSearchResult = { ok: true; matches: GuestMatch[] } | { ok: false; error: string };

/** Type-ahead against the couple's guest list, for the "find your name" screen. */
export async function searchGuests(slug: string, query: string): Promise<ClaimSearchResult> {
  const wedding = await weddingBySlug(slug);
  if (!wedding) return { ok: false, error: "We couldn't find that wedding." };

  return { ok: true, matches: await searchGuestList(wedding.id, query) };
}

export type ClaimResult = { ok: true } | { ok: false; error: string };

/**
 * Binds this browser to the household the chosen guest belongs to.
 *
 * The guest id is checked against this wedding before anything is minted, so a
 * guest id lifted from another wedding buys nothing.
 */
export async function claimHousehold(slug: string, guestId: string): Promise<ClaimResult> {
  const wedding = await weddingBySlug(slug);
  if (!wedding) return { ok: false, error: "We couldn't find that wedding." };

  const [match] = await db
    .select({
      guestName: guests.name,
      householdId: households.id,
      householdLabel: households.label,
      weddingId: households.weddingId,
    })
    .from(guests)
    .innerJoin(households, eq(households.id, guests.householdId))
    .where(eq(guests.id, guestId))
    .limit(1);

  if (!match || match.weddingId !== wedding.id) {
    return { ok: false, error: "That name isn't on this guest list." };
  }

  await setHouseholdSession(wedding.id, match.householdId);
  await logRsvpEvent(
    wedding.id,
    match.householdId,
    "claimed",
    `${match.guestName} found themselves in ${match.householdLabel}`,
  );

  revalidatePath(`/${slug}`, "layout");
  return { ok: true };
}

/** "Ask the couple to add you" — lands in the console's approve queue. */
export async function requestInvite(slug: string, name: string, note: string): Promise<ClaimResult> {
  const wedding = await weddingBySlug(slug);
  if (!wedding) return { ok: false, error: "We couldn't find that wedding." };

  const clean = name.trim();
  if (clean.length < 2) return { ok: false, error: "Tell us your name first." };

  await db.insert(guestRequests).values({
    weddingId: wedding.id,
    name: clean.slice(0, 120),
    note: note.trim().slice(0, 400) || null,
  });

  await logRsvpEvent(wedding.id, null, "requested", `${clean} asked to be added to the guest list`);

  revalidatePath("/admin");
  return { ok: true };
}

// ----------------------------------------------------------------- RSVP ----

export type RsvpPerson = {
  name: string;
  attending: boolean;
  isChild: boolean;
  main: string | null;
  dietary: string[];
  kitchenNote: string;
};

export type RsvpInput = {
  slug: string;
  reply: "yes" | "no";
  people: RsvpPerson[];
  shuttle: boolean;
  note: string;
  songTitle: string;
  songArtist: string;
};

export type RsvpResult =
  | { ok: true; syncWarning: string | null }
  | { ok: false; error: string; identify?: boolean };

export async function submitRsvp(input: RsvpInput): Promise<RsvpResult> {
  const found = await requireHousehold(input.slug);
  if (!found.ok) {
    return found.reason === "identify"
      ? { ok: false, error: "Tell us who you are first.", identify: true }
      : { ok: false, error: "We couldn't find that wedding." };
  }
  const { wedding, household } = found;

  const people = input.people
    .map((p) => ({ ...p, name: p.name.trim() }))
    .filter((p) => p.name.length > 0)
    .slice(0, 12);

  if (!people.length) return { ok: false, error: "Add at least one name so we know who's replying." };

  // What it looked like before, so the feed can say what actually changed.
  const [previous] = await db.select().from(rsvps).where(eq(rsvps.householdId, household.id)).limit(1);
  const wasSubmitted = Boolean(previous?.submittedAt);

  const existing = await db
    .select({ id: guests.id })
    .from(guests)
    .where(eq(guests.householdId, household.id));

  if (existing.length) {
    await db.delete(guestMeals).where(inArray(guestMeals.guestId, existing.map((g) => g.id)));
    await db.delete(guests).where(eq(guests.householdId, household.id));
  }

  const inserted = await db
    .insert(guests)
    .values(people.map((p) => ({ householdId: household.id, name: p.name, isChild: p.isChild })))
    .returning({ id: guests.id });

  const sections = resolveSections(wedding.sections);

  if (sections.menu) {
    const meals = inserted
      .map((row, i) => ({ row, person: people[i] }))
      .filter(({ person }) => person.attending && (person.main || person.dietary.length || person.kitchenNote))
      .map(({ row, person }) => ({
        guestId: row.id,
        main: person.main,
        dietary: person.dietary,
        kitchenNote: person.kitchenNote.trim() || null,
      }));

    if (meals.length) await db.insert(guestMeals).values(meals);
  }

  const attendingCount = input.reply === "yes" ? people.filter((p) => p.attending).length : 0;
  const note = input.note.trim() || null;

  await db
    .insert(rsvps)
    .values({
      householdId: household.id,
      reply: input.reply,
      attendingCount,
      note,
      shuttle: input.shuttle,
      submittedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: rsvps.householdId,
      set: { reply: input.reply, attendingCount, note, shuttle: input.shuttle, submittedAt: new Date() },
    });

  const title = input.songTitle.trim();
  if (sections.songs && title) {
    await db.delete(songRequests).where(eq(songRequests.householdId, household.id));
    await db.insert(songRequests).values({
      householdId: household.id,
      title: title.slice(0, 200),
      artist: input.songArtist.trim().slice(0, 200) || null,
    });
  }

  await logRsvpEvent(
    wedding.id,
    household.id,
    wasSubmitted ? "changed" : "submitted",
    wasSubmitted
      ? `${household.label} changed their reply — ${describe(previous?.reply ?? null, previous?.attendingCount ?? null)} → ${describe(input.reply, attendingCount)}`
      : `${household.label} replied — ${describe(input.reply, attendingCount)}`,
  );

  let syncWarning: string | null = null;
  try {
    await pushHouseholdToSheet(wedding, household.id);
    if (sections.songs && title) await pushSongsToSheet(wedding);
  } catch (error) {
    syncWarning = error instanceof Error ? error.message : String(error);
  }

  revalidatePath(`/${input.slug}`, "layout");
  revalidatePath("/admin");

  return { ok: true, syncWarning };
}

function describe(reply: string | null, attending: number | null): string {
  if (reply === "yes") return `coming, ${attending ?? 0}`;
  if (reply === "no") return "declined";
  return "no reply";
}

// -------------------------------------------------------- other writes ----

export type SimpleResult = { ok: boolean; error?: string; identify?: boolean };

export async function submitSong(slug: string, title: string, artist: string): Promise<SimpleResult> {
  const found = await requireHousehold(slug);
  if (!found.ok) {
    return found.reason === "identify"
      ? { ok: false, error: "Tell us who you are first.", identify: true }
      : { ok: false, error: "We couldn't find that wedding." };
  }
  const { wedding, household } = found;

  if (!resolveSections(wedding.sections).songs) return { ok: false, error: "Songs aren't switched on." };

  const clean = title.trim();
  if (!clean) return { ok: false, error: "Which song?" };

  await db.delete(songRequests).where(eq(songRequests.householdId, household.id));
  await db.insert(songRequests).values({
    householdId: household.id,
    title: clean.slice(0, 200),
    artist: artist.trim().slice(0, 200) || null,
  });

  try {
    await pushSongsToSheet(wedding);
  } catch {
    // Queued in the database; the next successful write rebuilds the whole tab.
  }

  revalidatePath(`/${slug}/more/songs`);
  return { ok: true };
}

export async function submitGuestbookNote(
  slug: string,
  author: string,
  body: string,
): Promise<SimpleResult> {
  const found = await requireHousehold(slug);
  if (!found.ok) {
    return found.reason === "identify"
      ? { ok: false, error: "Tell us who you are first.", identify: true }
      : { ok: false, error: "We couldn't find that wedding." };
  }
  const { wedding, household } = found;

  if (!resolveSections(wedding.sections).guestbook) {
    return { ok: false, error: "The guestbook isn't switched on." };
  }

  const text = body.trim();
  if (!text) return { ok: false, error: "Write something first." };

  await db.insert(guestbookNotes).values({
    weddingId: wedding.id,
    householdId: household.id,
    author: (author.trim() || household.label).slice(0, 120),
    body: text.slice(0, 1000),
  });

  revalidatePath(`/${slug}/more/guestbook`);
  return { ok: true };
}
