/**
 * Rebuilding a study guide around what you have added since.
 *
 * Adding a reading already flows through the whole app: `live.ts` merges it at
 * read time, so cards, Read, the quiz pool, the cram sheet and the figures all
 * see it at once. What that merge cannot do is *reorganise*. New material
 * arrives as extra cards on a unit, or as a unit tacked on the end, because a
 * merge has no opinion about where a week-six reading belongs in a structure
 * built in week one.
 *
 * This does have an opinion. It hands the existing guide and everything added
 * to Claude and asks for the guide the course would have had if the new
 * material had been there from the start — units renamed, split, reordered or
 * added; cards written from prose that never parsed into a question; terms
 * folded into one glossary.
 *
 * ## The thing that must not break
 *
 * Your answer history is keyed by the *text of a question* (`cardKey` hashes
 * the course id and the question). So a card whose wording changes is, to the
 * app, a card you have never seen — its streak, its interval and its due date
 * are gone. A rework that freely rewrote every question would silently reset a
 * semester of drilling and show a guide that looked better while knowing less
 * about you.
 *
 * So the model is told to reproduce existing questions verbatim, and this file
 * checks whether it did. `survey` counts what was kept and what was reworded,
 * and the screen shows those numbers before anything is replaced. Keeping a
 * clumsy question you have drilled eleven times beats a better-worded one you
 * have drilled none.
 */

import type { Guide, StudyCard, Term, Unit } from './types';
import type { CourseUpdate } from './types';

export interface Plan {
  guide: Guide;
  /** What the model says it did, one line per change. */
  notes: string[];
}

export interface Survey {
  /** Questions that came through with their wording intact. */
  kept: number;
  /** Questions that were reworded, and so lose their answer history. */
  reworded: number;
  /** Questions that are not in the new guide at all. */
  dropped: number;
  /** Questions that did not exist before. */
  fresh: number;
  unitsBefore: number;
  unitsAfter: number;
  /** The first few reworded questions, so a person can judge rather than trust. */
  examples: { before: string; after: string }[];
}

export const SYSTEM = `You revise a university study guide so that material the student added
later is part of its structure rather than bolted on the end.

You are given the guide as it stands and everything they have added since. Produce the guide the
course would have had if the new material had been there from the start.

What to do:
· Put new content in the unit it belongs to, splitting or renaming a unit where the material has
  genuinely outgrown it. Add a unit only when nothing existing fits.
· Write cards from prose that never became questions. A card is one specific thing worth knowing,
  asked so it can be answered in a sentence.
· Fold new terms into the glossary, keeping one definition per term.
· Keep the guide's blurb accurate to what it now covers.

THE RULE THAT MATTERS MOST — reproduce every existing card question EXACTLY as written, character
for character, unless it is factually wrong. The app keys the student's answer history to the text
of the question, so rewording one silently discards every answer they have given it: the streak,
the interval, the due date. A clumsily worded question they have drilled eleven times is worth more
than a better one they have drilled none. If a question is genuinely wrong, fix it and say so in
your notes.

Never invent a fact, a figure, a date or a citation. Everything in the revised guide must come from
the guide you were given or from the added material.

Reply with JSON only, no prose around it:
{"blurb":"…","units":[{"name":"…","cards":[{"q":"…","a":"…"}]}],
 "terms":[{"t":"…","d":"…"}],"notes":["what you changed, one line each"]}`;

