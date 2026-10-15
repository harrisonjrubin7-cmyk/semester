// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSeed } from '../data/seed';
import type { CheckIn } from '../lib/advisor-checkins';
import { STORAGE_KEY } from '../state/shape';
import { StoreProvider } from '../state/store';

const recorded: { share: string; note: string; steps: string[]; key: string }[] = [];
let failNext = false;
let listed: { shares: unknown[]; events: unknown[] } = { shares: [], events: [] };
let checkIns: CheckIn[] = [];

vi.mock('../lib/advisor-shares', async (importOriginal) => {
  const real = await importOriginal<typeof import('../lib/advisor-shares')>();
  return {
    ...real,
    myShares: vi.fn(async () => listed),
    sharedWithMe: vi.fn(async () => [
      { id: 'in-1', title: 'Spring planning', shared_as: 'Riley', created_at: '2026-09-20T07:00:00Z', expires_at: '2099-01-01T07:00:00Z' },
    ]),
    openShare: vi.fn(async () => ({
      title: 'Spring planning',
      expires_at: '2099-01-01T07:00:00Z',
      payload: { version: 1, sharedAs: 'Riley', title: 'Spring planning', date: null, agenda: ['Minor options'], questions: [], scenario: null, courses: [], followUps: [] },
    })),
  };
});

vi.mock('../lib/advisor-checkins', async (importOriginal) => {
  const real = await importOriginal<typeof import('../lib/advisor-checkins')>();
  return {
    ...real,
    // The real validation runs first, as the real function does.
    recordCheckIn: vi.fn(async (share: string, note: string, steps: string[], key: string) => {
      const problem = real.checkInProblem(note, steps);
      if (problem) throw new Error(problem);
      recorded.push({ share, note, steps, key });
      if (failNext) {
        failNext = false;
        throw new Error('Failed to fetch');
      }
      return 'ci-1';
    }),
    checkInsOn: vi.fn(async () => []),
    myCheckIns: vi.fn(async () => checkIns),
    deleteCheckIn: vi.fn(async () => {}),
  };
});

const { AdvisorMeeting } = await import('./AdvisorMeeting');

/**
 * Check-ins on screen (D-1448). The advisor's form on a share they opened —
 * refused before sending when empty, one key across a failed send and its
 * retry — and the student's list, where a next step becomes one of their own
 * actions exactly once.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeAll(async () => {
  await loadSeed();
});

beforeEach(() => {
  window.location.hash = '';
  window.matchMedia = (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
  localStorage.clear();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 6, seenOnboarding: true, sample: false, courses: [] }));
  localStorage.setItem(
    'semester.registration.v1',
    JSON.stringify({
      catalog: {
        institution: 'Example University',
        importedAt: '2026-09-01T00:00:00Z',
        courses: [
          { id: 'e3', code: 'ECON 3010', section: '01', title: 'Game Theory', term: 'Spring 2027', credits: 3, meetings: [{ days: [2], start: '13:00', end: '14:15' }] },
          { id: 'p1', code: 'PSCI 1100', section: '01', title: 'Politics', term: 'Spring 2027', credits: 3, meetings: [] },
        ],
      },
      cart: [],
      plans: [],
    }),
  );
  localStorage.setItem('semester.course-shortlist.v1', JSON.stringify({ saved: ['e3', 'p1'], compare: [] }));
  host = document.createElement('div');
  host.className = 'device';
  document.body.append(host);
  root = createRoot(host);
  recorded.length = 0;
  failNext = false;
  listed = { shares: [], events: [] };
  checkIns = [];
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
  vi.restoreAllMocks();
});

const mount = async () => {
  await act(async () => {
    root.render(
      <StoreProvider>
        <AdvisorMeeting accountId="u1" />
      </StoreProvider>,
    );
  });
};
const settle = () => act(async () => {
  await new Promise((r) => setTimeout(r, 0));
});
const text = (el: ParentNode = host) => (el.textContent ?? '').replace(/\s+/g, ' ');
const button = (name: RegExp, within: ParentNode = host) => {
  const found = [...within.querySelectorAll('button')].find((b) => name.test((b.textContent ?? '').trim()) || name.test(b.getAttribute('aria-label') ?? ''));
  if (!found) throw new Error(`No button ${name}: ${[...within.querySelectorAll('button')].map((b) => b.textContent).join(' | ')}`);
  return found;
};
const type = (el: HTMLTextAreaElement, value: string) => {
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
};
/** The box a label names, found through the label's own `control`, as a screen reader finds it. */
const box = (label: string) =>
  [...host.querySelectorAll('label')].find((l) => l.firstChild?.textContent?.trim() === label)!.control as HTMLTextAreaElement;

