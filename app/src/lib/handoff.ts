/**
 * One course, handed to a classmate.
 *
 * Generating a course costs a syllabus upload and a long request to a model.
 * Four people in the same section each pay that four times over for the same
 * PDF, and three of them get a slightly different reading of it. This is a
 * file: the person who ran the import shares it, everyone else opens it, and
 * the course arrives whole — deadlines, guide, figures and all — with no
 * upload and no request.
 *
 * ## What is in it, and what is not
 *
 * A `CourseModule` and nothing else: the course, its dated items, its meeting
 * pattern, its study guide. All of that came off a syllabus that every person
 * in the section already has.
 *
 * None of the student's own work travels. Ticked boxes, notes, files, timings,
 * grades, practice sittings and added material are separate state and are not
 * in a module — but "not in it" by accident is not a promise, so `packCourse`
 * builds the payload field by field from the known shape rather than spreading
 * the module. A field added to `CourseModule` later is left out of a pack
 * until somebody adds it here on purpose, which is the safe direction to fail.
 *
 * ## The dates are the receiver's problem, and the app says so
 *
 * The pack records which file it was generated from and when. It is not a
 * guarantee that the dates match the receiver's section — professors run two
 * sections with different due dates off one syllabus template every term. So
 * the envelope carries enough for the receiving screen to say plainly where
 * this came from, and the import goes through the same review the student's
 * own generated course goes through rather than landing silently.
 */

import type { CourseModule, Item, RecurringBlock } from './types';

/** Bumped when the shape changes in a way an older app cannot read. */
export const PACK_VERSION = 1;

/** What sits around the course in the file. */
export interface Pack {
  kind: 'semester.course';
  version: number;
  /** Epoch ms the pack was written. */
  made: number;
  /** The syllabus filename the course was generated from, if it is known. */
  from: string;
  module: CourseModule;
}

/**
 * The course, rebuilt field by field.
 *
 * Deliberately not `{ ...module }`. See the note above: this is the boundary
 * that decides what leaves one person's device for another's, and a spread
 * would quietly widen it every time the type grows.
 */
function justTheCourse(m: CourseModule): CourseModule {
  const out: CourseModule = {
    course: tidyCourse(m.course),
    items: m.items.map((i) => ({ ...i })),
    schedule: m.schedule.map((b) => ({ ...b })),
    guide: m.guide,
    planMinutes: m.planMinutes,
    frameLabel: m.frameLabel,
  };
  if (m.exceptions) out.exceptions = m.exceptions.map((e) => ({ ...e }));
  if (m.figures) out.figures = m.figures;
  if (m.extraFigures) out.extraFigures = m.extraFigures;
  if (m.examples) out.examples = m.examples;
  if (m.podcast) out.podcast = m.podcast;
  if (m.lessons) out.lessons = m.lessons;
  return out;
}

/**
 * The course itself, field by field, with the arrays the screens map over.
 *
 * This started as `{ ...m.course }`, and that was the hole: a pack without
 * `grading` reached the course screen, which maps over it, and the page went
 * white. The same spread that is wrong on the way out — because it widens
 * what leaves the device — is wrong on the way in, because it does not
 * guarantee what arrives.
 */
function tidyCourse(c: CourseModule['course']): CourseModule['course'] {
  const text = (v: unknown) => (typeof v === 'string' ? v : '');
  const out: CourseModule['course'] = {
    id: c.id,
    code: text(c.code),
    name: text(c.name),
    prof: text(c.prof),
    email: text(c.email),
    meets: text(c.meets),
    room: text(c.room),
    credits: text(c.credits),
    source: text(c.source),
    grading: Array.isArray(c.grading)
      ? c.grading.map((g) => ({ what: text(g?.what), pct: text(g?.pct) }))
      : [],
  };
  if (c.term) out.term = text(c.term);
  if (c.lms) out.lms = text(c.lms);
  // The AI policy travels: it is what the syllabus says, it is what the
  // drafting tool checks before it will write anything, and a course arriving
  // without it would silently read as "nothing recorded" — which that tool
  // treats as a no, so the failure is at least in the safe direction.
  if (c.ai && typeof c.ai === 'object') {
    out.ai = { stance: c.ai.stance, note: text(c.ai.note) };
  }
  return out;
}

