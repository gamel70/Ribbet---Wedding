/**
 * The offline upload queue, page side.
 *
 * "Uploads queue in IndexedDB when offline and drain on reconnect" — README.md,
 * "Where the photos live". This module is the only thing that *writes* to that
 * queue; `public/sw.js` is the only thing that reads and empties it. The two
 * halves have to agree on the database name, version and store, so the
 * constants below are duplicated there and neither copy may drift.
 *
 * The File goes in as-is. IndexedDB stores the blob byte for byte, and the
 * worker PUTs that same blob to Drive, so a photo that waited out a dead
 * rooftop connection arrives identical to one that didn't. Nothing here
 * resizes, re-encodes or strips metadata, and nothing here ever should.
 */

const DB_NAME = "ribbet-vault";
const DB_VERSION = 1;
const STORE = "queue";

/** The Background Sync tag `sw.js` listens for. */
export const UPLOAD_SYNC_TAG = "ribbet-upload";

export type QueuedUpload = {
  /** Shared with the uploader's job id, so a drain can address the on-screen row. */
  id: string;
  slug: string;
  name: string;
  type: string;
  size: number;
  /** The picker's capture time, forwarded to `/complete` as `takenAt`. */
  lastModified: number;
  blob: Blob;
  queuedAt: number;
  attempts: number;
};

function openDb(): Promise<IDBDatabase> {
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

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const request = fn(transaction.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => db.close();
      }),
  );
}

/** Holds on to a photo the network couldn't take yet. */
export async function enqueueUpload(input: { id: string; slug: string; file: File }): Promise<void> {
  const record: QueuedUpload = {
    id: input.id,
    slug: input.slug,
    name: input.file.name,
    type: input.file.type || "application/octet-stream",
    size: input.file.size,
    lastModified: input.file.lastModified,
    blob: input.file,
    queuedAt: Date.now(),
    attempts: 0,
  };
  await run("readwrite", (store) => store.put(record));
}

/** Everything still waiting for this wedding, oldest first. */
export async function queuedUploads(slug: string): Promise<QueuedUpload[]> {
  const all = await run<QueuedUpload[]>("readonly", (store) => store.getAll());
  return all.filter((item) => item.slug === slug).sort((a, b) => a.queuedAt - b.queuedAt);
}

/**
 * Asks the worker to empty the queue.
 *
 * Background Sync is the good path — it fires when the connection returns even
 * if the app has been closed since — but Safari doesn't implement it at all,
 * and a wedding is full of iPhones. So the message is sent either way and the
 * worker guards against overlapping runs.
 */
export async function requestDrain(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.ready;

    const sync = (
      registration as ServiceWorkerRegistration & {
        sync?: { register: (tag: string) => Promise<void> };
      }
    ).sync;
    if (sync) await sync.register(UPLOAD_SYNC_TAG).catch(() => {});

    const worker = registration.active ?? navigator.serviceWorker.controller;
    worker?.postMessage({ type: "ribbet-drain" });
  } catch {
    // No worker yet on this device. The queue keeps; the next load drains it.
  }
}
