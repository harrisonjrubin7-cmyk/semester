// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { loadSeed } from '../data/seed';
import type { Entry } from '../domains/calendar';
import { fixedClock } from '../domains/kernel';
import { buildToday, type TodayView } from '../domains/today';
import { isoToDate } from '../lib/date';
import type { DatedItem } from '../lib/types';
import { STORAGE_KEY } from './shape';
import { StoreProvider } from './store';
import { cutOver, deadlinesToday, useTodayView } from './todayview';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Step 4: who decides which deadlines are due today.
 *
 * With a domain view the answer is the domain's, in the domain's order, drawn
 * from the legacy rows. These hold the three ways that can go wrong: the domain
 * not being asked at all, being asked and refusing, and naming something the
 * screen has nothing to draw.
 */
const row = (id: string): DatedItem =>
  ({ id, c: 'econ', title: id, kind: 'Essay', month: 8, day: 9, dueTime: '', weight: '', where: '', detail: '', quote: '', source: '',
    date: isoToDate('2026-09-09'), dueShort: 'Today', dow: 'Wed', mon: 'Sep', isToday: true, isPast: false, daysAway: 0, dueAt: 1440 }) as DatedItem;
const entry = (id: string, startMin: number | null): Entry => ({
  id: `deadline:${id}`, kind: 'deadline', title: id, day: '2026-09-09', startMin, endMin: null, courseId: null, source: 'entered',
});
const viewOf = (entries: Entry[]): TodayView => {
  const r = buildToday({ clock: fixedClock('2026-09-09', 0), can: () => ({ allow: true, obligations: [] }), entries, tasks: [] });
  if (!r.ok) throw new Error('fixture');
  return r.value;
};

describe('deadlinesToday', () => {
  const legacy = [row('a'), row('b'), row('c')];

  it('is the legacy list when there is no domain view', () => {
    expect(deadlinesToday(null, legacy)).toBe(legacy);
  });

  it('takes the domain’s order, not the selector’s', () => {
    // Legacy lists a, b, c. The domain puts c (9:00) before a (10:00), with b untimed last.
    const view = viewOf([entry('a', 600), entry('b', null), entry('c', 540)]);
    expect(deadlinesToday(view, legacy).map((i) => i.id)).toEqual(['c', 'a', 'b']);
  });

  it('draws the legacy row, not a copy of it', () => {
    const picked = deadlinesToday(viewOf([entry('a', 600)]), legacy);
    expect(picked[0]).toBe(legacy[0]);
  });

  it('lets the domain leave one out, because the domain is now the authority', () => {
    expect(deadlinesToday(viewOf([entry('a', 600), entry('c', 540)]), legacy).map((i) => i.id)).toEqual(['c', 'a']);
  });

  it('falls back whole when the domain names something the screen cannot draw', () => {
    expect(deadlinesToday(viewOf([entry('a', 600), entry('ghost', 540)]), legacy)).toBe(legacy);
  });
});

describe('the cutover flag', () => {
  it('is production, and only production', () => {
    expect(cutOver('production')).toBe(true);
    for (const s of ['off', 'preview', 'sandbox'] as const) expect(cutOver(s)).toBe(false);
  });
});

describe('useTodayView in a real store', () => {
  let host: HTMLDivElement;
  let root: Root;
  let seen: TodayView | null | undefined;

  function Probe({ flag }: { flag: 'off' | 'preview' | 'production' }) {
    const view = useTodayView(flag);
    useEffect(() => {
      seen = view;
    });
    return null;
  }

  beforeAll(async () => {
    await loadSeed();
  });

  beforeEach(async () => {
    seen = undefined;
    host = document.createElement('div');
    document.body.append(host);
    await act(async () => {
      root = createRoot(host);
    });
  });

  // No root outlives the test that made it. See `src/rootunmount.test.ts`.
  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    localStorage.clear();
  });

  async function mount(flag: 'off' | 'preview' | 'production', saved: object = {}) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 6, ...saved }));
    await act(async () => {
      root.render(
        <StoreProvider>
          <Probe flag={flag} />
        </StoreProvider>,
      );
    });
  }

  it('gives a student the domain’s Today at production', async () => {
    await mount('production', { role: 'student' });
    expect(seen).not.toBeNull();
    expect(seen?.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('gives nothing when the flag is off or only previewing', async () => {
    await mount('off');
    expect(seen).toBeNull();
    await mount('preview');
    expect(seen).toBeNull();
  });

  it('gives nothing to a role the domain does not serve, so the screen stays on the legacy path', async () => {
    await mount('production', { role: 'faculty' });
    expect(seen).toBeNull();
  });
});
