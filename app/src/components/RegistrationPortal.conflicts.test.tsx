// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadSeed } from '../data/seed';
import { STORAGE_KEY } from '../state/shape';
import { StoreProvider } from '../state/store';
import { RegistrationPortal } from './RegistrationPortal';
import { Yes } from '../screens/Yes';

/**
 * The term plan is the Registration planner (`yes`), not a second screen.
 * Its cart says a time conflict before it lists the sections. A paragraph
 * that still mentions the overlap after "Review your selections" fails this.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const REG_KEY = 'semester.registration.v1';

const section = (id: string, code: string, start: string, end: string) => ({
  id,
  code,
  section: '01',
  title: `${code} title`,
  term: 'Spring 2027',
  department: code.split(' ')[0],
  credits: 3,
  instructor: 'Prof. Ruiz',
  location: 'Calhoun 101',
  description: 'd',
  prerequisites: '',
  seats: 10,
  meetings: [{ days: [1, 3], start, end }],
});

let host: HTMLDivElement;
let root: Root;

beforeAll(async () => {
  await loadSeed();
});

beforeEach(() => {
  window.matchMedia = (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
  localStorage.clear();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 6, seenOnboarding: true, sample: false, term: 'Spring 2027', courses: [] }));
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

const render = async (node: ReactNode) => {
  await act(async () => {
    root.render(<StoreProvider>{node}</StoreProvider>);
  });
};

const button = (name: RegExp) => {
  const found = [...host.querySelectorAll('button, [role="tab"]')].find((b) => name.test((b.textContent ?? '').trim())) as HTMLElement | undefined;
  if (!found) throw new Error(`No button ${name}`);
  return found;
};

const seed = (courses: ReturnType<typeof section>[], cart: string[]) => {
  localStorage.setItem(
    REG_KEY,
    JSON.stringify({
      catalog: { institution: 'Example University', importedAt: '2026-10-01T00:00:00.000Z', courses },
      cart,
      plans: [],
    }),
  );
};

describe('the term plan', () => {
  it('is the Registration planner, named on the tab and the heading', async () => {
    seed([section('a', 'ECON 1010', '09:00', '10:15')], []);
    await render(<Yes />);
    const tabs = [...host.querySelectorAll('[role="tab"]')].map((t) => (t.textContent ?? '').trim());
    expect(tabs).toContain('Term plan');
    expect(host.querySelector('h2')?.textContent).toBe('Term plan');
  });

  it('names a time conflict before the sections in the cart', async () => {
    seed(
      [section('a', 'ECON 1010', '09:00', '10:15'), section('b', 'MATH 1300', '09:30', '10:45')],
      ['a', 'b'],
    );
    await render(<RegistrationPortal demandForecasting={false} />);
    await act(async () => button(/^Cart \(2\)$/).click());
    const body = host.textContent ?? '';
    const conflict = body.indexOf('ECON 1010 and MATH 1300 overlap on Mon, Wed.');
    const review = body.indexOf('Review your selections');
    expect(conflict).toBeGreaterThanOrEqual(0);
    expect(review).toBeGreaterThan(conflict);
  });

  it('does not invent a conflict when the meetings do not overlap', async () => {
    seed(
      [section('a', 'ECON 1010', '09:00', '10:15'), section('b', 'MATH 1300', '11:00', '12:15')],
      ['a', 'b'],
    );
    await render(<RegistrationPortal demandForecasting={false} />);
    await act(async () => button(/^Cart \(2\)$/).click());
    const body = host.textContent ?? '';
    expect(body).not.toContain('overlap on');
    expect(body.indexOf('Review your selections')).toBeGreaterThanOrEqual(0);
  });
});
