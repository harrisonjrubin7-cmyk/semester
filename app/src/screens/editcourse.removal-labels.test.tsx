// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import { loadSeed } from '../data/seed';
import type { CourseModule } from '../lib/types';
import { STORAGE_KEY } from '../state/shape';
import { StoreProvider } from '../state/store';
import { EditCourse } from './EditCourse';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const COURSE: CourseModule = {
  course: {
    id: 'course-1',
    code: 'ART 1100',
    name: 'Studio practice',
    prof: 'Professor Rivera',
    email: '',
    meets: '',
    room: 'Studio 2',
    credits: '3',
    term: '2026FA',
    source: 'Student-entered course',
    grading: [
      { what: 'Project', pct: '30%' },
      { what: 'Project', pct: '45%' },
      { what: 'Project', pct: '45%' },
    ],
  },
  items: [
    { id: 'draft', c: 'course-1', title: 'Portfolio', kind: 'Project', month: 9, day: 12, dueTime: '3:00p', weight: '20%', where: '', detail: '', quote: '', source: '' },
    { id: 'final', c: 'course-1', title: 'Portfolio', kind: 'Final', month: 11, day: 4, dueTime: '11:59p', weight: '35%', where: '', detail: '', quote: '', source: '' },
    { id: 'final-copy', c: 'course-1', title: 'Portfolio', kind: 'Final', month: 11, day: 4, dueTime: '11:59p', weight: '35%', where: '', detail: '', quote: '', source: '' },
  ],
  schedule: [
    { days: [1, 3], at: 540, time: '9:00a', title: 'Studio', meta: 'Studio 2' },
    { days: [2, 4], at: 840, time: '2:00p', title: 'Studio', meta: 'Studio 2' },
    { days: [2, 4], at: 840, time: '2:00p', title: 'Studio', meta: 'Studio 2' },
  ],
  guide: { code: 'ART 1100', name: '', blurb: '', source: '', mastery: 0, audio: false, units: [], terms: [] },
  planMinutes: '45 min',
  frameLabel: 'Frames',
};

let host: HTMLDivElement;
let root: Root;

beforeAll(async () => {
  await loadSeed();
});

beforeEach(async () => {
  window.location.hash = '';
  localStorage.clear();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    schemaVersion: 6,
    seenOnboarding: true,
    sample: false,
    courseId: COURSE.course.id,
    courses: [COURSE],
  }));
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root.render(<StoreProvider><EditCourse /></StoreProvider>);
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
});

it('distinguishes repeated course-draft removals by their represented facts', async () => {
  const names = [
    'Remove grading row 1 of 3, Project: 30%',
    'Remove grading row 2 of 3, Project: 45%',
    'Remove grading row 3 of 3, Project: 45%',
    'Remove meeting 1 of 3, Studio: Monday and Wednesday · 9:00a',
    'Remove meeting 2 of 3, Studio: Tuesday and Thursday · 2:00p',
    'Remove meeting 3 of 3, Studio: Tuesday and Thursday · 2:00p',
    'Remove deadline 1 of 3, Portfolio: Oct 12, 2026 · 3:00p · Project · 20%',
    'Remove deadline 2 of 3, Portfolio: Dec 4, 2026 · 11:59p · Final · 35%',
    'Remove deadline 3 of 3, Portfolio: Dec 4, 2026 · 11:59p · Final · 35%',
  ];

  for (const name of names) {
    expect(host.querySelector(`button[aria-label="${name}"]`), name).not.toBeNull();
  }

  expect(host.textContent).toContain('Nothing changed');
});

it.each([
  {
    remove: 'Remove grading row 3 of 3, Project: 45%',
    remains: 'Remove grading row 2 of 2, Project: 45%',
  },
  {
    remove: 'Remove meeting 3 of 3, Studio: Tuesday and Thursday · 2:00p',
    remains: 'Remove meeting 2 of 2, Studio: Tuesday and Thursday · 2:00p',
  },
  {
    remove: 'Remove deadline 3 of 3, Portfolio: Dec 4, 2026 · 11:59p · Final · 35%',
    remains: 'Remove deadline 2 of 2, Portfolio: Dec 4, 2026 · 11:59p · Final · 35%',
  },
])('removes only the represented exact-duplicate draft row: $remove', async ({ remove, remains }) => {
  const control = host.querySelector<HTMLButtonElement>(`button[aria-label="${remove}"]`);
  expect(control).not.toBeNull();

  await act(async () => control?.click());

  expect(host.querySelector(`button[aria-label="${remove}"]`)).toBeNull();
  expect(host.querySelector(`button[aria-label="${remains}"]`)).not.toBeNull();
});
