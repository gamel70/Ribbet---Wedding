import Link from "next/link";
import { notFound } from "next/navigation";

import { resolveSections } from "@/lib/design";
import { weddingBySlug } from "@/lib/guest";

import { Lede, ScreenTitle, panelStyle } from "../ui";
import { MORE_SECTIONS, SectionIcon } from "./section-meta";

/** Screen 05 — More. A 2-column card grid holding only the sections switched on. */
export default async function MoreScreen({ params }: PageProps<"/[slug]/more">) {
  const { slug } = await params;
  const wedding = await weddingBySlug(slug);
  if (!wedding) notFound();

  const sections = resolveSections(wedding.sections);
  const visible = MORE_SECTIONS.filter((s) => sections[s.key]);

  return (
    <>
      <ScreenTitle>More</ScreenTitle>
      <Lede>Everything else for the weekend.</Lede>

      {visible.length ? (
        <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {visible.map((section) => (
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
                <SectionIcon>{section.icon}</SectionIcon>
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, marginTop: 8 }}>{section.label}</div>
              <div style={{ fontSize: 11, color: "var(--mut)", marginTop: 3 }}>{section.sub}</div>
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
