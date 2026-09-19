import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { dateToIso } from './date';
import { PACK_TEMPLATE, PACK_VERSION, isoDate, packId, readPack, writePack } from './schoolpack';
import { readSchool } from './school';
import { BUNDLED } from '../data/schools';

/** The smallest thing that is a pack at all — everything else is optional. */
const minimal = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({ semesterSchoolPack: PACK_VERSION, name: 'Example University', importedAt: '2026-08-01', ...extra });

/** A pack's problems, as the sentences a person would read. */
const says = (source: string) => readPack(source).problems.map((p) => p.says);
const where = (source: string) => readPack(source).problems.map((p) => p.where);

describe('a file that is not a pack is refused, and told why', () => {
  const refusals: [string, string, string][] = [
    ['an empty file', '', 'empty'],
    ['whitespace', '   \n  ', 'empty'],
    ['something that is not JSON', 'Dear colleague, please find attached', 'not valid JSON'],
    ['JSON that is a list', '[{"name":"Example"}]', 'single JSON record'],
    ['JSON that is a string', '"Example University"', 'single JSON record'],
    ['a record with no version', '{"name":"Example University"}', 'does not say it is a Semester school pack'],
    ['a version that is not a number', '{"semesterSchoolPack":"1","name":"E"}', 'not a whole number'],
    ['a fractional version', '{"semesterSchoolPack":1.5,"name":"E"}', 'not a whole number'],
    ['version zero', '{"semesterSchoolPack":0,"name":"E"}', 'not a whole number'],
    ['a pack with no name', `{"semesterSchoolPack":${PACK_VERSION}}`, 'no school name'],
    ['a pack whose name is blank', `{"semesterSchoolPack":${PACK_VERSION},"name":"   "}`, 'no school name'],
  ];

  it.each(refusals)('refuses %s', (_label, source, expected) => {
    const read = readPack(source);
    expect(read.ok).toBe(false);
    expect(read.school).toBeNull();
    expect(read.problems).toHaveLength(1);
    expect(read.problems[0].severity).toBe('refused');
    expect(read.problems[0].says).toContain(expected);
  });

  it('refuses a pack from a newer build by name, rather than reading half of it', () => {
    // The failure this prevents is the quiet one: a version 2 pack read by a
    // version 1 reader loads the fields that happen to still exist and drops
    // whatever was added, with nothing on screen to say so.
    const read = readPack(JSON.stringify({ semesterSchoolPack: PACK_VERSION + 1, name: 'Example' }));
    expect(read.ok).toBe(false);
    expect(read.problems[0].says).toContain(`version ${PACK_VERSION + 1}`);
    expect(read.problems[0].says).toContain(`version ${PACK_VERSION} pack`);
  });

  it('refuses a file too large to be a campus', () => {
    const read = readPack(`{"semesterSchoolPack":1,"name":"E","pad":"${'x'.repeat(4_000_001)}"}`);
    expect(read.ok).toBe(false);
    expect(read.problems[0].says).toContain('4 MB');
  });

  it('never throws, whatever it is handed', () => {
    const nasty = ['{', '{"semesterSchoolPack":1,"name":"E","data":7}', '\u0000', 'null', 'undefined', '[]', '0'];
    for (const s of nasty) expect(() => readPack(s)).not.toThrow();
  });
});

describe('a pack may never mark itself verified', () => {
  it('forces it false however loudly the file claims otherwise', () => {
    // `verified` means "not editable by a stranger who signed up and mistyped
    // something". A file is from outside by definition.
    const read = readPack(minimal({ verified: true }));
    expect(read.ok).toBe(true);
    expect(read.school?.verified).toBe(false);
  });

  it('and the bundled Vanderbilt profile keeps its own verified flag', () => {
    // The control for the line above: `verified` is not simply always false.
    expect(BUNDLED.vanderbilt.verified).toBe(true);
  });
});

