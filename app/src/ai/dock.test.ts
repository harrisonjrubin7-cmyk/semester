import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fills, FILLS } from '../components/shell/exempt';

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

describe('the screen that fills its box', () => {
  it('is the chat, and the chat only', () => {
    // Not a list anyone should grow casually. A screen belongs here when its
    // own body pins something to the bottom edge and scrolls the rest — which
    // is a chat, and so far nothing else in the app.
    expect(FILLS).toEqual(['ask']);
    expect(fills('ask')).toBe(true);
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
    // its button on this screen the reservation stops being dead space and
    // this whole exception is wrong.
    expect(src('./Assistant.tsx')).toContain("state.screen !== 'ask'");
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
