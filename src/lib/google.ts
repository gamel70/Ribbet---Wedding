import { eq } from "drizzle-orm";
import { google } from "googleapis";

import { db } from "@/db";
import { users } from "@/db/schema";
import { GOOGLE_SCOPES } from "@/lib/auth";
import { decryptToken } from "@/lib/crypto";

/**
 * Builds an authorized Google client for a couple from their stored, encrypted
 * refresh token.
 *
 * Access tokens die hourly and a wedding lasts a year, so nothing caches one —
 * googleapis refreshes on demand from the refresh token before each call, which
 * is the behaviour the provisioning spec asks for.
 */
export async function googleClientForGoogleSub(googleSub: string) {
  const [user] = await db
    .select({ refreshTokenEncrypted: users.refreshTokenEncrypted })
    .from(users)
    .where(eq(users.googleSub, googleSub))
    .limit(1);

  if (!user?.refreshTokenEncrypted) {
    throw new Error(
      `No stored Google refresh token for ${googleSub} — the couple must sign in again to re-grant offline access`,
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
