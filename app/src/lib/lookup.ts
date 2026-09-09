/**
 * The things the assistant may look up for itself, and nothing else.
 *
 * ## The gap this closes
 *
 * `lib/context.ts` decides what travels with a question, and it decides it
 * once, before the question has been read by anything that understands it. It
 * does that from keywords: does the question name a course, does it say
 * "week", does it contain one of a dozen study words. Those heuristics are
 * good and they are still the first thing that happens — most questions are
 * answered from what they pull, with no round trip at all.
 *
 * But a heuristic that misses leaves the model with nothing and no way to ask.
 * "What did that card about opportunity cost say" names no course and none of
 * the study words, so the guide did not travel, so the answer was "I do not
 * have your cards" — about material sitting on the same device, two hundred
 * milliseconds away. The student then rephrases the question until the regex
 * matches, which is a bad thing to teach somebody to do.
 *
 * So there is a second door. These tools run *when the model asks for them*,
 * against the same state, and their answers go back in a second request. The
 * heuristic still opens the first door; this one exists for when it guessed
 * wrong.
 *
 * ## Read-only, always, by construction
 *
 * Nothing in this file dispatches an action, writes to storage or touches the
 * network. Every function takes state and returns a string. That is the whole
 * safety argument and it is meant to be checkable by reading the imports:
 * there is no `dispatch` here to call.
 *
 * This is the opposite arrangement to `lib/tools.ts` and the two must not be
 * confused. A tool there is a *proposal* — it changes something, so it becomes
 * a card with a button and the student decides, and nothing is ever returned
 * to the model. A tool here *reads* — it changes nothing, so waiting for a tap
 * would be friction protecting nobody, and the answer goes straight back so
 * the model can use it. Risk decides which side a tool lives on, and the two
 * sets never overlap: `runLookups` refuses a name it does not own.
 *
 * ## Still inside the allowlist
 *
 * These reach exactly the categories `PICK.onDemand` already names —
 * deadlines, grades, attendance, units, cards, the student's own tasks and
 * their timetable. What changes is *who asks*: the same fields, for a course
 * the model named rather than a course the question happened to spell. What
 * does not change is `PICK.never`. There is no lookup that reads a note body,
 * a draft, a letter, or anything about another person, and `lookup.test.ts`
 * seeds all four and asserts that no lookup — including the ones asked
 * directly for them — returns any of it.
 */

import { budget, hasPolicy, tally } from './attend';
import { blocksFor, type Catalog } from '../data/catalog';
import type { ToolCall, ToolResult, ToolSpec } from './claude';
import { dateToIso } from './date';
import { standing } from './grades';
import { liveGuide } from './live';
import { datedItems, searchItems, tasksOn } from './select';
import type { State } from '../state/shape';
import type { CourseId } from './types';

/** Everything a lookup may read. State, the catalogue, and the clock. */
export interface Source {
  state: State;
  catalog: Catalog;
  now: Date;
}

/** One lookup, run. */
export interface Looked {
  /** What goes back to the model. */
  result: ToolResult;
  /** One line for the "what it read" list, in the student's language. */
  used: string;
  /** Shown live while it runs: "Looking up your ECON grades". */
  saying: string;
}

/**
 * How much any one lookup may return, in characters.
 *
 * A cap rather than a row count, for the reason `lib/context.ts` gives about
 * its own: an answer in this app runs from forty characters to four hundred,
 * so "thirty rows" is anywhere between one and twelve thousand. Whatever is
 * cut says so in the text, so an answer that counts from a list knows the list
 * was shortened.
 */
const ROOM = 4000;

/** The most lookups one question may run, across every round. */
export const MOST_LOOKUPS = 6;

/** The most times a question may go back for more before the answer is due. */
export const MOST_ROUNDS = 3;

