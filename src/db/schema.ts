import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Schema for Ribbet, per the "Data model sketch" in README.md.
 *
 * The database is the source of truth. The couple's Google Sheet is a mirror
 * written by the debounced sync job — never read it as authoritative except
 * for the two two-way columns (thank-you `sent`, gift `paid`).
 */

/** The 12 section keys the intake wizard toggles. `home`, `rsvp` and `day` are locked on. */
export const SECTION_KEYS = [
  "home",
  "rsvp",
  "day",
  "photos",
  "gifts",
  "travel",
  "menu",
  "guestbook",
  "songs",
  "party",
  "faq",
  "around",
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];
export type Sections = Record<SectionKey, boolean>;

/** Sections the server forces on regardless of what the client sends. */
export const LOCKED_SECTIONS: SectionKey[] = ["home", "rsvp", "day"];

export type Layout = "botanical" | "classic" | "romantic";
export type Palette = "brass" | "terracotta" | "sage" | "ink" | "plum" | "rust";

/**
 * Per-section overrides from the couple console: a renamed label and a position.
 * Absent keys fall back to the design's own label and order, so an untouched
 * wedding behaves exactly as it did before the console existed.
 */
export type SectionMeta = { label?: string; order?: number };
export type SectionMetaMap = Partial<Record<SectionKey, SectionMeta>>;

/** One row of The Day. `time` is 24-hour "HH:MM"; the app renders it 12-hour. */
export type ScheduleEntry = { time: string; title: string; detail: string };

/**
 * The couple's Google identity and their encrypted refresh token.
 *
 * `refreshTokenEncrypted` is AES-256-GCM ciphertext produced by src/lib/crypto.ts.
 * Nothing outside that module should ever hold the plaintext beyond the life of
 * a single request. Access tokens are deliberately NOT stored — they die hourly
 * and are re-minted from the refresh token before every Google write.
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    googleSub: text("google_sub").notNull(),
    email: text("email").notNull(),
    name: text("name"),
    image: text("image"),
    refreshTokenEncrypted: text("refresh_token_encrypted"),
    refreshTokenUpdatedAt: timestamp("refresh_token_updated_at", { withTimezone: true }),
    /** Space-separated scopes Google actually granted, so a widened scope is auditable. */
    scope: text("scope"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("users_google_sub_idx").on(t.googleSub),
    uniqueIndex("users_email_idx").on(t.email),
  ],
);

export const weddings = pgTable(
  "weddings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    ownerGoogleSub: text("owner_google_sub").notNull(),
    nameOne: text("name_one"),
    nameTwo: text("name_two"),
    date: timestamp("date", { withTimezone: true }),
    venue: text("venue"),
    guestEstimate: integer("guest_estimate"),
    layout: text("layout").$type<Layout>().notNull().default("classic"),
    palette: text("palette").$type<Palette>().notNull().default("brass"),
    /** null = use the palette's own accent. */
    accent: text("accent"),
    sections: jsonb("sections").$type<Partial<Sections>>().notNull().default({}),
    /** Console overrides for section names and running order. */
    sectionMeta: jsonb("section_meta").$type<SectionMetaMap>().notNull().default({}),
    /** The Day, editable in the console. Empty means "use the default running order". */
    schedule: jsonb("schedule").$type<ScheduleEntry[]>().notNull().default([]),
    partnerEmail: text("partner_email"),
    customDomain: text("custom_domain"),

    // Provisioning state. Each step records completion so a retry resumes
    // rather than duplicates — see "Failure handling" in README.md.
    driveFolderId: text("drive_folder_id"),
    sheetId: text("sheet_id"),
    provisioningStep: integer("provisioning_step").notNull().default(0),
    provisioningError: text("provisioning_error"),
    publishedAt: timestamp("published_at", { withTimezone: true }),

    /** Which intake step the couple reached, so a refresh doesn't lose progress. */
    intakeStep: integer("intake_step").notNull().default(1),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("weddings_slug_idx").on(t.slug),
    uniqueIndex("weddings_custom_domain_idx").on(t.customDomain),
    index("weddings_owner_idx").on(t.ownerGoogleSub),
  ],
);

export const households = pgTable(
  "households",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    weddingId: uuid("wedding_id")
      .notNull()
      .references(() => weddings.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    phone: text("phone"),
    /**
     * The household's private link. `/i/<token>` hands this browser the
     * household's session — it is the thing the couple texts, so it is the only
     * credential in the guest app and must stay unguessable.
     */
    inviteToken: text("invite_token").notNull(),
    inviteSentAt: timestamp("invite_sent_at", { withTimezone: true }),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("households_wedding_idx").on(t.weddingId),
    uniqueIndex("households_invite_token_idx").on(t.inviteToken),
  ],
);

/**
 * The couple's RSVP feed: who claimed which household, who replied, and what
 * they changed when they came back. A reply that quietly flips from Coming to
 * Declined the week before is exactly the thing a couple needs to see.
 */
