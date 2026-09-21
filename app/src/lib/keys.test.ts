// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { SHORTCUTS, keyLabel, shortcutFor, typing, underModal } from './keys';

const field = (tag: string) => document.createElement(tag);

/*
 * The dialog the test below puts up does not belong to the test after it.
 *
 * `shortcutFor` stands every shortcut down while a modal is open, and the
 * describe that checks this leaves one in the body. The tests that follow call
 * `shortcutFor` against the real `document`, so under `--sequence.shuffle`
 * they asked what `t` means with a dialog still up, were correctly told
 * nothing, and failed. Clearing it is what makes each test start on an app
 * with nothing over it.
 */
afterEach(() => {
  document.body.innerHTML = '';
});

describe('where a keystroke is a character, not a command', () => {
  it('knows the fields a person types in', () => {
    expect(typing(field('input'))).toBe(true);
    expect(typing(field('textarea'))).toBe(true);
    expect(typing(field('select'))).toBe(true);
    expect(typing(field('div'))).toBe(false);
    expect(typing(null)).toBe(false);
  });

  it('counts an editable div, which is not an input and is still typing', () => {
    const div = field('div');
    div.contentEditable = 'true';
    // jsdom does not compute isContentEditable from the attribute.
    Object.defineProperty(div, 'isContentEditable', { value: true });
    expect(typing(div)).toBe(true);
  });
});

/*
 * A dialog that says the rest of the page is not there.
 *
 * `Keys` listens on the window, so every one of these fired straight through
 * an open overlay: with the app launcher up on a laptop, `/` opened the search
 * palette behind it and `t` walked to Today underneath, and whichever you
 * closed first you were somewhere you had not asked to be. The overlays that
 * hold a field were safe by accident — `typing()` catches their focused input
 * — and the ones made of buttons, which is most of them, were not.
 */
describe('under a modal dialog', () => {
  const open = (modal: boolean) => {
    document.body.innerHTML = modal
      ? '<div role="dialog" aria-modal="true"><button>Close</button></div>'
      : '<div role="dialog" aria-modal="false"><button>Close</button></div>';
    return document;
  };

  it('sees one that is up, and ignores one that is not', () => {
    expect(underModal(open(true))).toBe(true);
    expect(underModal(open(false))).toBe(false);
    document.body.innerHTML = '';
    expect(underModal(document)).toBe(false);
  });

  it('stands every shortcut down while it is up', () => {
    const doc = open(true);
    for (const s of SHORTCUTS) {
      expect(shortcutFor({ key: s.key }, doc), s.key).toBeNull();
    }
  });

  /**
   * The alarm, which is an `alertdialog` and was the one this missed.
   *
   * Every case above builds `role="dialog"`, so none of them could see the
   * fault: `underModal` selected `[role="dialog"][aria-modal="true"]`, and
   * `components/Ringing.tsx` — a timer or an alarm going off, covering the
   * app at `inset: 0` — is `role="alertdialog"`, which is the correct role
   * for it. Measured before the fix: with one up, `shortcutFor({ key: 'c' })`
   * returned `{ does: 'Courses' }`, so a key pressed while an alarm was going
   * off walked the app to another screen behind it.
   *
   * It is the worst overlay to have got wrong. `Ringing` has no `onClose` on
   * purpose — *an alarm that a stray Escape silences is an alarm that did not
   * go off* — so it is the one thing on screen a student cannot simply
   * dismiss, and every shortcut went straight through it.
   *
   * `a11y/modal.ts` held the right selector in a `hasOpenModal` that nothing
   * called; the twenty-fourth simplify pass moved it here and cut that.
   */
  const ringing = () => {
    document.body.innerHTML =
      '<div role="alertdialog" aria-modal="true"><button>Stop</button></div>';
    return document;
  };

  it('stands down for an alertdialog too, not only a dialog', () => {
    expect(underModal(ringing())).toBe(true);
    for (const s of SHORTCUTS) {
      expect(shortcutFor({ key: s.key }, ringing()), s.key).toBeNull();
    }
  });

  it('still lets the shortcut sheet be closed, which carries aria-modal false', () => {
    // The control. Widening the selector to the bare attribute must not catch
    // `aria-modal="false"` — `components/Keys.tsx` renders its own sheet with
    // that, and `?` has to keep toggling it.
    document.body.innerHTML = '<div role="dialog" aria-modal="false"></div>';
    expect(underModal(document)).toBe(false);
    expect(shortcutFor({ key: '?' }, document)).not.toBeNull();
  });

  it('hands them back the moment it closes', () => {
    const doc = open(false);
    expect(shortcutFor({ key: 't' }, doc)?.screen).toBe('home');
    expect(shortcutFor({ key: '/' }, doc)?.action).toBe('search');
  });
});

describe('what a keystroke means', () => {
  it('opens a screen', () => {
    expect(shortcutFor({ key: 't' })?.screen).toBe('home');
    expect(shortcutFor({ key: 'K' })?.screen).toBe('calendar');
  });

  it('means nothing while the caret is in a field', () => {
    // `n` is a letter in "Econ". Firing a navigation from it mid-word would
    // lose the sentence and the trust at the same time.
    expect(shortcutFor({ key: 'n', target: field('input') })).toBeNull();
    expect(shortcutFor({ key: '/', target: field('textarea') })).toBeNull();
  });

  it('lets Escape out of a field, because that is what Escape is for', () => {
    expect(shortcutFor({ key: 'Escape', target: field('input') })?.action).toBe('back');
  });

  it('leaves every modifier combination to the browser', () => {
    // ⌘L is the address bar in every window the student has open. An app that
    // takes it is an app they find a way to avoid.
    expect(shortcutFor({ key: 't', metaKey: true })).toBeNull();
    expect(shortcutFor({ key: 't', ctrlKey: true })).toBeNull();
    expect(shortcutFor({ key: 't', altKey: true })).toBeNull();
  });

  it('is nothing for a key that is not bound', () => {
    expect(shortcutFor({ key: 'z' })).toBeNull();
    expect(shortcutFor({ key: 'F5' })).toBeNull();
  });
});

describe('the list itself', () => {
  it('binds no key twice', () => {
    const keys = SHORTCUTS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('gives every shortcut something to do and something to say', () => {
    for (const s of SHORTCUTS) {
      expect(s.does).toBeTruthy();
      expect(Boolean(s.screen) || Boolean(s.action)).toBe(true);
    }
  });

  it('stays short enough to learn', () => {
    // A list of thirty shortcuts is a list nobody learns.
    expect(SHORTCUTS.length).toBeLessThanOrEqual(12);
  });
});

describe('how a key is drawn', () => {
  it('names the ones with no glyph', () => {
    expect(keyLabel('escape')).toBe('Esc');
    expect(keyLabel(' ')).toBe('Space');
  });

  it('shows a letter as a capital', () => {
    expect(keyLabel('t')).toBe('T');
    expect(keyLabel('/')).toBe('/');
  });
});