export const LOOKUPS: ToolSpec[] = [
  {
    name: 'find_deadlines',
    description:
      'Look up the student’s real deadlines — syllabus work, exams, readings — with their ids. Use it whenever you need a date, a weight or an id you were not given, rather than saying you do not have their schedule. Leave course empty for all of them.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        course: {
          type: 'string',
          description: 'A course code like "ECON 1010", or empty for every course.',
        },
        days: {
          type: 'number',
          description: 'How far ahead to look, in days. 7 for this week, 120 for the term.',
        },
        query: {
          type: 'string',
          description: 'Words to match against the titles, or empty for everything in the window.',
        },
      },
      required: ['course', 'days', 'query'],
    },
  },
  {
    name: 'read_grades',
    description:
      'Look up what a course is graded on, what has come back, and where the student stands. Use it before doing any arithmetic about a grade — never estimate from memory of the conversation.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: { course: { type: 'string', description: 'The course code.' } },
      required: ['course'],
    },
  },
  {
    name: 'read_attendance',
    description:
      'Look up how many classes the student has missed in one course, and what the syllabus policy allows.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: { course: { type: 'string', description: 'The course code.' } },
      required: ['course'],
    },
  },
  {
    name: 'search_material',
    description:
      'Search a course’s own study guide — its units, cards and definitions — for something the student is asking about. This is their material, not general knowledge: prefer an answer grounded in it, and say when it holds nothing on the topic.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        course: { type: 'string', description: 'The course code, or empty to search all of them.' },
        query: { type: 'string', description: 'What to look for — a term, a topic, a name.' },
      },
      required: ['course', 'query'],
    },
  },
  {
    name: 'read_tasks',
    description:
      'Look up the student’s own to-do list — the things they added themselves, which are not on any syllabus. Use it before proposing to add something, so you do not add a task they already have.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'How far ahead to look, in days. 0 for today only.' },
      },
      required: ['days'],
    },
  },
  {
    name: 'read_timetable',
    description:
      'Look up which classes meet on a given day, and when. Use it for anything about the shape of a day — whether they are free at two, how early the first class is, whether a date is a teaching day at all.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'The ISO date (2026-09-14).' },
        days: {
          type: 'number',
          description: 'How many days from there to read, 1 to 7. 1 for that day alone.',
        },
      },
      required: ['date', 'days'],
    },
  },
];

const NAMES = new Set(LOOKUPS.map((t) => t.name));

/** Whether this call is one of ours, rather than a proposal from `lib/tools.ts`. */
export function isLookup(name: string): boolean {
  return NAMES.has(name);
}

function str(input: Record<string, unknown>, key: string): string {
  const v = input[key];
  return typeof v === 'string' ? v.trim() : '';
}

