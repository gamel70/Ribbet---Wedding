"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { signIn, signOut } from "next-auth/react";

import type { Layout, Palette, SectionKey, Sections } from "@/db/schema";
import { daysUntil, parseDateText } from "@/lib/dates";
import {
  ACCENTS,
  FREE_TIER_GB,
  LAYOUTS,
  LAYOUT_ORDER,
  PALETTES,
  SECTION_DEFS,
  accentInk,
  resolveAccent,
  sheetTabsFor,
  storageEstimateGb,
} from "@/lib/design";
import {
  MIN_DOMAIN_LENGTH,
  MIN_SLUG_LENGTH,
  RESERVED_DOMAINS,
  autoDomain,
  autoSlug,
  cleanDomain,
  cleanSlug,
  domainSuggestions,
  slugSuggestions,
} from "@/lib/slug";
import { buildWedding, checkSlugAvailability, saveIntake, type SlugCheckResult } from "./actions";
import { PreviewPhone } from "./preview-phone";

export type WizardInitial = {
  signedIn: boolean;
  account: { name: string | null; email: string | null } | null;
  step: number;
  nameOne: string;
  nameTwo: string;
  dateText: string;
  venue: string;
  guestCount: string;
  /** null means "still deriving from the names", exactly as the design does. */
  slugOverride: string | null;
  domainOverride: string | null;
  domainMode: "own" | "free";
  layout: Layout;
  palette: Palette;
  accent: string | null;
  sections: Sections;
  built: boolean;
  publicUrl: string | null;
  sheetName: string | null;
  sheetUrl: string | null;
  folderName: string | null;
  folderUrl: string | null;
};

const INK = "#201e1d";
const RULE = "#e0dcd4";
const ERROR = "#b8240e";
const GOOGLE_GREEN = "#0f9d58";

const LAB: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  letterSpacing: ".14em",
  textTransform: "uppercase",
  opacity: 0.55,
  marginBottom: 7,
};

const INPUT: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: 12,
  border: `2px solid ${INK}`,
  background: "#fff",
  fontSize: 14,
  borderRadius: 0,
  outline: "none",
};

const STEP_DEFS: Array<[number, string, string]> = [
  [1, "Google", "Required"],
  [2, "Details", "Names, date, address"],
  [3, "Sections", "What guests get"],
  [4, "Design", "Layout and palette"],
  [5, "Build", "App + Sheet"],
];

