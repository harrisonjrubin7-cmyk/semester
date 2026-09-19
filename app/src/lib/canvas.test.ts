import { describe, expect, it, vi } from 'vitest';
import { PROXY_PATH, pull, readKey, standing, type CanvasKey } from './canvas';
import type { Course } from './types';

const KEY: CanvasKey = { host: 'school.instructure.com', token: 'tok' };

const COURSES = [
  { id: 'bus', code: 'BUS 1600', name: 'Marketing Management' },
  { id: 'econ', code: 'ECON 1020', name: 'Principles of Macroeconomics' },
] as Course[];

/** One canned answer, shaped like the bit of `Response` the code touches. */
const answer = (body: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  }) as Response;

/**
 * A fetcher answering each `/api/v1/` path from a table.
 *
 * Keyed on what the *body* asked for rather than on the URL, because every
 * request goes to the same forwarder path — which is the point of the design
 * and would make a URL-keyed stub silently answer everything with the first
 * entry.
 */
const serving = (table: Record<string, unknown>, status = 200) =>
  vi.fn((_url: string, init?: RequestInit) => {
    const asked = JSON.parse(String(init?.body ?? '{}')) as { path?: string };
    const hit = Object.entries(table).find(([path]) => asked.path?.startsWith(path));
    return Promise.resolve(hit ? answer(hit[1], status) : answer({ errors: [{ message: 'no' }] }, 404));
  }) as unknown as typeof fetch;

const ok = (host: string, token: string) => {
  const out = readKey(host, token);
  if (!out.ok) throw new Error(`expected a key, got: ${out.why}`);
  return out.key;
};

describe('readKey', () => {
  it('takes a bare hostname as it is', () => {
    expect(ok('school.instructure.com', 'tok').host).toBe('school.instructure.com');
  });

  it('takes the address bar, which is what people actually paste', () => {
    // Nobody reads "hostname" and types a hostname. They copy whatever was in
    // the bar, which is a whole URL with the course they had open on the end.
    expect(ok('https://school.instructure.com/courses/1234', 'tok').host).toBe('school.instructure.com');
    expect(ok('school.instructure.com/courses/1234/assignments', 'tok').host).toBe('school.instructure.com');
  });

  it('drops www and the case, so two spellings are one host', () => {
    expect(ok('WWW.School.Instructure.COM', 'tok').host).toBe('school.instructure.com');
  });

  it('takes a self-hosted Canvas, because most universities are one', () => {
    expect(ok('canvas.school.edu', 'tok').host).toBe('canvas.school.edu');
  });

  it('refuses a word that is not an address, rather than looking it up', () => {
    const out = readKey('canvas', 'tok');
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.why).toContain('web address');
  });

  it('says which field is missing, separately', () => {
    const noHost = readKey('  ', 'tok');
    expect(noHost.ok).toBe(false);
    if (!noHost.ok) expect(noHost.why).toContain('Which Canvas');
    const noToken = readKey('school.instructure.com', '   ');
    expect(noToken.ok).toBe(false);
    if (!noToken.ok) expect(noToken.why).toContain('token');
  });

  it('does not repair the token, because no edit to it is certainly right', () => {
    // A bare token is what an older self-hosted instance issues. Refusing it
    // for not carrying Canvas's `1234~` prefix would be this file being
    // confident about somebody else's deployment.
    expect(ok('school.instructure.com', 'plainoldtoken').token).toBe('plainoldtoken');
    expect(ok('school.instructure.com', '  1234~abc  ').token).toBe('1234~abc');
  });
});

