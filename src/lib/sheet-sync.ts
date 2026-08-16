import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { guestMeals, guests, households, places, rsvps, songRequests } from "@/db/schema";
import { sheetsFor } from "@/lib/google";
import type { WeddingRow } from "@/lib/wedding";

/**
 * App → Sheet, and the one flow that runs the other way (Things to do).
 *
 * The database is the source of truth; the Sheet is a mirror. Everything here is
 * therefore a rewrite-from-DB rather than an incremental patch — replying twice
 * updates the household's row instead of appending a second one, which is the
 * behaviour Test 8 checks.
 *
 * All of it runs on the couple's own token, so the protected ranges written at
 * provisioning don't get in the way: the owner is the only permitted editor.
 */

const TAB = {
  guests: "Guests & RSVP",
  caterer: "Caterer",
  dj: "DJ list",
  places: "Things to do",
} as const;

/**
 * What a synced cell may hold. Booleans land in checkbox-validated columns
 * (Caterer's Kid), numbers in count columns — writing real types is what keeps
 * the couple's Sheet looking like a spreadsheet instead of a text dump.
 */
type CellValue = string | number | boolean;

/** A1 range covering a whole tab's data area, quoted for the tab's spaces/&. */
function range(tab: string, span: string): string {
  return `'${tab.replace(/'/g, "''")}'!${span}`;
}

async function readColumn(
  sheetsApi: Awaited<ReturnType<typeof sheetsFor>>,
  spreadsheetId: string,
  tab: string,
  span: string,
): Promise<string[][]> {
  const res = await sheetsApi.spreadsheets.values.get({
    spreadsheetId,
    range: range(tab, span),
    majorDimension: "ROWS",
  });
  return (res.data.values ?? []) as string[][];
}

