import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { APP, windowTitle } from './title';

/**
 * The tab says which screen you are on.
 *
 * Two halves, and the second is the one that would rot. `windowTitle` is pure
 * and its cases are below; `Titled` is an effect in `App.tsx`, mounted twice
 * because the app has two layouts — and a component mounted in one return
 * statement and not the other is precisely the bug the skip link had for
 * months (see its note in `App.tsx`). So the mounting is held here too.
 */
describe('the window title', () => {
  it('leads with the screen and trails with the app', () => {
    // Tabs truncate from the right. The half that differs goes first.
    expect(windowTitle('Cards', 'ECON 1020 · study guide')).toBe('ECON 1020 · Cards · Semester');
    expect(windowTitle('Calendar', 'September')).toBe('Calendar · Semester');
  });

  it('names the course on the screens whose own name does not', () => {
    // The study screens are named for a mode or for the guide rather than for
    // a subject, and are the screens somebody is most likely to have two of
    // open at once. "Guide" in two tabs is two tabs; "ECON 1020 · Guide" and
    // "PSCI 1104 · Guide" are two screens.
    for (const mode of ['Guide', 'Cards', 'Quiz', 'Slides', 'Watch']) {
      expect(windowTitle(mode, 'PSCI 1104 · study guide')).toBe(`PSCI 1104 · ${mode} · ${APP}`);
    }
  });

  it('takes the code from a kicker that is one, and only then', () => {
    // `case 'item'` passes the bare code as the kicker; `case 'drill'` too.
    expect(windowTitle('Midterm 2', 'ECON 1020')).toBe('ECON 1020 · Midterm 2 · Semester');
    // Most kickers are sentences, and a sentence in a tab is the truncation
    // problem again wearing the fix's clothes.
    expect(windowTitle('Check the dates', 'The dates the university sets')).toBe(
      'Check the dates · Semester',
    );
    expect(windowTitle('Today', 'Thu · Sep 4')).toBe('Today · Semester');
    expect(windowTitle('Courses', '4 courses · 11 credits')).toBe('Courses · Semester');
  });

  it('does not say the course twice on the course screen', () => {
    // `case 'course'` is `{ kicker: 'Course', title: code }` — but a rename
    // that made the kicker the code would otherwise read "ECON 1020 · ECON
    // 1020 · Semester".
    expect(windowTitle('ECON 1020', 'Course')).toBe('ECON 1020 · Semester');
    expect(windowTitle('ECON 1020', 'ECON 1020')).toBe('ECON 1020 · Semester');
  });

  it('falls back to the app rather than to an empty separator', () => {
    expect(windowTitle('', 'ECON 1020')).toBe(APP);
    expect(windowTitle('   ')).toBe(APP);
  });

  it('matches what index.html and the manifest call the app', () => {
    expect(readFileSync('index.html', 'utf8')).toContain(`<title>${APP}</title>`);
    const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'));
    expect(manifest.name ?? manifest.short_name).toContain(APP);
  });
});

describe('the component that writes it', () => {
  const src = () => readFileSync('src/App.tsx', 'utf8');

  it('is mounted in both layouts', () => {
    // The phone's return and the desk's. One is the skip-link bug again.
    expect([...src().matchAll(/<Titled \/>/g)].length).toBe(2);
  });

  it('reads the header rather than keeping a second list of names', () => {
    const fn = /function Titled\(\)[\s\S]*?\n}\n/.exec(src());
    expect(fn, 'Titled has moved; point this test at it').not.toBeNull();
    expect(fn![0], 'a screen renamed in the header is renamed in the tab').toContain('useHeader()');
    expect(fn![0]).toContain('document.title');
  });
});
