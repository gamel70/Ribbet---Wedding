import { eq } from "drizzle-orm";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

import { db } from "@/db";
import { users } from "@/db/schema";
import { encryptToken } from "@/lib/crypto";

/**
 * Exactly one Google API scope: drive.file. Read "The scope decision" in
 * README.md before touching this array.
 *
 * drive.file is non-sensitive — basic verification, no security assessment, no
 * 100-user testing cap. It also covers the Sheets API on a spreadsheet this app
 * created, which is why `spreadsheets` is absent and must stay absent. Adding
 * `drive`, `drive.readonly` or `spreadsheets` breaks both the onboarding promise
 * made on intake screen 01 and the verification timeline.
 */
export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/drive.file",
] as const;

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: GOOGLE_SCOPES.join(" "),
          // Google only hands back a refresh token with these two together, and
          // only on the consent grant — hence `prompt: consent` rather than
          // relying on the first sign-in.
          access_type: "offline",
          prompt: "consent",
          include_granted_scopes: "true",
        },
      },
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    /**
     * Google returns the refresh token exactly once, on the consent grant. Persist
     * it encrypted here; it never enters the JWT or the session cookie.
     */
    async signIn({ account, profile }) {
      if (account?.provider !== "google" || !profile?.sub) return true;

      const values = {
        googleSub: profile.sub,
        email: profile.email ?? "",
        name: profile.name ?? null,
        image: (profile as { picture?: string }).picture ?? null,
        scope: account.scope ?? null,
        updatedAt: new Date(),
      };

      // Only overwrite the stored token when Google actually sent a new one —
      // a silent re-auth omits it, and clobbering it would break every later write.
      const withToken = account.refresh_token
        ? {
            refreshTokenEncrypted: encryptToken(account.refresh_token),
            refreshTokenUpdatedAt: new Date(),
          }
        : {};

      await db
        .insert(users)
        .values({ ...values, ...withToken })
        .onConflictDoUpdate({
          target: users.googleSub,
          set: { ...values, ...withToken },
        });

      return true;
    },

    async jwt({ token, account, profile }) {
      if (account?.provider === "google" && profile?.sub) {
        token.googleSub = profile.sub;
      }
      // Access tokens are short-lived and are re-minted server-side from the
      // stored refresh token before every Drive/Sheets write, so nothing
      // Google-issued is kept in the session cookie.
      return token;
    },

    async session({ session, token }) {
      if (token.googleSub && session.user) {
        session.user.googleSub = token.googleSub as string;

        const [row] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.googleSub, token.googleSub as string))
          .limit(1);

        if (row) session.user.id = row.id;
      }
      return session;
    },
  },

  pages: {
    signIn: "/setup",
  },
};
