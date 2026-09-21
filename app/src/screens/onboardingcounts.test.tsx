// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { buildCatalog, type Catalog } from '../data/catalog';
import { loadSeed } from '../data/seed';
import type { CourseModule } from '../lib/types';

const mock = vi.hoisted(() => ({
  onb: 0,
  courses: [] as unknown[],
  catalog: null as unknown,
}));
vi.mock('../state/store', () => ({
  useStore: () => ({
    state: { onb: mock.onb, tone: 'plain', courses: mock.courses, notifs: {} },
    dispatch: vi.fn(),
    catalog: mock.catalog,
    account: null,
  }),
  useNow: () => new Date(2026, 8, 21),
}));
import { Onboarding } from './Onboarding';

/**
 * What the first run says it has read, before anything has been read.
 *
 * `Onboarding` counted `catalog`, and `state.sample` ships on — so a
 * brand-new install was told it had four syllabi and shown four filenames,
 * ticked, that belonged to the sample semester. That is the sentence the
 * screen's own docstring was written to disown, and it had come back wearing
 * the fix for it.
 *
 * The mock hands over both sets at once, which is the arrangement that can
 * tell them apart: `catalog` holds the four sample courses exactly as the
 * real store builds it, and `courses` holds whatever is the student's. Every
 * assertion below is about which of the two reaches the screen.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;
let seed: CourseModule[];
let sampleCatalog: Catalog;

beforeAll(async () => {
  seed = await loadSeed();
  sampleCatalog = buildCatalog(seed);
});

beforeEach(() => {
  mock.onb = 0;
  mock.courses = [];
  mock.catalog = sampleCatalog;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const mount = () => act(() => root.render(<Onboarding />));
const text = () => host.textContent ?? '';

it('tells a brand-new install it has nothing, while the sample is loaded', () => {
  mount();
  expect(text()).toContain('Your syllabi. One brain.');
  expect(text()).not.toContain('4 syllabi');
});

it('shows none of the sample filenames on the step that ticks them off', () => {
  mock.onb = 1;
  mount();
  expect(text()).toContain('Drop one in.');
  for (const m of seed) {
    const name = m.course.source ?? m.course.code;
    expect(text(), name).not.toContain(name);
  }
});

/*
 * The control, and the half that must not move. A student who has added
 * courses and reopened the run from the guidebook is asking the same question
 * and deserves the real answer — so the counts are not simply switched off,
 * they are counted from the other set. The sample stays loaded throughout.
 */
it('counts the courses that are theirs, with the sample still on', () => {
  const ownOne = seed[0];
  mock.courses = [ownOne];
  mount();
  expect(text()).toContain('1 syllabus. One brain.');
  expect(text()).toContain(ownOne.course.code);
});

it('names their files, and their figures, on the step that ticks them off', () => {
  const ownTwo = [seed[0], seed[1]];
  mock.courses = ownTwo;
  mock.onb = 1;
  mount();
  expect(text()).toContain('Dropped in. Read.');
  const items = ownTwo.reduce((n, m) => n + m.items.length, 0);
  expect(text()).toContain(`${items} dated obligations across 2 courses`);
  for (const m of ownTwo) expect(text()).toContain(m.course.source ?? m.course.code);
  // Not the other two, which are still in the catalogue the mock hands over.
  for (const m of [seed[2], seed[3]]) {
    expect(text()).not.toContain(m.course.source ?? m.course.code);
  }
});
