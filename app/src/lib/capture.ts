import { dateToIso, realDate } from './date';
/**
 * One box: "econ ps4 friday 5pm".
 *
 * Adding something you were just told about takes a screen, a course picker, a
 * date picker and four taps, and the honest consequence is that walking out of
 * a lecture nobody does it. An app with stale data is worse than no app,
 * because it is trusted and wrong.
 *
 * So: a line of text, read into a course, a kind, a date, a time and a title.
 *
 * ## It shows what it read before it writes anything
 *
 * Every rule here can misfire — "march" is a month and a verb, "quiz" is a
 * kind and a word, a course called "core" collides with the ordinary English
 * one. A parse that silently created a deadline on the wrong day would be the
 * app quietly corrupting the one thing it exists to be right about, so the
 * caller shows what was understood and the student presses the button.
 *
 * ## It refuses rather than defaulting
 *
 * No date read means no date, not today. No course matched means no course,
 * not the first one. Both come back null with the text preserved, because a
 * blank the student fills is recoverable and a wrong date they never noticed
 * is not.
 *
 * ## What it will not try to do
 *
 * There is no model here. A line typed at a bus stop is short, and the failure
 * mode of a model on a short ambiguous line is a confident wrong answer with
 * no way to see the reasoning. Rules are worse at the tail and much better at
 * being checked, and this one is checked by the student every single time.
 */

/** A course, in the shape this needs to match one. */
export interface Named {
  id: string;
  /** "ECON 1020". */
  code: string;
  title: string;
}

export interface Caught {
  /** The matched course, or null. */
  courseId: string | null;
  /** What kind of work, in the app's own words. Empty when unread. */
  kind: string;
  /** `YYYY-MM-DD`, or empty when nothing was read. */
  date: string;
  /** The time as typed, tidied: "5:00 PM". Empty when none was read. */
  time: string;
  /** Minutes past midnight, for ordering. `24 * 60` when no time was read. */
  at: number;
  /** What is left once the rest has been lifted out. */
  title: string;
  /** The words that produced each part, so the preview can show its working. */
  from: { course: string; kind: string; date: string; time: string };
}

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const SHORT = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

/**
 * Kinds, in the words people actually type.
 *
 * The left-hand sides are abbreviations and the right-hand sides are what the
 * app calls things, so a captured item sorts and estimates alongside anything
 * a syllabus produced. Order matters: "problem set" has to beat "set".
 */
const KINDS: [RegExp, string][] = [
  [/\b(?:problem\s*set|pset|ps)\s*\d*\b/i, 'Problem set'],
  [/\b(?:hw|homework)\s*\d*\b/i, 'Problem set'],
  [/\bquiz(?:zes)?\s*\d*\b/i, 'Quiz'],
  [/\b(?:midterm|final|exam|test)\s*\d*\b/i, 'Exam'],
  [/\b(?:essay|paper|memo)\s*\d*\b/i, 'Essay'],
  [/\b(?:reading|read|chapter|ch)\s*\d*\b/i, 'Reading'],
  [/\b(?:lab)\s*\d*\b/i, 'Lab'],
  [/\b(?:presentation|deck|slides|talk)\s*\d*\b/i, 'Presentation'],
  [/\b(?:reflection|response|journal|discussion\s*post)\s*\d*\b/i, 'Reflection'],
  [/\b(?:project|case)\s*\d*\b/i, 'Project'],
];

/**
 * The course, matched on the letters of its code.
 *
 * "econ", "econ1020" and "ECON 1020" all reach ECON 1020, because the letters
 * are what anybody types. Ambiguity is a refusal rather than a guess: two
 * courses whose codes start the same way and no number to separate them means
 * no course, and the picker is one tap away.
 */
export function matchCourse(text: string, courses: Named[]): { id: string; word: string } | null {
  const words = text.toLowerCase().match(/[a-z]+\s*\d*/g) ?? [];
  const hits: { id: string; word: string; score: number }[] = [];

  for (const c of courses) {
    const letters = (c.code.match(/[A-Za-z]+/)?.[0] ?? '').toLowerCase();
    const digits = c.code.match(/\d+/)?.[0] ?? '';
    if (!letters) continue;
    for (const raw of words) {
      const w = raw.replace(/\s+/g, '');
      if (!w.startsWith(letters)) continue;
      const rest = w.slice(letters.length);
      // The number, where one was typed, decides between two courses in the
      // same department. Without it the letters have to be unambiguous.
      if (rest && digits && !digits.startsWith(rest)) continue;
      hits.push({ id: c.id, word: raw.trim(), score: rest ? 2 : 1 });
    }
  }
  if (hits.length === 0) return null;
  const best = Math.max(...hits.map((h) => h.score));
  const top = hits.filter((h) => h.score === best);
  const ids = new Set(top.map((h) => h.id));
  if (ids.size > 1) return null;
  return { id: top[0].id, word: top[0].word };
}

