import { and, asc, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/db";
import { guestbookNotes, households, places, songRequests } from "@/db/schema";
import { resolveSections } from "@/lib/design";
import { currentHousehold, weddingBySlug } from "@/lib/guest";
import { syncPlacesFromSheet } from "@/lib/sheet-sync";
import type { WeddingRow } from "@/lib/wedding";
import {
  BAR,
  FAQ,
  GIFT_FUND,
  GIFT_ITEMS,
  MAINS,
  ROOM_BLOCKS,
  SHUTTLE,
  STARTERS,
  TRAVEL_NOTE,
  WEDDING_PARTY,
} from "@/lib/wedding-content";

import { Eyebrow, IdentifyPrompt, Lede, Panel, ScreenTitle, SubTitle, panelStyle } from "../../ui";
import { GuestbookForm, SongForm } from "../guest-forms";
import { MORE_SECTIONS } from "../section-meta";

/** Screens 06–11 — the sections under More, each one gated on its toggle. */
export default async function SectionScreen({ params }: PageProps<"/[slug]/more/[section]">) {
  const { slug, section } = await params;

  const wedding = await weddingBySlug(slug);
  if (!wedding) notFound();

  const meta = MORE_SECTIONS.find((s) => s.key === section);
  if (!meta) notFound();

  const sections = resolveSections(wedding.sections);
  // A section the couple switched off is not merely hidden from the grid — its
  // URL doesn't resolve either.
  if (!sections[meta.key]) notFound();

  // A rename in the console retitles the screen; left alone, each screen keeps
  // the heading the design gave it ("Dinner", "Who's who").
  const renamed = wedding.sectionMeta?.[meta.key]?.label?.trim() || undefined;

  return (
    <>
      <Link
        href={`/${slug}/more`}
        style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--mut)", textDecoration: "none" }}
      >
        ← More
      </Link>
      <div style={{ marginTop: 12 }}>
        {meta.key === "gifts" ? <Gifts title={renamed} /> : null}
        {meta.key === "travel" ? <Travel title={renamed} /> : null}
        {meta.key === "menu" ? <Menu title={renamed} /> : null}
        {meta.key === "guestbook" ? <Guestbook slug={slug} weddingId={wedding.id} title={renamed} /> : null}
        {meta.key === "songs" ? <Songs slug={slug} weddingId={wedding.id} title={renamed} /> : null}
        {meta.key === "party" ? <Party title={renamed} /> : null}
        {meta.key === "around" ? <AroundTown wedding={wedding} title={renamed} /> : null}
        {meta.key === "faq" ? <Faq title={renamed} /> : null}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- screen 06 --

function money(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function Gifts({ title }: { title?: string }) {
  return (
    <>
      <ScreenTitle>{title ?? "Gifts"}</ScreenTitle>
      <Lede>
        Pledge here, pay how you like — Venmo or Zelle links open directly. No money moves through this app.
      </Lede>

      <Panel style={{ marginTop: 16, padding: 15 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11,
            letterSpacing: ".18em",
            textTransform: "uppercase",
            color: "var(--mut)",
          }}
        >
          <span>{GIFT_FUND.name}</span>
          <span style={{ color: "var(--ink)" }}>0%</span>
        </div>
        <div style={{ height: 8, background: "var(--bg)", marginTop: 8 }}>
          <div style={{ height: "100%", width: "0%", background: "var(--acc)" }} />
        </div>
        <div style={{ marginTop: 7, fontSize: 11, color: "var(--mut)" }}>
          {money(0)} pledged of {money(GIFT_FUND.goalCents)}
        </div>
      </Panel>

      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
        {GIFT_ITEMS.map((item) => (
          <div key={item.key} style={{ ...panelStyle, display: "flex", gap: 12, padding: "13px 14px", alignItems: "center" }}>
            <div
              style={{
                width: 44,
                height: 44,
                background: "linear-gradient(135deg, var(--bg), var(--line))",
                flex: "none",
                border: "1px solid var(--line)",
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 800 }}>{item.name}</div>
              <div style={{ fontSize: 11, color: "var(--mut)" }}>{money(item.amountCents)} · open</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, fontSize: 11, lineHeight: 1.6, color: "var(--mut)" }}>
        The couple hasn&apos;t added their Venmo or Zelle handle yet — once they do, these open straight into the app.
      </div>
    </>
  );
}

// ---------------------------------------------------------------- screen 07 --

function Travel({ title }: { title?: string }) {
  return (
    <>
      <ScreenTitle>{title ?? "Travel & stay"}</ScreenTitle>

      <Eyebrow style={{ marginTop: 16 }}>Room blocks</Eyebrow>
      <div style={{ marginTop: 9, display: "flex", flexDirection: "column", gap: 8 }}>
        {ROOM_BLOCKS.map((room) => (
          <Panel key={room.name} style={{ padding: "13px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 800 }}>{room.name}</span>
              <span style={{ fontSize: 12, color: "var(--acc)", fontWeight: 800 }}>{room.price}</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--mut)", marginTop: 3 }}>{room.detail}</div>
          </Panel>
        ))}
      </div>

      <Eyebrow style={{ marginTop: 14 }}>Shuttle</Eyebrow>
      <div style={{ marginTop: 9, padding: "13px 14px", border: "1px solid var(--acc)", borderRadius: "var(--rad)" }}>
        <div style={{ fontSize: 13, fontWeight: 800 }}>{SHUTTLE.title}</div>
        <div style={{ fontSize: 11, color: "var(--mut)", marginTop: 3 }}>{SHUTTLE.detail}</div>
      </div>

      <div style={{ marginTop: 12, fontSize: 11, lineHeight: 1.6, color: "var(--mut)" }}>{TRAVEL_NOTE}</div>
    </>
  );
}

// ---------------------------------------------------------------- screen 08 --

function Menu({ title }: { title?: string }) {
  return (
    <>
      <ScreenTitle>{title ?? "Dinner"}</ScreenTitle>
      <Lede>Family-style starters, then your pick — chosen in RSVP, changeable until the week before.</Lede>

      <Eyebrow style={{ marginTop: 18 }}>To start, shared</Eyebrow>
      <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.8, fontFamily: "var(--serif)" }}>{STARTERS}</div>

      <Eyebrow style={{ marginTop: 18 }}>The mains</Eyebrow>
      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        {MAINS.filter((m) => !m.kids).map((main) => (
          <Panel key={main.key}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>
              {main.label}
              {main.veg ? <span style={{ fontSize: 10, color: "var(--acc)", letterSpacing: ".1em" }}> VEG</span> : null}
            </div>
            {main.note ? <div style={{ fontSize: 11, color: "var(--mut)", marginTop: 3 }}>{main.note}</div> : null}
          </Panel>
        ))}
      </div>

      <Eyebrow style={{ marginTop: 18 }}>The bar</Eyebrow>
      <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.8, fontFamily: "var(--serif)" }}>{BAR}</div>

      <Panel style={{ marginTop: 16, fontSize: 12, lineHeight: 1.5, color: "var(--mut)" }}>
        Dietary notes you leave in RSVP go straight to the caterer&apos;s tab — the kitchen gets a per-table sheet.
      </Panel>
    </>
  );
}

// ---------------------------------------------------------------- screen 09 --

async function Guestbook({ slug, weddingId, title }: { slug: string; weddingId: string; title?: string }) {
  const household = await currentHousehold(weddingId);
  const notes = await db
    .select()
    .from(guestbookNotes)
    .where(and(eq(guestbookNotes.weddingId, weddingId), eq(guestbookNotes.hidden, false)))
    .orderBy(desc(guestbookNotes.createdAt))
    .limit(50);

  return (
    <>
      <ScreenTitle>{title ?? "Guestbook"}</ScreenTitle>
      <Lede>Notes post to the wall right away; the couple can take any down.</Lede>

      {notes.length ? (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
          {notes.map((note) => (
            <Panel key={note.id}>
              <div style={{ fontSize: 13, lineHeight: 1.55, fontStyle: "italic", fontFamily: "var(--serif)" }}>
                “{note.body}”
              </div>
              <div style={{ fontSize: 11, color: "var(--mut)", marginTop: 7 }}>
                — {note.author} ·{" "}
                {note.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </div>
            </Panel>
          ))}
        </div>
      ) : (
        <div style={{ marginTop: 14, fontSize: 13, color: "var(--mut)" }}>
          Nothing on the wall yet. Go first.
        </div>
      )}

      {household ? (
        <GuestbookForm slug={slug} />
      ) : (
        <IdentifyPrompt slug={slug} next={`/${slug}/more/guestbook`} what="Your note" />
      )}
    </>
  );
}

async function Songs({ slug, weddingId, title }: { slug: string; weddingId: string; title?: string }) {
  const household = await currentHousehold(weddingId);

  const mine = household
    ? (await db.select().from(songRequests).where(eq(songRequests.householdId, household.id)).limit(1))[0]
    : undefined;

  const total = await db
    .select({ id: songRequests.id })
    .from(songRequests)
    .innerJoin(households, eq(households.id, songRequests.householdId))
    .where(eq(households.weddingId, weddingId));

  const others = Math.max(0, total.length - (mine ? 1 : 0));

  return (
    <>
      <SubTitle>{title ?? "Songs for the DJ"}</SubTitle>
      <Lede>One request each — it lands on the couple&apos;s DJ list.</Lede>

      {mine ? (
        <Panel style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ color: "var(--acc)", display: "inline-flex" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 18V5.5l10-2V16" />
              <circle cx="6.5" cy="18" r="2.5" />
              <circle cx="16.5" cy="16" r="2.5" />
            </svg>
          </span>
          <span style={{ flex: 1, fontSize: 13 }}>
            <strong>{mine.title}</strong>
            {mine.artist ? ` — ${mine.artist}` : ""}
          </span>
          <span style={{ fontSize: 10, color: "var(--mut)" }}>yours</span>
        </Panel>
      ) : null}

      {others > 0 ? (
        <Panel style={{ marginTop: 8, opacity: 0.7, fontSize: 13 }}>
          {others} other {others === 1 ? "request" : "requests"} in
        </Panel>
      ) : null}

      {household ? (
        <SongForm slug={slug} currentTitle={mine?.title ?? ""} currentArtist={mine?.artist ?? ""} />
      ) : (
        <IdentifyPrompt slug={slug} next={`/${slug}/more/songs`} what="Your request" />
      )}
    </>
  );
}

// ---------------------------------------------------------------- screen 10 --

function Party({ title }: { title?: string }) {
  return (
    <>
      <ScreenTitle>{title ?? "Who’s who"}</ScreenTitle>
      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {WEDDING_PARTY.map((person) => (
          <Panel key={person.name} style={{ padding: 13 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: "var(--bg)",
                border: "1px solid var(--acc)",
              }}
            />
            <div style={{ fontSize: 13, fontWeight: 800, marginTop: 8 }}>{person.name}</div>
            <div style={{ fontSize: 11, color: "var(--mut)" }}>{person.role}</div>
          </Panel>
        ))}
      </div>
    </>
  );
}

function Faq({ title }: { title?: string }) {
  return (
    <>
      <ScreenTitle>{title ?? "FAQ"}</ScreenTitle>
      <div style={{ marginTop: 12, display: "flex", flexDirection: "column" }}>
        {FAQ.map((row, i) => (
          <div
            key={row.q}
            style={{ padding: "13px 0", borderBottom: i === FAQ.length - 1 ? "none" : "1px solid var(--line)" }}
          >
            <div style={{ fontSize: 13, fontWeight: 800 }}>{row.q}</div>
            <div style={{ fontSize: 12, color: "var(--mut)", marginTop: 4, lineHeight: 1.5 }}>{row.a}</div>
          </div>
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- screen 11 --

async function AroundTown({ wedding, title }: { wedding: WeddingRow; title?: string }) {
  // The couple writes this one into the Sheet's Things to do tab; pull whatever
  // is there now before rendering, throttled so it isn't a read per request.
  try {
    await syncPlacesFromSheet(wedding);
  } catch {
    // Fall back to whatever was mirrored last time.
  }

  const rows = await db
    .select()
    .from(places)
    .where(eq(places.weddingId, wedding.id))
    .orderBy(asc(places.createdAt));

  return (
    <>
      <ScreenTitle>{title ?? "Around town"}</ScreenTitle>
      <Lede>
        The couple&apos;s actual list — where they eat, drink and take people. Written by them, not an algorithm.
      </Lede>

      {rows.length ? (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map((place) => (
            <Panel key={place.id}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 800 }}>{place.name}</span>
                {place.category ? (
                  <span style={{ fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--acc)" }}>
                    {place.category}
                  </span>
                ) : null}
                {place.walk ? (
                  <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--mut)" }}>{place.walk}</span>
                ) : null}
              </div>
              {place.neighborhood ? (
                <div style={{ fontSize: 11, color: "var(--mut)", marginTop: 3 }}>{place.neighborhood}</div>
              ) : null}
              {place.blurb ? (
                <div style={{ fontSize: 12, lineHeight: 1.5, color: "var(--mut)", marginTop: 5 }}>{place.blurb}</div>
              ) : null}
            </Panel>
          ))}
        </div>
      ) : (
        <div
          style={{
            marginTop: 14,
            padding: "20px 16px",
            border: "1px dashed var(--line)",
            borderRadius: "var(--rad)",
            fontSize: 12.5,
            lineHeight: 1.6,
            color: "var(--mut)",
          }}
        >
          Nothing here yet — the couple adds spots in the Things to do tab of their spreadsheet, and they show up here
          within a minute.
        </div>
      )}
    </>
  );
}