describe('standing', () => {
  it('carries the number when it is graded, which is the only certain state', () => {
    expect(standing({ workflow_state: 'graded', score: 92 }, 100)).toBe('Graded 92 / 100');
  });

  it('omits the denominator when the assignment has no points', () => {
    expect(standing({ workflow_state: 'graded', score: 3 }, null)).toBe('Graded 3');
  });

  it('says submitted without implying it was any good', () => {
    // Built from local parts rather than written as a UTC instant, and the
    // difference is a real one this test got wrong first: `standing` renders
    // the submission's *local* date, which is the app's convention everywhere
    // and is the date the student sees on their own phone. A hard-coded
    // `2026-09-12T14:00:00Z` is only the 12th for zones behind UTC+10 — it is
    // the 13th in Kiritimati, where `npm run test:zones` runs, so the
    // expectation was about the runner's clock rather than about the code.
    const at = new Date(2026, 8, 12, 14, 0);
    expect(standing({ submitted_at: at.toISOString() }, 100)).toBe('Submitted 2026-09-12');
  });

  it("reports missing as Canvas's own flag", () => {
    expect(standing({ missing: true }, 100)).toContain('Missing');
  });

  it('says nothing at all where there is no submission record', () => {
    // An in-class presentation never gets one and is not late. Calling this
    // "not submitted" would put a red mark on work that was handed over on
    // paper.
    expect(standing(null, 100)).toBe('');
    expect(standing({}, 100)).toBe('');
  });

  it('prefers graded over submitted, since a graded thing was also submitted', () => {
    expect(
      standing({ workflow_state: 'graded', score: 88, submitted_at: '2026-09-12T14:00:00Z' }, 100),
    ).toBe('Graded 88 / 100');
  });
});

