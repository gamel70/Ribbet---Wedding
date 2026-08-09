"use client";

import type { Layout, Sections } from "@/db/schema";
import { LAYOUTS, accentInk } from "@/lib/design";

/**
 * The 340×736 live preview from `Ribbet Intake.dc.html`. It renders the chosen
 * layout, palette, names, date and venue as they are typed — the point of the
 * step is that this is the app, not a mockup of it.
 */
export function PreviewPhone({
  layout,
  accent,
  nameOne,
  nameTwo,
  dateText,
  venue,
  sections,
  daysToGo,
}: {
  layout: Layout;
  accent: string;
  nameOne: string;
  nameTwo: string;
  dateText: string;
  venue: string;
  sections: Sections;
  daysToGo: number | null;
}) {
  const l = LAYOUTS[layout];
  const accInk = accentInk(accent);

  // Before the couple has typed anything the preview still has to look like an
  // app, so the empty fields fall back rather than collapsing the layout.
  const one = nameOne || "Your name";
  const two = nameTwo || "Theirs";
  const dateShort = String(dateText).replace(/^[A-Za-z]+,\s*/, "") || "Your date";
  const parts = String(venue).split(",");
  const cityShort = parts.length > 1 ? parts[parts.length - 1].trim() : "";
  const venueShort = parts[0];

  // Section toggles rewrite the guest tab bar live, per the interaction notes.
  const tabs = ["Home", "RSVP", "Day", ...(sections.photos ? ["Photos"] : []), "More"];

  return (
    <div
      style={{
        width: 340,
        height: 736,
        border: "2px solid #201e1d",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 20px 50px rgba(0,0,0,.18)",
        background: l.bg,
        color: l.ink,
      }}
    >
      <div
        style={{
          height: 40,
          flex: "none",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          padding: "0 20px 5px",
          fontSize: 12,
        }}
      >
        <span>9:41</span>
        <span style={{ opacity: 0.7, display: "inline-flex" }}>
          <svg width="52" height="11" viewBox="0 0 60 12" fill="none" aria-hidden="true">
            <rect x="0" y="6" width="3" height="6" rx="1" fill="currentColor" />
            <rect x="4.5" y="3.5" width="3" height="8.5" rx="1" fill="currentColor" />
            <rect x="9" y="1" width="3" height="11" rx="1" fill="currentColor" />
            <path d="M20.5 5.2c2.6-2.6 7.4-2.6 10 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M22.8 7.9c1.5-1.5 3.9-1.5 5.4 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="25.5" cy="10.3" r="1.2" fill="currentColor" />
            <rect x="36.5" y="1.5" width="19" height="9" rx="2.5" stroke="currentColor" strokeWidth="1.1" />
            <rect x="38.5" y="3.5" width="12" height="5" rx="1" fill="currentColor" />
            <rect x="57" y="4" width="1.8" height="4" rx="0.9" fill="currentColor" />
          </svg>
        </span>
      </div>

      <div style={{ flex: 1, padding: "16px 22px 0", overflow: "hidden" }}>
        <div
          style={{
            fontSize: 9.5,
            letterSpacing: ".28em",
            textTransform: "uppercase",
            color: l.mut,
          }}
        >
          {dateShort}
          {cityShort ? ` · ${cityShort}` : ""}
        </div>

        <div style={{ marginTop: 11, fontSize: 38, lineHeight: 1.03, fontFamily: l.serif }}>
          {one}
          <br />
          <span style={{ fontStyle: "italic", color: accent }}>and</span> {two}
        </div>

        <div style={{ marginTop: 11, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 1, background: accent }} />
          <div style={{ fontSize: 12, color: l.mut }}>{venueShort || "Your venue"}</div>
        </div>

        <div
          style={{
            marginTop: 18,
            border: `1px solid ${l.line}`,
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            textAlign: "center",
            borderRadius: l.rad,
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "12px 6px", borderRight: `1px solid ${l.line}` }}>
            <div style={{ fontSize: 23, fontFamily: l.serif }}>{daysToGo ?? "—"}</div>
            <div style={statLabel(l.mut)}>Days</div>
          </div>
          <div style={{ padding: "12px 6px", borderRight: `1px solid ${l.line}` }}>
            <div style={{ fontSize: 23, fontFamily: l.serif }}>2</div>
            <div style={statLabel(l.mut)}>Seats</div>
          </div>
          <div style={{ padding: "12px 6px" }}>
            <div style={{ fontSize: 23, color: accent, fontFamily: l.serif }}>3</div>
            <div style={statLabel(l.mut)}>To do</div>
          </div>
        </div>

        <div
          style={{
            marginTop: 18,
            fontSize: 9.5,
            letterSpacing: ".24em",
            textTransform: "uppercase",
            color: l.mut,
          }}
        >
          Waiting on you
        </div>

        <div style={{ marginTop: 9, display: "flex", flexDirection: "column", gap: 7 }}>
          {["Reply to your invitation", "Choose your dinner"].map((label, i) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 11,
                padding: "12px 13px",
                background: l.panel,
                border: `1px solid ${l.line}`,
                borderRadius: l.rad,
              }}
            >
              <span
                style={{
                  width: 21,
                  height: 21,
                  flex: "none",
                  border: `1px solid ${accent}`,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 9.5,
                  color: accent,
                }}
              >
                {i + 1}
              </span>
              <span style={{ flex: 1, fontSize: 12.5, fontWeight: 700 }}>{label}</span>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 16,
            padding: "14px 15px",
            background: accent,
            color: accInk,
            fontWeight: 800,
            fontSize: 13,
            borderRadius: l.rad,
          }}
        >
          Reply now →
        </div>
      </div>

      <div
        style={{
          flex: "none",
          borderTop: `1px solid ${l.line}`,
          display: "grid",
          gridTemplateColumns: `repeat(${tabs.length},1fr)`,
          textAlign: "center",
          background: l.bg,
          padding: "9px 0 7px",
        }}
      >
        {tabs.map((label, i) => (
          <div key={label} style={{ padding: "2px 0", color: i === 0 ? accent : l.mut, opacity: i === 0 ? 1 : 0.7 }}>
            <div style={{ fontSize: 8, letterSpacing: ".12em", textTransform: "uppercase", fontWeight: 800 }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          flex: "none",
          height: 18,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: l.bg,
        }}
      >
        <div style={{ width: 110, height: 4, background: l.ink, opacity: 0.5, borderRadius: 2 }} />
      </div>
    </div>
  );
}

function statLabel(color: string): React.CSSProperties {
  return {
    fontSize: 8.5,
    letterSpacing: ".2em",
    textTransform: "uppercase",
    color,
    marginTop: 3,
  };
}