const openShare = async () => {
  await mount();
  const details = host.querySelector<HTMLDetailsElement>('.advisor-view')!;
  await act(async () => {
    details.open = true;
    details.dispatchEvent(new Event('toggle'));
  });
  await act(async () => button(/^Spring planning$/, details).click());
  await settle();
};

describe('the advisor’s check-in', () => {
  it('is refused before sending when nothing was written, and the field says why', async () => {
    await openShare();
    await act(async () => button(/^Record check-in$/).click());
    expect(recorded).toEqual([]);
    const note = box('What you talked about');
    expect(note.getAttribute('aria-invalid')).toBe('true');
    expect(text(document.getElementById(note.getAttribute('aria-describedby')!.split(' ').pop()!)!)).toContain('Write what you talked about');
  });

  it('sends one key for a failed send and its retry, then starts a new draft', async () => {
    await openShare();
    act(() => type(box('What you talked about'), 'Talked through spring'));
    act(() => type(box('Next steps, one per line'), 'Email the registrar\n\nDraft a plan B'));
    failNext = true;
    await act(async () => button(/^Record check-in$/).click());
    expect(text()).toContain('Failed to fetch');
    expect(box('What you talked about').value).toBe('Talked through spring');
    await act(async () => button(/^Record check-in$/).click());
    expect(recorded).toHaveLength(2);
    expect(recorded[0].key).toBe(recorded[1].key);
    expect(recorded[1]).toMatchObject({ share: 'in-1', note: 'Talked through spring', steps: ['Email the registrar', 'Draft a plan B'] });
    expect(text()).toContain('Check-in recorded. Riley can see it on their share.');
    expect(box('What you talked about').value).toBe('');
    act(() => type(box('What you talked about'), 'Second meeting'));
    await act(async () => button(/^Record check-in$/).click());
    expect(recorded[2].key).not.toBe(recorded[0].key);
  });
});

describe('the student’s check-ins', () => {
  const share = { id: 's-live', title: 'Spring planning', created_at: '2026-09-20T07:00:00Z', expires_at: '2099-01-01T07:00:00Z', revoked_at: null };

  it('turns a next step into an action once, and says it is there', async () => {
    listed = { shares: [share], events: [] };
    checkIns = [{ id: 'ci-1', share_id: 's-live', note: 'Talked through spring', next_steps: ['Email the registrar'], created_at: '2026-09-22T07:00:00Z' }];
    await mount();
    await act(async () => button(/^Prepare a meeting$/).click());
    await settle();
    const list = host.querySelector('[aria-label="Check-ins from your advisor"]')!;
    expect(text(list)).toContain('Talked through spring');
    await act(async () => button(/^Add “Email the registrar” to my actions$/, list).click());
    expect(text(list)).toContain('Email the registrar In your actions');
    expect(() => button(/^Add “Email the registrar” to my actions$/, list)).toThrow();
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as { tasks?: { title: string }[] };
    expect(saved.tasks?.filter((t) => t.title === 'Email the registrar')).toHaveLength(1);
  });

  it('shows no check-in list for a share with none (the control)', async () => {
    listed = { shares: [share], events: [] };
    await mount();
    await act(async () => button(/^Prepare a meeting$/).click());
    await settle();
    expect(host.querySelector('[aria-label="Check-ins from your advisor"]')).toBeNull();
    expect(text()).toContain('Spring planning');
  });
});