export function IntakeWizard({ initial }: { initial: WizardInitial }) {
  const [step, setStep] = useState(initial.step);
  const [n1, setN1] = useState(initial.nameOne);
  const [n2, setN2] = useState(initial.nameTwo);
  const [dateText, setDateText] = useState(initial.dateText);
  const [venue, setVenue] = useState(initial.venue);
  const [guestCount, setGuestCount] = useState(initial.guestCount);
  const [slugOverride, setSlugOverride] = useState(initial.slugOverride);
  const [domainOverride, setDomainOverride] = useState(initial.domainOverride);
  const [domainMode, setDomainMode] = useState(initial.domainMode);
  const [layout, setLayout] = useState(initial.layout);
  const [palette, setPalette] = useState(initial.palette);
  const [accentOverride, setAccentOverride] = useState(initial.accent);
  const [on, setOn] = useState<Sections>(initial.sections);

  const [built, setBuilt] = useState(initial.built);
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [publicUrl, setPublicUrl] = useState(initial.publicUrl);
  const [sheetName, setSheetName] = useState(initial.sheetName);
  const [sheetUrl, setSheetUrl] = useState(initial.sheetUrl);
  const [folderName, setFolderName] = useState(initial.folderName);
  const [folderUrl, setFolderUrl] = useState(initial.folderUrl);

  const [slugVerdict, setSlugVerdict] = useState<SlugCheckResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [, startSaving] = useTransition();

  const signedIn = initial.signedIn;

  // ---- derived values, mirroring renderVals() in the design file ----------

  const accent = resolveAccent(palette, accentOverride);
  const accInk = accentInk(accent);
  const L = LAYOUTS[layout];

  const slug = slugOverride === null ? autoSlug(n1, n2) : cleanSlug(slugOverride) || "our-wedding";
  const slugInput = slugOverride === null ? autoSlug(n1, n2) : slugOverride;

  const own = domainMode === "own";
  const domainRaw = domainOverride === null ? autoDomain(n1, n2, dateText) : domainOverride;
  const domain = cleanDomain(domainRaw) || "ourwedding";
  const domainTaken = RESERVED_DOMAINS.has(domain);
  const domainShort = domain.length < MIN_DOMAIN_LENGTH;
  const domainOk = !domainTaken && !domainShort;

  const activeCount = SECTION_DEFS.filter((d) => d.locked || on[d.key]).length;
  const tabsFor = sheetTabsFor(on);
  const sheetTabsLine = `Tabs right now: ${tabsFor.join(" · ")}.`;

  const finalAddress = own ? `${domain}.com` : `ribbet.app/${slug}`;

  /** "checking" only shows while the debounced verdict is behind the input. */
  const slugStatus: "short" | "checking" | "taken" | "ok" =
    slug.length < MIN_SLUG_LENGTH
      ? "short"
      : !slugVerdict || slugVerdict.slug !== slug
        ? "checking"
        : slugVerdict.ok
          ? "ok"
          : "taken";

  // The countdown reads the clock, so it only renders after mount — otherwise
  // the server's UTC "today" and the viewer's local one can disagree by a day
  // and React reports a hydration mismatch.
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false);
  const parsedDate = parseDateText(dateText);
  const daysToGo = mounted && parsedDate ? daysUntil(parsedDate) : null;

  // ---- persistence -------------------------------------------------------

  const patch = useMemo(
    () => ({
      step,
      nameOne: n1,
      nameTwo: n2,
      dateText,
      venue,
      guestCount,
      slug,
      domainMode,
      domain: own ? domain : "",
      layout,
      palette,
      accent: accentOverride,
      sections: on,
    }),
    [step, n1, n2, dateText, venue, guestCount, slug, domainMode, domain, own, layout, palette, accentOverride, on],
  );

  // "Create it" reads this so it can flush the form before provisioning, rather
  // than racing the debounced save below.
  const patchRef = useRef(patch);
  useEffect(() => {
    patchRef.current = patch;
  }, [patch]);

  // Save progress on every change, debounced — closing the tab halfway and
  // reopening /setup has to resume where it left off.
  useEffect(() => {
    if (!signedIn) return;
    const timer = setTimeout(() => {
      startSaving(async () => {
        try {
          await saveIntake(patch);
        } catch {
          // A dropped save is retried by the next keystroke; the couple is
          // never blocked on it.
        }
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [patch, signedIn]);

  // Slug availability: reserved list plus a real uniqueness check, debounced to
  // 300ms per the interaction notes.
  useEffect(() => {
    // Too short never reaches the server — the length rule is the same on both
    // sides, and `slugStatus` reads it straight off the current slug.
    if (!signedIn || slug.length < MIN_SLUG_LENGTH) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const verdict = await checkSlugAvailability(slug);
        if (!cancelled) setSlugVerdict(verdict);
      } catch {
        if (!cancelled) setSlugVerdict(null);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [slug, signedIn]);

  const reachable = useCallback((n: number) => n === 1 || signedIn, [signedIn]);

  const go = (n: number) => {
    if (reachable(n)) setStep(n);
  };

  const next = () => setStep((s) => Math.min(5, s + 1));

  const toggleSection = (key: SectionKey, locked: boolean) => {
    if (locked) return;
    setOn((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const runBuild = async () => {
    setBuilding(true);
    setBuildError(null);
    try {
      // Flush the current form before provisioning so the folder and the sheet
      // are named from what's on screen, not from the last debounced save.
      await saveIntake(patchRef.current);
      const result = await buildWedding();
      if (result.ok) {
        setBuilt(true);
        setPublicUrl(result.publicUrl);
        setSheetName(result.result.sheetName);
        setSheetUrl(result.result.sheetUrl);
        setFolderName(result.result.folderName);
        setFolderUrl(result.result.folderUrl);
      } else {
        setBuildError(result.error);
      }
    } catch (error) {
      setBuildError(error instanceof Error ? error.message : String(error));
    } finally {
      setBuilding(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`https://${publicUrl ?? finalAddress}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  // ---- shared styles -----------------------------------------------------

  const cta: React.CSSProperties = {
    marginTop: 28,
    padding: "15px 22px",
    border: `2px solid ${accent}`,
    background: accent,
    color: accInk,
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
  };

  const pane: React.CSSProperties = { animation: "rbIn .25s ease both" };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#e6e4e2",
        fontFamily: "var(--font-karla), sans-serif",
        color: INK,
        padding: "44px 44px 80px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 16,
          borderBottom: `2px solid ${INK}`,
          paddingBottom: 14,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-fraunces), serif",
            fontWeight: 600,
            fontSize: 26,
            letterSpacing: "-.02em",
          }}
        >
          Ribbet
        </span>
        <span style={{ fontSize: 12, letterSpacing: ".14em", textTransform: "uppercase", opacity: 0.6 }}>
          Set up your wedding
        </span>
        {initial.account?.email ? (
          <span style={{ marginLeft: "auto", fontSize: 12, opacity: 0.6 }}>
            {initial.account.email}
            {" · "}
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/setup" })}
              style={{ border: 0, background: "transparent", padding: 0, font: "inherit", cursor: "pointer", textDecoration: "underline" }}
            >
              sign out
            </button>
          </span>
        ) : null}
      </div>

      <div style={{ display: "flex", gap: 36, alignItems: "flex-start", marginTop: 26 }}>
        <div
          style={{
            flex: "none",
            width: 880,
            height: 860,
            background: "#fff",
            border: `2px solid ${INK}`,
            boxShadow: "0 24px 60px rgba(0,0,0,.18)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* step rail */}
          <div style={{ flex: "none", display: "flex", borderBottom: `2px solid ${INK}` }}>
            {STEP_DEFS.map(([n, label, sub]) => {
              const isOn = step === n;
              const done = step > n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => go(n)}
                  disabled={!reachable(n)}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 11,
                    padding: "14px 15px",
                    border: 0,
                    borderRight: `1px solid ${RULE}`,
                    background: isOn ? INK : "transparent",
                    color: isOn ? "#fff" : INK,
                    cursor: reachable(n) ? "pointer" : "default",
                    opacity: reachable(n) ? 1 : 0.4,
                  }}
                >
                  <span
                    style={{
                      width: 24,
                      height: 24,
                      flex: "none",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 800,
                      border: `2px solid ${isOn ? "#fff" : done ? accent : INK}`,
                      background: done ? accent : "transparent",
                      color: done ? accInk : "inherit",
                    }}
                  >
                    {done ? "✓" : String(n)}
                  </span>
                  <span style={{ textAlign: "left" }}>
                    <span style={{ display: "block", fontSize: 12, fontWeight: 800, letterSpacing: ".04em" }}>
                      {label}
                    </span>
                    <span style={{ display: "block", fontSize: 10, opacity: 0.6, marginTop: 2 }}>{sub}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="rb" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
            {/* ---------------------------------------------- STEP 1 · GOOGLE */}
            {step === 1 && (
              <div style={{ ...pane, padding: "44px 54px" }}>
                <div style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 38, lineHeight: 1.1, maxWidth: 520 }}>
                  Connect the Google account you want this wedding to live in.
                </div>
                <div style={{ marginTop: 14, fontSize: 14, lineHeight: 1.65, opacity: 0.72, maxWidth: 560 }}>
                  Ribbet doesn&apos;t keep your wedding on our servers — it builds inside your Drive. That&apos;s why
                  this step isn&apos;t skippable, and why everything survives us.
                </div>

                <div
                  style={{
                    marginTop: 22,
                    padding: "15px 17px",
                    borderLeft: `3px solid ${accent}`,
                    background: "#faf8f4",
                    maxWidth: 600,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".04em" }}>
                    One permission. The narrowest one Google offers.
                  </div>
                  <div style={{ fontSize: 12.5, lineHeight: 1.6, opacity: 0.72, marginTop: 6 }}>
                    Ribbet asks for <strong>drive.file</strong> — access to files this app creates, and nothing else.
                    Not your mail, not your photos, not a single file that was already in your Drive. Google classes it
                    non-sensitive, which is why you won&apos;t see a scary unverified-app warning.
                  </div>
                </div>

                <div style={{ marginTop: 28, display: "flex", gap: 14, alignItems: "stretch", maxWidth: 640 }}>
                  <PromiseCard
                    accent={accent}
                    title="A Drive folder"
                    body="Every guest photo lands here, full resolution, private to you."
                    icon={
                      <>
                        <path d="M3 15.5 9 4h6l6 11.5" />
                        <path d="M3 15.5 6 20h12l3-4.5" />
                        <path d="M9 4 15 15.5H3" />
                      </>
                    }
                  />
                  <PromiseCard
                    accent={accent}
                    title="One spreadsheet"
                    body="Created by Ribbet, so it falls under the same single permission. RSVPs, meals, songs, gifts, thank-yous."
                    icon={
                      <>
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <path d="M3 9h18M9 9v12" />
                      </>
                    }
                  />
                  <PromiseCard
                    accent={accent}
                    title="It stays yours"
                    body="Cancel Ribbet tomorrow and the folder and Sheet are still in your account."
                    icon={
                      <>
                        <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
                        <circle cx="12" cy="10" r="2.6" />
                      </>
                    }
                  />
                </div>

                {!signedIn ? (
                  <>
                    <button
                      type="button"
                      onClick={() => signIn("google", { callbackUrl: "/setup" })}
                      style={{
                        marginTop: 30,
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "14px 20px",
                        background: "#fff",
                        border: `2px solid ${INK}`,
                        cursor: "pointer",
                      }}
                    >
                      <GoogleMark />
                      <span style={{ fontSize: 15, fontWeight: 800 }}>Sign in with Google</span>
                    </button>
                    <div style={{ marginTop: 14, fontSize: 12, lineHeight: 1.6, opacity: 0.6, maxWidth: 560 }}>
                      Signing in also tells us your name and email, so we know where to send the link. That&apos;s the
                      whole ask.
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ ...pane, marginTop: 30, border: `2px solid ${GOOGLE_GREEN}`, padding: 18, maxWidth: 560 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <div
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius: "50%",
                            background: accent,
                            color: accInk,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 16,
                            fontWeight: 800,
                          }}
                        >
                          {(initial.account?.name ?? initial.account?.email ?? "?").charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 800 }}>{initial.account?.email}</div>
                          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>
                            Connected · Ribbet can now build in your Drive
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: GOOGLE_GREEN, fontWeight: 800 }}>✓</div>
                      </div>
                      <div
                        style={{
                          marginTop: 14,
                          paddingTop: 14,
                          borderTop: `1px solid ${RULE}`,
                          fontSize: 12,
                          lineHeight: 1.6,
                          opacity: 0.7,
                        }}
                      >
                        {n2 || "Your partner"} can be added as a second owner later — same Drive folder, same Sheet,
                        both of you edit.
                      </div>
                    </div>
                    <button type="button" onClick={next} style={cta}>
                      Continue to the details →
                    </button>
                  </>
                )}
              </div>
            )}

            {/* --------------------------------------------- STEP 2 · DETAILS */}
            {step === 2 && (
              <div style={{ ...pane, padding: "38px 54px 44px" }}>
                <div style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 34 }}>The basics</div>
                <div style={{ marginTop: 8, fontSize: 13, opacity: 0.7, maxWidth: 600 }}>
                  This is the only screen that needs you. Fill it in and you can be live in ninety seconds — or keep
                  going and pick your sections and colors.
                </div>

                <div style={{ display: "flex", gap: 14, marginTop: 24 }}>
                  <Field label="First name" value={n1} onChange={setN1} placeholder="Amara" />
                  <Field label="Second name" value={n2} onChange={setN2} placeholder="Cole" />
                </div>
                <div style={{ display: "flex", gap: 14, marginTop: 14 }}>
                  <Field
                    label="Wedding date"
                    value={dateText}
                    onChange={setDateText}
                    placeholder="Saturday, October 10, 2026"
                  />
                  <Field label="Guests, roughly" value={guestCount} onChange={setGuestCount} placeholder="86" />
                </div>
                <label style={{ display: "block", marginTop: 14 }}>
                  <span style={LAB}>Venue</span>
                  <input
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    placeholder="The Osprey Rooftop, Brooklyn"
                    style={INPUT}
                  />
                </label>

                <StorageMeter guestCount={guestCount} accent={accent} />

                <div style={{ marginTop: 26, padding: 20, border: `2px solid ${INK}` }}>
                  <div style={LAB}>Your wedding&apos;s address</div>
                  <div style={{ fontSize: 12.5, lineHeight: 1.6, opacity: 0.7, marginBottom: 14 }}>
                    This is what goes in every text invite. Most couples want their own domain — it reads like a real
                    thing, not a link to somebody&apos;s product.
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    {(
                      [
                        ["own", "Your own domain", `${domain}.com — reads like it's yours, because it is`, "included"],
                        ["free", "A Ribbet address", "ribbet.app/yourname — free, live in seconds", "free"],
                      ] as const
                    ).map(([key, label, sub, price]) => {
                      const picked = domainMode === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setDomainMode(key)}
                          style={{
                            flex: 1,
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 11,
                            padding: "14px 15px",
                            border: `2px solid ${picked ? INK : RULE}`,
                            background: "transparent",
                            cursor: "pointer",
                            color: INK,
                            opacity: picked ? 1 : 0.6,
                          }}
                        >
                          <span
                            style={{
                              width: 16,
                              height: 16,
                              flex: "none",
                              borderRadius: "50%",
                              border: `2px solid ${picked ? accent : "#c9c4bb"}`,
                              background: picked ? accent : "transparent",
                              marginTop: 2,
                              boxShadow: picked ? "inset 0 0 0 3px #fff" : "none",
                            }}
                          />
                          <span style={{ flex: 1, textAlign: "left" }}>
                            <span style={{ display: "block", fontSize: 13, fontWeight: 800 }}>{label}</span>
                            <span style={{ display: "block", fontSize: 11.5, opacity: 0.62, marginTop: 3, lineHeight: 1.45 }}>
                              {sub}
                            </span>
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 800, opacity: 0.6 }}>{price}</span>
                        </button>
                      );
                    })}
                  </div>

                  {own ? (
                    <div style={{ marginTop: 16, animation: "rbIn .2s ease both" }}>
                      <div style={{ display: "flex", alignItems: "stretch", border: `2px solid ${INK}`, background: "#fff" }}>
                        <input
                          value={domainRaw}
                          onChange={(e) => setDomainOverride(e.target.value)}
                          placeholder="amaraandcole26"
                          style={{
                            flex: 1,
                            minWidth: 0,
                            padding: 12,
                            border: 0,
                            background: "transparent",
                            fontSize: 15,
                            fontWeight: 800,
                            outline: "none",
                          }}
                        />
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            padding: "0 12px",
                            fontSize: 14,
                            opacity: 0.55,
                            borderLeft: `1px solid ${RULE}`,
                          }}
                        >
                          .com
                        </span>
                      </div>
                      <div style={noteStyle(domainOk)}>
                        {domainShort
                          ? "A bit longer — at least 5 characters."
                          : domainTaken
                            ? `${domain}.com is taken. Add the year, or try "the${cleanSlug(n2) || "them"}s".`
                            : `${domain}.com is available. We'll register it for you.`}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 11 }}>
                        {domainSuggestions(n1, n2, dateText).map((value) => (
                          <Chip
                            key={value}
                            label={`${value}.com`}
                            picked={domain === value}
                            accent={accent}
                            onClick={() => setDomainOverride(value)}
                          />
                        ))}
                      </div>
                      <div
                        style={{
                          marginTop: 13,
                          padding: "13px 15px",
                          background: "#faf8f4",
                          borderLeft: `3px solid ${accent}`,
                          fontSize: 12,
                          lineHeight: 1.6,
                          opacity: 0.75,
                        }}
                      >
                        We register it, point it at your app, and set up the certificate. Nothing for you to configure —
                        it&apos;s live when your app is. Yours for two years; renew it after that or let it go.
                      </div>
                    </div>
                  ) : (
                    <div style={{ marginTop: 16, animation: "rbIn .2s ease both" }}>
                      <div style={{ display: "flex", alignItems: "stretch", border: `2px solid ${INK}`, background: "#fff" }}>
                        <span style={{ display: "flex", alignItems: "center", padding: "0 2px 0 12px", fontSize: 14, opacity: 0.55 }}>
                          ribbet.app/
                        </span>
                        <input
                          value={slugInput}
                          onChange={(e) => setSlugOverride(e.target.value)}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            padding: "12px 12px 12px 2px",
                            border: 0,
                            background: "transparent",
                            fontSize: 15,
                            fontWeight: 800,
                            outline: "none",
                          }}
                        />
                      </div>
                      <div style={noteStyle(slugStatus === "ok" || slugStatus === "checking")}>
                        {slugNote(slug, slugStatus)}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 11 }}>
                        {slugSuggestions(n1, n2, dateText).map((value) => (
                          <Chip
                            key={value}
                            label={value}
                            picked={slug === value}
                            accent={accent}
                            onClick={() => setSlugOverride(value)}
                          />
                        ))}
                      </div>
                      <div style={{ marginTop: 13, fontSize: 12, lineHeight: 1.6, opacity: 0.6 }}>
                        Free, live immediately, and you can add your own domain later — the link keeps working either
                        way.
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 28, flexWrap: "wrap" }}>
                  <button type="button" onClick={() => setStep(5)} style={{ ...cta, marginTop: 0 }}>
                    Build it now — use your defaults →
                  </button>
                  <button
                    type="button"
                    onClick={next}
                    style={{
                      padding: "15px 20px",
                      border: `2px solid ${INK}`,
                      background: "transparent",
                      fontSize: 13.5,
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    Customize sections &amp; look
                  </button>
                </div>
                <div style={{ marginTop: 12, fontSize: 12, lineHeight: 1.6, opacity: 0.6, maxWidth: 560 }}>
                  Defaults are 11 of 12 sections on and the Botanical layout in brass. Everything is editable after
                  it&apos;s live — nothing here is locked in.
                </div>
              </div>
            )}

            {/* -------------------------------------------- STEP 3 · SECTIONS */}
            {step === 3 && (
              <div style={{ ...pane, padding: "38px 54px 44px" }}>
                <div style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 34 }}>What your guests get</div>
                <div style={{ marginTop: 8, fontSize: 13, opacity: 0.7, maxWidth: 620 }}>
                  Home, RSVP and The Day are always on — they&apos;re the app. Everything else is yours to switch off,
                  rename, or reorder. {activeCount} of 12 on right now.
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 22 }}>
                  {SECTION_DEFS.map((def) => {
                    const active = def.locked ? true : on[def.key];
                    return (
                      <button
                        key={def.key}
                        type="button"
                        onClick={() => toggleSection(def.key, def.locked)}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 12,
                          padding: "14px 15px",
                          border: `2px solid ${active ? INK : RULE}`,
                          background: "transparent",
                          cursor: def.locked ? "default" : "pointer",
                          opacity: active ? 1 : 0.55,
                          color: INK,
                        }}
                      >
                        <span
                          style={{
                            width: 20,
                            height: 20,
                            flex: "none",
                            border: `2px solid ${active ? accent : "#c9c4bb"}`,
                            background: active ? accent : "transparent",
                            color: accInk,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 11,
                            fontWeight: 800,
                          }}
                        >
                          {active ? "✓" : ""}
                        </span>
                        <span style={{ flex: 1, textAlign: "left" }}>
                          <span style={{ display: "block", fontSize: 14, fontWeight: 800 }}>{def.label}</span>
                          <span style={{ display: "block", fontSize: 11.5, opacity: 0.62, marginTop: 3, lineHeight: 1.45 }}>
                            {def.sub}
                          </span>
                        </span>
                        {def.locked ? (
                          <span
                            style={{
                              flex: "none",
                              fontSize: 9,
                              fontWeight: 800,
                              letterSpacing: ".1em",
                              textTransform: "uppercase",
                              opacity: 0.45,
                            }}
                          >
                            Always on
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                <div
                  style={{
                    marginTop: 22,
                    padding: 18,
                    border: `2px solid ${RULE}`,
                    display: "flex",
                    gap: 16,
                    alignItems: "flex-start",
                  }}
                >
                  <SheetsMark />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 800 }}>Your Google Sheet builds itself from these</div>
                    <div style={{ fontSize: 12, lineHeight: 1.55, opacity: 0.68, marginTop: 4 }}>{sheetTabsLine}</div>
                  </div>
                </div>

                <button type="button" onClick={next} style={cta}>
                  Pick your look →
                </button>
              </div>
            )}

            {/* ---------------------------------------------- STEP 4 · DESIGN */}
            {step === 4 && (
              <div style={{ ...pane, padding: "38px 54px 44px" }}>
                <div style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 34 }}>Your look</div>
                <div style={{ marginTop: 8, fontSize: 13, opacity: 0.7, maxWidth: 620 }}>
                  Three layouts, each one properly designed. Pick the bones, then pull the colors to your palette — the
                  phone on the right is your actual app.
                </div>

                <div style={{ display: "flex", gap: 12, marginTop: 22 }}>
                  {LAYOUT_ORDER.map((key) => {
                    const def = LAYOUTS[key];
                    const sel = layout === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setLayout(key)}
                        style={{
                          flex: 1,
                          border: `2px solid ${sel ? INK : RULE}`,
                          background: "transparent",
                          padding: 0,
                          cursor: "pointer",
                          color: INK,
                          boxShadow: sel ? "0 8px 22px rgba(0,0,0,.12)" : "none",
                        }}
                      >
                        <div
                          style={{
                            background: def.bg,
                            color: def.ink,
                            padding: "20px 16px",
                            textAlign: "left",
                            fontFamily: def.serif,
                          }}
                        >
                          <div style={{ fontSize: 22, lineHeight: 1.05 }}>
                            {n1 || "Amara"}
                            <br />&amp; {n2 || "Cole"}
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
                            {shortMeta(dateText, venue)}
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

                <div style={{ marginTop: 26, display: "flex", gap: 26, alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={LAB}>Your palette</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
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

                    <div style={{ ...LAB, marginTop: 16 }}>Or nudge the accent</div>
                    <div style={{ display: "flex", gap: 7, marginTop: 4, flexWrap: "wrap" }}>
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

                    <div style={{ marginTop: 18, fontSize: 12, lineHeight: 1.6, opacity: 0.62 }}>
                      Everything obeys the palette — buttons, the countdown, the RSVP progress bar, the schedule&apos;s
                      &quot;now&quot; marker. One choice, whole app.
                    </div>
                  </div>
                </div>

                <button type="button" onClick={next} style={cta}>
                  Build my app →
                </button>
              </div>
            )}

            {/* ----------------------------------------------- STEP 5 · BUILD */}
            {step === 5 && (
              <div style={{ ...pane, padding: "44px 54px" }}>
                <div style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 38, lineHeight: 1.1, maxWidth: 540 }}>
                  {built ? "It’s live." : building ? "Building it now…" : "Ready when you are."}
                </div>
                <div style={{ marginTop: 14, fontSize: 14, lineHeight: 1.65, opacity: 0.72, maxWidth: 560 }}>
                  {built
                    ? "Your app is up and your Sheet is in Drive. Next: bring in the guest list, and Ribbet texts each household their own link."
                    : "One button. Ribbet writes the app, creates the Drive folder, and builds your spreadsheet — about fifteen seconds."}
                </div>

                <div style={{ marginTop: 26, maxWidth: 600, display: "flex", flexDirection: "column", gap: 2 }}>
                  {buildChecklist({ own, domain, slug, tabCount: tabsFor.length, activeCount, palette, accentOverride }).map(
                    ([label, detail], i) => (
                      <div
                        key={label}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 13,
                          padding: "13px 15px",
                          border: `2px solid ${built ? INK : RULE}`,
                          opacity: built ? 1 : 0.55,
                          transition: "opacity .3s ease",
                        }}
                      >
                        <span
                          style={{
                            width: 20,
                            height: 20,
                            flex: "none",
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 11,
                            fontWeight: 800,
                            border: `2px solid ${built ? accent : "#c9c4bb"}`,
                            background: built ? accent : "transparent",
                            color: built ? accInk : "#c9c4bb",
                          }}
                        >
                          {built ? "✓" : i === 0 ? "•" : ""}
                        </span>
                        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700 }}>{label}</span>
                        <span style={{ fontSize: 11.5, opacity: 0.6 }}>{detail}</span>
                      </div>
                    ),
                  )}
                </div>

                {buildError ? (
                  <div
                    style={{
                      marginTop: 20,
                      maxWidth: 600,
                      border: `2px solid ${ERROR}`,
                      padding: 16,
                      fontSize: 12.5,
                      lineHeight: 1.6,
                    }}
                  >
                    <strong style={{ color: ERROR }}>That didn&apos;t go through.</strong>
                    <div style={{ marginTop: 6, opacity: 0.8, wordBreak: "break-word" }}>{buildError}</div>
                    <div style={{ marginTop: 8, opacity: 0.6 }}>
                      Nothing was half-built — press Create it again and it picks up where it stopped.
                    </div>
                  </div>
                ) : null}

                {built ? (
                  <div style={{ marginTop: 26, maxWidth: 600, animation: "rbIn .3s ease both" }}>
                    <div style={{ border: `2px solid ${INK}`, padding: 20 }}>
                      <div style={LAB}>Live now</div>
                      <div
                        style={{
                          fontFamily: "var(--font-fraunces), serif",
                          fontSize: 26,
                          color: accent,
                          wordBreak: "break-all",
                        }}
                      >
                        {publicUrl ?? finalAddress}
                      </div>
                      <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
                        <button
                          type="button"
                          onClick={copyLink}
                          style={{
                            padding: "11px 15px",
                            background: accent,
                            color: accInk,
                            fontSize: 12.5,
                            fontWeight: 800,
                            border: `2px solid ${accent}`,
                            cursor: "pointer",
                          }}
                        >
                          {copied ? "Copied" : "Copy link"}
                        </button>
                        {sheetUrl ? (
                          <a
                            href={sheetUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              padding: "11px 15px",
                              border: `2px solid ${INK}`,
                              fontSize: 12.5,
                              fontWeight: 800,
                              color: INK,
                              textDecoration: "none",
                            }}
                          >
                            Open your Sheet →
                          </a>
                        ) : null}
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: 12,
                        border: `2px solid ${RULE}`,
                        padding: 18,
                        display: "flex",
                        gap: 16,
                        alignItems: "flex-start",
                      }}
                    >
                      <SheetsMark />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 800 }}>
                          &quot;{sheetName}&quot; is in your Drive
                        </div>
                        <div style={{ fontSize: 12, lineHeight: 1.55, opacity: 0.68, marginTop: 4 }}>
                          {sheetTabsLine} Share any single tab with a vendor — they never see the others.
                        </div>
                        {folderUrl ? (
                          <a
                            href={folderUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{ display: "inline-block", marginTop: 8, fontSize: 12, fontWeight: 800 }}
                          >
                            Open &quot;{folderName}&quot; in Drive →
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={runBuild}
                    disabled={building}
                    style={{ ...cta, opacity: building ? 0.6 : 1, cursor: building ? "progress" : "pointer" }}
                  >
                    {building ? "Creating…" : "Create it →"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ------------------------------------------------- LIVE PHONE ----- */}
        <div style={{ flex: "none", display: "flex", flexDirection: "column", gap: 11 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
            <span
              style={{
                fontFamily: "var(--font-fraunces), serif",
                fontWeight: 600,
                fontSize: 13,
                letterSpacing: ".1em",
                textTransform: "uppercase",
              }}
            >
              Live preview
            </span>
            <span style={{ fontSize: 12, opacity: 0.55 }}>
              {L.name} · {accentOverride ? "custom accent" : PALETTES.find((p) => p.key === palette)?.name}
            </span>
          </div>

          <PreviewPhone
            layout={layout}
            accent={accent}
            nameOne={n1}
            nameTwo={n2}
            dateText={dateText}
            venue={venue}
            sections={on}
            daysToGo={daysToGo}
          />

          <div style={{ width: 340, fontSize: 11.5, lineHeight: 1.6, opacity: 0.6 }}>
            Updates as you type and pick — this is the app, not a mockup of it.
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- helpers --

/** Mount detection via useSyncExternalStore: nothing ever changes, so the store
 *  never notifies — the server snapshot is false and the client snapshot true. */
function subscribeNever() {
  return () => {};
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label style={{ flex: 1 }}>
      <span style={LAB}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={INPUT}
      />
    </label>
  );
}

function Chip({
  label,
  picked,
  accent,
  onClick,
}: {
  label: string;
  picked: boolean;
  accent: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "8px 11px",
        border: `2px solid ${picked ? accent : RULE}`,
        background: "transparent",
        color: picked ? accent : INK,
        fontSize: 11.5,
        fontWeight: 800,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function noteStyle(ok: boolean): React.CSSProperties {
  return {
    marginTop: 9,
    fontSize: 12.5,
    fontWeight: ok ? 400 : 800,
    color: ok ? INK : ERROR,
    opacity: ok ? 0.65 : 1,
  };
}

function slugNote(slug: string, status: "short" | "checking" | "taken" | "ok"): string {
  switch (status) {
    case "short":
      return "A little longer — at least 4 characters.";
    case "checking":
      return `Checking ribbet.app/${slug}…`;
    case "taken":
      return `ribbet.app/${slug} is taken. Try adding the year.`;
    default:
      return `ribbet.app/${slug} is free.`;
  }
}

function shortMeta(dateText: string, venue: string): string {
  const parsed = parseDateText(dateText);
  const date = parsed
    ? parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
    : "Your day";
  const parts = String(venue).split(",");
  const city = parts.length > 1 ? parts[parts.length - 1].trim() : parts[0]?.trim();
  return city ? `${date} · ${city}` : date;
}

function buildChecklist({
  own,
  domain,
  slug,
  tabCount,
  activeCount,
  palette,
  accentOverride,
}: {
  own: boolean;
  domain: string;
  slug: string;
  tabCount: number;
  activeCount: number;
  palette: Palette;
  accentOverride: string | null;
}): Array<[string, string]> {
  const paletteName = PALETTES.find((p) => p.key === palette)?.name ?? "Brass";
  return [
    [
      "Address reserved",
      // Domain registration happens at checkout, not here — see step 6 of the
      // provisioning spec — so this doesn't claim a certificate it hasn't issued.
      own ? `${domain}.com · registered at checkout` : `ribbet.app/${slug}`,
    ],
    ["Drive folder made", "Your private photo vault"],
    ["Sheet created", `${tabCount} tabs`],
    ["Sections switched on", `${activeCount} of 12`],
    ["Palette applied", `${paletteName}${accentOverride ? " + custom accent" : ""}`],
  ];
}

/**
 * Live Drive estimate: ~22 photos per guest at ~4.2MB against the free 15GB.
 * Nothing in the upload path compresses, so this is the honest number — and
 * when it goes past the line the answer is Google One, in those words.
 */
function StorageMeter({ guestCount, accent }: { guestCount: string; accent: string }) {
  const guests = parseInt(String(guestCount).replace(/[^0-9]/g, ""), 10);
  if (!Number.isFinite(guests) || guests <= 0) return null;

  const gb = storageEstimateGb(guests);
  const pct = Math.min(100, (gb / FREE_TIER_GB) * 100);
  const over = gb > FREE_TIER_GB;
  const tight = !over && pct > 70;
  const bar = over ? ERROR : tight ? "#b06000" : accent;

  return (
    <div style={{ marginTop: 20, padding: "16px 18px", border: `2px solid ${over ? ERROR : RULE}` }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <div style={{ ...LAB, marginBottom: 0, flex: 1 }}>Photo storage in your Drive</div>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: over ? ERROR : INK }}>
          ≈{gb.toFixed(1)}GB of {FREE_TIER_GB}GB free
        </div>
      </div>

      <div style={{ marginTop: 10, height: 8, background: "#eeeae3", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: bar, transition: "width .4s ease" }} />
      </div>

      <div style={{ marginTop: 9, fontSize: 12, lineHeight: 1.6, opacity: over ? 1 : 0.65, color: over ? ERROR : INK, fontWeight: over ? 700 : 400 }}>
        {over
          ? `${guests} guests at full resolution won't fit the free 15GB — Google One is about $2/mo for 100GB, and it's the right answer. Ribbet never compresses a guest photo.`
          : tight
            ? `${guests} guests puts you close to the line. Google One (100GB, ~$2/mo) buys you room.`
            : `${guests} guests × ~22 photos, uncompressed. Comfortable on the free tier.`}
      </div>
    </div>
  );
}

function PromiseCard({
  accent,
  title,
  body,
  icon,
}: {
  accent: string;
  title: string;
  body: string;
  icon: React.ReactNode;
}) {
  return (
    <div style={{ flex: 1, border: `2px solid ${RULE}`, padding: 16 }}>
      <div style={{ color: accent }}>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {icon}
        </svg>
      </div>
      <div style={{ fontSize: 13, fontWeight: 800, marginTop: 9 }}>{title}</div>
      <div style={{ fontSize: 12, lineHeight: 1.5, opacity: 0.65, marginTop: 4 }}>{body}</div>
    </div>
  );
}

/** The green Sheets glyph the design draws with four divs. */
function SheetsMark() {
  return (
    <div
      style={{
        width: 26,
        height: 34,
        background: GOOGLE_GREEN,
        position: "relative",
        flex: "none",
        borderRadius: 2,
      }}
    >
      <div style={{ position: "absolute", left: 5, top: 9, right: 5, bottom: 7, border: "1.5px solid #fff" }} />
      <div style={{ position: "absolute", left: 5, top: 16, right: 5, height: 1.5, background: "#fff" }} />
      <div style={{ position: "absolute", left: 12, top: 9, width: 1.5, bottom: 7, background: "#fff" }} />
    </div>
  );
}

/** The official four-colour G mark. Per the design notes, never recolour it. */
function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23 12.2c0-.8-.1-1.6-.2-2.3H12v4.5h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.6Z"
      />
      <path
        fill="#34A853"
        d="M12 23.5c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v3A11.5 11.5 0 0 0 12 23.5Z"
      />
      <path fill="#FBBC05" d="M5.6 14.2a6.9 6.9 0 0 1 0-4.4v-3H1.8a11.5 11.5 0 0 0 0 10.4l3.8-3Z" />
      <path
        fill="#EA4335"
        d="M12 5.1c1.7 0 3.2.6 4.4 1.7l3.3-3.3A11.5 11.5 0 0 0 1.8 6.8l3.8 3C6.5 7.1 9 5.1 12 5.1Z"
      />
    </svg>
  );
}
