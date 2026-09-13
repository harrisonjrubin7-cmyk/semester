/**
 * The guide as it stands today.
 *
 * A course module is what the pipeline made out of the syllabus and the
 * readings. It never changes by itself. What changes is the semester: a reading
 * gets posted in week six, a professor hands out a study sheet before the
 * midterm, you photograph the board.
 *
 * Everything you add is stored as a {@link CourseUpdate} and merged in here, at
 * read time, for every screen at once. That is the whole trick: no screen holds
 * its own copy of a guide, so adding material to a unit updates the cards, the
 * reading view, the quiz pool, the cram sheet, the figures and the lesson
 * together, and nothing can be updated in one place and stale in another.
 *
 * Two things the merge is careful about:
 *
 *  - Added cards are counted but kept identifiable, so the app can say what is
 *    new rather than silently blending it into what came from the syllabus.
 *  - A unit's mastery is diluted by what you add. Ten cards at 80% plus five
 *    new ones you have never seen is not still 80%, and if the app pretended
 *    otherwise the unit would drop out of tonight's plan exactly when it should
 *    be climbing it.
 */

import { useMemo } from 'react';
import type { Catalog } from '../data/catalog';
import { useStore } from '../state/store';
import { cardKey, unitMastery, type Reviews } from './review';
import { nameFor, sessionIn, slotFor, unitNumber } from './session.place';
import type {
  CourseId,
  CourseUpdate,
  Example,
  Figure,
  FigureMap,
  Guide,
  Lesson,
  StudyCard,
  Unit,
} from './types';

export interface LiveGuide extends Guide {
  /** Cards added since import, by unit index. Also present in `units`. */
  added: Record<number, StudyCard[]>;
  /** How many cards each unit had before anything was added. */
  baseCards: number[];
  /**
   * Which units came from an update rather than the guide, by index.
   *
   * This was `firstAddedUnit`, a single index, which only worked while added
   * units all went on the end. They are placed by session number now, so a
   * Session 7 reading sits at index 4 with the guide's own units on both sides
   * of it and there is no "first" to point at.
   */
  addedUnits: number[];
  /**
   * How much of the long form came from material added since.
   *
   * The frames, out-loud questions and cases themselves are already in
   * `frames`, `selfTest` and `cases` above — a screen that just renders the
   * guide needs to know nothing. These counts exist so the field guide and the
   * cram sheet can *say* that part of what is on the page arrived later, which
   * is worth knowing when you are deciding whether you have read this before.
   *
   * Counted rather than listed because the guide's own and yours are
   * deliberately interleaved: a cram sheet that put your frames in a separate
   * box at the bottom would be a cram sheet you read the top of.
   */
  addedLong: { frames: number; selfTest: number; cases: number; examples: number };
  /** The module's worked examples with yours folded in. See `mergeGuide`. */
  examples: Example[];
}

const NO_UPDATES: CourseUpdate[] = [];

export function forCourse(updates: CourseUpdate[], id: CourseId): CourseUpdate[] {
  const mine = updates.filter((u) => u.courseId === id);
  return mine.length ? mine.sort((a, b) => a.created - b.created) : NO_UPDATES;
}

/**
 * Whether an update still points at a unit that exists.
 *
 * A guide can get shorter. Re-import a syllabus after the professor trims the
 * reading list and unit 5 is simply not there any more — but the update the
 * student filed against it still says 5. Those used to be keyed into `added`
 * at an index nothing rendered, so a photographed board or a posted reading
 * disappeared from the app with nothing said. Losing somebody's own material
 * quietly is worse than any of the shapes this file refuses.
 */
function attached(u: CourseUpdate, unitCount: number): boolean {
  return u.unit !== null && u.unit >= 0 && u.unit < unitCount;
}

