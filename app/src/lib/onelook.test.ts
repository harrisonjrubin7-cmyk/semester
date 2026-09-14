import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { sources, withoutComments } from '../styles/rules';

/**
 * One store per preference, as a test rather than as a habit.
 *
 * `lib/onehome.test.ts` guards the screen and `lib/onecontrol.test.ts` guards
 * the control. This guards the *value underneath* them, and the failure it
 * exists to catch is the one `components/desk/Customize.tsx` names in its own
 * opening paragraph: a panel grown until it is a second settings screen, at
 * which point there are two that disagree.
 *
 * `components/GoogleShell.tsx` had grown exactly that. It kept four
 * preferences of its own — the shortcut row's contents, whether that row is
 * drawn, light versus dark, and a recents list — in `localStorage` under
 * `semester.google.*`, behind a private `usePreference` hook. Each of the four
 * already had a home:
 *
 * - shortcuts pinned → `look.favourites`, resolved by `lib/desk.ts`
 * - whether to draw them → `look.shortcuts`
 * - light or dark → `look.ground`
 * - where you have been → `state.recent`, filled by `push`
 *
 * So pinning an app in the browser shell left the search home, the launcher
 * and the sidebar on every other navigation unchanged; the Appearance switch
 * moved a class on one `<div>` while Settings → Look went on believing it
 * owned light and dark; and none of the four reached the account, because a
 * look key syncs and a private `localStorage` key does not.
 *
 * ## Why the rule is about the *name*, not about `localStorage`
 *
 * Plenty of this app legitimately writes `localStorage` directly, and a
 * blanket ban would be wrong: open tabs, bookmarks, unsent drafts, folded
 * sections, provider tokens and the session are device-scoped on purpose and
 * say so where they are written. What is never legitimate is a *second* copy
 * of something the look already holds. So the rule names the four keys and
 * asks only that no file outside the look's own machinery stores one.
 */

const SRC = join(process.cwd(), 'src');

/** The look's own files, which are where these names are supposed to appear. */
const OWNERS = [
  join('state', 'shape.ts'),
  join('lib', 'look.ts'),
  join('lib', 'desk.ts'),
];

/**
 * A look preference being written to storage under a name of somebody's own.
 *
 * Matched on the storage call rather than on the word, so a component may
 * still *read* `look.favourites` and render it — which is the whole point —
 * and only persisting a rival copy fails.
 */
const RIVAL =
  /(?:localStorage|sessionStorage)\.setItem\(\s*[`'"][^`'"]*(?:favourite|favorite|shortcut|ground|lightHome|theme)/i;

/**
 * The same thing wearing a variable, which is how it actually got in.
 *
 * The rule above names the four keys, and the shell's own hook would have
 * walked straight past it: it wrote ``semester.google.${key}``, so no literal
 * name ever appeared in the source. A component storing values under a key it
 * computes is a private preference store whatever the names turn out to be,
 * and under `components/` or `screens/` there is no honest use for one —
 * persistence is `lib/` and `state/`'s to own, and the files there that take a
 * computed key (`lib/device-library.ts`) are the abstraction rather than a
 * caller of it.
 */
const COMPUTED = /(?:localStorage|sessionStorage)\.setItem\(\s*`[^`]*\$\{/;
const UI = ['components', 'screens', 'ai'];

describe('a look preference lives in the look', () => {
  it('is not also kept in a component’s own storage', () => {
    const offenders = sources(SRC)
      .filter(({ path }) => !path.endsWith('.test.tsx'))
      .filter(({ path }) => !OWNERS.some((owner) => path.endsWith(owner)))
      .filter(({ text }) => RIVAL.test(withoutComments(text)))
      .map(({ path }) => path.slice(SRC.length + 1));
    expect(offenders, 'a second copy of a setting the look already holds').toEqual([]);
  });

  it('is not kept under a key a component makes up for itself', () => {
    const offenders = sources(SRC)
      .filter(({ path }) => !path.endsWith('.test.tsx'))
      .filter(({ path }) => UI.some((dir) => path.includes(`${dir}/`) || path.includes(`${dir}\\`)))
      .filter(({ text }) => COMPUTED.test(withoutComments(text)))
      .map(({ path }) => path.slice(SRC.length + 1));
    expect(offenders, 'a private preference store in a UI file').toEqual([]);
  });

  /*
   * The shell that had them. Named directly, because "no rival storage" would
   * also pass if somebody simply deleted the controls rather than connecting
   * them — and the controls are worth keeping. They have to write `setLook`.
   */
  it('is what the browser shell’s Customize panel writes', () => {
    const shell = sources(SRC).find(({ path }) => path.endsWith('GoogleShell.tsx'));
    expect(shell, 'the browser shell').toBeDefined();
    const text = withoutComments(shell!.text);
    expect(text, 'the shortcut row is a look key').toContain('look.shortcuts');
    expect(text, 'pinning writes through the resolver').toContain('toggleFavourite(');
    expect(text, 'the row is resolved against the registry').toContain('readFavourites(');
    expect(text, 'light and dark is the app’s ground').toContain('resolveGround(');
    expect(text, 'and every one of them goes through setLook').toContain("type: 'setLook'");
    expect(text, 'no private preference hook').not.toMatch(/function usePreference/);
  });
});
