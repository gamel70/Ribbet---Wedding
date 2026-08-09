import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";

import { GoogleSignIn, SignOut } from "./sign-in";

/**
 * Step 1 of the intake wizard, reduced to the Google grant so the scope and the
 * encrypted-token round trip can be tested end to end. The full five-step wizard
 * (live phone preview, storage meter, domain picker) is the next build step —
 * see "Stage 2+3 — Intake wizard" in README.md.
 */
export default async function SetupPage() {
  const session = await getServerSession(authOptions);

  return (
    <main className="flex flex-1 items-center justify-center bg-[#e6e4e2] p-6">
      <div className="w-full max-w-[560px] border-2 border-[#201e1d] bg-white p-10 shadow-[0_24px_60px_rgba(0,0,0,.18)]">
        <p className="text-[10px] font-extrabold uppercase tracking-[.28em] text-[#8a8378]">Step 1 of 5</p>
        <h1 className="mt-3 font-[family-name:var(--font-fraunces)] text-[38px] leading-tight text-[#201e1d]">
          Connect your Google account
        </h1>

        <p className="mt-5 text-[14px] leading-[1.65] text-[#3d3a37]">
          Ribbet creates one folder and one spreadsheet in your Drive, and can only ever see the
          files it made itself. It cannot read anything else in your Drive.
        </p>

        {session?.user ? (
          <div className="mt-8 border-2 border-[#0f9d58] p-5">
            <p className="text-[13px] font-extrabold text-[#201e1d]">{session.user.name}</p>
            <p className="mt-1 text-[13px] text-[#5f6368]">{session.user.email}</p>
            <p className="mt-3 text-[12px] text-[#0f9d58]">
              Connected. Refresh token stored, encrypted.
            </p>
            <SignOut />
          </div>
        ) : (
          <GoogleSignIn />
        )}
      </div>
    </main>
  );
}
