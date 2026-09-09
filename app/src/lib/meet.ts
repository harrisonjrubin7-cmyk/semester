/**
 * The same idea, sitting in two different courses.
 *
 * Every study surface in this app is scoped to one course. A guide is one
 * course, a drill is one course's cards, the exam radar ranks one course's
 * units against another's — and the one place the material is genuinely mixed,
 * `lib/interleave.ts`, mixes it precisely because the cards are *unrelated*.
 * Nothing has ever said the opposite and more useful thing: that PSCI 2100 and
 * BUS 1600 both define **margin of error**, that ECON 1020's elasticity is the
 * same elasticity BUS prices with, and that the four courses are not four
 * sealed boxes.
 *
 * That matters twice. It is the cheapest revision there is — a term you have
 * already learned once, met again in a second context, is the transfer an exam
 * actually tests. And it is the commonest way to get a question wrong: two
 * courses using one word for two things, and nobody having said so out loud.
 *
 * ## It is matching words, not ideas, and the screen says so
 *
 * There is no model here and no embedding. This is string work on the
 * glossaries and the cards, which means it finds real overlaps and it also
 * finds coincidences — CORE's *bias* in a hunting study and PSCI's *selection
 * bias* are one word and two ideas. So the app never asserts the two are the
 * same. Where both courses define the term it shows **both definitions**, next
 * to each other, and leaves the reader to decide which of the two they are
 * looking at. That is not a hedge; a pair of definitions that turn out to
 * disagree is the single most valuable thing on the screen.
 *
 * ## Four grades of evidence, kept apart
 *
 * - **Both courses define it.** Two glossary entries. The strongest, and the
 *   only kind that can show two definitions to read against each other.
 * - **One inside the other.** "Price elasticity" and "Elasticity (midpoint)":
 *   one term's whole phrase sits inside the other's.
 * - **One defines it, the other uses it.** ECON has a glossary entry; the word
 *   turns up in a BUS card. Weaker, and labelled as weaker.
 * - **A word in common.** PSCI's *random sampling* and BUS's *sampling plan*
 *   are two glossary entries that share one distinctive word. The weakest, and
 *   the row says which word did it so a coincidence is obvious on sight.
 *
 * ## What it refuses to find
 *
 * A shared word has to earn it. Generic academic furniture — *data*, *model*,
 * *value*, *effect*, *result* — joins every course to every other course and
 * says nothing, so `GENERIC` drops it. A single word has to be six characters
 * or an acronym, because three-letter overlaps are noise. And a course never
 * meets itself: two units of one guide sharing a word is not a meeting, it is
 * a syllabus.
 */

import { flatten } from './cite';
import type { CourseId, Guide, Term } from './types';

/** One course's side of a meeting. */
export interface Sighted {
  courseId: CourseId;
  code: string;
  /** Whether the course has a glossary entry for it, or merely uses the word. */
  kind: 'defines' | 'uses';
  /** The course's own definition, when it has one. */
  term?: Term;
  /** The unit it turns up in, for the link into the guide. Null for glossary-only. */
  unit: number | null;
  /** That unit's name, so the row can say where without opening it. */
  where: string;
  /** The course's own sentence at the point the word was found. */
  quote?: string;
}

/**
 * Why these two are on the same row, in the order of how much it is worth.
 *
 * Carried rather than inferred at render time, because the sentence the screen
 * writes under a meeting is different for each — "both define it" and "ECON
 * defines it, BUS uses the word" are different claims and only one of them is
 * strong.
 */
export type Why =
  | 'both-define'
  | 'one-inside-the-other'
  | 'defined-and-used'
  | 'a-word-in-common';

export interface Meeting {
  /** Stable across renders: the normalised phrase. */
  key: string;
  /** How to write it, taken from the side that spells it most fully. */
  label: string;
  why: Why;
  /** The one word two glossary entries share, when that is all they share. */
  word?: string;
  sides: Sighted[];
}

/** A guide with its course attached, which is all this file needs of a module. */
export interface Sided {
  courseId: CourseId;
  code: string;
  guide: Guide;
}

/**
 * Words that join every course to every other one.
 *
 * Not a stoplist of English — `flatten` plus a length floor handles "the" and
 * "with". These are the words that pass every other test and still mean
 * nothing: the furniture of an academic glossary. Without them ECON meets PSCI
 * on *data*, BUS meets CORE on *effect*, and the screen becomes a list of
 * every course paired with every course, which is the same as saying nothing.
 */
