import type { ScheduleEntry } from "@/db/schema";

/**
 * The Day's running order. The couple edits it in the console; until they do,
 * these are the design's own times from screen 03.
 */
export const DEFAULT_SCHEDULE: ScheduleEntry[] = [
  { time: "16:15", title: "Doors open", detail: "Rooftop elevator, 12th fl" },
  { time: "17:00", title: "Ceremony", detail: "West terrace — phones away" },
  { time: "17:45", title: "Golden-hour drinks", detail: "East rail · signature spritz" },
  { time: "19:00", title: "Dinner", detail: "Long tables, under the lights" },
  { time: "20:45", title: "Toasts", detail: "Elle has the mic first" },
  { time: "21:30", title: "Dancing", detail: "Till they kick us out" },
];

export function resolveSchedule(stored: ScheduleEntry[] | null | undefined): ScheduleEntry[] {
  if (!stored?.length) return DEFAULT_SCHEDULE;
  return [...stored].sort((a, b) => minutesOf(a.time) - minutesOf(b.time));
}

/** "17:45" → 1065. Unparseable times sort to the end rather than throwing. */
export function minutesOf(time: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(time).trim());
  if (!match) return Number.MAX_SAFE_INTEGER;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** "17:45" → "5:45". The design shows 12-hour times with no meridiem. */
export function displayTime(time: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(time).trim());
  if (!match) return time;
  const hour = Number(match[1]) % 12 || 12;
  return `${hour}:${match[2]}`;
}

export type ScheduleState = "done" | "now" | "next" | "later";

/**
 * Marks each row done / now / next against the clock. Before the wedding day
 * everything reads "later"; after it, everything reads "done".
 */
export function scheduleStates(
  schedule: ScheduleEntry[],
  weddingDate: Date | null,
  now: Date,
): ScheduleState[] {
  if (!weddingDate) return schedule.map(() => "later");

  // The stored date is UTC midnight; compare it against the viewer's own day.
  const weddingDay = `${weddingDate.getUTCFullYear()}-${weddingDate.getUTCMonth()}-${weddingDate.getUTCDate()}`;
  const today = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

  if (today !== weddingDay) {
    const past = now.getTime() > weddingDate.getTime() + 86_400_000;
    return schedule.map(() => (past ? "done" : "later"));
  }

  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const currentIndex = schedule.reduce(
    (found, entry, i) => (minutesNow >= minutesOf(entry.time) ? i : found),
    -1,
  );

  return schedule.map((_, i) => {
    if (i < currentIndex) return "done";
    if (i === currentIndex) return "now";
    if (i === currentIndex + 1) return "next";
    return "later";
  });
}
