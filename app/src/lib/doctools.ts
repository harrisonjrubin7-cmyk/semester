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
  if (block.kind === 'checks') return block.items.map((i) => i.text);
  /*
   * A code block is skipped, for the reason a table and an equation are:
   * renaming a variable through a search meant for prose is how a script that
   * ran stops running, and the person doing it is thinking about their
   * writing rather than about their code.
   */
  return [];
}

function pattern(find: string, opts: Options): RegExp | null {
  if (!find) return null;
  const escaped = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  /*
   * Not `\b`, for two reasons it fails at once.
   *
   * `\b` is defined against ASCII `\w`, so "café" ends at the "f" as far as it
   * is concerned and searching for "é" as a whole word matched inside the
   * word. And a term with punctuation at its edge — "C++" — has no word
   * boundary to anchor to, so the guard was dropped on that side and "C++"
   * matched the front of "C++primer".
   *
   * A lookaround for "not a letter, digit or underscore" says what a whole
   * word means directly, and the `u` flag makes the classes Unicode-aware.
   */
  const left = opts.wholeWord ? '(?<![\\p{L}\\p{N}_])' : '';
  const right = opts.wholeWord ? '(?![\\p{L}\\p{N}_])' : '';
  return new RegExp(`${left}${escaped}${right}`, opts.matchCase ? 'gu' : 'giu');
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
    if (block.kind === 'checks') {
      return { ...block, items: block.items.map((i) => ({ ...i, text: swap(i.text) })) };
    }
    return block;
  });

  return { doc: changed ? { ...doc, blocks } : doc, changed };
}

// ── Emphasis, applied ────────────────────────────────────────────────────

/**
 * The marks a button can put on a stretch of text, and what each is written as.
 *
 * Markdown, because the document holds emphasis as markdown — see `runs` in
 * `document.ts` — so this wraps and unwraps markers rather than carrying a
 * second representation of the same fact. A link is not here: its marker has
 * two halves with an address between them, and it has its own function below.
 */
export const MARKS = {
  bold: '**',
  italic: '*',
  strike: '~~',
  code: '`',
} as const;

export type Mark = keyof typeof MARKS;

/**
 * Put a mark on a stretch of a line, or take it off again.
 *
 * Toggling: a selection already entirely inside a mark loses it, anything
 * else gains it, which is what every editor's Ctrl+B does.
 *
 * Four marks rather than two, and the generalisation is why the marker is a
 * parameter — the code below never knew which mark it was applying beyond
 * counting stars, so strike-through and backticks cost a lookup table and
 * nothing else.
 */
export function emphasise(text: string, from: number, to: number, mark: Mark): string {
  const start = Math.max(0, Math.min(from, to));
  const end = Math.min(text.length, Math.max(from, to));
  if (start === end) return text;

  const stars = MARKS[mark];
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

  const wrapped = `${before}${lead}${stars}${core}${stars}${tail}${after}`;
  if (!wrapped.includes(stars + stars)) return wrapped;

  /*
   * The selection sits against a marker, inside a run already marked.
   *
   * "**really**" with only "real" chosen is neither of the two cases above —
   * one side is against a marker and the other is not — and wrapping it
   * produced `****real**ly**`, which is not markdown at all and which `runs`
   * renders as literal stars.
   *
   * Doubling the markers is the tell, and what the person meant by pressing a
   * mark button inside a marked run is to take the mark off. So the enclosing
   * pair comes off: predictable, reversible, and never a line nobody can read.
   */
  const openAt = text.lastIndexOf(stars, Math.max(0, start - stars.length));
  const closeAt = text.indexOf(stars, end);
  if (openAt === -1 || closeAt === -1 || closeAt < openAt) return text;
  return (
    text.slice(0, openAt) + text.slice(openAt + stars.length, closeAt) + text.slice(closeAt + stars.length)
  );
}

