"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { DIETARY_OPTIONS, MAINS } from "@/lib/wedding-content";

import { submitRsvp, type RsvpPerson } from "../actions";
import { Eyebrow, Lede, Panel, ScreenTitle, accentButtonStyle, panelStyle } from "../ui";

export type RsvpDraft = {
  householdLabel: string;
  reply: "yes" | "no" | null;
  people: RsvpPerson[];
  shuttle: boolean;
  note: string;
  songTitle: string;
  songArtist: string;
  submitted: boolean;
};

/**
 * Screen 02, as a working form. One reply covers the household, then per person:
 * dinner, dietary notes, kids; then the shuttle seat, a song for the DJ and a
 * note to the couple. Everything below the first block is optional — the whole
 * thing has to be answerable in under a minute on a phone.
 */
export function RsvpForm({
  slug,
  draft,
  showMenu,
  showSongs,
  showShuttle,
}: {
  slug: string;
  draft: RsvpDraft;
  showMenu: boolean;
  showSongs: boolean;
  showShuttle: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [householdLabel, setHouseholdLabel] = useState(draft.householdLabel);
  const [reply, setReply] = useState<"yes" | "no" | null>(draft.reply);
  const [people, setPeople] = useState<RsvpPerson[]>(draft.people);
  const [shuttle, setShuttle] = useState(draft.shuttle);
  const [note, setNote] = useState(draft.note);
  const [songTitle, setSongTitle] = useState(draft.songTitle);
  const [songArtist, setSongArtist] = useState(draft.songArtist);

  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [done, setDone] = useState(draft.submitted);

  const coming = reply === "yes";
  const named = people.filter((p) => p.name.trim().length > 0);
  const attending = named.filter((p) => p.attending);

  const progress = useMemo(() => {
    let steps = 2;
    let hit = 0;
    if (named.length) hit += 1;
    if (reply) hit += 1;
    if (showMenu && coming) {
      steps += 1;
      if (attending.length && attending.every((p) => p.main)) hit += 1;
    }
    return Math.round((hit / steps) * 100);
  }, [named.length, reply, showMenu, coming, attending]);

  const setPerson = (index: number, patch: Partial<RsvpPerson>) => {
    setPeople((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
    setDone(false);
  };

  const addPerson = () =>
    setPeople((prev) => [
      ...prev,
      { name: "", attending: true, isChild: false, main: null, dietary: [], kitchenNote: "" },
    ]);

  const removePerson = (index: number) =>
    setPeople((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));

  const send = () => {
    setError(null);
    setWarning(null);

    if (!reply) {
      setError("Let us know if you can make it.");
      return;
    }
    if (!named.length) {
      setError("Add at least one name so we know who's replying.");
      return;
    }

    startTransition(async () => {
      const result = await submitRsvp({
        slug,
        householdLabel,
        reply,
        people: named,
        shuttle,
        note,
        songTitle: showSongs ? songTitle : "",
        songArtist: showSongs ? songArtist : "",
      });

      if (result.ok) {
        setDone(true);
        setWarning(result.syncWarning);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <>
      <ScreenTitle>RSVP</ScreenTitle>
      <Lede>
        One reply for your household — change it any time before the day. {attending.length || "No"}{" "}
        {attending.length === 1 ? "seat" : "seats"} held so far.
      </Lede>

      <div style={{ marginTop: 16, height: 4, background: "var(--panel)" }}>
        <div style={{ height: "100%", width: `${progress}%`, background: "var(--acc)", transition: "width .4s ease" }} />
      </div>

      <div style={{ marginTop: 18 }}>
        <Eyebrow>Your household</Eyebrow>
        <input
          value={householdLabel}
          onChange={(e) => setHouseholdLabel(e.target.value)}
          placeholder="Marchetti-Lee"
          style={{ ...inputStyle, marginTop: 8 }}
        />
      </div>

      <div style={{ marginTop: 18, display: "flex", gap: 8 }}>
        {(
          [
            ["yes", "We're coming"],
            ["no", "Can't make it"],
          ] as const
        ).map(([value, label]) => {
          const on = reply === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => {
                setReply(value);
                setDone(false);
              }}
              style={{
                flex: 1,
                padding: "13px 12px",
                borderRadius: "var(--rad)",
                border: `1px solid ${on ? "var(--acc)" : "var(--line)"}`,
                background: on ? "var(--acc)" : "var(--panel)",
                color: on ? "var(--acc-ink)" : "var(--mut)",
                fontWeight: 800,
                fontSize: 13,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <Eyebrow style={{ marginTop: 20 }}>Who&apos;s in your household</Eyebrow>
      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        {people.map((person, i) => (
          <div
            key={i}
            style={{
              ...panelStyle,
              padding: "14px 15px",
              borderColor: person.attending && coming ? "var(--acc)" : "var(--line)",
            }}
          >
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                value={person.name}
                onChange={(e) => setPerson(i, { name: e.target.value })}
                placeholder={i === 0 ? "Your name" : "Their name"}
                style={{ ...inputStyle, flex: 1 }}
              />
              {people.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removePerson(i)}
                  aria-label={`Remove ${person.name || "person"}`}
                  style={{
                    border: "1px solid var(--line)",
                    background: "transparent",
                    color: "var(--mut)",
                    borderRadius: "var(--rad)",
                    padding: "9px 11px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  ✕
                </button>
              ) : null}
            </div>

            {coming ? (
              <>
                <div style={{ display: "flex", gap: 8, marginTop: 9, flexWrap: "wrap" }}>
                  <Chip on={person.attending} onClick={() => setPerson(i, { attending: true })}>
                    Coming
                  </Chip>
                  <Chip on={!person.attending} onClick={() => setPerson(i, { attending: false })}>
                    Can&apos;t
                  </Chip>
                  <Chip on={person.isChild} onClick={() => setPerson(i, { isChild: !person.isChild })}>
                    Child
                  </Chip>
                </div>

                {showMenu && person.attending ? (
                  <div style={{ marginTop: 12 }}>
                    <Eyebrow style={{ fontSize: 9 }}>Dinner</Eyebrow>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 7 }}>
                      {MAINS.filter((m) => !m.kids || person.isChild).map((main) => {
                        const on = person.main === main.label;
                        return (
                          <button
                            key={main.key}
                            type="button"
                            onClick={() => setPerson(i, { main: on ? null : main.label })}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 10,
                              padding: "11px 12px",
                              borderRadius: "var(--rad)",
                              border: `1px solid ${on ? "var(--acc)" : "var(--line)"}`,
                              background: "transparent",
                              color: "var(--ink)",
                              fontSize: 13,
                              fontWeight: 700,
                              textAlign: "left",
                              cursor: "pointer",
                              fontFamily: "inherit",
                            }}
                          >
                            <span>
                              {main.label}
                              {main.veg ? (
                                <span style={{ fontSize: 10, color: "var(--acc)", letterSpacing: ".1em" }}> VEG</span>
                              ) : null}
                            </span>
                            {on ? (
                              <span
                                style={{
                                  width: 18,
                                  height: 18,
                                  borderRadius: "50%",
                                  background: "var(--acc)",
                                  color: "var(--acc-ink)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 10,
                                  flex: "none",
                                }}
                              >
                                ✓
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>

                    <Eyebrow style={{ fontSize: 9, marginTop: 12 }}>Anything the kitchen should know</Eyebrow>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 7 }}>
                      {DIETARY_OPTIONS.map((option) => {
                        const on = person.dietary.includes(option);
                        return (
                          <Chip
                            key={option}
                            on={on}
                            onClick={() =>
                              setPerson(i, {
                                dietary: on
                                  ? person.dietary.filter((d) => d !== option)
                                  : [...person.dietary, option],
                              })
                            }
                          >
                            {option}
                          </Chip>
                        );
                      })}
                    </div>
                    <input
                      value={person.kitchenNote}
                      onChange={(e) => setPerson(i, { kitchenNote: e.target.value })}
                      placeholder="Severe allergy? Tell them here"
                      style={{ ...inputStyle, marginTop: 8 }}
                    />
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addPerson}
        style={{
          ...panelStyle,
          marginTop: 8,
          width: "100%",
          padding: "12px 14px",
          borderStyle: "dashed",
          color: "var(--mut)",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "inherit",
          background: "transparent",
        }}
      >
        ＋ Add someone (plus-one, partner, child)
      </button>

      {showShuttle && coming ? (
        <Panel style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800 }}>Shuttle seat</div>
            <div style={{ fontSize: 11, color: "var(--mut)", marginTop: 2 }}>From both hotels · 4:15 &amp; 4:35</div>
          </div>
          <Chip on={shuttle} onClick={() => setShuttle(!shuttle)}>
            {shuttle ? "Reserved" : "Reserve"}
          </Chip>
        </Panel>
      ) : null}

      {showSongs ? (
        <div style={{ marginTop: 18 }}>
          <Eyebrow>One song for the DJ</Eyebrow>
          <input
            value={songTitle}
            onChange={(e) => setSongTitle(e.target.value)}
            placeholder="Song title"
            style={{ ...inputStyle, marginTop: 8 }}
          />
          <input
            value={songArtist}
            onChange={(e) => setSongArtist(e.target.value)}
            placeholder="Artist"
            style={{ ...inputStyle, marginTop: 6 }}
          />
        </div>
      ) : null}

      <div style={{ marginTop: 18 }}>
        <Eyebrow>Note to the couple</Eyebrow>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Wouldn't miss it. Save me a dance."
          style={{ ...inputStyle, marginTop: 8, resize: "vertical" }}
        />
      </div>

      {error ? (
        <div style={{ marginTop: 14, fontSize: 12.5, fontWeight: 800, color: "#b8240e" }}>{error}</div>
      ) : null}

      {done ? (
        <Panel style={{ marginTop: 14, borderColor: "var(--acc)" }}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>Reply sent — thank you.</div>
          <div style={{ fontSize: 11.5, color: "var(--mut)", marginTop: 3, lineHeight: 1.5 }}>
            {warning
              ? "Saved. It's taking a moment to reach the couple's spreadsheet — nothing is lost, it'll land shortly."
              : "It's already in the couple's spreadsheet. Come back and change it any time."}
          </div>
        </Panel>
      ) : null}

      <button type="button" onClick={send} disabled={pending} style={{ ...accentButtonStyle, marginTop: 16, opacity: pending ? 0.6 : 1 }}>
        {pending ? "Sending…" : done ? "Update our reply →" : "Send our reply →"}
      </button>
    </>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "11px 12px",
  border: "1px solid var(--line)",
  borderRadius: "var(--rad)",
  background: "var(--bg)",
  color: "var(--ink)",
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
};

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "7px 12px",
        borderRadius: "var(--rad)",
        border: `1px solid ${on ? "var(--acc)" : "var(--line)"}`,
        background: on ? "var(--acc)" : "transparent",
        color: on ? "var(--acc-ink)" : "var(--mut)",
        fontSize: 12,
        fontWeight: 800,
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      {children}
    </button>
  );
}
