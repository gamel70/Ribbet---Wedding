import { inArray } from "drizzle-orm";
import { notFound } from "next/navigation";

import { db } from "@/db";
import { guestMeals, songRequests } from "@/db/schema";
import { resolveSections } from "@/lib/design";
import { currentHousehold, householdGuests, householdRsvp, weddingBySlug } from "@/lib/guest";

import { RsvpForm, type RsvpDraft } from "./rsvp-form";

/** Screen 02 — RSVP. Household-level: one reply covers everyone. */
export default async function RsvpScreen({ params }: PageProps<"/[slug]/rsvp">) {
  const { slug } = await params;
  const wedding = await weddingBySlug(slug);
  if (!wedding) notFound();

  const sections = resolveSections(wedding.sections);
  const household = await currentHousehold(wedding.id);
  const people = household ? await householdGuests(household.id) : [];
  const reply = household ? await householdRsvp(household.id) : null;

  const meals = people.length
    ? await db
        .select()
        .from(guestMeals)
        .where(inArray(guestMeals.guestId, people.map((p) => p.id)))
    : [];

  const song = household
    ? (
        await db
          .select()
          .from(songRequests)
          .where(inArray(songRequests.householdId, [household.id]))
          .limit(1)
      )[0]
    : undefined;

  const draft: RsvpDraft = {
    householdLabel: household?.label ?? "",
    reply: (reply?.reply as "yes" | "no" | null) ?? null,
    shuttle: reply?.shuttle ?? false,
    note: reply?.note ?? "",
    songTitle: song?.title ?? "",
    songArtist: song?.artist ?? "",
    submitted: Boolean(reply?.submittedAt),
    people: people.length
      ? people.map((p) => {
          const meal = meals.find((m) => m.guestId === p.id);
          return {
            name: p.name,
            // A saved person is attending unless the household declined.
            attending: reply?.reply !== "no",
            isChild: p.isChild,
            main: meal?.main ?? null,
            dietary: meal?.dietary ?? [],
            kitchenNote: meal?.kitchenNote ?? "",
          };
        })
      : [{ name: "", attending: true, isChild: false, main: null, dietary: [], kitchenNote: "" }],
  };

  return (
    <RsvpForm
      slug={slug}
      draft={draft}
      showMenu={sections.menu}
      showSongs={sections.songs}
      showShuttle={sections.travel}
    />
  );
}
