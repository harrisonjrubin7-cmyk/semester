import { describe, expect, it } from 'vitest';
import { PACK_VERSION, packCourse, packName, packSummary, provenance, readPack } from './handoff';
import type { CourseModule } from './types';

const module_ = {
  course: {
    id: 'econ',
    code: 'ECON 1020',
    name: 'Principles of Microeconomics',
    prof: 'Prof. Hogue',
    email: 'e@vanderbilt.edu',
    meets: 'MWF 9:05',
    room: 'Calhoun 100',
    credits: '3',
    term: '2026FA',
    source: 'Econ1020-Fall2026.pdf',
  },
  items: [{ id: 'ps1', title: 'Problem Set 1', kind: 'Problem set', month: 8, day: 11 }],
  schedule: [{ days: [1, 3, 5], start: '9:05', end: '9:55', room: 'Calhoun 100' }],
  guide: { code: 'ECON 1020', name: 'Micro', blurb: 'x', mastery: 0, units: [] },
  planMinutes: '45 min',
  frameLabel: 'Exam frames',
} as unknown as CourseModule;

const T0 = 1_757_000_000_000;

describe('what leaves the device', () => {
  it('carries the course, its deadlines and its guide', () => {
    const out = readPack(packCourse(module_, T0));
    expect(out.trouble).toBe('');
    expect(out.module?.course.code).toBe('ECON 1020');
    expect(out.module?.items).toHaveLength(1);
    expect(out.module?.guide).toBeTruthy();
    expect(out.made).toBe(T0);
    expect(out.from).toBe('Econ1020-Fall2026.pdf');
  });

  it('carries nothing the student added to the module afterwards', () => {
    // The payload is built field by field rather than spread, so a field the
    // type grows later is left out until somebody adds it here on purpose.
    // This is the test that fails when that stops being true.
    const withExtras = {
      ...module_,
      done: { ps1: true },
      notes: [{ id: 'n1', body: 'my own notes' }],
      spent: [{ id: 'ps1', minutes: 90 }],
      apiKey: 'sk-ant-secret',
    } as unknown as CourseModule;

    const text = packCourse(withExtras, T0);
    expect(text).not.toContain('my own notes');
    expect(text).not.toContain('sk-ant-secret');
    expect(text).not.toContain('spent');
    expect(Object.keys(readPack(text).module ?? {}).sort()).toEqual([
      'course',
      'frameLabel',
      'guide',
      'items',
      'planMinutes',
      'schedule',
    ]);
  });

  it('keeps the optional parts when they are there', () => {
    const rich = { ...module_, examples: [{ id: 'e1' }], lessons: { 0: { title: 'x' } } };
    const out = readPack(packCourse(rich as unknown as CourseModule, T0));
    expect(out.module?.examples).toHaveLength(1);
    expect(out.module?.lessons).toBeTruthy();
  });

  it('does not mutate what it was handed', () => {
    const copy = JSON.parse(JSON.stringify(module_));
    packCourse(module_, T0);
    expect(module_).toEqual(copy);
  });
});

