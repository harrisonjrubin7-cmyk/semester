import { budget, hasPolicy, tally } from './attend';
import { extrasFor, standing } from './grades';
import { datedItems } from './select';
import type { Catalog } from '../data/catalog';
import { liveGuide } from './live';
import type { State } from '../state/shape';
import type { Mode } from './mode';

/**
 * What leaves this device when a question is asked, and nothing else.
 *
 * This is the security boundary of the assistant and the only file that
 * decides it. Everything sent is built here, from an allowlist written out
 * below; nothing else in the app may add to an outgoing request. That
 * arrangement is the point — a boundary spread across five screens is a
 * boundary nobody can check, and this one is meant to be read in one sitting
 * and disagreed with.
 *
 * ## Never, under any circumstance
 *
 * - **API keys and tokens of any kind.** They are not read here. This file
 *   does not import `claude.ts` or `connect.ts`, so it has nothing to leak.
 * - **Note and draft bodies**, unless the question names that note. A note is
 *   the most private thing in this app and most of them have nothing to do
 *   with the question being asked.
 * - **Anything from `people` or `letters`**, unless the question names that
 *   person. These are other people's names and what was said about them, and
 *   they are the one category where an accident is not the student's own
 *   business to forgive.
 *
 * ## The allowlist, and why it is a list rather than a filter
 *
 * `PICK` names every field that may go, one line each, with what it is for. A
 * denylist would let a field added next year travel by default, and the field
 * added next year is exactly the one nobody thought about.
 */

/**
 * Every field that may leave, and what it is for.
 *
 * Read this list rather than the code below it: the code assembles what this
 * names and does not reach past it. Adding a line here is the whole of adding
 * a field, and it should be hard to do without noticing.
 */
export const PICK = {
  always: [
    'The screen registry — label, blurb, keywords, group. What stops it inventing a feature.',
    'The shortcut list.',
    "Today's date and the active term.",
    'Course codes and titles. Not their contents.',
    'Which screen the question was asked from.',
    /*
     * What that screen says it is showing, from its own provider.
     *
     * The line that makes "what do I need on the BUS final" answerable
     * without naming BUS. It is `always` rather than `onDemand` because the
     * screen is the question's context whether or not the words say so —
     * somebody looking at Grades and typing "how am I doing" means these
     * grades.
     *
     * Bounded at about eight thousand characters by `ai/shape.ts`, which also
     * writes into the text how many rows it had to drop, so an answer that
     * counts from the list knows it was not given all of it. Every provider
     * is a pure function of state and none of them may reach past the rules
     * below — see `ai/providers/index.ts`, and the test there that seeds a
     * note body, a person and a letter and asserts none of the fifty-four
     * sends any of them.
     */
    'What the current screen says it is showing — its summary, its visible rows after filters, and what it is focused on.',
  ],
  onDemand: [
    'Deadlines in a window the question names — title, date, weight. Never the quote.',
    'Grades and weights for a course the question names.',
    'Attendance counts and the policy for a course the question names.',
    'Unit names and mastery for a course the question names.',
    /*
     * The cards, and only under all three conditions at once.
     *
     * This line said "not the cards" until the screen's own behaviour was
     * measured against it and did not match: `ask` existed to answer from the
     * course guide, and cutting that off would have been a narrowing rather
     * than the widening this work is. So it is allowed, bounded, and written
     * down — an allowlist that does not describe what happens is worse than
     * none, because it is trusted.
     */
    'Study cards for a course, capped at about 4,000 characters, when the question names that one course and is about its material.',
  ],
  never: [
    'API keys, of any provider.',
    'Auth tokens, refresh tokens, session data.',
    'Note bodies, draft bodies, essay text.',
    'Anything in `people` or `letters`.',
    'File contents.',
    'Anything from another student — the app holds none, and this is where it would leak from.',
  ],
} as const;

export interface Built {
  /** What actually goes. */
  text: string;
  /** Every field it drew on, so a screen can show what it sent. */
  used: string[];
}