/**
 * A date, in the forms people type at a bus stop.
 *
 * A weekday alone means the next one that is not today: "friday" typed on a
 * Friday is next Friday, because somebody standing there on Friday saying
 * "friday" almost always means the coming one and an item due in four minutes
 * is not what they meant. "today" says today, which is unambiguous.
 */
/** Every way a word can be cut short and still be itself: "september" down to "sep". */
function prefixes(word: string): string {
  const out: string[] = [];
  for (let n = word.length; n >= 3; n -= 1) out.push(word.slice(0, n));
  return out.join('|');
}

export function matchDate(text: string, now: Date): { date: string; word: string } | null {
  const s = text.toLowerCase();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const plus = (days: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    return dateToIso(d);
  };

  if (/\btoday\b/.test(s)) return { date: dateToIso(today), word: 'today' };
  if (/\btonight\b/.test(s)) return { date: dateToIso(today), word: 'tonight' };
  if (/\btomorrow\b|\btmr?w?\b/.test(s)) {
    return { date: plus(1), word: /tomorrow/.test(s) ? 'tomorrow' : 'tmrw' };
  }

  const inDays = /\bin\s+(\d{1,2})\s+days?\b/.exec(s);
  if (inDays) return { date: plus(Number(inDays[1])), word: inDays[0] };

  const weekday = /\b(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)\b/.exec(s);
  if (weekday) {
    const name = weekday[2];
    const index = DAYS.findIndex((d) => d === name) >= 0
      ? DAYS.findIndex((d) => d === name)
      : SHORT.findIndex((d) => name.startsWith(d));
    if (index >= 0) {
      let ahead = (index - today.getDay() + 7) % 7;
      // Never today: see above.
      if (ahead === 0) ahead = 7;
      if (weekday[1]) ahead += 7;
      return { date: plus(ahead), word: weekday[0] };
    }
  }

  /*
   * The month, written however far somebody bothered to write it.
   *
   * This took the whole name or exactly the first three letters, and "sept" is
   * neither: the alternation matched "sep", then wanted a dot or a space and
   * found a "t". So "ps4 due sept 18" read as no date at all — the commonest
   * abbreviation of the month this app's own term starts in, in the one box
   * the whole feature exists to make quick.
   *
   * Every prefix from three letters up. That admits "septe" and "septemb"
   * too, which nobody writes and which cost nothing, and still refuses "sepx"
   * — a prefix of the name is the rule, not three letters and anything after.
   *
   * Three is the floor because two is ambiguous: "ju" is June and July both,
   * and the alternation would silently answer whichever it listed first.
   *
   * They are written longest first only for reading. Which one matches is not
   * decided by the order — the day that has to follow forces the engine back
   * through the alternatives until one leaves a dot or a space where it needs
   * one, so "september 18" is read whole either way. Measured, by listing them
   * the other way round and watching nothing change.
   */
  const named = new RegExp(
    `\\b(${MONTHS.map(prefixes).join('|')})\\.?\\s+(\\d{1,2})\\b`,
    'i',
  ).exec(s);
  if (named) {
    const month = MONTHS.findIndex((m) => m.startsWith(named[1].toLowerCase().slice(0, 3)));
    const day = Number(named[2]);
    if (month >= 0) {
      // The year is chosen so the date is not in the past: "jan 20" typed in
      // November means the coming January, which is what anybody means.
      //
      // `realDate` rather than `day <= 31`: this is the box somebody types
      // into by hand, so it is also where a typo is likeliest, and "essay feb
      // 31" made a task on 3 March. The year has to be settled first, because
      // 29 February is a date in one year and not in the next. See
      // `lib/date.ts`.
      const year = today.getFullYear();
      const thisYear = realDate(year, month + 1, day);
      const chosen = thisYear && thisYear >= today ? thisYear : realDate(year + 1, month + 1, day);
      if (chosen) return { date: dateToIso(chosen), word: named[0] };
    }
  }

  const slashes = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(s);
  if (slashes) {
    const month = Number(slashes[1]) - 1;
    const day = Number(slashes[2]);
    if (month >= 0 && month <= 11) {
      let year = slashes[3] ? Number(slashes[3]) : today.getFullYear();
      if (year < 100) year += 2000;
      const asWritten = realDate(year, month + 1, day);
      // A year the writer stated is theirs: 29/2/2026 is a typo to be
      // refused, not a date to be rolled into 2027.
      const chosen = slashes[3]
        ? asWritten
        : asWritten && asWritten >= today
          ? asWritten
          : realDate(year + 1, month + 1, day);
      if (chosen) return { date: dateToIso(chosen), word: slashes[0] };
    }
  }

  return null;
}