/** Everything the model is shown, in a shape it can work from. */
export function brief(guide: Guide, updates: CourseUpdate[]): string {
  const units = guide.units
    .map(
      (u, i) =>
        `Unit ${i + 1}: ${u.name}\n` +
        u.cards.map((c) => `  Q: ${c.q}\n  A: ${c.a}`).join('\n'),
    )
    .join('\n\n');

  const glossary = guide.terms.map((t) => `${t.t} — ${t.d}`).join('\n');

  const added = updates
    .map((u) => {
      const where = u.unit === null ? 'filed against no unit' : `filed against unit ${u.unit + 1}`;
      const cards = u.cards.length
        ? `\nCards already made from it:\n${u.cards.map((c) => `  Q: ${c.q}\n  A: ${c.a}`).join('\n')}`
        : '';
      const terms = u.terms.length
        ? `\nTerms: ${u.terms.map((t) => `${t.t} — ${t.d}`).join('; ')}`
        : '';
      return `--- ${u.title || 'Added material'} (${u.source || 'no source given'}, ${where})\n${
        u.body.trim() || '(no prose)'
      }${cards}${terms}`;
    })
    .join('\n\n');

  return [
    `Course: ${guide.code} — ${guide.name}`,
    `Blurb: ${guide.blurb}`,
    '',
    'THE GUIDE AS IT STANDS',
    units || '(no units yet)',
    '',
    'GLOSSARY',
    glossary || '(empty)',
    '',
    'ADDED SINCE',
    added || '(nothing)',
  ].join('\n');
}

/**
 * The JSON that came back, as a guide.
 *
 * Strict about shape and forgiving about extras: a missing unit name is a
 * broken guide, an unexpected field is not. Anything that would produce an
 * empty guide throws instead, because replacing a working guide with an empty
 * one is the single worst outcome here.
 */
export function readPlan(reply: string, base: Guide): Plan {
  const start = reply.indexOf('{');
  const end = reply.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Nothing usable came back.');

  let raw: {
    blurb?: unknown;
    units?: unknown;
    terms?: unknown;
    notes?: unknown;
  };
  try {
    raw = JSON.parse(reply.slice(start, end + 1)) as typeof raw;
  } catch {
    throw new Error('What came back was not valid JSON. Try again.');
  }

  const units: Unit[] = [];
  for (const u of Array.isArray(raw.units) ? raw.units : []) {
    const unit = u as { name?: unknown; cards?: unknown };
    const name = typeof unit.name === 'string' ? unit.name.trim() : '';
    if (!name) continue;
    const cards: StudyCard[] = [];
    for (const c of Array.isArray(unit.cards) ? unit.cards : []) {
      const card = c as { q?: unknown; a?: unknown };
      if (typeof card.q !== 'string' || typeof card.a !== 'string') continue;
      const q = card.q.trim();
      const a = card.a.trim();
      if (q && a) cards.push({ q, a });
    }
    // Mastery is measured from your answers, never declared, so a revised unit
    // starts at zero and `applyReviews` fills it in from what you have drilled.
    units.push({ name, mastery: 0, cards });
  }

  if (units.length === 0) throw new Error('That came back with no units. Nothing was changed.');
  if (units.every((u) => u.cards.length === 0)) {
    throw new Error('That came back with no cards. Nothing was changed.');
  }

  const terms: Term[] = [];
  const seen = new Set<string>();
  for (const t of Array.isArray(raw.terms) ? raw.terms : []) {
    const term = t as { t?: unknown; d?: unknown };
    if (typeof term.t !== 'string' || typeof term.d !== 'string') continue;
    const key = term.t.trim().toLowerCase();
    if (!term.t.trim() || !term.d.trim() || seen.has(key)) continue;
    seen.add(key);
    terms.push({ t: term.t.trim(), d: term.d.trim() });
  }

  const notes = (Array.isArray(raw.notes) ? raw.notes : [])
    .filter((n): n is string => typeof n === 'string' && n.trim() !== '')
    .map((n) => n.trim());

  return {
    guide: {
      ...base,
      blurb: typeof raw.blurb === 'string' && raw.blurb.trim() ? raw.blurb.trim() : base.blurb,
      units,
      terms: terms.length ? terms : base.terms,
      mastery: 0,
    },
    notes,
  };
}

/**
 * What the revision does to what you have already drilled.
 *
 * The numbers a person needs before they agree to replace a guide. Comparison
 * is on the exact question text because that is exactly what `cardKey` hashes
 * — a comparison that ignored whitespace here would report a card as kept and
 * then lose its history anyway.
 */