export const GENERIC = new Set([
  'analysis',
  'approach',
  'average',
  'baseline',
  'change',
  'concept',
  'condition',
  'course',
  'data',
  'definition',
  'design',
  'difference',
  'effect',
  'error',
  'estimate',
  'evidence',
  'example',
  'factor',
  'function',
  'group',
  'level',
  'measure',
  'method',
  'model',
  'number',
  'outcome',
  'point',
  'population',
  'principle',
  'problem',
  'process',
  'question',
  'rate',
  'ratio',
  'reason',
  'relationship',
  'result',
  'sample',
  'score',
  'section',
  'stage',
  'standard',
  'statistic',
  'strategy',
  'structure',
  'study',
  'system',
  'theory',
  'total',
  'type',
  'unit',
  'value',
  'variable',
]);

/**
 * The phrase, with everything that is punctuation rather than meaning removed.
 *
 * Parentheticals go because a glossary uses them for the notation rather than
 * the name — "Confounding variable (Z)" and "Regression coefficient (b)" are
 * about the word in front of the bracket. Trailing punctuation goes for the
 * same reason.
 */
export function normalise(text: string): string {
  return flatten(text)
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9/&' -]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[ '-]+|[ '-]+$/g, '')
    .trim();
}

/**
 * The forms a glossary entry should be matched under.
 *
 * A syllabus glossary loves a contrast — "Parameter vs. statistic", "Push vs.
 * pull", "Qual / quant / observational" — and each half is a concept in its
 * own right. Matched whole only, "Parameter vs. statistic" would never meet
 * BUS at all. So the whole phrase and each of its halves are all matchable,
 * and the halves are held to the same floor as anything else.
 */
export function forms(text: string): string[] {
  const whole = normalise(text);
  if (!whole) return [];
  const parts = whole
    .split(/\s+vs\.?\s+|\s*\/\s*|\s*&\s*|\s*,\s*|\s+and\s+/)
    .map((p) => p.trim())
    .filter((p) => p && p !== whole);
  return [whole, ...parts].filter((p, i, all) => all.indexOf(p) === i);
}

/**
 * The words of a phrase that could carry a meeting on their own.
 *
 * Five characters rather than the six a whole one-word term needs, because a
 * word doing this job has a second word beside it for context: "sampling" in
 * *sampling plan* is anchored by the plan in a way a bare "sampling" is not.
 */
export function carrying(phrase: string): string[] {
  return phrase
    .split(/[^a-z0-9]+/)
    .map(singular)
    .filter((w) => w.length >= 5 && !GENERIC.has(w));
}

/** A row's heading is a heading, so a matched fragment is not left lower-cased. */
export function capitalise(phrase: string): string {
  return phrase ? phrase[0].toUpperCase() + phrase.slice(1) : phrase;
}

/** An acronym as the course wrote it — HHI, STP, ROMI — matched case-sensitively. */
function acronym(original: string): string | null {
  const bare = original.replace(/\([^)]*\)/g, '').trim();
  return /^[A-Z]{3,6}$/.test(bare) ? bare : null;
}

/**
 * Whether a phrase is distinctive enough to be worth a row.
 *
 * One word has to be six characters and not furniture; two words only have to
 * avoid being two pieces of furniture. "Margin of error" is generic twice over
 * word by word and is a real shared concept as a phrase, which is exactly why
 * the test is on the phrase and not on its words.
 */
export function distinctive(phrase: string): boolean {
  const words = phrase.split(' ').filter(Boolean);
  if (words.length === 0) return false;
  if (words.length === 1) {
    const w = words[0];
    return w.length >= 6 && !GENERIC.has(w) && !GENERIC.has(singular(w));
  }
  return words.some((w) => w.length >= 4 && !GENERIC.has(w) && !GENERIC.has(singular(w)));
}