describe('the id is the one the pack names, not a fresh one', () => {
  it('keeps an id that already exists, so a correction lands on the profile it corrects', () => {
    // This is the whole point of a pack and the easiest thing to get wrong.
    // `idFor` in lib/findschool.ts appends "-2" when an id is taken, which is
    // right for a second school added by hand. Used here it would produce a
    // pack that imports cleanly, reports no problem, and changes nothing on
    // any screen, because `resolveSchool` would never be asked for it.
    expect(packId('vanderbilt', 'Vanderbilt University')).toBe('vanderbilt');
    expect(packId('vanderbilt', 'Vanderbilt University')).toBe(BUNDLED.vanderbilt.id);
  });

  it('falls back to the name when no id is given', () => {
    expect(packId(undefined, 'Example University')).toBe('example-university');
  });

  it('normalises an id the same way a hand-added school is normalised', () => {
    expect(packId('Vanderbilt University!', 'x')).toBe('vanderbilt-university');
  });

  it('never produces an empty id', () => {
    expect(packId('', '!!!')).toBe('school');
  });
});

describe('dates are real days, not shapes that look like days', () => {
  it('takes a real date', () => expect(isoDate('2026-08-26')).toBe('2026-08-26'));

  it.each(['2026-02-30', '2026-13-01', '2026-00-10', '2026-8-26', '26-08-26', '2026/08/26', 'August 26', '', null, 42])(
    'refuses %s',
    (bad) => expect(isoDate(bad)).toBeNull(),
  );

  it.each(['2026-08-26T00:00:00Z', '2026-08-26T23:00:00+13:00', '2026-08-26 00:00'])(
    'refuses the timestamp %s rather than trimming it to a date',
    (stamp) => {
      // This read the first ten characters and let every one of these
      // through as 26 August. A timestamp trimmed in a different timezone
      // from the one it was written in moves a withdrawal deadline by a day,
      // silently — so it is named instead.
      expect(isoDate(stamp)).toBeNull();
    },
  );

  it('refuses a two-digit year rather than quietly making it 1926', () => {
    // `new Date(26, 0, 1)` is 1926, because Date maps 0–99 into the 1900s.
    // `realDate` compares what came back against what was asked for, so both
    // the short form and a genuine year 26 are refused rather than silently
    // becoming a date in the twentieth century.
    expect(isoDate('26-08-26')).toBeNull();
    expect(isoDate('0026-08-26')).toBeNull();
  });
});

