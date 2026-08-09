"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

import type { Layout, Palette, ScheduleEntry, SectionKey, SectionMetaMap } from "@/db/schema";
import type { ConsoleStats } from "@/lib/console-stats";
import { ACCENTS, LAYOUTS, LAYOUT_ORDER, PALETTES, accentInk, resolveAccent } from "@/lib/design";
import { displayTime } from "@/lib/schedule";
import type { ResolvedSection } from "@/lib/sections";

import { saveDetails, saveLook, saveSchedule, saveSections } from "./actions";

const INK = "#201e1d";
const RULE = "#e0dcd4";
const DIVIDER = "#c9c4bb";

export type ConsoleWedding = {
  slug: string;
  nameOne: string;
  nameTwo: string;
  dateText: string;
  venue: string;
  guestEstimate: string;
  layout: Layout;
  palette: Palette;
  accent: string | null;
  sheetUrl: string | null;
  folderUrl: string | null;
};

export type ConsoleTableRow = {
  household: string;
  names: string;
  reply: "yes" | "no" | null;
  attending: number | null;
  dietary: string;
  note: string;
  submittedAt: string | null;
};

type Tab = "guests" | "details" | "sections" | "look";

const TABS: Array<[Tab, string]> = [
  ["guests", "Guests & RSVP"],
  ["details", "The details"],
  ["sections", "Sections"],
  ["look", "Look"],
];

/**
 * The couple console, following stage 3 of `Ribbet.dc.html`: a five-across KPI
 * strip over a tabbed body, with the guest table and its filter pills kept as
 * designed. The prototype's own chrome is superseded, so this wears the intake's
 * — same page ground, same 2px rules, same faces — because it lives on the same
 * site as /setup.
 */