export function survey(before: Guide, after: Guide): Survey {
  const old = new Set(before.units.flatMap((u) => u.cards.map((c) => c.q)));
  const next = new Set(after.units.flatMap((u) => u.cards.map((c) => c.q)));

  let kept = 0;
  for (const q of old) if (next.has(q)) kept++;

  const goneList = [...old].filter((q) => !next.has(q));
  const freshList = [...next].filter((q) => !old.has(q));

  // A question that vanished while a new one appeared is usually the same
  // question reworded. Pairing them by similarity is guesswork, so the split
  // is reported as a range rather than asserted: everything gone is counted as
  // reworded up to the number of fresh ones, and the rest as dropped.
  const reworded = Math.min(goneList.length, freshList.length);
  const dropped = goneList.length - reworded;

  const examples = goneList.slice(0, 3).map((q, i) => ({ before: q, after: freshList[i] ?? '' }));

  return {
    kept,
    reworded,
    dropped,
    fresh: freshList.length - reworded,
    unitsBefore: before.units.length,
    unitsAfter: after.units.length,
    examples,
  };
}

/** The sentence above the preview. Says the cost first, because it is the risk. */
export function verdict(s: Survey): string {
  if (s.reworded === 0 && s.dropped === 0) {
    return `Every one of your ${s.kept} existing cards came through word for word, so nothing you have drilled is lost. ${s.fresh} new.`;
  }
  const lost = s.reworded + s.dropped;
  return (
    `${s.kept} of your cards came through unchanged. ${lost} did not, ` +
    `and a card whose wording changes loses the answers you have given it — ` +
    `${s.reworded} look reworded and ${s.dropped} are gone. ${s.fresh} are new.`
  );
}

// ── One unit at a time ──────────────────────────────────────────────────────

/**
 * Rebuilding a single unit rather than the whole guide.
 *
 * The rework above is the right tool once a term's worth of material has piled
 * up, and the wrong one for "unit 4 is thin". It rewrites everything, so its
 * cost preview covers everything, and a student who wants one section improved
 * has to accept a rearrangement of eleven others to get it. Most of the time
 * they say no, and unit 4 stays thin.
 *
 * This is the bounded version. One unit in, one unit out, and the blast radius
 * is enforced here rather than asked for in the prompt: `readOneUnit` returns
 * the guide it was given with exactly one unit replaced, so a model that
 * decides to reorganise the whole course cannot.
 *
 * The rule about answer history is unchanged and matters just as much — see
 * the note at the top of this file. `survey` measures it the same way; it just
 * has far less to measure.
 */
export const SYSTEM_ONE = `You revise ONE unit of a university study guide.

You are given the whole guide's unit list for context, the unit to revise in full, and any material
the student has added that belongs to it. Produce that one unit, better: its cards written from
prose that never became questions, thin coverage filled in from the added material, a clearer name
if the current one no longer describes it.

Stay inside the unit. Do not move content into it from another unit, do not propose splitting it,
and do not return any other unit — the other units are shown to you only so you do not duplicate
what they already cover.

THE RULE THAT MATTERS MOST — reproduce every existing card question EXACTLY as written, character
for character, unless it is factually wrong. The app keys the student's answer history to the text
of the question, so rewording one silently discards every answer they have given it: the streak,
the interval, the due date. A clumsily worded question they have drilled eleven times is worth more
than a better one they have drilled none. If a question is genuinely wrong, fix it and say so.

Never invent a fact, a figure, a date or a citation. Everything must come from the unit you were
given or from the added material shown with it.

Reply with JSON only, no prose around it:
{"name":"…","cards":[{"q":"…","a":"…"}],"terms":[{"t":"…","d":"…"}],
 "notes":["what you changed, one line each"]}`;

/**
 * Everything the model is shown for one unit.
 *
 * The other units appear as names only. They are context — "do not duplicate
 * what unit 7 already covers" — and sending their cards would both cost tokens
 * and invite the model to move them.
 */
