// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import { loadSeed } from '../data/seed';
import type { CourseModule } from '../lib/types';
import { STORAGE_KEY } from '../state/shape';
import { StoreProvider } from '../state/store';
import { CourseRow } from './Me';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const course = (id: string, term: string, source: string): CourseModule => ({
  course: {
    id,
    code: 'ART 1100',
    name: 'Studio practice',
    prof: 'Professor Rivera',
    email: '',
    meets: '',
    room: 'Studio 2',
    credits: '3',
    term,
    source,
    grading: [],
  },
  items: [],
  schedule: [],
  guide: { code: 'ART 1100', name: '', blurb: '', source: '', mastery: 0, audio: false, units: [], terms: [] },
  planMinutes: '45 min',
  frameLabel: 'Frames',
});

const FALL = course('art-fall', '2026FA', 'Fall syllabus.pdf');
const SPRING = course('art-spring', '2027SP', 'Spring syllabus.pdf');

let host: HTMLDivElement;
let root: Root;

beforeAll(async () => {
  await loadSeed();
});

beforeEach(async () => {
  localStorage.clear();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    schemaVersion: 6,
    seenOnboarding: true,
    sample: false,
    term: '2026FA',
    courses: [FALL, SPRING],
  }));
  host = document.createElement('div');
  host.className = 'device';
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root.render(
      <StoreProvider>
        <CourseRow module={FALL} />
        <CourseRow module={SPRING} />
      </StoreProvider>,
    );
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
});

it('distinguishes same-code course removals by represented term and source', async () => {
  const fallName = 'Remove ART 1100: Studio practice · Fall 2026 · from Fall syllabus.pdf';
  const springName = 'Remove ART 1100: Studio practice · Spring 2027 · from Spring syllabus.pdf';

  const fall = host.querySelector<HTMLButtonElement>(`button[aria-label="${fallName}"]`);
  const spring = host.querySelector<HTMLButtonElement>(`button[aria-label="${springName}"]`);
  expect(fall).not.toBeNull();
  expect(spring).not.toBeNull();

  await act(async () => fall?.click());
  expect(host.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe(fallName);
});
