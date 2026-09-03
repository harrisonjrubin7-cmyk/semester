/**
 * The pathway between YES and this app.
 *
 * YES has no API a student can use. Its pages sit behind single sign-on, the
 * class search is a Struts action, and every attempt to read it from a browser
 * tab you do not own is blocked by the same-origin policy — correctly. So the
 * honest bridge is not a scraper. It is the clipboard: select your enrolled
 * classes in YES, copy, paste here, and the app reads the block.
 *
 * That works because a schedule is a strongly-shaped thing. A line carries a
 * course number, a title, a day pattern and a time, in that order, whatever
 * the surrounding markup did. Copying out of a table gives tabs; copying out of
 * a rendered page gives lines; both are handled, and anything that is not a
 * class is dropped rather than turned into a half-course.
 *
 * What is deliberately not done: nothing here invents a deadline. YES knows
 * when your classes meet and nothing about when your essays are due — those
 * come from a syllabus, and a course built from a schedule says so and stays
 * empty until one is uploaded.
 */

/** 0 = Sunday, to match `RecurringBlock.days` and `Date.getDay`. */
const DAY_LETTERS: Record<string, number> = {
  U: 0,
  M: 1,
  T: 2,
  W: 3,
  R: 4,
  F: 5,
  S: 6,
};

const DAY_WORDS: [RegExp, number][] = [
  [/^sun/i, 0],
  [/^mon/i, 1],
  [/^tue/i, 2],
  [/^wed/i, 3],
  [/^thu/i, 4],
  [/^fri/i, 5],
  [/^sat/i, 6],
];

/**
 * "MWF", "TR", "Mon, Wed" or "Tuesday/Thursday" → day numbers.
 *
 * The letter form is the one YES uses and it has a trap: T is Tuesday and R is
 * Thursday, so a naive reader that maps "Th" letter by letter produces Tuesday
 * plus Thursday from one day. Word forms are checked first for that reason.
 */
export function readDays(text: string): number[] {
  const found = new Set<number>();
  const words = text.split(/[\s,/·&]+/).filter(Boolean);
  let anyWord = false;
  for (const word of words) {
    if (word.length < 3) continue;
    for (const [pattern, day] of DAY_WORDS) {
      if (pattern.test(word)) {
        found.add(day);
        anyWord = true;
      }
    }
  }
  if (anyWord) return [...found].sort((a, b) => a - b);

  for (const ch of text.replace(/[^UMTWRFS]/g, '')) {
    const day = DAY_LETTERS[ch];
    if (day !== undefined) found.add(day);
  }
  return [...found].sort((a, b) => a - b);
}

/** "9:10am" or "1:15 PM" or "13:15" → minutes past midnight. */
export function readTime(text: string): number | null {
  const m = /(\d{1,2})[:.](\d{2})\s*([ap])?\.?m?\.?/i.exec(text.trim());
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  const half = m[3]?.toLowerCase();
  if (half === 'p' && hour < 12) hour += 12;
  if (half === 'a' && hour === 12) hour = 0;
  return hour * 60 + minute;
}

/** Minutes past midnight → "9:10a", the form the rest of the app writes. */
export function clock(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const half = h24 >= 12 ? 'p' : 'a';
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(m).padStart(2, '0')}${half}`;
}

export interface ClassLine {
  /** "ECON 1020" — the subject and number, normalised to one space. */
  code: string;
  /** "01", when the line carried a section. */
  section: string;
  title: string;
  days: number[];
  /** Minutes past midnight. */
  at: number;
  endsAt: number | null;
  room: string;
}

// A course number: two to four letters, optional space or hyphen, three or
// four digits, optionally a section after a hyphen.
const CODE = /\b([A-Z]{2,4})[\s-]?(\d{3,4}[A-Z]?)(?:-(\d{2,3}))?\b/;
const RANGE =
  /(\d{1,2}[:.]\d{2}\s*[apAP]?\.?[mM]?\.?)\s*(?:-|–|—|to)\s*(\d{1,2}[:.]\d{2}\s*[apAP]?\.?[mM]?\.?)/;

/**
 * Read a pasted schedule.
 *
 * Every line has to carry a course code, a day pattern and a time to count.
 * That is a strict test, and it is the right one: a page of pasted HTML is
 * mostly navigation, and a loose parser turns "Spring 2027 Registration" into
 * a course. Better to miss a line and let someone add it by hand than to
 * quietly file three phantom classes.
 */
export function readSchedule(text: string): ClassLine[] {
  const out: ClassLine[] = [];
  const seen = new Set<string>();

  for (const raw of text.split(/\r?\n/)) {
    // A copied table gives tabs; treat them as strong separators but keep the
    // line whole, because the pieces belong to one class.
    const line = raw.replace(/\t+/g, ' · ').trim();
    if (line.length < 8) continue;

    const code = CODE.exec(line.toUpperCase());
    if (!code) continue;
    const range = RANGE.exec(line);
    if (!range) continue;
    const at = readTime(range[1]);
    if (at === null) continue;
    const endsAt = readTime(range[2]);

    // Days are looked for in the stretch between the code and the time, which
    // is where they sit — searching the whole line would find an "F" in a
    // building name and invent a Friday class.
    const codeEnd = (code.index ?? 0) + code[0].length;
    const middle = line.slice(Math.min(codeEnd, line.length), range.index ?? line.length);
    const days = readDays(middle);
    if (days.length === 0) continue;

    const full = `${code[1]} ${code[2]}`;
    const key = `${full}-${at}-${days.join('')}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      code: full,
      section: code[3] ?? '',
      title: titleIn(middle),
      days,
      at,
      endsAt,
      room: roomAfter(line, (range.index ?? 0) + range[0].length),
    });
  }

  return out.sort((a, b) => a.days[0] - b.days[0] || a.at - b.at);
}

