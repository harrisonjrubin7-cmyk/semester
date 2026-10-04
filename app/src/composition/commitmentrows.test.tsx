// @vitest-environment jsdom
import { act, useEffect, useMemo } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSeed } from '../data/seed';
import type { FeatureState } from '../intelligence/contracts';
import { legacyCommitmentRows } from '../lib/commitment-rows';
import { dateToIso } from '../lib/date';
import { upcomingItems } from '../lib/select';
import { ownedScope } from '../lib/standing';
import type { CommitmentRow } from '../lib/today-center';
import { STORAGE_KEY } from '../state/shape';
import { StoreProvider, useNow, useStore } from '../state/store';
import { chooseRows, differences, useCommitmentRowsWithSource, type RowSource } from './commitmentrows';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const row = (id: string, at: number, over: Partial<CommitmentRow> = {}): CommitmentRow => ({ id, at, title: id, meta: 'm', kind: 'task', source: 'student_entered', ...over });
const NOW = new Date(2026, 8, 27, 10, 0).getTime();

describe('which rows draw', () => {
  const legacy = [row('a', NOW + 1)];
  const domain = { rows: [row('a', NOW + 1), row('b', NOW + 2)], current: true };

  it('is the screen’s own unless the flag is production and the domain’s are current and complete', () => {
    for (const flag of ['off', 'preview', 'sandbox'] as const) expect(chooseRows(flag, legacy, domain)).toEqual({ rows: legacy, source: 'legacy' });
    expect(chooseRows('production', legacy, domain)).toEqual({ rows: domain.rows, source: 'domain' });
  });

  it('falls back to the screen’s own for an answer still loading, built from older state, or missing a record', () => {
    expect(chooseRows('production', legacy, null).source).toBe('legacy');
    expect(chooseRows('production', legacy, { ...domain, current: false }).source).toBe('legacy');
    expect(chooseRows('production', legacy, { rows: null, current: true }).source).toBe('legacy');
  });
});

describe('where the domain’s rows differ', () => {
  const a = row('a', NOW + 10);
  it('is nothing for equal rows, in any order', () => {
    expect(differences([a, row('b', NOW + 20)], [row('b', NOW + 20), a], NOW)).toEqual([]);
  });
  it('names a row only the screen has, and a row drawn differently', () => {
    expect(differences([a], [], NOW)).toEqual(['only on screen: a']);
    expect(differences([a], [{ ...a, meta: 'other' }], NOW)).toEqual(['differs: a']);
  });
  it('names a row only the domain has when it is still to come, and not when it is already past', () => {
    expect(differences([], [row('later', NOW + 3_600_000)], NOW)).toEqual(['only in the domain: later']);
    expect(differences([], [row('earlier', NOW - 3_600_000)], NOW)).toEqual([]);
    expect(differences([], [row('just-now', NOW - 30_000)], NOW)).toEqual(['only in the domain: just-now']);
  });
});

// ── mounted, in a real store ───────────────────────────────────────────────

let host: HTMLDivElement;
let root: Root;
let store: ReturnType<typeof useStore>;
let seen: { source: RowSource; ids: string[]; rows: CommitmentRow[]; legacy: CommitmentRow[] }[] = [];
const log = vi.fn();

beforeAll(async () => {
  await loadSeed();
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 27, 10, 0));
  localStorage.clear();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 6 }));
  seen = [];
  log.mockClear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

// No root outlives the test that made it. See `src/rootunmount.test.ts`.
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
  vi.useRealTimers();
});

function Adopt() {
  const { adopt } = useStore();
  useEffect(() => adopt(), [adopt]);
  return null;
}

function Probe({ flag, tamper }: { flag: FeatureState; tamper?: (rows: CommitmentRow[]) => CommitmentRow[] }) {
  const s = useStore();
  const now = useNow();
  const { state, catalog } = s;
  useEffect(() => { store = s; });
  const ownIds = useMemo(() => state.courses.map((c) => c.course.id), [state.courses]);
  const upcoming = useMemo(() => ownedScope(upcomingItems(catalog, now), ownIds, state.sample, catalog.empty).items, [catalog, now, ownIds, state.sample]);
  const legacy = useMemo(
    () => legacyCommitmentRows({ catalog, now, ownIds, sample: state.sample, tasks: state.tasks, appointments: state.appointments, done: state.done, upcoming }),
    [catalog, now, ownIds, state.appointments, state.done, state.sample, state.tasks, upcoming],
  );
  const used = useCommitmentRowsWithSource(tamper ? tamper(legacy) : legacy, flag, log);
  useEffect(() => { seen.push({ source: used.source, ids: used.rows.map((r) => r.id), rows: used.rows, legacy }); });
  return null;
}