/** Plurals, to the depth a glossary needs and no further. */
export function singular(word: string): string {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && word.endsWith('es') && /(s|x|z|ch|sh)es$/.test(word)) {
    return word.slice(0, -2);
  }
  if (word.length > 4 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

/** Whether `phrase` appears in `text` as whole words rather than inside one. */
export function saysIt(text: string, phrase: string): boolean {
  const at = text.indexOf(phrase);
  if (at < 0) return false;
  const before = at === 0 ? ' ' : text[at - 1];
  const after = at + phrase.length >= text.length ? ' ' : text[at + phrase.length];
  return !/[a-z0-9]/i.test(before) && !/[a-z0-9]/i.test(after);
}

interface Entry {
  side: Sided;
  term: Term;
  /** Which unit, if the glossary word is also a unit's own subject. */
  unit: number | null;
  where: string;
  forms: string[];
  acronym: string | null;
}

interface Passage {
  /** The unit to open, or null for the parts of a guide that are not in one. */
  unit: number | null;
  name: string;
  /** Normalised, for matching. */
  text: string;
  /** As written, for quoting back. */
  raw: string;
}

/**
 * A guide as searchable passages: one per unit, then what sits outside them.
 *
 * The glossary, the frames and the case files are guide-level and were the
 * first thing missed by searching units alone — a word a course only ever uses
 * in a definition is still a word that course uses. They carry a null unit
 * because there is no unit to open, and the row says "Glossary" instead of
 * pretending to a destination.
 */
function passages(guide: Guide): Passage[] {
  const out: Passage[] = guide.units.map((u, i) => {
    const raw = [u.name, ...u.cards.flatMap((c) => [c.q, c.a])].join(' · ');
    return { unit: i, name: u.name, text: normalise(raw), raw };
  });
  const glossary = guide.terms.map((t) => `${t.t} — ${t.d}`).join(' · ');
  if (glossary) out.push({ unit: null, name: 'Glossary', text: normalise(glossary), raw: glossary });
  const frames = (guide.frames ?? []).map((f) => `${f.t} — ${f.d}`).join(' · ');
  if (frames) out.push({ unit: null, name: 'Frames', text: normalise(frames), raw: frames });
  const cases = (guide.cases ?? [])
    .map((c) => [c.title, c.claim, c.test, c.verdict, c.lesson].join(' '))
    .join(' · ');
  if (cases) out.push({ unit: null, name: 'Case files', text: normalise(cases), raw: cases });
  return out;
}

/** The sentence a word was found in, so a row can quote rather than assert. */
function quoteAround(raw: string, phrase: string): string | undefined {
  for (const part of raw.split(' · ')) {
    if (saysIt(normalise(part), phrase)) return part.length > 220 ? `${part.slice(0, 217)}…` : part;
  }
  return undefined;
}

function entriesOf(side: Sided, units: Passage[]): Entry[] {
  return side.guide.terms.map((term) => {
    const shapes = forms(term.t).filter(distinctive);
    const home = units.find(
      (u) => u.unit !== null && shapes.some((s) => saysIt(normalise(u.name), s)),
    );
    return {
      side,
      term,
      unit: home?.unit ?? null,
      where: home?.name ?? 'Glossary',
      forms: shapes,
      acronym: acronym(term.t),
    };
  });
}

/** Rank: the strongest evidence first, then the widest, then alphabetically. */
const RANK: Record<Why, number> = {
  'both-define': 0,
  'one-inside-the-other': 1,
  'defined-and-used': 2,
  'a-word-in-common': 3,
};

/**
 * Every place two of these courses meet, strongest evidence first.
 *
 * One row per concept rather than one per pair: a word all four courses use is
 * one meeting with four sides, not six rows saying the same thing. Where a
 * concept qualifies under more than one rule the strongest wins, so a pair
 * that both define a term is never also listed as one merely using it.
 */
export function meetings(sides: Sided[]): Meeting[] {
  if (sides.length < 2) return [];

  const units = new Map(sides.map((s) => [s.courseId, passages(s.guide)]));
  const entries = sides.flatMap((s) => entriesOf(s, units.get(s.courseId) ?? []));

  /** key → the meeting being built, so a third course joins a row rather than starting one. */
  const found = new Map<
    string,
    { label: string; why: Why; word?: string; sides: Map<CourseId, Sighted> }
  >();

  const put = (key: string, label: string, why: Why, sighted: Sighted, word?: string) => {
    const had = found.get(key);
    if (!had) {
      found.set(key, { label, why, word, sides: new Map([[sighted.courseId, sighted]]) });
      return;
    }
    // The strongest reason and the fullest spelling win, whichever arrived first.
    if (RANK[why] < RANK[had.why]) {
      had.why = why;
      had.word = word;
    }
    if (label.length > had.label.length) had.label = label;
    const before = had.sides.get(sighted.courseId);
    if (!before || (before.kind === 'uses' && sighted.kind === 'defines')) {
      had.sides.set(sighted.courseId, sighted);
    }
  };

  const asSide = (e: Entry): Sighted => ({
    courseId: e.side.courseId,
    code: e.side.code,
    kind: 'defines',
    term: e.term,
    unit: e.unit,
    where: e.where,
  });

  // ── Two glossaries ────────────────────────────────────────────────────
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const a = entries[i];
      const b = entries[j];
      if (a.side.courseId === b.side.courseId) continue;

      let met = false;
      for (const fa of a.forms) {
        for (const fb of b.forms) {
          const same = fa === fb;
          const inside = !same && (saysIt(fa, fb) || saysIt(fb, fa));
          if (!same && !inside) continue;
          const key = same ? fa : fa.length <= fb.length ? fa : fb;
          if (!distinctive(key)) continue;
          const why: Why = same ? 'both-define' : 'one-inside-the-other';
          const label = a.term.t.length >= b.term.t.length ? a.term.t : b.term.t;
          put(key, label, why, asSide(a));
          put(key, label, why, asSide(b));
          met = true;
        }
      }

      /*
       * The last resort: one distinctive word held in common.
       *
       * Only reached when no phrase matched, because a pair that already has a
       * phrase in common does not need a weaker reason for being on the same
       * row — and would otherwise appear twice, once well and once badly.
       */
      if (met) continue;
      const shared = carrying(a.forms[0] ?? '').find((w) =>
        carrying(b.forms[0] ?? '').includes(w),
      );
      if (!shared) continue;
      // The heading is the shared word, not either course's phrase: the two
      // phrases are different and picking one of them to head the row would be
      // the app choosing a side in a comparison it is supposed to be showing.
      const heading = capitalise(shared);
      put(shared, heading, 'a-word-in-common', asSide(a), shared);
      put(shared, heading, 'a-word-in-common', asSide(b), shared);
    }
  }

  // ── A glossary and somebody else's cards ──────────────────────────────
  for (const e of entries) {
    for (const other of sides) {
      if (other.courseId === e.side.courseId) continue;
      const defined = entries.some(
        (o) => o.side.courseId === other.courseId && o.forms.some((f) => e.forms.includes(f)),
      );
      // Already a glossary-to-glossary meeting; that row is the better one.
      if (defined) continue;

      /*
       * An acronym is matched as the course wrote it, in capitals.
       *
       * Lower-cased, "HHI" and "STP" are three letters that turn up inside
       * ordinary words and inside each other's noise. Capitals are the whole
       * signal, so this one match is case-sensitive while everything else in
       * the file is not.
       */
      const shapes = e.acronym ? [...e.forms, e.acronym] : e.forms;
      for (const shape of shapes) {
        const capitals = shape === e.acronym;
        const hit = (units.get(other.courseId) ?? []).find((u) =>
          capitals ? saysIt(u.raw, shape) : saysIt(u.text, shape),
        );
        if (!hit) continue;
        // Keyed and headed by what actually matched: a row that matched on
        // "observational" must not head itself "Qual / quant / observational",
        // which claims two words the other course never used.
        const key = capitals ? shape.toLowerCase() : shape;
        const label = shape === normalise(e.term.t) || capitals ? e.term.t : capitalise(shape);
        put(key, label, 'defined-and-used', asSide(e));
        put(key, label, 'defined-and-used', {
          courseId: other.courseId,
          code: other.code,
          kind: 'uses',
          unit: hit.unit,
          where: hit.name,
          quote: quoteAround(hit.raw, shape),
        });
        break;
      }
    }
  }

  const out: Meeting[] = [];
  for (const [key, m] of found) {
    if (m.sides.size < 2) continue;
    const rows = [...m.sides.values()].sort((x, y) => x.code.localeCompare(y.code));
    out.push({ key, label: m.label, why: m.why, word: m.word, sides: rows });
  }

  return out.sort(
    (a, b) =>
      RANK[a.why] - RANK[b.why] ||
      b.sides.length - a.sides.length ||
      a.label.localeCompare(b.label),
  );
}

