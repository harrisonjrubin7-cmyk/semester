/**
 * File storage for things you attach yourself.
 *
 * Notes and tasks are small and live in localStorage with the rest of the
 * app's state. Files are not — a lecture slide deck or a photo of a whiteboard
 * would blow the 5MB localStorage budget on its own — so they go in IndexedDB,
 * which stores Blobs natively and has room.
 *
 * Everything here stays on the device. Nothing is uploaded anywhere.
 */

import { newId, store } from './idb';

const DB_NAME = 'semester-files';
const DB_VERSION = 1;
const STORE = 'files';

export interface StoredFile {
  id: string;
  name: string;
  type: string;
  size: number;
  added: number;
  /** Course this was filed against, or null for a general file. */
  courseId: string | null;
  /*
   * Everything below arrived after the store did, and every one of them is
   * optional for that reason. A file put here last term has none of these
   * fields, and `settled` reads a missing one as its default rather than as a
   * reason to migrate — an IndexedDB migration that rewrites every record is a
   * migration that can fail halfway through somebody's coursework.
   */
  /** The folder it sits in, or null for the top of the drive. */
  folderId?: string | null;
  starred?: boolean;
  /** When it went to the bin. Absent means it is not in the bin. */
  trashedAt?: number | null;
  /** Last time it was opened, for the recents list. */
  openedAt?: number | null;
  /**
   * The deadline this file is for, where it is for one.
   *
   * The one link the drive never had. A file could say which course it
   * belonged to and which note it was attached to, and a course is a term
   * wide — so "which of these eleven PDFs is the reading for Friday" was a
   * question the drive held the answer to and could not be asked. See
   * `Doc.itemId` in `lib/document.ts`, and read it through `lib/forwork.ts`.
   */
  itemId?: string | null;
  /**
   * Text pulled out of it when it arrived, so search can look inside.
   *
   * Only for the formats `lib/extract.ts` can read, only the first few
   * thousand characters, and never shown — it exists to be searched. A file
   * whose text could not be read simply has none, and is then findable by its
   * name like any other.
   */
  text?: string;
  blob: Blob;
}

/** What the UI needs to list a file, without pulling the bytes into memory. */
export type FileMeta = Omit<StoredFile, 'blob'>;

/**
 * One record with every optional field decided, so nothing downstream has to
 * ask whether a file predates a feature.
 */
export type Settled = FileMeta & {
  folderId: string | null;
  starred: boolean;
  trashedAt: number | null;
  openedAt: number | null;
  itemId: string | null;
};

export function settled(meta: FileMeta): Settled {
  return {
    ...meta,
    folderId: meta.folderId ?? null,
    starred: meta.starred ?? false,
    trashedAt: meta.trashedAt ?? null,
    openedAt: meta.openedAt ?? null,
    itemId: meta.itemId ?? null,
  };
}

/** How long a file sits in the bin before `emptyOld` will take it. */
export const TRASH_DAYS = 30;

/*
 * Who to tell when a file changes.
 *
 * The drive re-reads on its own after every press it makes, which was enough
 * while the drive was the only screen that knew files existed. It is not any
 * more: a deadline's own panel adds and unfiles them, and the marker on every
 * deadline row counts them. Three screens each re-reading on their own presses
 * is three screens showing yesterday's count after somebody used one of the
 * other two.
 *
 * So every write here says so, once, and `lib/clips.ts` turns that into a
 * React subscription. Deliberately a bare signal with no payload: a listener
 * that wants the files reads them, and a notification carrying a list would be
 * a second copy of the store to keep in step.
 */
const watchers = new Set<() => void>();

/** Called after every write below. Exported only for the tests that assert it. */
export function changed(): void {
  for (const w of [...watchers]) w();
}

/** Subscribe to file changes. Returns the unsubscribe, as React wants. */
export function onFilesChanged(fn: () => void): () => void {
  watchers.add(fn);
  return () => {
    watchers.delete(fn);
  };
}

/** This file's own database and store. The wrapper is `lib/idb.ts`. */
const { tx, work } = store(DB_NAME, STORE, DB_VERSION);

/**
 * `folderId`, `text` and `itemId` are optional and last, so every caller
 * written before folders or deadline links existed still compiles and still
 * files to the top of the drive against no deadline.
 */
