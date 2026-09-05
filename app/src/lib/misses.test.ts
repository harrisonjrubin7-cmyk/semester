import { describe, expect, it } from 'vitest';
import { SLIPPING_ABSENCES, SLIPPING_DAYS, misses, missesLine } from './misses';
import { NO_POLICY, type AttendPolicy, type Attended } from './attend';

const now = new Date(2026, 8, 20);
const day = (back: number) => {
  const d = new Date(2026, 8, 20 - back);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const absent = (courseId: string, back: number): Attended => ({
  id: `${courseId}:${day(back)}`,
  courseId,
  date: day(back),
  mark: 'absent',
  at: 0,
});

const policy = (over: Partial<AttendPolicy> = {}): AttendPolicy => ({
  ...NO_POLICY,
  allowed: 3,
  penaltyPer: 2,
  note: 'Three absences allowed; 2% per absence after that.',
  ...over,
});

const code = (id: string) => id.toUpperCase();
const run = (
  ids: string[],
  policies: Record<string, AttendPolicy | undefined>,
  log: Attended[],
) => misses(ids, policies, log, code, now);

describe('a course that never stated a rule', () => {
  it('produces nothing at all', () => {
    // Every field of a policy is zero by default and zero means the syllabus
    // was silent. A warning built on that would be a warning about nothing.
    const log = [absent('econ', 1), absent('econ', 3), absent('econ', 5)];
    expect(run(['econ'], {}, log)).toEqual([]);
    expect(run(['econ'], { econ: NO_POLICY }, log)).toEqual([]);
  });
});

describe('one absence left', () => {
  it('says so, names the course, and names what the next one costs', () => {
    const log = [absent('core', 2), absent('core', 6)];
    // Two in a fortnight also raises the run signal, which is a separate
    // fact — see the test below that insists on both.
    const close = run(['core'], { core: policy() }, log).find(
      (m) => m.kind === 'attendance-close',
    );
    expect(close).toBeDefined();
    expect(close?.says).toContain('CORE');
    expect(close?.says).toContain('one absence left');
    expect(close?.says).toContain('2%');
  });

  it('is not raised while there is room', () => {
    expect(run(['core'], { core: policy() }, [absent('core', 2)])).toEqual([]);
  });

  it('reads differently at none left than at one left', () => {
    const log = [absent('core', 2), absent('core', 6), absent('core', 30)];
    const got = run(['core'], { core: policy() }, log);
    expect(got[0].says).toContain('no absences left');
  });
});

describe('past the allowance', () => {
  it('states the percentage already lost', () => {
    const log = [1, 5, 9, 13, 40].map((b) => absent('econ', b));
    const got = run(['econ'], { econ: policy() }, log);
    const over = got.find((m) => m.kind === 'attendance-over');
    expect(over?.cost).toBe(4);
    expect(over?.says).toContain('4%');
    expect(over?.says).toContain('2 absences past');
  });

  it('does not invent a penalty a syllabus never stated', () => {
    // A course can allow three and say nothing about the fourth. Naming a
    // percentage there would be naming a number nobody wrote.
    const log = [1, 5, 9, 13].map((b) => absent('econ', b));
    const got = run(['econ'], { econ: policy({ penaltyPer: 0, worth: 5 }) }, log);
    const over = got.find((m) => m.kind === 'attendance-over');
    expect(over?.cost).toBe(0);
    expect(over?.says).not.toMatch(/\d+% of the final grade already gone/);
    expect(over?.says).toMatch(/professor/);
  });
});

describe('a run of them', () => {
  it('is raised on two inside the fortnight', () => {
    const log = [absent('bus', 1), absent('bus', 10)];
    const got = run(['bus'], { bus: policy({ allowed: 9 }) }, log);
    expect(got.map((m) => m.kind)).toEqual(['attendance-slipping']);
    expect(got[0].says).toContain(`${SLIPPING_ABSENCES} absences in the last ${SLIPPING_DAYS} days`);
  });

  it('ignores absences older than the window', () => {
    const log = [absent('bus', 1), absent('bus', 40)];
    expect(run(['bus'], { bus: policy({ allowed: 9 }) }, log)).toEqual([]);
  });

  it('is a pattern rather than a verdict', () => {
    const got = run(['bus'], { bus: policy({ allowed: 9 }) }, [absent('bus', 1), absent('bus', 4)]);
    expect(got[0].says.toLowerCase()).not.toMatch(/you should|must|need to/);
  });

  it('is raised alongside the allowance signals, not instead of them', () => {
    // Two different facts. Somebody may be close to the allowance without a
    // recent run, or have a run with plenty of room left.
    const log = [absent('core', 1), absent('core', 4)];
    const got = run(['core'], { core: policy({ allowed: 3 }) }, log);
    expect(got.map((m) => m.kind).sort()).toEqual(['attendance-close', 'attendance-slipping']);
  });
});

describe('the order', () => {
  it('puts what is spent above what is at risk', () => {
    // Grade impact, not recency: an attendance penalty already taken outranks
    // one that has not happened yet, whichever course is sooner.
    const log = [
      ...[1, 5, 9, 13].map((b) => absent('econ', b)),
      absent('core', 2),
      absent('core', 6),
    ];
    const got = run(['core', 'econ'], { core: policy(), econ: policy() }, log);
    expect(got[0].kind).toBe('attendance-over');
    expect(got[0].courseId).toBe('econ');
  });

  it('ranks two overruns by how much each has cost', () => {
    const log = [
      ...[1, 4, 7, 10, 13, 16].map((b) => absent('econ', b)),
      ...[2, 5, 8, 40].map((b) => absent('bus', b)),
    ];
    const got = run(['bus', 'econ'], { bus: policy(), econ: policy() }, log)
      .filter((m) => m.kind === 'attendance-over')
      .map((m) => m.courseId);
    expect(got).toEqual(['econ', 'bus']);
  });
});

describe('the heading', () => {
  it('says nothing when there is nothing to say', () => {
    expect(missesLine([])).toBe('');
  });

  it('names the total already spent', () => {
    const log = [1, 5, 9, 13].map((b) => absent('econ', b));
    expect(missesLine(run(['econ'], { econ: policy() }, log))).toContain('2%');
  });

  it('says it is cheap to fix when nothing has been lost yet', () => {
    const log = [absent('core', 2), absent('core', 6)];
    expect(missesLine(run(['core'], { core: policy() }, log))).toMatch(/cheaper/i);
  });
});
