import { inArray } from "drizzle-orm";
import { notFound } from "next/navigation";

import { db } from "@/db";
import { guestMeals } from "@/db/schema";
import { daysUntil } from "@/lib/dates";
import { resolveSections } from "@/lib/design";
import { currentHousehold, householdGuests, householdRsvp, weddingBySlug } from "@/lib/guest";
import { HOME_QUOTE } from "@/lib/wedding-content";

import { Eyebrow, RowLink } from "./ui";

/** Screen 01 — Home. Date eyebrow, 44px names, accent rule, stat strip, to-do list. */
export default async function HomeScreen({ params }: PageProps<"/[slug]">) {
  const { slug } = await params;
  const wedding = await weddingBySlug(slug);
  if (!wedding) notFound();

  const sections = resolveSections(wedding.sections);
  const household = await currentHousehold(wedding.id);
  const people = household ? await householdGuests(household.id) : [];
  const reply = household ? await householdRsvp(household.id) : null;

  const days = wedding.date ? daysUntil(wedding.date) : null;
  const seats = people.length || null;

  // "Choose your dinner" is only done once every person in the household has a
  // main against their name, not just the first one.
  const mealRows = people.length
    ? await db
        .select({ guestId: guestMeals.guestId, main: guestMeals.main })
        .from(guestMeals)
        .where(inArray(guestMeals.guestId, people.map((p) => p.id)))
    : [];
  const withMain = new Set(mealRows.filter((m) => m.main).map((m) => m.guestId));
  const mealsChosen = people.length > 0 && people.every((p) => withMain.has(p.id));

  const replied = Boolean(reply?.submittedAt);
  const coming = reply?.reply === "yes";

  const tasks: Array<{ label: string; href: string; done: boolean }> = [
    { label: "Reply to your invitation", href: `/${slug}/rsvp`, done: replied },
  ];
  if (sections.menu && coming) {
    tasks.push({ label: "Choose your dinner", href: `/${slug}/rsvp`, done: mealsChosen });
  }
  if (sections.travel) {
    tasks.push({ label: "Book the room block", href: `/${slug}/more/travel`, done: false });
  }

  const outstanding = tasks.filter((t) => !t.done).length;

  const dateLine = wedding.date
    ? wedding.date.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      })
    : "Date to come";
  const venueParts = (wedding.venue ?? "").split(",");
  const city = venueParts.length > 1 ? venueParts[venueParts.length - 1].trim() : "";
  const venueShort = venueParts[0]?.trim();

  return (
    <>
      <div style={{ fontSize: 10, letterSpacing: ".3em", textTransform: "uppercase", color: "var(--mut)" }}>
        {dateLine}
        {city ? ` · ${city}` : ""}
      </div>

      <div style={{ marginTop: 12, fontSize: 44, lineHeight: 1.02, fontFamily: "var(--serif)" }}>
        {wedding.nameOne}
        <br />
        <span style={{ fontStyle: "italic", color: "var(--acc)" }}>and</span> {wedding.nameTwo}
      </div>

      {venueShort ? (
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 1, background: "var(--acc)", flex: "none" }} />
          <div style={{ fontSize: 13, color: "var(--mut)" }}>{venueShort} · Ceremony 5:00</div>
        </div>
      ) : null}

      <div
        style={{
          marginTop: 20,
          border: "1px solid var(--line)",
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          textAlign: "center",
          borderRadius: "var(--rad)",
          overflow: "hidden",
        }}
      >
        <Stat value={days ?? "—"} label="Days" divider />
        <Stat value={seats ?? "—"} label="Seats" divider />
        <Stat value={outstanding} label="To do" accent />
      </div>

      {tasks.length ? (
        <>
          <Eyebrow style={{ marginTop: 20, letterSpacing: ".26em" }}>Waiting on you</Eyebrow>
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            {tasks.map((task, i) => (
              <RowLink key={task.label} href={task.href} index={i + 1} label={task.label} done={task.done} />
            ))}
          </div>
        </>
      ) : null}

      <div
        style={{
          marginTop: 20,
          padding: 15,
          border: "1px solid var(--line)",
          fontStyle: "italic",
          fontSize: 14,
          lineHeight: 1.55,
          color: "var(--mut)",
          fontFamily: "var(--serif)",
          borderRadius: "var(--rad)",
        }}
      >
        {HOME_QUOTE}
      </div>
    </>
  );
}

function Stat({
  value,
  label,
  accent,
  divider,
}: {
  value: number | string;
  label: string;
  accent?: boolean;
  divider?: boolean;
}) {
  return (
    <div
      style={{
        padding: "14px 8px",
        borderRight: divider ? "1px solid var(--line)" : "none",
      }}
    >
      <div style={{ fontSize: 27, fontFamily: "var(--serif)", color: accent ? "var(--acc)" : undefined }}>
        {value}
      </div>
      <div
        style={{
          fontSize: 9,
          letterSpacing: ".22em",
          textTransform: "uppercase",
          color: "var(--mut)",
          marginTop: 3,
        }}
      >
        {label}
      </div>
    </div>
  );
}
