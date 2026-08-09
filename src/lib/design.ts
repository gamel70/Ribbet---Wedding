import type { Layout, Palette, SectionKey, Sections } from "@/db/schema";

/**
 * Design tokens lifted verbatim from `Ribbet Intake.dc.html` and the
 * "Design Tokens" section of README.md. Values here are final — the design is
 * marked high-fidelity, so treat a change to a hex or a px as a design change,
 * not a code change.
 *
 * Safe to import from both server and client code: no runtime dependencies.
 */

export type LayoutDef = {
  key: Layout;
  name: string;
  desc: string;
  bg: string;
  panel: string;
  line: string;
  ink: string;
  mut: string;
  serif: string;
  rad: string;
};

export const LAYOUTS: Record<Layout, LayoutDef> = {
  botanical: {
    key: "botanical",
    name: "Botanical",
    desc: "Deep green, brass rules, editorial serif. Best for evening and outdoors.",
    bg: "#243528",
    panel: "#2d4234",
    line: "#3d5142",
    ink: "#e9e2d4",
    mut: "#9aa793",
    serif: "var(--font-fraunces), serif",
    rad: "0px",
  },
  classic: {
    key: "classic",
    name: "Classic",
    desc: "Cream, hairlines, engraved-invitation restraint. Formal without being stiff.",
    bg: "#f6f3ee",
    panel: "#ffffff",
    line: "#e0d8c8",
    ink: "#2a2622",
    mut: "#8a8378",
    serif: "var(--font-cormorant), Georgia, serif",
    rad: "0px",
  },
  romantic: {
    key: "romantic",
    name: "Romantic",
    desc: "Soft cards, rounded corners, warm light. Reads friendly on a phone.",
    bg: "#fdf7f4",
    panel: "#ffffff",
    line: "#f0dcd2",
    ink: "#4a3a34",
    mut: "#a8938a",
    serif: "var(--font-libre-caslon), Georgia, serif",
    rad: "14px",
  },
};

/** Display order of the layout cards on step 4. */
export const LAYOUT_ORDER: Layout[] = ["botanical", "classic", "romantic"];

export type PaletteDef = { key: Palette; name: string; c1: string; c2: string; c3: string };

export const PALETTES: PaletteDef[] = [
  { key: "brass", name: "Brass", c1: "#b98d4f", c2: "#e9e2d4", c3: "#3d5142" },
  { key: "terracotta", name: "Terracotta", c1: "#c26d5a", c2: "#f3d9cf", c3: "#8a5346" },
  { key: "sage", name: "Sage", c1: "#7d9a6f", c2: "#e4ebdd", c3: "#4c6244" },
  { key: "ink", name: "Ink", c1: "#2f4a7c", c2: "#dfe6f2", c3: "#1b2c4d" },
  { key: "plum", name: "Plum", c1: "#8d6fb9", c2: "#e8dff5", c3: "#5b4479" },
  { key: "rust", name: "Rust", c1: "#b4552f", c2: "#f2dcd0", c3: "#7a3819" },
];

/** The eight "nudge the accent" squares. */
export const ACCENTS = [
  "#b98d4f",
  "#c26d5a",
  "#7d9a6f",
  "#2f4a7c",
  "#8d6fb9",
  "#b4552f",
  "#3d5142",
  "#8a5346",
];

export type SectionDef = { key: SectionKey; label: string; sub: string; locked: boolean };

/** All 12 sections, in the order the design's 2-column grid shows them. */
export const SECTION_DEFS: SectionDef[] = [
  { key: "home", label: "Home", sub: "Countdown, your note, what they still owe you", locked: true },
  { key: "rsvp", label: "RSVP", sub: "Household reply, meals, dietary, plus-ones", locked: true },
  { key: "day", label: "The Day", sub: "Live schedule and their table", locked: true },
  { key: "photos", label: "Photos", sub: "Guest uploads → your private Drive vault", locked: false },
  { key: "gifts", label: "Gifts", sub: "Registry and fund; they pledge, pay by Venmo/Zelle", locked: false },
  { key: "travel", label: "Travel & stay", sub: "Hotel blocks, shuttle times, map", locked: false },
  { key: "menu", label: "Menu", sub: "Dinner and bar, with their pick highlighted", locked: false },
  { key: "guestbook", label: "Guestbook", sub: "Notes wall; you can remove any", locked: false },
  { key: "songs", label: "Songs", sub: "One request each → your DJ tab", locked: false },
  { key: "around", label: "Around town", sub: "Your list of local spots, written by you", locked: false },
  { key: "party", label: "Wedding party", sub: "Who's who, with photos", locked: false },
  { key: "faq", label: "FAQ", sub: "Dress code, kids, parking", locked: false },
];

/** "Defaults are 11 of 12 sections on and the Botanical layout in brass." */
export const DEFAULT_SECTIONS: Sections = {
  home: true,
  rsvp: true,
  day: true,
  photos: true,
  gifts: true,
  travel: true,
  menu: true,
  guestbook: true,
  songs: true,
  around: true,
  party: false,
  faq: true,
};

/**
 * Normalizes whatever is stored on the wedding row into a complete section map,
 * forcing the three locked sections on. The UI does this too, but the server is
 * the one that counts — see the note under the data model sketch in README.md.
 */
export function resolveSections(stored: Partial<Sections> | null | undefined): Sections {
  const out = { ...DEFAULT_SECTIONS };
  for (const def of SECTION_DEFS) {
    const value = stored?.[def.key];
    if (typeof value === "boolean") out[def.key] = value;
    if (def.locked) out[def.key] = true;
  }
  return out;
}

/**
 * Accent text colour, per README: luminance 0.299R + 0.587G + 0.114B, below 150
 * gets white text, otherwise the deep botanical ink.
 */
export function accentInk(accent: string): string {
  const hex = accent.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const lum = r * 0.299 + g * 0.587 + b * 0.114;
  return lum < 150 ? "#ffffff" : "#243528";
}

/** The accent actually in force: the couple's override, else the palette's own. */
export function resolveAccent(palette: Palette, accent: string | null | undefined): string {
  if (accent) return accent;
  return (PALETTES.find((p) => p.key === palette) ?? PALETTES[0]).c1;
}

/**
 * Which Sheet tabs the current section picks produce. Guests & RSVP and Caterer
 * are always created; the other three follow their section toggle. Kept here so
 * the intake's "Tabs right now:" line and the provisioning job can never drift.
 */
export function sheetTabsFor(sections: Sections): string[] {
  const tabs = ["Guests & RSVP", "Caterer"];
  if (sections.songs) tabs.push("DJ list");
  if (sections.gifts) tabs.push("Gifts & thank-yous");
  if (sections.around) tabs.push("Things to do");
  return tabs;
}

/**
 * Drive storage estimate for the intake meter: ~22 photos per guest at ~4.2MB,
 * against Google's free 15GB. Nothing is ever compressed, so this is the honest
 * number — see "Storage" in README.md.
 */
export const PHOTOS_PER_GUEST = 22;
export const MB_PER_PHOTO = 4.2;
export const FREE_TIER_GB = 15;

export function storageEstimateGb(guestCount: number): number {
  return (guestCount * PHOTOS_PER_GUEST * MB_PER_PHOTO) / 1024;
}
