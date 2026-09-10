/**
 * A document's earlier drafts, and the way back to one.
 *
 * The editor autosaves, which is right and is also the thing that makes a
 * version history necessary rather than nice: every keystroke overwrites the
 * only copy, so a paragraph deleted by accident at eleven at night is a
 * paragraph that never existed. There was no undo across a reload and no
 * second copy anywhere.
 *
 * ## Why not in the store
 *
 * The account lives in about five megabytes shared by every note, course and
 * document in it. A history is by definition many copies of the largest thing
 * in there, so putting it beside them would mean an essay's drafts crowding
 * out the essay. IndexedDB has room and is where this app already puts
 * anything that grows — the attachments and the rolling snapshots both.
 *
 * ## What gets kept
 *
 * Not every keystroke. A version is written when the writing pauses — the
 * screen decides when, this file decides what — and one is only kept if it
 * differs from the last. Twenty per document, oldest dropped first, which is
 * a morning's work at the rate anybody actually saves and is bounded, which
 * matters more.
 *
 * Everything fails soft. A private window or a browser with storage switched
 * off has no history, and the editor works exactly as it did before this
 * existed.
 */

import { newId, store } from './idb';
import type { Block, Doc } from './document';

const DB_NAME = 'semester-drafts';
const STORE = 'versions';

/** How many are kept per document. */
export const KEEP = 20;

export interface Version {
  id: string;
  docId: string;
  at: number;
  title: string;
  blocks: Block[];
  /** Words at the time, so the list can say how the draft grew or shrank. */
  words: number;
}

const { tx } = store(DB_NAME, STORE, 1);

/** Every version of one document, newest first. */
export async function versionsOf(docId: string): Promise<Version[]> {
  try {
    const all = await tx<Version[]>('readonly', (s) => s.getAll() as IDBRequest<Version[]>);
    return all.filter((v) => v.docId === docId).sort((a, b) => b.at - a.at);
  } catch {
    return [];
  }
}

/**
 * Whether two drafts are the same document.
 *
 * By content rather than by a stamp: the editor calls `keep` on a pause, and a
 * pause after moving the cursor is not a new draft. Comparing the serialised
 * blocks is exact and cheap at this size, and it is what stops a history from
 * filling with twenty identical entries during one long think.
 */
function same(a: Version | undefined, doc: Doc): boolean {
  if (!a) return false;
  return a.title === doc.title && JSON.stringify(a.blocks) === JSON.stringify(doc.blocks);
}

/**
 * Keep this draft, unless it is the one already at the top.
 *
 * Answers whether anything was written, so the screen can say "saved" honestly
 * rather than on a timer.
 */
export async function keep(doc: Doc, wordCount: number, at = Date.now()): Promise<boolean> {
  try {
    const have = await versionsOf(doc.id);
    if (same(have[0], doc)) return false;

    const version: Version = {
      id: newId(),
      docId: doc.id,
      at,
      title: doc.title,
      blocks: doc.blocks,
      words: wordCount,
    };
    await tx('readwrite', (s) => s.put(version));

    // Oldest first out. Done after the write rather than before, so a failure
    // to prune costs a spare version rather than the one being saved.
    for (const old of have.slice(KEEP - 1)) {
      await tx('readwrite', (s) => s.delete(old.id));
    }
    return true;
  } catch {
    return false;
  }
}

/** Forget one document's history — for when the document itself goes. */
export async function forget(docId: string): Promise<void> {
  try {
    for (const v of await versionsOf(docId)) {
      await tx('readwrite', (s) => s.delete(v.id));
    }
  } catch {
    // Nothing to do. A history that cannot be deleted is not worth an error
    // in front of somebody who was deleting a document.
  }
}

/** Every version of everything, for the storage figures on the Data screen. */
export async function allVersions(): Promise<Version[]> {
  try {
    return await tx<Version[]>('readonly', (s) => s.getAll() as IDBRequest<Version[]>);
  } catch {
    return [];
  }
}

/**
 * What restoring a version does to the document.
 *
 * A new object rather than a mutation, and the id, course and created stamp
 * stay the document's own — restoring is not making a copy, it is putting this
 * document back to how it read. `updated` is left for the reducer to stamp, as
 * it stamps every other edit.
 */
export function restored(doc: Doc, version: Version): Doc {
  return { ...doc, title: version.title, blocks: version.blocks };
}

/**
 * How a version reads in the list: when, and how it differed in length.
 *
 * The word count moves rather than the absolute, because what somebody is
 * looking for in a history is the draft before they cut three paragraphs, and
 * "−480 words" finds it where "1,204 words" does not.
 */
export function change(version: Version, previous: Version | undefined): string {
  if (!previous) return `${version.words} words`;
  const moved = version.words - previous.words;
  if (moved === 0) return `${version.words} words`;
  return `${version.words} words · ${moved > 0 ? '+' : '−'}${Math.abs(moved)}`;
}
