// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadSeed } from '../data/seed';
import { coursesForPlan, readPlanDraft } from '../lib/planpreview';
import { STORAGE_KEY } from '../state/shape';
import { StoreProvider, useStore } from '../state/store';
import { RegistrationPortal } from './RegistrationPortal';

/**
 * A plan typed before a catalog exists is listed on the term plan, and the
 * list says what it is not: a section, a seat, or an enrollment.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

function Seed() {
  const { dispatch } = useStore();
  return (
    <button
      type="button"
      onClick={() => {
        const read = readPlanDraft('Fall 2026', 'ECON 1020, PSCI 1104');
        if (!read.ok) throw new Error(read.error);
        for (const module of coursesForPlan(read.draft)) dispatch({ type: 'addCourse', module });
      }}
    >
      seed plan
    </button>
  );
}

beforeAll(async () => {
  await loadSeed();
});

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 6, seenOnboarding: true, sample: false, courses: [] }));
  host = document.createElement('div');
  document.body.append(host);
  act(() => {
    root = createRoot(host);
  });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function show(node: ReactNode) {
  act(() => {
    root.render(<StoreProvider>{node}</StoreProvider>);
  });
}

describe('courses named before a catalog', () => {
  it('does not invent a plan when nothing has been typed', () => {
    show(<RegistrationPortal demandForecasting={false} />);
    expect(host.textContent).toMatch(/Start with your school’s course catalog/);
    expect(host.querySelector('[aria-label="Courses you are considering"]')).toBeNull();
  });

  it('lists the typed codes and refuses to call them an enrollment', () => {
    show(
      <>
        <Seed />
        <RegistrationPortal demandForecasting={false} />
      </>,
    );
    const seed = [...host.querySelectorAll('button')].find((el) => el.textContent === 'seed plan');
    if (!seed) throw new Error('seed missing');
    act(() => {
      (seed as HTMLButtonElement).click();
    });
    const list = host.querySelector('[aria-label="Courses you are considering"]');
    expect(list?.textContent).toMatch(/ECON 1020 · Fall 2026 · Added by hand/);
    expect(list?.textContent).toMatch(/PSCI 1104 · Fall 2026 · Added by hand/);
    expect(list?.textContent).toMatch(/not an enrollment/);
    expect(host.textContent).not.toMatch(/enrollment succeeded|you are enrolled|seat reserved/i);
  });
});

describe('courses named, once a catalog is imported', () => {
  const catalog = {
    institution: 'Test University',
    courses: [
      { id: 'econ-01', code: 'ECON 1020', section: '01', title: 'Principles', term: 'Fall 2026', department: 'ECON', credits: 3, instructor: '', location: '', description: '', prerequisites: '', seats: null, meetings: [{ days: [1, 3], start: '09:00', end: '09:50' }] },
      { id: 'math-01', code: 'MATH 1100', section: '01', title: 'Calculus', term: 'Fall 2026', department: 'MATH', credits: 4, instructor: '', location: '', description: '', prerequisites: '', seats: 5, meetings: [{ days: [2, 4], start: '10:00', end: '10:50' }] },
    ],
  };

  async function seedAndImport() {
    show(
      <>
        <Seed />
        <RegistrationPortal demandForecasting={false} courseDetail={false} />
      </>,
    );
    const seed = [...host.querySelectorAll('button')].find((el) => el.textContent === 'seed plan');
    act(() => (seed as HTMLButtonElement).click());
    const input = host.querySelector('input[type="file"]') as HTMLInputElement;
    const list = [new File([JSON.stringify(catalog)], 'catalog.json', { type: 'application/json' })] as unknown as FileList;
    Object.defineProperty(input, 'files', { value: list, configurable: true, writable: true });
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  it('keeps an unmatched code on the list instead of dropping it with the empty state', async () => {
    await seedAndImport();
    expect(host.textContent).toMatch(/Imported 2 sections from Test University/);
    const list = host.querySelector('[aria-label="Courses you are considering"]');
    expect(list?.textContent).toMatch(/ECON 1020 · Fall 2026 · 1 section in this file/);
    expect(list?.textContent).toMatch(/PSCI 1104 · Fall 2026 · Unmatched: no section with this code in this file/);
    expect(host.textContent).toMatch(/1 course you named has no section in this file/);
  });

  it('shows a matched code’s sections without putting anything in the cart', async () => {
    await seedAndImport();
    const reveal = host.querySelector('[aria-label="Show sections of ECON 1020"]') as HTMLButtonElement;
    act(() => reveal.click());
    expect(host.textContent).toMatch(/1 sections found/);
    expect(host.textContent).toMatch(/Cart \(0\)/);
  });
});
