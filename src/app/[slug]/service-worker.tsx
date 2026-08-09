"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { requestDrain } from "@/lib/upload-queue";

/**
 * Registers `public/sw.js` against this wedding's own scope.
 *
 * Scope is `/<slug>` rather than `/`, so an installed guest app never caches or
 * intercepts the couple's console — and two weddings open on the same phone
 * stay entirely separate registrations.
 *
 * Mounted in the guest layout, so every tab keeps the worker fresh and gives
 * the offline queue another chance to empty.
 */
export function ServiceWorkerBridge({ slug, warm }: { slug: string; warm: string[] }) {
  const router = useRouter();
  const warmList = warm.join(" ");

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let live = true;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: `/${slug}`,
          // The worker itself must never come from the HTTP cache, or a fix
          // ships and nobody gets it.
          updateViaCache: "none",
        });
        await navigator.serviceWorker.ready;
        if (!live) return;

        const worker = registration.active ?? navigator.serviceWorker.controller;
        worker?.postMessage({ type: "ribbet-warm", urls: warmList.split(" ").filter(Boolean) });
      } catch {
        // No worker (private mode, unsupported browser). The app is unchanged
        // without one — everything here is an enhancement, nothing depends on it.
      }

      await requestDrain();
    };

    void register();

    // Anything the worker finishes off in the background should show up in the
    // photo grid without the guest doing anything.
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "ribbet-upload-sent") router.refresh();
    };
    const onOnline = () => void requestDrain();

    navigator.serviceWorker.addEventListener("message", onMessage);
    window.addEventListener("online", onOnline);

    return () => {
      live = false;
      navigator.serviceWorker.removeEventListener("message", onMessage);
      window.removeEventListener("online", onOnline);
    };
  }, [slug, warmList, router]);

  return null;
}
