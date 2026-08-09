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