describe('pull', () => {
  const courses = [{ id: 7, course_code: 'BUS 1600', name: 'Marketing Management' }];

  it('turns assignments into ordinary feed events, submission state and all', async () => {
    const fetcher = serving({
      '/api/v1/courses?': courses,
      '/api/v1/courses/7/assignments': [
        {
          id: 11,
          name: 'Brand audit',
          due_at: '2026-10-02T15:30:00.000Z',
          points_possible: 100,
          submission: { workflow_state: 'graded', score: 91 },
        },
      ],
    });
    const out = await pull(KEY, COURSES, 'src', { fetcher });
    expect(out.events).toHaveLength(1);
    expect(out.events[0].title).toBe('Brand audit');
    expect(out.events[0].sourceId).toBe('src');
    expect(out.events[0].note).toBe('Graded 91 / 100');
    expect(out.known).toBe(1);
  });

  it('files an assignment against the course its code names', async () => {
    const fetcher = serving({
      '/api/v1/courses?': courses,
      '/api/v1/courses/7/assignments': [{ id: 11, name: 'Brand audit', due_at: '2026-10-02T15:30:00.000Z' }],
    });
    const out = await pull(KEY, COURSES, 'src', { fetcher });
    expect(out.events[0].courseId).toBe('bus');
  });

  it('skips an assignment with no due date, having nowhere on a calendar to put it', async () => {
    const fetcher = serving({
      '/api/v1/courses?': courses,
      '/api/v1/courses/7/assignments': [
        { id: 11, name: 'Participation', due_at: null },
        { id: 12, name: 'Brand audit', due_at: '2026-10-02T15:30:00.000Z' },
      ],
    });
    const out = await pull(KEY, COURSES, 'src', { fetcher });
    expect(out.events.map((e) => e.title)).toEqual(['Brand audit']);
  });

  it("draws Canvas's 23:59 as all day, because it is a deadline and not an appointment", async () => {
    // Canvas's own end-of-day. Drawn as a clock time it reads like something
    // that starts just before midnight, which is not what anybody means by it.
    const due = new Date(2026, 9, 2, 23, 59);
    const fetcher = serving({
      '/api/v1/courses?': courses,
      '/api/v1/courses/7/assignments': [{ id: 11, name: 'Brand audit', due_at: due.toISOString() }],
    });
    const out = await pull(KEY, COURSES, 'src', { fetcher });
    expect(out.events[0].at).toBeNull();
    expect(out.events[0].time).toBe('All day');
  });

  it('keeps the clock on a due time that is a real time', async () => {
    const due = new Date(2026, 9, 2, 15, 30);
    const fetcher = serving({
      '/api/v1/courses?': courses,
      '/api/v1/courses/7/assignments': [{ id: 11, name: 'Brand audit', due_at: due.toISOString() }],
    });
    const out = await pull(KEY, COURSES, 'src', { fetcher });
    expect(out.events[0].at).toBe(15 * 60 + 30);
    expect(out.events[0].time).toBe('3:30p');
  });

  it('keeps the other courses when one of them refuses', async () => {
    // A concluded enrolment answers 401 for its assignments. That is not the
    // pull failing, and an error card in place of the four courses that did
    // answer would be the wrong trade.
    const fetcher = vi.fn((_url: string, init?: RequestInit) => {
      const asked = JSON.parse(String(init?.body ?? '{}')) as { path?: string };
      if (asked.path?.startsWith('/api/v1/courses?')) {
        return Promise.resolve(answer([{ id: 7, course_code: 'BUS 1600' }, { id: 8, course_code: 'ECON 1020' }]));
      }
      if (asked.path?.includes('/courses/7/')) return Promise.resolve(answer({ errors: [{ message: 'nope' }] }, 401));
      return Promise.resolve(answer([{ id: 12, name: 'Problem set 4', due_at: '2026-10-02T15:30:00.000Z' }]));
    }) as unknown as typeof fetch;
    const out = await pull(KEY, COURSES, 'src', { fetcher });
    expect(out.events.map((e) => e.title)).toEqual(['Problem set 4']);
    expect(out.courses).toBe(2);
  });

  it('counts only the assignments that actually know where you stand', async () => {
    // `known` is the number the screen reports, because it is the one thing
    // this route has that the .ics route does not. Counting rows instead would
    // report a figure the calendar link already gives.
    const fetcher = serving({
      '/api/v1/courses?': courses,
      '/api/v1/courses/7/assignments': [
        { id: 11, name: 'Brand audit', due_at: '2026-10-02T15:30:00.000Z', submission: { missing: true } },
        { id: 12, name: 'Presentation', due_at: '2026-10-09T15:30:00.000Z' },
      ],
    });
    const out = await pull(KEY, COURSES, 'src', { fetcher });
    expect(out.events).toHaveLength(2);
    expect(out.known).toBe(1);
  });

  it('sends the token in the body and never in the URL', async () => {
    // A query string is the part of a request that lands in every log on the
    // way, and this token is the whole Canvas account.
    const fetcher = serving({
      '/api/v1/courses?': courses,
      '/api/v1/courses/7/assignments': [],
    });
    await pull(KEY, COURSES, 'src', { fetcher });
    const calls = (fetcher as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    for (const [at, init] of calls) {
      expect(at).toBe(PROXY_PATH);
      expect(at).not.toContain('tok');
      expect(JSON.parse(String(init.body)).token).toBe('tok');
    }
  });

  it('falls back to the account when no forwarder is deployed', async () => {
    // 404 on the forwarder's own path is a static build without one. The
    // account route is the one that works there.
    const fetcher = vi.fn(() => Promise.resolve(answer('not found', 404))) as unknown as typeof fetch;
    const account = vi.fn((_key: CanvasKey, path: string) =>
      Promise.resolve(
        JSON.stringify(
          path.startsWith('/api/v1/courses?')
            ? courses
            : [{ id: 11, name: 'Brand audit', due_at: '2026-10-02T15:30:00.000Z' }],
        ),
      ),
    );
    const out = await pull(KEY, COURSES, 'src', { fetcher, account });
    expect(out.events).toHaveLength(1);
    expect(account).toHaveBeenCalled();
  });

  it("keeps Canvas's own refusal rather than the forwarder's 404", async () => {
    // The forwarder answering 404 says nothing about Canvas. A token Canvas
    // refused is the thing worth reading, and it has to survive the fallback.
    const fetcher = vi.fn(() =>
      Promise.resolve(answer({ errors: [{ message: 'Invalid access token.' }] }, 401)),
    ) as unknown as typeof fetch;
    await expect(pull(KEY, COURSES, 'src', { fetcher })).rejects.toThrow('Invalid access token.');
  });

  it('says what is missing when there is no route at all', async () => {
    const fetcher = vi.fn(() => Promise.resolve(answer('not found', 404))) as unknown as typeof fetch;
    await expect(pull(KEY, COURSES, 'src', { fetcher })).rejects.toThrow(/forwarder|calendar link/i);
  });
});