export function oneUnit(
  guide: Guide,
  updates: CourseUpdate[],
  unit: number,
  /**
   * Which displayed units the merge spliced in, from `LiveGuide.addedUnits`.
   *
   * Everything about which material belongs to which unit follows from this —
   * see `updatesFor`. Empty means the guide on screen is the guide on disk,
   * which is what every caller that has no merge to consult should pass.
   */
  addedUnits: number[] = [],
): string {
  const target = guide.units[unit];
  if (!target) throw new Error('That unit is not in this guide.');

  const others = guide.units
    .map((u, i) => (i === unit ? `Unit ${i + 1}: ${u.name}  ← THE ONE TO REVISE` : `Unit ${i + 1}: ${u.name}`))
    .join('\n');

  const cards = target.cards.map((c) => `  Q: ${c.q}\n  A: ${c.a}`).join('\n');

  const mine = updatesFor(guide.units, addedUnits, updates, unit);
  const added = mine
    .map((u) => {
      const where = u.unit === null ? 'filed against no unit' : 'filed against this unit';
      const made = u.cards.length
        ? `\nCards already made from it:\n${u.cards.map((c) => `  Q: ${c.q}\n  A: ${c.a}`).join('\n')}`
        : '';
      const terms = u.terms.length
        ? `\nTerms: ${u.terms.map((t) => `${t.t} — ${t.d}`).join('; ')}`
        : '';
      return `--- ${u.title || 'Added material'} (${u.source || 'no source given'}, ${where})\n${
        u.body.trim() || '(no prose)'
      }${made}${terms}`;
    })
    .join('\n\n');

  return [
    `Course: ${guide.code} — ${guide.name}`,
    '',
    'EVERY UNIT, FOR CONTEXT ONLY',
    others,
    '',
    `THE UNIT TO REVISE — ${target.name}`,
    cards || '(no cards yet)',
    '',
    'GLOSSARY, SO YOU DO NOT REDEFINE A TERM',
    guide.terms.map((t) => `${t.t} — ${t.d}`).join('\n') || '(empty)',
    '',
    'ADDED MATERIAL THAT BELONGS TO IT',
    added || '(nothing)',
  ].join('\n');
}

/**
 * The revised unit, put back into the guide it came from.
 *
 * Everything outside the one unit is copied from `base` rather than taken from
 * the reply — which is what makes this bounded. A model that returns eleven
 * units, renames the course, or empties the glossary changes nothing here but
 * the unit that was asked for.
 *
 * New terms are folded in and existing definitions win. A unit-scoped
 * regeneration is not the place to quietly redefine a term the rest of the
 * guide already uses, and dropping one would take it out of every other unit's
 * glossary to fix one unit's.
 */
export function readOneUnit(reply: string, base: Guide, unit: number): Plan {
  if (!base.units[unit]) throw new Error('That unit is not in this guide.');

  const start = reply.indexOf('{');
  const end = reply.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Nothing usable came back.');

  let raw: { name?: unknown; cards?: unknown; terms?: unknown; notes?: unknown };
  try {
    raw = JSON.parse(reply.slice(start, end + 1)) as typeof raw;
  } catch {
    throw new Error('What came back was not valid JSON. Try again.');
  }

  const cards: StudyCard[] = [];
  for (const c of Array.isArray(raw.cards) ? raw.cards : []) {
    const card = c as { q?: unknown; a?: unknown };
    if (typeof card.q !== 'string' || typeof card.a !== 'string') continue;
    const q = card.q.trim();
    const a = card.a.trim();
    if (q && a) cards.push({ q, a });
  }

  // The one outcome worse than not regenerating: a unit you had cards in,
  // replaced by nothing.
  if (cards.length === 0) {
    throw new Error('That came back with no cards. The unit was left as it was.');
  }

  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : base.units[unit].name;

  const terms: Term[] = [...base.terms];
  const seen = new Set(base.terms.map((t) => t.t.trim().toLowerCase()));
  for (const t of Array.isArray(raw.terms) ? raw.terms : []) {
    const term = t as { t?: unknown; d?: unknown };
    if (typeof term.t !== 'string' || typeof term.d !== 'string') continue;
    const key = term.t.trim().toLowerCase();
    if (!term.t.trim() || !term.d.trim() || seen.has(key)) continue;
    seen.add(key);
    terms.push({ t: term.t.trim(), d: term.d.trim() });
  }

  const notes = (Array.isArray(raw.notes) ? raw.notes : [])
    .filter((n): n is string => typeof n === 'string' && n.trim() !== '')
    .map((n) => n.trim());

  return {
    guide: {
      ...base,
      units: base.units.map((u, i) =>
        // Mastery is measured from answers and never declared — same as the
        // whole-guide path. `applyReviews` fills it back in from what has
        // actually been drilled.
        i === unit ? { name, mastery: 0, cards } : u,
      ),
      terms,
    },
    notes,
  };
}

