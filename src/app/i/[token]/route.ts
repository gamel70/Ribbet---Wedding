import { redirect } from "next/navigation";

import { householdByInviteToken, logRsvpEvent, setHouseholdSession } from "@/lib/guest";

/**
 * GET /i/<token> — the link the couple texts.
 *
 * Hands this browser the household's session and drops them straight on the
 * RSVP screen with their names already filled in. No code to type, no account,
 * nothing to remember: the link is the credential.
 *
 * A bad token doesn't say so — it lands on the guest app's front door, which
 * leaks nothing about which tokens exist.
 */
export async function GET(_request: Request, ctx: RouteContext<"/i/[token]">) {
  const { token } = await ctx.params;

  const found = await householdByInviteToken(token);
  if (!found) redirect("/");

  await setHouseholdSession(found.wedding.id, found.household.id);
  await logRsvpEvent(
    found.wedding.id,
    found.household.id,
    "invited",
    `${found.household.label} opened their invite link`,
  );

  redirect(`/${found.wedding.slug}/rsvp`);
}
