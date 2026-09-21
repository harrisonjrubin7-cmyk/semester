// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StoreProvider } from '../../state/store';
import { STORAGE_KEY } from '../../state/shape';
import { loadSeed } from '../../data/seed';
import { ItemRow } from './Rows';

/**
 * What a row *is*, when it is not just a row.
 *
 * `ItemRow` did not forward `role`, `aria-checked`, `aria-pressed` or
 * `aria-label`, and the cost was not a missing feature — it was two screens
 * that drew their own row instead. `components/MuteCourses.tsx` is a
 * `role="switch"` per course and `components/creation/DesignEditor.tsx` is an
 * `aria-pressed` layer list; both kept the semantics and lost the shared row,
 * and an audit later counted both as hand-drawn rows without being able to say
 * why they were. A component that makes the accessible choice the expensive
 * one gets worked around, and the working-around does not look like a bug.
 *
 * ## Why this renders rather than reads the source
 *
 * `rows.shape.test.ts` next door reads style objects, and is careful in its own
 * header about what that cannot see. This question has a failure mode source
 * reading would miss entirely: the props can be declared on `ItemRow`, spelled
 * correctly, forwarded to `Row` — and dropped by `Row`, which is where they
 * were being dropped for the `div` branch until this was written. A row with no
 * `onClick` renders a `div`, and that branch carried none of the four. Nothing
 * about the call site would have looked wrong.
 *
 * So this asks Chromium's own answer, through jsdom: after rendering, is the
 * attribute on the element? That cannot be satisfied by a prop that is passed
 * and then ignored.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const here = dirname(fileURLToPath(import.meta.url));

let host: HTMLDivElement;
let root: Root;

function draw(node: React.ReactNode) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ schemaVersion: 6, seenOnboarding: true, shell: 'plain', nav: 'tabs' }),
  );
  act(() => {
    root.render(<StoreProvider>{node}</StoreProvider>);
  });
}

/**
 * The seed, awaited rather than raced — `softtop.test.tsx`'s reason verbatim.
 *
 * `StoreProvider` starts `loadSeed()` on mount and it dynamically imports four
 * course modules. Left to finish on its own it outlives this file's
 * environment and vitest ends the run with `EnvironmentTeardownError`s and a
 * non-zero exit: a green suite that fails anyway. `loadSeed` memoises, so this
 * is the same work the provider is already doing.
 */
async function settle() {
  await loadSeed().catch(() => []);
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

beforeEach(() => {
  history.replaceState(null, '', '/');
  localStorage.clear();
  host = document.createElement('div');
  document.body.append(host);
  act(() => {
    root = createRoot(host);
  });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('what a shared row carries for a screen reader', () => {
  it('is a switch when a screen says it is one', async () => {
    draw(
      <ItemRow
        role="switch"
        ariaChecked
        ariaLabel="Unmute ECON 1020"
        onClick={() => {}}
        title="ECON 1020"
        meta="Principles of Microeconomics"
      />,
    );
    await settle();

    const row = host.querySelector('button');
    expect(row, 'a row with an onClick should be a button').toBeTruthy();
    expect(row!.getAttribute('role')).toBe('switch');
    expect(row!.getAttribute('aria-checked')).toBe('true');
    expect(row!.getAttribute('aria-label')).toBe('Unmute ECON 1020');
  });

  it('is pressed when a screen says it is picked', async () => {
    draw(<ItemRow ariaPressed onClick={() => {}} title="1. Title layer" />);
    await settle();
    expect(host.querySelector('button')!.getAttribute('aria-pressed')).toBe('true');
  });

  /*
   * The branch that was dropping them, and the reason this file renders.
   *
   * A row with no `onClick` is a `div`, and `Row`'s `div` carried no aria at
   * all. A caller passing `role="switch"` to one would have read as a plain
   * `div` to a screen reader with nothing at the call site to show for it.
   */
  it('carries a role on a row that is not a button', async () => {
    draw(<ItemRow role="status" ariaLabel="Two courses silenced" title="2 silenced" />);
    await settle();

    const row = host.querySelector('[role="status"]');
    expect(row, 'a role on a div row was dropped').toBeTruthy();
    expect(row!.tagName).toBe('DIV');
    expect(row!.getAttribute('aria-label')).toBe('Two courses silenced');
  });

  /*
   * The control. Every assertion above is that an attribute is *present*, and
   * a `Row` that emitted `role="switch"` unconditionally would pass all three
   * — so this is the one that says the attributes come from the caller.
   *
   * `aria-checked` and `aria-pressed` specifically: React omits an attribute
   * given `undefined` and writes `"false"` given `false`, and "false" is not
   * nothing — a plain row announced as an unpressed toggle is its own bug.
   */
  it('carries nothing a screen did not ask for', async () => {
    draw(<ItemRow onClick={() => {}} title="Just a row" meta="Nothing special" />);
    await settle();

    const row = host.querySelector('button')!;
    for (const attr of ['role', 'aria-checked', 'aria-pressed', 'aria-label']) {
      expect(row.hasAttribute(attr), `a plain row should not carry ${attr}`).toBe(false);
    }
  });

  /*
   * And the two screens the widening was for, read rather than rendered.
   *
   * Cheap, and it guards the direction this is most likely to rot in: not
   * `ItemRow` losing the props, but a screen being tidied later and quietly
   * dropping the semantics it only has because the component now allows them.
   * Rendering either one needs a catalog and a project; the question here is
   * only whether the attribute is still asked for at all.
   */
  it('is still asked for by the two screens it was widened for', () => {
    const asks: [string, RegExp][] = [
      ['../MuteCourses.tsx', /role="switch"[\s\S]{0,200}ariaChecked=\{off\}/],
      ['../creation/DesignEditor.tsx', /ariaPressed=\{layer\.id === selected\}/],
    ];
    for (const [rel, wants] of asks) {
      const code = readFileSync(join(here, rel), 'utf8');
      expect(code).toContain('ItemRow');
      expect(wants.test(code), `${rel} no longer asks the shared row for its semantics`).toBe(true);
    }
  });
});
