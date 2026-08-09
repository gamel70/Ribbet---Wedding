"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The five-tab bar from `Ribbet App Structure.dc.html`. 16px stroke icons,
 * 8px/800 uppercase labels, active in the accent — and only as many columns as
 * the couple's sections produce, since Photos disappears when it's switched off.
 */

export type TabKey = "home" | "rsvp" | "day" | "photos" | "more";

const ICONS: Record<TabKey, React.ReactNode> = {
  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9v12h13V9" />
    </>
  ),
  rsvp: (
    <>
      <rect x="3" y="5" width="18" height="15" rx="2" />
      <path d="M3 9h18" />
      <path d="M8.5 14.5l2.5 2.5 4.5-5" />
    </>
  ),
  day: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  photos: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M3 16.5l5-4 4 3 4-3.5 5 4.5" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.7" fill="currentColor" stroke="none" />
    </>
  ),
};

export function TabBar({ slug, tabs }: { slug: string; tabs: Array<{ key: TabKey; label: string }> }) {
  const pathname = usePathname();
  const base = `/${slug}`;

  const hrefFor = (key: TabKey) => (key === "home" ? base : `${base}/${key}`);

  const isActive = (key: TabKey) => {
    const href = hrefFor(key);
    if (key === "home") return pathname === base || pathname === `${base}/`;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <nav
      style={{
        flex: "none",
        borderTop: "1px solid var(--line)",
        display: "grid",
        gridTemplateColumns: `repeat(${tabs.length},1fr)`,
        textAlign: "center",
        background: "var(--bg)",
        paddingBottom: "env(safe-area-inset-bottom)",
        position: "sticky",
        bottom: 0,
      }}
    >
      {tabs.map((tab) => {
        const active = isActive(tab.key);
        return (
          <Link
            key={tab.key}
            href={hrefFor(tab.key)}
            style={{
              padding: "11px 0 9px",
              color: active ? "var(--acc)" : "var(--ink)",
              opacity: active ? 1 : 0.5,
              textDecoration: "none",
            }}
          >
            <span style={{ height: 16, display: "flex", justifyContent: "center" }}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {ICONS[tab.key]}
              </svg>
            </span>
            <span
              style={{
                display: "block",
                fontSize: 8,
                letterSpacing: ".16em",
                textTransform: "uppercase",
                marginTop: 3,
                fontWeight: 700,
              }}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
