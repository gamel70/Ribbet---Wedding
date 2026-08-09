import { eq, inArray } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";

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

  // Browsing is open; replying is not. Without a session — an invite link or a
  // claim against the guest list — there is no household to reply for.
  const household = await currentHousehold(wedding.id);
  if (!household) redirect(`/${slug}/who?next=/${slug}/rsvp`);

  const sections = resolveSections(wedding.sections);
  const people = await householdGuests(household.id);
  const reply = await householdRsvp(household.id);

  const meals = people.length
    ? await db
        .select()
        .from(guestMeals)
        .where(inArray(guestMeals.guestId, people.map((p) => p.id)))
    : [];

  const [song] = await db
    .select()
    .from(songRequests)
    .where(eq(songRequests.householdId, household.id))
    .limit(1);

  const draft: RsvpDraft = {
    reply: (reply?.reply as "yes" | "no" | null) ?? null,
    shuttle: reply?.shuttle ?? false,
    note: reply?.note ?? "",
    songTitle: song?.title ?? "",
    songArtist: song?.artist ?? "",
    submitted: Boolean(reply?.submittedAt),
    submittedAt: reply?.submittedAt?.toISOString() ?? null,
    people: people.length
      ? people.map((p) => {
          const meal = meals.find((m) => m.guestId === p.id);
          return {
            name: p.name,
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
      householdLabel={household.label}
      draft={draft}
      showMenu={sections.menu}
      showSongs={sections.songs}
      showShuttle={sections.travel}
    />
  );
}
