/**
 * The things you do to a document that are not writing it.
 *
 * Find and replace, the heading outline, and how long it takes to read. All
 * pure — a document in, an answer out — for the same reason `sheet.ts` is:
 * they are the parts worth testing, and the editor is the part worth looking
 * at.
 */

import { runs, unmarked, words, type Block, type Doc } from './document';

// ── The outline ──────────────────────────────────────────────────────────

export interface Heading {
  /** Which block it is, so pressing it can scroll to the right one. */
  at: number;
  level: 1 | 2 | 3;
  text: string;
}

/**
 * The headings, in order, for the sidebar you navigate a long document by.
 *
 * A heading with nothing in it is skipped rather than shown as a blank row: an
 * empty heading is one somebody is part-way through typing, and a sidebar that
 * grows a nameless entry on every keystroke is a sidebar that moves under the
 * cursor.
 */
export function outline(doc: Doc): Heading[] {
  const out: Heading[] = [];
  doc.blocks.forEach((block, at) => {
    if (block.kind !== 'heading') return;
    const text = unmarked(block.text).trim();
    if (text) out.push({ at, level: block.level, text });
  });
  return out;
}

// ── Measuring ────────────────────────────────────────────────────────────

/** Characters of prose, marks excluded — what a character limit counts. */
export function characters(doc: Doc): number {
  let n = 0;
  for (const block of doc.blocks) {
    if (block.kind === 'heading' || block.kind === 'text') n += unmarked(block.text).length;
    else if (block.kind === 'bullets') for (const item of block.items) n += unmarked(item).length;
    else if (block.kind === 'quote') n += unmarked(block.text).length;
  }
  return n;
}

/**
 * How long it takes to read, in whole minutes, never less than one.
 *
 * 220 words a minute, which is the middle of the range measured for adults
 * reading prose on a screen. It is an estimate and is labelled as one wherever
 * it is shown — the point is "this is a five-minute talk, not a fifteen-minute
 * one", not a promise about a particular reader.
 */
export const WORDS_A_MINUTE = 220;

export function readingMinutes(doc: Doc): number {
  return Math.max(1, Math.round(words(doc) / WORDS_A_MINUTE));
}

// ── Find and replace ─────────────────────────────────────────────────────

export interface Where {
  /** The block it is in. */
  at: number;
  /** Which item of a list, or -1 when the block is not a list. */
  item: number;
  /** Where in that string the match starts, and how long it is. */
  index: number;
  length: number;
  /** The line with the match in it, for the row in the results. */
  line: string;
}

export interface Options {
  matchCase?: boolean;
  /** Only where the match is a whole word — "art" not finding "start". */
  wholeWord?: boolean;
}

/**
 * The strings inside a document that a search should look at.
 *
 * Deliberately not every string. A table's cells and an equation's LaTeX are
 * skipped, and skipping them is the point: replacing "x" through a document
 * would otherwise rewrite the algebra, and somebody replacing a word in their
 * prose does not expect their equations to change. A quote's source is skipped
 * for the same reason — it is a citation, and a citation that quietly changed
 * is worse than one that did not change at all.
 */
function strings(block: Block): string[] {
  if (block.kind === 'heading' || block.kind === 'text' || block.kind === 'quote') {
    return [block.text];
  }
  if (block.kind === 'bullets') return block.items;
  return [];
}

function pattern(find: string, opts: Options): RegExp | null {
  if (!find) return null;
  const escaped = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // `\b` on a term starting or ending in punctuation matches nothing, so the
  // boundary is only added on the side where it can mean something.
  const left = opts.wholeWord && /^\w/.test(find) ? '\\b' : '';
  const right = opts.wholeWord && /\w$/.test(find) ? '\\b' : '';
  return new RegExp(`${left}${escaped}${right}`, opts.matchCase ? 'g' : 'gi');
}

