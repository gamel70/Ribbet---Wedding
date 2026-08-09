/**
 * Content the guest app shows that the couple has no editor for yet.
 *
 * The schedule, the menu, the room blocks, the wedding party and the FAQ are all
 * hard-coded in `Ribbet App Structure.dc.html`, and there is no intake field and
 * no Sheet tab that feeds them — so these are the design's own values, kept in
 * one place rather than scattered through the screens. When a couple-side editor
 * lands, this file is what it replaces.
 *
 * Around town and the DJ list are deliberately NOT here: those are real data,
 * fed by the Sheet and by guests.
 */

export type ScheduleEntry = { time: string; minutes: number; title: string; detail: string };

/** Minutes from midnight, so "now" can be worked out on the day itself. */
export const SCHEDULE: ScheduleEntry[] = [
  { time: "4:15", minutes: 16 * 60 + 15, title: "Doors open", detail: "Rooftop elevator, 12th fl" },
  { time: "5:00", minutes: 17 * 60, title: "Ceremony", detail: "West terrace — phones away" },
  { time: "5:45", minutes: 17 * 60 + 45, title: "Golden-hour drinks", detail: "East rail · signature spritz" },
  { time: "7:00", minutes: 19 * 60, title: "Dinner", detail: "Long tables, under the lights" },
  { time: "8:45", minutes: 20 * 60 + 45, title: "Toasts", detail: "Elle has the mic first" },
  { time: "9:30", minutes: 21 * 60 + 30, title: "Dancing", detail: "Till they kick us out" },
];

export type ScheduleState = "done" | "now" | "next" | "later";

/**
 * Marks each row done / now / next against the clock. Before the wedding day
 * everything reads "later"; after it, everything reads "done".
 */
export function scheduleStates(weddingDate: Date | null, now: Date): ScheduleState[] {
  if (!weddingDate) return SCHEDULE.map(() => "later");

  const day = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const weddingDay = day(new Date(weddingDate.getTime() + weddingDate.getTimezoneOffset() * 60_000));
  const today = day(now);

  if (today !== weddingDay) {
    const past = now.getTime() > weddingDate.getTime();
    return SCHEDULE.map(() => (past ? "done" : "later"));
  }

  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const currentIndex = SCHEDULE.reduce(
    (found, entry, i) => (minutesNow >= entry.minutes ? i : found),
    -1,
  );

  return SCHEDULE.map((_, i) => {
    if (i < currentIndex) return "done";
    if (i === currentIndex) return "now";
    if (i === currentIndex + 1) return "next";
    return "later";
  });
}

export const MAINS = [
  { key: "striploin", label: "Striploin, salsa verde", note: "Medium unless you say otherwise" },
  { key: "bass", label: "Black bass, fennel, citrus", note: "" },
  { key: "agnolotti", label: "Squash agnolotti", note: "", veg: true },
  { key: "kids", label: "Kids plate", note: "For the under-tens", kids: true },
];

export const DIETARY_OPTIONS = [
  "Gluten-free",
  "Vegetarian",
  "Vegan",
  "Dairy-free",
  "No shellfish",
  "Nut allergy",
];

export const STARTERS = "Burrata, charred peach, basil · Smashed cucumbers · Focaccia from Caputo's";
export const BAR = "The Rooftop Spritz · Cole's old fashioned · natural wines · zero-proof list all night";

export const HOME_QUOTE =
  "“Sunset ceremony, dinner under the string lights, dancing till they kick us out. Bring a layer — it’s a roof.”";

export const DAY_NOTE =
  "Live on the day. If dinner slips to 7:30, this updates and you get exactly one text — promise.";

export const ROOM_BLOCKS = [
  { name: "1 Hotel Brooklyn Bridge", price: "$289", detail: "Code AMARACOLE · 4 min walk · book by Sep 10" },
  { name: "The Tillary", price: "$199", detail: "Code RIBBET26 · 12 min walk" },
];

export const SHUTTLE = {
  title: "From both hotels · 4:15 & 4:35",
  detail: "Reserved your seat in RSVP? You're on the 4:15. Last ride back 12:30.",
};

export const TRAVEL_NOTE = "Getting in: JFK → 40 min car · LGA → 30 min · subway F to York St.";

export const WEDDING_PARTY = [
  { name: "Elle Voss", role: "Best woman · first toast" },
  { name: "Marcus Bell", role: "Best man · dorm-kitchen witness" },
];

export const FAQ = [
  { q: "What do I wear?", a: "Cocktail, rooftop edition — comfortable shoes, bring a layer." },
  { q: "Kids?", a: "We love them, but this one's adults-only except the flower crew." },
  { q: "Parking?", a: "Take the shuttle. Truly. DUMBO on a Saturday is a trap." },
  {
    q: "Phones at the ceremony?",
    a: "Pocketed for 20 minutes — the photographer has it covered, and the vault gets everything after.",
  },
];

export const GIFT_FUND = { name: "Honeymoon · Kyoto", goalCents: 1_000_000 };

export const GIFT_ITEMS = [
  { key: "dutch-oven", name: "Le Creuset dutch oven", amountCents: 42_000 },
  { key: "ceramics", name: "Ceramics class for two", amountCents: 18_000 },
  { key: "record-player", name: "Record player", amountCents: 34_000 },
  { key: "espresso", name: "Espresso grinder", amountCents: 22_000 },
];