/** Cards a set of updates adds, keyed by the unit they extend. */
function cardsByUnit(
  updates: CourseUpdate[],
  unitCount: number,
  /**
   * Questions the guide already has, so nothing is merged in twice.
   *
   * A rebuild folds added material into the guide and saves it, and the
   * updates stay listed — deliberately, so they can still be removed and
   * their files are still attached. Nothing consumed them, so the next render
   * merged the same cards on top of the guide that now contains them, and
   * every card from every reading appeared twice. Once a guide has been
   * rebuilt, twice more after two rebuilds.
   *
   * Keyed on the question text, which is what `cardKey` hashes and therefore
   * what "the same card" already means everywhere else in the app: a card the
   * rebuild reworded is genuinely a different card and is merged, which is the
   * same answer the cost preview gives.
   *
   * This predates scoped rebuilds and applies to the whole-guide one just as
   * much — the scoped path only made it easier to reach, because a rebuild you
   * would actually accept is one you can do without rearranging eleven other
   * units.
   */
  have: Set<string>,
): Record<number, StudyCard[]> {
  const out: Record<number, StudyCard[]> = {};
  for (const u of updates) {
    if (!attached(u, unitCount)) continue;
    const fresh = u.cards.filter((c) => !have.has(c.q));
    if (fresh.length > 0) (out[u.unit as number] ??= []).push(...fresh);
  }
  return out;
}

