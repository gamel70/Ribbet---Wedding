import type { ReactNode } from "react";

import type { SectionKey } from "@/db/schema";

/**
 * The eight cards under More, in the order screen 05 lays them out. Icons are
 * inline 20px strokes — the design notes are explicit that there is no icon
 * library anywhere in this product.
 */
export type MoreSection = {
  key: Extract<
    SectionKey,
    "gifts" | "travel" | "menu" | "guestbook" | "songs" | "party" | "around" | "faq"
  >;
  label: string;
  sub: string;
  icon: ReactNode;
};

export const MORE_SECTIONS: MoreSection[] = [
  {
    key: "gifts",
    label: "Gifts",
    sub: "Registry & fund",
    icon: (
      <>
        <rect x="3.5" y="11" width="17" height="9.5" rx="1" />
        <rect x="2.5" y="7" width="19" height="4" rx="1" />
        <path d="M12 7v13.5" />
        <path d="M12 7c-4.2 0-5.4-4.3-2.4-4.3C11.2 2.7 12 7 12 7Z" />
        <path d="M12 7c4.2 0 5.4-4.3 2.4-4.3C12.8 2.7 12 7 12 7Z" />
      </>
    ),
  },
  {
    key: "travel",
    label: "Travel & stay",
    sub: "Hotels · shuttle · maps",
    icon: (
      <>
        <path d="M3.5 11.5 20.5 4l-7 17-2.6-7.4Z" />
        <path d="M20.5 4 10.9 13.6" />
      </>
    ),
  },
  {
    key: "menu",
    label: "Menu",
    sub: "Dinner & bar",
    icon: (
      <>
        <circle cx="12" cy="13" r="8" />
        <circle cx="12" cy="13" r="3.2" />
        <path d="M2.5 5.5h19" opacity=".6" />
      </>
    ),
  },
  {
    key: "guestbook",
    label: "Guestbook",
    sub: "Leave a note",
    icon: (
      <>
        <path d="M4 20l1-3.8L17.2 4c1.1-1.1 3.9 1.7 2.8 2.8L7.8 19Z" />
        <path d="M14.8 6.4l2.8 2.8" />
      </>
    ),
  },
  {
    key: "songs",
    label: "Songs",
    sub: "Request for the DJ",
    icon: (
      <>
        <path d="M9 18V5.5l10-2V16" />
        <circle cx="6.5" cy="18" r="2.5" />
        <circle cx="16.5" cy="16" r="2.5" />
      </>
    ),
  },
  {
    key: "party",
    label: "Wedding party",
    sub: "Who's who",
    icon: (
      <>
        <circle cx="9" cy="8.2" r="3.2" />
        <path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
        <circle cx="16.8" cy="9" r="2.6" />
        <path d="M16 14.3c2.8.4 4.7 2.3 4.7 4.9" />
      </>
    ),
  },
  {
    key: "around",
    label: "Around town",
    sub: "Our list",
    icon: (
      <>
        <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
        <circle cx="12" cy="10" r="2.6" />
      </>
    ),
  },
  {
    key: "faq",
    label: "FAQ",
    sub: "Dress code, kids, parking",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9.7c0-3.3 5-3.3 5 0 0 2.1-2.5 2-2.5 4" />
        <circle cx="12" cy="17" r="0.4" fill="currentColor" />
      </>
    ),
  },
];

export function SectionIcon({ children }: { children: ReactNode }) {
  return (
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
      {children}
    </svg>
  );
}
