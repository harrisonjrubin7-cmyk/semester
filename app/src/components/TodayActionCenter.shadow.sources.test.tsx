// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSeed } from '../data/seed';
import type { OfficeAction } from '../lib/office-actions';
import { EMPTY_REGISTRATION_DAY, REGISTRATION_DAY_KEY } from '../lib/registration-day';
import { STORAGE_KEY } from '../state/shape';
import { StoreProvider, useStore } from '../state/store';

/**
 * The three sources the shadow used to excuse, each on the real Action Center:
 * class meetings, Registration Day Mode, and the campus office feed.
 *
 * The sample semester at a pinned Tuesday with classes and two deadlines; the
 * registration plan is switched on in the device's own storage; the office feed
 * is the one thing mocked, because it is a network call. The shadow must agree
 * with what the Action Center ranked and drew — and, so that agreement is not
 * vacuous, the comparison must be seen to have *contained* a class, a
 * registration action and an office action.
 */

const OFFICE: OfficeAction[] = [
  {
    id: 'fa1', office: 'financial_aid', officeLabel: 'Financial Aid', type: 'deadline', audience: 'tenant', program: null, eligibility: null,
    title: 'Verify your aid file', why: 'Aid is held until it is verified.', dueAt: new Date(2026, 8, 30, 17).getTime(), url: 'https://example.edu/aid',
    sourceNote: 'Aid checklist', updatedAt: new Date(2026, 8, 1).getTime(), publishedAt: null, doneAt: null,
  },
];

vi.mock('../lib/office-actions-remote', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/office-actions-remote')>()),
  myOfficeActions: async () => OFFICE,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
const { TodayActionCenter } = await import('./TodayActionCenter');
await import('../composition/TodayShadow');

beforeAll(async () => {
  window.matchMedia = (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
  await loadSeed();
});
afterAll(() => vi.useRealTimers());

beforeEach(() => {
  vi.stubEnv('VITE_TODAY_SHADOW', 'on');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 29, 10, 0)); // Tuesday 29 Sep 2026
  localStorage.clear();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 6 }));
  warn.mockClear();
  debug.mockClear();
  host = document.createElement('div');
  host.className = 'device';
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

function Adopt() {
  const { adopt } = useStore();
  useEffect(() => adopt(), [adopt]);
  return null;
}

const mount = async (props: { registrationDay?: boolean; officeActions?: boolean; officeAccountId?: string | null }) => {
  await act(async () => {
    root.render(
      <StoreProvider>
        <Adopt />
        <TodayActionCenter {...props} />
      </StoreProvider>,
    );
  });
  // The office feed is a promise, then the shadow's view is another, then the effects they feed.
  for (let i = 0; i < 4; i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
};

const findings = () => warn.mock.calls.filter((c) => String(c[0]).includes('[today-shadow]'));
const agreed = () => debug.mock.calls.filter((c) => String(c[0]).includes('agrees with the Action Center')).map((c) => c[1] as { explained: string[]; day: string[]; ranked: string[] });

describe('the shadow, with every source the Action Center ranks', () => {
  it('agrees on class meetings, and the comparison contained them', async () => {
    await mount({});
    expect(findings(), JSON.stringify(findings())).toEqual([]);
    expect(agreed().at(-1)!.explained).toEqual([]);
    expect(agreed().flatMap((a) => a.day).some((k) => k.startsWith('class:2026-09-29:'))).toBe(true);
  });

  it('agrees with Registration Day Mode on, and the comparison contained a registration action', async () => {
    localStorage.setItem(REGISTRATION_DAY_KEY, JSON.stringify({ ...EMPTY_REGISTRATION_DAY, opensAt: '2026-09-30T08:00', manual: true }));
    await mount({ registrationDay: true });
    expect(findings(), JSON.stringify(findings())).toEqual([]);
    expect(agreed().at(-1)!.explained).toEqual([]);
    expect(agreed().flatMap((a) => a.ranked).some((id) => id.startsWith('regday:'))).toBe(true);
  });

  it('agrees with the campus office feed on, and the comparison contained an office action', async () => {
    await mount({ officeActions: true, officeAccountId: 'u1' });
    expect(findings(), JSON.stringify(findings())).toEqual([]);
    expect(agreed().at(-1)!.explained).toEqual([]);
    expect(agreed().flatMap((a) => a.ranked).some((id) => id === 'office:fa1')).toBe(true);
  });

  it('agrees that a registration plan in storage proposes nothing while the mode is not surfaced', async () => {
    localStorage.setItem(REGISTRATION_DAY_KEY, JSON.stringify({ ...EMPTY_REGISTRATION_DAY, opensAt: '2026-09-30T08:00', manual: true }));
    await mount({ registrationDay: false });
    expect(findings(), JSON.stringify(findings())).toEqual([]);
    expect(agreed().flatMap((a) => a.ranked).some((id) => id.startsWith('regday:'))).toBe(false);
  });

  it('agrees with all of them at once', async () => {
    localStorage.setItem(REGISTRATION_DAY_KEY, JSON.stringify({ ...EMPTY_REGISTRATION_DAY, opensAt: '2026-09-30T08:00', manual: true }));
    await mount({ registrationDay: true, officeActions: true, officeAccountId: 'u1' });
    expect(findings(), JSON.stringify(findings())).toEqual([]);
    const ids = agreed().flatMap((a) => [...a.ranked, ...a.day]);
    for (const prefix of ['regday:', 'office:', 'class:']) expect(ids.some((id) => id.startsWith(prefix)), prefix).toBe(true);
  });
});
