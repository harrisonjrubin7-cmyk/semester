import { useEffect, useRef, type KeyboardEvent, type RefObject } from 'react';

/**
 * `aria-modal="true"`, kept as a promise rather than said as one.
 *
 * Seven overlays in this app declare it. The attribute is not decoration: it
 * tells a screen reader that everything outside this element is *not there* —
 * VoiceOver and NVDA stop offering it, and the reader's own navigation is
 * confined to the dialog. What it does not do is confine the Tab key. That is
 * the author's job, and until now six of the seven were not doing it: two had
 * hand-rolled a trap each, with different selectors and different bugs, and
 * the rest had none at all, so one press of Tab walked out of a dialog the
 * markup had just declared to be the only thing on the page.
 *
 * `Adopting` is the clearest case, because its own note already argues the
 * point on the other axis. It is the one question the app asks before it will
 * do anything, and it grew from `absolute` to `fixed` on a wide window
 * precisely so the rail was not "showing and clickable beside a dialog that
 * says `aria-modal`" — "a student who can walk into Courses instead has been
 * told something untrue". A student pressing Tab could walk into Courses.
 * Same untruth, on the axis the attribute is actually about.
 *
 * ## One trap, in one place
 *
 * `Folder` queried `'button:not([disabled])'`, which is right for a grid of
 * buttons and silently skips the field in any dialog that has one. `Assistant`
 * queried buttons, links, fields and `[tabindex]`, and did not exclude
 * disabled controls — so a dialog whose Send button is disabled until you type
 * had a dead stop at the end of its ring. Neither is wrong so much as alone:
 * this is the same problem solved twice, badly, which is the shape this
 * codebase treats as a bug in itself (`arrange.ts` for dragging, `chrome.ts`
 * for navigation, `Said.tsx` for announcements).
 *
 * ## And focus comes back
 *
 * The other half of a modal, and the half more often missed. Focus goes into
 * the dialog when it opens and returns to whatever opened it when it closes.
 * Without the return, closing the search palette leaves focus on `<body>`: the
 * next Tab starts at the top of the app, and a screen reader is put back at
 * the beginning of a page it had been halfway down. `Folder` did this and
 * nothing else did.
 */

/** Everything that can hold focus, before the filtering below. */
const FOCUSABLE = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  'summary',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]',
].join(',');

/**
 * Whether an element is hidden from the ring by itself or by an ancestor.
 *
 * Read off the markup — the `hidden` attribute, `aria-hidden`, and a
 * `display`/`visibility` written inline — rather than off computed style.
 * Computed style needs layout, jsdom has none, and a rule that can only be
 * checked in a browser is one this file's test cannot hold. It is also what
 * the app actually does: the overlays hide their parts with `hidden` or by
 * not rendering them, and the one pattern that would otherwise slip through —
 * the invisible `<input type="file">` behind a button, as in `Capture` — sets
 * `display: 'none'` inline.
 *
 * Getting this wrong is not cosmetic. A trap that offers a `display: none`
 * input its turn calls `focus()` on an element that cannot take it, focus
 * stays where it was, and the ring stops moving — a dialog somebody is now
 * stuck in, by the code that was meant to keep them safely inside it.
 */
function hidden(el: HTMLElement, root: HTMLElement): boolean {
  for (let n: HTMLElement | null = el; n; n = n.parentElement) {
    if (n.hidden) return true;
    if (n.getAttribute('aria-hidden') === 'true') return true;
    if (n.style.display === 'none' || n.style.visibility === 'hidden') return true;
    if (n === root) break;
  }
  return false;
}

/** The dialog's tab ring, in tab order, as the browser would offer it. */
export function focusablesIn(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => {
    if (el.hasAttribute('disabled')) return false;
    // `tabindex="-1"` is focusable by script and not by Tab. The dialog's own
    // box usually carries one, which is why it is not in the ring but is
    // still where focus lands when a dialog has nothing else to give it.
    if (Number(el.getAttribute('tabindex') ?? 0) < 0) return false;
    return !hidden(el, root);
  });
}

