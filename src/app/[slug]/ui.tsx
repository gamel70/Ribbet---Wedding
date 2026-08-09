import type { CSSProperties, ReactNode } from "react";

/**
 * The shared vocabulary of the guest screens, straight out of
 * `Ribbet App Structure.dc.html`: a 34px serif title, a muted lede, uppercase
 * eyebrows with wide tracking, and panels that pick up the layout's radius.
 *
 * Everything reads its colour from the CSS custom properties the guest layout
 * sets, so a screen never needs to know which theme it's in.
 */

export function ScreenTitle({ children }: { children: ReactNode }) {
  return <h1 style={{ fontSize: 34, fontFamily: "var(--serif)", margin: 0, fontWeight: 400 }}>{children}</h1>;
}

export function SubTitle({ children }: { children: ReactNode }) {
  return <h2 style={{ fontSize: 24, fontFamily: "var(--serif)", margin: 0, fontWeight: 400 }}>{children}</h2>;
}

export function Lede({ children }: { children: ReactNode }) {
  return (
    <p style={{ marginTop: 8, marginBottom: 0, fontSize: 13, lineHeight: 1.55, color: "var(--mut)" }}>
      {children}
    </p>
  );
}

export function Eyebrow({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        fontSize: 10,
        letterSpacing: ".24em",
        textTransform: "uppercase",
        color: "var(--mut)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export const panelStyle: CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--line)",
  borderRadius: "var(--rad)",
};

export function Panel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ ...panelStyle, padding: "14px 15px", ...style }}>{children}</div>;
}

/** The solid accent call to action used at the foot of most screens. */
export const accentButtonStyle: CSSProperties = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  padding: "14px 16px",
  background: "var(--acc)",
  color: "var(--acc-ink)",
  fontWeight: 800,
  fontSize: 14,
  borderRadius: "var(--rad)",
  border: "none",
  textAlign: "center",
  textDecoration: "none",
  cursor: "pointer",
  fontFamily: "inherit",
};

/**
 * Shown in place of any form when this browser hasn't proved which household it
 * belongs to. Reading the app never needs this; writing to it always does.
 */
export function IdentifyPrompt({
  slug,
  next,
  what,
}: {
  slug: string;
  next: string;
  what: string;
}) {
  return (
    <div
      style={{
        ...panelStyle,
        padding: "18px 16px",
        marginTop: 14,
        borderStyle: "dashed",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 800 }}>Tell us who you are first</div>
      <div style={{ fontSize: 12, lineHeight: 1.6, color: "var(--mut)", marginTop: 5 }}>
        {what} goes to the couple with your name on it. Find yourself on their guest list — or open the link they
        texted you, and this is already done.
      </div>
      <a
        href={`/${slug}/who?next=${encodeURIComponent(next)}`}
        style={{ ...accentButtonStyle, marginTop: 14, width: "auto" }}
      >
        Find my name →
      </a>
    </div>
  );
}

/** A single line of the "waiting on you" list. */
export function RowLink({
  href,
  index,
  label,
  done,
}: {
  href: string;
  index: number;
  label: string;
  done?: boolean;
}) {
  return (
    <a
      href={href}
      style={{
        ...panelStyle,
        display: "flex",
        alignItems: "center",
        gap: 13,
        padding: "14px 15px",
        color: "var(--ink)",
        textDecoration: "none",
        opacity: done ? 0.55 : 1,
      }}
    >
      <span
        style={{
          width: 23,
          height: 23,
          flex: "none",
          border: "1px solid var(--acc)",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10,
          color: "var(--acc)",
          background: done ? "var(--acc)" : "transparent",
          ...(done ? { color: "var(--acc-ink)" } : null),
        }}
      >
        {done ? "✓" : index}
      </span>
      <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{label}</span>
      <span style={{ opacity: 0.45 }}>→</span>
    </a>
  );
}

