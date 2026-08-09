"use client";

import { signIn } from "next-auth/react";

/**
 * The console's front door. Same Google sign-in as the intake — a couple who
 * already granted Drive access is straight in, and one who hasn't is sent
 * through the same consent screen they saw at setup.
 */
export function CoupleSignIn() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#e6e4e2",
        color: "#201e1d",
        fontFamily: "var(--font-karla), sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 460,
          background: "#fff",
          border: "2px solid #201e1d",
          boxShadow: "0 24px 60px rgba(0,0,0,.18)",
          padding: 36,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-fraunces), serif",
            fontWeight: 600,
            fontSize: 24,
            letterSpacing: "-.02em",
          }}
        >
          Ribbet
        </div>
        <div
          style={{
            marginTop: 4,
            fontSize: 11,
            letterSpacing: ".16em",
            textTransform: "uppercase",
            opacity: 0.55,
          }}
        >
          Couple console
        </div>

        <h1 style={{ marginTop: 22, fontFamily: "var(--font-fraunces), serif", fontSize: 30, lineHeight: 1.15 }}>
          Sign in to your wedding.
        </h1>
        <p style={{ marginTop: 12, fontSize: 13.5, lineHeight: 1.65, opacity: 0.72 }}>
          Use the same Google account you set the wedding up with. This is the private side — your guests never see
          it.
        </p>

        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: "/admin" })}
          style={{
            marginTop: 26,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 20px",
            background: "#fff",
            border: "2px solid #201e1d",
            cursor: "pointer",
            width: "100%",
            justifyContent: "center",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M23 12.2c0-.8-.1-1.6-.2-2.3H12v4.5h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.6Z"
            />
            <path
              fill="#34A853"
              d="M12 23.5c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v3A11.5 11.5 0 0 0 12 23.5Z"
            />
            <path fill="#FBBC05" d="M5.6 14.2a6.9 6.9 0 0 1 0-4.4v-3H1.8a11.5 11.5 0 0 0 0 10.4l3.8-3Z" />
            <path
              fill="#EA4335"
              d="M12 5.1c1.7 0 3.2.6 4.4 1.7l3.3-3.3A11.5 11.5 0 0 0 1.8 6.8l3.8 3C6.5 7.1 9 5.1 12 5.1Z"
            />
          </svg>
          <span style={{ fontSize: 15, fontWeight: 800 }}>Sign in with Google</span>
        </button>
      </div>
    </main>
  );
}
