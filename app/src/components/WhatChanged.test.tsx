// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSeed } from '../data/seed';
import type { CourseModule } from '../lib/types';
import { STORAGE_KEY } from '../state/shape';
import { StoreProvider, useStore } from '../state/store';
import { WhatChanged } from './WhatChanged';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * "What changed" on screen: silent on a first reading and in the sample, and
 * once a deadline has moved it shows before, now, effective date, source,
 * impact and action — until "Got it" moves the acknowledged reading.
 */

const item = (day: number) => ({
  id: 'mid', c: 'econ', title: 'Midterm', kind: 'Exam', month: 9, day, year: 2026,
  dueTime: '11:59 PM', weight: '25%', where: '', detail: '', quote: 'Midterm is on the 20th', source: 'Syllabus', checked: { confirmed: true, page: 3 },
});
const ECON = (day: number): CourseModule =>
  ({
    course: { id: 'econ', code: 'ECON 1010', name: 'Econ', prof: '', email: '', meets: '', room: '', credits: '', source: 'syllabus.pdf', grading: [], term: '2026FA', ai: { stance: 'allowed', note: '' } },
    items: [item(day)],
    schedule: [],
    guide: { code: 'ECON 1010', name: 'Econ', blurb: '', source: '', mastery: 0, audio: false, terms: [], units: [] },
    planMinutes: '45 min',
    frameLabel: 'Frames',
  }) as unknown as CourseModule;

let host: HTMLDivElement;
let root: Root;
let saved: Record<string, unknown[]> | null = null;
function Probe() {
  const { state } = useStore();
  useEffect(() => {
    saved = state.deadlineSeen as unknown as Record<string, unknown[]>;
  });
  return null;
}

const seed = (extra: Record<string, unknown> = {}) =>
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ schemaVersion: 6, seenOnboarding: true, sample: false, courses: [ECON(20)], ...extra }),
  );
const text = () => (host.textContent ?? '').replace(/\s+/g, ' ');
const render = async (node: React.ReactNode) => {
  await act(async () => root.render(<StoreProvider>{node}<Probe /></StoreProvider>));
};

beforeAll(async () => {
  await loadSeed();
});
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 27, 10, 0));
  window.location.hash = '';
  window.matchMedia = (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
  localStorage.clear();
  host = document.createElement('div');
  host.className = 'device';
  document.body.append(host);
  root = createRoot(host);
  saved = null;
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
  vi.useRealTimers();
});

describe('What changed', () => {
  it('says nothing on a first reading, and remembers the reading silently', async () => {
    seed();
    await render(<WhatChanged />);
    expect(text()).toBe('');
    expect(saved?.econ).toHaveLength(1);
  });

  it('says nothing in the sample semester', async () => {
    seed({ sample: true, deadlineSeen: { econ: [{ ...item(8), day: 8 }] } });
    await render(<WhatChanged />);
    expect(text()).not.toContain('What changed');
  });

  it('shows a moved date with before, now, effective, source, impact and action, then clears on Got it', async () => {
    seed({ deadlineSeen: { econ: [item(8)] } });
    await render(<WhatChanged />);
    const t = text();
    expect(t).toContain('What changed');
    expect(t).toContain('Midterm · Date moved');
    expect(t).toContain('BeforeOct 8');
    expect(t).toContain('NowOct 20');
    expect(t).toContain('EffectiveOct 20, 2026');
    expect(t).toContain('Syllabus, p. 3: "Midterm is on the 20th"');
    expect(t).toContain('12 days later');
    expect(t).toContain('You canYour plan for the old date can move');
    const got = [...host.querySelectorAll('button')].find((b) => /got it/i.test(b.textContent ?? ''))!;
    await act(async () => got.click());
    expect(text()).toBe('');
    expect(((saved as Record<string, unknown[]>).econ[0] as { day: number }).day).toBe(20);
  });

  it('on Course Home shows only that course', async () => {
    seed({ deadlineSeen: { econ: [item(8)] } });
    await render(<WhatChanged courseId="hist" />);
    expect(text()).toBe('');
  });
});
