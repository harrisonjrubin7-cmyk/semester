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
    ],
  },
  items: [
    { id: 'draft', c: 'course-1', title: 'Portfolio', kind: 'Project', month: 9, day: 12, dueTime: '3:00p', weight: '20%', where: '', detail: '', quote: '', source: '' },
    { id: 'final', c: 'course-1', title: 'Portfolio', kind: 'Final', month: 11, day: 4, dueTime: '11:59p', weight: '35%', where: '', detail: '', quote: '', source: '' },
  ],
  schedule: [
    { days: [1, 3], at: 540, time: '9:00a', title: 'Studio', meta: 'Studio 2' },
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
    'Remove grading row Project: 30%',
    'Remove grading row Project: 45%',
    'Remove meeting Studio: Monday and Wednesday · 9:00a',
    'Remove meeting Studio: Tuesday and Thursday · 2:00p',
    'Remove deadline Portfolio: Oct 12, 2026 · 3:00p · Project · 20%',
    'Remove deadline Portfolio: Dec 4, 2026 · 11:59p · Final · 35%',
  ];

  for (const name of names) {
    expect(host.querySelector(`button[aria-label="${name}"]`), name).not.toBeNull();
  }

  const removeAfternoon = host.querySelector<HTMLButtonElement>(
    'button[aria-label="Remove meeting Studio: Tuesday and Thursday · 2:00p"]',
  );
  await act(async () => removeAfternoon?.click());

  expect(host.querySelector('button[aria-label="Remove meeting Studio: Tuesday and Thursday · 2:00p"]')).toBeNull();
  expect(host.querySelector('button[aria-label="Remove meeting Studio: Monday and Wednesday · 9:00a"]')).not.toBeNull();
  expect(host.textContent).toContain('Nothing is saved until you press that.');
});