/** Every match, in the order they are read. */
export function findAll(doc: Doc, find: string, opts: Options = {}): Where[] {
  const re = pattern(find, opts);
  if (!re) return [];
  const out: Where[] = [];
  doc.blocks.forEach((block, at) => {
    const parts = strings(block);
    parts.forEach((text, i) => {
      re.lastIndex = 0;
      for (let m = re.exec(text); m; m = re.exec(text)) {
        out.push({
          at,
          item: block.kind === 'bullets' ? i : -1,
          index: m.index,
          length: m[0].length,
          line: text,
        });
        // A pattern that can match nothing would loop for ever otherwise.
        if (m[0] === '') re.lastIndex += 1;
      }
    });
  });
  return out;
}

/**
 * The document with every match replaced.
 *
 * Returns a new document and a count, and never touches the original — the
 * screen keeps the old one until the student says to keep the change, which is
 * what makes "replace all" something you can look at before you accept it.
 *
 * The replacement goes in exactly as typed. No case matching: a tool that
 * decided "Economics" should replace "economics" because the match was
 * capitalised is a tool that has quietly rewritten a proper noun somebody
 * chose, and there is no way to ask for the literal after that.
 */
export function replaceAll(
  doc: Doc,
  find: string,
  put: string,
  opts: Options = {},
): { doc: Doc; changed: number } {
  const re = pattern(find, opts);
  if (!re) return { doc, changed: 0 };
  let changed = 0;

  const swap = (text: string): string => {
    re.lastIndex = 0;
    return text.replace(re, () => {
      changed += 1;
      return put;
    });
  };

  const blocks = doc.blocks.map((block): Block => {
    if (block.kind === 'heading' || block.kind === 'text') {
      return { ...block, text: swap(block.text) };
    }
    if (block.kind === 'quote') return { ...block, text: swap(block.text) };
    if (block.kind === 'bullets') return { ...block, items: block.items.map(swap) };
    return block;
  });

  return { doc: changed ? { ...doc, blocks } : doc, changed };
}

// ── Emphasis, applied ────────────────────────────────────────────────────

/**
 * Bold or italicise a stretch of a line, or take the marks off again.
 *
 * The document holds emphasis as markdown — see `runs` in `document.ts` — so
 * this wraps and unwraps the stars rather than carrying a second
 * representation. Toggling: a selection already entirely inside a mark loses
 * it, anything else gains it, which is what every editor's Ctrl+B does.
 */
export function emphasise(
  text: string,
  from: number,
  to: number,
  mark: 'bold' | 'italic',
): string {
  const start = Math.max(0, Math.min(from, to));
  const end = Math.min(text.length, Math.max(from, to));
  if (start === end) return text;

  const stars = mark === 'bold' ? '**' : '*';
  const chosen = text.slice(start, end);

  // Already wrapped, exactly: take the marks off.
  const before = text.slice(0, start);
  const after = text.slice(end);
  if (before.endsWith(stars) && after.startsWith(stars)) {
    return before.slice(0, -stars.length) + chosen + after.slice(stars.length);
  }
  if (chosen.startsWith(stars) && chosen.endsWith(stars) && chosen.length > stars.length * 2) {
    return before + chosen.slice(stars.length, -stars.length) + after;
  }

  /*
   * The marks have to sit against the words. `runs` refuses `* a *` on
   * purpose — that is how `2 * 3` stays arithmetic — so a selection that
   * caught the spaces either side would produce stars that do nothing and
   * look like a bug in the button.
   */
  const lead = /^\s*/.exec(chosen)![0];
  const tail = /\s*$/.exec(chosen)![0];
  const core = chosen.slice(lead.length, chosen.length - tail.length);
  if (!core) return text;
  return `${before}${lead}${stars}${core}${stars}${tail}${after}`;
}

/** Whether a whole line is already marked, for showing a button as pressed. */
export function marked(text: string, mark: 'bold' | 'italic'): boolean {
  const parts = runs(text);
  return parts.length > 0 && parts.every((r) => (mark === 'bold' ? r.bold : r.italic));
}
