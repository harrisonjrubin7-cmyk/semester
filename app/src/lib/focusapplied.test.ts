import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A mode the app offers a switch for is a mode something applies.
 *
 * `lib/gateapplied.test.ts` exists because `lib/reveal.ts` — fully written,
 * eighteen tests — lost its last caller in a merge and nobody noticed for a
 * week, while Settings went on offering the switch. `lib/focus.ts` is the
 * fourth gate and is one merge away from the same fault, so this is the same
 * test, pointed at it: not "does the filter work" — `focus.test.ts` — but
 * "does anything a person can see call it".
 *
 * It resolves the import rather than grepping for a name, for the reason the
 * other file gives: `focused` is a word, and a grep for it finds CSS.
 */
const SRC = new URL('..', import.meta.url).pathname;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sources(full);
    if (!/\.tsx?$/.test(name) || /\.test\.tsx?$/.test(name)) return [];
    return [full];
  });
}

/** The names a file imports from `lib/focus`, by whatever relative path. */
function fromFocus(code: string): string[] {
  const out: string[] = [];
  for (const m of code.matchAll(/import\s*\{([^}]*)\}\s*from\s*'([^']*\/focus)'/g)) {
    for (const part of m[1].split(',')) {
      const name = part.replace(/\btype\b/, '').trim().split(/\s+as\s+/)[0];
      if (name) out.push(name);
    }
  }
  return out;
}

function importing(...names: string[]): string[] {
  return sources(SRC)
    .filter((f) => {
      const got = fromFocus(readFileSync(f, 'utf8'));
      return names.some((n) => got.includes(n));
    })
    .map((f) => f.slice(SRC.length));
}

describe('focus', () => {
  it('is applied on the directory, which is the surface experience §377 is about', () => {
    expect(importing('focused', 'inFocus')).toContain('screens/Directory.tsx');
  });

  it('is applied on the chrome — the shelves, the launcher pages and the by-task tiles', () => {
    // The departure `lib/focus.ts` argues for: unlike reveal, this gate is
    // the person's own and moves once, so the rows you navigate by take it.
    const surfaces = importing('focused', 'inFocus');
    expect(surfaces).toContain('components/nav/ShelfNav.tsx');
    expect(surfaces).toContain('components/nav/ByTask.tsx');
    expect(surfaces).toContain('lib/springboard.ts');
  });

  it('quiets the nonessential reminders where they are fired, not where they are drawn', () => {
    expect(importing('essentialOnly')).toContain('state/store.tsx');
  });

  it('sets aside the campus on Today', () => {
    expect(importing('inFocusMode')).toContain('screens/Today.tsx');
  });

  it('is not applied to search, on purpose', () => {
    // Hiding from a directory is a claim about what you want in front of
    // you; hiding from search would be a claim about what you are allowed to
    // want. The same line `gateapplied.test.ts` draws.
    const anywhere = importing('focused', 'inFocus', 'inFocusMode', 'essentialOnly');
    expect(anywhere).not.toContain('components/Command.tsx');
    expect(anywhere).not.toContain('screens/Search.tsx');
    expect(anywhere).not.toContain('components/desk/TopBar.tsx');
  });

  it('finds imports at all, or the cases above prove nothing', () => {
    expect(fromFocus("import { focused, type Foo as Bar } from '../lib/focus';")).toEqual(['focused', 'Foo']);
    expect(fromFocus("import { inFocusMode } from './focus';")).toEqual(['inFocusMode']);
    // A module that merely ends in the word is not this one.
    expect(fromFocus("import { focus } from '../lib/notfocus';")).toEqual([]);
    expect(fromFocus("import { x } from './focused';")).toEqual([]);
  });
});
