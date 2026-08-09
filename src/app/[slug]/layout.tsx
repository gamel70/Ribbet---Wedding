import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { resolveSections } from "@/lib/design";
import { weddingBySlug } from "@/lib/guest";
import { weddingAppName, weddingShortName } from "@/lib/pwa";
import { resolveSectionList } from "@/lib/sections";
import { guestTheme } from "@/lib/theme";

import { ServiceWorkerBridge } from "./service-worker";
import { TabBar, type TabKey } from "./tab-bar";

/**
 * The generated guest app. Every wedding is a row, not a deployment — this one
 * dynamic segment serves all of them, themed from the couple's own layout,
 * palette and accent, with section names and order taken from the console.
 */
export async function generateMetadata({ params }: LayoutProps<"/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const wedding = await weddingBySlug(slug);
  if (!wedding) return { title: "Ribbet" };

  const names = [wedding.nameOne, wedding.nameTwo].filter(Boolean).join(" & ");
  return {
    title: names ? `${names}` : "Our wedding",
    description: wedding.venue ?? undefined,

    // Installability, per wedding. The manifest, the icon and the iOS title all
    // hang off this slug, so what lands on a guest's home screen is the couple's
    // names and the couple's colour — never "Ribbet".
    manifest: `/${slug}/manifest.webmanifest`,
    applicationName: weddingAppName(wedding),
    appleWebApp: {
      capable: true,
      title: weddingShortName(wedding, slug),
      statusBarStyle: "default",
    },
    icons: {
      icon: [{ url: `/${slug}/app-icon/192`, sizes: "192x192", type: "image/png" }],
      apple: [{ url: `/${slug}/app-icon/180`, sizes: "180x180", type: "image/png" }],
    },
  };
}

/**
 * The accent reaches the OS itself: Android tints the status bar with it, and
 * it's the colour behind the splash while a standalone launch boots.
 */
export async function generateViewport({ params }: LayoutProps<"/[slug]">): Promise<Viewport> {
  const { slug } = await params;
  const wedding = await weddingBySlug(slug);

  return {
    width: "device-width",
    initialScale: 1,
    // Installed, the app owns the whole screen — including behind the notch and
    // the home indicator, which the safe-area padding below accounts for.
    viewportFit: "cover",
    themeColor: wedding ? guestTheme(wedding).accent : "#b98d4f",
  };
}

/** Only these four can be tabs; everything else tiles under More. */
const TAB_KEYS = new Set<TabKey>(["home", "rsvp", "day", "photos"]);

export default async function GuestLayout({ children, params }: LayoutProps<"/[slug]">) {
  const { slug } = await params;
  const wedding = await weddingBySlug(slug);
  if (!wedding) notFound();

  const theme = guestTheme(wedding);
  const resolved = resolveSectionList(resolveSections(wedding.sections), wedding.sectionMeta);

  // The couple's names, order and on/off all reach the tab bar — "a section they
  // skip never shows", and one they rename shows the new name.
  const tabs: Array<{ key: TabKey; label: string }> = resolved
    .filter((s) => TAB_KEYS.has(s.key as TabKey) && s.on)
    .map((s) => ({ key: s.key as TabKey, label: s.label }));

  tabs.push({ key: "more", label: "More" });

  // What the worker pre-fetches so the first offline launch has somewhere to
  // land: exactly the tabs this couple switched on, no more.
  const warm = tabs.map((tab) => (tab.key === "home" ? `/${slug}` : `/${slug}/${tab.key}`));

  return (
    <div
      style={{
        ...theme.vars,
        background: "var(--bg)",
        color: "var(--ink)",
        minHeight: "100dvh",
        display: "flex",
        justifyContent: "center",
        fontFamily: "var(--font-karla), sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 430,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          background: "var(--bg)",
          // Installed on a notched phone the app draws edge to edge, so the
          // status bar mustn't land on top of the couple's names.
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        <ServiceWorkerBridge slug={slug} warm={warm} />

        <main style={{ flex: 1, padding: "26px 26px 24px" }}>{children}</main>

        {/*
          The only way into the console from a guest page, and deliberately the
          quietest thing on the screen — a guest who isn't looking for it never
          notices it, and there is no other login UI anywhere in the guest app.
        */}
        <footer style={{ padding: "0 26px 22px", textAlign: "center" }}>
          <Link
            href="/admin"
            style={{
              fontSize: 10,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: "var(--mut)",
              opacity: 0.6,
              textDecoration: "none",
            }}
          >
            Couple sign in
          </Link>
        </footer>

        <TabBar slug={slug} tabs={tabs} />
      </div>
    </div>
  );
}
