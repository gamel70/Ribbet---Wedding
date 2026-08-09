"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { submitGuestbookNote, submitSong } from "../actions";
import { accentButtonStyle, panelStyle } from "../ui";

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

/** Post-first moderation — the note is on the wall as soon as it's written. */
export function GuestbookForm({ slug }: { slug: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [author, setAuthor] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const send = () =>
    start(async () => {
      setError(null);
      const result = await submitGuestbookNote(slug, author, body);
      if (result.ok) {
        setBody("");
        router.refresh();
      } else {
        setError(result.error ?? "That didn't send.");
      }
    });

  return (
    <div style={{ ...panelStyle, padding: "14px 15px", marginTop: 12, borderStyle: "dashed" }}>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="Write something for the wall…"
        style={{ ...inputStyle, resize: "vertical" }}
      />
      <input
        value={author}
        onChange={(e) => setAuthor(e.target.value)}
        placeholder="Your name"
        style={{ ...inputStyle, marginTop: 8 }}
      />
      {error ? <div style={{ marginTop: 8, fontSize: 12, color: "#b8240e", fontWeight: 700 }}>{error}</div> : null}
      <button type="button" onClick={send} disabled={pending} style={{ ...accentButtonStyle, marginTop: 10, opacity: pending ? 0.6 : 1 }}>
        {pending ? "Posting…" : "Add to the wall"}
      </button>
    </div>
  );
}

/** One request per household — sending again replaces the last one. */
export function SongForm({
  slug,
  currentTitle,
  currentArtist,
}: {
  slug: string;
  currentTitle: string;
  currentArtist: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState(currentTitle);
  const [artist, setArtist] = useState(currentArtist);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const send = () =>
    start(async () => {
      setError(null);
      const result = await submitSong(slug, title, artist);
      if (result.ok) {
        setSaved(true);
        router.refresh();
      } else {
        setError(result.error ?? "That didn't send.");
      }
    });

  return (
    <div style={{ marginTop: 12 }}>
      <input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          setSaved(false);
        }}
        placeholder="Song title"
        style={inputStyle}
      />
      <input
        value={artist}
        onChange={(e) => {
          setArtist(e.target.value);
          setSaved(false);
        }}
        placeholder="Artist"
        style={{ ...inputStyle, marginTop: 6 }}
      />
      {error ? <div style={{ marginTop: 8, fontSize: 12, color: "#b8240e", fontWeight: 700 }}>{error}</div> : null}
      {saved ? (
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--mut)" }}>On the couple&apos;s DJ list.</div>
      ) : null}
      <button type="button" onClick={send} disabled={pending} style={{ ...accentButtonStyle, marginTop: 10, opacity: pending ? 0.6 : 1 }}>
        {pending ? "Sending…" : currentTitle ? "Change my request" : "Send to the DJ"}
      </button>
    </div>
  );
}