/**
 * The course title, from between the code and the time.
 *
 * The day pattern sits immediately before the time, so it is stripped from the
 * end rather than searched for throughout. That distinction matters: a filter
 * that dropped anything looking like day letters would delete "US" from "US
 * Foreign Policy", because U and S are both day letters. Trailing-only means a
 * title keeps its words and the pattern still goes.
 *
 * An empty title is allowed. A schedule copied from a compact view often has
 * none, and empty is honest where "Untitled 1020" is noise.
 */
function titleIn(middle: string): string {
  const tokens = middle
    .replace(/[·|]/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^[-–—,\s]+|[-–—,\s]+$/g, ''))
    .filter(Boolean);

  while (tokens.length > 0 && isDayToken(tokens[tokens.length - 1])) tokens.pop();

  return tokens.join(' ').replace(/\s{2,}/g, ' ').replace(/^[-–—,\s]+|[-–—,\s]+$/g, '').trim();
}

/** A token that is a day and nothing else — "MWF", "TR", "Tuesday", "Wed". */
function isDayToken(token: string): boolean {
  const bare = token.replace(/[.,/&]/g, '');
  if (!bare) return true;
  if (/^[UMTWRFS]{1,7}$/.test(bare)) return true;
  return DAY_WORDS.some(([pattern]) => pattern.test(bare)) && bare.length <= 9;
}

/** Whatever follows the time — "Buttrick Hall 101", "Online", "TBA". */
function roomAfter(line: string, from: number): string {
  const tail = line
    .slice(from)
    .split(/[·|]/)
    .map((p) => p.trim())
    .filter(Boolean)
    .join(', ')
    .replace(/^[-–—,\s]+/, '')
    .trim();
  if (!tail) return '';
  if (/^(tba|tbd|to be announced|no room|online)$/i.test(tail)) return tail;
  return tail.slice(0, 80);
}

/** The meeting pattern as a syllabus would write it — "MWF · 9:10–10:00a". */
export function meetsLine(c: ClassLine): string {
  const letters = ['U', 'M', 'T', 'W', 'R', 'F', 'S'];
  const days = c.days.map((d) => letters[d]).join('');
  const time = c.endsAt === null ? clock(c.at) : `${clock(c.at)}–${clock(c.endsAt)}`;
  return `${days} · ${time}`;
}

/**
 * Lines belonging to the same course, grouped.
 *
 * A lecture and its lab are two lines in YES and one course here, so they
 * become one entry with two meeting blocks rather than two courses that share
 * a code and fight over the same id.
 */
export function byCourse(lines: ClassLine[]): { code: string; title: string; lines: ClassLine[] }[] {
  const map = new Map<string, { code: string; title: string; lines: ClassLine[] }>();
  for (const line of lines) {
    const found = map.get(line.code);
    if (found) {
      found.lines.push(line);
      if (!found.title && line.title) found.title = line.title;
    } else {
      map.set(line.code, { code: line.code, title: line.title, lines: [line] });
    }
  }
  return [...map.values()];
}

/** An id from a course code — "ECON 1020" becomes "econ1020". */
export function idFor(code: string): string {
  return code.toLowerCase().replace(/[^a-z0-9]/g, '');
}