export async function addFile(
  file: File,
  courseId: string | null,
  folderId: string | null = null,
  text = '',
  itemId: string | null = null,
): Promise<FileMeta> {
  const record: StoredFile = {
    id: newId(),
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
    added: Date.now(),
    courseId,
    folderId,
    starred: false,
    trashedAt: null,
    openedAt: null,
    itemId,
    ...(text ? { text } : {}),
    blob: file,
  };
  await tx('readwrite', (s) => s.put(record));
  changed();
  const { blob: _blob, ...meta } = record;
  return meta;
}

/**
 * Every record, bin included. The one read the others are built on.
 *
 * Private windows and storage-blocked browsers land in the catch. The rest of
 * the app works; the file list is just empty.
 */
export async function allFiles(): Promise<Settled[]> {
  try {
    const all = await tx<StoredFile[]>('readonly', (s) => s.getAll() as IDBRequest<StoredFile[]>);
    return all.map(({ blob: _blob, ...meta }) => settled(meta)).sort((a, b) => b.added - a.added);
  } catch {
    return [];
  }
}

/**
 * The files somebody has, which is not the same as the files stored.
 *
 * A file in the bin is one the student has deleted, and every caller of this —
 * the Files list, the backup zip, a note's attachments — means the live ones.
 * The bin is `listTrash`, and the bytes are still counted by `totalSize`,
 * because room taken is room taken whatever a file is called.
 */
export async function listFiles(): Promise<Settled[]> {
  return (await allFiles()).filter((f) => f.trashedAt === null);
}

/** What is in the bin, most recently binned first. */
export async function listTrash(): Promise<Settled[]> {
  return (await allFiles())
    .filter((f) => f.trashedAt !== null)
    .sort((a, b) => (b.trashedAt ?? 0) - (a.trashedAt ?? 0));
}

export async function getFile(id: string): Promise<StoredFile | undefined> {
  return tx<StoredFile | undefined>(
    'readonly',
    (s) => s.get(id) as IDBRequest<StoredFile | undefined>,
  );
}

/**
 * Change some of a record, reading and writing inside one transaction.
 *
 * The first version of this read through `getFile` and then opened a *second*
 * transaction to write — which is two transactions, and between them another
 * one can land. Starring a file and moving it at the same moment then wrote
 * back two records each built from the state before the other, and whichever
 * finished second silently undid the first.
 *
 * IndexedDB's own guarantee is per transaction, so the fix is to stay inside
 * one: the read and the `put` are both issued against `store` here, and the
 * transaction does not commit until both have run.
 */
async function patch(id: string, change: Partial<StoredFile>): Promise<void> {
  await work<void>('readwrite', (s, done) => {
    const read = s.get(id) as IDBRequest<StoredFile | undefined>;
    read.onsuccess = () => {
      const record = read.result;
      // Gone between the press and here. Nothing to change, and putting the
      // change back would resurrect a deleted file.
      if (!record) {
        done(undefined);
        return;
      }
      s.put({ ...record, ...change });
      done(undefined);
    };
  });
  changed();
}

/** Move a file into a folder, or to the top of the drive with null. */
export async function moveFile(id: string, folderId: string | null): Promise<void> {
  await patch(id, { folderId });
}

/** File it against a course, or against none. Independent of which folder it is in. */
export async function tagFile(id: string, courseId: string | null): Promise<void> {
  await patch(id, { courseId });
}

/**
 * File it against a deadline, or against none.
 *
 * Independent of both the folder and the course, deliberately. A file can sit
 * in a folder called "Readings", be tagged PSCI 1100 and be the thing being
 * handed in on Friday, and all three are true at once — a link that implied
 * either of the other two would be a link that moved somebody's filing behind
 * their back.
 */
export async function pinFile(id: string, itemId: string | null): Promise<void> {
  await patch(id, { itemId });
}

export async function starFile(id: string, starred: boolean): Promise<void> {
  await patch(id, { starred });
}

/**
 * To the bin, not gone.
 *
 * The old `deleteFile` erased the bytes on the press, which is the one thing
 * about a file store that cannot be undone and the one mistake everybody
 * makes. It is still here and still erases, because "empty the bin" has to
 * mean something — it is just no longer what the delete button calls.
 */
export async function trashFile(id: string, at = Date.now()): Promise<void> {
  await patch(id, { trashedAt: at });
}

export async function restoreFile(id: string): Promise<void> {
  await patch(id, { trashedAt: null });
}

/** Gone. The bytes, not a flag. */
export async function deleteFile(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id));
  changed();
}

