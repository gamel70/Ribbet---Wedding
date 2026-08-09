"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { enqueueUpload, queuedUploads, requestDrain } from "@/lib/upload-queue";

import { accentButtonStyle, panelStyle } from "../ui";

type Job = {
  id: string;
  name: string;
  status: "waiting" | "uploading" | "queued" | "done" | "failed";
  percent: number;
  error?: string;
};

const WAITING_FOR_SIGNAL = "Held on your phone. This sends itself the moment you're back on signal.";

/**
 * Direct-to-Drive uploader.
 *
 * The file handed over by the picker is the file that goes to Google — no
 * canvas, no resize, no re-encode, no EXIF stripping. It is PUT straight at a
 * resumable session URI minted server-side, so the bytes never pass through the
 * app and the capture timestamp and orientation survive intact.
 *
 * With no signal the same file goes to IndexedDB instead, byte for byte, and
 * `public/sw.js` sends it when the connection comes back — which is the point
 * of the whole arrangement, because the reception is exactly where the photos
 * are taken and exactly where the wifi isn't.
 */
export function VaultUploader({ slug }: { slug: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const update = useCallback(
    (id: string, patch: Partial<Job>) => setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j))),
    [],
  );

  /** Hand a photo to the queue rather than lose it. */
  const hold = useCallback(
    async (file: File, id: string) => {
      try {
        await enqueueUpload({ id, slug, file });
        update(id, { status: "queued", percent: 0, error: WAITING_FOR_SIGNAL });
        await requestDrain();
      } catch {
        update(id, {
          status: "failed",
          error: "This phone wouldn't let us hold on to it. Try again when you have signal.",
        });
      }
    },
    [slug, update],
  );

  // A reload shouldn't make a waiting photo look lost — anything still in the
  // queue comes back onto the list exactly as it was left.
  useEffect(() => {
    let live = true;
    void queuedUploads(slug)
      .then((queued) => {
        if (!live || !queued.length) return;
        setJobs((prev) => {
          const known = new Set(prev.map((j) => j.id));
          const restored = queued
            .filter((item) => !known.has(item.id))
            .map<Job>((item) => ({
              id: item.id,
              name: item.name,
              status: "queued",
              percent: 0,
              error: WAITING_FOR_SIGNAL,
            }));
          return [...restored, ...prev];
        });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [slug]);

  // The worker does the sending once a photo is queued, so it's the worker that
  // says how it went.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const onMessage = (event: MessageEvent) => {
      const data = event.data ?? {};
      // Only the row's own state here — the grid below is refreshed by the
      // ServiceWorkerBridge in the layout, which hears the same message.
      if (data.type === "ribbet-upload-sent") {
        update(data.id, { status: "done", percent: 100, error: undefined });
      }
      if (data.type === "ribbet-upload-dropped") {
        update(data.id, { status: "failed", error: data.reason });
      }
      if (data.type === "ribbet-vault-full") {
        setNotice(
          "The couple's Drive is full, so your photos are waiting rather than lost. They've been told — they'll send when there's room.",
        );
      }
    };

    const onOnline = () => void requestDrain();

    navigator.serviceWorker.addEventListener("message", onMessage);
    window.addEventListener("online", onOnline);
    return () => {
      navigator.serviceWorker.removeEventListener("message", onMessage);
      window.removeEventListener("online", onOnline);
    };
  }, [update]);

  const uploadOne = async (file: File, id: string) => {
    // Don't make someone in a field watch a progress bar that can't move.
    if (!navigator.onLine) return hold(file, id);

    update(id, { status: "uploading", percent: 0 });

    let slotRes: Response;
    try {
      slotRes = await fetch(`/api/vault/${slug}/slot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
        }),
      });
    } catch {
      // The signal went between tapping and asking. Queue it.
      return hold(file, id);
    }

    if (!slotRes.ok) {
      const payload = await slotRes.json().catch(() => ({}));

      // A full Drive is the couple's problem to solve, not a reason to drop the
      // guest's photo — hold it and say so.
      if (slotRes.status === 507) {
        setNotice(payload.message ?? null);
        return hold(file, id);
      }

      update(id, { status: "failed", error: payload.message ?? "Couldn't start the upload." });
      return;
    }

    const { uploadUrl } = (await slotRes.json()) as { uploadUrl: string };

    // XHR rather than fetch, purely so there's a real progress event to show.
    const fileId = await new Promise<string | null>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl, true);
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          update(id, { percent: Math.round((event.loaded / event.total) * 100) });
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText).id ?? null);
          } catch {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      };
      xhr.onerror = () => resolve(null);
      // The File is sent as-is. Nothing touches the bytes.
      xhr.send(file);
    });

    // Whatever went wrong mid-transfer, the photo itself is still here.
    if (!fileId) return hold(file, id);

    try {
      await fetch(`/api/vault/${slug}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId, takenAt: new Date(file.lastModified).toISOString() }),
      });
    } catch {
      // Drive has the bytes; only the attribution row is missing. Saying "sent"
      // is the truth — it just may not appear in the grid below until later.
      update(id, { status: "done", percent: 100, error: "Sent. It may take a moment to appear here." });
      return;
    }

    update(id, { status: "done", percent: 100 });
    router.refresh();
  };

  const onPick = async (files: FileList | null) => {
    if (!files?.length) return;
    setNotice(null);

    const queued: Job[] = Array.from(files).map((file, i) => ({
      id: `${Date.now()}-${i}-${file.name}`,
      name: file.name,
      status: "waiting",
      percent: 0,
    }));
    setJobs((prev) => [...queued, ...prev]);

    // Sequential: a rooftop connection copes far better with one at a time.
    for (let i = 0; i < files.length; i++) {
      await uploadOne(files[i], queued[i].id);
    }

    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*,.heic,.heif"
        multiple
        onChange={(e) => onPick(e.target.files)}
        style={{ display: "none" }}
      />

      <button type="button" onClick={() => inputRef.current?.click()} style={{ ...accentButtonStyle, marginTop: 16 }}>
        ＋ Send photos to the vault
      </button>

      {notice ? (
        <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.6, color: "#b8240e", fontWeight: 700 }}>{notice}</div>
      ) : null}

      {jobs.length ? (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
          {jobs.map((job) => (
            <div key={job.id} style={{ ...panelStyle, padding: "10px 12px" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span
                  style={{
                    flex: 1,
                    fontSize: 12,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {job.name}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color:
                      job.status === "failed"
                        ? "#b8240e"
                        : job.status === "queued"
                          ? "var(--acc)"
                          : "var(--mut)",
                  }}
                >
                  {job.status === "done"
                    ? "Sent"
                    : job.status === "failed"
                      ? "Didn't send"
                      : job.status === "queued"
                        ? "Waiting for signal"
                        : job.status === "uploading"
                          ? `${job.percent}%`
                          : "Waiting"}
                </span>
              </div>
              {job.status === "uploading" ? (
                <div style={{ marginTop: 7, height: 3, background: "var(--bg)" }}>
                  <div style={{ height: "100%", width: `${job.percent}%`, background: "var(--acc)" }} />
                </div>
              ) : null}
              {job.error ? (
                <div style={{ marginTop: 5, fontSize: 11, color: "var(--mut)", lineHeight: 1.5 }}>{job.error}</div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}
