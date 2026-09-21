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
 * ## Four verdicts, and the flat one is the one that had to be got right
 *
 * - **Found.** The words are there, and the row shows the source's own
 *   sentence beside yours.
 * - **Close.** The words are there but not as typed — a comma moved, a curly
 *   quote flattened, a capital changed. Shown as the document writes it, so
 *   the fix is a copy and paste rather than a hunt.
 * - **Near.** There is a passage here that is mostly these words in this
 *   order, and it is *not* what you have written. The passage is printed and
 *   the line under it asks you to compare, because that is the only honest
 *   thing to do with an approximate match. See below.
 * - **Not in anything here.** *Not* "wrong". The app holds a fraction of what
 *   a student reads, and a screen that turned "I have never seen this book"
 *   into a red flag would be lying in the most damaging possible direction —
 *   about somebody's academic honesty, in a tool they trust. The wording is
 *   flat, the count says how much material it searched, and nothing is
 *   coloured like an error.
 *
 * ## Why breadth went into a fourth verdict and not into `found`
 *
 * Literal matching answers "not in anything here" for a quotation typed from
 * a different edition, from a translation that renders one word differently,
 * or with a clause the source puts in brackets. That answer is true of the
 * app and useless to the student: the passage is right there on the page they
 * are holding.
 *
 * The obvious fix is to loosen `found` until those pass, and that is the one
 * change this file must never make. A confirmation that means "near enough"
 * confirms nothing, in a screen whose output a person may act on when
 * deciding whether their own citation is honest. So the breadth goes into a
 * verdict of its own, which never reads as a pass, is counted separately in
 * the summary line, and is worded as an instruction to compare.
 *
 * ## What the near match refuses, and where those rules came from
 *
 * Widening a matcher widens its false positives, and a false **found** here
 * is far worse than a false **missing** — it is the app telling somebody
 * their citation is sound when it is not. `lib/quotes.adversarial.test.ts`
 * is a pass written to produce exactly those. Four rules came out of it:
 *
 * - **Numbers are never forgiven.** A date, a percentage or a page changed
 *   inside an otherwise verbatim sentence is the difference that matters,
 *   and word overlap alone sails straight past it. Every digit in the quote
 *   has to be in the passage or the passage is not offered at all.
 * - **The passage is one window, not a collection.** Words are matched in
 *   order inside a span barely longer than the quote, so a sentence
 *   assembled out of fragments that each appear somewhere in a long reading
 *   does not become a quotation from it.
 * - **Ordinary words do not carry a match.** The share that has to line up is
 *   measured twice — over every word, and again over only the words that are
 *   not `the`, `of`, `is` — because two unrelated pages of academic prose
 *   share most of the second kind and none of the first.
 * - **Short quotations get no near verdict.** Under eight words, the
 *   difference between a quotation and a coincidence is not in the text.
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

export type Verdict = 'found' | 'close' | 'near' | 'missing';

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

/** The share of a quote's words that must line up, in order, to be 'near'. */
export const NEAR = 0.8;

/**
 * Below this many words there is no near verdict.
 *
 * Not a guess about typical quotations: it is where a run of words stops
 * being evidence. "the way in which the state" is six words that turn up in
 * any two books on the same subject, and offering a passage containing them
 * as "close to what you wrote" would be pointing at a coincidence.
 */
export const NEAR_WORDS = 8;

/**
 * How many occurrences of the anchor word are worth trying.
 *
 * A bound on the pathological case — a quote whose rarest distinctive word
 * still appears a thousand times in a book-length reading — and nothing
 * more. Ordinary quotations anchor on a word with a handful of occurrences
 * and never come near it.
 */
const CANDIDATES = 200;

/**
 * Words that carry no evidence on their own.
 *
 * Deliberately short. This is not a stop list for search; it is the set that
 * two unrelated pages of academic prose have in common, and a longer one
 * starts discarding the words a quotation is actually made of.
 */
const COMMON = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'but', 'by', 'for', 'from', 'had', 'has',
  'have', 'he', 'her', 'his', 'in', 'is', 'it', 'its', 'not', 'of', 'on', 'or', 'that', 'the',
  'their', 'them', 'there', 'they', 'this', 'to', 'was', 'were', 'which', 'with', 'would',
]);

/**
 * The words of a text, each with where it starts in the text itself.
 *
 * Not `bare`, which returns a string: a near match has to be able to print
 * the passage as the document writes it, punctuation and capitals and all.
 * The offsets are taken from the original rather than from anything
 * `flatten` returns, because `flatten` collapses runs of whitespace and a
 * PDF is nothing but runs of whitespace.
 */
