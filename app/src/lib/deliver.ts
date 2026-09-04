/**
 * Where an export goes.
 *
 * `export.ts` turns your semester into strings; this puts them somewhere. Three
 * destinations, in the order people actually want them: onto the device, into
 * a zip, or up to the Drive or OneDrive already connected.
 *
 * The zip is written by fflate, which is already here for reading .docx
 * syllabi. Nothing is compressed twice — a folder of text compresses well and
 * a folder of PDFs does not, so the level is left at the default rather than
 * spending a second of a phone's CPU proving it.
 *
 * Nothing here decides *what* to export. That is the screen's job, and keeping
 * it out of this file is what lets the formats be tested without a browser.
 */

import { upload } from './connect';
import type { ProviderId } from './connect';
import { getFile, listFiles } from './files';
import { safeName } from './export';

export interface Piece {
  /** The name it gets inside the zip, or as a download. */
  name: string;
  body: string | Blob;
  mime: string;
}

export function blobOf(piece: Piece): Blob {
  return piece.body instanceof Blob
    ? piece.body
    : new Blob([piece.body], { type: `${piece.mime};charset=utf-8` });
}

/**
 * Save to the device.
 *
 * The object URL is revoked on a timer rather than immediately: Safari starts
 * the download asynchronously and a URL revoked in the same tick produces a
 * failed download with no error anywhere.
 */
export function download(piece: Piece): void {
  const url = URL.createObjectURL(blobOf(piece));
  const a = document.createElement('a');
  a.href = url;
  a.download = piece.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/**
 * Hand it to the phone's own share sheet.
 *
 * `download` puts a file in a downloads folder, which on a phone is where
 * things go to be lost. What a student actually wants to do with a practice
 * paper or a printed week is send it to the group chat, AirDrop it to the
 * person next to them, or put it in their own notes app — and every one of
 * those is behind the system share sheet.
 *
 * Returns false when there was no sheet to use or the person dismissed it, so
 * the caller can fall back to a download rather than appearing to do nothing.
 * A dismissal and an absent API are deliberately the same answer: in both
 * cases the file has not gone anywhere and the offer should stay on screen.
 */
export async function shareOut(pieces: Piece[], title: string): Promise<boolean> {
  const nav = navigator as Navigator & {
    canShare?: (data: { files?: File[] }) => boolean;
    share?: (data: { files?: File[]; title?: string }) => Promise<void>;
  };
  if (!nav.share || !nav.canShare) return false;

  const files = pieces.map((p) => new File([blobOf(p)], p.name, { type: p.mime }));
  // Asking first matters: a browser with `share` but no file support throws
  // on the call, and a thrown share looks to a person like a broken button.
  if (!nav.canShare({ files })) return false;

  try {
    await nav.share({ files, title });
    return true;
  } catch {
    // Dismissed, or refused. Neither is an error worth showing.
    return false;
  }
}

/** Everything in one archive, with the folder structure the names imply. */
export async function zipOf(pieces: Piece[]): Promise<Blob> {
  const { zipSync } = await import('fflate');
  const entries: Record<string, Uint8Array> = {};
  for (const piece of pieces) {
    const bytes =
      piece.body instanceof Blob
        ? new Uint8Array(await piece.body.arrayBuffer())
        : new TextEncoder().encode(piece.body);
    // A duplicate name would silently drop one of them.
    let name = piece.name;
    for (let n = 2; name in entries; n++) name = numbered(piece.name, n);
    entries[name] = bytes;
  }
  return new Blob([zipSync(entries) as unknown as BlobPart], { type: 'application/zip' });
}

/** "notes.md" and a clash becomes "notes-2.md". */
export function numbered(name: string, n: number): string {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return `${name}-${n}`;
  return `${name.slice(0, dot)}-${n}${name.slice(dot)}`;
}

/**
 * Every attachment you have kept, as pieces ready to go in a zip.
 *
 * Files live in IndexedDB as blobs, so this is the only part of an export that
 * has to go and fetch anything. A file that has gone missing — cleared site
 * data, a browser reclaiming storage — is skipped rather than failing the
 * whole export, and the caller is told how many.
 */
export async function filePieces(): Promise<{ pieces: Piece[]; missing: number }> {
  const metas = await listFiles();
  const pieces: Piece[] = [];
  let missing = 0;
  for (const meta of metas) {
    try {
      const record = await getFile(meta.id);
      if (!record?.blob) {
        missing++;
        continue;
      }
      const blob = record.blob;
      pieces.push({
        name: `files/${safeName(meta.name, meta.id)}`,
        body: blob,
        mime: blob.type || 'application/octet-stream',
      });
    } catch {
      missing++;
    }
  }
  return { pieces, missing };
}

/** Up to the account already connected. Returns where it landed. */
export async function sendTo(
  id: ProviderId,
  piece: Piece,
): Promise<{ name: string; link: string }> {
  return upload(id, piece.name.replace(/^.*\//, ''), blobOf(piece));
}
