import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A route into Edit opens the course Edit will read.
 *
 * `screens/EditCourse.tsx` answers one question — *which course am I
 * editing?* — and answers it from `state.courseId`:
 *
 *     const owned = state.courses.find((c) => c.course.id === state.courseId);
 *
 * Nothing else. So a button that means "edit *this* course" has to set that
 * field before it navigates, and the only action that sets it is
 * `openCourse`.
 *
 * ## The instance is already fixed; this is about the next one
 *
 * `screens/Essay.tsx` dispatched `openGuide` — which sets `guideId`, a
 * different field — and then went to `edit`, so the policy a student typed
 * was recorded against whichever course was last open somewhere else. That
 * was found and fixed on main in the seventeenth simplify pass, which also
 * spotted a history entry nobody visited, and guarded with
 * `screens/essaypolicy.test.tsx` — a render test that drives Essay, picks a
 * course, presses the button and reads the pointer, with a control beside
 * it. For that screen it is the better test of the two and it stays.
 *
 * What it cannot do is say anything about the *next* route into Edit
 * somebody writes, and `SIMPLIFY-AUDIT.md`'s own census expects that number
 * to move: Edit is reached from seven places today. A fault that took six
 * passes of reading screens to notice, and that renders perfectly when it is
 * wrong, is one worth a guard that does not depend on somebody remembering
 * to write a render test for each new caller.
 *
 * ## So this reads the pairing rather than the screen
 *
 * The same argument `src/rootunmount.test.ts` makes: a structural check
 * cannot be fooled by a screen that draws correctly, and it holds for call
 * sites that do not exist yet. Reverting Essay to `openGuide` turns it red
 * naming the file, so it is known to be a guard and not decoration.
 *
 * A site that navigates to Edit *without* opening anything is not caught
 * here and is not a fault: it means "edit whatever is open", which is what
 * `Courses.tsx` and `OfficeHours.tsx` mean, both being drawn inside an
 * already-open course.
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

/** Every `open*` dispatched in the same handler as a `go: 'edit'`, with its file. */
function openersBeforeEdit(): { file: string; opener: string }[] {
  const out: { file: string; opener: string }[] = [];
  for (const file of sources(SRC)) {
    const code = readFileSync(file, 'utf8');
    const go = /dispatch\(\{\s*type:\s*'go',\s*screen:\s*'edit'\s*\}\)/g;
    for (const hit of code.matchAll(go)) {
      /*
       * The handler this sits in, approximated as the 400 characters before
       * it. Long enough to hold an `open*` and the lines between, short
       * enough not to reach an unrelated one further up the file — measured
       * against all seven current sites, whose openers sit one line above.
       */
      const before = code.slice(Math.max(0, hit.index - 400), hit.index);
      const opens = [...before.matchAll(/type:\s*'(open[A-Za-z]+)'/g)];
      const last = opens[opens.length - 1];
      if (last) out.push({ file: file.slice(SRC.length), opener: last[1] });
    }
  }
  return out;
}

describe('every route into Edit', () => {
  const found = openersBeforeEdit();

  it('finds the sites at all, or this guard proves nothing', () => {
    // Six of the seven `go: 'edit'` sites pair with an opener; the guard is
    // worthless if a refactor makes that zero and the suite stays green.
    expect(found.length).toBeGreaterThanOrEqual(4);
  });

  it.each(found)('opens a course before editing one — $file', ({ opener }) => {
    expect(opener).toBe('openCourse');
  });
});
