import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";

import { DEFAULT_SECTIONS } from "@/lib/design";

import { PreviewPhone } from "./setup/preview-phone";

/**
 * Stage 1 — the sales page. README parked this ("deliberately not designed
 * yet"); this is its design, built from the same token set as the intake so the
 * page a couple lands on and the wizard they leave it for read as one product.
 *
 * The one rule: the hero shows the real thing. `PreviewPhone` is the intake's
 * live preview component, so what the visitor sees here is the guest app
 * itself, not marketing artwork of it.
 */

export const metadata: Metadata = {
  title: "Ribbet — Your wedding, in your own Google account",
  description:
    "A wedding app for your guests, a photo vault in your Drive, and one Google Sheet for your vendors. Built in fifteen seconds. Yours even if you cancel.",
};

const INK = "#201e1d";
const PAGE = "#e6e4e2";
const MUT = "#5f6368";
const BRASS = "#b98d4f";
const GREEN = "#0f9d58";
const SHADOW = "0 24px 60px rgba(0,0,0,.18)";

const serif: CSSProperties = { fontFamily: "var(--font-fraunces), serif" };

const eyebrow: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 800,
  letterSpacing: ".28em",
  textTransform: "uppercase",
};

const card: CSSProperties = {
  background: "#fff",
  border: `2px solid ${INK}`,
  boxShadow: SHADOW,
};

const ctaDark: CSSProperties = {
  display: "inline-block",
  padding: "15px 26px",
  background: INK,
  border: `2px solid ${INK}`,
  color: "#fff",
  fontSize: 15,
  fontWeight: 800,
  textDecoration: "none",
};

const ctaLight: CSSProperties = {
  display: "inline-block",
  padding: "15px 26px",
  background: "#fff",
  border: `2px solid ${INK}`,
  color: INK,
  fontSize: 15,
  fontWeight: 800,
  textDecoration: "none",
};

/** 24px-viewBox stroke icons, per the asset rules: 1.7 stroke, round caps, no library. */
function Icon({ d, extra }: { d: string; extra?: ReactNode }) {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke={INK}
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
      {extra}
    </svg>
  );
}

const ICON_PHONE = "M8 2.5h8a1.5 1.5 0 0 1 1.5 1.5v16a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 20V4A1.5 1.5 0 0 1 8 2.5Zm2 16h4";
const ICON_FOLDER = "M3.5 6.5a1.5 1.5 0 0 1 1.5-1.5h4l2 2.5h8a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5v-11Z";
const ICON_SHEET = "M4.5 4.5h15v15h-15v-15Zm0 5h15M9.5 9.5v10";
const ICON_KEY = "M14.5 8.5a4 4 0 1 0-4 4l1 0 1.5 1.5h2v2h2v2h3v-3l-5.5-5.5a4 4 0 0 0 0-1Z";
const ICON_CAMERA = "M4.5 8h3l1.5-2.5h6L16.5 8h3A1 1 0 0 1 20.5 9v9.5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z";
const ICON_SPARK = "M12 3v4m0 10v4m9-9h-4M7 12H3m14.3-6.3-2.8 2.8M9.5 14.5l-2.8 2.8m10.6 0-2.8-2.8M9.5 9.5 6.7 6.7";

