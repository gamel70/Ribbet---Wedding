"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { addHousehold, approveRequest, declineRequest, removeHousehold } from "./actions";

const INK = "#201e1d";
const RULE = "#e0dcd4";

export type InviteRow = { id: string; household: string; names: string; inviteToken: string; replied: boolean };
export type RequestRow = { id: string; name: string; note: string | null; createdAt: string };
export type FeedRow = { id: string; kind: string; summary: string; createdAt: string };

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

const button: React.CSSProperties = {
  padding: "10px 14px",
  border: `2px solid ${INK}`,
  background: "transparent",
  color: INK,
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
  fontFamily: "inherit",
};

/**
 * The guest list, its invite links, the approve queue and the RSVP feed.
 *
 * The invite link is the whole identity story without SMS: the couple copies a
 * household's link and texts it themselves from their own phone. No Twilio, no
 * per-message cost, and the household is identified the moment they tap it.
 */
export function Invites({
  origin,
  invites,
  requests,
  feed,
  accent,
  accentInk,
}: {
  origin: string;
  invites: InviteRow[];
  requests: RequestRow[];
  feed: FeedRow[];
  accent: string;
  accentInk: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [names, setNames] = useState("");
  const [error, setError] = useState<string | null>(null);

  const linkFor = (token: string) => `${origin}/i/${token}`;

  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(linkFor(token));
      setCopied(token);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopied(null);
    }
  };

  const cta = { ...button, border: `2px solid ${accent}`, background: accent, color: accentInk };

  return (
    <>
      {/* ------------------------------------------------ approve queue --- */}
      {requests.length ? (
        <div style={{ border: `2px solid ${accent}`, padding: 16, marginBottom: 26 }}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>
            {requests.length} {requests.length === 1 ? "person is" : "people are"} asking to be added
          </div>
          <div style={{ fontSize: 12, opacity: 0.65, marginTop: 4, lineHeight: 1.5 }}>
            They couldn&apos;t find themselves on your list. Approving creates their household and their invite link.
          </div>

          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {requests.map((request) => (
              <div
                key={request.id}
                style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", borderTop: `1px solid ${RULE}`, paddingTop: 10 }}
              >
                <div style={{ flex: "1 1 220px" }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{request.name}</div>
                  {request.note ? (
                    <div style={{ fontSize: 11.5, opacity: 0.6, marginTop: 2 }}>{request.note}</div>
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await approveRequest(request.id, request.name);
                      router.refresh();
                    })
                  }
                  style={cta}
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await declineRequest(request.id);
                      router.refresh();
                    })
                  }
                  style={button}
                >
                  Decline
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* --------------------------------------------------- add a row --- */}
      <div style={{ border: `2px solid ${RULE}`, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 800 }}>Add a household</div>
        <div style={{ fontSize: 12, opacity: 0.65, marginTop: 4, lineHeight: 1.5 }}>
          One row per invitation, not per person — a couple, a family, a single friend. Separate names with commas.
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Marchetti-Lee"
            style={{ ...inputStyle, flex: "1 1 180px" }}
          />
          <input
            value={names}
            onChange={(e) => setNames(e.target.value)}
            placeholder="Rosa Marchetti, Devon Lee"
            style={{ ...inputStyle, flex: "2 1 260px" }}
          />
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                const result = await addHousehold(label, names.split(","));
                if (result.ok) {
                  setLabel("");
                  setNames("");
                  router.refresh();
                } else {
                  setError(result.error);
                }
              })
            }
            style={cta}
          >
            Add
          </button>
        </div>
        {error ? <div style={{ marginTop: 10, fontSize: 12, color: "#b8240e", fontWeight: 800 }}>{error}</div> : null}
      </div>

      {/* ------------------------------------------------ invite links --- */}
      <div style={{ marginTop: 26 }}>
        <div style={{ fontSize: 13, fontWeight: 800 }}>Invite links</div>
        <div style={{ fontSize: 12, opacity: 0.65, marginTop: 4, lineHeight: 1.5, maxWidth: 620 }}>
          Copy a link and text it yourself from your own phone. Whoever opens it is that household — they never type a
          code, and anyone who arrives at the plain link instead can find their own name.
        </div>

        {invites.length ? (
          <div style={{ marginTop: 14 }}>
            {invites.map((row) => (
              <div
                key={row.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.4fr 2fr auto auto",
                  gap: 10,
                  alignItems: "center",
                  padding: "11px 0",
                  borderBottom: `1px solid ${RULE}`,
                }}
              >
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>{row.household}</div>
                  <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>{row.names || "—"}</div>
                </div>
                <div
                  style={{
                    fontSize: 11.5,
                    opacity: 0.6,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {linkFor(row.inviteToken)}
                </div>
                <button type="button" onClick={() => copy(row.inviteToken)} style={button}>
                  {copied === row.inviteToken ? "Copied" : "Copy link"}
                </button>
                <button
                  type="button"
                  disabled={pending || row.replied}
                  title={row.replied ? "They've already replied — removing would lose it" : "Remove"}
                  onClick={() =>
                    start(async () => {
                      await removeHousehold(row.id);
                      router.refresh();
                    })
                  }
                  style={{ ...button, opacity: row.replied ? 0.3 : 1, cursor: row.replied ? "not-allowed" : "pointer" }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ marginTop: 14, fontSize: 13, opacity: 0.6 }}>
            No households yet. Add one above and its link appears here.
          </div>
        )}
      </div>

      {/* -------------------------------------------------- RSVP feed --- */}
      <div style={{ marginTop: 30 }}>
        <div style={{ fontSize: 13, fontWeight: 800 }}>RSVP feed</div>
        <div style={{ fontSize: 12, opacity: 0.65, marginTop: 4 }}>
          Every claim, reply and change, newest first.
        </div>

        {feed.length ? (
          <div style={{ marginTop: 12 }}>
            {feed.map((event) => (
              <div
                key={event.id}
                style={{ display: "flex", gap: 12, padding: "9px 0", borderBottom: `1px solid ${RULE}`, alignItems: "baseline" }}
              >
                <span
                  style={{
                    flex: "none",
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: ".1em",
                    textTransform: "uppercase",
                    padding: "3px 7px",
                    border: `1px solid ${event.kind === "changed" ? accent : RULE}`,
                    color: event.kind === "changed" ? accent : INK,
                    opacity: event.kind === "changed" ? 1 : 0.55,
                    minWidth: 74,
                    textAlign: "center",
                  }}
                >
                  {event.kind}
                </span>
                <span style={{ flex: 1, fontSize: 13 }}>{event.summary}</span>
                <span style={{ flex: "none", fontSize: 11, opacity: 0.5 }}>
                  {new Date(event.createdAt).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ marginTop: 12, fontSize: 13, opacity: 0.6 }}>Nothing yet.</div>
        )}
      </div>
    </>
  );
}
