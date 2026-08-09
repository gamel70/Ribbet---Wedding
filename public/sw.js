/*
 * Ribbet guest app service worker.
 *
 * Served from the origin root so it can take a scope of `/<slug>` — one
 * registration per wedding, none of them touching /admin or /setup. The
 * registering page hands it the tab list to warm; see
 * `src/app/[slug]/service-worker.tsx`.
 *
 * Three jobs:
 *   1. Keep the app shell readable with no signal.
 *   2. Keep the guest's own photo thumbnails viewable with no signal.
 *   3. Hold photos taken offline and send them the moment there is signal —
 *      "uploads queue in IndexedDB when offline and drain on reconnect".
 */

const VERSION = "v1";
const SHELL_CACHE = `ribbet-shell-${VERSION}`;
const PHOTO_CACHE = `ribbet-photos-${VERSION}`;
const KEEP = [SHELL_CACHE, PHOTO_CACHE];

// Must stay in step with src/lib/upload-queue.ts, the queue's only writer.
const DB_NAME = "ribbet-vault";
const DB_VERSION = 1;
const STORE = "queue";
const SYNC_TAG = "ribbet-upload";

/** How many transient failures a photo gets before we stop pretending. */
const MAX_ATTEMPTS = 5;

// ─────────────────────────────────────────────────────────── lifecycle ─────

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key.startsWith("ribbet-") && !KEEP.includes(key)).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

// ────────────────────────────────────────────────────────────── fetching ────

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Only ever cache reads. Slot requests, RSVPs and the Drive PUT itself are
  // all writes and all go straight out.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(freshPageFirst(event));
    return;
  }

  if (isOwnThumbnail(url)) {
    event.respondWith(cachedPhotoFirst(event));
    return;
  }

  // Hashed build output, safe to serve from cache forever.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cachedAssetFirst(event));
    return;
  }

  // Everything else — the rest of /api included — stays on the network.
});

function isOwnThumbnail(url) {
  return /^\/api\/vault\/[^/]+\/thumb\//.test(url.pathname);
}

/**
 * Pages are network-first, never cache-first.
 *
 * Guest pages are personalised — the household's names, their RSVP, their
 * to-do list — so a stale copy is only ever acceptable as the alternative to a
 * blank screen. Online, the guest always sees the truth.
 */
async function freshPageFirst(event) {
  const request = event.request;
  const cache = await caches.open(SHELL_CACHE);

  try {
    const fresh = await fetch(request);

    // A navigation preload/redirect can't be inspected or re-served, so hand it
    // straight back and bank nothing.
    if (fresh.type === "opaqueredirect" || fresh.redirected) return fresh;

    if (fresh.ok && fresh.type === "basic") {
      // waitUntil, not a bare call: the write has to be allowed to finish after
      // the page already has its response, or the browser may bin the worker
      // mid-put and the cache silently never fills.
      event.waitUntil(cache.put(request, fresh.clone()));
    }
    return fresh;
  } catch {
    const exact = await cache.match(request, { ignoreSearch: true });
    if (exact) return exact;

    // Deliberately not "serve the home page instead": showing Home under a
    // /more/travel URL looks like the app losing its place. Say what happened
    // and offer the way back to the tabs that *are* here.
    return offlinePage(request.url);
  }
}

/** `/amara-cole/photos` → `/amara-cole`. */
function weddingHome(href) {
  const url = new URL(href);
  const slug = url.pathname.split("/").filter(Boolean)[0];
  return slug ? `/${slug}` : "/";
}

/**
 * The guest's own thumbnails, cache-first — this is the "look at what I sent"
 * screen working on a coach with no bars. The endpoint already refuses anyone
 * else's photos, so what lands here is only ever this household's own.
 */
async function cachedPhotoFirst(event) {
  const request = event.request;
  const cache = await caches.open(PHOTO_CACHE);

  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const fresh = await fetch(request);
    if (fresh.ok) event.waitUntil(cache.put(request, fresh.clone()));
    return fresh;
  } catch {
    // Let the <img> fail quietly rather than throwing inside the worker.
    return new Response("", { status: 504, statusText: "Offline" });
  }
}

async function cachedAssetFirst(event) {
  const request = event.request;
  const cache = await caches.open(SHELL_CACHE);

  const cached = await cache.match(request);
  if (cached) return cached;

  const fresh = await fetch(request);
  if (fresh.ok) event.waitUntil(cache.put(request, fresh.clone()));
  return fresh;
}

