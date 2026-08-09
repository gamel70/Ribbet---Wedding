"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { accentButtonStyle, panelStyle } from "../ui";

type Job = {
  id: string;
  name: string;
  status: "waiting" | "uploading" | "done" | "failed";
  percent: number;
  error?: string;
};

/**
 * Direct-to-Drive uploader.
 *
 * The file handed over by the picker is the file that goes to Google — no
 * canvas, no resize, no re-encode, no EXIF stripping. It is PUT straight at a
 * resumable session URI minted server-side, so the bytes never pass through the
 * app and the capture timestamp and orientation survive intact.
 */
export function VaultUploader({ slug }: { slug: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const update = (id: string, patch: Partial<Job>) =>
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));

  const uploadOne = async (file: File, id: string) => {
    update(id, { status: "uploading", percent: 0 });

    const slotRes = await fetch(`/api/vault/${slug}/slot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: file.name, mimeType: file.type || "application/octet-stream", sizeBytes: file.size }),
    });

    if (!slotRes.ok) {
      const payload = await slotRes.json().catch(() => ({}));
      update(id, { status: "failed", error: payload.message ?? "Couldn't start the upload." });
      if (slotRes.status === 507) setNotice(payload.message ?? null);
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

    if (!fileId) {
      update(id, { status: "failed", error: "The upload didn't finish. It'll retry when you're back on signal." });
      return;
    }

    await fetch(`/api/vault/${slug}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileId, takenAt: new Date(file.lastModified).toISOString() }),
    });

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
                <span style={{ fontSize: 11, color: job.status === "failed" ? "#b8240e" : "var(--mut)" }}>
                  {job.status === "done"
                    ? "Sent"
                    : job.status === "failed"
                      ? "Queued"
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
