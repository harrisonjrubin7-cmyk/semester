import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { sources, withoutComments } from '../styles/rules';

/**
 * One tablist, and it is the one with a keyboard.
 *
 * `role="tablist"` was written out in ten files — the ribbon, the mail
 * categories, the shelf nav, the springboard's page dots, the class chat, and
 * the five ported campus screens. Every one declared the role and its
 * `role="tab"` children correctly, and **not one implemented the pattern**:
 * no arrow keys, no roving tabindex, no Home or End.
 *
 * That is the shape of fault this whole audit is about, but it is worth being
 * precise about why it is a fault rather than an omission. A row of plain
 * buttons promises nothing. A tablist announces "tab, 2 of 4" and then does
 * not answer the arrow keys that announcement invites — so declaring the role
 * without the behaviour leaves a screen-reader user worse off than leaving it
 * off would have. Ten copies of that is also ten places to not fix it.
 *
 * `TabList` in `components/ui.tsx` owns the roles, the roving tabindex and
 * the keys. It deliberately owns no styling: four different tab stylings were
 * in use, and which of them should win is a design question rather than this
 * one. Each caller keeps its own `className`, so nothing moved on screen.
 *
 * ## Why this is written on the source
 *
 * The same reason as `styles/stacking.test.ts` and `lib/onegraph.test.ts`:
 * jsdom will happily mount a tablist with no keyboard handler and report
 * every attribute as correct, because the fault is a key press that does
 * nothing rather than a wrong element. What can be checked cheaply and
 * exactly is that nobody has written the role by hand again.
 */

/** Files that spell out the role themselves, rather than asking for `TabList`. */
function handRolled(): string[] {
  return sources(join(process.cwd(), 'src'))
    .filter((f) => !f.path.includes('.test.'))
    .filter((f) => !f.path.endsWith(join('components', 'ui.tsx')))
    .filter((f) => /role="tablist"/.test(withoutComments(f.text)))
    .map((f) => f.path.slice(f.path.indexOf('/src/') + 5));
}

describe('the tab strip', () => {
  it('is drawn by the component and nowhere else', () => {
    // Named rather than counted, so a failure says which file to look at.
    expect(handRolled()).toEqual([]);
  });

  it('still exists to be used, and still answers the arrow keys', () => {
    // A guard on the guard. The rule above passes just as well on an app that
    // has lost `TabList` entirely, and it would pass on one whose `TabList`
    // had quietly had its keyboard handler deleted — which is the exact
    // regression it exists to prevent, since that is what all ten call sites
    // looked like before.
    const ui = sources(join(process.cwd(), 'src', 'components')).find((f) =>
      f.path.endsWith('ui.tsx'),
    );
    const text = withoutComments(ui?.text ?? '');
    expect(text, 'the component').toContain('export function TabList');
    expect(text, 'the role it owns').toContain('role="tablist"');
    for (const key of ['ArrowRight', 'ArrowLeft', 'Home', 'End']) {
      expect(text, `${key} moves between tabs`).toContain(key);
    }
    // The roving tabindex is the half people drop: without it every tab is a
    // tab stop and the arrows have nothing to do.
    expect(text, 'one tab stop for the strip').toMatch(/tabIndex=\{[^}]*\? 0 : -1\}/);
  });
});
