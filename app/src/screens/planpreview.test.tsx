// @vitest-environment jsdom
import { act, useEffect, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadSeed } from '../data/seed';
import { coursesForPlan, readPlanDraft } from '../lib/planpreview';
import { StoreProvider, useStore } from '../state/store';
import { FirstRun } from './FirstRun';

/**
 * The registration plan on a fresh install.
 *
 * Saving writes hand-added courses and opens the term plan. The sentences on
 * the form are the boundary: an account is not required, and nothing is sent
 * to a registrar.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let snap: { screen: string; codes: string[] } = { screen: '', codes: [] };

function Probe() {
  const { state } = useStore();
  useEffect(() => {
    snap = { screen: state.screen, codes: state.courses.map((course) => course.course.code) };
  });
  return null;
}

function show(node: ReactNode) {
  act(() => {
    root.render(<StoreProvider>{node}</StoreProvider>);
  });
}

function press(name: RegExp) {
  const button = [...host.querySelectorAll('button')].find((el) => name.test(el.textContent ?? ''));
  if (!button) throw new Error(`no button ${name}`);
  act(() => {
    (button as HTMLButtonElement).click();
  });
}

beforeAll(async () => {
  await loadSeed();
});

beforeEach(() => {
  localStorage.clear();
  snap = { screen: '', codes: [] };
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

describe('the registration plan on first run', () => {
  it('leads with the syllabus and offers the plan without an account', () => {
    show(<FirstRun />);
    const text = host.textContent ?? '';
    expect(text.indexOf('Add your first course')).toBeLessThan(text.indexOf('Build your registration plan'));
    expect(text).toMatch(/No account/);
    expect(text).not.toMatch(/enrollment succeeded|you are enrolled/i);
  });

  it('asks for a term, then a code, and does not open the plan on a bad code', () => {
    show(
      <>
        <FirstRun />
        <Probe />
      </>,
    );
    press(/Build your registration plan/);
    const form = host.querySelector('form');
    expect(form?.getAttribute('aria-label')).toBe('Build your registration plan');
    press(/Save this plan/);
    expect(host.textContent).toMatch(/Name the term/);
    const term = host.querySelector('input');
    const courses = host.querySelector('textarea');
    if (!term || !courses) throw new Error('form fields missing');
    act(() => {
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      const setArea = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      set?.call(term, 'Fall 2026');
      term.dispatchEvent(new Event('input', { bubbles: true }));
      setArea?.call(courses, 'my economics class');
      courses.dispatchEvent(new Event('input', { bubbles: true }));
    });
    press(/Save this plan/);
    expect(host.textContent).toMatch(/is not a course code/);
    expect(snap.screen).not.toBe('yes');
    expect(snap.codes).toEqual([]);
  });

  it('keeps the courses on this device and says they are not a registration record', () => {
    show(
      <>
        <FirstRun />
        <Probe />
      </>,
    );
    press(/Build your registration plan/);
    const term = host.querySelector('input');
    const courses = host.querySelector('textarea');
    if (!term || !courses) throw new Error('form fields missing');
    act(() => {
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      const setArea = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      set?.call(term, 'Fall 2026');
      term.dispatchEvent(new Event('input', { bubbles: true }));
      setArea?.call(courses, 'econ 1020');
      courses.dispatchEvent(new Event('input', { bubbles: true }));
    });
    press(/Save this plan/);
    expect(host.textContent).toMatch(/not your school’s registration record/);
    expect(host.textContent).toMatch(/Nothing here is sent to a registrar/);
    expect(snap.screen).toBe('yes');
    expect(snap.codes).toEqual(['ECON 1020']);
    const read = readPlanDraft('Fall 2026', 'ECON 1020');
    if (!read.ok) throw new Error('draft');
    expect(coursesForPlan(read.draft)[0].course.source).toBe('Added by hand');
  });

  it('offers an advisor the meeting screen, and does not offer it to a student', () => {
    function SetAdvisor() {
      const { dispatch } = useStore();
      return (
        <button type="button" onClick={() => dispatch({ type: 'setRole', role: 'advisor' })}>
          set advisor
        </button>
      );
    }
    show(
      <>
        <FirstRun />
        <SetAdvisor />
      </>,
    );
    expect(host.textContent).not.toMatch(/Keep an appointment/);
    press(/set advisor/);
    expect(host.textContent).toMatch(/Keep an appointment/);
  });
});