export default function Home() {
  return (
    <main style={{ flex: 1, background: PAGE, color: INK, fontFamily: "var(--font-karla), sans-serif" }}>
      {/* ——— Top bar ——— */}
      <header
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: "26px 28px 0",
          display: "flex",
          alignItems: "center",
          gap: 28,
        }}
      >
        <span style={{ ...serif, fontWeight: 600, fontSize: 27, letterSpacing: "-.02em" }}>Ribbet</span>
        <nav style={{ display: "flex", gap: 22, marginLeft: 10 }} aria-label="Page sections">
          {[
            ["#what", "What you get"],
            ["#how", "How it works"],
            ["#pricing", "Pricing"],
            ["#faq", "FAQ"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              style={{ fontSize: 13, fontWeight: 700, color: INK, textDecoration: "none", opacity: 0.75 }}
            >
              {label}
            </a>
          ))}
        </nav>
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 18 }}>
          <Link href="/admin" style={{ fontSize: 13, fontWeight: 700, color: INK, opacity: 0.75, textDecoration: "none" }}>
            Sign in
          </Link>
          <Link href="/setup" style={{ ...ctaDark, padding: "11px 18px", fontSize: 13.5 }}>
            Set up your wedding
          </Link>
        </span>
      </header>

      {/* ——— Hero ——— */}
      <section
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: "64px 28px 30px",
          display: "flex",
          gap: 56,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: "1 1 460px", minWidth: 320, animation: "rbIn .3s ease both" }}>
          <div style={{ ...eyebrow, color: "#8a8378" }}>The wedding website, replaced</div>
          <h1 style={{ ...serif, fontSize: 58, lineHeight: 1.04, margin: "18px 0 0", fontWeight: 500 }}>
            Your wedding,
            <br />
            in <em style={{ color: BRASS }}>your own</em>
            <br />
            Google account.
          </h1>
          <p style={{ marginTop: 22, fontSize: 16.5, lineHeight: 1.65, color: MUT, maxWidth: 480 }}>
            Ribbet builds three things: an app your guests open from a text, a photo vault in your Google
            Drive, and one spreadsheet your vendors can actually use. Your data never lives on our servers —
            cancel tomorrow and the wedding is still yours.
          </p>
          <div style={{ marginTop: 30, display: "flex", gap: 14, flexWrap: "wrap" }}>
            <Link href="/setup" style={ctaDark}>
              Set up your wedding →
            </Link>
            <a href="#how" style={ctaLight}>
              See how it works
            </a>
          </div>
          <div style={{ marginTop: 22, fontSize: 12.5, color: MUT }}>
            Live in about fifteen minutes. No app store, nothing for guests to install.
          </div>
        </div>

        {/* The intake's live preview, at rest: this is the guest app, not artwork. */}
        <div style={{ flex: "none", width: 340 * 0.88, height: 736 * 0.88, animation: "rbIn .3s ease .08s both" }}>
          <div style={{ transform: "scale(.88)", transformOrigin: "top left" }}>
            <PreviewPhone
              layout="botanical"
              accent={BRASS}
              nameOne="Amara"
              nameTwo="Cole"
              dateText="Saturday, October 10"
              venue="The Meridian House, Washington DC"
              sections={DEFAULT_SECTIONS}
              daysToGo={54}
            />
          </div>
        </div>
      </section>

      {/* ——— The three artifacts ——— */}
      <section id="what" style={{ maxWidth: 1180, margin: "0 auto", padding: "50px 28px 10px" }}>
        <div style={{ ...eyebrow, color: "#8a8378" }}>What you get</div>
        <h2 style={{ ...serif, fontSize: 36, margin: "14px 0 0", fontWeight: 500 }}>
          One setup, three things you keep.
        </h2>
        <div
          style={{
            marginTop: 30,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 22,
          }}
        >
          {[
            {
              icon: ICON_PHONE,
              title: "A guest app, at your own address",
              body: "ribbet.app/yourname — or your own domain. RSVP with meals and dietary notes, the day's live schedule, gifts, travel, songs for the DJ. Guests add it to their home screen with your names on the icon; it even works offline at the venue.",
            },
            {
              icon: ICON_FOLDER,
              title: "A photo vault, in your Drive",
              body: "Every photo a guest takes lands in a folder Ribbet creates in your Google Drive — full resolution, never compressed, straight from their phone to your account. Only the two of you can see the collection; each guest sees only what they sent.",
            },
            {
              icon: ICON_SHEET,
              title: "One spreadsheet, vendor-ready",
              body: "A Google Sheet in the same folder, kept in sync as replies come in. A tab for the caterer with meals and dietary counts, one for the DJ, one for gifts and thank-yous. Hand each vendor their tab and stop retyping.",
            },
          ].map((c) => (
            <div key={c.title} style={{ ...card, padding: 28 }}>
              <Icon d={c.icon} />
              <h3 style={{ ...serif, fontSize: 21, margin: "16px 0 0", fontWeight: 600 }}>{c.title}</h3>
              <p style={{ marginTop: 10, fontSize: 13.5, lineHeight: 1.65, color: MUT }}>{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ——— The premise ——— */}
      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "44px 28px" }}>
        <div style={{ ...card, background: INK, color: "#fff", padding: "44px 46px", display: "flex", gap: 40, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 420px" }}>
            <div style={{ ...eyebrow, color: BRASS }}>The part that matters</div>
            <h2 style={{ ...serif, fontSize: 34, margin: "14px 0 0", fontWeight: 500, lineHeight: 1.15 }}>
              It stays yours. That&apos;s the whole idea.
            </h2>
            <p style={{ marginTop: 16, fontSize: 15, lineHeight: 1.7, color: "rgba(255,255,255,.75)", maxWidth: 560 }}>
              The folder and the spreadsheet are created in <em>your</em> Google account, not ours. Ribbet asks
              for one narrow permission — access to the files it creates, nothing else in your Drive. Cancel
              Ribbet the day after the wedding and the photos, the guest list, and every RSVP are still sitting
              in your Drive, in files you own.
            </p>
          </div>
          <ul style={{ flex: "1 1 300px", listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              "One permission: files Ribbet creates. It can't see the rest of your Drive.",
              "Your photos are never compressed, resized, or re-encoded. Ever.",
              "No lock-in: the day you stop paying, Ribbet just stops writing.",
            ].map((line) => (
              <li key={line} style={{ display: "flex", gap: 12, alignItems: "flex-start", fontSize: 14, lineHeight: 1.55 }}>
                <span style={{ color: GREEN, fontWeight: 800, flex: "none", marginTop: 1 }}>✓</span>
                <span style={{ color: "rgba(255,255,255,.85)" }}>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ——— How it works ——— */}
      <section id="how" style={{ maxWidth: 1180, margin: "0 auto", padding: "30px 28px 10px" }}>
        <div style={{ ...eyebrow, color: "#8a8378" }}>How it works</div>
        <h2 style={{ ...serif, fontSize: 36, margin: "14px 0 0", fontWeight: 500 }}>
          Fifteen minutes of answers. Fifteen seconds of building.
        </h2>
        <div
          style={{
            marginTop: 30,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: 0,
            border: `2px solid ${INK}`,
            background: "#fff",
            boxShadow: SHADOW,
          }}
        >
          {[
            ["Connect Google", "Sign in and grant one permission. Ribbet makes its folder in your Drive right away, so you can see exactly what it touches."],
            ["Tell us the details", "Names, date, venue, roughly how many guests. Pick your address — ribbet.app/yourname or your own domain."],
            ["Choose your sections", "RSVP, photos, gifts, travel, menu, songs — twelve sections, on or off. Your picks decide the app's tabs and the Sheet's."],
            ["Pick the look", "Three layouts, six palettes, your accent. A live phone preview updates as you type — that preview is the app."],
            ["Press build", "About fifteen seconds: app published, folder and spreadsheet created in your Drive. Then text every household their own link."],
          ].map(([title, body], i) => (
            <div
              key={title}
              style={{
                padding: "26px 22px",
                borderLeft: i === 0 ? "none" : `2px solid ${INK}`,
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  width: 26,
                  height: 26,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "50%",
                  border: `2px solid ${INK}`,
                  fontSize: 12.5,
                  fontWeight: 800,
                }}
              >
                {i + 1}
              </span>
              <h3 style={{ fontSize: 14.5, fontWeight: 800, margin: "12px 0 0" }}>{title}</h3>
              <p style={{ marginTop: 8, fontSize: 12.5, lineHeight: 1.6, color: MUT }}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ——— After the yes: running it ——— */}
      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "44px 28px 10px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 22 }}>
          {[
            {
              icon: ICON_CAMERA,
              title: "The wedding day, handled",
              body: "The schedule goes live and updates in guests' hands — move dinner twenty minutes and everyone knows. Photos upload from the dance floor straight to your vault, and queue politely when the rooftop wifi gives out.",
            },
            {
              icon: ICON_SPARK,
              title: "A console for whoever's running it",
              body: "You — or your planner — get a private console: watch replies land, send invite links by text, nudge the quiet households, edit the schedule, rename sections. One place, shared by whoever you trust with it.",
            },
            {
              icon: ICON_KEY,
              title: "Guests never make accounts",
              body: "Each household gets its own link in a text from you. Open it and they're in — one RSVP covers the family, meals per person, kids counted. No passwords, no downloads, nothing to forget.",
            },
          ].map((c) => (
            <div key={c.title} style={{ ...card, padding: 28 }}>
              <Icon d={c.icon} />
              <h3 style={{ ...serif, fontSize: 21, margin: "16px 0 0", fontWeight: 600 }}>{c.title}</h3>
              <p style={{ marginTop: 10, fontSize: 13.5, lineHeight: 1.65, color: MUT }}>{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ——— Pricing ——— */}
      <section id="pricing" style={{ maxWidth: 1180, margin: "0 auto", padding: "50px 28px 10px" }}>
        <div style={{ ...eyebrow, color: "#8a8378" }}>Pricing</div>
        <h2 style={{ ...serif, fontSize: 36, margin: "14px 0 0", fontWeight: 500 }}>One wedding. One price.</h2>
        <div style={{ marginTop: 30, display: "flex", gap: 22, flexWrap: "wrap", alignItems: "stretch" }}>
          <div style={{ ...card, flex: "1 1 420px", maxWidth: 560, padding: 36 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span style={{ ...serif, fontSize: 54, fontWeight: 500 }}>$149</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: MUT }}>once, for the whole engagement</span>
            </div>
            <ul style={{ listStyle: "none", margin: "22px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                "The guest app at ribbet.app/yourname, every section included",
                "Photo vault and vendor spreadsheet, built in your Drive",
                "Invite links and reminders by text, sent when you say",
                "The console for you and your planner",
                "Live until your date, then three months of afterglow for late photos and thank-yous",
              ].map((line) => (
                <li key={line} style={{ display: "flex", gap: 12, fontSize: 14, lineHeight: 1.55 }}>
                  <span style={{ color: GREEN, fontWeight: 800, flex: "none" }}>✓</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <Link href="/setup" style={{ ...ctaDark, marginTop: 28 }}>
              Start — pay when you press build
            </Link>
          </div>
          <div style={{ flex: "1 1 300px", maxWidth: 420, display: "flex", flexDirection: "column", gap: 22 }}>
            <div style={{ ...card, padding: 26, boxShadow: "none" }}>
              <h3 style={{ fontSize: 14.5, fontWeight: 800, margin: 0 }}>Your own domain</h3>
              <p style={{ marginTop: 8, fontSize: 13, lineHeight: 1.6, color: MUT }}>
                Want <strong>amaraandcole.com</strong> instead? Add it at checkout for what the registrar
                charges us — no markup, and the domain is registered to you.
              </p>
            </div>
            <div style={{ ...card, padding: 26, boxShadow: "none" }}>
              <h3 style={{ fontSize: 14.5, fontWeight: 800, margin: 0 }}>Storage, honestly</h3>
              <p style={{ marginTop: 8, fontSize: 13, lineHeight: 1.6, color: MUT }}>
                Full-resolution photos are heavy — a big wedding can outgrow Drive&apos;s free 15GB. If yours
                will, the intake tells you before you build, and the fix is Google One at about $2/month, paid
                to Google. We&apos;d rather say that here than compress your photos.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ——— FAQ ——— */}
      <section id="faq" style={{ maxWidth: 1180, margin: "0 auto", padding: "50px 28px 10px" }}>
        <div style={{ ...eyebrow, color: "#8a8378" }}>Questions couples ask</div>
        <h2 style={{ ...serif, fontSize: 36, margin: "14px 0 0", fontWeight: 500 }}>Fair questions.</h2>
        <div style={{ ...card, marginTop: 30, maxWidth: 820 }}>
          {[
            [
              "Do our guests have to download anything?",
              "No. The app is a link — guests open it in the browser from your text. If they want, one tap saves it to their home screen with your names on the icon, and it keeps working offline at the venue. Nothing from an app store, no accounts, no passwords.",
            ],
            [
              "What exactly can Ribbet see in our Google account?",
              "Only the files it creates: the photo folder and the spreadsheet. The permission is Google's narrowest Drive scope — Ribbet cannot read your email, your existing files, or anything else. You'll see the exact wording on Google's own consent screen when you connect.",
            ],
            [
              "Are the photos really full quality?",
              "Byte-for-byte what left the guest's phone. No resizing, no re-encoding, no stripped metadata — the original file uploads directly from their phone to your Drive without passing through our servers. In ten years you'll have the archive, not thumbnails of it.",
            ],
            [
              "What happens if we cancel?",
              "Ribbet stops writing; that's all. The folder, every photo, and the spreadsheet are already in your Google account and stay there. On the way out we leave a final index of who sent which photo, so the attribution survives without us.",
            ],
            [
              "Can our planner run it?",
              "Yes. The console — replies, invites, schedule, sections — is one private workspace for whoever is running the wedding: you, your partner, your planner. Vendors don't need it at all; they get their own tab of the spreadsheet.",
            ],
            [
              "How do gifts work?",
              "Guests pledge toward your registry or funds in the app and pay you directly by Venmo or Zelle — money never routes through Ribbet, so there's no fee skimmed off your gifts. The Sheet tracks who gave what and which thank-yous you've sent.",
            ],
          ].map(([q, a], i) => (
            <details key={q} style={{ borderTop: i === 0 ? "none" : `1px solid #e0d8c8` }}>
              <summary
                style={{
                  cursor: "pointer",
                  listStyle: "none",
                  padding: "20px 26px",
                  fontSize: 15,
                  fontWeight: 800,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                }}
              >
                {q}
                <span aria-hidden="true" style={{ color: BRASS, fontWeight: 800 }}>
                  +
                </span>
              </summary>
              <p style={{ margin: 0, padding: "0 26px 22px", fontSize: 13.5, lineHeight: 1.7, color: MUT, maxWidth: 680 }}>
                {a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* ——— Closing CTA ——— */}
      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "60px 28px 70px", textAlign: "center" }}>
        <h2 style={{ ...serif, fontSize: 42, margin: 0, fontWeight: 500 }}>
          The next text you send could be the invitation.
        </h2>
        <p style={{ margin: "16px auto 0", fontSize: 15, lineHeight: 1.65, color: MUT, maxWidth: 520 }}>
          Connect Google, answer the questions, pick a look you love in the live preview, and press build.
        </p>
        <div style={{ marginTop: 28 }}>
          <Link href="/setup" style={ctaDark}>
            Set up your wedding →
          </Link>
        </div>
      </section>

      {/* ——— Footer ——— */}
      <footer style={{ borderTop: `2px solid ${INK}` }}>
        <div
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            padding: "26px 28px",
            display: "flex",
            alignItems: "center",
            gap: 24,
            flexWrap: "wrap",
            fontSize: 12.5,
          }}
        >
          <span style={{ ...serif, fontWeight: 600, fontSize: 20 }}>Ribbet</span>
          <span style={{ color: MUT }}>Your wedding, in your own Google account.</span>
          <span style={{ marginLeft: "auto", display: "flex", gap: 20 }}>
            <Link href="/setup" style={{ color: INK, fontWeight: 700, textDecoration: "none" }}>
              Set up a wedding
            </Link>
            <Link href="/admin" style={{ color: INK, fontWeight: 700, textDecoration: "none" }}>
              Couple &amp; planner console
            </Link>
          </span>
        </div>
      </footer>
    </main>
  );
}