/**
 * Where Tab should go, or `null` to let the browser do its own thing.
 *
 * Pure over an array, so the ring's arithmetic is testable without a browser
 * — the same split `lib/arrange.ts` makes between the move and the pointer.
 *
 * The third case is the one a hand-rolled trap misses: focus that is already
 * outside the ring. It happens whenever something focused is removed while
 * the dialog is open — a row deleted, a button that becomes disabled — which
 * leaves focus on `<body>`, where "is it the last element" is false and the
 * next Tab starts at the top of the app behind the dialog. Wrapping it back in
 * is the whole point.
 */
export function nextInRing(
  ring: HTMLElement[],
  active: Element | null,
  back: boolean,
): HTMLElement | null {
  if (ring.length === 0) return null;
  const first = ring[0];
  const last = ring[ring.length - 1];
  const at = active instanceof HTMLElement ? ring.indexOf(active) : -1;
  if (at === -1) return back ? last : first;
  if (back && at === 0) return last;
  if (!back && at === ring.length - 1) return first;
  return null;
}

export interface Modal<T extends HTMLElement> {
  /** Put this on the element carrying `role="dialog"`. */
  ref: RefObject<T | null>;
  /** And this. It traps Tab, and closes on Escape when `onClose` is given. */
  onKeyDown: (e: KeyboardEvent) => void;
}

/**
 * A dialog that keeps focus, and gives it back.
 *
 * `onClose` is optional because one dialog rightly has no way out: `Adopting`
 * asks which copy of a term to keep, and "no backdrop tap, no Escape" is a
 * decision its own note argues for. Omitting it traps focus without adding an
 * exit, which is the correct shape for a question that must be answered rather
 * than a bug.
 *
 * `initial` is for the dialogs that already choose where focus lands — the
 * search palette opens on its field, the capture box on its text area — so
 * this does not take that away from them and land on a Close button instead.
 */
export function useModal<T extends HTMLElement = HTMLDivElement>({
  onClose,
  initial,
  on = true,
}: {
  onClose?: () => void;
  initial?: RefObject<HTMLElement | null>;
  /**
   * Whether the dialog is up.
   *
   * Most callers mount when they open and unmount when they close, and for
   * those the default is the answer. `Ringing` does not: it is mounted all
   * term and draws nothing until a timer goes off, so its own `return null`
   * comes before anything else it does — and a hook cannot come after that.
   * Passing the condition in rather than calling this conditionally is the
   * only shape React allows, and it is the more honest one anyway: opening is
   * a thing that happens to a dialog, not the same event as existing.
   */
  on?: boolean;
} = {}): Modal<T> {
  const ref = useRef<T>(null);
  const came = useRef<Element | null>(null);

  /*
   * Once, on open. Not on every change of `onClose` — a caller passing an
   * inline arrow would otherwise re-run this on every render, taking focus
   * back off whatever the person had tabbed to since.
   */
  useEffect(() => {
    if (!on) return;
    came.current = document.activeElement;
    const box = ref.current;
    // The dialog's own box last: a dialog with nothing focusable in it still
    // has to take focus from the page behind it, or the trap has nothing to
    // trap and the reader is left outside.
    const want = initial?.current ?? (box ? focusablesIn(box)[0] : null) ?? box;
    want?.focus();
    return () => {
      const back = came.current;
      // `document.contains` because what opened the dialog is often gone by
      // the time it closes — a row that was deleted, a screen that was left.
      // Focusing a detached element silently moves focus to `<body>`, which is
      // the failure this is here to prevent.
      if (back instanceof HTMLElement && document.contains(back)) back.focus({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (!on) return;
    if (e.key === 'Escape' && onClose) {
      e.preventDefault();
      // Stopped, or an Escape meant for the dialog also reaches the screen
      // behind it — which on the calendar cancels a drag nobody was making.
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !ref.current) return;
    const to = nextInRing(focusablesIn(ref.current), document.activeElement, e.shiftKey);
    if (!to) return;
    e.preventDefault();
    to.focus();
  };

  return { ref, onKeyDown };
}
