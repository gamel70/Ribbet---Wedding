import { notFound } from "next/navigation";

import { currentHousehold, householdGuests, weddingBySlug } from "@/lib/guest";
import { displayTime, resolveSchedule, scheduleStates } from "@/lib/schedule";
import { sectionLabel } from "@/lib/sections";
import { DAY_NOTE } from "@/lib/wedding-content";

import { Lede, ScreenTitle } from "../ui";

/**
 * Screen 03 — The Day. Past rows at 45% opacity, the current row tinted with a
 * 3px accent left border and a "Now" pill, the following row marked "Next".
 */
export default async function DayScreen({ params }: PageProps<"/[slug]/day">) {
  const { slug } = await params;
  const wedding = await weddingBySlug(slug);
  if (!wedding) notFound();

  const schedule = resolveSchedule(wedding.schedule);
  const states = scheduleStates(schedule, wedding.date, new Date());

  const household = await currentHousehold(wedding.id);
  const people = household ? await householdGuests(household.id) : [];
  const table = people.find((p) => p.tableNumber)?.tableNumber ?? null;

  return (
    <>
      <ScreenTitle>{sectionLabel("day", wedding.sectionMeta)}</ScreenTitle>
      <Lede>{DAY_NOTE}</Lede>

      <div style={{ marginTop: 16, display: "flex", flexDirection: "column" }}>
        {schedule.map((entry, i) => {
          const state = states[i];
          const isNow = state === "now";
          return (
            <div
              key={`${entry.time}-${entry.title}`}
              style={{
                display: "flex",
                gap: 13,
                padding: isNow ? "13px 12px" : "13px 0",
                borderBottom: i === schedule.length - 1 ? "none" : "1px solid var(--line)",
                opacity: state === "done" ? 0.45 : 1,
                background: isNow ? "var(--panel)" : "transparent",
                borderLeft: isNow ? "3px solid var(--acc)" : undefined,
              }}
            >
              <div style={{ width: 52, flex: "none", fontFamily: "var(--serif)", fontSize: 15 }}>
                {displayTime(entry.time)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{entry.title}</div>
                <div style={{ fontSize: 11, color: "var(--mut)", marginTop: 1 }}>{entry.detail}</div>
              </div>
              {state === "done" || state === "now" || state === "next" ? (
                <div
                  style={{
                    fontSize: 9,
                    letterSpacing: ".14em",
                    textTransform: "uppercase",
                    paddingTop: 4,
                    color: isNow ? "var(--acc)" : "var(--mut)",
                    fontWeight: isNow ? 800 : 400,
                  }}
                >
                  {state === "done" ? "Done" : state === "now" ? "Now" : "Next"}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 16,
          padding: 15,
          border: "1px solid var(--acc)",
          display: "flex",
          alignItems: "center",
          gap: 14,
          borderRadius: "var(--rad)",
        }}
      >
        <div style={{ fontFamily: "var(--serif)", fontSize: 24, color: "var(--acc)" }}>
          {table ? `T${table}` : "—"}
        </div>
        <div style={{ flex: 1, fontSize: 13, lineHeight: 1.5 }}>
          {table ? (
            <>
              You&apos;re at <strong>Table {table}</strong>.
            </>
          ) : (
            <>Table assignments go out closer to the day.</>
          )}
          <br />
          <span style={{ color: "var(--mut)", fontSize: 11 }}>Guests only ever see their own table.</span>
        </div>
      </div>
    </>
  );
}
