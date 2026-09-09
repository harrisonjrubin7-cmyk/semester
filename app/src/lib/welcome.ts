/**
 * The sentence the soft shell opens with.
 *
 * The handoff asks for a headline built from real data — "You have 4 courses,
 * 23 deadlines, and 39 days until your first final." It is the right thing to
 * open with and the easy thing to get wrong: the onboarding this replaces
 * used to tell a new account it had found 38 obligations across four courses
 * before anything had been uploaded, which is a poor first thing for an app
 * to say about a semester it is asking to be trusted with.
 *
 * So every clause here is dropped when the number behind it is not there, and
 * an account with nothing in it gets a sentence about what will happen rather
 * than a sentence about four courses it does not have.
 */

import type { Catalog } from '../data/catalog';
import { datedItems } from './select';
import { isExam } from './runway';

/** The clauses, in order, for whatever is actually known. */
export function welcomeLine(catalog: Catalog, now: Date): string {
  const courses = catalog.courses.length;
  if (courses === 0) return 'Nothing loaded yet. Add a syllabus and the semester comes back.';

  const items = datedItems(catalog, now);
  const ahead = items.filter((i) => !i.isPast);
  const exam = ahead.find(isExam);

  const bits = [`${courses} ${courses === 1 ? 'course' : 'courses'}`];
  if (ahead.length > 0) {
    // "ahead" is not padding. The step cards under this headline say how many
    // dated obligations the app read out of the syllabi — the whole term —
    // and this counts the ones that have not gone by. Two different true
    // numbers side by side read as one of them being wrong unless the smaller
    // one says what it is counting.
    bits.push(`${ahead.length} ${ahead.length === 1 ? 'deadline' : 'deadlines'} ahead`);
  }
  if (exam) {
    // "in 0 days" is not a sentence anybody wants to read on the morning of a
    // final, and neither is "in 1 days".
    bits.push(
      exam.daysAway <= 0
        ? 'and your first final today'
        : `and ${exam.daysAway} ${exam.daysAway === 1 ? 'day' : 'days'} until your first final`,
    );
  }

  // Two clauses read as a list without a comma; three need one, and the last
  // already carries its "and".
  const said =
    bits.length <= 2 ? bits.join(' and ') : `${bits.slice(0, -1).join(', ')}, ${bits[bits.length - 1]}`;
  return `You have ${said}.`;
}

/**
 * What the lead paragraph says under it.
 *
 * One claim, and one that is true on a first run: this is what the app has
 * read, and nothing here is permanent.
 */
export function welcomeLead(catalog: Catalog): string {
  return catalog.courses.length === 0
    ? 'A syllabus goes in as a PDF, a Word file or pasted text. Everything below happens after that, and none of it is permanent.'
    : 'All of it came out of the PDFs your professors posted, and none of it is permanent — every date, weighting and room can be corrected.';
}

/**
 * "Good morning" and its two siblings, for the screen the app opens on.
 *
 * The hours are the plain ones — morning until noon, afternoon until six,
 * evening after that — with no fourth bucket for the small hours. A student
 * reading this at 2am is working, not waking up, and "good night" would be the
 * app telling them to stop.
 */
export function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}
