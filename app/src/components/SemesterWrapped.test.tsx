// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSeed } from '../data/seed';
import { STORAGE_KEY } from '../state/shape';
import { StoreProvider } from '../state/store';

/**
 * Phase L on screen. With `semester_wrapped` off, Me is unchanged (the
 * control has it on). With it on: the recap shows the student's own counts
 * for the term; nothing leaves the device until a confirmation shows the
 * exact text and says where it goes; the image falls back honestly where
 * there is no canvas; sharing hands over exactly the text; and how much the
 * app was used changes nothing.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const downloads: { name: string; body: unknown }[] = [];
vi.mock('../lib/deliver', async (importOriginal) => {
  const real = await importOriginal<typeof import('../lib/deliver')>();
  return { ...real, download: vi.fn((piece: { name: string; body: unknown }) => downloads.push(piece)) };
});

const { Me } = await import('../screens/Me');
const { SemesterWrapped } = await import('./SemesterWrapped');

let host: HTMLDivElement;
let root: Root;
const at = (iso: string) => new Date(iso).getTime();

const seed = (over: Record<string, unknown> = {}) =>
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      schemaVersion: 6,
      seenOnboarding: true,
      sample: false,
      term: '2026FA',
      courses: [],
      done: { d1: true, d2: true },
      tickedAt: { d1: at('2026-09-10T12:00:00'), d2: at('2026-10-10T12:00:00') },
      taken: [{ id: 't1', code: 'ECON 9999', title: 'Secret Seminar', term: 'Fall 2026', hours: 3, grade: 'A', current: false }],
      ...over,
    }),
  );

beforeAll(async () => {
  await loadSeed();
});

beforeEach(() => {
  window.location.hash = '';
  window.matchMedia = (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
  localStorage.clear();
  seed();
  const course = { id: 'e1', code: 'ECON 1010', section: '01', title: 'Principles', term: '2027SP', department: 'ECON', credits: 3, instructor: '', location: '', description: '', prerequisites: '', seats: null, meetings: [{ days: [1, 3], start: '09:00', end: '10:15' }] };
  localStorage.setItem('semester.registration.v1', JSON.stringify({ catalog: null, cart: [], plans: [{ id: 'p1', name: 'Plan A', courses: [course] }, { id: 'p2', name: 'Plan B', courses: [course] }] }));
  downloads.length = 0;
  host = document.createElement('div');
  host.className = 'device';
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
  delete (navigator as { share?: unknown }).share;
});

const settle = async (ready?: () => boolean) => {
  const until = Date.now() + 2000;
  for (let i = 0; ready ? !ready() && Date.now() < until : i < 3; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
  }
};
const render = async (node: React.ReactNode) => {
  await act(async () => root.render(<StoreProvider>{node}</StoreProvider>));
  await settle();
};
const text = (el: ParentNode = document.body) => (el.textContent ?? '').replace(/\s+/g, ' ');
const button = (name: RegExp, within: ParentNode = document.body) => {
  const found = [...within.querySelectorAll('button')].find((b) => name.test((b.textContent ?? '').trim()));
  if (!found) throw new Error(`No button ${name}: ${[...within.querySelectorAll('button')].map((b) => b.textContent).join(' | ')}`);
  return found;
};
const dialog = () => [...document.querySelectorAll('[role="dialog"]')].find((d) => d.classList.contains('dialog')) ?? null;

describe('with semester_wrapped off', () => {
  it('Me has no recap', async () => {
    await render(<Me semesterWrapped={false} />);
    await settle(() => host.querySelector('.wrapped') !== null);
    expect(host.querySelector('.wrapped')).toBeNull();
    // The control: the same Me with the flag on.
    await render(<Me semesterWrapped />);
    await settle(() => host.querySelector('.wrapped') !== null);
    expect(host.querySelector('.wrapped')).not.toBeNull();
  });
});

describe('with semester_wrapped on', () => {
  it('shows the student’s own counts for the term, privately', async () => {
    await render(<SemesterWrapped />);
    const card = host.querySelector('.wrapped')!;
    expect(text(card)).toContain('Private to you');
    expect(text(card)).toContain('Your Fall 2026 in Semester');
    expect(text(card)).toContain('2 semester plans saved');
    expect(text(card)).toContain('Ticking off 2 deadlines');
    expect(text(card)).toContain('Completing 1 course on your record');
    expect(text(card)).toContain('Not from how often you opened the app, and nothing from your school.');
    expect(button(/^Plan Spring 2027$/)).toBeTruthy();
  });

  it('counts a saved schedule in one term’s recap only', async () => {
    await render(<SemesterWrapped />);
    expect(text(host.querySelector('.wrapped')!)).toContain('2 semester plans saved');
    const pick = host.querySelector<HTMLSelectElement>('select[aria-label="Term"]')!;
    const other = [...pick.options].map((o) => o.value).find((v) => v !== '2026FA')!;
    await act(async () => {
      pick.value = other;
      pick.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(text(host.querySelector('.wrapped')!)).not.toContain('semester plans saved');
  });

  it('exports only after showing the exact text, with no course in it', async () => {
    await render(<SemesterWrapped />);
    await act(async () => button(/^Export my progress…$/).click());
    expect(downloads).toEqual([]);
    const preview = dialog()!.querySelector('pre')!.textContent!;
    expect(preview).toContain('YOUR FALL 2026 IN SEMESTER');
    expect(preview).not.toContain('Secret Seminar');
    expect(preview).not.toContain('ECON 9999');
    expect(text(dialog()!)).toContain('Nothing is sent anywhere.');
    expect(document.activeElement?.textContent).toBe('Cancel');
    await act(async () => button(/^Save$/, dialog()!).click());
    expect(downloads).toEqual([{ name: 'Your Fall 2026 in Semester.txt', body: preview, mime: 'text/plain' }]);
  });

  it('says so when there is no canvas for an image, and saves nothing', async () => {
    await render(<SemesterWrapped />);
    await act(async () => button(/^Save as image…$/).click());
    await act(async () => button(/^Save$/, dialog()!).click());
    await settle(() => text().includes('cannot make an image'));
    expect(text()).toContain('This browser cannot make an image. Save it as text instead.');
    expect(downloads).toEqual([]);
  });

  it('shares only after confirmation, and exactly the text shown', async () => {
    const share = vi.fn(async () => {});
    (navigator as { share?: unknown }).share = share;
    await render(<SemesterWrapped />);
    await act(async () => button(/^Share…$/).click());
    expect(share).not.toHaveBeenCalled();
    const preview = dialog()!.querySelector('pre')!.textContent!;
    expect(text(dialog()!)).toContain('You choose where it goes, or cancel.');
    await act(async () => button(/^Share$/, dialog()!).click());
    await settle(() => share.mock.calls.length > 0);
    expect(share).toHaveBeenCalledWith({ title: 'Your Fall 2026 in Semester', text: preview });
  });

  it('offers no share where the device has none', async () => {
    await render(<SemesterWrapped />);
    expect(() => button(/^Share…$/)).toThrow();
  });

  it('is the same however much the app was used', async () => {
    await render(<SemesterWrapped />);
    const quiet = text(host.querySelector('.wrapped')!);
    await act(async () => root.unmount());
    root = createRoot(host);
    seed({ visited: { today: true, study: true, courses: true }, recent: ['today', 'study', 'courses'], countScreens: true });
    localStorage.setItem('semester.usage.v1', JSON.stringify({ today: 400, study: 250 }));
    await render(<SemesterWrapped />);
    expect(text(host.querySelector('.wrapped')!)).toBe(quiet);
  });

  it('counts only this account’s Action Center, not another one on the same device', async () => {
    localStorage.setItem(
      'semester.actions.v1:someone-else',
      JSON.stringify({ version: 1, choices: { x: { status: 'completed', history: [{ event: 'complete', at: at('2026-09-10T12:00:00'), from: 'open', to: 'completed' }] } } }),
    );
    await render(<SemesterWrapped />);
    expect(text()).not.toContain('next step you chose');
    // The control: the same record under this device's own key is counted.
    await act(async () => root.unmount());
    root = createRoot(host);
    localStorage.setItem('semester.actions.v1:device', localStorage.getItem('semester.actions.v1:someone-else')!);
    await render(<SemesterWrapped />);
    expect(text()).toContain('Finishing 1 next step you chose');
  });
});