const mount = async (flag: FeatureState, tamper?: (rows: CommitmentRow[]) => CommitmentRow[]) => {
  await act(async () => {
    root.render(
      <StoreProvider>
        <Adopt />
        <Probe flag={flag} tamper={tamper} />
      </StoreProvider>,
    );
  });
  await settle();
};
/**
 * The domains load by dynamic import and answer by promise: let both finish, inside `act`.
 * With `until`, wait for that to be true instead of for a fixed time: the first test in a file
 * pays for transforming the whole composition root, which takes longer than any short wait.
 */
const settle = async (until?: () => boolean) => {
  const tries = until ? 200 : 6;
  for (let i = 0; i < tries; i++) {
    if (until?.()) return;
    await act(async () => void (await new Promise((r) => setTimeout(r, 25))));
  }
};
const drawnFromDomain = () => seen.at(-1)?.source === 'domain';
const today = dateToIso(new Date(2026, 8, 27));
const add = (title: string, time = '') => act(async () => store.dispatch({ type: 'addTask', task: { title, date: today, time, note: '', courseId: null } }));

describe('mounted, in a real store at a pinned time', () => {
  it('off: always the screen’s own rows, and it never fetches the domains', async () => {
    await mount('off');
    await add('Probe');
    await settle();
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((s) => s.source === 'legacy')).toBe(true);
    expect(seen.at(-1)!.ids.some((id) => id.startsWith('task:'))).toBe(true);
    expect(log).not.toHaveBeenCalled();
  });

  it('production: the domain’s rows draw once loaded, and they are the same rows the screen would have drawn', async () => {
    await mount('production');
    await settle(drawnFromDomain);
    await add('Probe', '6:30 PM');
    await settle(() => drawnFromDomain() && seen.at(-1)!.ids.some((id) => id.startsWith('task:')));
    const last = seen.at(-1)!;
    expect(last.source).toBe('domain');
    // The control, in the same render: the screen's own rows for the same state. Inside the window `planCommitments`
    // reads they are identical; outside it the domain may hold a deadline already past today, which is discarded.
    const inWindow = (rows: CommitmentRow[]) => rows.filter((r) => r.at >= NOW - 60_000).sort((x, y) => x.id.localeCompare(y.id));
    expect(inWindow(last.rows).length).toBeGreaterThan(0);
    expect(inWindow(last.rows).some((r) => r.kind === 'task')).toBe(true);
    expect(inWindow(last.rows)).toEqual(inWindow(last.legacy));
  });

  it('preview: a re-ask that finds the same difference does not say it again', async () => {
    const drop = (rows: CommitmentRow[]) => rows.filter((r) => !r.id.startsWith('task:'));
    await mount('sandbox', drop);
    await add('Probe', '9 PM');
    await settle(() => log.mock.calls.some((c) => String(c[0]).includes('[domainToday]')));
    await settle();
    const before = log.mock.calls.filter((c) => String(c[0]).includes('[domainToday]')).length;
    expect(before).toBeGreaterThanOrEqual(1);
    // An appointment a month away moves what the rows depend on, so the domain is asked again, and finds what it found.
    const far = dateToIso(new Date(2026, 9, 30));
    await act(async () => store.dispatch({ type: 'addAppointment', appointment: { title: 'Far', date: far, at: 600, time: '10:00 AM', where: '', note: '' } }));
    await settle();
    await settle();
    expect(log.mock.calls.filter((c) => String(c[0]).includes('[domainToday]')).length).toBe(before);
  });

  it('production: after a change it never draws a domain answer built before it', async () => {
    await mount('production');
    await settle(drawnFromDomain);
    expect(seen.at(-1)!.source).toBe('domain');
    seen = [];
    await add('Fresh one');
    await settle(() => drawnFromDomain() && seen.at(-1)!.ids.some((id) => id.startsWith('task:')));
    const fresh = (ids: string[]) => ids.some((id) => id.startsWith('task:'));
    for (const s of seen) if (s.source === 'domain') expect(fresh(s.ids), 'a stale domain answer was drawn').toBe(true);
    expect(seen.at(-1)!.source).toBe('domain');
    expect(fresh(seen.at(-1)!.ids)).toBe(true);
  });

  it('preview: the screen’s rows draw, and agreement says nothing', async () => {
    await mount('preview');
    await add('Probe');
    await settle();
    expect(seen.every((s) => s.source === 'legacy')).toBe(true);
    expect(log).not.toHaveBeenCalled();
  });

  it('preview: a real disagreement is reported, once, with the rows named', async () => {
    // The screen's own rows with its first task row removed: the domain still has it.
    const drop = (rows: CommitmentRow[]) => rows.filter((r) => !r.id.startsWith('task:'));
    await mount('sandbox', drop);
    await add('Probe', '9 PM');
    await settle();
    await add('Another', '9:30 PM');
    await settle();
    const calls = log.mock.calls.filter((c) => String(c[0]).includes('[domainToday]'));
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect((calls[0][1] as string[]).some((m) => m.startsWith('only in the domain: task:'))).toBe(true);
    const distinct = new Set(calls.map((c) => JSON.stringify(c[1])));
    expect(distinct.size).toBe(calls.length);
  });
});
