/**
 * The intake's date field is free text ("Saturday, October 10, 2026") but the
 * wedding row stores a real timestamp. These two functions are the round trip,
 * so a reload shows the couple the same string they typed.
 */

/** "Saturday, October 10, 2026" → UTC midnight, or null if it isn't a date. */
export function parseDateText(text: string): Date | null {
  const stripped = String(text).replace(/^\s*[A-Za-z]+,\s*/, "").trim();
  if (!stripped) return null;
  const parsed = new Date(stripped);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
}

export function formatDateText(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Whole days from today to the wedding, floored at 0. Used by the preview. */
export function daysUntil(date: Date): number {
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = date.getTime() - todayUtc;
  return Math.max(0, Math.round(diff / 86_400_000));
}