describe('the academic calendar', () => {
  const term = (extra: Record<string, unknown> = {}) => ({
    termName: 'Fall 2026',
    startsOn: '2026-08-26',
    endsOn: '2026-12-11',
    deadlines: [{ label: 'Last day to drop', on: '2026-09-04' }],
    ...extra,
  });
  const pack = (terms: unknown) => minimal({ data: { academicCalendar: terms } });

  it('reads a good term whole', () => {
    const read = readPack(pack([term({ breaks: [{ label: 'Fall Break', from: '2026-10-22', to: '2026-10-23' }], finalsFrom: '2026-12-05', finalsTo: '2026-12-11' })]));
    const [t] = read.school!.data.academicCalendar!;
    expect(t.termName).toBe('Fall 2026');
    expect(t.deadlines).toEqual([{ label: 'Last day to drop', on: '2026-09-04' }]);
    expect(t.breaks).toEqual([{ label: 'Fall Break', from: '2026-10-22', to: '2026-10-23' }]);
    expect(t.finalsFrom).toBe('2026-12-05');
    expect(read.problems).toEqual([]);
  });

  it('keeps a deadline that falls outside the term, because the real ones do', () => {
    // The control on this whole file. Registration for the next term opens
    // inside this one and final grades are due after the last class day. A
    // range check here would look like thorough validation and would drop the
    // two dates a student most needs.
    const read = readPack(pack([term({ deadlines: [
      { label: 'Spring registration opens', on: '2026-10-26' },
      { label: 'Final grades due', on: '2026-12-21' },
      { label: 'Something from last year', on: '2025-01-05' },
    ] })]));
    expect(read.school!.data.academicCalendar![0].deadlines).toHaveLength(3);
    expect(read.problems).toEqual([]);
  });

  it('keeps a term whose last day the registrar has not published yet', () => {
    // The reference case, and the one a first draft of the reader got wrong.
    // The bundled Vanderbilt term ships with `endsOn` blank because
    // VANDERBILT-AUDIT.md could not verify the last class day and this
    // repository refuses to guess one. A reader that required both bounds
    // rejected the only profile the app ships.
    const read = readPack(pack([term({ endsOn: '' })]));
    expect(read.school!.data.academicCalendar![0].endsOn).toBe('');
    expect(read.school!.data.academicCalendar![0].deadlines).toHaveLength(1);
    expect(read.problems).toEqual([]);
  });

  it('keeps a term whose bounds are both missing, since the deadlines are the point', () => {
    const read = readPack(pack([{ termName: 'Fall 2026', deadlines: [{ label: 'Last day to drop', on: '2026-09-04' }] }]));
    expect(read.school!.data.academicCalendar![0].startsOn).toBe('');
    expect(read.problems).toEqual([]);
  });

  it('blanks both bounds when a term ends before it starts, and keeps the deadlines', () => {
    // Dropping the term would take every deadline in it with them, which is
    // thirty good dates lost to one transposed pair.
    const read = readPack(pack([term({ startsOn: '2026-12-11', endsOn: '2026-08-26' })]));
    const [t] = read.school!.data.academicCalendar!;
    expect([t.startsOn, t.endsOn]).toEqual(['', '']);
    expect(t.deadlines).toHaveLength(1);
    expect(read.problems[0].where).toBe('Fall 2026');
    expect(read.problems[0].says).toContain('before it starts');
  });

  it('drops a term with no name, because a term is shown by its name', () => {
    expect(says(pack([term({ termName: '' })]))[0]).toContain('no name');
    expect(where(pack([term({ termName: '' })]))[0]).toBe('Term 1');
  });

  it('blanks a bound that is not a real date, and says which one', () => {
    const read = readPack(pack([term({ endsOn: '2026-02-30' })]));
    expect(read.school!.data.academicCalendar![0].endsOn).toBe('');
    expect(read.problems[0].says).toContain('endsOn');
    expect(read.problems[0].says).toContain('YYYY-MM-DD');
  });

  it('drops one bad deadline and keeps the rest of the term', () => {
    const read = readPack(pack([term({ deadlines: [
      { label: 'Last day to drop', on: '2026-09-04' },
      { label: 'Broken', on: 'the fourth of September' },
      { label: '', on: '2026-10-30' },
    ] })]));
    expect(read.school!.data.academicCalendar![0].deadlines).toHaveLength(1);
    expect(where(pack([term({ deadlines: [{ label: 'Broken', on: 'nope' }] })]))[0]).toBe('Fall 2026 · Broken');
    expect(read.problems.map((p) => p.says).join(' ')).toContain('no label');
  });

  it('names an unlabelled deadline by its position, since it has no name to use', () => {
    expect(where(pack([term({ deadlines: [{ label: '', on: '2026-10-30' }] })]))[0]).toBe('Fall 2026 · deadline 1');
  });

  it('drops a break that runs backwards, and says the dates', () => {
    const read = readPack(pack([term({ breaks: [{ label: 'Fall Break', from: '2026-10-23', to: '2026-10-22' }] })]));
    expect(read.school!.data.academicCalendar![0].breaks).toBeUndefined();
    expect(read.problems[0].says).toContain('2026-10-22');
  });

  it('drops a reversed exam window rather than showing exams before they open', () => {
    const read = readPack(pack([term({ finalsFrom: '2026-12-11', finalsTo: '2026-12-05' })]));
    expect(read.school!.data.academicCalendar![0].finalsFrom).toBeUndefined();
    expect(read.problems[0].says).toContain('exam window');
  });

  it('truncates too many terms rather than refusing the file', () => {
    const many = Array.from({ length: 20 }, (_, i) => term({ termName: `Term ${i}` }));
    const read = readPack(pack(many));
    expect(read.ok).toBe(true);
    expect(read.school!.data.academicCalendar).toHaveLength(12);
    expect(read.problems[0].says).toContain('20 terms were sent');
  });

  it('says so when the calendar is not a list at all', () => {
    expect(says(pack('Fall starts in August'))[0]).toContain('not a list of terms');
  });
});