describe('opening a file that is not one', () => {
  it('says so when it is not JSON at all', () => {
    // A PDF dropped on the wrong control.
    expect(readPack('%PDF-1.4 ...').trouble).toMatch(/not JSON/);
  });

  it('sends a whole backup to the screen that takes one', () => {
    // The commonest wrong file, and the one with somewhere else to go.
    const backup = JSON.stringify({ courses: [], notes: [], version: 2 });
    expect(readPack(backup).trouble).toMatch(/whole backup/);
    expect(readPack(backup).trouble).toMatch(/Bring one back/);
  });

  it('says when it is some other JSON entirely', () => {
    expect(readPack('{"hello":"world"}').trouble).toBe('That file is not a shared course.');
  });

  it('refuses a pack from a newer app rather than half-reading it', () => {
    const ahead = JSON.stringify({
      kind: 'semester.course',
      version: PACK_VERSION + 1,
      module: module_,
    });
    expect(readPack(ahead).trouble).toMatch(/newer version/);
    expect(readPack(ahead).module).toBeNull();
  });

  it('names what is missing rather than failing generically', () => {
    const noCourse = JSON.stringify({ kind: 'semester.course', version: 1, module: {} });
    expect(readPack(noCourse).trouble).toMatch(/missing its course code/);

    const noItems = JSON.stringify({
      kind: 'semester.course',
      version: 1,
      module: { course: module_.course },
    });
    expect(readPack(noItems).trouble).toMatch(/ECON 1020 came through without/);
  });

  it('fills in the parts a hand-edited file left off', () => {
    const thin = JSON.stringify({
      kind: 'semester.course',
      version: 1,
      module: { course: module_.course, items: [], guide: module_.guide },
    });
    const out = readPack(thin);
    expect(out.trouble).toBe('');
    expect(out.module?.schedule).toEqual([]);
    expect(out.module?.planMinutes).toBe('45 min');
  });

  it('cannot smuggle a field in through the file either', () => {
    const sneaky = JSON.stringify({
      kind: 'semester.course',
      version: 1,
      module: { ...module_, apiKey: 'sk-ant-secret', done: { ps1: true } },
    });
    const out = readPack(sneaky);
    expect(out.module).not.toHaveProperty('apiKey');
    expect(out.module).not.toHaveProperty('done');
  });
});

describe('saying where a course came from', () => {
  it('always says it came from somebody else', () => {
    const said = provenance({ module: null, trouble: '', made: 0, from: '', dropped: 0 });
    expect(said).toMatch(/came from someone else/);
    expect(said).toMatch(/Check the dates/);
  });

  it('names the syllabus and how old it is', () => {
    const said = provenance(
      { module: null, trouble: '', made: T0, from: 'Econ1020-Fall2026.pdf', dropped: 0 },
      T0 + 3 * 86_400_000,
    );
    expect(said).toContain('Econ1020-Fall2026.pdf');
    expect(said).toContain('Shared 3 days ago');
  });

  it('says nothing about age for a pack shared today', () => {
    expect(provenance({ module: null, trouble: '', made: T0, from: '', dropped: 0 }, T0 + 3600_000)).not.toMatch(
      /ago/,
    );
  });
});

describe('the filename', () => {
  it('is something you can find in a downloads folder', () => {
    expect(packName('ECON 1020')).toBe('econ-1020.semester.json');
    expect(packName('PSCI 1104 — Sec 02')).toBe('psci-1104-sec-02.semester.json');
  });

  it('never comes out empty', () => {
    expect(packName('  ')).toBe('course.semester.json');
    expect(packName('!!!')).toBe('course.semester.json');
  });
});

describe('deadlines that arrived damaged', () => {
  const pack = (items: unknown[]) =>
    JSON.stringify({
      kind: 'semester.course',
      version: 1,
      made: T0,
      from: 'x.pdf',
      module: { ...module_, items },
    });

  it('fills in the fields the app reads, so a screen does not go white', () => {
    // Found by driving the real app: an item without `dueTime` reaches
    // `readDue`, which calls `.trim()` on undefined, and the whole page
    // blanks. From opening a file somebody sent you.
    const out = readPack(pack([{ id: 'a', title: 'Essay 1', kind: 'Essay', month: 9, day: 20 }]));
    expect(out.module?.items[0].dueTime).toBe('');
    expect(out.module?.items[0].weight).toBe('');
    expect(out.dropped).toBe(0);
  });

  it('files every item against the course in the pack, not the one it claims', () => {
    // Otherwise a pack whose items point at another course id files deadlines
    // against a course that is not there.
    const out = readPack(pack([{ title: 'Essay', month: 9, day: 20, c: 'somewhere-else' }]));
    expect(out.module?.items[0].c).toBe('econ');
  });

  it('drops what cannot be repaired, and counts it', () => {
    const out = readPack(
      pack([
        { title: 'Essay 1', month: 9, day: 20 },
        { title: '', month: 9, day: 20 },
        { title: 'No date' },
        { title: 'Impossible', month: 40, day: 99 },
        'not an object',
      ]),
    );
    expect(out.module?.items).toHaveLength(1);
    expect(out.dropped).toBe(4);
  });

  it('says so, rather than quietly showing a course short of two deadlines', () => {
    const out = readPack(pack([{ title: 'Kept', month: 9, day: 20 }, { title: '' }]));
    expect(provenance(out)).toMatch(/1 deadline in the file could not be read/);
  });

  it('gives an item with no id one, so it can be ticked off', () => {
    const out = readPack(pack([{ title: 'Essay 1', month: 9, day: 20 }]));
    expect(out.module?.items[0].id).toBeTruthy();
  });
});

