import type { Guide, StudyCard, Term, Unit } from './types';

/**
 * A guide from somewhere the app does not control, made safe to render.
 *
 * Two things hand the app a guide it did not build: a course file another
 * person shared (`lib/handoff.ts`) and a model's reply to a syllabus
 * (`lib/generate.ts`). Both were letting one through unexamined, and both
 * failed the same way — a raw TypeError from a screen, which is a white page
 * with no explanation, in front of somebody who did nothing but open a file
 * or press Add.
 *
 * One function rather than a guard in each, because the two were already
 * drifting: `handoff` checked only that a guide was truthy, `generate`
 * checked `units.length` — which catches an object and not a string, since a
 * string has a length too. Neither looked inside a unit at all.
 *
 */

/**
 * The evidence, from both callers.
 *
 * From a shared file, every one of these was accepted with no trouble
 * reported and then threw on the study screens:
 *
 *     { }                     allCards: reading 'forEach' of undefined
 *     { units: 'lots' }       guide.units.forEach is not a function
 *     { units: null }         reading 'forEach' of null
 *     true                    reading 'forEach' of undefined
 *     'hello'                 reading 'forEach' of undefined
 *
 * `lib/handoff.ts` is written against exactly that situation — its own
 * comments say a pack could have been hand-edited, truncated by a chat
 * client, or written by another version — and `tidyCourse` there records what
 * it costs: "a pack without `grading` reached the course screen, which maps
 * over it, and the page went white." Truncation produces the first shape in
 * the list.
 *
 * From a model's reply, the same two, as raw TypeErrors where that file
 * writes a careful sentence for everything else:
 *
 *     { units: 'three units' }              raw.guide.units.map is not a function
 *     { units: [{ cards: 'lots' }] }        (u.cards ?? []).filter is not a function
 *
 * and two more that were accepted and stored to throw later: `terms` as a
 * string, which the glossary maps over, and `frames` as a string, which three
 * screens test with `frames && frames.length` — 11, for a string of that
 * length — before mapping it.
 *
 * ## What it does not do
 *
 * Nothing is dropped and counted the way an item is. An item is one deadline
 * and losing it silently matters; a malformed unit is a shape, and the honest
 * repair is the empty guide the app already has a name for — a course that
 * reads as having nothing to study yet, which every study screen draws
 * properly. A caller that wants to say more, like the import preview, counts
 * what it kept against what it was given.
 */
export function tidyGuide(raw: unknown): Guide {
  const g = (raw && typeof raw === 'object' ? raw : {}) as Partial<Guide>;
  const text = (v: unknown) => (typeof v === 'string' ? v : '');
  const score = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
  };

  const units: Unit[] = Array.isArray(g.units)
    ? g.units.map((u) => ({
        name: text((u as Partial<Unit>)?.name),
        mastery: score((u as Partial<Unit>)?.mastery),
        cards: cards((u as Partial<Unit>)?.cards),
      }))
    : [];

  const out: Guide = {
    code: text(g.code),
    name: text(g.name),
    blurb: text(g.blurb),
    source: text(g.source),
    mastery: score(g.mastery),
    audio: g.audio === true,
    units,
    terms: Array.isArray(g.terms)
      ? g.terms.map((t) => ({ t: text((t as Partial<Term>)?.t), d: text((t as Partial<Term>)?.d) }))
      : [],
  };

  // Left off entirely when there are none, rather than set to an empty array:
  // three screens test `guide.frames && guide.frames.length`, and an empty
  // array that reads as present is how an empty section heading is drawn.
  // Same argument as `mergeGuide` in `lib/live.ts`.
  if (Array.isArray(g.frames) && g.frames.length) out.frames = g.frames;
  const test = cards(g.selfTest);
  if (test.length) out.selfTest = test;
  if (Array.isArray(g.cases) && g.cases.length) out.cases = g.cases;
  return out;
}

/**
 * A unit's cards, with both sides guaranteed to be strings, and both present.
 *
 * Both, because a card is shown from either end: the drill asks the question
 * and the cram sheet reads the answer, so one without the other is a blank
 * side wherever it is turned. It is also the rule `lib/generate.ts` already
 * held its own cards to — `c?.q && c?.a` — and two of its tests pin it, which
 * is the better argument of the two for it being the right one.
 */
function cards(raw: unknown): StudyCard[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c) => ({
      q: typeof (c as Partial<StudyCard>)?.q === 'string' ? (c as StudyCard).q : '',
      a: typeof (c as Partial<StudyCard>)?.a === 'string' ? (c as StudyCard).a : '',
    }))
    .filter((c) => c.q !== '' && c.a !== '');
}
