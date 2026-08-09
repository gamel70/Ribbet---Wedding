import { eq } from "drizzle-orm";
import { google } from "googleapis";

import { db } from "@/db";
import { users } from "@/db/schema";
import { GOOGLE_SCOPES, hasDriveFileScope } from "@/lib/auth";
import { decryptToken } from "@/lib/crypto";

export type ReauthReason =
  /** Nothing stored — they've never completed an offline grant. */
  | "no_token"
  /** Signed in, but the Drive tick box was left unticked. */
  | "missing_scope"
  /** Google refused the token itself: revoked, expired, or password changed. */
  | "invalid_grant"
  /** The token is live but wasn't granted enough to make this call. */
  | "insufficient_scope";

/**
 * Thrown when the only cure is sending the couple back through Google. The
 * intake catches this and re-runs sign-in with `prompt: consent` rather than
 * showing them an API error they can do nothing about.
 */
export class GoogleReauthRequired extends Error {
  readonly reason: ReauthReason;

  constructor(reason: ReauthReason, message: string) {
    super(message);
    this.name = "GoogleReauthRequired";
    this.reason = reason;
  }
}

/**
 * Classifies an error thrown by googleapis. Returns null when it's an ordinary
 * failure — a network blip, a bad request — that re-consenting wouldn't fix.
 */
export function reauthReasonFor(error: unknown): ReauthReason | null {
  if (error instanceof GoogleReauthRequired) return error.reason;

  const e = error as {
    status?: number;
    code?: number | string;
    message?: string;
    response?: { status?: number; data?: unknown };
  };

  const status = Number(e?.response?.status ?? e?.status ?? e?.code);
  const body = `${JSON.stringify(e?.response?.data ?? "")} ${e?.message ?? ""}`;

  // The refresh token itself was rejected.
  if (/invalid_grant|invalid_token|Token has been expired or revoked/i.test(body)) {
    return "invalid_grant";
  }
  if (status === 401) return "invalid_grant";

  // Live token, not enough scope. Drive says "insufficientPermissions", Sheets
  // says "ACCESS_TOKEN_SCOPE_INSUFFICIENT"; both read "insufficient ... scopes".
  if (
    status === 403 &&
    /insufficient\s+authentication\s+scopes|insufficientPermissions|ACCESS_TOKEN_SCOPE_INSUFFICIENT/i.test(body)
  ) {
    return "insufficient_scope";
  }

  return null;
}

export type GoogleGrant = {
  hasToken: boolean;
  /** null when the row predates scope recording. */
  driveFile: boolean | null;
  scope: string | null;
};

/** What we know about a couple's grant, without touching Google. */
export async function googleGrantFor(googleSub: string): Promise<GoogleGrant> {
  const [user] = await db
    .select({ refreshTokenEncrypted: users.refreshTokenEncrypted, scope: users.scope })
    .from(users)
    .where(eq(users.googleSub, googleSub))
    .limit(1);

  return {
    hasToken: Boolean(user?.refreshTokenEncrypted),
    driveFile: hasDriveFileScope(user?.scope),
    scope: user?.scope ?? null,
  };
}

/**
 * Builds an authorized Google client for a couple from their stored, encrypted
 * refresh token.
 *
 * Access tokens die hourly and a wedding lasts a year, so nothing caches one —
 * googleapis refreshes on demand from the refresh token before each call, which
 * is the behaviour the provisioning spec asks for.
 *
 * Every call this app makes — Drive folder create, Sheets create/get/batchUpdate,
 * Drive file move — is satisfied by drive.file alone. If one of them ever comes
 * back demanding more scope, the fix is that call, never a wider scope.
 */
export async function googleClientForGoogleSub(googleSub: string) {
  const [user] = await db
    .select({ refreshTokenEncrypted: users.refreshTokenEncrypted, scope: users.scope })
    .from(users)
    .where(eq(users.googleSub, googleSub))
    .limit(1);

  if (!user?.refreshTokenEncrypted) {
    throw new GoogleReauthRequired(
      "no_token",
      "No stored Google refresh token — the couple must sign in again to grant offline access",
    );
  }

  // Fail here rather than three API calls into provisioning with a half-built
  // Sheet. `null` means unknown, so let the call itself decide.
  if (hasDriveFileScope(user.scope) === false) {
    throw new GoogleReauthRequired(
      "missing_scope",
      "The Google account is connected but Drive access was not granted",
    );
  }

  const client = new google.auth.OAuth2({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: `${process.env.NEXTAUTH_URL}/api/auth/callback/google`,
  });

  client.setCredentials({
    refresh_token: decryptToken(user.refreshTokenEncrypted),
    scope: GOOGLE_SCOPES.join(" "),
  });

  return client;
}

export async function driveFor(googleSub: string) {
  return google.drive({ version: "v3", auth: await googleClientForGoogleSub(googleSub) });
}

export async function sheetsFor(googleSub: string) {
  return google.sheets({ version: "v4", auth: await googleClientForGoogleSub(googleSub) });
}