describe('buildings', () => {
  const pack = (buildings: unknown) => minimal({ data: { buildings } });
  const good = { name: 'Featheringill Hall', abbr: 'FGH', lat: 36.1447, lng: -86.8027 };

  it('reads a good one whole', () => {
    expect(readPack(pack([good])).school!.data.buildings).toEqual([good]);
  });

  it('drops a pin in the Gulf of Guinea rather than drawing it', () => {
    // 0,0 passes every range check that would be written here and is what an
    // unfilled spreadsheet column becomes when exported as numbers. A pin in
    // the ocean is the one failure a student cannot read as missing data.
    const read = readPack(pack([{ name: 'Nowhere Hall', lat: 0, lng: 0 }]));
    expect(read.school!.data.buildings).toBeUndefined();
    expect(read.problems[0].says).toContain('0, 0');
  });

  it('keeps a building that is genuinely on one axis', () => {
    // The control: only exactly 0,0 is refused, not a zero in either field.
    expect(readPack(pack([{ name: 'Greenwich', lat: 51.4779, lng: 0 }])).school!.data.buildings).toHaveLength(1);
  });

  it.each([
    ['latitude past the pole', { name: 'A', lat: 91, lng: 0 }],
    ['longitude past the date line', { name: 'A', lat: 0, lng: 181 }],
    ['a coordinate sent as a string', { name: 'A', lat: '36.14', lng: '-86.80' }],
    ['a missing coordinate', { name: 'A', lat: 36.14 }],
    ['not a number at all', { name: 'A', lat: NaN, lng: 0 }],
  ])('drops %s', (_label, building) => {
    const read = readPack(pack([building]));
    expect(read.school!.data.buildings).toBeUndefined();
    expect(read.problems[0].says).toContain('lat must be a number');
  });

  it('drops an unnamed building and names it by position', () => {
    expect(where(pack([good, { lat: 1, lng: 1 }]))[0]).toBe('Building 2');
  });

  it('keeps the good rows when one row is bad', () => {
    const read = readPack(pack([good, { name: 'Broken', lat: 999, lng: 0 }]));
    expect(read.school!.data.buildings).toHaveLength(1);
    expect(read.problems).toHaveLength(1);
  });
});

describe('meal plans', () => {
  const pack = (mealPlanTiers: unknown) => minimal({ data: { mealPlanTiers } });

  it('reads a good tier', () => {
    const tier = { name: 'First-Year Plan', swipes: 335, dollars: 225, period: 'term' };
    expect(readPack(pack([tier])).school!.data.mealPlanTiers).toEqual([tier]);
  });

  it('drops a plan whose price is missing rather than calling it free', () => {
    // The Meals screen does arithmetic with these. A plan the app believes
    // costs nothing is a worse answer than a plan the app does not have.
    const read = readPack(pack([{ name: 'Mystery Plan', swipes: 300, period: 'term' }]));
    expect(read.school!.data.mealPlanTiers).toBeUndefined();
    expect(read.problems[0].says).toContain('A missing price is not zero');
  });

  it('drops a negative price', () => {
    expect(says(pack([{ name: 'A', swipes: -1, dollars: 0, period: 'term' }]))[0]).toContain('zero or more');
  });

  it('drops a period it cannot mean', () => {
    expect(says(pack([{ name: 'A', swipes: 1, dollars: 1, period: 'semester' }]))[0]).toContain('"week" or "term"');
  });

  it('keeps a genuinely free plan, which is a different thing from a missing price', () => {
    expect(readPack(pack([{ name: 'Commuter', swipes: 0, dollars: 0, period: 'week' }])).school!.data.mealPlanTiers).toHaveLength(1);
  });
});

describe('the move-out rule', () => {
  const pack = (housing: unknown) => minimal({ data: { housing } });

  it('reads the rule Vanderbilt uses', () => {
    expect(readPack(pack({ moveOutRule: 'hours_after_last_exam', hoursAfterLastExam: 24 })).school!.data.housing)
      .toEqual({ moveOutRule: 'hours_after_last_exam', hoursAfterLastExam: 24 });
  });

  it('reads a fixed date', () => {
    expect(readPack(pack({ moveOutRule: 'fixed_date', fixedDate: '2026-12-12' })).school!.data.housing)
      .toEqual({ moveOutRule: 'fixed_date', fixedDate: '2026-12-12' });
  });

  it('drops a fixed date that is not a date, rather than a move-out somebody books a flight around', () => {
    const read = readPack(pack({ moveOutRule: 'fixed_date', fixedDate: 'the Saturday after' }));
    expect(read.school!.data.housing).toBeUndefined();
    expect(read.problems[0].says).toContain('YYYY-MM-DD');
  });

  it('keeps the rule but falls back to 24 when the hours are a unit error', () => {
    // 1440 is minutes in a day sent where hours were asked for.
    const read = readPack(pack({ moveOutRule: 'hours_after_last_exam', hoursAfterLastExam: 1440 }));
    expect(read.school!.data.housing).toEqual({ moveOutRule: 'hours_after_last_exam' });
    expect(read.problems[0].says).toContain('fell back to 24');
  });

  it('drops a rule it does not have', () => {
    expect(says(pack({ moveOutRule: 'when the RA says' }))[0]).toContain('fixed_date');
  });
});

