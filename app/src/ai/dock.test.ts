import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fills, FILLS } from '../components/shell/exempt';
import { costOf, LIFT, probes, TRIES } from './Assistant';

/**
 * The chat ends at the bottom of the window.
 *
 * ## The bug this exists to make impossible again
 *
 * Every file was right on its own. `.scrollarea` reserves 76px under every
 * screen so nothing sits behind the assistant's floating button, which is
 * correct for every screen that has one. `ai/Assistant.tsx` does
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
    // about the exception, not about removing the rule. It is a box after the
    // content now rather than padding on the scroller, for the reason
    // `ai/clearance.test.ts` sets out, and the exception is a second rule
    // that takes the box back rather than a `:not()` in the first one.
    expect(sheet).toContain('height: var(--assistant-strip);');
    expect(sheet).toMatch(/\.scrollarea\.is-filled \.pane-body::after \{[^}]*content: none/s);
    const rule = sheet.slice(sheet.indexOf('.scrollarea.is-filled {'));
    const body = rule.slice(0, rule.indexOf('}'));
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

  /**
   * The climb into something worse, which is how `#/write/<id>` was found.
   *
   * The old rule answered yes or no, and `clearOf` walked upward until the
   * answer was no or it ran out of tries — then took the last position it had
   * tried. On the document editor every position was occupied: at rest the
   * button clipped 4% of the paragraph textarea, which counts at any overlap
   * at all, so it climbed; and two lifts up it came down on a 30x30 "Remove
   * this paragraph" and buried 76% of it, centre included. Three bad places,
   * and it chose the worst because it was the last.
   *
   * A yes/no answer cannot rank those. A number can, which is the whole of the
   * change, and these are the four facts the ranking rests on.
   */
  describe('what it costs to sit somewhere', () => {
    /* An element without a DOM. `costOf` asks only these four things, so a
       plain object answers all of them — see the note on `rect` above. */
    const control = (
      tag: string,
      box: DOMRect,
      attrs: { danger?: boolean; tabs?: boolean } = {},
    ) => {
      const el = {
        tagName: tag,
        getBoundingClientRect: () => box,
        hasAttribute: (n: string) => n === 'data-danger' && !!attrs.danger,
        closest: (sel: string) => (sel === '.app-tabs' ? (attrs.tabs ? el : null) : el),
        contains: () => false,
      };
      return el as unknown as Element;
    };
    const at = rect(300, 700, 52, 52);

    it('costs nothing to sit on something that is not a control', () => {
      const bare = { closest: () => null } as unknown as Element;
      expect(costOf(bare, null, at)).toBe(0);
      expect(costOf(null, null, at)).toBe(0);
    });

    it('costs nothing to sit on the tab bar, which it always does', () => {
      expect(costOf(control('BUTTON', rect(0, 700, 400, 52), { tabs: true }), null, at)).toBe(0);
    });

    it('costs a plain control the share of it that is hidden', () => {
      // A full-width row clipped at the corner: 52 of 400 wide, all 52 tall.
      const row = control('BUTTON', rect(0, 700, 400, 52));
      expect(costOf(row, null, at)).toBeCloseTo(52 / 400, 5);
      // Half of it, which is the threshold the rule has always used.
      expect(costOf(control('BUTTON', rect(300, 700, 104, 52)), null, at)).toBeCloseTo(0.5, 5);
    });

    /*
     * The two that count at any overlap — and the point of the floor is that
     * they still rank. Both of these trip the rule; the textarea clipped at
     * the corner is plainly the cheaper of the two places to stand, and before
     * this they were indistinguishable.
     */
    it('floors a form field and a destructive control, without flattening them', () => {
      const textarea = costOf(control('TEXTAREA', rect(0, 700, 340, 700)), null, at);
      const remove = costOf(control('BUTTON', rect(310, 700, 30, 30), { danger: true }), null, at);
      expect(textarea, 'a 1% clip of a big textarea still counts').toBeGreaterThan(0.5);
      expect(remove, 'a buried Delete counts for what it is').toBeGreaterThan(0.5);
      expect(textarea).toBeLessThan(remove);
    });

    /*
     * And two *fields* rank against each other, which is the half of "without
     * flattening them" the floor did not deliver.
     *
     * `Math.max(COVERED, share)` is the constant `COVERED` for every overlap
     * under half, so a field clipped at 1% and a field clipped at 49% both
     * scored exactly 0.5 — the yes/no answer this whole ranking exists to
     * replace, kept alive for the one kind of control that always trips it.
     *
     * The consequence is not theoretical and it is not small. On a screen
     * that is a column of full-width fields there is one under the button at
     * every offset, so all five candidate positions score 0.5, nothing is
     * strictly cheaper than anything, and the tie-break keeps the button
     * exactly where it started. Measured at 402px in the tab bar, a quarter
     * of the way down: `#/registrar`, `#/update` and `#/family` each scored
     * 0.5 · 0.5 · 0.5 · 0.5 · 0.5 and left the button on a text input covering
     * 23.7%, 9.6% and 8.7% of it. Graded, the same three screens lift 29, 116
     * and 58px onto 3.8%, 0.8% and 3.2%.
     */
    it('tells two form fields apart by how much of each is hidden', () => {
      /*
       * Both under half, which is the case the floor collapsed and the only
       * case that can tell the two rules apart. A first version of this test
       * used a 13% clip and an 87% burial, and passed against a faithful
       * revert: `Math.max` leaves anything over half alone, so the pair it
       * flattens is the pair where *neither* is over half. That is also the
       * pair a column of full-width fields actually produces.
       */
      const wide = costOf(control('INPUT', rect(0, 700, 400, 52)), null, at); // 13%
      const narrow = costOf(control('INPUT', rect(200, 700, 152, 52)), null, at); // 34%
      expect(wide, 'a clipped field still counts as occupied').toBeGreaterThanOrEqual(0.5);
      expect(narrow, 'and so does a more clipped one').toBeGreaterThanOrEqual(0.5);
      expect(wide, 'but the less covered one is the cheaper place to stand').toBeLessThan(narrow);
    });

    /*
     * And a field never loses to a card it is merely sharing a corner with,
     * which is what the floor was for and what the grading has to preserve.
     *
     * A plain control scores its raw share and so cannot reach `COVERED`
     * without really being half covered; a field starts at `COVERED`. The two
     * bands meet rather than overlap, which is the property that lets the
     * grading be a straight remap instead of a special case.
     *
     * This one is the control, and it is meant to pass against a revert as
     * well as against the fix — it pins what must *not* change. A suite where
     * every new test goes red on the revert is a suite that has only measured
     * the thing it was hoping to find; see CLAUDE.md on including one.
     */
    it('still puts any field above a card that is not really covered', () => {
      const field = costOf(control('INPUT', rect(0, 700, 4000, 52)), null, at);
      const card = costOf(control('BUTTON', rect(300, 700, 110, 52)), null, at);
      expect(card, 'the card is under half covered').toBeLessThan(0.5);
      expect(field, 'the field is barely clipped and still outranks it').toBeGreaterThan(card);
    });

    it('is worst-case when there is no box to measure, or no position to measure from', () => {
      expect(costOf(control('BUTTON', rect(0, 0, 0, 0)), null, at)).toBe(1);
      expect(costOf(control('BUTTON', rect(0, 700, 400, 52)), null, null)).toBe(1);
    });
  });

  it('keeps the cheapest place when no place is clear', () => {
    const code = assistant();
    // The search records the least-bad rather than returning the last try.
    expect(code, 'it remembers a best').toContain('let least = Infinity');
    expect(code, 'a clear position still wins outright').toContain('if (cost < COVERED) return lifted;');
    // Strictly cheaper, so a tie keeps the lower — the position already under
    // somebody's thumb.
    expect(code).toContain('if (cost < least) {');
    /*
     * And the cap is a position it has actually looked at. The old loop
     * incremented before returning, so an exhausted search returned
     * `tries * LIFT` — a third lift, one the probes had never been asked
     * about, and one the comment above it says is not allowed.
     */
    expect(code, 'every candidate is a multiple it examined').toContain('const lifted = i * STEP;');
    expect(code).not.toContain('lifted += LIFT;');
    /*
     * And the places it tries are half a lift apart, not a whole one. A 58px
     * step against `#/links`' 63px rows moved the button off one row's EDIT
     * and onto the next one's, three times over. The ceiling is unchanged:
     * five tries at half a lift is still exactly `2 * LIFT`.
     */
    expect(code).toContain('const STEP = LIFT / 2;');
    expect(code).toContain('const TRIES = 5;');
    expect((TRIES - 1) * (LIFT / 2), 'the ceiling is still two lifts').toBe(2 * LIFT);
  });

  it('re-measures when the pane changes shape without a scroll', () => {
    const code = assistant();
    expect(code, 'a MutationObserver watches the scroll area').toContain('new MutationObserver(soon)');
    expect(code).toContain("watch.observe(area, { childList: true, subtree: true })");
    expect(code, 'and is disconnected with the rest').toContain('watch.disconnect()');
  });

  it('stands down while a row is its own editor', () => {
    const code = assistant();
    expect(code, 'the flag is read from the document').toContain(
      "document.querySelector('[data-editing]')",
    );
    expect(code, 'and gates the button with the other two').toContain(
      '{!ai.open && !fills(state.screen) && !editing && (',
    );
    expect(code, 'and re-measures the layout it comes back to').toContain(
      '[ai.open, state.screen, state.mode, wide, lift, editing]',
    );
  });

  it('is what the row editors in Mine raise', () => {
    const mine = src('../screens/Mine.tsx');
    // One per row editor — a task's and an appointment's — on the frame that
    // replaces the row, so it is there exactly while the form is.
    expect(mine.match(/<Blueprint data-editing=""/g) ?? []).toHaveLength(2);
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