export function mergeGuide(
  guide: Guide,
  updates: CourseUpdate[],
  /**
   * The module's worked examples.
   *
   * Passed in rather than read off the guide because that is where they live —
   * `CourseModule.examples`, not `Guide` — and this function is given a guide.
   * Defaulted so every existing caller is unchanged.
   */
  base_examples: Example[] = [],
): LiveGuide {
  const base = guide.units.map((u) => u.cards.length);
  if (updates.length === 0) {
    return {
      ...guide,
      added: {},
      baseCards: base,
      addedUnits: [],
      addedLong: NOTHING_ADDED,
      examples: base_examples,
    };
  }

  // Every question the guide already holds, for the duplicate check above.
  const have = new Set(guide.units.flatMap((u) => u.cards.map((c) => c.q)));
  const added = cardsByUnit(updates, guide.units.length, have);

  const units: Unit[] = guide.units.map((u, i) => {
    const extra = added[i];
    if (!extra || extra.length === 0) return u;
    const total = u.cards.length + extra.length;
    return {
      ...u,
      cards: [...u.cards, ...extra],
      // Diluted by what you have not seen yet, rounded down so a unit with new
      // material never looks warmer than it is.
      mastery: Math.floor((u.mastery * u.cards.length) / total),
    };
  });

  /*
   * An update filed against no unit becomes a unit of its own — and so does
   * one whose unit has since gone, which is materially the same situation.
   *
   * Placed by the session it names rather than appended. "Session 7 slides"
   * posted in week seven belongs after the guide's Session 7, not after unit
   * 11 where six weeks of material it comes before would bury it. Nothing to
   * read a number from still means the end, which is the old behaviour and the
   * right answer when nothing is known. See `lib/session.place.ts`.
   */
  const numbered = guide.units.some((u) => unitNumber(u.name) !== null);
  const addedUnits: number[] = [];
  for (const u of updates) {
    if (attached(u, guide.units.length)) continue;
    if (u.cards.length === 0) continue;
    /*
     * Already folded in by a rebuild — see the note on `have` above. A unit
     * spliced in for material the guide now contains is the same duplication
     * as a card, one level up.
     *
     * Card by card, not all-or-nothing. A reading whose cards were partly
     * folded in — one reworded by the rebuild and so still outstanding, the
     * rest kept verbatim — passes an `every` check and then splices a unit
     * holding the verbatim ones a second time. The attached path above
     * filters; this one has to filter for the same reason.
     */
    const fresh = u.cards.filter((c) => !have.has(c.q));
    if (fresh.length === 0) continue;
    const n = sessionIn(u.title) ?? sessionIn(u.source);
    const at = slotFor(units, n);
    units.splice(at, 0, {
      name: nameFor(u.title || 'Added material', n, numbered),
      mastery: 0,
      cards: fresh,
    });
    base.splice(at, 0, 0);
    // Everything at or after the insert shifted up by one, including units an
    // earlier update in this same loop placed.
    for (let i = 0; i < addedUnits.length; i += 1) {
      if (addedUnits[i] >= at) addedUnits[i] += 1;
    }
    addedUnits.push(at);
    // `added` is keyed by index, so its keys move too.
    for (const key of Object.keys(added).map(Number).sort((a, b) => b - a)) {
      if (key >= at) {
        added[key + 1] = added[key];
        delete added[key];
      }
    }
    added[at] = fresh;
  }
  addedUnits.sort((a, b) => a - b);

  const terms = join(guide.terms, updates.flatMap((u) => u.terms), (t) => t.t);

  /*
   * The long form: the cram sheet's frames, the out-loud questions at the end
   * of the field guide, and any claim-and-test pairing. These used to be the
   * three parts of a guide that adding a reading could not touch, so the field
   * guide read in week twelve was the one written in week one.
   *
   * Appended rather than interleaved by unit, because none of the three is
   * keyed to a unit — a frame is about the exam, not about section four.
   */
  const frames = join(guide.frames ?? [], updates.flatMap((u) => u.frames ?? []), (f) => f.t);
  const selfTest = join(guide.selfTest ?? [], updates.flatMap((u) => u.selfTest ?? []), (c) => c.q);
  const cases = join(guide.cases ?? [], updates.flatMap((u) => u.cases ?? []), (c) => c.title);
  // Worked examples live on the module rather than the guide — the Cases tab
  // renders both — so they are merged here and read through `examplesOn`.
  const examples = join(base_examples, updates.flatMap((u) => u.examples ?? []), (e) => e.t);

  const mastery = units.length
    ? Math.round(units.reduce((n, u) => n + u.mastery * u.cards.length, 0) /
        Math.max(1, units.reduce((n, u) => n + u.cards.length, 0)))
    : guide.mastery;

  return {
    ...guide,
    units,
    terms,
    // Left undefined when there are none, because three screens test
    // `guide.frames && guide.frames.length` and an empty array that reads as
    // present is how an empty section heading gets rendered.
    frames: frames.length ? frames : guide.frames,
    selfTest: selfTest.length ? selfTest : guide.selfTest,
    cases: cases.length ? cases : guide.cases,
    examples,
    mastery,
    added,
    baseCards: base,
    addedUnits,
    addedLong: {
      frames: frames.length - (guide.frames?.length ?? 0),
      selfTest: selfTest.length - (guide.selfTest?.length ?? 0),
      cases: cases.length - (guide.cases?.length ?? 0),
      examples: examples.length - base_examples.length,
    },
  };
}

const NOTHING_ADDED = { frames: 0, selfTest: 0, cases: 0, examples: 0 };

/**
 * The guide's own, then yours, minus anything already there.
 *
 * The de-duplication is not tidiness. Every one of these lists is rendered
 * with its own text as the React key — `key={f.t}`, `key={c.q}`, `key={t.t}` —
 * so a reading that restates a term the guide already defines produced two
 * children with the same key, which React renders wrong and warns about in a
 * console nobody has open. Re-adding the same reading twice, which the app
 * otherwise handles cleanly, was enough to do it.
 *
 * The guide's own wins, and the comparison is on the identifying field alone:
 * a second definition of "elasticity" is the same term, not a new one.
 */
function join<T>(mine: T[], theirs: T[], keyOf: (x: T) => string): T[] {
  if (theirs.length === 0) return mine;
  const seen = new Set(mine.map(keyOf));
  const out = [...mine];
  for (const one of theirs) {
    const key = keyOf(one);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(one);
  }
  return out;
}

