import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A gate the app offers a switch for is a gate something applies.
 *
 * `lib/reveal.ts` is the progressive-disclosure gate: sixty screens is a wall
 * on a first morning, so a new account sees the twelve that do something
 * before there is a course and earns the rest by importing a syllabus,
 * entering a grade, putting an exam in the calendar. It is a good idea, it is
 * fully written, and it has eighteen tests.
 *
 * Every one of those eighteen tests calls `showing`, `unlocked`, `countHidden`
 * or `revealLine` directly. Not one asks whether anything in the app calls
 * them. So when `4eb1044` merged `Progress → Everything` into
 * `screens/Directory.tsx` — two surfaces drawing one registry, which is the
 * merge this audit exists to make — the tab that went was the one applying
 * the gate, and the screen that survived had always used the weaker `offered`.
 * The suite stayed green, because nothing in it was about the wiring.
 *
 * ## What that looked like on screen
 *
 * Measured on a fresh profile with no courses, driven in a browser:
 *
 *   - **Settings → Layout and navigation** said *"46 screens appear once
 *     there is something for them to work on — an exam, a grade, a second
 *     course."*
 *   - The directory, on that same account, drew **58 of 58**.
 *   - **Show every screen straight away**, the switch under that sentence,
 *     produced a byte-identical list either way.
 *
 * Three user-visible claims, none of them true, for a week. And the state
 * behind the switch was persisted, merged across devices and described in the
 * data export the whole time.
 *
 * ## Why this shape of test
 *
 * `src/rootunmount.test.ts`'s argument, one floor up. A render test proves
 * today's screen and is the better test of that screen —
 * `screens/directoryreveal.test.tsx` is that test and it stays. This one
 * cannot be fooled by a screen that draws correctly, and it holds for the
 * *next* merge: the fault was not that a directory was wrong, it was that a
 * gate lost its last caller and nothing noticed for a week.
 *
 * It resolves the import rather than grepping for the name, because the name
 * is not the thing. Three different `showing` functions live in this tree —
 * `lib/strip.ts`'s, `lib/ribbon.ts`'s and this one — and two of them are
 * called from components. A grep for `showing(` reports this gate as applied
 * and has done since the day it stopped being.
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

/** The names a file imports from `lib/reveal`, by whatever relative path. */
function fromReveal(code: string): string[] {
  const out: string[] = [];
  for (const m of code.matchAll(/import\s*\{([^}]*)\}\s*from\s*'([^']*reveal)'/g)) {
    for (const part of m[1].split(',')) {
      const name = part.replace(/\btype\b/, '').trim().split(/\s+as\s+/)[0];
      if (name) out.push(name);
    }
  }
  return out;
}

/** Where the gate is applied: a screen or a component, not another library. */
function surfacesApplying(): string[] {
  return sources(SRC)
    .filter((f) => /\/(screens|components|ai)\//.test(f))
    .filter((f) => fromReveal(readFileSync(f, 'utf8')).includes('showing'))
    .map((f) => f.slice(SRC.length));
}

describe('the progressive-disclosure gate', () => {
  it('is applied on a surface a person can see', () => {
    // Not "somewhere in lib". `lib/nav.ts` imported `showing` for a
    // `listed()` that nothing called, which is exactly the state this test
    // exists to fail on — a gate one library away from every screen is a gate
    // that is not applied.
    expect(surfacesApplying()).not.toEqual([]);
  });

  it('names the directory, which is the surface it is for', () => {
    // `lib/reveal.ts` argues about *a directory of sixty names*, and
    // `components/nav/ShelfNav.tsx` justifies its own departure from the gate
    // on the words "Reveal still governs Everything". Both are claims about
    // this one file.
    expect(surfacesApplying()).toContain('screens/Directory.tsx');
  });

  it('finds the import at all, or the two above prove nothing', () => {
    // The probe, pointed at its own failure. If `fromReveal` stopped parsing
    // imports it would return nothing everywhere and both cases above would
    // fail loudly — but a change that made it match *everything* would pass
    // them while measuring nothing. Search is not a surface and must not
    // appear: `components/Command.tsx` is the ungated one on purpose.
    expect(surfacesApplying()).not.toContain('components/Command.tsx');
    expect(fromReveal(readFileSync(join(SRC, 'screens/Directory.tsx'), 'utf8'))).toContain(
      'showing',
    );
  });
});
