import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { resolveSections } from "@/lib/design";
import { weddingBySlug } from "@/lib/guest";
import { guestTheme } from "@/lib/theme";

import { TabBar, type TabKey } from "./tab-bar";

/**
 * The generated guest app. Every wedding is a row, not a deployment — this one
 * dynamic segment serves all of them, themed from the couple's own layout,
 * palette and accent.
 */
export async function generateMetadata({ params }: LayoutProps<"/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const wedding = await weddingBySlug(slug);
  if (!wedding) return { title: "Ribbet" };

  const names = [wedding.nameOne, wedding.nameTwo].filter(Boolean).join(" & ");
  return {
    title: names ? `${names}` : "Our wedding",
    description: wedding.venue ?? undefined,
  };
}

export default async function GuestLayout({ children, params }: LayoutProps<"/[slug]">) {
  const { slug } = await params;
  const wedding = await weddingBySlug(slug);
  if (!wedding) notFound();

  const sections = resolveSections(wedding.sections);
  const theme = guestTheme(wedding);

  // Section toggles rewrite the tab bar, exactly as they do in the intake's
  // live preview.
  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: "home", label: "Home" },
    { key: "rsvp", label: "RSVP" },
    { key: "day", label: "The Day" },
    ...(sections.photos ? [{ key: "photos" as TabKey, label: "Photos" }] : []),
    { key: "more", label: "More" },
  ];

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
        }}
      >
        <main style={{ flex: 1, padding: "26px 26px 32px" }}>{children}</main>
        <TabBar slug={slug} tabs={tabs} />
      </div>
    </div>
  );
}
