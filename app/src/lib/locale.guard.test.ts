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
  'lib/family.ts': {
    count: 1,
    why: "'en-CA' is the one locale whose short date is YYYY-MM-DD in local time; it is a comparison key, not display",
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
  'lib/integration/school-records.ts': {
    count: 2,
    why: "#779's official school records, written in UTC with the zone named beside them so a record reads the same on every device; whether that should follow the student's locale is step 1b's question, not this guard's",
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
 * The English names `date.ts` exports, drawn directly rather than through
 * `monthShort` / `weekdayShort` / `longLabel`.
 *
 * Some of these are right as they are — `MONTH_WORDS` and friends are what an
 * English syllabus is *parsed* against, and parsing must stay English whatever
 * is chosen. Others draw a date and will not follow a chosen locale until they
 * are moved. Telling the two apart is the next slice of work; until then this
 * list may only shrink. A new file reaching for the English names directly is
 * refused, and a file that stops needing them must be taken off.
 */
const ENGLISH_NAMES = /\b(?:MONTHS|DOW|DOW_INITIALS|MONTH_NAMES|MONTH_WORDS|DAY_NAMES)\b/;

const STILL_ENGLISH = [
  'App.tsx',
  'components/WeekGrid.tsx',
  'headers.ts',
  'lib/ahead.ts',
  'lib/announce.ts',
  'lib/capture.ts',
  'lib/clocks.ts',
  'lib/mailbox.ts',
  'lib/meals.ts',
  'lib/monthgrid.ts',
  'lib/officehours.ts',
  'lib/registrar.ts',
  'lib/repeat.ts',
  'lib/roomchat.ts',
  'lib/suggest.ts',
  'lib/weekpage.ts',
  'screens/Calendar.tsx',
  'screens/Clocks.tsx',
  'screens/Today.tsx',
  'screens/me/You.tsx',
];

describe("date.ts's English names", () => {
  it('are drawn directly only by the files already known to', () => {
    const users = FILES.filter(
      ({ file, text }) => file !== 'lib/date.ts' && /from '[./]*(?:lib\/)?date'/.test(text) && ENGLISH_NAMES.test(code(text)),
    )
      .map(({ file }) => file)
      .sort();
    expect(users).toEqual(STILL_ENGLISH);
  });
});

/**
 * Twelve-hour clocks written by hand — `h % 12 === 0 ? 12 : h % 12` and its
 * cousins — which a chosen locale cannot reach.
 *
 * Found by looking at the app rather than at the tests: with German chosen,
 * the Settings example read "14:45" while Today's next class still read
 * "9:05a". `date.ts`'s `clock()` follows the choice; these do not. Some are
 * parsers (reading "2pm" out of a feed must stay twelve-hour whatever the
 * student chose), and some draw a time and should move to `clock()`. Same rule
 * as above: the list may only shrink.
 */
const TWELVE_HOUR = /%\s*12\b/;

const HAND_ROLLED_CLOCKS = [
  'components/Capacity.tsx',
  'components/HourGrid.tsx',
  'components/MyRules.tsx',
  'components/WeekGrid.tsx',
  'lib/activities.ts',
  'lib/arrive.ts',
  'lib/atrisk.ts',
  'lib/capture.ts',
  'lib/classmates.ts',
  'lib/clocks.ts',
  'lib/connect.ts',
  'lib/drag.ts',
  'lib/duetime.ts',
  'lib/ics.ts',
  'lib/mailbox.ts',
  'lib/myrules.ts',
  'lib/roomchat.ts',
  'lib/select.ts',
  'lib/suggest.ts',
  'lib/windows.ts',
  'lib/yes.ts',
  'screens/Mine.tsx',
];

describe('twelve-hour clocks', () => {
  it('are written by hand only in the files already known to', () => {
    const found = FILES.filter(({ file, text }) => file !== 'lib/date.ts' && TWELVE_HOUR.test(code(text)))
      .map(({ file }) => file)
      .sort();
    expect(found).toEqual(HAND_ROLLED_CLOCKS);
  });
});