function words(text: string): { w: string; at: number }[] {
  const out: { w: string; at: number }[] = [];
  for (const m of text.matchAll(/[\p{L}\p{N}]+/gu)) {
    out.push({ w: m[0].toLowerCase(), at: m.index ?? 0 });
  }
  return out;
}

/** Carries evidence: not a word everybody uses, and long enough to mean one. */
function telling(w: string): boolean {
  return !COMMON.has(w) && (w.length >= 4 || /\d/.test(w));
}

/**
 * Which of the quote's words appear in the passage, in order.
 *
 * A longest common subsequence, which is the right shape for this in both
 * directions. It forgives a word the source has and the quote does not — an
 * edition's inserted clause, the gap an ellipsis declares — and it refuses a
 * reordering, which is most of what separates a quotation from a bag of the
 * same words.
 */
function aligned(quote: string[], span: string[]): { q: number; w: number }[] {
  const n = quote.length;
  const m = span.length;
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] = quote[i] === span[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: { q: number; w: number }[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (quote[i] === span[j]) {
      out.push({ q: i, w: j });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i += 1;
    else j += 1;
  }
  return out;
}

/** A passage that is close to a quote, and where it sits in its source. */
export interface Near {
  /** The share of the quote's words that line up, in order. */
  score: number;
  /** Where the passage starts and ends in the source's own text. */
  from: number;
  to: number;
}

/** A source's words and where each one occurs, built once per source. */
interface Index {
  src: { w: string; at: number }[];
  where: Map<string, number[]>;
}

function index(text: string): Index {
  const src = words(text);
  const where = new Map<string, number[]>();
  for (let i = 0; i < src.length; i += 1) {
    const list = where.get(src[i].w);
    if (list) list.push(i);
    else where.set(src[i].w, [i]);
  }
  return { src, where };
}

/* A `nearest(text, quote)` stood here, wrapping `closest(index(text), …)`,
 * and nothing imported it: `screens/Proof.tsx` enters through `checkDraft`.
 * The window heuristic its docstring argued for is not gone — it is what
 * `closest` below still does, on the path that is taken. */

function closest(held: Index, quote: string): Near | null {
  const q = words(quote).map((t) => t.w);
  if (q.length < NEAR_WORDS) return null;
  const want = q.filter(telling);
  if (want.length === 0) return null;
  const numbers = q.filter((w) => /\d/.test(w));

  const { src, where } = held;

  const distinct = new Set(want);
  let anchor: { w: string; spots: number[] } | null = null;
  for (const w of distinct) {
    const spots = where.get(w);
    if (!spots) continue;
    if (!anchor || spots.length < anchor.spots.length) anchor = { w, spots };
  }
  if (!anchor) return null;

  const slack = Math.max(4, Math.round(q.length * 0.25));
  const wide = q.length + slack * 2;
  const lead = q.indexOf(anchor.w);
  let best: Near | null = null;

  for (const spot of anchor.spots.slice(0, CANDIDATES)) {
    const head = Math.max(0, spot - lead - slack);
    const span = src.slice(head, head + wide);
    if (span.length < q.length * NEAR) continue;
    const have = new Set(span.map((t) => t.w));

    // Numbers are absolute, and this is the whole of that rule: a changed
    // date or figure inside an otherwise verbatim sentence is the difference
    // the screen exists to surface, and word overlap alone sails past it.
    if (numbers.some((n) => !have.has(n))) continue;

    // Everything else here is a speed filter and nothing more — a window
    // missing half the quote's distinctive words is not worth aligning, and
    // a long reading would otherwise be aligned a hundred times to answer
    // no. Loose on purpose: the decisions are the two below, which are
    // order-aware, and a filter set tight enough to make them unreachable
    // would be a guard nothing tests.
    let met = 0;
    for (const w of distinct) if (have.has(w)) met += 1;
    if (met * 2 < distinct.size) continue;

    const pairs = aligned(q, span.map((t) => t.w));
    if (pairs.length < q.length * NEAR) continue;

    // Measured again over only the words that mean something. Two unrelated
    // pages of the same discipline line up on `the of is that in` alone
    // often enough to clear the first bar.
    const said = pairs.filter((pair) => telling(q[pair.q])).length;
    if (said < want.length * NEAR) continue;

    const score = pairs.length / q.length;
    if (best && score <= best.score) continue;
    const first = span[pairs[0].w];
    const last = span[pairs[pairs.length - 1].w];
    best = { score, from: first.at, to: last.at + last.w.length };
  }
  return best;
}

/** The passage itself, as the document writes it, marked where it was cut. */
export function passage(text: string, near: Near): string {
  const cut = text.slice(near.from, near.to).trim().replace(/\s+/g, ' ');
  return `${near.from > 0 ? '…' : ''}${cut}${near.to < text.length ? '…' : ''}`;
}

/** A value worked out on first use and kept, because a draft has many quotes. */
function once<T>(make: () => T): () => T {
  let got: T | null = null;
  return () => {
    if (got === null) got = make();
    return got;
  };
}

/**
 * A source reduced to the forms the three passes need, at most once each.
 *
 * A draft has several quotations in it, and every one of them used to send
 * every source through `flatten` and `bare` again — which was affordable
 * while both were a pair of replaces over a reading, and stopped being
 * affordable when a third pass arrived that has to tokenise the text and
 * index it. Measured on six quotations against six copies of a
 * 120,000-word reading: 1,877ms before this, which is a visible stall in a
 * box somebody is typing into, because `screens/Proof.tsx` re-checks the
 * whole draft on every keystroke.
 *
 * Lazily, because the common case never reaches the third pass: a quotation
 * that is verbatim in the first reading costs one `flatten` and nothing
 * else.
 */
interface Ready {
  label: string;
  text: string;
  flat: () => string;
  stripped: () => string;
  held: () => Index;
}

function ready(s: Source): Ready {
  return {
    label: s.label,
    text: s.text,
    flat: once(() => flatten(s.text)),
    stripped: once(() => bare(s.text)),
    held: once(() => index(s.text)),
  };
}

/**
 * One quote against everything the app can look in.
 *
 * Verbatim first, across every source, before any source is tried loosely: a
 * quote that is exact in the second reading must not be reported as "close"
 * because it was inexact in the first. Approximate matching runs last and
 * only when both have failed, so no quotation that is actually in the
 * material is ever answered with "compare these yourself".
 */
export function checkQuote(quote: string, sources: Source[]): Result {
  return checkOne(quote, sources.map(ready));
}

function checkOne(quote: string, sources: Ready[]): Result {
  const parts = pieces(quote);
  const base: Result = { text: quote, at: 0, verdict: 'missing' };
  if (parts.length === 0) return base;

  for (const s of sources) {
    if (inOrder(s.flat(), parts)) {
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
      if (inOrder(s.stripped(), loose)) {
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

  // Nothing matches as written. The closest passage in any source is worth
  // printing — as something to compare against, never as a confirmation —
  // and the best one across all of them, because "the closest passage here"
  // is a claim about the material, not about the order it was searched in.
  let near: { at: Near; s: Ready } | null = null;
  for (const s of sources) {
    const at = closest(s.held(), quote);
    if (at && (!near || at.score > near.at.score)) near = { at, s };
  }
  if (near) {
    return { ...base, verdict: 'near', where: near.s.label, says: passage(near.s.text, near.at) };
  }

  return base;
}

/**
 * Every quote in a draft, checked, in the order they appear.
 *
 * The sources are reduced once here and shared across every quotation, which
 * is the difference between a check that keeps up with typing and one that
 * does not. See `Ready` for the measurement.
 */
export function checkDraft(draft: string, sources: Source[]): Result[] {
  const held = sources.map(ready);
  return pullQuotes(draft).map((q) => ({ ...checkOne(q.text, held), text: q.text, at: q.at }));
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
  const near = results.filter((r) => r.verdict === 'near').length;
  const missing = results.length - found - close - near;
  const n = results.length;

  const searched = sources.length === 0
    ? 'There is nothing here to check them against — add the reading to a course, or drop the file in.'
    : `Checked against ${sources.length} ${sources.length === 1 ? 'piece' : 'pieces'} of material on this device.`;

  const parts: string[] = [`${n} ${n === 1 ? 'quotation' : 'quotations'}.`];
  if (found) parts.push(`${found} found word-for-word.`);
  if (close) parts.push(`${close} found with the punctuation changed.`);
  if (near) {
    // Never folded into the found count, and worded so it cannot be read as
    // one. The app has a passage to show; it is not saying the two agree.
    parts.push(
      `${near} not as written, with a close passage shown below to compare against — the app is not saying they match.`,
    );
  }
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
    case 'near':
      // Deliberately not "found in", in any arrangement of the words. An
      // approximate match is a passage to read, and the sentence has to say
      // so plainly enough that a tired person at 2am cannot take it for a
      // pass on their citation.
      return `Not found as typed. The nearest passage in ${r.where} is below — compare it word for word, because it is not what you have written.`;
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