describe('capabilities', () => {
  const pack = (capabilities: unknown) => minimal({ capabilities });

  it('reads the six addresses', () => {
    const caps = readPack(pack({ registrarUrl: 'https://yes.example.edu', lmsUrl: 'https://lms.example.edu' })).school!.capabilities;
    expect(caps.registrarUrl).toBe('https://yes.example.edu');
    expect(caps.lmsUrl).toBe('https://lms.example.edu');
  });

  it('says which address it dropped, instead of dropping it silently', () => {
    // This is the difference between a file and a form. Somebody filled this
    // in expecting it to appear on the Links screen; a silent drop is that
    // person never finding out.
    const read = readPack(pack({ registrarUrl: 'yes.example.edu' }));
    expect(read.school!.capabilities.registrarUrl).toBeUndefined();
    // Named the way the rest of the list names things. This read `registrarUrl`
    // until the import was driven in a browser and that one row turned out to
    // be the only line in the list written for a developer.
    expect(read.problems[0].where).toBe('The registrar’s address');
    expect(read.problems[0].says).toContain('https://');
  });

  it('refuses a javascript: address, which is the reason the rule exists', () => {
    // eslint-disable-next-line no-script-url
    const read = readPack(pack({ libraryUrl: 'javascript:alert(1)' }));
    expect(read.school!.capabilities.libraryUrl).toBeUndefined();
    expect(read.problems).toHaveLength(1);
  });

  it('says so when a meal plan type is not one of the four', () => {
    expect(says(pack({ mealPlan: 'unlimited' }))[0]).toContain('"swipes"');
  });

  it('says so when a flag is not a flag', () => {
    expect(says(pack({ campusMap: 'yes' }))[0]).toContain('true or false');
  });

  it('stays quiet about fields nobody filled in', () => {
    expect(readPack(pack({ mealPlan: 'none', housing: false, campusMap: false })).problems).toEqual([]);
  });
});

describe('the grading scale, which is the one branch that is not inert', () => {
  it('names a scale it could not read, because this one decides what a student is told they need', () => {
    const read = readPack(minimal({ data: { gradeSystem: { kind: 'vibes' } } }));
    expect(read.school!.data.gradeSystem).toBeUndefined();
    expect(read.problems[0].where).toBe('Grading scale');
    expect(read.problems[0].says).toContain('common table');
  });

  it('reads a good one', () => {
    const read = readPack(minimal({ data: { gradeSystem: { kind: 'letter', gpaMax: 4, scale: [{ label: 'A', min: 93, gpa: 4 }] } } }));
    expect(read.school!.data.gradeSystem?.kind).toBe('letter');
    expect(read.problems).toEqual([]);
  });
});

describe('when the pack was written', () => {
  it('reads the date', () => {
    expect(readPack(minimal()).importedAt).toBe('2026-08-01');
  });

  it('says so when a pack cannot tell you how old its dates are', () => {
    // A withdrawal deadline from a file written last August is still drawn
    // with total confidence. The date is how somebody can tell.
    const read = readPack(JSON.stringify({ semesterSchoolPack: PACK_VERSION, name: 'Example University' }));
    expect(read.importedAt).toBe('');
    expect(read.problems.some((p) => p.says.includes('importedAt'))).toBe(true);
  });
});

