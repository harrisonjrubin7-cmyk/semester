/**
 * A school's own records, turned into a course this app can hold.
 *
 * The completion plan's chain runs Course → Syllabus → **Calendar → Study**,
 * and for the whole of Phase 1 the first two lived on the university gateway
 * and the last two lived in the app with nothing between them. A student
 * enrolled in the sandbox course had two published assignments whose deadlines
 * the app could not see — which is exactly the shape Appendix A calls the
 * dominant finding in this codebase: an engine that exists, and a place it has
 * not been connected to.
 *
 * ## What this deliberately does not do
 *
 * It does not invent. A record with no machine-readable date produces no
 * calendar entry rather than a guessed one; a course with no published
 * syllabus says its meeting pattern is not published rather than leaving the
 * field blank for something else to fill in. The app's own premise is that a
 * deadline belongs to the document it came from, and the same rule applies
 * when the document is a school's record.
 *
 * ## And it says where it came from, on every part of it
 *
 * A course from a school sits in the same list as four the student imported
 * themselves. The plan's standing rule is that nothing is ever "a placeholder
 * success state presented as real", so the institution's name is on the
 * course, and on every deadline it carries — a student meeting one of these in
 * Today has to be able to tell it from their own.
 */

import type { UniversityRecord } from '@semester/institution';
import type { CourseModule, Item } from './types';

/**
 * A school course's id, kept in its own namespace.
 *
 * `school-` in front, because an institution's record id is theirs and this
 * app's course ids are slugs of course codes — nothing stops a school from
 * using `econ` for something. The prefix is what guarantees an import can
 * never land on top of a course the student built.
 */
export const schoolCourseId = (recordId: string) => `school-${recordId}`;

/** What a detail says, by its label, or an empty string. */
const detail = (record: UniversityRecord, label: string) =>
  record.details.find((d) => d.label === label)?.value ?? '';

/**
 * The code and name out of a record's title.
 *
 * Adapters write `MARK · CODE — Name`, which is a display string, so this
 * reads what it can and hands back the whole title as the name when it cannot
 * — a course called by its full title is right, and a course called by half a
 * regular expression is not.
 */
function nameOf(title: string): { code: string; name: string } {
  const withoutMark = title.replace(/^[^·]+·\s*/, '').trim();
  const split = withoutMark.match(/^(.+?)\s+—\s+(.+)$/);
  return split ? { code: split[1].trim(), name: split[2].trim() } : { code: withoutMark, name: withoutMark };
}

/** Every dated obligation a record carries, as this app's items. */
function itemsFrom(courseId: string, institution: string, records: UniversityRecord[]): Item[] {
  const items: Item[] = [];
  for (const record of records) {
    const { name } = nameOf(record.title);
    record.dates?.forEach((date, i) => {
      const at = new Date(date.at);
      if (Number.isNaN(at.getTime())) return;
      items.push({
        // Stable, so a re-sync updates a deadline rather than adding a second
        // copy of it beside the first.
        id: `${courseId}:${record.id}:${i}`,
        c: courseId,
        title: name,
        kind: date.what,
        /*
         * The school's day, not the reader's.
         *
         * `Item` is month/day/year as the document words it, with no zone on
         * it, and these sync between a student's devices — so a deadline that
         * read 2 October on a laptop in Nashville and 3 October on a phone
         * halfway round the world would be two records of one fact. The
         * school said 2 October; the app stores 2 October.
         *
         * The first version of this read the date with local getters and the
         * time with `toISOString`, which is a single item carrying a UTC time
         * beside a local day. `npm run test:zones` caught it in
         * Pacific/Kiritimati, fourteen hours ahead, which is the entire reason
         * that gate is in the list.
         */
        month: at.getUTCMonth(),
        day: at.getUTCDate(),
        year: at.getUTCFullYear(),
        dueTime: at.toISOString().slice(11, 16),
        weight: detail(record, 'Worth'),
        where: '',
        detail: `${record.status} · from ${institution}`,
        // Not a syllabus quote: this came off a record rather than out of a
        // document, and saying so is the difference between a citation and a
        // thing that looks like one. `source` names the school's record for
        // the same reason — everywhere else in this app it names the file a
        // deadline was lifted from, and a blank one would read as "nobody
        // knows" rather than "the school said so".
        quote: record.summary,
        source: `${institution} · ${record.id}`,
      });
    });
  }
  return items;
}