function offlinePage(href) {
  const home = weddingHome(href);

  return new Response(
    `<!doctype html><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">` +
      `<title>No signal</title>` +
      `<div style="font:400 15px/1.65 system-ui,-apple-system,sans-serif;max-width:430px;margin:0 auto;` +
      `padding:64px 28px;text-align:center;color:#2a2622;background:#f6f3ee;min-height:100vh;box-sizing:border-box">` +
      `<p style="font-size:20px;margin:0 0 10px">No signal for this page</p>` +
      `<p style="margin:0 0 26px;opacity:.62">Open it once with a connection and it'll be here next time. ` +
      `Anything you've already sent is still on its way.</p>` +
      `<a href="${home}" style="color:#2a2622;font-weight:700;font-size:13px;letter-spacing:.05em">` +
      `← Back to the wedding</a></div>`,
    // 503, not 200: this isn't the page that was asked for, and nothing should
    // treat it as one.
    { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

/** Pre-fetch the wedding's tabs so the first offline launch has somewhere to go. */
async function warmShell(urls) {
  if (!Array.isArray(urls)) return;
  const cache = await caches.open(SHELL_CACHE);

  await Promise.all(
    urls.map(async (url) => {
      try {
        const response = await fetch(url, { credentials: "include" });
        if (response.ok && !response.redirected) await cache.put(url, response);
      } catch {
        // Warming is best-effort by definition.
      }
    }),
  );
}

// ─────────────────────────────────────────────────────── the upload queue ───

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function runStore(mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const request = fn(transaction.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => db.close();
      }),
  );
}

async function tellPages(message) {
  const pages = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const page of pages) page.postMessage(message);
}

let draining = false;

/**
 * Empty the queue, oldest photo first, one at a time.
 *
 * Sequential on purpose: a rooftop connection copes far better with one upload
 * than six, and the first failure is a reliable sign the rest will fail too, so
 * the run stops rather than burning the whole queue's retry budget at once.
 */
async function drainQueue() {
  if (draining) return;
  draining = true;

  try {
    const all = await runStore("readonly", (store) => store.getAll());
    const queue = all.sort((a, b) => a.queuedAt - b.queuedAt);

    for (const item of queue) {
      let outcome;
      try {
        outcome = await sendQueued(item);
      } catch {
        return; // The network went away again. Everything stays queued.
      }

      if (outcome === "sent") {
        await runStore("readwrite", (store) => store.delete(item.id));
        await tellPages({ type: "ribbet-upload-sent", id: item.id, name: item.name });
        continue;
      }

      if (outcome === "gone") {
        await runStore("readwrite", (store) => store.delete(item.id));
        await tellPages({
          type: "ribbet-upload-dropped",
          id: item.id,
          name: item.name,
          reason: "This device isn't signed in to the guest list any more — find your name and send it again.",
        });
        continue;
      }

      if (outcome === "full") {
        // The couple's Drive is out of room. Keep the photo indefinitely and
        // don't spend an attempt on it — losing it is the one unacceptable
        // outcome, and more space is a thing they can go and buy.
        await tellPages({ type: "ribbet-vault-full", id: item.id, name: item.name });
        return;
      }

      const attempts = (item.attempts ?? 0) + 1;
      if (attempts >= MAX_ATTEMPTS) {
        await runStore("readwrite", (store) => store.delete(item.id));
        await tellPages({
          type: "ribbet-upload-dropped",
          id: item.id,
          name: item.name,
          reason: "This one wouldn't send after several tries. Pick it again when you have a solid connection.",
        });
      } else {
        await runStore("readwrite", (store) => store.put({ ...item, attempts }));
      }
      return;
    }
  } finally {
    draining = false;
  }
}

/**
 * One queued photo, all the way to Drive.
 *
 * The slot is minted now rather than when the photo was queued: a resumable
 * session URI is perishable, and there was no network at queueing time anyway.
 *
 * Throws on a network failure — the caller reads that as "still offline" and
 * leaves the queue alone.
 */
async function sendQueued(item) {
  const slot = await fetch(`/api/vault/${item.slug}/slot`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: item.name, mimeType: item.type, sizeBytes: item.size }),
  });

  if (slot.status === 403 || slot.status === 404) return "gone";
  if (slot.status === 507) return "full";
  if (!slot.ok) return "retry";

  const { uploadUrl } = await slot.json();
  if (!uploadUrl) return "retry";

  // The blob is sent exactly as the picker handed it over — no canvas, no
  // resize, no re-encode. See "Quality is non-negotiable" in README.md.
  const put = await fetch(uploadUrl, {
    method: "PUT",
    body: item.blob,
    headers: { "Content-Type": item.type },
  });
  if (!put.ok) return "retry";

  const uploaded = await put.json().catch(() => ({}));
  if (!uploaded.id) return "retry";

  await fetch(`/api/vault/${item.slug}/complete`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileId: uploaded.id,
      takenAt: new Date(item.lastModified).toISOString(),
    }),
  });

  return "sent";
}

// ─────────────────────────────────────────────────────────────── signals ────

// Chrome and friends: fires when connectivity returns, app open or not.
self.addEventListener("sync", (event) => {
  if (event.tag === SYNC_TAG) event.waitUntil(drainQueue());
});

// Safari and everyone else: the page asks, because it has to.
self.addEventListener("message", (event) => {
  const data = event.data ?? {};
  if (data.type === "ribbet-drain") event.waitUntil(drainQueue());
  if (data.type === "ribbet-warm") event.waitUntil(warmShell(data.urls));
});
