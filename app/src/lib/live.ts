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

/** Cards a set of updates adds, keyed by the unit they extend. */
function cardsByUnit(updates: CourseUpdate[]): Record<number, StudyCard[]> {
  const out: Record<number, StudyCard[]> = {};
  for (const u of updates) {
    if (u.unit === null) continue;
    (out[u.unit] ??= []).push(...u.cards);
  }
  return out;
}

export function mergeGuide(guide: Guide, updates: CourseUpdate[]): LiveGuide {
  const base = guide.units.map((u) => u.cards.length);
  if (updates.length === 0) {
    return { ...guide, added: {}, baseCards: base, firstAddedUnit: guide.units.length };
  }

  const added = cardsByUnit(updates);

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
  // where a new reading actually belongs.
  const firstAddedUnit = units.length;
  for (const u of updates) {
    if (u.unit !== null) continue;
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

export function extraFigures(extras: Figure[], updates: CourseUpdate[]): Figure[] {
  const mine: Figure[] = [];
  for (const u of updates) {
    const skipFirst = u.unit !== null ? 1 : 0;
    u.fileIds.slice(skipFirst).forEach((fileId, i) =>
      mine.push({
        type: 'image',
        title: u.title ? `${u.title} (${i + 2})` : 'Added',
        caption: u.source ? `Added — ${u.source}` : 'Added by you',
        fileId,
      }),
    );
    if (u.unit === null && u.fileIds[0]) {
      mine.push({
        type: 'image',
        title: u.title || 'Added',
        caption: u.source ? `Added — ${u.source}` : 'Added by you',
        fileId: u.fileIds[0],
      });
    }
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
      guide: mergeGuide(base, updates),
      figures: mergeFigures(catalog.figures[courseId] ?? {}, updates),
      extras: extraFigures(catalog.extraFigures[courseId] ?? [], updates),
      lessons: catalog.lessons[courseId] ?? {},
      updates,
      onUnit: (index: number) => updates.filter((u) => u.unit === index),
    };
  }, [catalog, courseId, updates]);
}

/** The same merge outside React — for selectors that run on plain state. */
export function liveGuide(cat: Catalog, courseId: CourseId, updates: CourseUpdate[]): LiveGuide {
  return mergeGuide(cat.guides[courseId] ?? EMPTY_GUIDE, forCourse(updates, courseId));
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
