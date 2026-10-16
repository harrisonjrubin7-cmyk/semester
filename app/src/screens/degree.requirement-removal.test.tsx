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
    requirements: [{
      id: 'core-theory',
      programme: 'Economics major',
      name: 'Core theory',
      need: 'courses',
      count: 2,
      accepts: ['ECON 3010', 'ECON 3020'],
      note: '',
    }],
    taken: [{
      id: 'econ-1010',
      code: 'ECON 1010',
      title: 'Principles',
      term: 'Fall 2026',
      hours: 3,
      grade: 'A',
      current: false,
    }],
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
  it('previews the exact planning consequence and cancellation writes nothing', async () => {
    await act(async () => button('Requirements').click());
    await act(async () => button('Remove Core theory').click());

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
    expect(seen.requirements).toHaveLength(1);

    await act(async () => button('Cancel').click());
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(seen.requirements).toHaveLength(1);
  });

  it('removes only the confirmed requirement', async () => {
    await act(async () => button('Requirements').click());
    await act(async () => button('Remove Core theory').click());
    await act(async () => button('Remove requirement').click());

    expect(seen.requirements).toEqual([]);
    expect(seen.taken.map((course) => course.id)).toEqual(['econ-1010']);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});
