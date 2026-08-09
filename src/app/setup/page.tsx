import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { formatDateText } from "@/lib/dates";
import { resolveSections } from "@/lib/design";
import { masterSheetName, PROVISION_STEPS, vaultFolderName } from "@/lib/provision";
import { autoSlug } from "@/lib/slug";
import { findWedding } from "@/lib/wedding";

import { IntakeWizard, type WizardInitial } from "./wizard";

/**
 * Stage 2+3 — the intake wizard from `Ribbet Intake.dc.html`.
 *
 * The step lock is enforced here as well as in the UI: with no session the
 * wizard is handed `signedIn: false` and pinned to step 1, and every Server
 * Action it calls re-checks the session independently.
 */
export default async function SetupPage() {
  const session = await getServerSession(authOptions);
  const googleSub = session?.user?.googleSub ?? null;
  const wedding = googleSub ? await findWedding(googleSub) : null;

  const nameOne = wedding?.nameOne ?? "";
  const nameTwo = wedding?.nameTwo ?? "";
  const slug = wedding?.slug ?? "";
  const provisioned = (wedding?.provisioningStep ?? 0) >= PROVISION_STEPS.DONE;

  // `null` means "still deriving from the names", which is how the design keeps
  // the address in step with what the couple is typing.
  const derived = autoSlug(nameOne, nameTwo);
  const bareDomain = wedding?.customDomain?.replace(/\.com$/i, "") ?? null;

  const initial: WizardInitial = {
    signedIn: Boolean(googleSub),
    account: session?.user ? { name: session.user.name ?? null, email: session.user.email ?? null } : null,
    step: googleSub ? (wedding?.intakeStep ?? 1) : 1,
    nameOne,
    nameTwo,
    dateText: wedding?.date ? formatDateText(wedding.date) : "",
    venue: wedding?.venue ?? "",
    guestCount: wedding?.guestEstimate != null ? String(wedding.guestEstimate) : "",
    // With no names yet the stored slug is only a placeholder, so the address
    // stays in "deriving from the names" mode rather than pinning to it.
    slugOverride: wedding && nameOne && slug !== derived ? slug : null,
    domainOverride: bareDomain,
    domainMode: wedding ? (wedding.customDomain ? "own" : "free") : "own",
    layout: wedding?.layout ?? "botanical",
    palette: wedding?.palette ?? "brass",
    accent: wedding?.accent ?? null,
    sections: resolveSections(wedding?.sections),
    built: provisioned,
    publicUrl: wedding ? (wedding.customDomain ?? `ribbet.app/${slug}`) : null,
    sheetName: provisioned && wedding ? masterSheetName(wedding) : null,
    sheetUrl: wedding?.sheetId ? `https://docs.google.com/spreadsheets/d/${wedding.sheetId}/edit` : null,
    folderName: provisioned && wedding ? vaultFolderName(wedding) : null,
    folderUrl: wedding?.driveFolderId ? `https://drive.google.com/drive/folders/${wedding.driveFolderId}` : null,
  };

  return <IntakeWizard initial={initial} />;
}
