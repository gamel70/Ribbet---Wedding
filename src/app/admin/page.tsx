import Link from "next/link";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { consoleStats, guestTable } from "@/lib/console-stats";
import { formatDateText } from "@/lib/dates";
import { resolveSections } from "@/lib/design";
import { resolveSchedule } from "@/lib/schedule";
import { resolveSectionList } from "@/lib/sections";
import { findWedding } from "@/lib/wedding";

import { Console } from "./console";
import { CoupleSignIn } from "./sign-in";

/**
 * The couple console — stage 3 of `Ribbet.dc.html`, private to the couple.
 *
 * Reached from /admin or the quiet footer link on the guest app. There is no
 * guest-facing sign-in anywhere else: a guest who never looks at the footer has
 * no idea this exists.
 */
export const metadata = { title: "Ribbet · Couple console" };

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  const googleSub = session?.user?.googleSub ?? null;

  if (!googleSub) return <CoupleSignIn />;

  const wedding = await findWedding(googleSub);

  // Signed in with a Google account that doesn't own a wedding — the honest
  // answer is the intake, not an empty console.
  if (!wedding) {
    return (
      <Shell>
        <h1 style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 32, margin: 0 }}>
          No wedding on this account yet
        </h1>
        <p style={{ marginTop: 12, fontSize: 14, lineHeight: 1.65, opacity: 0.72, maxWidth: 520 }}>
          You&apos;re signed in as <strong>{session?.user?.email}</strong>, but nothing has been set up under it. If
          you built your wedding with a different Google account, sign out and use that one.
        </p>
        <Link
          href="/setup"
          style={{
            display: "inline-block",
            marginTop: 22,
            padding: "14px 20px",
            border: "2px solid #201e1d",
            color: "#201e1d",
            fontWeight: 800,
            fontSize: 14,
            textDecoration: "none",
          }}
        >
          Set up a wedding →
        </Link>
      </Shell>
    );
  }

  const [stats, table] = await Promise.all([consoleStats(wedding.id), guestTable(wedding.id)]);

  return (
    <Console
      wedding={{
        slug: wedding.slug,
        nameOne: wedding.nameOne ?? "",
        nameTwo: wedding.nameTwo ?? "",
        dateText: wedding.date ? formatDateText(wedding.date) : "",
        venue: wedding.venue ?? "",
        guestEstimate: wedding.guestEstimate != null ? String(wedding.guestEstimate) : "",
        layout: wedding.layout,
        palette: wedding.palette,
        accent: wedding.accent,
        sheetUrl: wedding.sheetId ? `https://docs.google.com/spreadsheets/d/${wedding.sheetId}/edit` : null,
        folderUrl: wedding.driveFolderId
          ? `https://drive.google.com/drive/folders/${wedding.driveFolderId}`
          : null,
      }}
      email={session?.user?.email ?? ""}
      sections={resolveSectionList(resolveSections(wedding.sections), wedding.sectionMeta)}
      schedule={resolveSchedule(wedding.schedule)}
      stats={stats}
      table={table.map((row) => ({ ...row, submittedAt: row.submittedAt?.toISOString() ?? null }))}
    />
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#e6e4e2",
        color: "#201e1d",
        fontFamily: "var(--font-karla), sans-serif",
        padding: "44px 44px 80px",
      }}
    >
      {children}
    </main>
  );
}