/** How many meetings each pair of courses has, for the summary above the list. */
export interface Pairing {
  a: string;
  b: string;
  count: number;
}

export function pairings(found: Meeting[]): Pairing[] {
  const counts = new Map<string, Pairing>();
  for (const m of found) {
    for (let i = 0; i < m.sides.length; i += 1) {
      for (let j = i + 1; j < m.sides.length; j += 1) {
        const [a, b] = [m.sides[i].code, m.sides[j].code].sort();
        const key = `${a}|${b}`;
        const had = counts.get(key);
        if (had) had.count += 1;
        else counts.set(key, { a, b, count: 1 });
      }
    }
  }
  return [...counts.values()].sort((x, y) => y.count - x.count || x.a.localeCompare(y.a));
}

const list = (codes: string[]): string =>
  codes.length < 2 ? (codes[0] ?? '') : `${codes.slice(0, -1).join(', ')} and ${codes[codes.length - 1]}`;

/**
 * The line under a meeting, which is a claim about evidence and never about
 * meaning.
 *
 * Written from the sides rather than from `why` alone, because a row can hold
 * both kinds at once — BUS and ECON each defining elasticity while PSCI merely
 * uses the word — and a single sentence chosen by the strongest rule would
 * either drop the third course or demote the first two. "These are the same
 * thing" is the one sentence this function will not write.
 */