/**
 * A unit's index in the stored guide, given its index on screen.
 *
 * `mergeGuide` splices an unfiled update in as a unit of its own, so the guide
 * a person is looking at can have more units than the one on disk, and every
 * unit at or after an insertion is displayed one higher than it is stored.
 * `addedUnits` is the merge's own record of which displayed indices are
 * insertions, which is exactly what this needs.
 *
 * Null for an inserted unit: it has no stored counterpart, and the material
 * that belongs to it is the one update it was made out of — which is
 * `updatesFor`'s problem rather than this one's.
 */
export function storedUnit(displayed: number, addedUnits: number[] = []): number | null {
  if (addedUnits.includes(displayed)) return null;
  return displayed - addedUnits.filter((a) => a < displayed).length;
}

/**
 * Whether an unfiled update is the one a given unit was spliced in for.
 *
 * A superset test rather than an equality one, because the unit holds the
 * update's *fresh* cards: a rebuild that folded half a reading in leaves the
 * other half to be spliced, so the unit is a subset of the update by then.
 * Every question in the unit appearing in the update is true before and after
 * that, and is false for a different reading.
 */
function madeIt(u: CourseUpdate, unit: Unit): boolean {
  if (u.unit !== null || unit.cards.length === 0) return false;
  const asked = new Set(u.cards.map((c) => c.q));
  return unit.cards.every((c) => asked.has(c.q));
}

/**
 * The material that belongs to one displayed unit.
 *
 * Three cases, and getting any of them wrong sends the model the wrong week's
 * reading — which comes back looking like a perfectly good unit, so nothing
 * downstream can catch it.
 *
 * - **A unit the merge spliced in** owns exactly the update it was made out
 *   of. Filtering on "unfiled" alone is not enough once there are two of
 *   them: both are unfiled, so picking either one offered the model both
 *   readings and let it fold one into the other, and the save then replaced
 *   one unit with a rewrite drawing on the other's material.
 * - **A stored unit** owns what was filed against its *stored* index, which
 *   is what `CourseUpdate.unit` holds and is not the index on screen.
 * - **Unfiled material with no unit of its own** — a reading with no cards, or
 *   one a rebuild has entirely folded in — could belong anywhere, so it goes
 *   to whichever stored unit is being rebuilt. Unfiled material that *did*
 *   become a unit does not: it has a home, and that home is not this one.
 */
export function updatesFor(
  units: Unit[],
  addedUnits: number[],
  updates: CourseUpdate[],
  displayed: number,
): CourseUpdate[] {
  const target = units[displayed];
  if (!target) return [];

  if (addedUnits.includes(displayed)) {
    return updates.filter((u) => madeIt(u, target));
  }

  const stored = storedUnit(displayed, addedUnits);
  const housed = updates.filter((u) =>
    addedUnits.some((i) => units[i] && madeIt(u, units[i] as Unit)),
  );
  return updates.filter(
    (u) =>
      (stored !== null && u.unit === stored) || (u.unit === null && !housed.includes(u)),
  );
}