/**
 * Items, made safe to render.
 *
 * The pack came off another person's device. Between there and here it could
 * have been hand-edited, truncated by a chat client, or written by a version
 * of the app that words an item differently — and an item missing its `c` or
 * its `dueTime` does not fail politely downstream: `readDue` calls `.trim()`
 * on it and the whole screen goes white. That is a blank app with no
 * explanation, from opening a file somebody sent you.
 *
 * So each item is rebuilt with the fields the app actually reads, and one
 * that has no title or no date at all is dropped rather than guessed at. The
 * count of dropped items travels with the result, because a course quietly
 * missing two deadlines is the worst outcome available here.
 */
function tidyItems(raw: unknown, courseId: string): { items: Item[]; dropped: number } {
  if (!Array.isArray(raw)) return { items: [], dropped: 0 };
  const items: Item[] = [];
  let dropped = 0;

  for (const value of raw) {
    const i = value as Partial<Item> | null;
    const title = typeof i?.title === 'string' ? i.title.trim() : '';
    const month = Number(i?.month);
    const day = Number(i?.day);
    if (!title || !Number.isInteger(month) || !Number.isInteger(day)) {
      dropped += 1;
      continue;
    }
    if (month < 0 || month > 11 || day < 1 || day > 31) {
      dropped += 1;
      continue;
    }
    items.push({
      ...(i as Item),
      // The course id is taken from the course rather than trusted from the
      // item: a pack whose items point at some other course id would file
      // deadlines against a course that is not there.
      c: courseId,
      id: typeof i?.id === 'string' && i.id ? i.id : `${courseId}-${month}-${day}-${items.length}`,
      title,
      kind: typeof i?.kind === 'string' ? i.kind : '',
      month,
      day,
      dueTime: typeof i?.dueTime === 'string' ? i.dueTime : '',
      weight: typeof i?.weight === 'string' ? i.weight : '',
    });
  }

  return { items, dropped };
}

/**
 * The meeting pattern, made safe to render, for the same reason as the items.
 *
 * A block with no `meta` reached `roomOf`, which split it, and took the Gap
 * screen down as a blank page. A block with no `days` array reached the week
 * grid. Neither is a thing the app's own generator produces — both are things
 * a file that crossed between two devices can be.
 */
function tidySchedule(raw: unknown): RecurringBlock[] {
  if (!Array.isArray(raw)) return [];
  const out: RecurringBlock[] = [];
  for (const value of raw) {
    const b = value as Partial<RecurringBlock> | null;
    const days = Array.isArray(b?.days) ? b.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6) : [];
    const at = Number(b?.at);
    // A block with no days never draws and a block with no start time cannot
    // be placed, so neither is worth keeping as a half-thing.
    if (days.length === 0 || !Number.isFinite(at)) continue;
    out.push({
      ...(b as RecurringBlock),
      days,
      at,
      time: typeof b?.time === 'string' ? b.time : '',
      title: typeof b?.title === 'string' ? b.title : '',
      meta: typeof b?.meta === 'string' ? b.meta : '',
    });
  }
  return out;
}

export function packCourse(module: CourseModule, at = Date.now()): string {
  const pack: Pack = {
    kind: 'semester.course',
    version: PACK_VERSION,
    made: at,
    from: module.course.source ?? '',
    module: justTheCourse(module),
  };
  return JSON.stringify(pack, null, 2);
}

/** A filename a person can find again in a downloads folder. */
export function packName(code: string): string {
  const stem =
    code
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .split(/\s+/)
      .filter(Boolean)
      .join('-') || 'course';
  return `${stem}.semester.json`;
}

export interface Opened {
  module: CourseModule | null;
  /** What is wrong with it, in a sentence, or empty. */
  trouble: string;
  made: number;
  from: string;
  /** Deadlines in the file that could not be read. Nearly always zero. */
  dropped: number;
}