/**
 * Replace declared mastery with measured mastery.
 *
 * Runs after the merge, so dilution by newly added cards still happens first
 * and then supplies the estimate for every card you have not answered. A card
 * you have answered is scored on your answers; the unit is the mean across its
 * cards; the guide is the mean across its units, weighted by size.
 */
export function applyReviews(
  guide: LiveGuide,
  courseId: CourseId,
  reviews: Reviews,
  /**
   * Defaulted here rather than read at each call site.
   *
   * Mastery is measured against the clock — a card is cold because of how long
   * it has been — so this genuinely depends on the time it is asked. Reading
   * `Date.now()` in the callers meant doing it during render, which React's
   * purity rule flags and is right to: the value belongs to the function that
   * needs it, not to the component that happens to ask.
   */
  now: number = Date.now(),
): LiveGuide {
  if (guide.units.length === 0) return guide;

  const units = guide.units.map((u) => ({
    ...u,
    mastery: unitMastery(
      u.cards.map((c) => cardKey(courseId, c.q)),
      reviews,
      u.mastery,
      now,
    ),
  }));

  const cards = units.reduce((n, u) => n + u.cards.length, 0);
  const mastery = cards
    ? Math.round(units.reduce((n, u) => n + u.mastery * u.cards.length, 0) / cards)
    : guide.mastery;

  return { ...guide, units, mastery };
}

/**
 * Everything one update contributes as figures, in the order it offers them.
 *
 * Figures read out of the material come first, then photographs. A table the
 * reading actually contains says more about the unit than a picture of the
 * page it was on, and only one of the two can have the unit's slot.
 */
function offered(u: CourseUpdate): Figure[] {
  const read = u.figures ?? [];
  const shots: Figure[] = u.fileIds.map((fileId) => ({
    type: 'image',
    title: u.title || 'Added',
    caption: u.source ? `Added — ${u.source}` : 'Added by you',
    fileId,
  }));
  return [...read, ...shots];
}

/**
 * Where every added figure goes: one per unit, the rest to the extras rail.
 *
 * One function rather than two, and that is the point of it. `mergeFigures`
 * and `extraFigures` used to decide this separately and disagreed — the rule
 * "a unit that already has a figure keeps it, yours goes to the extras" was
 * implemented once and only approximated in the other, so an update filed
 * against a unit that already had a diagram had its first image skipped by
 * both and rendered by neither. It went nowhere, silently, which for somebody
 * else's photograph of a whiteboard is the worst way to lose it.
 *
 * Now there is one pass, and the two exported functions are two readings of
 * its result. They cannot drift because there is nothing left to drift.
 */
function place(
  base: FigureMap,
  updates: CourseUpdate[],
): { map: FigureMap; extras: Figure[]; perUnit: Record<number, Figure[]> } {
  const map: FigureMap = { ...base };
  const extras: Figure[] = [];
  /*
   * Every figure a unit can show, in order, including the ones that did not
   * fit its one slot.
   *
   * The Figures tab has a rail for the overflow, so it never needed this. A
   * deck does: a slideshow of a unit shows one figure and then ends, so a
   * reading with three tables in it contributed one slide and quietly dropped
   * two. Built here rather than derived in the screens, because "which figure
   * claimed the slot" is decided here and nowhere else can know it.
   */
  const perUnit: Record<number, Figure[]> = {};
  for (const [key, figure] of Object.entries(map)) {
    if (figure) perUnit[Number(key)] = [figure];
  }

  for (const u of updates) {
    const all = offered(u);
    if (all.length === 0) continue;

    // The guide's own figure is never displaced, and neither is one an earlier
    // update already placed on this unit.
    const takesSlot = u.unit !== null && map[u.unit] === undefined;
    if (takesSlot) {
      const [first] = all;
      const placed =
        first.type === 'image'
          ? { ...first, title: u.title || 'Added' }
          : { ...first, caption: u.source ? `${first.caption} — ${u.source}` : first.caption };
      map[u.unit as number] = placed;
      perUnit[u.unit as number] = [placed];
    }

    // Numbered from what is actually shown on the rail, so an update whose
    // first figure went to the unit does not leave a "(2)" with no (1).
    all.slice(takesSlot ? 1 : 0).forEach((f, i) => {
      const n = i + (takesSlot ? 2 : 1);
      const spare =
        f.type === 'image'
          ? { ...f, title: u.title ? `${u.title} (${n})` : 'Added' }
          : { ...f, caption: u.source ? `${f.caption} — ${u.source}` : f.caption };
      extras.push(spare);
      // An overflow figure still belongs to the unit it was filed against,
      // even though the Figures tab shows it on the shared rail.
      if (u.unit !== null) (perUnit[u.unit] ??= []).push(spare);
    });
  }

  return { map, extras, perUnit };
}

