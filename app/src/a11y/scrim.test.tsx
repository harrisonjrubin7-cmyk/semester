// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { join } from 'node:path';
import { sources } from '../styles/rules';
import { useScrim } from './modal';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Pressing outside a dialog closes it; pressing inside and letting go outside
 * must not (`useScrim`). The browser fires `click` on the common ancestor of
 * the press and the release, which is the backdrop in that second case, so the
 * old `onClick={close}` closed the dialog mid-selection. Checked in Chromium
 * when this was written; here the same sequences are driven as events.
 */

let host: HTMLDivElement;
let root: Root;
const close = vi.fn();

function Dialog() {
  const scrim = useScrim(close);
  return (
    <div id="scrim" {...scrim}>
      <div id="panel" onClick={(e) => e.stopPropagation()}>
        <textarea id="field" />
      </div>
    </div>
  );
}

beforeEach(() => {
  close.mockClear();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(<Dialog />));
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const el = (id: string) => host.querySelector(`#${id}`)!;
const fire = (target: Element, type: string) =>
  act(() => void target.dispatchEvent(new Event(type, { bubbles: true, cancelable: true })));

/** What a mouse does: press, release, and a click on the nearest common ancestor of the two. */
function gesture(from: string, to: string) {
  fire(el(from), 'pointerdown');
  fire(el(to), 'pointerup');
  const common = from === to ? el(from) : el('scrim'); // both ancestors of everything here
  fire(common, 'click');
}

describe('useScrim', () => {
  it('closes on a press and release on the backdrop', () => {
    gesture('scrim', 'scrim');
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('does not close on a click inside the panel', () => {
    gesture('panel', 'panel');
    gesture('field', 'field');
    expect(close).not.toHaveBeenCalled();
  });

  it('does not close when a selection starts in the panel and is released on the backdrop', () => {
    gesture('field', 'scrim');
    expect(close).not.toHaveBeenCalled();
  });

  it('does not close when the press starts on the backdrop and ends in the panel', () => {
    gesture('scrim', 'panel');
    expect(close).not.toHaveBeenCalled();
  });

  it('still closes on a bare click with no pointer events — a script or assistive technology', () => {
    fire(el('scrim'), 'click');
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('forgets one gesture before the next', () => {
    gesture('field', 'scrim'); // swallowed
    gesture('scrim', 'scrim'); // a fresh, honest press outside
    expect(close).toHaveBeenCalledTimes(1);
  });
});

describe('every dialog backdrop uses it', () => {
  // A new hand-rolled `<div className="…wash" onClick={close}>` would bring the bug back.
  const dir = `${join(__dirname, '..')}/`;
  it('has no backdrop that closes on a bare onClick', () => {
    const offenders = sources(dir, { tests: false })
      .filter((f) => /<div[^>]*className=\{?[`"'][^>]*(wash|backdrop|scrim)[^>]*onClick=/.test(f.text))
      .map((f) => f.path.slice(dir.length));
    expect(offenders, 'spread useScrim(onClose) on the backdrop instead of onClick').toEqual([]);
  });
});