describe('a meeting pattern that arrived damaged', () => {
  const withSchedule = (schedule: unknown[]) =>
    JSON.stringify({
      kind: 'semester.course',
      version: 1,
      module: { ...module_, schedule },
    });

  it('fills in the strings the screens read', () => {
    // Found by driving the real app: a block with no `meta` reached `roomOf`,
    // which split it, and the Gap screen rendered as a blank page.
    const out = readPack(withSchedule([{ days: [1, 3], at: 545 }]));
    expect(out.module?.schedule[0].meta).toBe('');
    expect(out.module?.schedule[0].time).toBe('');
    expect(out.module?.schedule[0].title).toBe('');
  });

  it('drops a block that cannot be placed at all', () => {
    const out = readPack(
      withSchedule([
        { days: [1, 3], at: 545, meta: 'Buttrick 101' },
        { days: [], at: 600 },
        { at: 600 },
        { days: [2], at: 'lunchtime' },
        null,
      ]),
    );
    expect(out.module?.schedule).toHaveLength(1);
  });

  it('throws out a day that is not a day of the week', () => {
    const out = readPack(withSchedule([{ days: [1, 9, -2, 4], at: 545 }]));
    expect(out.module?.schedule[0].days).toEqual([1, 4]);
  });
});

describe('a course that arrived without its grading', () => {
  it('gets an empty list rather than blanking the course screen', () => {
    // Found by driving the real app. `course` was the one thing passed through
    // with a spread rather than rebuilt, and the course screen maps over
    // `grading` — so a pack without it rendered a white page.
    const out = readPack(
      JSON.stringify({
        kind: 'semester.course',
        version: 1,
        module: { ...module_, course: { id: 'econ', code: 'ECON 1020' } },
      }),
    );
    expect(out.trouble).toBe('');
    expect(out.module?.course.grading).toEqual([]);
    expect(out.module?.course.prof).toBe('');
  });

  it('keeps the grading when it is there', () => {
    const withGrades = {
      ...module_,
      course: { ...module_.course, grading: [{ what: 'Problem sets', pct: '20%' }] },
    } as unknown as CourseModule;
    expect(readPack(packCourse(withGrades)).module?.course.grading).toEqual([
      { what: 'Problem sets', pct: '20%' },
    ]);
  });

  it('carries the AI policy, which is what the drafting tool checks', () => {
    const withPolicy = {
      ...module_,
      course: { ...module_.course, ai: { stance: 'limited', note: 'Cite any use.' } },
    } as unknown as CourseModule;
    expect(readPack(packCourse(withPolicy)).module?.course.ai).toEqual({
      stance: 'limited',
      note: 'Cite any use.',
    });
  });
});

describe('the line above the preview', () => {
  it('counts what is in the file, in the shape the preview expects', () => {
    // The provenance used to land in this slot, which is a short uppercase
    // kicker — three sentences of prose rendered as a shouted strip.
    const out = readPack(packCourse(module_, T0));
    expect(packSummary(out)).toBe('Shared file · 0 units, 0 cards, 1 dated obligations.');
  });

  it('is empty when there is nothing to summarise', () => {
    expect(packSummary(readPack('nonsense'))).toBe('');
  });
});