export function whyLine(m: Meeting): string {
  const defines = m.sides.filter((s) => s.kind === 'defines').map((s) => s.code);
  const uses = m.sides.filter((s) => s.kind === 'uses').map((s) => s.code);

  const parts: string[] = [];
  if (defines.length >= 2 && m.why === 'a-word-in-common') {
    parts.push(`${list(defines)} share the word “${m.word ?? m.label}” and nothing else.`);
  } else if (defines.length >= 2 && m.why === 'one-inside-the-other') {
    parts.push(`${list(defines)} define phrases with one inside the other.`);
  } else if (defines.length >= 2) {
    parts.push(`${list(defines)} each define it.`);
  } else if (defines.length === 1) {
    parts.push(`${defines[0]} defines it.`);
  }
  if (uses.length) {
    parts.push(`${list(uses)} use${uses.length === 1 ? 's' : ''} the word without defining it.`);
  }
  if (defines.length >= 2) parts.push('Read both — they may not mean the same thing.');
  return parts.join(' ');
}

/**
 * One course's own glossary, annotated with where else each term turns up.
 *
 * The screen is the place to compare two courses; this is the other half, and
 * the half that arrives without being asked for. A student reading ECON's
 * glossary in the cram sheet is not going to open a comparison screen on the
 * off-chance — but told, on the line they are already reading, that BUS
 * defines this word too, they can decide in a second whether that is worth
 * knowing.
 *
 * Keyed by the term exactly as that course wrote it, so a caller rendering its
 * own glossary can look a row up without normalising anything.
 */
export function elsewhere(found: Meeting[], courseId: CourseId): Map<string, Also[]> {
  const out = new Map<string, Also[]>();
  for (const m of found) {
    const mine = m.sides.find((s) => s.courseId === courseId);
    // Only a term this course actually defines has a glossary row to annotate.
    if (!mine?.term) continue;
    const others = m.sides
      .filter((s) => s.courseId !== courseId)
      .map((s) => ({ code: s.code, kind: s.kind, why: m.why }));
    if (others.length === 0) continue;
    const had = out.get(mine.term.t) ?? [];
    for (const o of others) {
      if (!had.some((h) => h.code === o.code)) had.push(o);
    }
    out.set(mine.term.t, had);
  }
  return out;
}

/** One other course's claim on a term, with how strong that claim is. */
export interface Also {
  code: string;
  kind: Sighted['kind'];
  why: Why;
}

/**
 * The line beside a glossary row: who else has this word, and how firmly.
 *
 * Three phrasings rather than one, because "BUS 1600 defines this too" is
 * true of *margin of error* and false of *random sampling* — BUS defines a
 * sampling plan, which shares one word with it. A single sentence for both
 * would be the app quietly upgrading its weakest evidence in the one place
 * the reader has no way to check it, which is the opposite of what the
 * comparison screen is for.
 */
export function alsoLine(others: Also[]): string {
  if (others.length === 0) return '';
  const same = others
    .filter((o) => o.kind === 'defines' && o.why === 'both-define')
    .map((o) => o.code);
  const near = others
    .filter((o) => o.kind === 'defines' && o.why !== 'both-define')
    .map((o) => o.code);
  const uses = others.filter((o) => o.kind === 'uses').map((o) => o.code);
  const parts: string[] = [];
  if (same.length) parts.push(`${list(same)} define${same.length === 1 ? 's' : ''} this too`);
  if (near.length) parts.push(`${list(near)} ${near.length === 1 ? 'has' : 'have'} a term close to it`);
  if (uses.length) parts.push(`${list(uses)} use${uses.length === 1 ? 's' : ''} the word`);
  return parts.join(' · ');
}
