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
import type {
  CourseId,
  CourseUpdate,
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
  /** Index of the first unit that came from an update rather than the guide. */
  firstAddedUnit: number;
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
function cardsByUnit(updates: CourseUpdate[], unitCount: number): Record<number, StudyCard[]> {
  const out: Record<number, StudyCard[]> = {};
  for (const u of updates) {
    if (!attached(u, unitCount)) continue;
    (out[u.unit as number] ??= []).push(...u.cards);
  }
  return out;
}

export function mergeGuide(guide: Guide, updates: CourseUpdate[]): LiveGuide {
  const base = guide.units.map((u) => u.cards.length);
  if (updates.length === 0) {
    return { ...guide, added: {}, baseCards: base, firstAddedUnit: guide.units.length };
  }

  const added = cardsByUnit(updates, guide.units.length);

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

  // An update filed against no unit becomes a unit of its own, at the end,
  // where a new reading actually belongs — and so does one whose unit has
  // since gone, which is materially the same situation.
  const firstAddedUnit = units.length;
  for (const u of updates) {
    if (attached(u, guide.units.length)) continue;
    if (u.cards.length === 0) continue;
    units.push({ name: u.title || 'Added material', mastery: 0, cards: u.cards });
    added[units.length - 1] = u.cards;
    base.push(0);
  }

  const terms = [...guide.terms, ...updates.flatMap((u) => u.terms)];
  const mastery = units.length
    ? Math.round(units.reduce((n, u) => n + u.mastery * u.cards.length, 0) /
        Math.max(1, units.reduce((n, u) => n + u.cards.length, 0)))
    : guide.mastery;

  return { ...guide, units, terms, mastery, added, baseCards: base, firstAddedUnit };
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
  now: number,
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

/** Images you attached, as figures on the unit they were filed against. */
export function mergeFigures(figures: FigureMap, updates: CourseUpdate[]): FigureMap {
  if (updates.length === 0) return figures;
  const out: FigureMap = { ...figures };
  for (const u of updates) {
    if (u.unit === null) continue;
    const image = u.fileIds[0];
    // A unit that already has a figure keeps it; yours goes to the extras, so
    // the guide's own diagram is never displaced by a photo.
    if (image && !out[u.unit]) {
      out[u.unit] = {
        type: 'image',
        title: u.title || 'Added',
        caption: u.source ? `Added — ${u.source}` : 'Added by you',
        fileId: image,
      };
    }
  }
  return out;
}

/**
 * The images that did not become a unit's figure.
 *
 * Takes the figure map for the same reason `mergeFigures` builds one: the two
 * have to agree about which image was used, and they did not. This skipped the
 * first image of every unit-attached update on the assumption it had been
 * taken as that unit's figure — but `mergeFigures` only takes it when the unit
 * has none, so an update on a unit that already had a diagram, or a second
 * update on the same unit, had its first image skipped here and never placed
 * there. The comment beside that rule promised "yours goes to the extras", and
 * it went nowhere.
 *
 * The accumulation below mirrors `mergeFigures` exactly, including the way one
 * update can claim a unit and leave the next one to come here instead. Change
 * one and change the other.
 */
export function extraFigures(
  extras: Figure[],
  updates: CourseUpdate[],
  figures: FigureMap = {},
): Figure[] {
  const claimed = new Set(Object.keys(figures).map(Number));
  const mine: Figure[] = [];

  for (const u of updates) {
    // Whether this update's first image is about to become the unit's figure.
    const takesFirst = u.unit !== null && Boolean(u.fileIds[0]) && !claimed.has(u.unit);
    if (takesFirst) claimed.add(u.unit as number);

    u.fileIds.slice(takesFirst ? 1 : 0).forEach((fileId, i) =>
      mine.push({
        type: 'image',
        // Numbered from what is actually shown here, so an update whose first
        // image also lands in the extras is not labelled "(2)" with no (1).
        title: u.title ? `${u.title} (${i + (takesFirst ? 2 : 1)})` : 'Added',
        caption: u.source ? `Added — ${u.source}` : 'Added by you',
        fileId,
      }),
    );
  }
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
    return {
      guide: applyReviews(mergeGuide(base, updates), courseId, state.reviews, Date.now()),
      figures: mergeFigures(catalog.figures[courseId] ?? {}, updates),
      extras: extraFigures(catalog.extraFigures[courseId] ?? [], updates, catalog.figures[courseId] ?? {}),
      lessons: catalog.lessons[courseId] ?? {},
      updates,
      onUnit: (index: number) => updates.filter((u) => u.unit === index),
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
  const merged = mergeGuide(cat.guides[courseId] ?? EMPTY_GUIDE, forCourse(updates, courseId));
  return applyReviews(merged, courseId, reviews, Date.now());
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
