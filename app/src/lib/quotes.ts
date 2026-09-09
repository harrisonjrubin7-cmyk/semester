/**
 * The quotes in your own writing, checked against the reading they came from.
 *
 * `lib/cite.ts` already does this in one direction: when the app generates a
 * course it checks every quote the model wrote against the syllabus, because
 * the app presents those as the document's own words and a paraphrase that
 * looks like a quotation is the failure that matters. The same machinery has
 * never been pointed at the writing the student actually hands in — where the
 * stakes are considerably higher, because a misquotation there is not a bug
 * report, it is an accusation waiting to happen.
 *
 * So: paste the draft, and every quoted passage in it is looked for in the
 * material the app holds — the readings you added to a course, the guides, the
 * glossaries, the case files — or in a file you drop in for the purpose.
 *
 * ## Three verdicts, and the third is the one that had to be got right
 *
 * - **Found.** The words are there, and the row shows the source's own
 *   sentence beside yours.
 * - **Close.** The words are there but not as typed — a comma moved, a curly
 *   quote flattened, a capital changed. Shown as the document writes it, so
 *   the fix is a copy and paste rather than a hunt.
 * - **Not in anything here.** *Not* "wrong". The app holds a fraction of what
 *   a student reads, and a screen that turned "I have never seen this book"
 *   into a red flag would be lying in the most damaging possible direction —
 *   about somebody's academic honesty, in a tool they trust. The wording is
 *   flat, the count says how much material it searched, and nothing is
 *   coloured like an error.
 *
 * ## Ellipses are a quotation, not a mismatch
 *
 * "The state is not… a neutral arbiter" is one quote with a gap in it, and
 * checking it whole would fail every time. Each side of the ellipsis is looked
 * for separately and in order, which is exactly what the ellipsis claims.
 *
 * ## What it will not do
 *
 * It will not score you, guess at plagiarism, or send your draft anywhere.
 * This is string matching against material already on the device, in the same
 * spirit as `screens/Proof.tsx`: the rules are arithmetic on the text and
 * nothing leaves.
 */

import { flatten } from './cite';
import type { Guide } from './types';

/** One passage the app can look in, with the name to show when it hits. */
export interface Source {
  /** "ECON 1020 · Reading 7", "Levitt.pdf". Shown as the place it was found. */
  label: string;
  text: string;
}

export type Verdict = 'found' | 'close' | 'missing';

export interface Quoted {
  /** The quoted words, as typed, without the quotation marks. */
  text: string;
  /** Where it starts in the draft, so a caller can order or highlight them. */
  at: number;
}

export interface Result extends Quoted {
  verdict: Verdict;
  /** Which source it was found in. */
  where?: string;
  /** The source's own words, which is what makes a 'close' verdict fixable. */
  says?: string;
}

/**
 * Below this a "quote" is a word in scare quotes, and a match is a
 * coincidence. `lib/cite.ts` draws the same line at the same place.
 */
export const MIN_LENGTH = 12;

/**
 * Every quoted passage in a draft.
 *
 * Straight and curly double quotes only. Single quotes are not collected and
 * that is deliberate: an apostrophe is a single quote, English is full of
 * them, and a parser that treats "don't" as an unterminated quotation would
 * pull half the paragraph in as a citation. A student quoting inside single
 * marks loses a check they would otherwise have had; a student writing
 * ordinary prose does not get nonsense.
 */
export function pullQuotes(draft: string): Quoted[] {
  const out: Quoted[] = [];
  const pattern = /"([^"]{4,600})"|“([^”]{4,600})”/g;
  for (const m of draft.matchAll(pattern)) {
    const text = (m[1] ?? m[2] ?? '').trim();
    if (flatten(text).length < MIN_LENGTH) continue;
    out.push({ text, at: m.index ?? 0 });
  }
  return out;
}

/**
 * The pieces of a quote, split where the writer marked a gap.
 *
 * An ellipsis — three dots, the single character, or a bracketed one — says
 * "words are missing here", and each side has to be found separately for the
 * quotation to be honest. Pieces too short to mean anything are dropped
 * rather than failed: "the" between two ellipses proves nothing either way.
 */
export function pieces(quote: string): string[] {
  return quote
    .split(/\s*(?:\[\s*\.\.\.\s*\]|\.\.\.|…)\s*/)
    .map((p) => flatten(p))
    .filter((p) => p.length >= MIN_LENGTH);
}

