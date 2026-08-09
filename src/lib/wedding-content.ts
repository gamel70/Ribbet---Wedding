/**
 * Content the guest app shows that the couple has no editor for yet.
 *
 * The menu, the room blocks, the wedding party and the FAQ are hard-coded in
 * `Ribbet App Structure.dc.html`, and there is no intake field and no Sheet tab
 * that feeds them — so these are the design's own values, kept in one place
 * rather than scattered through the screens. When a couple-side editor lands,
 * this file is what it replaces.
 *
 * The schedule used to live here and now doesn't: the console edits it, so it
 * moved to src/lib/schedule.ts and onto the wedding row. Around town and the DJ
 * list were never here either — those are real data, fed by the Sheet and by
 * guests.
 */

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
