/**
 * What is for this deadline.
 *
 * The app could make a great many things — a document, a sheet, a deck, an
 * equation, a note, a file dropped into the drive — and every one of them
 * could say which *course* it belonged to. A course is four months and a dozen
 * deadlines wide. So the response paper due Friday, the one due in November
 * and the reading notes from week two were all filed identically, as "ECON
 * 1010", and the question a student actually asks at 9pm — *where is the thing
 * I was writing for Friday* — was one the app held the answer to and had no
 * way of being asked.
 *
 * The link is a single optional `itemId` on each of those objects, and this is
 * the one module that reads it. Everything that draws the relationship — the
 * panel under a deadline, the marker on a deadline row, the line on a file in
 * the drive, the picker on every screen that makes something — comes through
 * here, so there is one answer to "what counts as work for this" rather than
 * six screens each with an opinion.
 *
 * ## A link that has lost its other end
 *
 * A deadline can be edited out of a course, and a course can be deleted with
 * the documents written for it still in the account. So `itemId` may name
 * something that no longer exists, and the rule here is that a dangling link
 * reads as **no link** rather than as a broken one: `attachedTo` is asked
 * about an id that exists, `nameFor` answers undefined for one that does not,
 * and nothing in the app draws "for a deadline that is gone". The id is left
 * on the object rather than scrubbed, because a course restored from a backup
 * or re-imported keeps its item ids and the filing then simply comes back.
 *
 * ## Why tasks are not in here
 *
 * `PersonalTask.from` is the same shape of link and it deliberately does not
 * join this list. The steps that break a paper into evenings already have a
 * home directly above this panel — `components/BreakItUp.tsx` draws them and
 * reports how many are left — and a second listing of the same five tasks
 * under a different heading is exactly the duplication five simplification
 * passes have been spent removing. This is the things you *made*; that is the
 * plan for making them.
 */

import type { Doc } from './document';
import type { Sheet } from './sheet';
import type { StoredDeck } from './decks';
import type { SavedEquation } from './maths';
import type { Settled } from './files';
import type { DatedItem, Note } from './types';

/** The six kinds of thing that can be filed against a deadline. */
export type WorkKind = 'document' | 'sheet' | 'deck' | 'note' | 'equation' | 'file';

/**
 * Every kind, in the order a tie is broken and a New row is drawn.
 *
 * Documents first because a deadline is most often a piece of writing, then
 * the other two things with an editor, then the three that are kept rather
 * than composed.
 */
export const WORK_KINDS: readonly WorkKind[] = [
  'document',
  'sheet',
  'deck',
  'note',
  'equation',
  'file',
] as const;

/** What each kind is called where somebody reads it. Singular, sentence case. */
export const WORK_LABEL: Record<WorkKind, string> = {
  document: 'Document',
  sheet: 'Sheet',
  deck: 'Deck',
  note: 'Note',
  equation: 'Equation',
  file: 'File',
};

/**
 * The least a deadline has to be to be named.
 *
 * `nameFor` and `forLine` read an id and a title and nothing else, and taking
 * the least means they can be handed the account's *whole* list of deadlines
 * rather than the decorated ones for the term that happens to be open. That
 * distinction is the whole of a bug this had: `catalog` is one term by design
 * (see `state/store.tsx`), so a file filed against last term's essay drew as
 * having no deadline at all the moment somebody switched terms — a live link
 * reported as a dangling one. The drive already reaches across terms for its
 * folders, for the same reason and with the same comment.
 */
export interface Named {
  id: string;
  title: string;
}

/** One piece of work, as the panel and the pickers need it. */
export interface Attached {
  kind: WorkKind;
  id: string;
  /** Its own name, or a stand-in — never an empty row. */
  title: string;
  /** When it was last touched, for ordering. */
  at: number;
}

/**
 * The lists this module reads, as one argument.
 *
 * Structural rather than `State`, for the reason `Made` in `lib/find.ts` is:
 * a caller with two of the six passes two, a test builds only what it is
 * testing, and the app's own `State` satisfies it without a conversion because
 * it has all six under these names.
 */
export interface Holdings {
  documents?: readonly Doc[];
  sheets?: readonly Sheet[];
  decks?: readonly StoredDeck[];
  equations?: readonly SavedEquation[];
  notes?: readonly Note[];
  files?: readonly Settled[];
}

/** A title that is never blank, so a row is never a blank row. */
function named(title: string, kind: WorkKind): string {
  return title.trim() || `Untitled ${WORK_LABEL[kind].toLowerCase()}`;
}

/** A flattened row, with the two fields every reader here filters on. */
interface Row extends Attached {
  itemId: string | null;
  courseId: string | null;
}

/**
 * Everything in the account, flattened to one shape.
 *
 * Built once and filtered, rather than six filters — `countsByItem` needs
 * every row and `attachedTo` needs one deadline's, and doing it twice was two
 * places to forget a kind when a seventh arrives.
 */
