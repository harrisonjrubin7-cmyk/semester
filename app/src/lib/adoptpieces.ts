import { newId } from './files';
import type { Change } from './changeset';
import type { Where } from './harvest';
import type { CourseModule } from './types';
import type { CaseFile, CourseUpdate, Example, Figure, Frame, Item, StudyCard, Term } from './types';

/**
 * Turning accepted changes into the two writes the app already makes.
 *
 * Nothing new is dispatched. Cards, terms, a unit and a note become one
 * `CourseUpdate` — the existing shape that `lib/live.ts` already merges into
 * every study surface, so Cards, Read, Quiz, Cram and the slides pick them up
 * the moment it is saved. Dates and weights become a changed `CourseModule`,
 * the same write the announcement screen makes.
 *
 * One import is one `CourseUpdate` and one module write, deliberately: that is
 * what makes an import a single thing to undo. See `provenance` below.
 */

/** What an import wrote, kept so it can be taken back out again. */
export interface Provenance {
  /** The file, as the student would recognise it. */
  source: string;
  /** The intake hash. Re-importing the same bytes is a no-op because of this. */
  sourceHash: string;
  /** What the classifier decided. */
  as: string;
  at: number;
  /** The `CourseUpdate` this import created, if it created one. */
  updateId?: string;
  /** Ids of items added to the course. */
  addedItems: string[];
  /**
   * Items and rows this import replaced, exactly as they were.
   *
   * Kept rather than deleted: undoing has to restore what was there, and
   * "restore" needs the thing itself. The spec asks for thirty days; nothing
   * here expires them, because a course is small and a deleted deadline
   * somebody wanted back is worse than a few kilobytes.
   */
  replaced: { items: Item[]; grading: { what: string; pct: string }[] };
}

export interface Adopted {
  /** The material update to dispatch, when there is one. */
  update?: Omit<CourseUpdate, 'id' | 'created'>;
  /** The course, changed, when dates or weights were accepted. */
  module?: CourseModule;
  provenance: Provenance;
}

/**
 * Which unit an accepted card belongs in.
 *
 * A `CourseUpdate` files against one unit index or none. Where the import
 * proposed a unit that the course already has, the cards go into that unit;
 * where the unit is new, they become a unit of their own at the end, which is
 * what `unit: null` means.
 */
function unitIndex(module: CourseModule | null, name: string): number | null {
  if (!module || !name) return null;
  const at = module.guide.units.findIndex((u) => u.name === name);
  return at === -1 ? null : at;
}

/**
 * Fold the accepted changes into what the app will write.
 *
 * Pure. Nothing dispatches here — the screen does that, once, so an import is
 * one entry in the undo history rather than forty.
 */
export function adopt(
  accepted: Change[],
  module: CourseModule | null,
  where: Where,
): Adopted {
  const cards: StudyCard[] = [];
  const terms: Term[] = [];
  // The five a pasted reading produces. Collected the same way as cards and
  // terms, so an accepted figure reaches the update and a declined one does
  // not — which is the whole point of routing paste through the sheet.
  const figures: Figure[] = [];
  const frames: Frame[] = [];
  const selfTest: StudyCard[] = [];
  const cases: CaseFile[] = [];
  const examples: Example[] = [];
  let unitName = '';
  let body = '';

  let items = module ? [...module.items] : [];
  let grading = module ? [...module.course.grading] : [];
  const addedItems: string[] = [];
  const replacedItems: Item[] = [];
  const replacedGrades: { what: string; pct: string }[] = [];

  for (const change of accepted) {
    const p = change.piece;
    switch (p.what) {
      case 'card':
        cards.push(p.card);
        break;
      case 'term':
        terms.push(p.term);
        break;
      case 'figure':
        figures.push(p.figure);
        break;
      case 'frame':
        frames.push(p.frame);
        break;
      case 'selftest':
        selfTest.push(p.card);
        break;
      case 'case':
        cases.push(p.file);
        break;
      case 'example':
        examples.push(p.example);
        break;
      case 'unit':
        unitName = p.name;
        if (p.body) body = body ? `${body}\n\n${p.body}` : p.body;
        break;
      case 'note':
        // A note has nowhere better to go than the update's prose, which is
        // what Read and Cram show. It is the material, kept.
        body = body ? `${body}\n\n${p.body}` : p.body;
        break;
      case 'item': {
        if (!module) break;
        const at = items.findIndex(
          (i) => change.against && `${i.title}, ${i.month + 1}/${i.day}` === change.against,
        );
        const made: Item = {
          id: newId(),
          c: module.course.id,
          title: p.title,
          kind: p.kind,
          month: p.month,
          day: p.day,
          dueTime: p.dueTime,
          weight: p.weight,
          where: '',
          detail: p.detail,
          quote: p.quote,
          ...(p.quote ? { checked: { confirmed: true, ...(p.where.page ? { page: p.where.page } : {}) } } : {}),
          source: p.where.source,
        };
        if (at === -1) {
          items = [...items, made];
        } else {
          // A conflict the student resolved in the new file's favour. The old
          // row is kept whole so undo can put it back exactly.
          replacedItems.push(items[at]);
          items = items.map((i, n) => (n === at ? { ...made, id: i.id } : i));
        }
        addedItems.push(made.id);
        break;
      }
      case 'grade': {
        if (!module) break;
        const at = grading.findIndex((g) => g.what === p.row.what);
        if (at === -1) {
          grading = [...grading, p.row];
        } else {
          replacedGrades.push(grading[at]);
          grading = grading.map((g, n) => (n === at ? p.row : g));
        }
        break;
      }
    }
  }

  const touchedCourse = module !== null && (addedItems.length > 0 || replacedGrades.length > 0 || grading.length !== module.course.grading.length);

  const out: Adopted = {
    provenance: {
      source: where.source,
      sourceHash: where.sourceHash,
      as: where.as,
      at: where.at,
      addedItems,
      replaced: { items: replacedItems, grading: replacedGrades },
    },
  };

  const anyLong =
    figures.length > 0 ||
    frames.length > 0 ||
    selfTest.length > 0 ||
    cases.length > 0 ||
    examples.length > 0;
  if (cards.length > 0 || terms.length > 0 || body || anyLong) {
    out.update = {
      courseId: (module?.course.id ?? '') as CourseUpdate['courseId'],
      unit: unitIndex(module, unitName),
      title: unitName || where.source,
      source: where.source,
      body,
      cards,
      terms,
      figures,
      frames,
      selfTest,
      cases,
      examples,
      fileIds: [],
      // Provenance, written with the material rather than beside it: a record
      // of what an import did is only useful if it cannot drift from what the
      // import wrote.
      sourceHash: where.sourceHash,
      as: where.as,
      addedItems,
    };
  }

  if (touchedCourse && module) {
    out.module = { ...module, items, course: { ...module.course, grading } };
  }

  return out;
}