/** Does the question name this course, by code or by name? */
function names(question: string, code: string, title: string): boolean {
  const q = question.toLowerCase();
  if (q.includes(code.toLowerCase())) return true;
  // "econ", "psci" — the half of a code people say out loud.
  const [subject, number] = code.split(/\s+/);
  if (subject && subject.length >= 3 && q.includes(subject.toLowerCase())) return true;
  if (number && q.includes(number)) return true;
  return title.length > 6 && q.includes(title.toLowerCase());
}

/**
 * How much of a guide may travel with one question, in characters.
 *
 * About four thousand — a dozen full answers or thirty short ones. Enough for
 * an answer to be grounded in the course's own material, and far short of
 * sending the guide, which is the thing the question is a shortcut past.
 */
const CARD_BUDGET = 4000;

/** The window a question asks about, in days from today. */
function windowOf(question: string): number {
  const q = question.toLowerCase();
  if (/\btoday\b|\btonight\b/.test(q)) return 1;
  if (/\btomorrow\b/.test(q)) return 2;
  if (/\bthis week\b|\bmonday|tuesday|wednesday|thursday|friday|saturday|sunday\b/.test(q)) return 8;
  if (/\bnext week\b|\bfortnight\b/.test(q)) return 15;
  if (/\bthis month\b/.test(q)) return 31;
  if (/\bterm\b|\bsemester\b/.test(q)) return 200;
  return 15;
}