function rows(held: Holdings): Row[] {
  const out: Row[] = [];
  const add = (
    kind: WorkKind,
    id: string,
    title: string,
    at: number,
    itemId: string | null | undefined,
    courseId: string | null | undefined,
  ) => out.push({ kind, id, title: named(title, kind), at, itemId: itemId ?? null, courseId: courseId ?? null });

  for (const d of held.documents ?? []) add('document', d.id, d.title, d.updated, d.itemId, d.courseId);
  for (const s of held.sheets ?? []) add('sheet', s.id, s.title, s.updated, s.itemId, s.courseId);
  for (const k of held.decks ?? []) add('deck', k.id, k.title, k.updated, k.itemId, k.courseId);
  for (const n of held.notes ?? []) add('note', n.id, n.title, n.updated, n.itemId, n.courseId);
  for (const e of held.equations ?? []) add('equation', e.id, e.name, e.created, e.itemId, e.courseId);
  /*
   * A file is ordered by when it arrived, not by when it was last opened.
   *
   * `openedAt` exists and is tempting, and it would mean a list that
   * rearranged itself every time somebody looked at something — the one
   * behaviour that makes a short list impossible to use, because the row you
   * just read is never where you left it.
   *
   * Files in the bin are not work you have; a deleted file that still showed
   * under its deadline would be a delete that did not delete.
   */
  for (const f of held.files ?? []) {
    if (f.trashedAt !== null) continue;
    add('file', f.id, f.name, f.added, f.itemId, f.courseId);
  }
  return out;
}

/** A row as the outside sees it — without the two fields it was filtered on. */
function bare({ itemId: _itemId, courseId: _courseId, ...rest }: Row): Attached {
  return rest;
}

/**
 * Everything filed against one deadline, most recently touched first.
 *
 * Recency rather than kind, because the useful row is nearly always the one
 * being worked on and a list of two to four things does not need grouping.
 * Ties break on the kind order above and then on id, so the same holdings
 * always draw in the same order — a list that shuffles between renders is a
 * list people stop trusting.
 */
export function attachedTo(held: Holdings, itemId: string): Attached[] {
  return rows(held)
    .filter((r) => r.itemId === itemId)
    .map(bare)
    .sort(
      (a, b) =>
        b.at - a.at ||
        WORK_KINDS.indexOf(a.kind) - WORK_KINDS.indexOf(b.kind) ||
        a.id.localeCompare(b.id),
    );
}

/**
 * How many things are filed against each deadline, by deadline id.
 *
 * One pass for the whole account, because the caller is a list of rows: asking
 * per row would walk every document once per deadline drawn, which on a heavy
 * Tuesday is the same work forty times.
 */
export function countsByItem(held: Holdings): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows(held)) {
    if (r.itemId) out[r.itemId] = (out[r.itemId] ?? 0) + 1;
  }
  return out;
}

/**
 * What could still be filed against this deadline, for the "attach something
 * you already have" picker.
 *
 * Only things filed against no deadline at all. Something already attached
 * elsewhere is deliberately not offered: moving a document from one deadline
 * to another is a thing to do on the document, where its own picker is, and
 * offering it here would make this panel a place work silently disappears
 * from another one.
 *
 * `courseId` narrows it to the course the deadline belongs to, plus everything
 * filed against no course — a document written before anybody thought to tag
 * it is exactly what somebody is looking for here. Pass null for a deadline
 * with no course and the whole unattached list comes back.
 */
export function attachable(held: Holdings, courseId: string | null): Attached[] {
  return rows(held)
    .filter((r) => r.itemId === null && (courseId === null || r.courseId === null || r.courseId === courseId))
    .map(bare)
    .sort(
      (a, b) =>
        b.at - a.at ||
        WORK_KINDS.indexOf(a.kind) - WORK_KINDS.indexOf(b.kind) ||
        a.id.localeCompare(b.id),
    );
}

/**
 * The deadlines something can be filed against, in the order a picker draws
 * them.
 *
 * Everything still ahead, soonest first, then everything gone by, most recent
 * first. Both halves are needed and the order between them is the whole point:
 * work is nearly always for the next thing, and the second commonest case is
 * the thing that was due yesterday and is being finished now. A list in plain
 * date order buries the first behind twelve weeks of history.
 *
 * `courseId` is required rather than optional. A picker that offered every
 * deadline in the term would be forty-odd chips, which is not a control; and a
 * document filed against ECON's midterm while tagged PSCI is a contradiction
 * the app would then have to explain. Pass null and nothing comes back, which
 * is what a thing with no course should offer.
 */
export function pickable(items: readonly DatedItem[], courseId: string | null): DatedItem[] {
  if (!courseId) return [];
  const mine = items.filter((i) => i.c === courseId);
  const ahead = mine.filter((i) => !i.isPast).sort((a, b) => a.date.getTime() - b.date.getTime());
  const gone = mine.filter((i) => i.isPast).sort((a, b) => b.date.getTime() - a.date.getTime());
  return [...ahead, ...gone];
}

/**
 * What to call the deadline an id names, or undefined where it names nothing.
 *
 * The undefined is the dangling-link rule in the module note, in one place:
 * every caller writes "for X" only when this answers, so nothing in the app
 * can draw a link to a deadline that has been edited away.
 */
export function nameFor(items: readonly Named[], itemId: string | null | undefined): string | undefined {
  if (!itemId) return undefined;
  return items.find((i) => i.id === itemId)?.title;
}

/**
 * "for Reflection #2", or nothing at all.
 *
 * The one phrase this relationship is written as, so the six places that show
 * it — a file row in the drive, the three shelves of made things, the equation
 * list, a search result — cannot drift into "For:", "→" and "(Reflection #2)".
 * Empty rather than a placeholder, so it drops out of a `.filter(Boolean)`
 * joined line instead of leaving a dangling separator.
 */
export function forLine(items: readonly Named[], itemId: string | null | undefined): string {
  const name = nameFor(items, itemId);
  return name ? `for ${name}` : '';
}

/**
 * The deadline an id names, where it names one.
 *
 * `nameFor` covers the common case of a single line of text; this is for the
 * two places that need the date and the course as well.
 */
export function itemFor<T extends Named>(
  items: readonly T[],
  itemId: string | null | undefined,
): T | undefined {
  if (!itemId) return undefined;
  return items.find((i) => i.id === itemId);
}