export const rsvpEvents = pgTable(
  "rsvp_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    weddingId: uuid("wedding_id")
      .notNull()
      .references(() => weddings.id, { onDelete: "cascade" }),
    householdId: uuid("household_id").references(() => households.id, { onDelete: "set null" }),
    /** claimed · invited · submitted · changed · requested · approved · declined */
    kind: text("kind").notNull(),
    /** Human-readable, already formatted for the console feed. */
    summary: text("summary").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("rsvp_events_wedding_idx").on(t.weddingId)],
);

/**
 * Someone who couldn't find their name asking to be added. Lands in the
 * console's approve queue; approving mints a household and an invite link.
 */
export const guestRequests = pgTable(
  "guest_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    weddingId: uuid("wedding_id")
      .notNull()
      .references(() => weddings.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    note: text("note"),
    /** pending · approved · declined */
    status: text("status").notNull().default("pending"),
    householdId: uuid("household_id").references(() => households.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [index("guest_requests_wedding_idx").on(t.weddingId)],
);

export const guests = pgTable(
  "guests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isChild: boolean("is_child").notNull().default(false),
    /** Set when this guest is someone else's plus-one. */
    plusOneOf: uuid("plus_one_of"),
    tableNumber: text("table_number"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("guests_household_idx").on(t.householdId)],
);

/** One reply per household — the RSVP screen is household-level by design. */
export const rsvps = pgTable("rsvps", {
  householdId: uuid("household_id")
    .primaryKey()
    .references(() => households.id, { onDelete: "cascade" }),
  reply: text("reply").$type<"yes" | "no" | null>(),
  attendingCount: integer("attending_count"),
  note: text("note"),
  shuttle: boolean("shuttle").notNull().default(false),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
});

export const guestMeals = pgTable("guest_meals", {
  guestId: uuid("guest_id")
    .primaryKey()
    .references(() => guests.id, { onDelete: "cascade" }),
  main: text("main"),
  dietary: text("dietary").array(),
  kitchenNote: text("kitchen_note"),
});

export const pledges = pgTable(
  "pledges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    item: text("item").notNull(),
    amountCents: integer("amount_cents"),
    /** Two-way with the Sheet's Gifts tab. */
    paid: boolean("paid").notNull().default(false),
    address: text("address"),
    /** Two-way with the Sheet's thank-you `Sent` column. */
    thanked: boolean("thanked").notNull().default(false),
    thankedAt: timestamp("thanked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("pledges_household_idx").on(t.householdId)],
);

export const songRequests = pgTable(
  "song_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    artist: text("artist"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("song_requests_household_idx").on(t.householdId)],
);

/** Fed by the couple typing into the Sheet's "Things to do" tab; renders screen 11. */
export const places = pgTable(
  "places",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    weddingId: uuid("wedding_id")
      .notNull()
      .references(() => weddings.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: text("category"),
    neighborhood: text("neighborhood"),
    walk: text("walk"),
    blurb: text("blurb"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("places_wedding_idx").on(t.weddingId)],
);

/**
 * Ids and metadata only — never image bytes. Originals live in the couple's
 * Drive, full resolution, uncompressed. `householdId` is what enforces
 * "guests see only their own uploads" server-side.
 */
export const photos = pgTable(
  "photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    weddingId: uuid("wedding_id")
      .notNull()
      .references(() => weddings.id, { onDelete: "cascade" }),
    householdId: uuid("household_id").references(() => households.id, { onDelete: "set null" }),
    driveFileId: text("drive_file_id").notNull(),
    takenAt: timestamp("taken_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("photos_drive_file_idx").on(t.driveFileId),
    index("photos_wedding_idx").on(t.weddingId),
    index("photos_household_idx").on(t.householdId),
  ],
);

/**
 * The guestbook wall. Post-first moderation, per screen 09 — a note is visible
 * the moment it's written and the couple can take any down, which is what
 * `hidden` is for.
 */
export const guestbookNotes = pgTable(
  "guestbook_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    weddingId: uuid("wedding_id")
      .notNull()
      .references(() => weddings.id, { onDelete: "cascade" }),
    householdId: uuid("household_id").references(() => households.id, { onDelete: "set null" }),
    author: text("author").notNull(),
    body: text("body").notNull(),
    hidden: boolean("hidden").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("guestbook_notes_wedding_idx").on(t.weddingId)],
);

/** Reserved slugs the intake must reject before it even hits the uniqueness check. */
export const reservedSlugs = pgTable("reserved_slugs", {
  slug: text("slug").primaryKey(),
});

/** Guest household sessions (phone + code login is parked; the table is not). */
export const householdSessions = pgTable(
  "household_sessions",
  {
    token: text("token").notNull(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.token] }), index("household_sessions_household_idx").on(t.householdId)],
);