/**
 * Turn a stretch of a line into a link, or take the link off again.
 *
 * `[words](where)`, which is what `runs` reads. An empty address unlinks,
 * because the button that adds a link is the button that removes one and a
 * dialog with an empty box is how somebody says "not that after all".
 *
 * Nothing is validated. A half-typed address is a link that goes nowhere,
 * which is visible and fixable; refusing it would mean a student cannot paste
 * `doi:10.1257/aer.20190658` into their own bibliography because this file
 * has opinions about schemes.
 */
export function linked(text: string, from: number, to: number, href: string): string {
  const start = Math.max(0, Math.min(from, to));
  const end = Math.min(text.length, Math.max(from, to));
  if (start === end) return text;

  const before = text.slice(0, start);
  const chosen = text.slice(start, end);
  const after = text.slice(end);

  // Already a link, with the words chosen and the brackets either side of
  // them: the address comes off and the words stay.
  const wrapping = /^\]\(([^)\s]*)\)/.exec(after);
  if (before.endsWith('[') && wrapping) {
    return before.slice(0, -1) + chosen + after.slice(wrapping[0].length);
  }
  const whole = /^\[([^\]\n]+)\]\(([^)\s]*)\)$/.exec(chosen);
  if (whole) return href.trim() ? `${before}[${whole[1]}](${href.trim()})${after}` : before + whole[1] + after;

  if (!href.trim()) return text;
  const lead = /^\s*/.exec(chosen)![0];
  const tail = /\s*$/.exec(chosen)![0];
  const core = chosen.slice(lead.length, chosen.length - tail.length);
  if (!core) return text;
  return `${before}${lead}[${core}](${href.trim()})${tail}${after}`;
}

/** Whether a whole line is already marked, for showing a button as pressed. */
export function marked(text: string, mark: Mark): boolean {
  const parts = runs(text);
  return parts.length > 0 && parts.every((r) => r[mark]);
}

/**
 * The first few lines of a document, for a thumbnail.
 *
 * A shelf of documents drawn as identical grey rectangles tells you nothing
 * you did not already know from the name above it. Google renders the real
 * first page; this renders the first few lines of the real first blocks,
 * which is the same idea at the size a phone can spare.
 *
 * Every kind resolves to a line of text or is skipped. A page break has
 * nothing to show, and a table's rows would be unreadable at this size, so
 * they come back as a word saying what they are — which is more than a blank
 * would say, and honest about what is there.
 */
export function glance(doc: Pick<Doc, 'blocks'>, lines = 6): string[] {
  const out: string[] = [];
  for (const block of doc.blocks) {
    if (out.length >= lines) break;
    switch (block.kind) {
      case 'heading':
      case 'text':
        if (block.text.trim()) out.push(block.text.trim());
        break;
      case 'bullets':
        for (const item of block.items) {
          if (out.length >= lines) break;
          if (item.trim()) out.push(`• ${item.trim()}`);
        }
        break;
      case 'quote':
        if (block.text.trim()) out.push(`“${block.text.trim()}”`);
        break;
      case 'table':
        out.push(`${block.rows.length} × ${block.rows[0]?.length ?? 0} table`);
        break;
      case 'equation':
        if (block.latex.trim()) out.push(block.latex.trim());
        break;
      case 'checks':
        for (const item of block.items) {
          if (out.length >= lines) break;
          if (item.text.trim()) out.push(`${item.done ? '☑' : '☐'} ${item.text.trim()}`);
        }
        break;
      case 'code':
        if (block.text.trim()) out.push(block.text.trim().split('\n')[0]);
        break;
      case 'toc':
        out.push(block.title.trim() || 'Contents');
        break;
      /*
       * What it is captioned, or what it is of. A thumbnail cannot draw the
       * picture — the bytes are in IndexedDB behind an async read and this is
       * a pure function — so it says there is one, which is the thing a blank
       * line fails to say.
       */
      case 'image': {
        const said = block.caption.trim() || block.alt.trim() || block.name.trim();
        out.push(said ? `Picture — ${said}` : 'Picture');
        break;
      }
      case 'break':
        break;
    }
  }
  return out.slice(0, lines);
}