export function Console({
  wedding,
  email,
  sections,
  schedule,
  stats,
  table,
}: {
  wedding: ConsoleWedding;
  email: string;
  sections: ResolvedSection[];
  schedule: ScheduleEntry[];
  stats: ConsoleStats;
  table: ConsoleTableRow[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("guests");
  const [toast, setToast] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Editors are seeded from the server and kept locally until saved.
  const [nameOne, setNameOne] = useState(wedding.nameOne);
  const [nameTwo, setNameTwo] = useState(wedding.nameTwo);
  const [dateText, setDateText] = useState(wedding.dateText);
  const [venue, setVenue] = useState(wedding.venue);
  const [guestEstimate, setGuestEstimate] = useState(wedding.guestEstimate);
  const [rows, setRows] = useState<ScheduleEntry[]>(schedule);
  const [list, setList] = useState<ResolvedSection[]>(sections);
  const [layout, setLayout] = useState<Layout>(wedding.layout);
  const [palette, setPalette] = useState<Palette>(wedding.palette);
  const [accentOverride, setAccentOverride] = useState<string | null>(wedding.accent);
  const [filter, setFilter] = useState<"All" | "Coming" | "No reply" | "Declined">("All");

  const accent = resolveAccent(palette, accentOverride);
  const accInk = accentInk(accent);

  const say = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2800);
    router.refresh();
  };

  const cta = {
    padding: "13px 20px",
    border: `2px solid ${accent}`,
    background: accent,
    color: accInk,
    fontSize: 13.5,
    fontWeight: 800,
    cursor: pending ? "progress" : "pointer",
    fontFamily: "inherit",
    opacity: pending ? 0.6 : 1,
  } as const;

  const filtered = table.filter((row) => {
    if (filter === "All") return true;
    if (filter === "Coming") return row.reply === "yes";
    if (filter === "Declined") return row.reply === "no";
    return !row.submittedAt;
  });

  const move = (index: number, delta: number) => {
    setList((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const persistSections = () =>
    start(async () => {
      const on: Partial<Record<SectionKey, boolean>> = {};
      const meta: SectionMetaMap = {};
      list.forEach((section, i) => {
        on[section.key] = section.on;
        const renamed = section.label.trim();
        meta[section.key] = { order: i, ...(renamed ? { label: renamed } : {}) };
      });
      await saveSections({ on, meta });
      say("Sections saved — live in the guest app");
    });

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#e6e4e2",
        color: INK,
        fontFamily: "var(--font-karla), sans-serif",
        padding: "36px 36px 70px",
      }}
    >
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        {/* masthead */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, borderBottom: `2px solid ${INK}`, paddingBottom: 14 }}>
          <span style={{ fontFamily: "var(--font-fraunces), serif", fontWeight: 600, fontSize: 24, letterSpacing: "-.02em" }}>
            Ribbet
          </span>
          <span style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", opacity: 0.6 }}>
            Couple console
          </span>
          <span style={{ marginLeft: "auto", fontSize: 12, opacity: 0.6 }}>
            {email}
            {" · "}
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/admin" })}
              style={{ border: 0, background: "transparent", padding: 0, font: "inherit", cursor: "pointer", textDecoration: "underline" }}
            >
              sign out
            </button>
          </span>
        </div>

        <div
          style={{
            marginTop: 22,
            background: "#fff",
            border: `2px solid ${INK}`,
            boxShadow: "0 24px 60px rgba(0,0,0,.18)",
          }}
        >
          {/* address bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "11px 18px",
              borderBottom: `2px solid ${INK}`,
              background: "#f4f1ec",
            }}
          >
            <div style={{ display: "flex", gap: 6 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ width: 11, height: 11, border: `2px solid ${INK}` }} />
              ))}
            </div>
            <a
              href={`/${wedding.slug}`}
              target="_blank"
              rel="noreferrer"
              style={{ flex: 1, textAlign: "center", fontSize: 12, opacity: 0.7, color: INK }}
            >
              ribbet.app/{wedding.slug} ↗
            </a>
          </div>

          {/* KPI strip */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", borderBottom: `2px solid ${INK}` }}>
            <Kpi value={stats.guestsComing} label="Guests coming" sub={`${stats.comingHouseholds} households`} divider />
            <Kpi value={stats.noReply} label="No reply" sub={`of ${stats.households} households`} divider />
            <Kpi value={stats.declinedHouseholds} label="Declined" sub="Seats freed" divider />
            <Kpi
              value={`$${(stats.pledgedCents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
              label="Pledged"
              sub={`${stats.pledgeCount} ${stats.pledgeCount === 1 ? "gift" : "gifts"}`}
              color={accent}
              divider
            />
            <Kpi value={stats.photos} label="Photos in" sub={`${stats.songs} song requests`} />
          </div>

          {/* tab row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "14px 18px 12px",
              borderBottom: `2px solid ${INK}`,
              flexWrap: "wrap",
            }}
          >
            {TABS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                style={{
                  padding: "10px 15px",
                  border: `2px solid ${INK}`,
                  background: tab === key ? INK : "transparent",
                  color: tab === key ? "#fff" : INK,
                  fontWeight: 800,
                  fontSize: 12,
                  letterSpacing: ".06em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {label}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            {wedding.sheetUrl ? (
              <a href={wedding.sheetUrl} target="_blank" rel="noreferrer" style={linkButton}>
                Open Sheet ↗
              </a>
            ) : null}
            {wedding.folderUrl ? (
              <a href={wedding.folderUrl} target="_blank" rel="noreferrer" style={linkButton}>
                Open Drive folder ↗
              </a>
            ) : null}
          </div>

          <div style={{ padding: 18 }}>
            {/* ------------------------------------------------ GUESTS ---- */}
            {tab === "guests" ? (
              <>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(["All", "Coming", "No reply", "Declined"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFilter(f)}
                      style={{
                        padding: "9px 14px",
                        border: `2px solid ${INK}`,
                        background: filter === f ? accent : "transparent",
                        color: filter === f ? accInk : INK,
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: ".06em",
                        textTransform: "uppercase",
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.9fr 1fr 0.6fr 1.3fr 1.7fr",
                    padding: "10px 0",
                    marginTop: 14,
                    borderTop: `2px solid ${INK}`,
                    borderBottom: `2px solid ${INK}`,
                    fontSize: 10,
                    letterSpacing: ".14em",
                    textTransform: "uppercase",
                    opacity: 0.55,
                    fontWeight: 700,
                  }}
                >
                  <div>Household</div>
                  <div>RSVP</div>
                  <div>Party</div>
                  <div>Dietary</div>
                  <div>Message</div>
                </div>

                {filtered.length ? (
                  filtered.map((row) => (
                    <div
                      key={row.household}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1.9fr 1fr 0.6fr 1.3fr 1.7fr",
                        padding: "12px 0",
                        borderBottom: `1px solid ${RULE}`,
                        alignItems: "start",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{row.household}</div>
                        <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>{row.names || "—"}</div>
                      </div>
                      <div>
                        <span style={pillStyle(row.reply, row.submittedAt, accent, accInk)}>
                          {row.reply === "yes" ? "Coming" : row.reply === "no" ? "Declined" : "No reply"}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, paddingTop: 3 }}>{row.attending ?? "—"}</div>
                      <div style={{ fontSize: 12, opacity: 0.75, paddingTop: 3 }}>{row.dietary || "—"}</div>
                      <div style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.4, paddingTop: 2 }}>{row.note || "—"}</div>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: "22px 0", fontSize: 13, opacity: 0.6 }}>
                    {table.length ? "Nobody in this filter yet." : "No replies yet — the first one lands here."}
                  </div>
                )}

                {stats.meals.length ? (
                  <div style={{ marginTop: 22, border: `2px solid ${RULE}`, padding: 16 }}>
                    <div style={labelStyle}>Meal counts · {stats.dietaryFlags} dietary flags</div>
                    <div style={{ display: "flex", gap: 22, marginTop: 10, flexWrap: "wrap" }}>
                      {stats.meals.map((meal) => (
                        <div key={meal.main}>
                          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "var(--font-fraunces), serif" }}>
                            {meal.count}
                          </div>
                          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>{meal.main}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}

            {/* ----------------------------------------------- DETAILS ---- */}
            {tab === "details" ? (
              <>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                  <Field label="First name" value={nameOne} onChange={setNameOne} />
                  <Field label="Second name" value={nameTwo} onChange={setNameTwo} />
                </div>
                <div style={{ display: "flex", gap: 14, marginTop: 14, flexWrap: "wrap" }}>
                  <Field label="Wedding date" value={dateText} onChange={setDateText} />
                  <Field label="Guests, roughly" value={guestEstimate} onChange={setGuestEstimate} />
                </div>
                <div style={{ marginTop: 14 }}>
                  <Field label="Venue" value={venue} onChange={setVenue} wide />
                </div>

                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await saveDetails({ nameOne, nameTwo, dateText, venue, guestEstimate });
                      say("Details saved — live in the guest app");
                    })
                  }
                  style={{ ...cta, marginTop: 20 }}
                >
                  Save the details
                </button>

                <div style={{ marginTop: 34, borderTop: `2px solid ${RULE}`, paddingTop: 20 }}>
                  <div style={labelStyle}>The Day — running order</div>
                  <div style={{ fontSize: 12.5, opacity: 0.65, marginTop: 6, maxWidth: 620, lineHeight: 1.6 }}>
                    Times are 24-hour here and shown to guests as 5:00. The schedule marks itself done, now and next
                    on the day itself.
                  </div>

                  <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                    {rows.map((row, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <input
                          value={row.time}
                          onChange={(e) => setRows((p) => p.map((r, j) => (j === i ? { ...r, time: e.target.value } : r)))}
                          placeholder="17:00"
                          style={{ ...inputStyle, width: 84, flex: "none" }}
                        />
                        <span style={{ fontSize: 11, opacity: 0.45, width: 42, flex: "none" }}>
                          {displayTime(row.time)}
                        </span>
                        <input
                          value={row.title}
                          onChange={(e) => setRows((p) => p.map((r, j) => (j === i ? { ...r, title: e.target.value } : r)))}
                          placeholder="Ceremony"
                          style={{ ...inputStyle, flex: "1 1 160px" }}
                        />
                        <input
                          value={row.detail}
                          onChange={(e) => setRows((p) => p.map((r, j) => (j === i ? { ...r, detail: e.target.value } : r)))}
                          placeholder="West terrace — phones away"
                          style={{ ...inputStyle, flex: "2 1 220px" }}
                        />
                        <button
                          type="button"
                          onClick={() => setRows((p) => p.filter((_, j) => j !== i))}
                          aria-label={`Remove ${row.title || "row"}`}
                          style={smallButton}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => setRows((p) => [...p, { time: "22:00", title: "", detail: "" }])}
                      style={smallButton}
                    >
                      ＋ Add a moment
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          await saveSchedule(rows);
                          say("Schedule saved — live in the guest app");
                        })
                      }
                      style={cta}
                    >
                      Save the schedule
                    </button>
                  </div>
                </div>
              </>
            ) : null}

            {/* ---------------------------------------------- SECTIONS ---- */}
            {tab === "sections" ? (
              <>
                <div style={{ fontSize: 13, opacity: 0.7, maxWidth: 640, lineHeight: 1.6 }}>
                  Rename anything, drag the order with the arrows, switch off what you don&apos;t want. Home, RSVP and
                  The Day are the app itself — they can be renamed and moved, but not switched off.
                </div>

                <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 8 }}>
                  {list.map((section, i) => (
                    <div
                      key={section.key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "12px 14px",
                        border: `2px solid ${section.on ? INK : RULE}`,
                        opacity: section.on ? 1 : 0.55,
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: "none" }}>
                        <button type="button" onClick={() => move(i, -1)} aria-label="Move up" style={nudgeButton}>
                          ▲
                        </button>
                        <button type="button" onClick={() => move(i, 1)} aria-label="Move down" style={nudgeButton}>
                          ▼
                        </button>
                      </div>

                      <button
                        type="button"
                        disabled={section.locked}
                        onClick={() =>
                          setList((prev) => prev.map((s, j) => (j === i ? { ...s, on: !s.on } : s)))
                        }
                        aria-label={`Toggle ${section.label}`}
                        style={{
                          width: 20,
                          height: 20,
                          flex: "none",
                          border: `2px solid ${section.on ? accent : DIVIDER}`,
                          background: section.on ? accent : "transparent",
                          color: accInk,
                          fontSize: 11,
                          fontWeight: 800,
                          cursor: section.locked ? "default" : "pointer",
                          fontFamily: "inherit",
                          padding: 0,
                        }}
                      >
                        {section.on ? "✓" : ""}
                      </button>

                      <input
                        value={section.label}
                        onChange={(e) =>
                          setList((prev) => prev.map((s, j) => (j === i ? { ...s, label: e.target.value } : s)))
                        }
                        style={{ ...inputStyle, flex: "1 1 180px", fontWeight: 800 }}
                      />
                      <span style={{ fontSize: 11.5, opacity: 0.55, flex: "2 1 240px" }}>{section.sub}</span>
                      {section.locked ? (
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 800,
                            letterSpacing: ".1em",
                            textTransform: "uppercase",
                            opacity: 0.45,
                            flex: "none",
                          }}
                        >
                          Always on
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>

                <button type="button" disabled={pending} onClick={persistSections} style={{ ...cta, marginTop: 20 }}>
                  Save sections
                </button>
              </>
            ) : null}

            {/* -------------------------------------------------- LOOK ---- */}
            {tab === "look" ? (
              <>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {LAYOUT_ORDER.map((key) => {
                    const def = LAYOUTS[key];
                    const sel = layout === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setLayout(key)}
                        style={{
                          flex: "1 1 220px",
                          border: `2px solid ${sel ? INK : RULE}`,
                          background: "transparent",
                          padding: 0,
                          cursor: "pointer",
                          color: INK,
                          boxShadow: sel ? "0 8px 22px rgba(0,0,0,.12)" : "none",
                        }}
                      >
                        <div style={{ background: def.bg, color: def.ink, padding: "20px 16px", textAlign: "left", fontFamily: def.serif }}>
                          <div style={{ fontSize: 22, lineHeight: 1.05 }}>
                            {nameOne || "Amara"}
                            <br />&amp; {nameTwo || "Cole"}
                          </div>
                          <div style={{ width: 32, height: 1, background: accent, margin: "9px 0" }} />
                          <div
                            style={{
                              fontSize: 9.5,
                              letterSpacing: ".2em",
                              textTransform: "uppercase",
                              color: def.mut,
                              fontFamily: "var(--font-karla), sans-serif",
                            }}
                          >
                            {venue.split(",")[0] || "Your venue"}
                          </div>
                        </div>
                        <div style={{ padding: "12px 13px 13px", textAlign: "left" }}>
                          <div style={{ fontSize: 13, fontWeight: 800 }}>{def.name}</div>
                          <div style={{ fontSize: 11.5, lineHeight: 1.45, opacity: 0.62, marginTop: 3 }}>{def.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div style={{ ...labelStyle, marginTop: 24 }}>Your palette</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                  {PALETTES.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => {
                        setPalette(p.key);
                        setAccentOverride(null);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 9,
                        padding: "6px 10px 6px 6px",
                        border: `2px solid ${palette === p.key && !accentOverride ? INK : RULE}`,
                        background: "transparent",
                        cursor: "pointer",
                        color: INK,
                        fontFamily: "inherit",
                      }}
                    >
                      <span style={{ display: "flex" }}>
                        <span style={{ width: 19, height: 30, background: p.c1 }} />
                        <span style={{ width: 19, height: 30, background: p.c2 }} />
                        <span style={{ width: 19, height: 30, background: p.c3 }} />
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 800 }}>{p.name}</span>
                    </button>
                  ))}
                </div>

                <div style={{ ...labelStyle, marginTop: 20 }}>Or nudge the accent</div>
                <div style={{ display: "flex", gap: 7, marginTop: 6, flexWrap: "wrap" }}>
                  {ACCENTS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Accent ${c}`}
                      onClick={() => setAccentOverride(c)}
                      style={{
                        width: 30,
                        height: 30,
                        padding: 0,
                        background: c,
                        border: accent === c ? `3px solid ${INK}` : "2px solid rgba(32,30,29,.2)",
                        cursor: "pointer",
                      }}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await saveLook({ layout, palette, accent: accentOverride });
                      say("Look saved — live in the guest app");
                    })
                  }
                  style={{ ...cta, marginTop: 24 }}
                >
                  Save the look
                </button>
              </>
            ) : null}
          </div>

          {toast ? (
            <div style={{ padding: "13px 18px", background: INK, color: "#fff", fontSize: 13, fontWeight: 600 }}>
              {toast}
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------- helpers --

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: ".14em",
  textTransform: "uppercase",
  opacity: 0.55,
  fontWeight: 700,
};

const inputStyle: React.CSSProperties = {
  boxSizing: "border-box",
  padding: 11,
  border: `2px solid ${INK}`,
  background: "#fff",
  color: INK,
  fontSize: 14,
  borderRadius: 0,
  outline: "none",
  fontFamily: "inherit",
  minWidth: 0,
};

const linkButton: React.CSSProperties = {
  padding: "9px 14px",
  border: `2px solid ${INK}`,
  color: INK,
  fontWeight: 700,
  fontSize: 12,
  letterSpacing: ".06em",
  textTransform: "uppercase",
  textDecoration: "none",
};

const smallButton: React.CSSProperties = {
  padding: "10px 13px",
  border: `2px solid ${INK}`,
  background: "transparent",
  color: INK,
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
  fontFamily: "inherit",
  flex: "none",
};

const nudgeButton: React.CSSProperties = {
  border: `1px solid ${DIVIDER}`,
  background: "transparent",
  color: INK,
  fontSize: 8,
  lineHeight: 1,
  padding: "3px 5px",
  cursor: "pointer",
  fontFamily: "inherit",
};

function pillStyle(
  reply: "yes" | "no" | null,
  submittedAt: string | null,
  accent: string,
  accInk: string,
): React.CSSProperties {
  const base: React.CSSProperties = {
    display: "inline-block",
    padding: "4px 9px",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: ".1em",
    textTransform: "uppercase",
  };
  if (reply === "yes") return { ...base, border: `2px solid ${accent}`, background: accent, color: accInk };
  if (reply === "no") return { ...base, border: `2px solid ${DIVIDER}`, opacity: 0.6 };
  return { ...base, border: `2px dashed ${INK}`, opacity: submittedAt ? 1 : 0.75 };
}

function Kpi({
  value,
  label,
  sub,
  color,
  divider,
}: {
  value: number | string;
  label: string;
  sub: string;
  color?: string;
  divider?: boolean;
}) {
  return (
    <div style={{ padding: "16px 18px", borderRight: divider ? `2px solid ${RULE}` : "none" }}>
      <div
        style={{
          fontFamily: "var(--font-fraunces), serif",
          fontWeight: 600,
          fontSize: 30,
          letterSpacing: "-.03em",
          color: color ?? INK,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", opacity: 0.55, marginTop: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 11, opacity: 0.5, marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  wide,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  wide?: boolean;
}) {
  return (
    <label style={{ flex: wide ? "1 1 100%" : "1 1 220px", display: "block" }}>
      <span style={{ ...labelStyle, display: "block", marginBottom: 7 }}>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, width: "100%" }} />
    </label>
  );
}
