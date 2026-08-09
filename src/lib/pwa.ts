import type { WeddingRow } from "@/lib/wedding";

/**
 * Names for the installed app.
 *
 * Every wedding is a row, not a deployment, so the home-screen identity has to
 * be derived per slug: the couple's own names on the icon, their accent behind
 * it. Nothing here reads the database — callers pass the row they already have.
 */

type Named = Pick<WeddingRow, "nameOne" | "nameTwo">;

function names(wedding: Named): string[] {
  return [wedding.nameOne, wedding.nameTwo]
    .map((n) => n?.trim())
    .filter((n): n is string => Boolean(n));
}

/** The full app name — "Amara & Cole". Used for `name` and the iOS title. */
export function weddingAppName(wedding: Named): string {
  const both = names(wedding);
  if (both.length === 2) return `${both[0]} & ${both[1]}`;
  if (both.length === 1) return both[0];
  return "Our wedding";
}

/**
 * The label under the icon. Home screens truncate at roughly 12 characters on
 * iOS, so this degrades on purpose: both first names, then one, then the
 * monogram — rather than letting the OS cut a name in half.
 */
export function weddingShortName(wedding: Named, slug: string): string {
  const firsts = names(wedding).map((n) => n.split(/\s+/)[0]);
  if (!firsts.length) return "Wedding";

  const joined = firsts.join(" & ");
  if (joined.length <= 12) return joined;
  if (firsts[0].length <= 12) return firsts[0];
  return weddingMonogram(wedding, slug);
}

/**
 * The initials the icon is built from. Spread rather than `charAt` so an
 * accented or non-Latin first letter survives intact.
 */
export function weddingMonogram(wedding: Named, slug: string): string {
  const letters = names(wedding)
    .map((n) => [...n][0]?.toUpperCase())
    .filter(Boolean);

  if (letters.length) return letters.join("");

  // Before the couple has typed a name, fall back to the slug they chose.
  const fromSlug = [...slug.replace(/[^\p{L}\p{N}]/gu, "")][0];
  return (fromSlug ?? "R").toUpperCase();
}

/** The sizes `app-icon/[size]` will render. 180 is the iOS touch icon. */
export const ICON_SIZES = [180, 192, 512] as const;

/**
 * Great Vibes advance widths, in em, for the characters a first name can hold.
 *
 * The icon sets names in a script face inside a ring, so it has to know how
 * wide a name will be before it picks a size — and in this face that can't be
 * approximated by a character count: `H` is 1.395em and `i` is 0.176em, an
 * eightfold spread. Guessing an average puts "Marguerite" through the border.
 *
 * Measured from `assets/GreatVibes-Latin.ttf`. If that font is ever replaced,
 * regenerate with:
 *
 *   python3 -c "from fontTools.ttLib import TTFont; f=TTFont('assets/GreatVibes-Latin.ttf'); \
 *   u=f['head'].unitsPerEm; c=f.getBestCmap(); h=f['hmtx']; \
 *   print({chr(k):round(h[v][0]/u,3) for k,v in c.items() if chr(k).isalpha() or chr(k) in \" '-.&\"})"
 */
const SCRIPT_ADVANCES: Record<string, number> = {
  A: 0.716, B: 1.047, C: 0.714, D: 1.05, E: 0.819, F: 1.053, G: 0.702, H: 1.395, I: 0.917,
  J: 0.972, K: 1.203, L: 0.716, M: 1.336, N: 1.044, O: 0.73, P: 0.925, Q: 0.756, R: 1.028,
  S: 0.926, T: 0.933, U: 0.947, V: 0.98, W: 1.351, X: 0.791, Y: 0.963, Z: 0.681,
  a: 0.358, b: 0.327, c: 0.263, d: 0.372, e: 0.256, f: 0.194, g: 0.396, h: 0.336, i: 0.176,
  j: 0.178, k: 0.36, l: 0.213, m: 0.509, n: 0.338, o: 0.338, p: 0.336, q: 0.347, r: 0.259,
  s: 0.267, t: 0.201, u: 0.356, v: 0.309, w: 0.495, x: 0.334, y: 0.381, z: 0.343,
  " ": 0.171, "&": 0.61, "'": 0.106, "-": 0.404, ".": 0.205,
  // The few letters that aren't just an accented ASCII base.
  Æ: 1.38, æ: 0.438, Œ: 1.501, œ: 0.457, ß: 0.421, Ø: 0.73, ø: 0.339,
  Đ: 1.032, đ: 0.372, Þ: 0.613, þ: 0.319, Ł: 0.75, ł: 0.213,
};

