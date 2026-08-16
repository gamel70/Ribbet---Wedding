import { eq } from "drizzle-orm";
import type { sheets_v4 } from "googleapis";

import { db } from "@/db";
import { users, weddings } from "@/db/schema";
import { resolveSections } from "@/lib/design";
import { driveFor, sheetsFor } from "@/lib/google";
import type { WeddingRow } from "@/lib/wedding";

/**
 * The provisioning job from README.md — "what happens when the couple presses
 * Build it".
 *
 * One idempotent job keyed by wedding id. Each step records completion in
 * `provisioning_step` before the next begins, so a retry resumes instead of
 * creating a second folder or a second spreadsheet. Steps 6 (domain
 * registration) and 5 (partner as editor) are deliberately not run here — see
 * the notes at each step.
 */

export const PROVISION_STEPS = {
  NOTHING: 0,
  FOLDER_CREATED: 1,
  SHEET_CREATED: 2,
  SHEET_FORMATTED: 3,
  SHEET_FILED: 4,
  DONE: 5,
} as const;

/** #rrggbb → the 0-1 float triple the Sheets API wants. */
function hexToRgb(hex: string): sheets_v4.Schema$Color {
  const h = hex.replace("#", "");
  return {
    red: parseInt(h.slice(0, 2), 16) / 255,
    green: parseInt(h.slice(2, 4), 16) / 255,
    blue: parseInt(h.slice(4, 6), 16) / 255,
  };
}

type TabSpec = {
  title: string;
  tabColor?: string;
  /** Exact column names from "The Google Sheet" section of README.md. */
  headers: string[];
  /** Grid ratios from the design file, scaled to pixels. */
  ratios: number[];
  /**
   * Columns the couple (or a vendor) may type in. Everything else gets a
   * protected range. `"all"` leaves the whole tab open — only Things to do.
   */
  editable: number[] | "all";
  /** Cell note dropped on A1. */
  a1Note?: string;
  /** Columns rendered as real checkboxes (BOOLEAN validation), not TRUE/FALSE text. */
  checkboxes?: number[];
  /** Columns that wrap long text instead of spilling into the neighbour. */
  wrap?: number[];
  /** Short columns that read better centered. */
  center?: number[];
  /** Columns shown as whole dollars. */
  currency?: number[];
  /**
   * Seeds a pinned summary band on row 2 — the Caterer's totals row from the
   * design. The sync job rewrites it as replies land; data rows start at 3.
   */
  totalsSeed?: string[];
};

const COLUMN_WIDTH_UNIT = 130;

/**
 * Only tabs for sections the couple switched on. Guests & RSVP and Caterer are
 * always created; DJ list, Gifts and Things to do follow `songs`, `gifts` and
 * `around`.
 */
function tabSpecsFor(sections: ReturnType<typeof resolveSections>): TabSpec[] {
  const specs: TabSpec[] = [
    {
      title: "Guests & RSVP",
      headers: ["Household", "Guests", "Invite sent", "Opened", "Reply", "Attending", "Kids", "Note to couple"],
      ratios: [1.6, 1.2, 0.9, 0.8, 0.9, 1, 0.8, 1.4],
      editable: [],
      wrap: [1, 7],
      center: [5, 6],
    },
    {
      title: "Caterer",
      tabColor: "#0f9d58",
      headers: ["Guest", "Table", "Main", "Dietary", "Kid", "Kitchen note"],
      ratios: [1.5, 1.2, 1.1, 1.4, 0.7, 1.5],
      editable: [],
      checkboxes: [4],
      wrap: [3, 5],
      center: [1],
      totalsSeed: ["Awaiting replies", "", "", "", "", ""],
    },
  ];

  if (sections.songs) {
    specs.push({
      title: "DJ list",
      tabColor: "#7a4a86",
      headers: ["Song", "Artist", "Votes", "Slot", "Requested by"],
      ratios: [1.5, 1.4, 0.7, 1.1, 1.4],
      editable: [],
      center: [2],
    });
  }

  if (sections.gifts) {
    specs.push({
      title: "Gifts & thank-yous",
      tabColor: "#b98d4f",
      headers: ["From", "Gift", "Amount", "Paid", "Address", "Card sent", "Sent on"],
      ratios: [1.4, 1.5, 0.8, 0.7, 1.6, 0.9, 1],
      // Paid, Card sent and Sent on are the two-way columns — ticking in the
      // Sheet has to work, so they stay unprotected.
      editable: [3, 5, 6],
      checkboxes: [3, 5],
      wrap: [4],
      currency: [2],
    });
  }

  if (sections.around) {
    specs.push({
      title: "Things to do",
      tabColor: "#c26d5a",
      headers: ["Place", "Category", "Neighborhood", "Walk", "Why we love it"],
      ratios: [1.5, 1, 1.1, 0.9, 2],
      editable: "all",
      a1Note: "Type a place in the next row and it appears in your guests' app.",
      wrap: [4],
    });
  }

  return specs;
}

