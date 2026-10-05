import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every date, time and number the app writes goes through `lib/locale.ts`.
 *
 * Structural rather than behavioural, for the reason `rootunmount.test.ts`
 * gives: a rendering test only sees the screens it renders, and the failure
 * this prevents is a forty-first `toLocaleDateString(undefined, …)` on a
 * screen no test visits, quietly following the device while everything else
 * follows the student.
 */

const SRC = join(__dirname, '..');

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...sources(path));
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

const FILES = sources(SRC).map((path) => ({ file: relative(SRC, path), text: readFileSync(path, 'utf8') }));

/*
 * Code, not comments: `lib/cost.ts` explains in a comment why it does *not*
 * call `toLocaleString`, and that sentence is not a call.
 */
const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const FORMATTING = /\.toLocale(?:Date|Time)?String\(|new Intl\.\w+|Intl\.DateTimeFormat\(\)/g;

/**
 * The places that must *not* follow the student's choice, each with its reason.
 * A count, so a second call slipping into one of these files is still caught.
 */
const DELIBERATE: Record<string, { count: number; why: string }> = {
  'lib/locale.ts': { count: 6, why: 'the formatters themselves' },
  'lib/date.ts': { count: 1, why: "`twentyFourHour` asks the chosen locale's hour cycle — a question, not a format" },
  'lib/family.ts': {
    count: 1,
    why: "'en-CA' is the one locale whose short date is YYYY-MM-DD in local time; it is a comparison key, not display",
  },
  'lib/dining/time.ts': {
    count: 1,
    why: "reads the calendar date and minute in a dining location's own time zone, to decide its plan week and whether it is open; it is arithmetic, never display",
  },
  'lib/lookup.ts': {
    count: 2,
    why: "writes a sentence for the assistant's tool result, in the English the rest of that sentence is in",
  },
  'lib/chart.ts': {
    count: 1,
    why: 'axis labels share a line with an English k/M suffix; a decimal comma there reads as a list',
  },
  'lib/graduation.ts': { count: 1, why: 'US dollars, grouped the way the bill it is checked against groups them' },
  'components/GraduationSimulator.tsx': { count: 1, why: 'the same dollars, on screen' },
  'lib/help-routes.ts': {
    count: 1,
    why: "#791 pre-fills a deadline into a help request a member of staff reads; text for somebody else must not follow the student's format choice",
  },
  'lib/integration/school-records.ts': {
    count: 2,
    why: "#779's official school records, written in UTC with the zone named beside them so a record reads the same on every device; whether that should follow the student's locale is step 1b's question, not this guard's",
  },
  'lib/gtm/messaging.ts': {
    count: 1,
    why: "quiet hours ask what hour it is where the recipient is, as a number to compare; nothing is shown to anyone",
  },
};

describe('dates, times and numbers are formatted in one place', () => {
  it('nowhere else calls toLocale…String or builds an Intl formatter', () => {
    const found: Record<string, number> = {};
    for (const { file, text } of FILES) {
      const n = code(text).match(FORMATTING)?.length ?? 0;
      if (n) found[file] = n;
    }
    const expected = Object.fromEntries(Object.entries(DELIBERATE).map(([f, { count }]) => [f, count]));
    expect(found).toEqual(expected);
  });

  it('the guard can see a call', () => {
    // The control: a pattern that matched nothing would pass the test above.
    expect(code('d.toLocaleDateString(undefined, { month: "short" })').match(FORMATTING)).toHaveLength(1);
    expect(code('new Intl.NumberFormat("de")').match(FORMATTING)).toHaveLength(1);
    expect(code('/* toLocaleString would follow the device */').match(FORMATTING)).toBeNull();
  });
});

/**
 * A file that consults the chosen locale: its English or twelve-hour form is
 * the branch for "nothing chosen", which must stay byte-identical to before.
 */
const CONSULTS = /\b(?:appLocale|localClock|shownTime|localHourMark|twentyFourHour)\(/;

/**
 * The English names `date.ts` exports, used directly rather than through
 * `monthDay`, `weekdayShort` and the rest.
 *
 * Allowed in two cases only: a parser, which reads English text and must stay
 * English whatever the student chose; or a file that consults the locale and
 * keeps the English form as its "nothing chosen" branch.
 */
const ENGLISH_NAMES = /\b(?:MONTHS|DOW|DOW_INITIALS|MONTH_NAMES|MONTH_WORDS|DAY_NAMES)\b/;

const ENGLISH_PARSERS: Record<string, string> = {
  'lib/capture.ts': 'reads "Sep 4" out of a photographed or pasted page',
  'lib/registrar.ts': "reads the registrar's calendar, which is written in English",
};

describe("date.ts's English names", () => {
  it('are used directly only by parsers, or beside the locale', () => {
    const loose = FILES.filter(
      ({ file, text }) =>
        file !== 'lib/date.ts' &&
        /from '[./]*(?:lib\/)?date'/.test(text) &&
        ENGLISH_NAMES.test(code(text)) &&
        !(file in ENGLISH_PARSERS) &&
        !CONSULTS.test(code(text)),
    ).map(({ file }) => file);
    expect(loose).toEqual([]);
  });

  it('every listed parser still is one', () => {
    for (const file of Object.keys(ENGLISH_PARSERS)) {
      const text = FILES.find((f) => f.file === file)?.text ?? '';
      expect(ENGLISH_NAMES.test(code(text)), file).toBe(true);
    }
  });
});

/**
 * Twelve-hour clocks written by hand — `h % 12 === 0 ? 12 : h % 12` and its
 * cousins.
 *
 * Found by looking at the app: with German chosen, Settings read "14:45" while
 * Today's next class read "9:05a". The app's "9:05a" is also a *stored* form —
 * a class block's `time`, a task's, a feed event's — and `readDue` parses it
 * back, so the producers of stored strings and the parsers must stay
 * twelve-hour whatever is chosen. Everything that draws a time either consults
 * the locale or is one of these, each with its reason.
 */
const TWELVE_HOUR = /%\s*12\b/;

const CANONICAL_CLOCKS: Record<string, string> = {
  'lib/activities.ts': "writes a commitment's Block.time, the stored form screens draw through shownTime",
  'lib/arrive.ts': "said() is the key Today compares a block's stored time against; sentences draw it through shownTime",
  'lib/capture.ts': 'parses "2pm" from captured text and stores the canonical form',
  'lib/connect.ts': "stores a connected calendar event's time",
  'lib/drag.ts': "timeLabel writes the stored `time` of an item dropped or added on the calendar; its confirmations draw it through shownTime",
  'lib/duetime.ts': 'parses stored times',
  'lib/ics.ts': 'stores a subscribed feed event\'s time',
  'lib/life-balance.ts': "clockLabel writes a suggested study block's stored `time`; Life balance draws its ranges through date.ts clock()",
  'lib/select.ts': 'parses stored time ranges',
  'lib/suggest.ts': 'month arithmetic — `% 12` over months, not hours',
  'screens/Mine.tsx': "turns a time input into the stored form",
  'lib/yes.ts': "writes an imported course's stored schedule and `meets` line, in the YES registrar's own notation",
};

describe('twelve-hour clocks', () => {
  it('are written by hand only where a stored form or a parser needs one, or beside the locale', () => {
    const loose = FILES.filter(
      ({ file, text }) =>
        file !== 'lib/date.ts' && TWELVE_HOUR.test(code(text)) && !(file in CANONICAL_CLOCKS) && !CONSULTS.test(code(text)),
    ).map(({ file }) => file);
    expect(loose).toEqual([]);
  });

  it('every listed canonical clock still has one', () => {
    for (const file of Object.keys(CANONICAL_CLOCKS)) {
      const text = FILES.find((f) => f.file === file)?.text ?? '';
      expect(TWELVE_HOUR.test(code(text)), file).toBe(true);
    }
  });
});