export function build(
  question: string,
  mode: Mode,
  state: State,
  catalog: Catalog,
  now: Date,
  screen: string,
  /**
   * What the screen says it is showing, already rendered and already capped.
   *
   * Passed in rather than assembled here, because a provider needs the whole
   * store and this file is deliberately the only thing that decides what
   * *leaves*. The split is: `ai/providers` decides what a screen is showing,
   * this decides whether it may go. Both are needed and they are different
   * questions.
   */
  onScreen = '',
): Built {
  const used: string[] = [];
  const parts: string[] = [];

  // Always. The registry is first because it is the boundary on what the
  // answer may claim the app does.
  parts.push(`Today is ${now.toDateString()}. The active term is ${state.term}.`);
  parts.push(`The student is on the "${screen}" screen.`);
  used.push("today's date", 'the active term', 'which screen you are on');

  if (onScreen.trim()) {
    parts.push(onScreen.trim());
    used.push('what this screen is showing');
  }

  /**
   * Whether the screen has already described this course.
   *
   * Found by reading a whole payload by eye, which is what that exercise is
   * for: asking "what do I need on the BUS final" from Grades sent BUS 1600's
   * six components twice — once from the screen's provider and once from the
   * block below. Six hundred wasted characters is the small half.
   *
   * The large half is that the two are computed by different paths. The
   * provider calls `standing` with the attendance extras the Grades screen
   * passes; this file calls it without them. They agreed on the payload I
   * read, and they will not agree on a course whose syllabus weights
   * attendance — and then the model has two different running grades for one
   * course and no way to choose.
   *
   * So the screen wins where it has spoken. It is the more specific of the
   * two and it is what the student is looking at.
   */
  const already = (code: string) => onScreen.includes(code);

  if (catalog.courses.length > 0) {
    parts.push(
      `Their courses:\n${catalog.courses
        .map((c) => `- ${c.code} — ${catalog.byId[c.id]?.name ?? ''}`)
        .join('\n')}`,
    );
    used.push('your course codes and titles');
  }

  /*
   * Nothing else travels for a general question.
   *
   * "Explain price elasticity" needs no deadlines, no grades and no
   * attendance, and sending them anyway is both a cost and a leak nobody
   * asked for. The registry and the date are enough for an answer to know
   * where it is.
   */
  if (mode !== 'grounded') return { text: parts.join('\n\n'), used };

  const days = windowOf(question);
  const named = catalog.courses.filter((c) => names(question, c.code, catalog.byId[c.id]?.name ?? ''));
  // A question that names no course is about all of them; one that names a
  // course is about that one, and the rest stay here.
  const about = named.length > 0 ? named : catalog.courses;

  const due = datedItems(catalog, now)
    .filter((i) => !i.isPast && i.daysAway <= days && about.some((c) => c.id === i.c))
    .filter((i) => !state.done[i.id])
    .slice(0, 40);

  if (due.length > 0) {
    parts.push(
      `Due in the next ${days} days:\n${due
        .map((i) => `- [${i.id}] ${catalog.byId[i.c]?.code} · ${i.title} · ${i.dueShort}${i.weight ? ` · ${i.weight}` : ''}`)
        .join('\n')}`,
    );
    used.push(`your deadlines for the next ${days} days`);
  }

  for (const course of about) {
    const full = catalog.byId[course.id];
    if (!full) continue;

    // Grades, only where something has been entered. An empty table teaches
    // the answer nothing and still costs a paragraph.
    // The extras every other caller uses. This file used to leave the
    // attendance pair out and the comment below explains what that cost; see
    // `extrasFor` in `lib/grades.ts`, which is now the only place they are
    // assembled.
    const s = standing(full, state.grades, extrasFor(course.id, state));
    const graded = s.rows.filter((r) => r.score !== null);
    if (graded.length > 0 && !already(course.code)) {
      parts.push(
        `${course.code} grades — ${graded.length} of ${s.rows.length} components back, currently ${Math.round(s.current ?? 0)}%, ${Math.round(s.remaining)}% still ungraded:\n${s.rows
          .map((r) => `- ${r.what} · ${r.weight}%${r.score !== null ? ` · ${r.score}` : ' · not back'}`)
          .join('\n')}`,
      );
      used.push(`${course.code} grades and weights`);
    }

    const policy = state.attendPolicy[course.id];
    const t = tally(state.attendance, course.id);
    if (hasPolicy(policy) && t.marked > 0 && !already(course.code)) {
      const b = budget(policy, t);
      parts.push(
        `${course.code} attendance — ${t.present} present, ${t.absent} absent, ${t.excused} excused across ${t.marked} marked. Policy allows ${policy.allowed}; ${b.left} left, ${b.cost} points lost so far.`,
      );
      used.push(`${course.code} attendance`);
    }

    /*
     * Unit names and how cold each is. The cards only when asked for.
     *
     * A guide is thousands of words, and the screen used to append the whole
     * of the open one — cards, answers and all — after everything this file
     * had carefully selected. An eleven-thousand-character payload for "what
     * is due this week", most of it flashcards. The allowlist is only a
     * boundary if it is the only way through, so the guide comes through here
     * or not at all.
     */
    // The guide as it stands, not as it was compiled. This read the module
    // content, so the one file that decides what may leave was sending a guide
    // with the reading you added last week missing from it — and the answer
    // came back confidently built on everything except that reading.
    const guide = liveGuide(catalog, course.id, state.updates, state.reviews);
    const aboutStudy = /\bstud|revis|unit|topic|cold|weak|know|understand|explain\b/i.test(question);
    if (guide && guide.units.length > 0 && aboutStudy) {
      parts.push(
        `${course.code} units:\n${guide.units.map((u) => `- ${u.name} (${u.mastery}% mastered)`).join('\n')}`,
      );
      used.push(`${course.code} unit names`);

      // The cards themselves, for a question that names this one course and
      // is plainly about its material. Capped, because a whole guide is not
      // context — it is the thing the question is a shortcut past.
      if (named.length === 1) {
        /*
         * Capped by size, not by count.
         *
         * Forty cards was the first cap and it was the wrong unit: an answer
         * in this app runs from forty characters to four hundred, so forty
         * cards came to ten thousand characters for one question. A count is
         * a proxy for size and a bad one.
         */
        const cards: string[] = [];
        let room = CARD_BUDGET;
        for (const unit of guide.units) {
          for (const c of unit.cards.slice(0, 3)) {
            const line = `- ${unit.name}: ${c.q} — ${c.a}`;
            if (line.length > room) continue;
            room -= line.length;
            cards.push(line);
          }
        }
        if (cards.length > 0) {
          parts.push(`${course.code} material:\n${cards.join('\n')}`);
          used.push(`${course.code} study material`);
        }
      }
    }
  }

  return { text: parts.join('\n\n'), used };
}
