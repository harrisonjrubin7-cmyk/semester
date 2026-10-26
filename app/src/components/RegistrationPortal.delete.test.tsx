// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadSeed } from '../data/seed';
import { STORAGE_KEY } from '../state/shape';
import { StoreProvider } from '../state/store';
import type { CatalogCourse } from '../lib/registration';
import { RegistrationPortal } from './RegistrationPortal';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const REG_KEY = 'semester.registration.v1';
const section = (id: string, code: string): CatalogCourse => ({
  id,
  code,
  section: '01',
  title: `${code} title`,
  term: 'Spring 2027',
  department: code.split(' ')[0],
  credits: 3,
  instructor: 'Prof. Ruiz',
  location: 'Calhoun 101',
  description: 'Planning copy',
  prerequisites: '',
  seats: 10,
  meetings: [{ days: [1, 3], start: 540, end: 615 }],
});

const econ = section('econ', 'ECON 1010');
const math = section('math', 'MATH 1300');
let host: HTMLDivElement;
let root: Root;

beforeAll(async () => {
  await loadSeed();
});

beforeEach(() => {
  window.matchMedia = (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
  localStorage.clear();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 6, seenOnboarding: true, sample: false, term: 'Spring 2027', courses: [] }));
  localStorage.setItem(REG_KEY, JSON.stringify({
    catalog: { institution: 'Example University', importedAt: '2026-10-01T00:00:00.000Z', courses: [econ, math] },
    cart: ['econ'],
    plans: [
      { id: 'spring', name: 'Spring option', courses: [econ, math] },
      { id: 'backup', name: 'Spring option', courses: [math] },
    ],
  }));
  host = document.createElement('div');
  host.className = 'device';
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  localStorage.clear();
});

const button = (name: RegExp, within: ParentNode = host) => {
  const found = [...within.querySelectorAll('button, [role="tab"]')].find((candidate) => name.test(candidate.getAttribute('aria-label') ?? (candidate.textContent ?? '').trim())) as HTMLButtonElement | undefined;
  if (!found) throw new Error(`No button ${name}`);
  return found;
};
const plans = () => JSON.parse(localStorage.getItem(REG_KEY)!).plans as Array<{ id: string }>;

describe('saved potential schedule deletion', () => {
  it('distinguishes repeated schedule names and previews the exact device-only consequence', async () => {
    await act(async () => {
      root.render(<StoreProvider><RegistrationPortal demandForecasting={false} /></StoreProvider>);
    });
    await act(async () => button(/^Potential schedules \(2\)$/).click());

    const removals = [...host.querySelectorAll<HTMLButtonElement>('button[aria-label^="Delete potential schedule"]')];
    expect(removals.map((control) => control.getAttribute('aria-label'))).toEqual([
      'Delete potential schedule 1 of 2, Spring option: 2 sections · 6 credits · 1 time conflict',
      'Delete potential schedule 2 of 2, Spring option: 1 section · 3 credits · 0 time conflicts',
    ]);
    await act(async () => removals[1].click());

    const dialog = host.querySelector('[role="dialog"]')!;
    expect(dialog.querySelector('.action-preview')).toBeTruthy();
    expect(dialog.textContent).toContain('Spring option');
    expect(dialog.textContent).toContain('MATH 1300 section 01 (Spring 2027)');
    expect(dialog.textContent).not.toContain('ECON 1010 section 01 (Spring 2027)');
    expect(dialog.textContent).toContain('Your current cart, imported catalog, other potential schedules and official registration stay unchanged.');
    expect(dialog.textContent).toContain('Restore only from a device workspace backup created before deletion.');
    expect(document.activeElement?.textContent).toBe('Cancel');
    expect(plans().map((plan) => plan.id)).toEqual(['spring', 'backup']);

    await act(async () => button(/^Cancel$/, dialog).click());
    expect(plans().map((plan) => plan.id)).toEqual(['spring', 'backup']);

    await act(async () => removals[1].click());
    await act(async () => button(/^Delete schedule$/, host.querySelector('[role="dialog"]')!).click());
    expect(plans().map((plan) => plan.id)).toEqual(['spring']);
    expect(host.textContent).toContain('Potential schedule deleted from this device. No registration was changed.');
  });
});
