/**
 * Which tool is worth opening tonight, and why.
 *
 * Study's Tools tab is generated from the directory, which was the right fix
 * for the problem it had — six features reachable only through search, and a
 * hand-written list that went stale the day the seventh was added. But a
 * generated list is still a list: thirteen identical cards in whatever order
 * the registry happens to hold them, saying what each tool *is* and never what
 * it is *for, now*. "Practice paper" and "Draw it" look equally likely at
 * eleven at night four days before a midterm, and only one of them is.
 *
 * The app already knows the difference. It holds every deadline with its kind,
 * its course and its date. So this file reads the fortnight in front of the
 * student and names the two or three tools that fortnight asks for, each with
 * the deadline it came from — the same discipline as `lib/revise.ts`: a
 * recommendation with no reason is an instruction, and an instruction from
 * software about how to spend an evening is worth nothing.
 *
 * ## What it will not do
 *
 * It will not invent a reason. Every rule below fires off a real row in the
 * catalogue and quotes it, so a suggestion can be checked against the
 * syllabus. When nothing in the fortnight asks for a tool, nothing is
 * suggested and the tab is the plain directory it always was — which is the
 * honest state and the common one in week three.
 *
 * It will not put coursework through `essay`. That screen is fenced off from
 * courses on purpose (see `WHY.essay` in `lib/everything.ts`), and a rule that
 * pointed a paper at it would quietly undo the fence.
 */

import type { CourseId, Screen } from './types';

/** A deadline as this file needs it: what, whose, what kind, and how far off. */
export interface Coming {
  id: string;
  title: string;
  /** "Exam", "Quiz", "Paper", "Problem set" — the syllabus's own word. */
  kind: string;
  code: string;
  courseId: CourseId;
  daysAway: number;
  /** How the screen would say when: "Friday", "Sep 30". */
  when: string;
}

export interface Suggestion {
  screen: Screen;
  /** One sentence naming the deadline this came from and what the tool does. */
  why: string;
  /** The course to open the tool on, where the tool is bound to one. */
  courseId?: CourseId;
  /** Higher is more worth opening now. Never shown. */
  score: number;
}

/** Deadlines that are a test. Kept in step with `TESTS` in `lib/select.ts`. */
const TESTS = new Set(['Exam', 'Midterm', 'Quiz', 'Final']);

/** Deadlines you hand in as prose. */
const WRITTEN = new Set(['Paper', 'Reflection', 'Essay', 'Response', 'Memo']);

/** How many suggestions the tab shows before it is a list again. */
export const AT_MOST = 3;

/** A deadline further off than this is not tonight's business. */
const HORIZON = 14;

/**
 * Nearness, 0–1, over a window.
 *
 * Linear and bounded, for the same reason `testWeight` is: the thing due
 * tomorrow should come first, and the thing due in nine days should still
 * appear rather than being rounded away.
 */
const near = (days: number, window: number) =>
  Math.max(0, Math.min(1, (window - Math.max(days, 0)) / window));

/**
 * A deadline's title, short enough to sit inside a sentence.
 *
 * Quoted titles are what makes a reason checkable, and a syllabus title can be
 * a whole question — "Reflection #2 — Are elite athletes super-humans?" — which
 * pushes the part of the sentence that says what the tool does off the card.
 * Cut at a word boundary, with an ellipsis, so it is visibly a title that has
 * been shortened rather than one that is wrong.
 */
