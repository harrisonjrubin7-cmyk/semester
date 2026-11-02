// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadSeed } from '../data/seed';
import { STORAGE_KEY, type State } from '../state/shape';
import { StoreProvider, useStore } from '../state/store';
import { Degree } from './Degree';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let seen: State;

function Probe() {
  const { state } = useStore();
  useEffect(() => {
    seen = state;
  });
  return null;
}

beforeAll(async () => {
  window.matchMedia = (() => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  await loadSeed();
});

beforeEach(async () => {
  localStorage.clear();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    schemaVersion: 6,
    requirements: [
      {
        id: 'core-theory-econ',
        programme: 'Economics major',
        name: 'Core theory',
        need: 'courses',
        count: 2,
        accepts: ['ECON 3010', 'ECON 3020'],
        note: '',
      },
      {
        id: 'core-theory-policy',
        programme: 'Economics major',
        name: 'Core theory',
        need: 'courses',
        count: 2,
        accepts: ['ECON 3010', 'ECON 3020'],
        note: '',
      },
    ],
    taken: [
      {
        id: 'econ-1010-fall',
        code: 'ECON 1010',
        title: 'Principles',
        term: 'Fall 2026',
        hours: 3,
        grade: 'A',
        current: false,
      },
      {
        id: 'econ-1010-spring',
        code: 'ECON 1010',
        title: 'Principles',
        term: 'Fall 2026',
        hours: 3,
        grade: 'A',
        current: false,
      },
    ],
  }));
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root.render(
      <StoreProvider>
        <Probe />
        <Degree advisorMeeting={false} />
      </StoreProvider>,
    );
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
});

const button = (name: string) => {
  const found = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.getAttribute('aria-label') === name || candidate.textContent?.trim() === name,
  );
  if (!found) throw new Error(`No button named ${name}`);
  return found;
};

describe('student-entered degree requirement removal', () => {
  it('distinguishes exact-duplicate requirement removals and targets the selected stable id', async () => {
    await act(async () => button('Requirements').click());

    const names = [...host.querySelectorAll<HTMLButtonElement>('button[aria-label^="Remove requirement "]')]
      .map((candidate) => candidate.ariaLabel);

    expect(names).toEqual([
      'Remove requirement 1 of 2, Core theory: Economics major · 2 courses · accepted courses: ECON 3010, ECON 3020',
      'Remove requirement 2 of 2, Core theory: Economics major · 2 courses · accepted courses: ECON 3010, ECON 3020',
    ]);
    expect(new Set(names).size).toBe(2);

    await act(async () => button(names[1]!).click());
    await act(async () => button('Remove requirement').click());
    expect(seen.requirements.map((requirement) => requirement.id)).toEqual(['core-theory-econ']);
  });

  it('previews the exact planning consequence and cancellation writes nothing', async () => {
    await act(async () => button('Requirements').click());
    await act(async () => button('Remove requirement 1 of 2, Core theory: Economics major · 2 courses · accepted courses: ECON 3010, ECON 3020').click());

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('Remove this degree requirement?');
    expect(dialog?.textContent).toContain('Economics major · Core theory');
    expect(dialog?.textContent).toContain('2 courses');
    expect(dialog?.textContent).toContain('ECON 3010, ECON 3020');
    expect(dialog?.textContent).toContain('recalculates what Semester says is left');
    expect(dialog?.textContent).toContain('registrar’s official degree audit');
    expect(dialog?.textContent).toContain('stay unchanged');
    expect(dialog?.textContent).toContain('copy it again from the official audit');
    expect(document.activeElement?.textContent).toBe('Cancel');
    expect(seen.requirements).toHaveLength(2);

    await act(async () => button('Cancel').click());
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(seen.requirements).toHaveLength(2);
  });

  it('removes only the confirmed requirement', async () => {
    await act(async () => button('Requirements').click());
    await act(async () => button('Remove requirement 1 of 2, Core theory: Economics major · 2 courses · accepted courses: ECON 3010, ECON 3020').click());
    await act(async () => button('Remove requirement').click());

    expect(seen.requirements.map((requirement) => requirement.id)).toEqual(['core-theory-policy']);
    expect(seen.taken.map((course) => course.id)).toEqual(['econ-1010-fall', 'econ-1010-spring']);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});

describe('student-entered recorded course removal', () => {
  it('distinguishes exact-duplicate course removals and targets the selected stable id', async () => {
    await act(async () => button('Taken (2)').click());

    const names = [...host.querySelectorAll<HTMLButtonElement>('button[aria-label^="Remove recorded course "]')]
      .map((candidate) => candidate.ariaLabel);

    expect(names).toEqual([
      'Remove recorded course 1 of 2, ECON 1010: Principles · Fall 2026 · 3 hours · grade A',
      'Remove recorded course 2 of 2, ECON 1010: Principles · Fall 2026 · 3 hours · grade A',
    ]);
    expect(new Set(names).size).toBe(2);

    await act(async () => button(names[1]!).click());
    await act(async () => button('Remove recorded course').click());
    expect(seen.taken.map((course) => course.id)).toEqual(['econ-1010-fall']);
  });

  it('previews the derived planning consequence and cancellation writes nothing', async () => {
    await act(async () => button('Taken (2)').click());
    await act(async () => button('Remove recorded course 1 of 2, ECON 1010: Principles · Fall 2026 · 3 hours · grade A').click());

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('Remove this recorded course?');
    expect(dialog?.textContent).toContain('ECON 1010 · Principles');
    expect(dialog?.textContent).toContain('Fall 2026 · 3 hours · grade A');
    expect(dialog?.textContent).toContain('recalculates your planning progress, hours and GPA');
    expect(dialog?.textContent).toContain('degree requirements');
    expect(dialog?.textContent).toContain('registrar’s official transcript');
    expect(dialog?.textContent).toContain('stay unchanged');
    expect(dialog?.textContent).toContain('enter it again from the registrar’s current transcript');
    expect(document.activeElement?.textContent).toBe('Cancel');
    expect(seen.taken.map((course) => course.id)).toEqual(['econ-1010-fall', 'econ-1010-spring']);

    await act(async () => button('Cancel').click());
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(seen.taken.map((course) => course.id)).toEqual(['econ-1010-fall', 'econ-1010-spring']);
  });

  it('removes only the confirmed recorded course', async () => {
    await act(async () => button('Taken (2)').click());
    await act(async () => button('Remove recorded course 1 of 2, ECON 1010: Principles · Fall 2026 · 3 hours · grade A').click());
    await act(async () => button('Remove recorded course').click());

    expect(seen.taken.map((course) => course.id)).toEqual(['econ-1010-spring']);
    expect(seen.requirements.map((requirement) => requirement.id)).toEqual(['core-theory-econ', 'core-theory-policy']);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});
