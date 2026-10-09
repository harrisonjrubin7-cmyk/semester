// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSeed } from '../data/seed';
import { diff } from '../lib/rediff';
import type { CourseModule, Item } from '../lib/types';
import { StoreProvider } from '../state/store';
import { Rediff } from './Import';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeAll(async () => {
  await loadSeed();
});

beforeEach(() => {
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

const item = (id: string, title: string, month: number, day: number): Item => ({
  id,
  c: 'course',
  title,
  kind: 'Assignment',
  month,
  day,
  dueTime: '11:59p',
  weight: '',
  where: '',
  detail: '',
  quote: '',
  source: '',
}) as Item;

const course = (items: Item[]): CourseModule => ({
  course: {
    id: 'course', code: 'ECON 1020', name: 'Principles', prof: '', email: '',
    meets: '', room: '', credits: '3', source: 'syllabus.pdf', grading: [],
  },
  items,
  schedule: [],
  guide: { code: 'ECON 1020', name: 'Principles', units: [], terms: [] },
  planMinutes: '45',
  frameLabel: 'Frames',
}) as unknown as CourseModule;

describe('Import re-import conflict controls', () => {
  it('renders one unselected native radio group per moved or missing date', () => {
    const changes = diff(
      course([item('moved', 'Paper', 8, 10), item('removed', 'Quiz', 9, 1)]),
      course([item('new-id', 'Paper', 8, 17)]),
      2026,
    );
    act(() => {
      root.render(<StoreProvider><Rediff changes={changes} kept={{ kept: 1, lost: 1 }} code="ECON 1020" choices={{}} onChoose={() => {}} /></StoreProvider>);
    });

    const groups = [...host.querySelectorAll('fieldset.import-conflict-choice')];
    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.querySelector('legend')?.textContent)).toEqual([
      'Quiz · 10/1',
      'Paper · 9/10 → 9/17 · 7 days later',
    ]);
    expect([...host.querySelectorAll<HTMLInputElement>('input[type="radio"]')].every((radio) => !radio.checked)).toBe(true);
    expect(host.textContent).toContain('Semester will not decide a source conflict for you.');
  });

  it('reports the exact stable conflict id and choice', () => {
    const changes = diff(course([item('moved', 'Paper', 8, 10)]), course([item('fresh', 'Paper', 8, 17)]), 2026);
    const choose = vi.fn();
    act(() => {
      root.render(<StoreProvider><Rediff changes={changes} kept={{ kept: 0, lost: 0 }} code="ECON 1020" choices={{}} onChoose={choose} /></StoreProvider>);
    });

    const imported = [...host.querySelectorAll<HTMLInputElement>('input[type="radio"]')]
      .find((radio) => radio.parentElement?.textContent?.includes('Use imported date'));
    expect(imported).toBeTruthy();
    act(() => imported!.click());
    expect(choose).toHaveBeenCalledWith('moved:moved', 'use_imported');
  });

  it('renders unselected choices for metadata and every grading change', () => {
    const current = course([]);
    current.course.room = 'Buttrick 101';
    current.course.grading = [
      { what: 'Exams', pct: '40%' },
      { what: 'Essays', pct: '30%' },
    ];
    const imported = course([]);
    imported.course.room = 'Wilson 103';
    imported.course.grading = [
      { what: 'Exams', pct: '45%' },
      { what: 'Projects', pct: '20%' },
    ];
    const choose = vi.fn();
    act(() => {
      root.render(<StoreProvider><Rediff changes={diff(current, imported, 2026)} kept={{ kept: 0, lost: 0 }} code="ECON 1020" choices={{}} onChoose={choose} /></StoreProvider>);
    });

    const groups = [...host.querySelectorAll('fieldset.import-conflict-choice')];
    expect(groups).toHaveLength(4);
    expect(groups.map((group) => group.querySelector('legend')?.textContent)).toEqual([
      'Exams · 40% → 45%',
      'Essays · 30%',
      'Projects · not in your current grading table',
      'Room · Buttrick 101 → Wilson 103',
    ]);
    expect([...host.querySelectorAll<HTMLInputElement>('input[type="radio"]')].every((radio) => !radio.checked)).toBe(true);
    expect(host.textContent).toContain('changed date, due time, title, course detail, or grading row');

    const importedRoom = [...host.querySelectorAll<HTMLInputElement>('input[type="radio"]')]
      .find((radio) => radio.parentElement?.textContent?.includes('Use imported room'));
    act(() => importedRoom!.click());
    expect(choose).toHaveBeenCalledWith('field:Room', 'use_imported');
  });

  it('renders a separate unselected title choice when a reworded deadline also moved', () => {
    const changes = diff(
      course([item('current-id', 'Reflection #1', 8, 10)]),
      course([item('fresh-id', 'Reflection 1 — play', 8, 17)]),
      2026,
    );
    const choose = vi.fn();
    act(() => {
      root.render(<StoreProvider><Rediff changes={changes} kept={{ kept: 0, lost: 0 }} code="ECON 1020" choices={{}} onChoose={choose} /></StoreProvider>);
    });

    const groups = [...host.querySelectorAll('fieldset.import-conflict-choice')];
    expect(groups.map((group) => group.querySelector('legend')?.textContent)).toEqual([
      'Reflection 1 — play · 9/10 → 9/17 · 7 days later',
      'Title · Reflection #1 → Reflection 1 — play',
    ]);
    expect([...host.querySelectorAll<HTMLInputElement>('input[type="radio"]')].every((radio) => !radio.checked)).toBe(true);

    const importedTitle = [...host.querySelectorAll<HTMLInputElement>('input[type="radio"]')]
      .find((radio) => radio.parentElement?.textContent?.includes('Use imported title'));
    act(() => importedTitle!.click());
    expect(choose).toHaveBeenCalledWith('title:current-id', 'use_imported');
  });

  it('renders a separate unselected due-time choice for the same stable deadline', () => {
    const current = item('current-id', 'Reflection #1', 8, 10);
    const imported = { ...item('fresh-id', 'Reflection 1 — play', 8, 17), dueTime: '5:00p' };
    const changes = diff(course([current]), course([imported]), 2026);
    const choose = vi.fn();
    act(() => {
      root.render(<StoreProvider><Rediff changes={changes} kept={{ kept: 0, lost: 0 }} code="ECON 1020" choices={{}} onChoose={choose} /></StoreProvider>);
    });

    const groups = [...host.querySelectorAll('fieldset.import-conflict-choice')];
    expect(groups.map((group) => group.querySelector('legend')?.textContent)).toEqual([
      'Reflection 1 — play · 9/10 → 9/17 · 7 days later',
      'Title · Reflection #1 → Reflection 1 — play',
      'Due time · 11:59p → 5:00p',
    ]);
    expect([...host.querySelectorAll<HTMLInputElement>('input[type="radio"]')].every((radio) => !radio.checked)).toBe(true);

    const importedTime = [...host.querySelectorAll<HTMLInputElement>('input[type="radio"]')]
      .find((radio) => radio.parentElement?.textContent?.includes('Use imported time'));
    act(() => importedTime!.click());
    expect(choose).toHaveBeenCalledWith('time:current-id', 'use_imported');
  });
});