/** Punctuation gone too, for the "same words, typed differently" case. */
export function bare(text: string): string {
  return flatten(text)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The same reduction, keeping a way back to the original text.
 *
 * A 'close' verdict exists to be acted on — "the source's own words are below,
 * copy those" — and the first version of this handed back the *stripped*
 * words, which is the one thing a person must not paste into an essay. So the
 * bared string carries the index each character came from, and the quote shown
 * is cut out of the text as the document actually writes it.
 */
function bareWithMap(text: string): { bare: string; from: number[] } {
  const flat = flatten(text);
  let out = '';
  const from: number[] = [];
  for (let i = 0; i < flat.length; i += 1) {
    const ch = /[a-z0-9]/.test(flat[i]) ? flat[i] : ' ';
    // Runs of punctuation and whitespace collapse to one space, as `bare` does.
    if (ch === ' ' && out.endsWith(' ')) continue;
    out += ch;
    from.push(i);
  }
  const lead = out.length - out.trimStart().length;
  return { bare: out.trim(), from: from.slice(lead) };
}

/**
 * The document's own sentence around a match found only after stripping.
 *
 * `flatten` preserves length — it swaps single characters and collapses runs of
 * whitespace — so an index into the flattened text is close enough to an index
 * into the original for a quotation with a little room either side. The window
 * is widened rather than trusted to be exact.
 */
export function aroundBare(text: string, needle: string): string {
  const { bare: hay, from } = bareWithMap(text);
  const at = hay.indexOf(needle);
  if (at < 0) return '';
  const start = from[at] ?? 0;
  const end = from[Math.min(at + needle.length, from.length - 1)] ?? text.length;
  const cut = text.slice(Math.max(0, start - 90), Math.min(text.length, end + 90)).trim();
  let said = cut;
  if (start > 90) said = `…${said.replace(/^\S*\s/, '')}`;
  if (end + 90 < text.length) said = `${said.replace(/\s\S*$/, '')}…`;
  return said.replace(/\s+/g, ' ');
}

/** Whether the parts appear in this text, in the order they were written. */
function inOrder(hay: string, parts: string[]): boolean {
  let from = 0;
  for (const p of parts) {
    const at = hay.indexOf(p, from);
    if (at < 0) return false;
    from = at + p.length;
  }
  return true;
}

/**
 * The sentence a found quote sits in, so the row can show the source's words.
 *
 * Bounded, because a reading pasted in as one paragraph would otherwise put
 * two thousand characters on a line. Trimmed at a sentence end where there is
 * one nearby and at a word otherwise — never mid-word, which reads as the app
 * having lost the text.
 */
export function around(text: string, needle: string): string {
  const at = flatten(text).indexOf(needle);
  if (at < 0) return '';
  const from = Math.max(0, at - 90);
  const to = Math.min(text.length, at + needle.length + 90);
  let cut = text.slice(from, to).trim();
  if (from > 0) cut = `…${cut.replace(/^\S*\s/, '')}`;
  if (to < text.length) cut = `${cut.replace(/\s\S*$/, '')}…`;
  return cut.replace(/\s+/g, ' ');
}

/**
 * One quote against everything the app can look in.
 *
 * Verbatim first, across every source, before any source is tried loosely: a
 * quote that is exact in the second reading must not be reported as "close"
 * because it was inexact in the first.
 */
export function checkQuote(quote: string, sources: Source[]): Result {
  const parts = pieces(quote);
  const base: Result = { text: quote, at: 0, verdict: 'missing' };
  if (parts.length === 0) return base;

  for (const s of sources) {
    if (inOrder(flatten(s.text), parts)) {
      return { ...base, verdict: 'found', where: s.label, says: around(s.text, parts[0]) };
    }
  }

  // Same words, different typography. Reported as its own verdict rather than
  // as a pass, because the fix — copy what the document actually says — is
  // the point of saying anything at all.
  const loose = quote
    .split(/\s*(?:\[\s*\.\.\.\s*\]|\.\.\.|…)\s*/)
    .map(bare)
    .filter((p) => p.length >= MIN_LENGTH);
  if (loose.length > 0) {
    for (const s of sources) {
      if (inOrder(bare(s.text), loose)) {
        // Never `around(bare(...))`: that returns the source with its
        // punctuation stripped out, which is the one text a person must not
        // paste into an essay.
        return {
          ...base,
          verdict: 'close',
          where: s.label,
          says: around(s.text, parts[0]) || aroundBare(s.text, loose[0]),
        };
      }
    }
  }

  return base;
}

/** Every quote in a draft, checked, in the order they appear. */
export function checkDraft(draft: string, sources: Source[]): Result[] {
  return pullQuotes(draft).map((q) => ({ ...checkQuote(q.text, sources), text: q.text, at: q.at }));
}

/**
 * The line above the list, which has to carry the caveat rather than bury it.
 *
 * "2 of 5 found" on its own reads as a score, and the three unfound ones read
 * as three accusations. So the sentence says what was searched in the same
 * breath as what was found, every time — including when everything matched,
 * because a student who reads "all 5 found" once will read the next screen
 * the same way.
 */
export function report(results: Result[], sources: Source[]): string {
  if (results.length === 0) {
    return 'No quotations found in this draft. Quoted passages in double quotes are what this looks for.';
  }
  const found = results.filter((r) => r.verdict === 'found').length;
  const close = results.filter((r) => r.verdict === 'close').length;
  const missing = results.length - found - close;
  const n = results.length;

  const searched = sources.length === 0
    ? 'There is nothing here to check them against — add the reading to a course, or drop the file in.'
    : `Checked against ${sources.length} ${sources.length === 1 ? 'piece' : 'pieces'} of material on this device.`;

  const parts: string[] = [`${n} ${n === 1 ? 'quotation' : 'quotations'}.`];
  if (found) parts.push(`${found} found word-for-word.`);
  if (close) parts.push(`${close} found with the punctuation changed.`);
  if (missing) {
    parts.push(
      `${missing} not in anything the app holds — which means it has not seen the source, not that the quote is wrong.`,
    );
  }
  return `${parts.join(' ')} ${searched}`;
}

/** The one line under a row: what to do about this verdict, or nothing. */
export function verdictLine(r: Result): string {
  switch (r.verdict) {
    case 'found':
      return `Found in ${r.where}.`;
    case 'close':
      return `In ${r.where}, but not as typed. The source's own words are below — copy those.`;
    default:
      return 'Not in anything the app holds. If the source is not in here, that is all this means.';
  }
}

/**
 * Everything on this device a quote could honestly be checked against.
 *
 * Deliberately narrow, and the exclusions are the design.
 *
 * **Readings you added come first**, because they are the only text here that
 * is verbatim from a source: `CourseUpdate.body` is what was pasted in, kept
 * as prose exactly because it did not split into cards.
 *
 * **The guides are included but labelled as guides.** A card, a glossary
 * entry or a case file is the app's summary of a reading, not the reading —
 * so a quote found there is worth reporting and worth showing with its source
 * named, and the label says which it was.
 *
 * **Your notes are not in here at all.** A quote found in your own notes has
 * been checked against yourself, which is worse than not checking it: it
 * would return "found" for a sentence you wrote down from memory and then
 * quoted as the author's.
 */
export function sourcesFrom(input: {
  updates: { courseId: string; title: string; source: string; body: string }[];
  guides: { courseId: string; code: string; guide: Guide }[];
  /** Which course to look in, or null for all of them. */
  courseId?: string | null;
  codeOf: (courseId: string) => string;
}): Source[] {
  const wanted = (id: string) => !input.courseId || input.courseId === id;
  const out: Source[] = [];

  for (const u of input.updates) {
    if (!wanted(u.courseId) || !u.body.trim()) continue;
    const named = u.source.trim() || u.title.trim() || 'Added reading';
    out.push({ label: `${input.codeOf(u.courseId)} · ${named}`, text: u.body });
  }

  for (const g of input.guides) {
    if (!wanted(g.courseId)) continue;
    const text = [
      ...g.guide.units.flatMap((u) => [u.name, ...u.cards.map((c) => `${c.q} ${c.a}`)]),
      ...g.guide.terms.map((t) => `${t.t} — ${t.d}`),
      ...(g.guide.frames ?? []).map((f) => `${f.t} — ${f.d}`),
      ...(g.guide.cases ?? []).map((c) => [c.title, c.claim, c.test, c.verdict, c.lesson].join(' ')),
    ].join('\n');
    if (text.trim()) out.push({ label: `${g.code} · study guide`, text });
  }

  return out;
}