describe('the counts a confirmation screen shows', () => {
  it('counts what was kept, not what was sent', () => {
    const read = readPack(minimal({
      emailDomains: ['example.edu', '@grad.example.edu', '', 7],
      data: {
        academicCalendar: [{
          termName: 'Fall 2026', startsOn: '2026-08-26', endsOn: '2026-12-11',
          deadlines: [{ label: 'Good', on: '2026-09-04' }, { label: 'Bad', on: 'soon' }],
        }],
        buildings: [{ name: 'A', lat: 1, lng: 1 }, { name: 'B', lat: 0, lng: 0 }],
        mealPlanTiers: [{ name: 'A', swipes: 1, dollars: 1, period: 'term' }],
      },
    }));
    expect(read.counts).toEqual({ terms: 1, deadlines: 1, buildings: 1, tiers: 1, domains: 2 });
  });

  it('strips the @ off an email domain somebody pasted with one', () => {
    expect(readPack(minimal({ emailDomains: ['@example.edu'] })).school!.emailDomains).toEqual(['example.edu']);
  });
});

describe('a pack round-trips, which is what makes it an export and not a screenshot', () => {
  it('writes Vanderbilt out and reads it back unchanged', () => {
    // The strongest single check in this file: everything the reader accepts,
    // the writer emits in a form the reader accepts. A field the writer
    // forgot, or a shape the reader refuses, shows up here and nowhere else.
    const read = readPack(writePack(BUNDLED.vanderbilt, '2026-08-01'));
    expect(read.ok).toBe(true);
    expect(read.problems).toEqual([]);
    expect(read.school).toEqual({ ...BUNDLED.vanderbilt, verified: false });
  });

  it('keeps the flags that mean something when false', () => {
    // A pack that left `campusMap: false` out would read back as the same
    // thing, and a reader could not tell "this school has no map" from
    // "nobody answered".
    const written = JSON.parse(writePack({ ...BUNDLED.vanderbilt, capabilities: { ...BUNDLED.vanderbilt.capabilities, campusMap: false, housing: false } }));
    expect(written.capabilities.campusMap).toBe(false);
    expect(written.capabilities.housing).toBe(false);
    expect(written.capabilities.mealPlan).toBeDefined();
  });

  it('writes a date when it is not given one, and it is the device’s own day', () => {
    // `dateToIso` reads local getters. `toISOString().slice(0, 10)` is a UTC
    // date, and the two disagree for a third of every day east of Greenwich:
    // at UTC noon in Kiritimati (UTC+14) the first says the 20th and the
    // second says the 19th. Every other date in this app is a local one.
    expect(JSON.parse(writePack(BUNDLED.vanderbilt)).importedAt).toBe(dateToIso(new Date()));
  });

  it('does not stamp a UTC day on a local calendar', () => {
    /*
     * Structural, because the behavioural check above cannot convict here.
     *
     * The suite's own runs are UTC, where the local day and the UTC day are
     * the same string and a `toISOString().slice(0, 10)` passes. CI's
     * `test:zones` step does run this in Kiritimati — but only catches it
     * when that run happens after 10:00 UTC, which makes it a guard that
     * depends on the time of day somebody pushed. Reading the source instead
     * convicts in every zone and at every hour.
     */
    const src = readFileSync(join(process.cwd(), 'src/lib/schoolpack.ts'), 'utf8');
    const body = (src.split('export function writePack')[1] ?? '').split('\n}')[0];
    // Comments stripped first. The first run of this failed against the
    // comment above the fixed line, which names the call it forbids — a
    // guard that reads prose is a guard that convicts an explanation.
    const code = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/toISOString\(\)\s*\.slice/);
    expect(code).toContain('dateToIso(new Date())');
  });

  it('is readable by `readSchool` too, so an imported profile persists like any other', () => {
    const read = readPack(writePack(BUNDLED.vanderbilt, '2026-08-01'));
    expect(readSchool(read.school)).toEqual(read.school);
  });
});

describe('the template', () => {
  it('reads cleanly, so nobody starts from a file the app would reject', () => {
    const read = readPack(JSON.stringify(PACK_TEMPLATE));
    expect(read.ok).toBe(true);
    expect(read.problems).toEqual([]);
  });

  it('cannot be mistaken for a real school', () => {
    // A template whose example values look real is how a fictional meal plan
    // reaches a screen.
    const t = JSON.stringify(PACK_TEMPLATE);
    expect(PACK_TEMPLATE.name).toContain('replace');
    expect(t).toContain('replace this row');
    expect(t).toContain('example.edu');
  });
});
