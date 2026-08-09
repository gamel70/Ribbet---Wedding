"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { GuestMatch } from "@/lib/guest";

import { claimHousehold, requestInvite, searchGuests } from "../actions";
import { Lede, Panel, ScreenTitle, accentButtonStyle, panelStyle } from "../ui";

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 13px",
  border: "1px solid var(--line)",
  borderRadius: "var(--rad)",
  background: "var(--bg)",
  color: "var(--ink)",
  fontSize: 15,
  fontFamily: "inherit",
  outline: "none",
};

/**
 * "Which one are you?" — the screen a guest hits when they arrive at the plain
 * link rather than through their invite.
 *
 * They find themselves in the couple's guest list and confirm the household
 * they belong to. If they aren't on it, the only other door is asking the couple
 * to add them; nothing here lets a guest invent a household.
 */
export function Claim({ slug, next }: { slug: string; next: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const [query, setQuery] = useState("");
  // Results are stamped with the query that produced them, so a stale list is
  // never shown against a newer one — and nothing has to be cleared on the way.
  const [result, setResult] = useState<{ query: string; matches: GuestMatch[] } | null>(null);
  const [confirming, setConfirming] = useState<GuestMatch | null>(null);

  const [asking, setAsking] = useState(false);
  const [askName, setAskName] = useState("");
  const [askNote, setAskNote] = useState("");
  const [asked, setAsked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = query.trim();
  const matches = result?.query === trimmed ? result.matches : null;
  const searching = trimmed.length >= 2 && matches === null;

  // Type-ahead, debounced so a name isn't a query per keystroke.
  useEffect(() => {
    if (confirming || trimmed.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const found = await searchGuests(slug, trimmed);
      if (!cancelled) setResult({ query: trimmed, matches: found.ok ? found.matches : [] });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed, slug, confirming]);

  const confirm = (match: GuestMatch) =>
    start(async () => {
      setError(null);
      const result = await claimHousehold(slug, match.guestId);
      if (result.ok) {
        router.replace(next);
        router.refresh();
      } else {
        setError(result.error);
        setConfirming(null);
      }
    });

  const send = () =>
    start(async () => {
      setError(null);
      const result = await requestInvite(slug, askName || query, askNote);
      if (result.ok) setAsked(true);
      else setError(result.error);
    });

  // ---------------------------------------------------------- confirming --

  if (confirming) {
    return (
      <>
        <ScreenTitle>Is this you?</ScreenTitle>
        <Lede>One reply covers your whole household, so check the names before you go on.</Lede>

        <Panel style={{ marginTop: 18, borderColor: "var(--acc)" }}>
          <div style={{ fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", color: "var(--mut)" }}>
            {confirming.householdLabel}
          </div>
          <div style={{ marginTop: 8, fontSize: 18, fontFamily: "var(--serif)", lineHeight: 1.35 }}>
            {confirming.members.length ? confirming.members.join(" · ") : confirming.guestName}
          </div>
          {confirming.alreadyReplied ? (
            <div style={{ marginTop: 10, fontSize: 12, color: "var(--mut)", lineHeight: 1.5 }}>
              This household has already replied — you&apos;ll be able to see it and change it.
            </div>
          ) : null}
        </Panel>

        {error ? (
          <div style={{ marginTop: 14, fontSize: 12.5, fontWeight: 800, color: "#b8240e" }}>{error}</div>
        ) : null}

        <button type="button" onClick={() => confirm(confirming)} disabled={pending} style={{ ...accentButtonStyle, marginTop: 16, opacity: pending ? 0.6 : 1 }}>
          {pending ? "One moment…" : "Yes, that's us →"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(null)}
          style={{ ...accentButtonStyle, marginTop: 8, background: "transparent", color: "var(--mut)", border: "1px solid var(--line)" }}
        >
          Not us — go back
        </button>
      </>
    );
  }

  // ------------------------------------------------------------- asking --

  if (asking) {
    return (
      <>
        <ScreenTitle>Ask to be added</ScreenTitle>
        <Lede>
          {asked
            ? "Sent. The couple will see your request and text you a link if they add you."
            : "We'll pass this to the couple. If they add you, they'll send you your own link."}
        </Lede>

        {!asked ? (
          <>
            <input
              value={askName || query}
              onChange={(e) => setAskName(e.target.value)}
              placeholder="Your full name"
              style={{ ...inputStyle, marginTop: 18 }}
            />
            <textarea
              value={askNote}
              onChange={(e) => setAskNote(e.target.value)}
              rows={3}
              placeholder="Anything that helps them place you — “Devon's cousin”"
              style={{ ...inputStyle, marginTop: 8, resize: "vertical" }}
            />
            {error ? (
              <div style={{ marginTop: 12, fontSize: 12.5, fontWeight: 800, color: "#b8240e" }}>{error}</div>
            ) : null}
            <button type="button" onClick={send} disabled={pending} style={{ ...accentButtonStyle, marginTop: 14, opacity: pending ? 0.6 : 1 }}>
              {pending ? "Sending…" : "Send the request"}
            </button>
          </>
        ) : null}

        <button
          type="button"
          onClick={() => {
            setAsking(false);
            setAsked(false);
          }}
          style={{ ...accentButtonStyle, marginTop: 8, background: "transparent", color: "var(--mut)", border: "1px solid var(--line)" }}
        >
          Back to the search
        </button>
      </>
    );
  }

  // ------------------------------------------------------------ finding --

  return (
    <>
      <ScreenTitle>Which one are you?</ScreenTitle>
      <Lede>
        Find your name on the couple&apos;s list. If you got a link by text, open that instead and this is already
        done.
      </Lede>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Start typing your name"
        autoFocus
        autoComplete="off"
        style={{ ...inputStyle, marginTop: 18 }}
      />

      {trimmed.length >= 2 ? (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {searching ? (
            <div style={{ fontSize: 12.5, color: "var(--mut)" }}>Looking…</div>
          ) : matches && matches.length ? (
            matches.map((match) => (
              <button
                key={match.guestId}
                type="button"
                onClick={() => setConfirming(match)}
                style={{
                  ...panelStyle,
                  padding: "13px 14px",
                  textAlign: "left",
                  cursor: "pointer",
                  color: "var(--ink)",
                  fontFamily: "inherit",
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 800 }}>{match.guestName}</div>
                <div style={{ fontSize: 11.5, color: "var(--mut)", marginTop: 3 }}>
                  {match.householdLabel}
                  {match.alreadyReplied ? " · already replied" : ""}
                </div>
              </button>
            ))
          ) : (
            <div style={{ fontSize: 12.5, color: "var(--mut)", lineHeight: 1.6 }}>
              Nobody by that name on the list.
            </div>
          )}
        </div>
      ) : null}

      {error ? (
        <div style={{ marginTop: 14, fontSize: 12.5, fontWeight: 800, color: "#b8240e" }}>{error}</div>
      ) : null}

      <button
        type="button"
        onClick={() => setAsking(true)}
        style={{
          ...accentButtonStyle,
          marginTop: 20,
          background: "transparent",
          color: "var(--acc)",
          border: "1px solid var(--acc)",
        }}
      >
        Can&apos;t find yourself? Ask the couple to add you
      </button>
    </>
  );
}
