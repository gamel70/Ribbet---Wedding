"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { Eyebrow, accentButtonStyle, panelStyle } from "./ui";

/**
 * "Add to home screen", asked once and politely.
 *
 * Three rules the design implies and this keeps: never ask someone who has
 * already installed it, never ask twice after a no, and never show an
 * instruction for a phone the guest isn't holding — iOS has to be told about
 * the Share sheet, Android gets a real button.
 */

type Platform = "ios" | "android" | "other";

/** Chrome's install event. Not in lib.dom yet, so it's spelled out here. */
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Facts = { platform: Platform; blocked: boolean };

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  // iPadOS 13+ reports itself as a Mac; the touch points give it away.
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}

function alreadyInstalled(): boolean {
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  // iOS Safari never adopted display-mode; this is its own flag.
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function storageKey(slug: string): string {
  return `ribbet-install-hint-${slug}`;
}

function alreadySaidNo(slug: string): boolean {
  try {
    return window.localStorage.getItem(storageKey(slug)) === "dismissed";
  } catch {
    // Private mode with storage blocked. Asking once a visit is the gentler
    // failure than never asking at all.
    return false;
  }
}

/**
 * These are browser facts, not React state, and none of them exist on the
 * server — which is what `useSyncExternalStore` is for. The snapshot has to be
 * referentially stable or the store re-renders forever, so each slug's answer
 * is read once and remembered for the life of the tab. That memory is also what
 * stops a dismissed banner reappearing when the guest tabs away and back.
 */
const factsBySlug = new Map<string, Facts>();

function factsFor(slug: string): Facts {
  let facts = factsBySlug.get(slug);
  if (!facts) {
    facts = { platform: detectPlatform(), blocked: alreadyInstalled() || alreadySaidNo(slug) };
    factsBySlug.set(slug, facts);
  }
  return facts;
}

function block(slug: string): void {
  const facts = factsBySlug.get(slug);
  if (facts) factsBySlug.set(slug, { ...facts, blocked: true });
}

/** Nothing re-reads the facts; the events that matter are subscribed below. */
const noSubscription = () => () => {};
const noServerSnapshot = () => null;

export function InstallHint({ slug, appName }: { slug: string; appName: string }) {
  const facts = useSyncExternalStore(noSubscription, () => factsFor(slug), noServerSnapshot);

  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      // Holding on to it is what lets the button below be a real install.
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      block(slug);
      setHidden(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [slug]);

  const dismiss = () => {
    block(slug);
    setHidden(true);
    try {
      window.localStorage.setItem(storageKey(slug), "dismissed");
    } catch {
      // Nothing to do — it stays hidden for this visit either way.
    }
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    // Chrome fires the event once. Either they installed it, or they said no to
    // the real dialog — neither deserves a second ask.
    setInstallEvent(null);
    dismiss();
  };

  // `facts` is null until the browser has been read, which keeps the banner
  // from flashing on a phone that already has the app.
  if (!facts || facts.blocked || hidden) return null;

  // Desktop only gets this if the browser volunteered an install path.
  if (facts.platform === "other" && !installEvent) return null;

  return (
    <section
      style={{
        ...panelStyle,
        marginTop: 20,
        padding: "15px 16px",
        borderLeft: "3px solid var(--acc)",
        animation: "rbIn 250ms ease both",
      }}
    >
      <Eyebrow>Keep it handy</Eyebrow>

      <div style={{ marginTop: 7, fontSize: 15, fontFamily: "var(--serif)", lineHeight: 1.3 }}>
        Add {appName} to your home screen
      </div>

      <p style={{ margin: "6px 0 0", fontSize: 12.5, lineHeight: 1.6, color: "var(--mut)" }}>
        It opens full screen, remembers who you are, and the schedule and your own photos still work when the
        signal doesn&apos;t.
      </p>

      {facts.platform === "ios" ? (
        <ol
          style={{
            margin: "11px 0 0",
            padding: 0,
            listStyle: "none",
            fontSize: 12.5,
            lineHeight: 1.7,
            color: "var(--mut)",
          }}
        >
          <li style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <ShareGlyph /> Tap Share, at the bottom of Safari
          </li>
          <li style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <PlusGlyph /> Choose &ldquo;Add to Home Screen&rdquo;
          </li>
        </ol>
      ) : installEvent ? (
        <button type="button" onClick={install} style={{ ...accentButtonStyle, marginTop: 12 }}>
          Add to home screen
        </button>
      ) : (
        <p style={{ margin: "11px 0 0", fontSize: 12.5, lineHeight: 1.6, color: "var(--mut)" }}>
          Open your browser&apos;s menu and choose &ldquo;Install app&rdquo; or &ldquo;Add to Home screen&rdquo;.
        </p>
      )}

      <button
        type="button"
        onClick={dismiss}
        style={{
          marginTop: 11,
          padding: 0,
          background: "none",
          border: "none",
          font: "inherit",
          fontSize: 11,
          letterSpacing: ".14em",
          textTransform: "uppercase",
          color: "var(--mut)",
          cursor: "pointer",
        }}
      >
        Not now
      </button>
    </section>
  );
}

/** 24px viewBox, 1.8 stroke, round caps — the app's one icon style. */
function Glyph({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--acc)"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flex: "none" }}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function ShareGlyph() {
  return (
    <Glyph>
      <path d="M7.5 10.5H6A1.5 1.5 0 0 0 4.5 12v7A1.5 1.5 0 0 0 6 20.5h12a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5h-1.5" />
      <path d="M12 14.5V4" />
      <path d="m8.6 7.4 3.4-3.4 3.4 3.4" />
    </Glyph>
  );
}

function PlusGlyph() {
  return (
    <Glyph>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M12 8.5v7M8.5 12h7" />
    </Glyph>
  );
}
