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
  blob: Blob;
}

/** What the UI needs to list a file, without pulling the bytes into memory. */
export type FileMeta = Omit<StoredFile, 'blob'>;

/** This file's own database and store. The wrapper is `lib/idb.ts`. */
const { tx } = store(DB_NAME, STORE, DB_VERSION);

export async function addFile(file: File, courseId: string | null): Promise<FileMeta> {
  const record: StoredFile = {
    id: newId(),
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
    added: Date.now(),
    courseId,
    blob: file,
  };
  await tx('readwrite', (s) => s.put(record));
  const { blob: _blob, ...meta } = record;
  return meta;
}

export async function listFiles(): Promise<FileMeta[]> {
  try {
    const all = await tx<StoredFile[]>('readonly', (s) => s.getAll() as IDBRequest<StoredFile[]>);
    return all
      .map(({ blob: _blob, ...meta }) => meta)
      .sort((a, b) => b.added - a.added);
  } catch {
    // Private windows and storage-blocked browsers land here. The rest of the
    // app works; the file list is just empty.
    return [];
  }
}

export async function getFile(id: string): Promise<StoredFile | undefined> {
  return tx<StoredFile | undefined>(
    'readonly',
    (s) => s.get(id) as IDBRequest<StoredFile | undefined>,
  );
}

export async function deleteFile(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id));
}

/** Total bytes held, so the UI can say how much room the files are taking. */
export async function totalSize(): Promise<number> {
  const files = await listFiles();
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
  return true;
}
