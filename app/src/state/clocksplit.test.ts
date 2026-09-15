/// <reference types="node" />
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The clock is not on the store, and putting it back would be silent.
 *
 * It was a field on the store's one context value, and that value is read at
 * 195 call sites. So every tick made a new context value and re-rendered all
 * of them — including the 117 that have nothing to do with time. There is no
 * `React.memo` anywhere in this app to stop that; what made it expensive was
 * the clock, not the absence of memos.
 *
 * Nothing fails if somebody adds `now` back to the `Store` type and reads it
 * from `useStore()` again. It compiles, the tests pass, the app works — and
 * the app is back to re-rendering everything twice a minute. So the shape is
 * asserted here, where it can say why.
 *
 * See `ENGINEERING-AUDIT.md` §2.
 */

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

/** Every source file under `src`, tests excluded. */
function sources(dir = '.'): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const at = dir === '.' ? entry.name : `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...sources(at));
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(at);
  }
  return out;
}

describe('the minute has a context of its own', () => {
  it('is not a field on the store', () => {
    const store = read('state/store.tsx');
    // The `Store` interface, up to its closing brace.
    const shape = /interface Store \{([\s\S]*?)\n\}/.exec(store)?.[1] ?? '';
    expect(shape, 'the Store interface should be found').not.toBe('');
    expect(shape).not.toMatch(/^\s*now\s*:/m);
    // And not in the value the provider publishes.
    const value = /const value = useMemo\(\s*\(\) => \(\{([^}]*)\}\)/.exec(store)?.[1] ?? '';
    expect(value, 'the context value should be found').not.toBe('');
    expect(value.split(',').map((s) => s.trim())).not.toContain('now');
  });

  it('is published inside the store provider, which is what makes it cheap', () => {
    /*
     * Nested, not side by side. A tick makes a new value for `NowContext`
     * only; `StoreContext`'s is unchanged, and `children` is a prop whose
     * element identity does not change — so React bails out of the subtree and
     * visits the `useNow()` consumers alone. Side by side, or with the store
     * inside the clock, every tick would re-render the store's value too and
     * the split would buy nothing.
     */
    const store = read('state/store.tsx');
    expect(store).toMatch(
      /<StoreContext\.Provider[^>]*>\s*<NowContext\.Provider value=\{now\}>\{children\}<\/NowContext\.Provider>/,
    );
  });

  it('is what every file reading the clock asks for', () => {
    // A file that pulls `now` off `useStore()` again is the regression, and it
    // would typecheck only if `now` were put back on the type — so this is the
    // second line of defence and names the first.
    const offenders = sources().filter((p) =>
      /const \{[^}]*\bnow\b[^}]*\} *= *useStore\(\)/.test(read(p)),
    );
    expect(offenders, 'these should read useNow() instead').toEqual([]);
  });
});