/**
 * Empty the bin, or only the part of it older than `days`.
 *
 * Each delete re-reads the record and checks it is *still* in the bin, inside
 * the same transaction as the delete. The list this walks was read earlier,
 * and "earlier" is long enough: press Empty the bin, put a file back while it
 * runs, and a delete keyed on the stale list erases a file the student had
 * just rescued. There is no undo behind this one — the blob is the only copy —
 * so it is worth a read per file.
 */
export async function emptyTrash(days = 0, now = Date.now()): Promise<number> {
  const cutoff = now - days * 86_400_000;
  const old = (await listTrash()).filter((f) => (f.trashedAt ?? 0) <= cutoff);
  let gone = 0;
  for (const f of old) {
    const took = await deleteIfStillBinned(f.id, cutoff);
    if (took) gone += 1;
  }
  // Once for the whole sweep rather than once per file: emptying a bin of
  // forty is one change as far as anything watching is concerned, and forty
  // notifications would be forty re-reads of the same list.
  if (gone > 0) changed();
  return gone;
}

/** Delete one file only if it is in the bin now, deciding and doing it at once. */
function deleteIfStillBinned(id: string, cutoff: number): Promise<boolean> {
  return work<boolean>('readwrite', (s, done) => {
    const read = s.get(id) as IDBRequest<StoredFile | undefined>;
    read.onsuccess = () => {
      const record = read.result;
      const binned = record?.trashedAt ?? null;
      if (!record || binned === null || binned > cutoff) {
        done(false);
        return;
      }
      s.delete(id);
      done(true);
    };
  });
}

/**
 * The bin's own housekeeping: take out what has been in there past its month.
 *
 * `TRASH_DAYS` was a promise the code did not keep — nothing ever called
 * `emptyTrash` with it, so a binned file's bytes stayed on the device for
 * ever. Called when the drive opens, which is the only moment anybody is
 * looking at the bin anyway.
 */
export async function sweepTrash(now = Date.now()): Promise<number> {
  try {
    return await emptyTrash(TRASH_DAYS, now);
  } catch {
    return 0;
  }
}

/** Note the moment a file was opened, so the recents list has something to sort by. */
export async function touchFile(id: string, at = Date.now()): Promise<void> {
  await patch(id, { openedAt: at });
}

/**
 * Every file at once, for "erase from this device".
 *
 * Through the store's own `clear` rather than a delete per id: the point of
 * the erase is that nothing is left, and a loop over ids that half-fails
 * leaves a set of files nobody can see and nothing can name.
 */
export async function clearFiles(): Promise<void> {
  await tx('readwrite', (s) => s.clear());
  changed();
}

/**
 * Total bytes held, so the UI can say how much room the files are taking.
 *
 * Over every record rather than the live ones: a file in the bin still
 * occupies the disk, and a storage figure that ignored it would tell somebody
 * whose quota is full that they are using half of it.
 */
export async function totalSize(): Promise<number> {
  const files = await allFiles();
  return files.reduce((n, f) => n + f.size, 0);
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Open a stored file in a new tab. The object URL is revoked on the next tick —
 * long enough for the browser to have taken the handle, short enough not to
 * leak the blob for the life of the session.
 */
export async function openFile(id: string): Promise<boolean> {
  const record = await getFile(id);
  if (!record) return false;
  const url = URL.createObjectURL(record.blob);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  void touchFile(id);
  return true;
}

/**
 * Search names and, where there is any, the text inside.
 *
 * Every word has to appear somewhere, in any order — the way somebody looks
 * for "econ midterm" and means a file with both in it rather than a file whose
 * name is that phrase. Which one matched is reported, because "found in the
 * text" and "found in the name" are different enough that showing them
 * identically makes the text hits look like mistakes.
 */
export function search(files: Settled[], query: string): { file: Settled; inText: boolean }[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return files.map((file) => ({ file, inText: false }));

  const out: { file: Settled; inText: boolean }[] = [];
  for (const file of files) {
    const name = file.name.toLowerCase();
    const text = (file.text ?? '').toLowerCase();
    if (!words.every((w) => name.includes(w) || text.includes(w))) continue;
    out.push({ file, inText: words.some((w) => !name.includes(w) && text.includes(w)) });
  }
  // A hit in the name before a hit only in the text: somebody who typed a file
  // name wants that file first, not the essay that happens to mention it.
  return out.sort((a, b) => Number(a.inText) - Number(b.inText));
}
