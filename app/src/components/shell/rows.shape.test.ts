import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sources } from '../../styles/rules';

/**
 * Nobody draws by hand the row this app already has.
 *
 * `GROUPED-AUDIT.md` counted 74 hand-rolled rows across 31 of 58 screens and
 * named the giveaway — `borderBottom: '1px solid var(--app-line)'` — then
 * concluded that "rows have to be built first and then adopted, and adopting
 * them is a per-screen edit across 31 screens."
 *
 * The building happened: `shell/Rows.tsx` is that row, and the adopting has
 * largely happened too. What this file exists to stop is the third act, which
 * no audit can catch because it arrives one screen at a time — somebody typing
 * the shared row's own padding and its own hairline into a screen, six months
 * after the component that draws both was written.
 *
 * ## What it does not claim
 *
 * That every hairline is a fault. Measured across the tree, sixty-eight style
 * objects set an `--app-line` hairline and **one** of them had the shared
 * row's shape — and that one turned out to be the total line *under* a list
 * (`screens/Data.tsx`, "Everything", a `borderTop`), not a row in it. The rest
 * differ on purpose: `screens/Privacy.tsx` pads 5px and `screens/Grades.tsx`
 * 8px because those are compact figure lists rather than 44px settings rows,
 * and `CustomRow`'s own header says at length why forcing them into the shared
 * component would change the layout it exists to leave alone.
 *
 * So this asks the narrow question that has one right answer — *is this the
 * shared row, retyped?* — rather than the broad one that does not.
 *
 * ## And what it therefore cannot catch
 *
 * A row that is `ItemRow`'s shape in different numbers. `screens/call/Lobby.tsx`
 * and `components/ForThis.tsx` each drew an icon, a title with its meta
 * stacked under it and a hairline — `ItemRow` exactly — at their own padding,
 * so this guard was silent on both and they were converted by reading the
 * screens rather than by running it. The question that found them is whether
 * the meta sits *under* the title (`ItemRow`) or *beside* it (`CustomRow`),
 * and it is not one a regex over style objects can ask, because the answer is
 * in the markup rather than in the style.
 */

const here = dirname(fileURLToPath(import.meta.url));
const ROWS = 'components/shell/Rows.tsx';

/**
 * The shared row's own plain-mode shape, read out of the component.
 *
 * Derived rather than written down. A guard that hardcodes `11px` is a guard
 * that silently stops matching the day somebody tunes `Row` to 12, which is
 * exactly when it would be most wanted — and it would keep passing, which is
 * the failure mode `CLAUDE.md` calls a guard that has never failed.
 */
function sharedRowShape(): { pad: number; hairline: string } {
  const code = readFileSync(join(here, 'Rows.tsx'), 'utf8');
  const pad = /padding: grouped[\s\S]*?: 'calc\((\d+)px \* var\(--density, 1\)\) 0'/.exec(code);
  const hairline = /borderBottom: '(1px solid var\(--app-line\))'/.exec(code);
  expect(pad, 'Row no longer sets its plain padding this way; re-point this guard').toBeTruthy();
  expect(hairline, 'Row no longer sets its plain hairline this way; re-point this guard').toBeTruthy();
  return { pad: Number(pad![1]), hairline: hairline![1] };
}

/** Style objects: the braced runs with no brace inside them. `dim.test.ts`'s. */
function styleObjects(code: string): string[] {
  return code.match(/\{[^{}]*\}/g) ?? [];
}

/**
 * Whether one style object is the shared row's shape, written out by hand.
 *
 * `borderBottom` specifically, not the hairline as a substring. The first
 * version of this asked only whether the block contained
 * `1px solid var(--app-line)` anywhere, and reported `screens/Data.tsx` — the
 * **total** under the storage list, which sets the same colour on its
 * `borderTop` and happens to pad 11px. A line *under* a list is not a row
 * *in* one, and a guard that cannot tell those apart would have had its first
 * finding be a false one.
 */
export function retypesTheRow(block: string, shape: { pad: number; hairline: string }): boolean {
  if (!new RegExp(`borderBottom: '${shape.hairline.replace(/[()]/g, '\\$&')}'`).test(block)) return false;
  // The un-densitied form of the same padding, which is what a hand-written
  // copy of this row looks like: nobody retypes the `calc()`.
  return new RegExp(`padding: '${shape.pad}px 0'`).test(block);
}

describe('the row every screen shares', () => {
  const shape = sharedRowShape();

  it('has a shape this guard can actually read', () => {
    // The probe, pointed at itself. A clean sweep below is only worth
    // something if these two values came out of the component.
    expect(shape.pad).toBeGreaterThan(0);
    expect(shape.hairline).toBe('1px solid var(--app-line)');
  });

  /*
   * The control, and the reason the sweep's zero means anything.
   *
   * A matcher that never matches reports every tree as clean. So it is shown
   * finding the thing it is for, and shown *not* finding the two compact rows
   * that exist on purpose — if it flagged those, the honest fix would be to
   * narrow the matcher rather than to rewrite two screens.
   */
  it('is told apart from the compact rows that differ on purpose', () => {
    const retyped = `{ display: 'flex', padding: '${shape.pad}px 0', borderBottom: '1px solid var(--app-line)' }`;
    expect(retypesTheRow(retyped, shape), 'the matcher does not find its own target').toBe(true);

    // `screens/Privacy.tsx` and `screens/Grades.tsx`, in the shapes they have.
    const compact = [
      "{ display: 'flex', padding: '5px 0', borderBottom: '1px solid var(--app-line-soft)' }",
      "{ display: 'flex', padding: '8px 0', borderBottom: '1px solid var(--app-line-soft)' }",
    ];
    for (const block of compact) expect(retypesTheRow(block, shape), block).toBe(false);

    /*
     * And a line *under* a list is not a row *in* one — the same colour, the
     * same padding, the other edge. This is `screens/Data.tsx`'s total, and
     * it was the first version's only finding: the matcher looked for the
     * hairline as a substring and so could not tell the two edges apart.
     * Varied one thing at a time, which the pair above did not.
     */
    const total = `{ display: 'flex', padding: '${shape.pad}px 0', borderTop: '1px solid var(--app-line)' }`;
    expect(retypesTheRow(total, shape), 'a total line under a list is not a row').toBe(false);
    expect(retypesTheRow("{ borderBottom: '1px solid var(--app-line)' }", shape)).toBe(false);
  });

  it('is not retyped anywhere in the app', () => {
    const found: string[] = [];
    let scanned = 0;
    for (const file of sources(join(here, '..', '..'), { tests: false })) {
      const path = file.path.slice(file.path.indexOf('/src/') + 5);
      if (path === ROWS) continue;
      scanned += 1;
      for (const block of styleObjects(file.text)) {
        if (retypesTheRow(block, shape)) found.push(path);
      }
    }
    // `sources()` throws on an empty tree; this is the weaker claim it cannot
    // make — that the sweep reached the whole app rather than one corner.
    expect(scanned, 'the sweep did not reach the app').toBeGreaterThan(200);
    expect([...new Set(found)]).toEqual([]);
  });
});
