/**
 * Slug and domain normalization for the intake's address picker.
 *
 * The rules come from `Ribbet Intake.dc.html`: lowercase, strip anything that
 * isn't a-z/0-9/hyphen, collapse runs, trim the ends. Minimum 4 characters for
 * a ribbet.app slug, 5 for a domain.
 */

export const MIN_SLUG_LENGTH = 4;
export const MIN_DOMAIN_LENGTH = 5;

/**
 * Reserved names the intake rejects before it even reaches the uniqueness check.
 * The `reserved_slugs` table exists for ones added later without a deploy; this
 * list is the floor, and includes the routes the app itself owns.
 */
export const RESERVED_SLUGS = new Set([
  "wedding",
  "love",
  "us",
  "thebigday",
  "setup",
  "api",
  "admin",
  "app",
  "ribbet",
  "login",
  "signin",
  "signup",
  "account",
  "console",
  "support",
  "help",
  "about",
  "privacy",
  "terms",
  "static",
  "public",
  "_next",
]);

/** Domains the design treats as already gone. */
export const RESERVED_DOMAINS = new Set(["wedding", "love", "us", "ourwedding"]);

export function cleanSlug(value: string): string {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Domains get the same treatment, minus hyphens — the design strips them. */
export function cleanDomain(value: string): string {
  return cleanSlug(value).replace(/-/g, "");
}

/** `amaraandcole` — what the slug field shows before the couple touches it. */
export function autoSlug(nameOne: string, nameTwo: string): string {
  return cleanSlug(`${nameOne}and${nameTwo}`) || "our-wedding";
}

/** The two-digit year pulled out of the free-text date field, defaulting to 26. */
export function yearSuffix(dateText: string): string {
  const match = String(dateText).match(/(20\d\d)/);
  return match ? match[1].slice(2) : "26";
}

export function slugSuggestions(nameOne: string, nameTwo: string, dateText: string): string[] {
  const a = cleanSlug(nameOne) || "you";
  const b = cleanSlug(nameTwo) || "them";
  return [`${a}and${b}`, `${a}${b}${yearSuffix(dateText)}`, `the${b}wedding`];
}

export function domainSuggestions(nameOne: string, nameTwo: string, dateText: string): string[] {
  const a = cleanSlug(nameOne) || "you";
  const b = cleanSlug(nameTwo) || "them";
  return [`${a}and${b}${yearSuffix(dateText)}`, `${a}${b}wedding`, `the${b}s`].map((v) =>
    v.replace(/-/g, ""),
  );
}

export function autoDomain(nameOne: string, nameTwo: string, dateText: string): string {
  const a = cleanSlug(nameOne) || "you";
  const b = cleanSlug(nameTwo) || "them";
  return `${a}and${b}${yearSuffix(dateText)}`.replace(/-/g, "");
}
