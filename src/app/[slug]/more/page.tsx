import Link from "next/link";
import { notFound } from "next/navigation";

import { resolveSections } from "@/lib/design";
import { weddingBySlug } from "@/lib/guest";
import { resolveSectionList } from "@/lib/sections";

import { Lede, ScreenTitle, panelStyle } from "../ui";
import { MORE_SECTIONS, SectionIcon } from "./section-meta";

/** Screen 05 — More. A 2-column card grid holding only the sections switched on. */
export default async function MoreScreen({ params }: PageProps<"/[slug]/more">) {
  const { slug } = await params;
  const wedding = await weddingBySlug(slug);
  if (!wedding) notFound();

  // The console's order and names win; MORE_SECTIONS only supplies the icons.
  const resolved = resolveSectionList(resolveSections(wedding.sections), wedding.sectionMeta);
  const visible = resolved
    .filter((s) => s.on)
    .map((s) => ({ resolved: s, card: MORE_SECTIONS.find((m) => m.key === s.key) }))
    .filter((entry): entry is { resolved: typeof entry.resolved; card: (typeof MORE_SECTIONS)[number] } =>
      Boolean(entry.card),
    );

  return (
    <>
      <ScreenTitle>More</ScreenTitle>
      <Lede>Everything else for the weekend.</Lede>

      {visible.length ? (
        <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {visible.map(({ resolved: section, card }) => (
            <Link
              key={section.key}
              href={`/${slug}/more/${section.key}`}
              style={{
                ...panelStyle,
                padding: "16px 14px",
                color: "var(--ink)",
                textDecoration: "none",
                display: "block",
              }}
            >
              <div style={{ height: 20, color: "var(--acc)" }}>
                <SectionIcon>{card.icon}</SectionIcon>
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, marginTop: 8 }}>{section.label}</div>
              <div style={{ fontSize: 11, color: "var(--mut)", marginTop: 3 }}>{card.sub}</div>
            </Link>
          ))}
        </div>
      ) : (
        <div style={{ marginTop: 18, fontSize: 13, color: "var(--mut)" }}>
          The couple has kept this one simple — everything is on the first three tabs.
        </div>
      )}
    </>
  );
}