/** Anything unmeasured — it should be rare, so err wide and let the ring win. */
const UNKNOWN_ADVANCE = 0.6;

/**
 * How wide `text` sets, in em.
 *
 * Accents are decomposed and dropped before lookup: in this face "é" is exactly
 * as wide as "e", so one ASCII table covers every Latin name without carrying
 * 250 entries.
 */
export function scriptWidthEm(text: string): number {
  let total = 0;
  for (const char of text) {
    const direct = SCRIPT_ADVANCES[char];
    if (direct !== undefined) {
      total += direct;
      continue;
    }
    const base = char.normalize("NFD").replace(/\p{M}+/gu, "");
    total += SCRIPT_ADVANCES[base] ?? UNKNOWN_ADVANCE;
  }
  return total;
}

/**
 * What the icon actually says: two first names stacked around an ampersand, or
 * — when they're too long to stay legible at 180px — their initials on one line.
 */
export type Inscription =
  | { kind: "stacked"; first: string; second: string }
  | { kind: "line"; text: string };

/** Below this, at 180px, the script is a squiggle rather than a name. */
const MIN_LEGIBLE_AT_180 = 26;

export function iconInscription(wedding: Named, slug: string): Inscription {
  const firsts = names(wedding).map((n) => n.split(/\s+/)[0]);

  if (firsts.length < 2) {
    return { kind: "line", text: firsts[0] ?? weddingMonogram(wedding, slug) };
  }

  const widest = Math.max(scriptWidthEm(firsts[0]), scriptWidthEm(firsts[1]));

  // Judged against the tightest box the set ships — the maskable safe zone at
  // 180px — so a name that survives here survives everywhere, and the whole set
  // says the same thing rather than names at 512 and initials on the phone.
  if (stackedFontSize(180, "maskable", widest) >= MIN_LEGIBLE_AT_180) {
    return { kind: "stacked", first: firsts[0], second: firsts[1] };
  }

  const initial = (name: string) => [...name][0]?.toUpperCase() ?? "";
  return { kind: "line", text: `${initial(firsts[0])} & ${initial(firsts[1])}` };
}

/** Icon geometry, shared by the renderer and the fallback decision above. */
export type IconPurpose = "any" | "maskable";

/**
 * Ring radius as a fraction of the icon.
 *
 * A maskable icon is cropped to whatever shape the launcher likes, and only the
 * middle 80% is guaranteed to survive — so that variant pulls everything in and
 * lets the accent bleed off the edges instead.
 */
export function ringRadius(size: number, purpose: IconPurpose): number {
  return size * (purpose === "maskable" ? 0.335 : 0.435);
}

/** The box the inscription has to fit inside the ring. */
export function inscriptionBox(size: number, purpose: IconPurpose): { width: number; height: number } {
  const diameter = ringRadius(size, purpose) * 2;
  return { width: diameter * 0.84, height: diameter * 0.8 };
}

/**
 * Great Vibes puts 0.851em above the baseline and 0.401em below it, so a line
 * of it occupies far more than its font size — measured from the same file the
 * widths come from. Sizing to `1em` per line would hang the swash on "Gregory"
 * over the border.
 */
const LINE_INK_EM = 1.252;

/** Stacked name / ampersand / name, as a multiple of the name font size. */
const STACK_HEIGHT_EM = 2.58;

export function stackedFontSize(size: number, purpose: IconPurpose, widestNameEm: number): number {
  const box = inscriptionBox(size, purpose);
  return Math.min(box.width / widestNameEm, box.height / STACK_HEIGHT_EM);
}

export function lineFontSize(size: number, purpose: IconPurpose, textEm: number): number {
  const box = inscriptionBox(size, purpose);
  return Math.min(box.width / textEm, box.height / LINE_INK_EM);
}
