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

/**
 * The handler a `go` actually sits in, rather than the characters near it.
 *
 * The first version of this took the 400 characters before the `go` and used
 * the last `open*` in them, which is right for all seven current sites and
 * wrong in a way that costs a red build on correct code: a window measured in
 * characters crosses into the *previous button*.
 *
 * Measured on this tree by the eighteenth simplify pass, which ran the same
 * pairing over every destination rather than over `edit` alone. Two of the
 * four pairs it found were not pairs at all:
 *
 *   - `screens/Courses.tsx` draws "Add a reading to this course"
 *     (`openUpdate`) and then, nine lines later, a separate button that goes
 *     to `announce` carrying nothing. The window reported them as one.
 *   - `components/ForThis.tsx` has `case 'note': openNote; return;` directly
 *     above `case 'equation': … go 'equations'`. The window read across the
 *     `return`.
 *
 * Neither is a fault in the app, and both would have read as one. And the
 * margin on the real thing is thin: in `Courses.tsx` the `go: 'edit'` button
 * misses that same `openUpdate` by **227 characters**. One more button
 * between them, or a longer `style` prop, and this guard fails naming a file
 * that is correct — which is the failure mode that gets a guard deleted
 * rather than fixed.
 *
 * So the window is cut back to the last handler boundary in it: an `on…=`
 * prop, a `case` label, or a bare `return`. An opener on the far side of one
 * of those belongs to different code.
 */
function handlerOf(before: string): string {
  let cut = 0;
  for (const m of before.matchAll(/on[A-Z][a-zA-Z]*=|case\s+'[^']*':|return;/g)) {
    cut = (m.index ?? 0) + m[0].length;
  }
  return before.slice(cut);
}

/** Every `open*` dispatched in the same handler as a `go: 'edit'`, with its file. */
function openersBeforeEdit(): { file: string; opener: string }[] {
  const out: { file: string; opener: string }[] = [];
  for (const file of sources(SRC)) {
    const code = readFileSync(file, 'utf8');
    const go = /dispatch\(\{\s*type:\s*'go',\s*screen:\s*'edit'\s*\}\)/g;
    for (const hit of code.matchAll(go)) {
      /*
       * 400 characters to bound the search, then `handlerOf` to cut it back
       * to the handler itself. The character count alone is what reached
       * into a neighbouring button; see the note on `handlerOf`.
       */
      const before = handlerOf(code.slice(Math.max(0, hit.index - 400), hit.index));
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
