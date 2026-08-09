"use server";

import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { guestMeals, guestbookNotes, guests, households, rsvps, songRequests } from "@/db/schema";
import { resolveSections } from "@/lib/design";
import { ensureHousehold, weddingBySlug } from "@/lib/guest";
import { pushHouseholdToSheet, pushSongsToSheet } from "@/lib/sheet-sync";

/**
 * Everything a guest can write.
 *
 * Guest identity is the cookie-backed household session, and every action
 * re-derives it server-side — a household id is never taken from the client, so
 * one guest cannot write into another household's reply or read their photos.
 */

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
  householdLabel: string;
  reply: "yes" | "no";
  people: RsvpPerson[];
  shuttle: boolean;
  note: string;
  songTitle: string;
  songArtist: string;
};

export type RsvpResult = { ok: true; syncWarning: string | null } | { ok: false; error: string };

export async function submitRsvp(input: RsvpInput): Promise<RsvpResult> {
  const wedding = await weddingBySlug(input.slug);
  if (!wedding) return { ok: false, error: "We couldn't find that wedding." };

  const people = input.people
    .map((p) => ({ ...p, name: p.name.trim() }))
    .filter((p) => p.name.length > 0)
    .slice(0, 12);

  if (!people.length) return { ok: false, error: "Add at least one name so we know who's replying." };

  const label = (input.householdLabel.trim() || people[0].name).slice(0, 120);
  const household = await ensureHousehold(wedding.id, label);

  // Replace the household's people rather than accumulating duplicates when a
  // guest comes back and edits their reply.
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
    .values(
      people.map((p) => ({
        householdId: household.id,
        name: p.name,
        isChild: p.isChild,
      })),
    )
    .returning({ id: guests.id, name: guests.name });

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

  await db
    .insert(rsvps)
    .values({
      householdId: household.id,
      reply: input.reply,
      attendingCount,
      note: input.note.trim() || null,
      shuttle: input.shuttle,
      submittedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: rsvps.householdId,
      set: {
        reply: input.reply,
        attendingCount,
        note: input.note.trim() || null,
        shuttle: input.shuttle,
        submittedAt: new Date(),
      },
    });

  await db.update(households).set({ openedAt: household.openedAt ?? new Date() }).where(eq(households.id, household.id));

  // One request per household, per the design — replace rather than pile up.
  const title = input.songTitle.trim();
  if (sections.songs && title) {
    await db.delete(songRequests).where(eq(songRequests.householdId, household.id));
    await db.insert(songRequests).values({
      householdId: household.id,
      title: title.slice(0, 200),
      artist: input.songArtist.trim().slice(0, 200) || null,
    });
  }

  // The Sheet is a mirror, so a failed write must not lose the reply — the
  // database already has it. Surface it instead of throwing it away.
  let syncWarning: string | null = null;
  try {
    await pushHouseholdToSheet(wedding, household.id);
    if (sections.songs && title) await pushSongsToSheet(wedding);
  } catch (error) {
    syncWarning = error instanceof Error ? error.message : String(error);
  }

  revalidatePath(`/${input.slug}`);
  revalidatePath(`/${input.slug}/rsvp`);

  return { ok: true, syncWarning };
}

export type SongResult = { ok: boolean; error?: string };

/** The standalone song request on the Guestbook & songs screen. */
export async function submitSong(slug: string, title: string, artist: string): Promise<SongResult> {
  const wedding = await weddingBySlug(slug);
  if (!wedding) return { ok: false, error: "We couldn't find that wedding." };
  if (!resolveSections(wedding.sections).songs) return { ok: false, error: "Songs aren't switched on." };

  const clean = title.trim();
  if (!clean) return { ok: false, error: "Which song?" };

  const household = await ensureHousehold(wedding.id, "Guest");

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

/** Post-first moderation: the note is on the wall immediately. */
export async function submitGuestbookNote(
  slug: string,
  author: string,
  body: string,
): Promise<SongResult> {
  const wedding = await weddingBySlug(slug);
  if (!wedding) return { ok: false, error: "We couldn't find that wedding." };
  if (!resolveSections(wedding.sections).guestbook) {
    return { ok: false, error: "The guestbook isn't switched on." };
  }

  const text = body.trim();
  if (!text) return { ok: false, error: "Write something first." };

  const household = await ensureHousehold(wedding.id, author.trim() || "Guest");

  await db.insert(guestbookNotes).values({
    weddingId: wedding.id,
    householdId: household.id,
    author: (author.trim() || "A guest").slice(0, 120),
    body: text.slice(0, 1000),
  });

  revalidatePath(`/${slug}/more/guestbook`);
  return { ok: true };
}

