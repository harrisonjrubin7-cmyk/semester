import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * The semester view's rows, as things a finger can hit.
 *
 * Fifty-three of the sixty-one controls on that screen at phone width were one
 * of these rows, and every one was sixteen pixels tall with nothing between
 * it and the next. Sixteen is below WCAG 2.5.8's twenty-four and a long way
 * below the forty-four every touch guideline asks for; the row above is what
 * you hit instead.
 *
 * And the count at the foot of a long week — "+3 more" — was a `<div>`. So the
 * week this view exists to warn you about was the one week whose contents it
 * declined to show, and the only way to read them was to leave for another
 * view. A count you cannot open is worse than no count.
 *
 * Both are checked by reading the file. A tap target is a number in a style
 * object and a count is a tag name: neither shows up in a rendered snapshot,
 * neither fails a type check, and both are the kind of thing that comes back
 * the next time somebody copies the row above.
 */
const SOURCE = readFileSync(new URL('./Calendar.tsx', import.meta.url), 'utf8');

/** WCAG 2.5.8 Target Size (Minimum), which is the floor rather than the aim. */
const WCAG_MINIMUM = 24;

describe('a row in the semester view', () => {
  it('is at least as tall as a target is allowed to be', () => {
    const at = SOURCE.match(/const WEEK_ROW: CSSProperties = \{[^}]*\}/s);
    expect(at, 'WEEK_ROW is gone; the rows are sized somewhere else now').toBeTruthy();
    const px = Number(at![0].match(/minHeight: (\d+)/)?.[1]);
    expect(px).toBeGreaterThanOrEqual(WCAG_MINIMUM);
  });

  it('is what every one of the four lists uses', () => {
    // Deadlines, campus events, your tasks, your appointments. Each list was
    // written out separately and each had its own copy of the row's style,
    // which is how one of them would keep the old height through a change
    // aimed at the others.
    const view = SOURCE.slice(SOURCE.indexOf('function SemesterView()'));
    const rows = [...view.matchAll(/style=\{\{?\s*\.\.\.WEEK_ROW/g)].length
      + [...view.matchAll(/style=\{WEEK_ROW\}/g)].length;
    expect(rows).toBeGreaterThanOrEqual(6);
    // And none left behind on the old shape.
    expect(view).not.toContain("display: 'block',\n                          textAlign: 'left'");
  });
});

describe('the count at the foot of a long week', () => {
  it('is a control, not a sentence', () => {
    const view = SOURCE.slice(SOURCE.indexOf('function SemesterView()'));
    // The old shape: a div whose whole content was the count.
    expect(view).not.toMatch(/<div style=\{\{ opacity: 0\.5 \}\}>\+\{/);
    expect(view).not.toMatch(/<div style=\{secondLine\(\)\}>\+\{/);
  });

  it('says whether it is open, for somebody who cannot see it move', () => {
    const helper = SOURCE.match(/const moreButton = \([^)]*\) => \([\s\S]*?\n  \);/);
    expect(helper, 'moreButton is gone; find where the count is rendered now').toBeTruthy();
    expect(helper![0]).toContain('aria-expanded');
    expect(helper![0]).toContain('type="button"');
  });

  it('opens each list on its own, so its label stays true', () => {
    // One flag per week would mean pressing "+2 more" under the deadlines also
    // unfolded the campus events beside them, under a button that never said
    // it would.
    const view = SOURCE.slice(SOURCE.indexOf('function SemesterView()'));
    for (const key of ['`d:${i}`', '`e:${i}`', '`t:${i}`', '`a:${i}`']) {
      expect(view, `no key for ${key}`).toContain(`moreButton(${key}`);
      expect(view, `${key} never decides what is shown`).toContain(`showsAll(${key})`);
    }
  });
});