function formatDate(value: Date | null): string {
  if (!value) return "";
  return value.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/**
 * Rewrites the household's row in Guests & RSVP, plus that household's block of
 * the Caterer tab. Called after every reply.
 */
export async function pushHouseholdToSheet(wedding: WeddingRow, householdId: string): Promise<void> {
  if (!wedding.sheetId) return;

  const sheetsApi = await sheetsFor(wedding.ownerGoogleSub);

  const [household] = await db.select().from(households).where(eq(households.id, householdId)).limit(1);
  if (!household) return;

  const people = await db
    .select()
    .from(guests)
    .where(eq(guests.householdId, householdId))
    .orderBy(asc(guests.createdAt));

  const [reply] = await db.select().from(rsvps).where(eq(rsvps.householdId, householdId)).limit(1);

  const kids = people.filter((p) => p.isChild).length;
  const row: CellValue[] = [
    household.label,
    people.map((p) => p.name).join(", "),
    formatDate(household.inviteSentAt) || "app",
    formatDate(household.openedAt) || formatDate(new Date()),
    reply?.reply === "yes" ? "Coming" : reply?.reply === "no" ? "Declined" : "",
    reply?.attendingCount != null ? reply.attendingCount : "",
    kids || "—",
    reply?.note ?? "",
  ];

  await upsertByFirstColumn(sheetsApi, wedding.sheetId, TAB.guests, household.label, row, 8);
  await pushCaterer(sheetsApi, wedding, people);
}

/**
 * Finds the row whose first column matches `key` and overwrites it; appends when
 * there isn't one. This is what keeps a changed reply from duplicating.
 */
async function upsertByFirstColumn(
  sheetsApi: Awaited<ReturnType<typeof sheetsFor>>,
  spreadsheetId: string,
  tab: string,
  key: string,
  row: CellValue[],
  width: number,
  /** First row that holds data — 2 normally, 3 on the Caterer tab, whose row 2 is the pinned totals band. */
  firstDataRow = 2,
): Promise<void> {
  const existing = await readColumn(sheetsApi, spreadsheetId, tab, `A${firstDataRow}:A`);
  const index = existing.findIndex((r) => (r[0] ?? "").trim() === key.trim());

  const lastColumn = String.fromCharCode("A".charCodeAt(0) + width - 1);

  if (index >= 0) {
    const rowNumber = index + firstDataRow;
    await sheetsApi.spreadsheets.values.update({
      spreadsheetId,
      range: range(tab, `A${rowNumber}:${lastColumn}${rowNumber}`),
      valueInputOption: "RAW",
      requestBody: { values: [row] },
    });
    return;
  }

  await sheetsApi.spreadsheets.values.append({
    spreadsheetId,
    range: range(tab, `A${firstDataRow}:${lastColumn}`),
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });
}

/**
 * One row per guest on the Caterer tab — Guest, Table, Main, Dietary, Kid,
 * Kitchen note — plus the pinned totals band on row 2, recomputed from the
 * whole wedding so the caterer's first glance is always current.
 */
async function pushCaterer(
  sheetsApi: Awaited<ReturnType<typeof sheetsFor>>,
  wedding: WeddingRow,
  people: Array<typeof guests.$inferSelect>,
): Promise<void> {
  if (!wedding.sheetId) return;

  for (const person of people) {
    const [meal] = await db
      .select()
      .from(guestMeals)
      .where(eq(guestMeals.guestId, person.id))
      .limit(1);

    const row: CellValue[] = [
      person.name,
      person.tableNumber ?? "—",
      meal?.main ?? "—",
      (meal?.dietary ?? []).join(", ") || "—",
      person.isChild,
      meal?.kitchenNote ?? "",
    ];

    // Row 2 is the totals band, so data starts at 3.
    await upsertByFirstColumn(sheetsApi, wedding.sheetId, TAB.caterer, person.name, row, 6, 3);
  }

  await pushCatererTotals(sheetsApi, wedding);
}

/** The totals band: confirmed count, mains breakdown, dietary flags, kids. */
async function pushCatererTotals(
  sheetsApi: Awaited<ReturnType<typeof sheetsFor>>,
  wedding: WeddingRow,
): Promise<void> {
  if (!wedding.sheetId) return;

  const all = await db
    .select({
      isChild: guests.isChild,
      main: guestMeals.main,
      dietary: guestMeals.dietary,
      reply: rsvps.reply,
    })
    .from(guests)
    .innerJoin(households, eq(guests.householdId, households.id))
    .leftJoin(guestMeals, eq(guestMeals.guestId, guests.id))
    .leftJoin(rsvps, eq(rsvps.householdId, households.id))
    .where(eq(households.weddingId, wedding.id));

  const confirmed = all.filter((r) => r.reply === "yes");
  const kids = confirmed.filter((r) => r.isChild).length;
  const withFlags = confirmed.filter((r) => (r.dietary ?? []).length > 0).length;

  const mains = new Map<string, number>();
  for (const r of confirmed) {
    if (r.main) mains.set(r.main, (mains.get(r.main) ?? 0) + 1);
  }
  const breakdown = [...mains.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([main, n]) => `${main} ${n}`)
    .join(" · ");

  const totals: CellValue[] = [
    confirmed.length ? `${confirmed.length} confirmed` : "Awaiting replies",
    "",
    breakdown,
    withFlags ? `${withFlags} dietary` : "",
    kids ? `${kids} kids` : "",
    "",
  ];

  await sheetsApi.spreadsheets.values.update({
    spreadsheetId: wedding.sheetId,
    range: range(TAB.caterer, "A2:F2"),
    valueInputOption: "RAW",
    requestBody: { values: [totals] },
  });
}

/**
 * Rewrites the whole DJ list from the database.
 *
 * Duplicate songs roll up into a vote count app-side, not with a Sheet formula —
 * the implementation note in README is explicit about that.
 */
export async function pushSongsToSheet(wedding: WeddingRow): Promise<void> {
  if (!wedding.sheetId) return;

  const rows = await db
    .select({
      title: songRequests.title,
      artist: songRequests.artist,
      label: households.label,
    })
    .from(songRequests)
    .innerJoin(households, eq(households.id, songRequests.householdId))
    .where(eq(households.weddingId, wedding.id))
    .orderBy(asc(songRequests.createdAt));

  type Tally = { title: string; artist: string; votes: number; by: string[] };
  const byKey = new Map<string, Tally>();

  for (const r of rows) {
    const key = `${r.title.toLowerCase().trim()}|${(r.artist ?? "").toLowerCase().trim()}`;
    const found = byKey.get(key);
    if (found) {
      found.votes += 1;
      if (!found.by.includes(r.label)) found.by.push(r.label);
    } else {
      byKey.set(key, { title: r.title, artist: r.artist ?? "", votes: 1, by: [r.label] });
    }
  }

  const tallies = [...byKey.values()].sort((a, b) => b.votes - a.votes);
  const values: CellValue[][] = tallies.map((t) => [
    t.title,
    t.artist,
    t.votes,
    "",
    t.by.slice(0, 3).join(", ") + (t.by.length > 3 ? ` +${t.by.length - 3}` : ""),
  ]);

  const sheetsApi = await sheetsFor(wedding.ownerGoogleSub);

  // Clear then write, so a removed request doesn't linger as a phantom row.
  await sheetsApi.spreadsheets.values.clear({
    spreadsheetId: wedding.sheetId,
    range: range(TAB.dj, "A2:E"),
  });

  if (values.length) {
    await sheetsApi.spreadsheets.values.update({
      spreadsheetId: wedding.sheetId,
      range: range(TAB.dj, `A2:E${values.length + 1}`),
      valueInputOption: "RAW",
      requestBody: { values },
    });
  }
}

/**
 * Sheet → app: the couple types a spot into Things to do and it appears under
 * More ▸ Around town. Guarded by a short TTL so rendering the screen doesn't
 * spend a Sheets read every time.
 */
const placesSyncedAt = new Map<string, number>();
const PLACES_TTL_MS = 60_000;

export async function syncPlacesFromSheet(wedding: WeddingRow, force = false): Promise<void> {
  if (!wedding.sheetId) return;

  const last = placesSyncedAt.get(wedding.id) ?? 0;
  if (!force && Date.now() - last < PLACES_TTL_MS) return;
  placesSyncedAt.set(wedding.id, Date.now());

  const sheetsApi = await sheetsFor(wedding.ownerGoogleSub);
  const rows = await readColumn(sheetsApi, wedding.sheetId, TAB.places, "A2:E");

  const parsed = rows
    .map((r) => ({
      name: (r[0] ?? "").trim(),
      category: (r[1] ?? "").trim() || null,
      neighborhood: (r[2] ?? "").trim() || null,
      walk: (r[3] ?? "").trim() || null,
      blurb: (r[4] ?? "").trim() || null,
    }))
    // The design's own "+ Add a place" prompt row must never publish.
    .filter((p) => p.name && !p.name.startsWith("+") && !p.name.startsWith("—"));

  await db.delete(places).where(eq(places.weddingId, wedding.id));
  if (parsed.length) {
    await db.insert(places).values(parsed.map((p) => ({ ...p, weddingId: wedding.id })));
  }
}
