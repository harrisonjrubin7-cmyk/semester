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

  it('keeps a named code that the imported file does not contain, and does not invent a seat', () => {
    localStorage.setItem(
      'semester.registration.v1',
      JSON.stringify({
        catalog: {
          institution: 'Example University',
          importedAt: '2026-10-01T15:00:00.000Z',
          courses: [{
            id: 'e1', code: 'ECON 1020', section: '01', title: 'Microeconomics', term: 'Fall 2026',
            department: 'ECON', credits: 3, instructor: '', location: '', description: '',
            prerequisites: '', seats: 18, meetings: [{ days: [1], start: '09:00', end: '10:15' }],
          }],
        },
        cart: [],
        plans: [],
      }),
    );
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
    expect(list?.textContent).toMatch(/PSCI 1104/);
    expect(list?.textContent).toMatch(/Not in this file/);
    expect(list?.textContent).toMatch(/no seat was invented/i);
    expect(list?.textContent).toMatch(/Example University/);
    expect(list?.textContent).not.toMatch(/ECON 1020/);
    const stored = JSON.parse(localStorage.getItem('semester.registration.v1')!);
    expect(stored.catalog.courses.map((course: { code: string }) => course.code)).toEqual(['ECON 1020']);
    expect(stored.cart).toEqual([]);
    expect(host.textContent).toMatch(/18 reported seats|18 seats/);
  });
});