const NOTHING: Opened = { module: null, trouble: '', made: 0, from: '', dropped: 0 };

/**
 * A file back into a course.
 *
 * Every failure gets its own sentence. "Could not read that file" is true of
 * a backup opened by mistake, a pack from a newer version, and a syllabus PDF
 * dropped on the wrong control, and those need three different things done
 * about them.
 */
export function readPack(text: string): Opened {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ...NOTHING, trouble: 'That is not a course file — it is not JSON at all.' };
  }

  const p = raw as Partial<Pack> & { courses?: unknown };
  if (p?.kind !== 'semester.course') {
    // The commonest wrong file by far, and it has its own screen to go to.
    if (Array.isArray(p?.courses)) {
      return {
        ...NOTHING,
        trouble:
          'That is a whole backup, not a single course. Open it under Take it with you → Bring one back.',
      };
    }
    return { ...NOTHING, trouble: 'That file is not a shared course.' };
  }

  if (typeof p.version !== 'number' || p.version > PACK_VERSION) {
    return {
      ...NOTHING,
      trouble: 'That course was shared by a newer version of the app than this one.',
    };
  }

  const m = p.module as Partial<CourseModule> | undefined;
  if (!m || typeof m !== 'object') {
    return { ...NOTHING, trouble: 'That course file has no course in it.' };
  }
  const course = m.course as CourseModule['course'] | undefined;
  if (!course?.id || !course.code) {
    return { ...NOTHING, trouble: 'That course file is missing its course code.' };
  }
  if (!Array.isArray(m.items) || !m.guide) {
    return {
      ...NOTHING,
      trouble: `${course.code} came through without its deadlines or its guide. Ask for it again.`,
    };
  }

  const tidied = tidyItems(m.items, course.id);

  return {
    // Rebuilt through the same boundary on the way in, so a hand-edited file
    // cannot smuggle a field the app was not expecting to store.
    module: justTheCourse({
      ...(m as CourseModule),
      items: tidied.items,
      schedule: tidySchedule(m.schedule),
      planMinutes: typeof m.planMinutes === 'string' ? m.planMinutes : '45 min',
      frameLabel: typeof m.frameLabel === 'string' ? m.frameLabel : 'Exam frames',
    }),
    trouble: '',
    made: typeof p.made === 'number' && Number.isFinite(p.made) ? p.made : 0,
    from: typeof p.from === 'string' ? p.from : '',
    dropped: tidied.dropped,
  };
}

/**
 * The kicker line for the import preview: what is in the file.
 *
 * The same shape as the one a generated course gets — units, cards,
 * obligations — because it lands in the same slot, which is a short uppercase
 * strip and not a place for three sentences. The three sentences go in the
 * list underneath, where the reasons a generated course was adjusted appear.
 */
export function packSummary(o: Opened): string {
  const m = o.module;
  if (!m) return '';
  const units = m.guide?.units?.length ?? 0;
  const cards = (m.guide?.units ?? []).reduce((n, u) => n + (u.cards?.length ?? 0), 0);
  return `Shared file · ${units} units, ${cards} cards, ${m.items.length} dated obligations.`;
}

/**
 * What to say about where a shared course came from.
 *
 * Never silent, even when the pack carries nothing useful: a course that
 * arrived from another person is a different thing from one the student
 * generated themselves, and the difference matters on the day a date is wrong.
 */
export function provenance(o: Opened, now = Date.now()): string {
  const bits = ['This came from someone else, not from your own syllabus.'];
  if (o.from) bits.push(`It was generated from ${o.from}.`);
  if (o.made > 0) {
    const days = Math.floor((now - o.made) / 86_400_000);
    if (days >= 1) bits.push(`Shared ${days} ${days === 1 ? 'day' : 'days'} ago.`);
  }
  if (o.dropped > 0) {
    bits.push(
      `${o.dropped} ${o.dropped === 1 ? 'deadline' : 'deadlines'} in the file could not be read and ${
        o.dropped === 1 ? 'is' : 'are'
      } not here.`,
    );
  }
  bits.push('Check the dates against your own section before you rely on them.');
  return bits.join(' ');
}
