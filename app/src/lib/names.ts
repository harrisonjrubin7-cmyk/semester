/**
 * A name for a block of cells.
 *
 * `=SUM(Marks)` instead of `=SUM('Q1 marks'!B2:B9)`. Two things that buys, and
 * the second is the one that matters:
 *
 *   - A formula somebody can **read**. `=B14*Rate` says what it is doing;
 *     `=B14*$F$1` says where it got a number from, which is a different and
 *     much smaller fact, and it is the reason a spreadsheet full of pinned
 *     references is a spreadsheet nobody can check.
 *   - A reference that survives being **moved**. The name follows its block
 *     when rows are inserted above it, so every formula using the name follows
 *     too, and none of them had to be found and edited.
 *
 * ## The names belong to the book, and live on the sheets
 *
 * A name is looked up across every sheet, because the point of one is to be
 * usable from the sheet that is *not* the one holding the numbers. It is
 * stored on the sheet that defined it, so it travels with that sheet through
 * export, backup and sync without a new place for a sheet's things to live.
 *
 * Two sheets defining the same name resolves to nothing rather than to one of
 * them — the same answer, for the same reason, as two sheets sharing a title.
 * See `Book` in `lib/sheet.ts`.
 */

import { MAX_COLS, MAX_ROWS, parseRef, sheetKey, writeQualifier } from './sheet';
import { corners } from './chart';

export interface NamedRange {
  /** As it was typed. Looked up without minding the case. */
  name: string;
  /** The block, qualified with the sheet that holds it — `"Q1 marks!B2:B9"`. */
  ref: string;
  created: number;
}

/** Where a name points, once it has been read. `null` where two sheets claim it. */
export interface Pointed {
  /** The sheet, normalised. Empty when the reference names none. */
  sheet: string;
  from: string;
  to: string;
}

export type Names = Record<string, Pointed | null>;

/**
 * Whether a word may be a name.
 *
 * Three refusals, and each is a way a name would make a formula mean something
 * other than what it says:
 *
 *   - **Anything that reads as a cell.** A name `A1` makes `=A1` ambiguous
 *     between the name and the cell, and the lexer has already decided it is
 *     the cell before anything here is consulted — so the name would simply
 *     never work, silently.
 *   - **Anything with a space or an operator in it.** `Term total` lexes as
 *     two words, and `A-B` as a subtraction.
 *   - **`TRUE` and `FALSE`**, which the engine answers before it looks
 *     anything up.
 *
 * A name may shadow a function: `SUM` as a name is fine, because `SUM(` is a
 * call and bare `SUM` is not, and the parser tells them apart by the bracket.
 */
export function usable(name: string): boolean {
  const text = name.trim();
  if (!/^[A-Za-z_][A-Za-z0-9_.]*$/.test(text)) return false;
  if (parseRef(text)) return false;
  const word = text.toUpperCase();
  return word !== 'TRUE' && word !== 'FALSE';
}

/** Why a name was refused, in the words the screen shows under the field. */
export function whyNot(name: string): string {
  const text = name.trim();
  if (!text) return 'Give it a name.';
  if (parseRef(text)) return `${text} is a cell, so it cannot also be a name.`;
  if (!/^[A-Za-z_][A-Za-z0-9_.]*$/.test(text)) {
    return 'Letters, digits, underscores and dots, starting with a letter.';
  }
  const word = text.toUpperCase();
  if (word === 'TRUE' || word === 'FALSE') return `${text} is already a value.`;
  return '';
}

/**
 * A written reference read into the sheet and the two corners it spans.
 *
 * `null` for anything that is not one, which is what stops a name somebody
 * typed badly from resolving to half a range.
 */
export function pointAt(ref: string, fallbackSheet = ''): Pointed | null {
  const bang = ref.lastIndexOf('!');
  const sheet = bang < 0 ? fallbackSheet : ref.slice(0, bang).replace(/^'|'$/g, '').replace(/''/g, "'");
  const block = bang < 0 ? ref : ref.slice(bang + 1);
  const at = corners(block.replace(/\$/g, ''));
  if (!at) return null;
  if (at.bottom >= MAX_ROWS || at.right >= MAX_COLS) return null;
  const [from, to] = block.replace(/\$/g, '').toUpperCase().split(':');
  return { sheet: sheetKey(sheet), from, to: to ?? from };
}

/**
 * Every name in the book, by the key it is looked up under.
 *
 * Built once per read, beside the book itself. A name whose reference does not
 * parse is left out rather than stored as a broken pointer: the formula using
 * it then says `#NAME?`, which is the thing to go and fix, rather than
 * `#REF!`, which says the cells are gone when they never existed.
 */
export function namesIn(sheets: readonly { title: string; names?: NamedRange[] }[]): Names {
  const out: Names = {};
  for (const sheet of sheets) {
    for (const named of sheet.names ?? []) {
      if (!usable(named.name)) continue;
      const at = pointAt(named.ref, sheet.title);
      if (!at) continue;
      const key = named.name.trim().toLowerCase();
      out[key] = key in out ? null : at;
    }
  }
  return out;
}

/** The names a sheet holds, with anything malformed dropped. See `chartsOf`. */
export function namesOf(sheet: { names?: unknown }): NamedRange[] {
  if (!Array.isArray(sheet.names)) return [];
  const out: NamedRange[] = [];
  for (const row of sheet.names) {
    if (!row || typeof row !== 'object') continue;
    const n = row as Partial<NamedRange>;
    if (typeof n.name !== 'string' || typeof n.ref !== 'string') continue;
    if (!usable(n.name)) continue;
    if (out.some((had) => had.name.toLowerCase() === n.name!.trim().toLowerCase())) continue;
    out.push({
      name: n.name.trim(),
      ref: n.ref,
      created: typeof n.created === 'number' ? n.created : 0,
    });
  }
  return out;
}

/**
 * A reference written the way a name stores one: qualified, and absolute.
 *
 * Absolute because a name is not copied and so has nothing to move relative
 * *to* — and because that is what the exported workbook wants, where a
 * relative defined name is read against whatever cell happens to be selected.
 */
export function writeRef(sheet: string, from: string, to: string): string {
  const fixed = (a: string) => {
    const at = parseRef(a);
    return at ? `$${a.replace(/\$/g, '').replace(/\d+$/, '')}$${at.row + 1}` : a;
  };
  const block = from === to ? fixed(from) : `${fixed(from)}:${fixed(to)}`;
  return sheet ? `${writeQualifier(sheet)}${block}` : block;
}

/** The cells a name covers, for the panel that lists them. */
export function saysName(named: NamedRange): string {
  return `${named.name} → ${named.ref}`;
}

/**
 * A name's reference with a sheet on the front of it.
 *
 * Names written by the app are qualified already. One edited by hand may not
 * be, and an unqualified reference means "the sheet I was defined on" — which
 * every reader here resolves correctly and no *rewriter* can, because a
 * rewriter is told which sheet changed and has to compare. Qualifying first
 * makes that comparison possible, and is a no-op for the ordinary case.
 */
export function qualified(ref: string, owner: string): string {
  const at = pointAt(ref, owner);
  return at ? writeRef(at.sheet ? sheetOf(ref, owner) : owner, at.from, at.to) : ref;
}

/** The sheet a reference names, in the spelling it was written with. */
function sheetOf(ref: string, owner: string): string {
  const bang = ref.lastIndexOf('!');
  if (bang < 0) return owner;
  return ref.slice(0, bang).replace(/^'|'$/g, '').replace(/''/g, "'");
}