export function vaultFolderName(wedding: WeddingRow): string {
  return `${wedding.nameOne ?? "Our"} & ${wedding.nameTwo ?? "Wedding"} — Photos`;
}

export function masterSheetName(wedding: WeddingRow): string {
  return `${wedding.nameOne ?? "Our"} & ${wedding.nameTwo ?? "Wedding"} — Wedding Master`;
}

export type ProvisionResult = {
  driveFolderId: string;
  sheetId: string;
  folderName: string;
  sheetName: string;
  tabs: string[];
  sheetUrl: string;
  folderUrl: string;
};

/**
 * Runs — or resumes — provisioning for one wedding. Safe to call twice: a
 * completed wedding returns its existing ids without touching Google.
 */
export async function provisionWedding(weddingId: string): Promise<ProvisionResult> {
  const [wedding] = await db.select().from(weddings).where(eq(weddings.id, weddingId)).limit(1);
  if (!wedding) throw new Error(`No wedding ${weddingId}`);

  const googleSub = wedding.ownerGoogleSub;
  const sections = resolveSections(wedding.sections);
  const specs = tabSpecsFor(sections);
  const folderName = vaultFolderName(wedding);
  const sheetName = masterSheetName(wedding);

  let step = wedding.provisioningStep;
  let folderId = wedding.driveFolderId;
  let sheetId = wedding.sheetId;
  /** Tab ids from the create call, so the common path skips a follow-up get. */
  let tabIds: Map<string, number> | null = null;

  const fail = async (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    await db
      .update(weddings)
      .set({ provisioningError: message, updatedAt: new Date() })
      .where(eq(weddings.id, weddingId));
    throw error;
  };

  try {
    const drive = await driveFor(googleSub);
    const sheets = await sheetsFor(googleSub);

    // 1. The vault folder. Every guest photo lands here, full resolution.
    if (step < PROVISION_STEPS.FOLDER_CREATED || !folderId) {
      const folder = await drive.files.create({
        requestBody: { name: folderName, mimeType: "application/vnd.google-apps.folder" },
        fields: "id",
      });
      folderId = folder.data.id!;
      step = PROVISION_STEPS.FOLDER_CREATED;
      await db
        .update(weddings)
        .set({ driveFolderId: folderId, provisioningStep: step, updatedAt: new Date() })
        .where(eq(weddings.id, weddingId));
    }

    // 2. The spreadsheet, tabs declared up front so there is never a stray
    //    "Sheet1" left behind.
    if (step < PROVISION_STEPS.SHEET_CREATED || !sheetId) {
      const created = await sheets.spreadsheets.create({
        requestBody: {
          properties: { title: sheetName },
          sheets: specs.map((spec) => ({
            properties: {
              title: spec.title,
              gridProperties: { frozenRowCount: 1 },
              ...(spec.tabColor ? { tabColor: hexToRgb(spec.tabColor) } : {}),
            },
          })),
        },
        fields: "spreadsheetId,sheets(properties(sheetId,title))",
      });
      sheetId = created.data.spreadsheetId!;
      tabIds = indexTabs(created.data.sheets);
      step = PROVISION_STEPS.SHEET_CREATED;
      await db
        .update(weddings)
        .set({ sheetId, provisioningStep: step, updatedAt: new Date() })
        .where(eq(weddings.id, weddingId));
    }

    // 3. One batchUpdate carrying every formatting request together.
    if (step < PROVISION_STEPS.SHEET_FORMATTED) {
      // Only re-read the workbook when resuming a job that created it earlier.
      const idByTitle =
        tabIds ??
        indexTabs(
          (
            await sheets.spreadsheets.get({
              spreadsheetId: sheetId,
              fields: "sheets(properties(sheetId,title))",
            })
          ).data.sheets,
        );

      const ownerEmail = await ownerEmailFor(googleSub);
      const requests: sheets_v4.Schema$Request[] = [];

      for (const spec of specs) {
        const tabId = idByTitle.get(spec.title);
        if (tabId == null) continue;

        // Rows 1..dataStart are pinned chrome; data begins underneath. Only the
        // Caterer carries a second pinned row (its totals band).
        const dataStart = spec.totalsSeed ? 2 : 1;

        // Header row. The A1 note rides along on the first cell where one exists.
        requests.push({
          updateCells: {
            range: {
              sheetId: tabId,
              startRowIndex: 0,
              endRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: spec.headers.length,
            },
            fields: "userEnteredValue,note",
            rows: [
              {
                values: spec.headers.map((header, i) => ({
                  userEnteredValue: { stringValue: header },
                  ...(i === 0 && spec.a1Note ? { note: spec.a1Note } : {}),
                })),
              },
            ],
          },
        });

        // Header style: bold 11px, #f1f3f4 ground, #5f6368 text.
        requests.push({
          repeatCell: {
            range: { sheetId: tabId, startRowIndex: 0, endRowIndex: 1 },
            cell: {
              userEnteredFormat: {
                backgroundColor: hexToRgb("#f1f3f4"),
                textFormat: {
                  bold: true,
                  fontSize: 11,
                  foregroundColor: hexToRgb("#5f6368"),
                },
                verticalAlignment: "MIDDLE",
              },
            },
            fields: "userEnteredFormat(backgroundColor,textFormat,verticalAlignment)",
          },
        });

        // The totals band — "a totals row pinned at the top" of the Caterer tab.
        // Seeded here; the sync job rewrites it as replies land.
        if (spec.totalsSeed) {
          requests.push({
            updateCells: {
              range: {
                sheetId: tabId,
                startRowIndex: 1,
                endRowIndex: 2,
                startColumnIndex: 0,
                endColumnIndex: spec.headers.length,
              },
              fields: "userEnteredValue",
              rows: [
                {
                  values: spec.totalsSeed.map((v) => ({ userEnteredValue: { stringValue: v } })),
                },
              ],
            },
          });
          requests.push({
            repeatCell: {
              range: { sheetId: tabId, startRowIndex: 1, endRowIndex: 2 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: hexToRgb("#faf6ee"),
                  textFormat: { bold: true, fontSize: 10 },
                  verticalAlignment: "MIDDLE",
                },
              },
              fields: "userEnteredFormat(backgroundColor,textFormat,verticalAlignment)",
            },
          });
        }

        // Freeze the pinned rows and cut the grid off at the last real column —
        // a tab that ends where its data ends reads cleaner than 20 gray spares.
        requests.push({
          updateSheetProperties: {
            properties: {
              sheetId: tabId,
              gridProperties: { frozenRowCount: dataStart, columnCount: spec.headers.length },
            },
            fields: "gridProperties(frozenRowCount,columnCount)",
          },
        });

        // Soft banding under the pinned rows, so a vendor can scan a long list.
        requests.push({
          addBanding: {
            bandedRange: {
              range: {
                sheetId: tabId,
                startRowIndex: dataStart,
                startColumnIndex: 0,
                endColumnIndex: spec.headers.length,
              },
              rowProperties: {
                firstBandColor: hexToRgb("#ffffff"),
                secondBandColor: hexToRgb("#f7f8f9"),
              },
            },
          },
        });

        // Real checkboxes, not TRUE/FALSE text — Paid, Card sent, Kid.
        for (const col of spec.checkboxes ?? []) {
          requests.push({
            setDataValidation: {
              range: { sheetId: tabId, startRowIndex: dataStart, startColumnIndex: col, endColumnIndex: col + 1 },
              rule: { condition: { type: "BOOLEAN" }, showCustomUi: true },
            },
          });
        }

        // Whole dollars on Amount; nobody thanks you for cents.
        for (const col of spec.currency ?? []) {
          requests.push({
            repeatCell: {
              range: { sheetId: tabId, startRowIndex: dataStart, startColumnIndex: col, endColumnIndex: col + 1 },
              cell: { userEnteredFormat: { numberFormat: { type: "CURRENCY", pattern: "$#,##0" } } },
              fields: "userEnteredFormat.numberFormat",
            },
          });
        }

        // Long text wraps in place; short counts sit centered under their header.
        for (const col of spec.wrap ?? []) {
          requests.push({
            repeatCell: {
              range: { sheetId: tabId, startRowIndex: dataStart, startColumnIndex: col, endColumnIndex: col + 1 },
              cell: { userEnteredFormat: { wrapStrategy: "WRAP", verticalAlignment: "TOP" } },
              fields: "userEnteredFormat(wrapStrategy,verticalAlignment)",
            },
          });
        }
        for (const col of spec.center ?? []) {
          requests.push({
            repeatCell: {
              range: { sheetId: tabId, startRowIndex: dataStart, startColumnIndex: col, endColumnIndex: col + 1 },
              cell: { userEnteredFormat: { horizontalAlignment: "CENTER" } },
              fields: "userEnteredFormat.horizontalAlignment",
            },
          });
        }

        // Column widths matching the design's grid ratios.
        spec.ratios.forEach((ratio, i) => {
          requests.push({
            updateDimensionProperties: {
              range: { sheetId: tabId, dimension: "COLUMNS", startIndex: i, endIndex: i + 1 },
              properties: { pixelSize: Math.round(ratio * COLUMN_WIDTH_UNIT) },
              fields: "pixelSize",
            },
          });
        });

        // A protected range over every Ribbet-written column, so a vendor with
        // edit access can't corrupt the source. Things to do is skipped whole.
        if (spec.editable !== "all") {
          const editable = new Set(spec.editable);
          for (const [start, end] of contiguousRuns(spec.headers.length, editable)) {
            requests.push({
              addProtectedRange: {
                protectedRange: {
                  range: {
                    sheetId: tabId,
                    startRowIndex: 0,
                    startColumnIndex: start,
                    endColumnIndex: end,
                  },
                  description: "Auto-filled by Ribbet — don't edit",
                  warningOnly: false,
                  requestingUserCanEdit: true,
                  editors: ownerEmail
                    ? { users: [ownerEmail], domainUsersCanEdit: false }
                    : undefined,
                },
              },
            });
          }
        }
      }

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: { requests },
      });

      step = PROVISION_STEPS.SHEET_FORMATTED;
      await db
        .update(weddings)
        .set({ provisioningStep: step, updatedAt: new Date() })
        .where(eq(weddings.id, weddingId));
    }

    // 4. File the Sheet into the folder so both live together in Drive.
    if (step < PROVISION_STEPS.SHEET_FILED) {
      const current = await drive.files.get({ fileId: sheetId, fields: "parents" });
      const previousParents = (current.data.parents ?? []).join(",");
      await drive.files.update({
        fileId: sheetId,
        addParents: folderId!,
        ...(previousParents ? { removeParents: previousParents } : {}),
        fields: "id,parents",
      });

      step = PROVISION_STEPS.SHEET_FILED;
      await db
        .update(weddings)
        .set({ provisioningStep: step, updatedAt: new Date() })
        .where(eq(weddings.id, weddingId));
    }

    // Step 5 (partner as a second editor) waits on a partner email, which the
    // intake doesn't collect — step 1 tells the couple Cole is added later.
    // Step 6 (domain registration) belongs at checkout, not here.

    // 7. Commit. Their link is live.
    if (step < PROVISION_STEPS.DONE) {
      step = PROVISION_STEPS.DONE;
      await db
        .update(weddings)
        .set({
          provisioningStep: step,
          provisioningError: null,
          publishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(weddings.id, weddingId));
    }

    return {
      driveFolderId: folderId!,
      sheetId: sheetId!,
      folderName,
      sheetName,
      tabs: specs.map((s) => s.title),
      sheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId}/edit`,
      folderUrl: `https://drive.google.com/drive/folders/${folderId}`,
    };
  } catch (error) {
    await fail(error);
    throw error;
  }
}

function indexTabs(sheets: sheets_v4.Schema$Sheet[] | undefined): Map<string, number> {
  const byTitle = new Map<string, number>();
  for (const s of sheets ?? []) {
    if (s.properties?.title != null && s.properties.sheetId != null) {
      byTitle.set(s.properties.title, s.properties.sheetId);
    }
  }
  return byTitle;
}

async function ownerEmailFor(googleSub: string): Promise<string | null> {
  const [row] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.googleSub, googleSub))
    .limit(1);
  return row?.email ?? null;
}

/**
 * Turns "every column except these" into the fewest contiguous [start, end)
 * ranges, so a seven-column tab costs two protected ranges rather than five.
 */
function contiguousRuns(length: number, skip: Set<number>): Array<[number, number]> {
  const runs: Array<[number, number]> = [];
  let start: number | null = null;

  for (let i = 0; i < length; i++) {
    if (skip.has(i)) {
      if (start !== null) runs.push([start, i]);
      start = null;
    } else if (start === null) {
      start = i;
    }
  }
  if (start !== null) runs.push([start, length]);

  return runs;
}