function num(input: Record<string, unknown>, key: string, fallback: number): number {
  const v = input[key];
  const n = typeof v === 'number' ? v : Number.parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Cut a list of lines to size, and say so where it had to.
 *
 * Silently truncating is the one thing that must not happen: an answer that
 * counts "you have four" from a list that was shortened to four is wrong in a
 * way nobody can see. The sentence at the end is what stops it.
 */
function within(lines: string[], room = ROOM): string {
  const kept: string[] = [];
  let left = room;
  for (const line of lines) {
    if (line.length > left) {
      kept.push(`(${lines.length - kept.length} more, not shown — ask again more narrowly.)`);
      break;
    }
    left -= line.length + 1;
    kept.push(line);
  }
  return kept.join('\n');
}

/**
 * Which course they meant, from whatever they typed.
 *
 * The model is given the codes in the system prompt and mostly repeats one
 * back exactly. Mostly is not always — "econ", "Econ 1010", "principles of
 * macroeconomics" — and a lookup that fails on a spelling is a lookup the
 * model learns not to use. Nothing here guesses between two matches: an
 * ambiguous name comes back as a question rather than a coin toss.
 */
function courseFrom(src: Source, said: string): { id: CourseId; code: string } | null {
  const want = said.trim().toLowerCase();
  if (!want) return null;
  const rows = src.catalog.courses.map((c) => ({
    id: c.id,
    code: c.code,
    name: src.catalog.byId[c.id]?.name ?? '',
  }));
  const exact = rows.find((r) => r.code.toLowerCase() === want);
  if (exact) return exact;
  const loose = rows.filter(
    (r) =>
      r.code.toLowerCase().replace(/\s+/g, '').startsWith(want.replace(/\s+/g, '')) ||
      r.code.toLowerCase().includes(want) ||
      (want.length > 5 && r.name.toLowerCase().includes(want)),
  );
  return loose.length === 1 ? loose[0] : null;
}

/** What to say when a course name matched nothing, with the real list in it. */
function noSuchCourse(src: Source, said: string): string {
  const codes = src.catalog.courses.map((c) => c.code).join(', ');
  return codes
    ? `No course here matches "${said}". The student is taking: ${codes}. Use one of those exactly.`
    : 'This student has no courses in the app yet.';
}

/** A readable day, so a result reads as a sentence rather than a field dump. */
function day(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function findDeadlines(src: Source, input: Record<string, unknown>): { text: string; used: string } {
  const said = str(input, 'course');
  const course = said ? courseFrom(src, said) : null;
  if (said && !course) return { text: noSuchCourse(src, said), used: 'your deadlines' };
  const days = Math.min(400, Math.max(0, Math.round(num(input, 'days', 14))));
  const query = str(input, 'query');

  const base = query
    ? searchItems(src.catalog, src.now, query)
    : datedItems(src.catalog, src.now);
  const rows = base
    .filter((i) => !i.isPast && i.daysAway <= days)
    .filter((i) => !course || i.c === course.id)
    .filter((i) => !src.state.done[i.id]);

  const where = course ? course.code : 'any course';
  const scope = query ? `matching "${query}"` : `in the next ${days} days`;
  if (rows.length === 0) {
    return {
      text: `Nothing outstanding for ${where} ${scope}. (Anything already ticked off is left out.)`,
      used: course ? `${course.code} deadlines` : 'your deadlines',
    };
  }
  return {
    text:
      `${rows.length} outstanding for ${where} ${scope}, soonest first:\n` +
      within(
        rows.map(
          (i) =>
            `- [${i.id}] ${src.catalog.byId[i.c]?.code ?? i.c} · ${i.title} · ${i.dueShort}` +
            `${i.weight ? ` · worth ${i.weight}` : ''}${i.kind ? ` · ${i.kind}` : ''}`,
        ),
      ),
    used: course ? `${course.code} deadlines` : 'your deadlines',
  };
}

function readGrades(src: Source, input: Record<string, unknown>): { text: string; used: string } {
  const said = str(input, 'course');
  const course = courseFrom(src, said);
  if (!course) return { text: noSuchCourse(src, said), used: 'your grades' };
  const full = src.catalog.byId[course.id];
  if (!full) return { text: noSuchCourse(src, said), used: 'your grades' };

  const s = standing(full, src.state.grades, {
    pieces: src.state.pieces,
    drops: src.state.drops,
  });
  const back = s.rows.filter((r) => r.score !== null).length;
  const head =
    back === 0
      ? `${course.code}: nothing has been graded yet. These are the weights the syllabus sets.`
      : `${course.code}: ${back} of ${s.rows.length} components back. Currently ${Math.round(
          s.current ?? 0,
        )}% across what is graded; ${Math.round(s.remaining)}% of the final grade is still to play for.`;
  return {
    text:
      `${head}\n` +
      within(
        s.rows.map(
          (r) =>
            `- ${r.what} · ${r.weight ?? '?'}%${r.extra ? ' (extra credit)' : ''} · ` +
            `${r.score !== null ? `${r.score}` : 'not back'}`,
        ),
      ) +
      (s.pointsOff > 0 ? `\n${s.pointsOff} points already lost to absences.` : ''),
    used: `${course.code} grades and weights`,
  };
}

function readAttendance(src: Source, input: Record<string, unknown>): { text: string; used: string } {
  const said = str(input, 'course');
  const course = courseFrom(src, said);
  if (!course) return { text: noSuchCourse(src, said), used: 'your attendance' };

  const t = tally(src.state.attendance, course.id);
  const policy = src.state.attendPolicy[course.id];
  const counted = `${course.code}: ${t.present} present, ${t.absent} absent, ${t.excused} excused, across ${t.marked} meetings marked.`;
  if (t.marked === 0) {
    return {
      text: `${course.code}: no attendance recorded. The app only knows what the student has marked, so this is not evidence they have not missed anything.`,
      used: `${course.code} attendance`,
    };
  }
  if (!hasPolicy(policy)) {
    return { text: `${counted} No attendance policy is set for this course.`, used: `${course.code} attendance` };
  }
  const b = budget(policy, t);
  return {
    text:
      `${counted} The policy allows ${policy.allowed}; ${b.left} left, ${b.over} over, ` +
      `${b.cost} points of the final grade lost so far.` +
      (policy.note.trim() ? `\nPolicy as the syllabus states it: ${policy.note.trim()}` : ''),
    used: `${course.code} attendance`,
  };
}

function searchMaterial(src: Source, input: Record<string, unknown>): { text: string; used: string } {
  const said = str(input, 'course');
  const course = said ? courseFrom(src, said) : null;
  if (said && !course) return { text: noSuchCourse(src, said), used: 'your study material' };
  const query = str(input, 'query').toLowerCase();
  if (!query) return { text: 'No search text given.', used: 'your study material' };
  /*
   * Whole words, not substrings.
   *
   * "zygomatic arch" matched a card reading "real research sits on the
   * spectrum", because "arch" is inside "research" — and the model was then
   * handed a paragraph of economics as the student's material on facial
   * anatomy, which is worse than finding nothing. A search that reports a
   * false hit is worse than one that reports none, because the answer built
   * on it looks grounded.
   */
  const words = query
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .map((w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'));

  const ids = course ? [course.id] : src.catalog.courses.map((c) => c.id);
  const hits: { line: string; score: number }[] = [];
  for (const id of ids) {
    const code = src.catalog.byId[id]?.code ?? id;
    const guide = liveGuide(src.catalog, id, src.state.updates, src.state.reviews);
    const score = (text: string) => {
      const low = text.toLowerCase();
      if (low.includes(query)) return 3;
      const hit = words.filter((w) => w.test(low)).length;
      // Every word, or nothing. One word out of two is how "zygomatic arch"
      // found a card about research: a partial match on a multi-word query is
      // noise dressed as a result.
      return words.length > 0 && hit === words.length ? 2 : 0;
    };
    for (const unit of guide.units) {
      for (const card of unit.cards) {
        const s = score(`${card.q} ${card.a}`) + (score(unit.name) > 0 ? 1 : 0);
        if (s > 0) hits.push({ score: s, line: `- ${code} · ${unit.name}: ${card.q} — ${card.a}` });
      }
    }
    for (const term of guide.terms ?? []) {
      const s = score(`${term.t} ${term.d}`);
      if (s > 0) hits.push({ score: s + 1, line: `- ${code} · term "${term.t}": ${term.d}` });
    }
    for (const c of guide.cases ?? []) {
      const s = score(`${c.title} ${c.claim} ${c.test} ${c.verdict} ${c.lesson}`);
      if (s > 0) {
        hits.push({
          score: s,
          line: `- ${code} · case "${c.title}": claim — ${c.claim}; test — ${c.test}; verdict — ${c.verdict}`,
        });
      }
    }
  }

  const where = course ? course.code : 'any course';
  if (hits.length === 0) {
    return {
      text:
        `Nothing in ${where}'s study guide matches "${str(input, 'query')}". ` +
        'Say so plainly rather than answering as though it were in their material — but the ' +
        'question can still be answered from general knowledge if it has one.',
      used: `${where} study material`,
    };
  }
  hits.sort((a, b) => b.score - a.score);
  return {
    text: `From ${where}'s own study guide, best match first:\n${within(hits.map((h) => h.line))}`,
    used: `${where} study material`,
  };
}

function readTasks(src: Source, input: Record<string, unknown>): { text: string; used: string } {
  const days = Math.min(400, Math.max(0, Math.round(num(input, 'days', 7))));
  const cutoff = new Date(src.now);
  cutoff.setDate(cutoff.getDate() + days);
  const today = dateToIso(src.now);
  const end = dateToIso(cutoff);

  const rows = src.state.tasks
    .filter((t) => !t.done)
    .filter((t) => !t.date || (t.date >= today && t.date <= end))
    .sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'));

  if (rows.length === 0) {
    return { text: `Nothing on their own list in the next ${days} days.`, used: 'your own task list' };
  }
  return {
    text:
      `${rows.length} on their own list (these are theirs, not from any syllabus):\n` +
      within(
        rows.map(
          (t) =>
            `- [${t.id}] ${t.title}${t.date ? ` · ${day(t.date)}` : ' · no date'}` +
            `${t.time ? ` · ${t.time}` : ''}`,
        ),
      ),
    used: 'your own task list',
  };
}

function readTimetable(src: Source, input: Record<string, unknown>): { text: string; used: string } {
  const asked = str(input, 'date');
  const start = /^\d{4}-\d{2}-\d{2}$/.test(asked) ? new Date(`${asked}T12:00:00`) : new Date(src.now);
  if (Number.isNaN(start.getTime())) return { text: `"${asked}" is not a date.`, used: 'your timetable' };
  const span = Math.min(7, Math.max(1, Math.round(num(input, 'days', 1))));

  const out: string[] = [];
  for (let i = 0; i < span; i += 1) {
    const on = new Date(start);
    on.setDate(on.getDate() + i);
    const blocks = blocksFor(src.catalog, on).sort((a, b) => a.at - b.at);
    const tasks = tasksOn(src.state.tasks, on).filter((t) => !t.done);
    const label = on.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
    if (blocks.length === 0 && tasks.length === 0) {
      out.push(`${label}: nothing scheduled.`);
      continue;
    }
    out.push(
      `${label}:\n` +
        [
          ...blocks.map(
            (b) =>
              `  - ${b.time} · ${b.title}${b.meta ? ` · ${b.meta}` : ''}` +
              `${b.canceled ? ' · CANCELLED' : ''}${b.optional ? ' · optional' : ''}`,
          ),
          ...tasks.map((t) => `  - ${t.time || 'no time'} · ${t.title} (their own task)`),
        ].join('\n'),
    );
  }
  return { text: within(out), used: 'your timetable' };
}

/** What each lookup is called while it runs, in the student's language. */
function saying(name: string, input: Record<string, unknown>): string {
  const course = str(input, 'course');
  const of = course ? ` for ${course}` : '';
  switch (name) {
    case 'find_deadlines':
      return `Looking up your deadlines${of}`;
    case 'read_grades':
      return `Reading your grades${of}`;
    case 'read_attendance':
      return `Reading your attendance${of}`;
    case 'search_material':
      return `Searching your study material${of}`;
    case 'read_tasks':
      return 'Reading your own task list';
    case 'read_timetable':
      return 'Reading your timetable';
    default:
      return 'Looking something up';
  }
}

/**
 * Run one lookup against what the app holds.
 *
 * Never throws. A lookup that fails still has to come back — the API rejects
 * an assistant turn whose `tool_use` is not answered — so a thrown error
 * becomes a result saying so, and the model is told plainly rather than the
 * whole conversation dying on a bad argument.
 */
export function runLookup(call: ToolCall, src: Source): Looked {
  const said = saying(call.name, call.input);
  const fail = (text: string): Looked => ({
    result: { id: call.id, text, failed: true },
    used: '',
    saying: said,
  });
  if (!isLookup(call.name)) return fail(`There is no lookup called ${call.name}.`);
  try {
    const run: Record<string, (s: Source, i: Record<string, unknown>) => { text: string; used: string }> = {
      find_deadlines: findDeadlines,
      read_grades: readGrades,
      read_attendance: readAttendance,
      search_material: searchMaterial,
      read_tasks: readTasks,
      read_timetable: readTimetable,
    };
    const { text, used } = run[call.name](src, call.input);
    return { result: { id: call.id, text }, used, saying: said };
  } catch (e) {
    return fail(`That lookup could not be run: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Run a round of them, and say what they read.
 *
 * Every call passed in comes back with a result, including one whose name is
 * not ours — see `runLookup`. That completeness is a wire requirement rather
 * than a courtesy: an unanswered `tool_use` makes the next request invalid.
 */
export function runLookups(
  calls: ToolCall[],
  src: Source,
): { results: ToolResult[]; used: string[]; saying: string[] } {
  const done = calls.slice(0, MOST_LOOKUPS).map((c) => runLookup(c, src));
  return {
    results: [
      ...done.map((d) => d.result),
      // Anything past the ceiling still needs answering, or the request that
      // carries it is refused.
      ...calls.slice(MOST_LOOKUPS).map((c) => ({
        id: c.id,
        text: 'Too many lookups in one turn. Answer from what you already have.',
        failed: true as const,
      })),
    ],
    used: [...new Set(done.map((d) => d.used).filter(Boolean))],
    saying: [...new Set(done.map((d) => d.saying))],
  };
}