export function shortTitle(title: string, max = 42): string {
  const t = title.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s—–-]+$/, '')}…`;
}

/** "in 3 days", "today", "tomorrow" — said the way a person would. */
export function inDays(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

/** A title that names data work rather than an essay. */
const DATA = /\b(data|dataset|csv|regression|statistic|statistics|empirical|survey results)\b/i;

/** A title that names something you stand up and present. */
const TALK = /\b(present|presentation|slides|deck|pitch|talk)\b/i;

/** A title that names a document rather than an essay — the shape Write makes. */
const DOCUMENT = /\b(memo|report|brief|briefing|handout|summary|one-?pager|proposal|case study)\b/i;

/** A title that is arithmetic: something with a table and a total in it. */
const SUMS = /\b(budget|spreadsheet|worksheet|model|forecast|calculation|calculations|table|figures|financials?)\b/i;

/**
 * The two or three tools this fortnight asks for.
 *
 * Every rule is a real row and a real reason. Where two rules name the same
 * tool the stronger one wins, so a week with three papers in it does not
 * produce three identical cards saying "Work on it".
 */
export function suggest(
  /** Outstanding deadlines, soonest first — done ones already filtered out. */
  coming: Coming[],
  /** What the student has kept, for the rules that only make sense with some. */
  held: { sources: number } = { sources: 0 },
): Suggestion[] {
  const out: Suggestion[] = [];
  const add = (s: Suggestion) => {
    if (s.score > 0) out.push(s);
  };

  for (const it of coming) {
    if (it.daysAway > HORIZON) break; // sorted, so everything after is further
    const soon = near(it.daysAway, HORIZON);
    const test = TESTS.has(it.kind);
    const written = WRITTEN.has(it.kind);
    const kind = it.kind.toLowerCase();
    const named = shortTitle(it.title);

    if (test) {
      add({
        screen: 'exam',
        courseId: it.courseId,
        score: 3 + soon * 2,
        why: `${it.code} ${kind} ${inDays(it.daysAway)} — sit a paper against a clock and be marked, which recognising a card is not.`,
      });
      // Counting weeks back from a test needs weeks to count. Two days before
      // one, a plan is a way of not revising.
      if (it.daysAway >= 3) {
        add({
          screen: 'runway',
          courseId: it.courseId,
          score: 2 + near(it.daysAway, 35) * 1.5,
          why: `${it.code} ${kind} ${inDays(it.daysAway)} — the weeks before it, counted backwards, and what stands in the way.`,
        });
      }
    }

    if (written || it.kind === 'Problem set' || it.kind === 'Group work') {
      add({
        screen: 'work',
        courseId: it.courseId,
        score: 3 + soon * 1.5,
        why: `“${named}” due ${it.when} — the brief broken into a rubric, a plan and dates.`,
      });
    }

    if (it.kind === 'Problem set') {
      add({
        screen: 'solve',
        courseId: it.courseId,
        score: 2.8 + soon,
        why: `“${named}” due ${it.when} — the method worked on other numbers, then your own attempt checked.`,
      });
    }

    // Proofreading is for a draft, so it comes up when there is plausibly one
    // — near the end, not the week it was set.
    if (written && it.daysAway <= 3) {
      add({
        screen: 'proof',
        score: 2.6 + soon,
        why: `“${named}” due ${it.when} — the typo you cannot see is the one you have read six times.`,
      });
    }

    if (written && it.daysAway <= 10 && held.sources > 0) {
      add({
        screen: 'sources',
        score: 1.6 + soon,
        why: `${held.sources} kept ${held.sources === 1 ? 'reading' : 'readings'}, and “${named}” wants citations — out as BibTeX.`,
      });
    }

    if (DATA.test(it.title)) {
      add({
        screen: 'analyse',
        courseId: it.courseId,
        score: 2.8 + soon,
        why: `“${named}” due ${it.when} — the statistics computed, then explained.`,
      });
    }

    if (TALK.test(it.title)) {
      add({
        screen: 'deck',
        courseId: it.courseId,
        score: 3 + soon,
        why: `“${named}” due ${it.when} — a real PowerPoint file, from a unit you already have.`,
      });
    }

    /*
     * The two making screens, off the title rather than the kind.
     *
     * A syllabus calls the same kind of thing a Paper and a Memo, and the two
     * want different tools: one is prose, which is `work` and `proof`; the
     * other is a document with headings and a table in it, which nothing
     * suggested before this existed. Same for the arithmetic — a budget or a
     * set of figures is a sheet, and nobody thinks to look for one under a
     * study app.
     */
    if (DOCUMENT.test(it.title)) {
      add({
        screen: 'write',
        courseId: it.courseId,
        score: 2.9 + soon,
        why: `“${named}” due ${it.when} — headings, a table and an equation, out as a Word file.`,
      });
    }

    if (SUMS.test(it.title)) {
      add({
        screen: 'sheet',
        courseId: it.courseId,
        score: 2.7 + soon,
        why: `“${named}” due ${it.when} — a grid that adds itself up, out as a real Excel file.`,
      });
    }
  }

  // Strongest reason per tool, then the strongest tools.
  const best = new Map<Screen, Suggestion>();
  for (const s of out) {
    const had = best.get(s.screen);
    if (!had || s.score > had.score) best.set(s.screen, s);
  }
  return [...best.values()].sort((a, b) => b.score - a.score).slice(0, AT_MOST);
}