/**
 * One course, from the records a school returned for it.
 *
 * `syllabi` and `work` are whatever the caller read out of the `courses` and
 * `assignments` areas; both may be empty, and the course is still a course.
 */
export function schoolCourse(
  course: UniversityRecord,
  syllabi: UniversityRecord[],
  work: UniversityRecord[],
): CourseModule {
  const id = schoolCourseId(course.id);
  const { code, name } = nameOf(course.title);
  const institution = detail(course, 'Institution') || 'a school';
  const syllabus = syllabi.find((s) => s.id === 'syllabus');
  return {
    course: {
      id,
      code,
      name,
      prof: detail(course, 'Taught by'),
      email: '',
      meets: syllabus ? detail(syllabus, 'Meets') : 'Not published — this course has no syllabus yet',
      room: '',
      credits: '',
      source: institution,
      grading: [],
    },
    items: itemsFrom(id, institution, work),
    // A meeting pattern is a sentence here, not a structure — the contract has
    // no recurring block, and turning prose into one would be the app deciding
    // when a class meets. It is shown, not scheduled.
    schedule: [],
    guide: {
      code,
      name,
      blurb: course.summary,
      source: institution,
      mastery: 0,
      audio: false,
      // Study material belongs to a course somebody built. A school's records
      // carry deadlines, not units, and pretending otherwise is the
      // placeholder this plan forbids.
      units: [],
      terms: [],
    },
    planMinutes: '20 min',
    frameLabel: `${code} · from ${institution}`,
  };
}

/**
 * This course's deadlines, brought up to date with what the school now says.
 *
 * The school is the source of truth for the work it set, and is not the source
 * of truth for what the student has done about it. Three rules fall out of
 * that, and the middle one is the one worth arguing:
 *
 *  - **A deadline the school has withdrawn goes.** It is not the student's to
 *    keep; nobody is being marked on it.
 *  - **A date the student moved survives a re-sync that did not move it.**
 *    `Item.movedFrom` exists because "what must not happen is the app quietly
 *    forgetting that it now disagrees with the document it is showing
 *    underneath" — a professor says it in class, an announcement lands, the
 *    record was simply wrong. A sync that silently put the date back would be
 *    that same fault wearing a network request.
 *  - **Unless the school moved it too**, in which case the school wins and the
 *    move is dropped. A move is a correction *to a date*; once that date is
 *    gone the correction is to something that no longer exists, and keeping it
 *    would leave somebody holding a deadline their course does not have.
 *
 * Anything the student added themselves stays, untouched. An id this function
 * has never issued is not its business.
 */
export function resync(mine: Item[], fromSchool: Item[]): Item[] {
  const theirs = new Map(fromSchool.map((i) => [i.id, i]));
  const ours = new Map(mine.map((i) => [i.id, i]));
  const isSchools = (id: string) => id.includes(':');

  const kept = mine
    .filter((i) => !isSchools(i.id) || theirs.has(i.id))
    .map((i) => {
      const now = theirs.get(i.id);
      if (!now) return i;
      // What the school last said this was due, before the student moved it.
      const was = i.movedFrom ?? { month: i.month, day: i.day, year: i.year };
      const schoolMoved = was.month !== now.month || was.day !== now.day || was.year !== now.year;
      return schoolMoved
        ? { ...now }
        : { ...now, month: i.month, day: i.day, year: i.year, ...(i.movedFrom ? { movedFrom: i.movedFrom } : {}) };
    });

  return [...kept, ...fromSchool.filter((i) => !ours.has(i.id))];
}