/**
 * The guide's figures with yours folded in — a table or a diagram read out of
 * a reading, and photographs you attached.
 */
export function mergeFigures(figures: FigureMap, updates: CourseUpdate[]): FigureMap {
  if (updates.length === 0) return figures;
  return place(figures, updates).map;
}

/** The figures that did not become a unit's own. */
export function extraFigures(
  extras: Figure[],
  updates: CourseUpdate[],
  figures: FigureMap = {},
): Figure[] {
  if (updates.length === 0) return extras;
  const mine = place(figures, updates).extras;
  return mine.length ? [...extras, ...mine] : extras;
}

export interface Live {
  guide: LiveGuide;
  figures: FigureMap;
  extras: Figure[];
  lessons: Record<number, Lesson>;
  /** Updates filed against this course, oldest first. */
  updates: CourseUpdate[];
  /** Updates on one unit, for the "what's new here" strips. */
  onUnit: (index: number) => CourseUpdate[];
  /**
   * Every figure one unit can show, the claimed one first.
   *
   * `figures[i]` is the single figure the unit leads with; this is that plus
   * anything else filed against the unit that the one slot could not hold. A
   * deck wants all of them, a header wants the first.
   */
  figuresOn: (index: number) => Figure[];
}

/** Everything a study screen needs for one course, with your additions folded in. */
export function useLive(courseId: CourseId): Live {
  const { state, catalog } = useStore();
  const updates = useMemo(
    () => forCourse(state.updates, courseId),
    [state.updates, courseId],
  );

  return useMemo(() => {
    const base = catalog.guides[courseId] ?? EMPTY_GUIDE;
    const own = catalog.figures[courseId] ?? {};
    // One pass, three readings of it — the map a unit leads with, the shared
    // rail, and the per-unit lists a deck walks.
    const placed = place(own, updates);
    return {
      guide: applyReviews(
        mergeGuide(base, updates, catalog.examples[courseId] ?? []),
        courseId,
        state.reviews,
      ),
      figures: updates.length === 0 ? own : placed.map,
      extras: extraFigures(catalog.extraFigures[courseId] ?? [], updates, own),
      lessons: catalog.lessons[courseId] ?? {},
      updates,
      onUnit: (index: number) => updates.filter((u) => u.unit === index),
      figuresOn: (index: number) => placed.perUnit[index] ?? [],
    };
  }, [catalog, courseId, updates, state.reviews]);
}

/** The same merge outside React — for selectors that run on plain state. */
export function liveGuide(
  cat: Catalog,
  courseId: CourseId,
  updates: CourseUpdate[],
  reviews: Reviews = {},
): LiveGuide {
  const merged = mergeGuide(
    cat.guides[courseId] ?? EMPTY_GUIDE,
    forCourse(updates, courseId),
    cat.examples[courseId] ?? [],
  );
  return applyReviews(merged, courseId, reviews);
}

/**
 * A course that has gone — deleted while its guide was open, say. Rendering an
 * empty guide beats throwing on a screen the person is already looking at.
 */
const EMPTY_GUIDE: Guide = {
  code: '',
  name: '',
  blurb: '',
  source: '',
  mastery: 0,
  audio: false,
  units: [],
  terms: [],
};