/** A time of day, in the forms people type. */
export function matchTime(text: string): { time: string; at: number; word: string } | null {
  const s = text.toLowerCase();
  if (/\bnoon\b/.test(s)) return { time: '12:00 PM', at: 12 * 60, word: 'noon' };
  if (/\bmidnight\b/.test(s)) return { time: '11:59 PM', at: 23 * 60 + 59, word: 'midnight' };

  /*
   * "5pm", "5 pm", "5p" — but a lone "a" or "p" has to be against its hour.
   *
   * A space was allowed before it, so "read ch 4 p 12" read four in the
   * afternoon out of a page reference, and "problem 3 a" read three in the
   * morning out of a sub-question. Both are ordinary things to type in this
   * box. Written as a time the letter is never held off from the figure —
   * nobody writes "5 p" for five in the afternoon, and anybody who does still
   * has "5 pm", which is untouched.
   *
   * "3a" attached is left alone and is genuinely ambiguous: it is three in the
   * morning and it is the first part of question three, and nothing in the
   * line says which. The readback is what settles that one, which is what it
   * is for.
   */
  const m = /\b(\d{1,2})(?::(\d{2}))?(\s*[ap]m|[ap])\b/.exec(s);
  if (m) {
    let hour = Number(m[1]) % 12;
    if (m[3].trim().startsWith('p')) hour += 12;
    const mins = m[2] ? Number(m[2]) : 0;
    if (mins > 59) return null;
    return { time: clock(hour, mins), at: hour * 60 + mins, word: m[0].trim() };
  }

  // 24-hour, but only with a colon: a bare "1700" is far more often a room
  // number or a course code than a time, and reading it as one would put a
  // deadline at five in the afternoon of a day nobody chose.
  const h24 = /\b(\d{1,2}):(\d{2})\b/.exec(s);
  if (h24) {
    const hour = Number(h24[1]);
    const mins = Number(h24[2]);
    if (hour > 23 || mins > 59) return null;
    return { time: clock(hour, mins), at: hour * 60 + mins, word: h24[0] };
  }
  return null;
}

function clock(hour: number, mins: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:${String(mins).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}

function matchKind(text: string): { kind: string; word: string } | null {
  for (const [re, kind] of KINDS) {
    const m = re.exec(text);
    if (m) return { kind, word: m[0].trim() };
  }
  return null;
}

/**
 * Everything read out of one line.
 *
 * The title is what is left after the recognised parts are lifted out, tidied
 * — and where nothing is left, the kind stands in, because "Problem set" is a
 * better name for a row than an empty string.
 */
export function capture(text: string, courses: Named[], now: Date): Caught {
  const raw = text.trim();
  const course = matchCourse(raw, courses);
  const kind = matchKind(raw);
  const date = matchDate(raw, now);
  const time = matchTime(raw);

  let left = raw;
  for (const word of [course?.word, date?.word, time?.word]) {
    if (word) left = left.replace(new RegExp(escape(word), 'i'), ' ');
  }
  // The kind's own words stay in the title — "PS4" is the name of the thing,
  // not just its category, and stripping it leaves a row called nothing.
  const title = left.replace(/\s+/g, ' ').replace(/^[\s,.:;-]+|[\s,.:;-]+$/g, '');

  return {
    courseId: course?.id ?? null,
    kind: kind?.kind ?? '',
    date: date?.date ?? '',
    time: time?.time ?? '',
    at: time?.at ?? 24 * 60,
    title: title || kind?.kind || '',
    from: {
      course: course?.word ?? '',
      kind: kind?.word ?? '',
      date: date?.word ?? '',
      time: time?.word ?? '',
    },
  };
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Whether there is enough to make a row out of. */
export function enough(c: Caught): boolean {
  return c.title.trim().length > 0;
}

/**
 * What the preview says it understood.
 *
 * Every clause names the words it came from, so a wrong reading is visible
 * rather than merely wrong: "friday → 11 Sep" is checkable at a glance and
 * "11 Sep" is not.
 */
export function readBack(c: Caught, codeOf: (id: string) => string): string[] {
  const out: string[] = [];
  if (c.courseId) out.push(`${c.from.course} → ${codeOf(c.courseId)}`);
  else out.push('No course — it will be yours rather than a course’s');
  if (c.kind) out.push(`${c.from.kind} → ${c.kind}`);
  if (c.date) out.push(`${c.from.date} → ${pretty(c.date)}`);
  else out.push('No date read — add one, or it is undated');
  if (c.time) out.push(`${c.from.time} → ${c.time}`);
  return out;
}

function pretty(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  // "Sep 05" is what `toDateString` gives and not what anybody writes.
  return date.toDateString().slice(4).replace(/\s\d{4}$/, '').replace(/\s0(\d)$/, ' $1');
}
