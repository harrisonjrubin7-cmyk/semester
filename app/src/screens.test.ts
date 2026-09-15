/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The screen table is the one place a screen is named, and stays that way.
 *
 * `App.tsx` held eighty-two `lazy()` consts and an eighty-three-case switch,
 * sixty lines apart, so adding a screen meant remembering both. They are one
 * row in `screens.tsx` now.
 *
 * Most of what that buys is enforced by the compiler rather than here:
 * `SCREENS` is `Record<Exclude<Screen, 'home' | 'onboarding'>, ComponentType>`,
 * so a screen in the union and not in the table does not build, and the error
 * names the missing id. That is stronger than any assertion in this file and
 * it is why the table is a `Record`.
 *
 * What the compiler cannot say is that the *old* shape has not quietly grown
 * back beside the new one — a `lazy()` in `App.tsx` and a case to go with it
 * would compile perfectly and put the app back to two places. So that is what
 * is asserted here.
 */

const src = (p: string) => readFileSync(join(process.cwd(), 'src', p), 'utf8');

describe('every screen is declared once', () => {
  it('keeps the lazy imports out of App.tsx', () => {
    const app = src('App.tsx');
    const strays = [...app.matchAll(/^const (\w+) = lazy\(/gm)].map((m) => m[1]);
    expect(strays, 'these belong in screens.tsx').toEqual([]);
  });

  it('and keeps the router a lookup rather than a switch', () => {
    const app = src('App.tsx');
    const body = /function CurrentScreen\(\)[\s\S]*?\n\}/.exec(app)?.[0] ?? '';
    expect(body, 'CurrentScreen should be found').not.toBe('');
    expect(body).toContain('SCREENS[');
    /*
     * One switch is allowed and only one: `home`, whose component depends on
     * the navigation rather than on `state.screen`. Counting rather than
     * banning, because banning it would push that decision somewhere worse.
     */
    expect((body.match(/case '/g) ?? []).length).toBe(2);
  });

  it('gives every row its own chunk, which is what `lazy` was for', () => {
    // The declarations moved; they did not merge. A row written as a plain
    // import would fold that screen into the entry bundle and nothing else
    // would notice — the app would simply get slower to open.
    const registry = src('screens.tsx');
    const rows = [...registry.matchAll(/^ {2}(\w+): (\w+),$/gm)].map((m) => m[2]);
    expect(rows.length).toBeGreaterThan(70);
    for (const component of new Set(rows)) {
      expect(registry, `${component} should be lazy`).toMatch(
        new RegExp(`const ${component} = lazy\\(`),
      );
    }
  });

  it('never renders a screen it did not fetch lazily', () => {
    // A static `import { X } from './screens/…'` in the registry would defeat
    // the whole file. `Today` is App.tsx's, and is deliberately not here.
    const registry = src('screens.tsx');
    expect(registry).not.toMatch(/^import \{[^}]*\} from '\.\/screens\//m);
  });
});
