import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fills, FILLS } from '../components/shell/exempt';
import { probes } from './Assistant';

/**
 * The chat ends at the bottom of the window.
 *
 * ## The bug this exists to make impossible again
 *
 * Every file was right on its own. `.scrollarea` reserves 76px under every
 * screen so nothing sits behind the assistant's floating button, which is
 * correct for the forty-nine screens that have one. `ai/Assistant.tsx` does
 * not draw that button on the chat tab, because the tab you are on *is* the
 * assistant — also correct. Neither knew about the other, so the chat got a
 * reservation for a button that was never drawn: the composer stopped 76px
 * short of the tab bar, with a band of empty ground under it that read as a
 * rendering fault and left the screen looking like a panel floating in the
 * top two-thirds of an empty phone.
 *
 * It is worth a test rather than a comment for the reason every layout bug of
 * this shape is: it is invisible in the file that causes it. Nothing in
 * `app.css` mentions the chat and nothing in `Chat.tsx` mentions the padding.
 * The join between them is `shell/exempt.ts`, and these are the three
 * assertions that keep the three in step.
 */

const src = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const css = () => src('../styles/app.css');

describe('the screens that fill their box', () => {
  it('are the two chats and the mailbox, and nothing else', () => {
    // Not a list anyone should grow casually. A screen belongs here when its
    // own body pins something to an edge and scrolls the rest — the two
    // chats, each with a composer on the bottom, and the mailbox, whose rail,
    // list and message each hold their own place while one of them scrolls.
    expect(FILLS).toEqual(['ask', 'classmates', 'mail']);
    expect(fills('ask')).toBe(true);
    expect(fills('classmates')).toBe(true);
    expect(fills('mail')).toBe(true);
    expect(fills('today' as never)).toBe(false);
  });

  it('is drawn with the class the stylesheet is waiting for', () => {
    // The name has to match in two files that cannot import from each other.
    expect(src('../components/ScrollArea.tsx')).toContain("'scrollarea is-filled'");
    expect(css()).toContain('.scrollarea.is-filled');
  });

  it('and that class takes back the room reserved for a button it never draws', () => {
    const sheet = css();
    // The reservation is still there for every other screen — this test is
    // about the exception, not about removing the rule.
    expect(sheet).toContain('padding-bottom: var(--assistant-strip);');
    const rule = sheet.slice(sheet.indexOf('.scrollarea.is-filled'));
    const body = rule.slice(0, rule.indexOf('}'));
    expect(body).toContain('padding-bottom: 0');
    // And one scroller, not two nested inside each other.
    expect(body).toContain('overflow: hidden');
  });

  it('because the button really is not drawn there', () => {
    // The other half of the argument. If the assistant ever starts drawing
    // its button on these screens the reservation stops being dead space and
    // this whole exception is wrong.
    //
    // Asked of the list rather than of one screen's name: the button sits
    // over the composer of whichever chat is open, so the rule that keeps it
    // away has to be the same rule that took the padding back.
    expect(src('./Assistant.tsx')).toContain('!fills(state.screen)');
  });
});

describe('and it rides above the keyboard', () => {
  it('by subtracting a measured inset from the app, not from one screen', () => {
    // A composer pinned to the bottom edge is the one control an iOS keyboard
    // covers completely, and the tab bar under it has to move by the same
    // amount or the composer lands on top of it.
    const sheet = css();
    expect(sheet).toContain('height: calc(100% - var(--kb, 0px));');
    for (const rule of ['.device {', '.device-pane {', '.desk {']) {
      const at = sheet.indexOf(rule);
      expect(at, rule).toBeGreaterThan(-1);
      expect(sheet.slice(at, sheet.indexOf('}', at)), rule).toContain('var(--kb, 0px)');
    }
  });

  it('measured from the visual viewport, since nothing else knows', () => {
    // `100dvh` tracks the browser's own retracting toolbars and not the
    // keyboard, which is the mistake this replaced.
    const hook = src('../lib/keyboard.ts');
    expect(hook).toContain('window.visualViewport');
    expect(hook).toContain("setProperty('--kb'");
    // And only while something is focused: the same gap opens when mobile
    // Safari's toolbar retracts, and shrinking the app on every flick of a
    // list would be a worse bug than the one this fixes.
    expect(hook).toContain("addEventListener('focusin'");
    expect(hook).toContain("addEventListener('focusout'");
  });

  it('and the chat is the screen that asks for it', () => {
    expect(src('./Chat.tsx')).toContain('useKeyboardInset()');
  });
});

/**
 * What the floating button is asked about, and what it will not sit on.
 *
 * Two faults, one shape: the button measured what was under it by asking
 * about a single point, its centre, and it only re-measured when you scrolled
 * or the window resized. So a control that sat entirely inside one of its
 * corners was invisible to the measurement however completely it was covered,
 * and a screen that grew a control where the button was standing — a row in
 * Mine becoming its own editor on a press — was never re-measured at all.
 *
 * jsdom has no layout and no `elementsFromPoint`, so the running of this
 * cannot be a test. Three things can: which points get asked, that the
 * measurement is wired to mutations as well as to scrolling, and that the
 * destructive controls carry the marker the rule reads.
 */
describe('the assistant button, and what it sits on', () => {
  const assistant = () => src('./Assistant.tsx');
  /* A rect without a DOM: this file runs in node, where `DOMRect` does not
     exist, and `probes` reads the six numbers rather than the class. */
  const rect = (x: number, y: number, w: number, h: number) =>
    ({ left: x, top: y, right: x + w, bottom: y + h, width: w, height: h }) as DOMRect;

  it('asks about its corners as well as its centre', () => {
    const rest = rect(300, 700, 52, 52);
    const points = probes(rest);
    expect(points).toHaveLength(5);
    expect(points[0]).toEqual([326, 726]);
    // The four corners, inset so they land inside the button's own box.
    expect(points.slice(1)).toEqual([
      [301, 701],
      [351, 701],
      [301, 751],
      [351, 751],
    ]);
  });

  it('asks about where it would be once lifted, not where it is', () => {
    const rest = rect(300, 700, 52, 52);
    expect(probes(rest, 58).map(([, y]) => y)).toEqual([668, 643, 643, 693, 693]);
  });

  it('re-measures when the pane changes shape without a scroll', () => {
    const code = assistant();
    expect(code, 'a MutationObserver watches the scroll area').toContain('new MutationObserver(soon)');
    expect(code).toContain("watch.observe(area, { childList: true, subtree: true })");
    expect(code, 'and is disconnected with the rest').toContain('watch.disconnect()');
  });

  it('treats a destructive control as covered at any overlap', () => {
    expect(assistant()).toContain("node.hasAttribute('data-danger')");
  });

  it('is what the delete buttons in Mine are marked with', () => {
    const mine = src('../screens/Mine.tsx');
    // One per row editor — a task's and an appointment's.
    expect(mine.match(/data-danger=""/g) ?? []).toHaveLength(2);
    for (const label of ['`Delete ${t.title}`', '`Delete ${a.title}`']) {
      const at = mine.indexOf(label);
      expect(at, `${label} is still there`).toBeGreaterThan(-1);
      expect(mine.slice(at, at + 400), `${label} carries the marker`).toContain('data-danger');
    }
  });
});
