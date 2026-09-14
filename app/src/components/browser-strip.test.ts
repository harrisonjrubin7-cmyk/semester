import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { AA_TEXT, contrast } from '../lib/contrast';
import { GROUNDS, readLook, tokensFor } from '../lib/look';

/**
 * The browser navigation's chrome: that it can be clicked, and that it can be
 * seen.
 *
 * Both of these shipped broken and neither was visible to the suite, because
 * both are questions about a rendered page. `shell-overlap.test.tsx` mounts
 * this same shell in jsdom and passed throughout: jsdom has no layout, so
 * nothing there can tell that an element is under another one, and no
 * painting, so nothing there can tell that ink and ground are the same
 * colour. So they are held here on the source and on the palette, the way
 * `styles/stacking.test.ts` holds the workspace's stacking.
 *
 * What was wrong, in both cases, was a rule written for one structure meeting
 * another:
 *
 *   - On the home screen the shell mounts the whole app a second time, in
 *     `.g-home-legacy`, so that the legacy dialogs can be drawn over it. That
 *     layer is `pointer-events: none` with its dialogs turned back on by
 *     `.g-home-legacy .device>*`. In this layout `.device`'s first child is
 *     not a dialog — it is the frame the screen is drawn in, the size of the
 *     window — so the exception put an invisible sheet at z-index 50 over the
 *     entire shell and nothing on the home screen could be clicked at all.
 *
 *   - The strip on that screen is inverted, `--app-fg` as its ground, and its
 *     contents went on inheriting `--app-fg` as their ink. Everything on it
 *     that is not the active tab — the new-tab button, the bookmarks button,
 *     every inactive tab — was drawn at 1:1.
 */

const css = readFileSync('src/components/google-shell.css', 'utf8');
const app = readFileSync('src/App.tsx', 'utf8');

interface Rule {
  selector: string;
  body: string;
}

/**
 * The sheet's rules, comments dropped.
 *
 * `@media` wrappers are not rules and do not match: the pattern needs a
 * balanced pair with no brace between, so it steps over the wrapper and finds
 * the rules inside it, which are the ones being asked about.
 */
function rules(): Rule[] {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selector: m[1].trim(),
    body: m[2].trim(),
  }));
}

/** The one rule with this selector, which every assertion here needs to exist. */
function ruleFor(selector: string): Rule {
  const found = rules().filter((r) => r.selector === selector);
  expect(found, `\`${selector}\` is still a rule in google-shell.css`).toHaveLength(1);
  return found[0];
}

/** What a rule says a custom property or a colour resolves to, as its token. */
function token(rule: Rule, property: string): string {
  const said = new RegExp(`(?:^|;)\\s*${property}:\\s*var\\((--[\\w-]+)\\)`).exec(rule.body);
  expect(said, `\`${rule.selector}\` still sets \`${property}\` to a token`).not.toBeNull();
  return said![1];
}

/** `BrowserShell`'s source — the layout `.g-home-legacy` ends up holding. */
function browserShell(): string {
  const from = app.indexOf('function BrowserShell(');
  expect(from, 'the browser layout is still called `BrowserShell`').toBeGreaterThan(-1);
  const to = app.indexOf('\nfunction ', from + 1);
  return app.slice(from, to === -1 ? undefined : to);
}

describe('the home overlay', () => {
  /**
   * The class lists of the boxes between the layout's root and its scroller:
   * the body and the pane. These are the frame — they draw nothing of their
   * own on this screen, and each is the size of the window.
   */
  const frame = (() => {
    const src = browserShell();
    const body = src.slice(src.indexOf('deskwork-body'), src.indexOf('<ScrollArea'));
    expect(body, 'the browser layout still wraps its screen in the deskwork frame').not.toBe('');
    return [...`"${body}`.matchAll(/["']([\w- ]*deskwork-pane[\w- ]*|deskwork-body[\w- ]*)["']/g)].map(
      (m) => m[1].split(' ').filter(Boolean),
    );
  })();

  /** Every class the overlay explicitly takes the clicks away from. */
  const passesThrough = rules()
    .filter((r) => r.selector.includes('.g-home-legacy') && /pointer-events:\s*none/.test(r.body))
    .flatMap((r) => [...r.selector.matchAll(/\.([\w-]+)/g)].map((m) => m[1]));

  it('finds the frame boxes it has to name', () => {
    // Two of them, the body and the pane — if this ever reads 0 the rest of
    // this block is asserting nothing.
    expect(frame.length).toBeGreaterThanOrEqual(2);
  });

  for (const classes of frame) {
    it(`lets clicks through \`${classes.join(' ')}\``, () => {
      expect(
        classes.some((c) => passesThrough.includes(c)),
        `none of \`${classes.join(' ')}\` is given \`pointer-events: none\` inside .g-home-legacy, so the frame covers the shell`,
      ).toBe(true);
    });
  }

  it('keeps the clicks on what the overlay is there to draw', () => {
    // The dialogs, and the toasts the pane itself holds. Taking the frame out
    // of the way must not take these with it.
    for (const selector of ['.g-home-legacy [role=dialog]', '.g-home-legacy .deskwork-pane>*']) {
      expect(ruleFor(selector).body).toMatch(/pointer-events:\s*auto/);
    }
  });
});

describe('the strip on the home screen', () => {
  /* Read inside the tests rather than beside them: a missing declaration is
     one of the faults being tested for, and read out here it would throw
     while the file was being collected and take every other test in it down
     with it. */
  const strip = () => ruleFor('.g-home .g-browser-tabs');
  const ratioOn = (id: string, front: string, back: string) => {
    const tokens = tokensFor(readLook({ ground: id }));
    const said = contrast(tokens[front], tokens[back]);
    expect(said, `\`${front}\` on \`${back}\` is a pair of colours`).not.toBeNull();
    return said!;
  };

  /* Every ground, because the strip is inverted rather than dark: the pair is
     the ground's ink as a surface and its surface as ink, which holds on a
     light ground as well as a dark one, and this is what says so. */
  for (const { id, label } of GROUNDS) {
    it(`draws the strip's own controls legibly on ${label}`, () => {
      const rule = strip();
      expect(ratioOn(id, token(rule, 'color'), token(rule, 'background'))).toBeGreaterThanOrEqual(
        AA_TEXT,
      );
    });

    it(`draws the active tab legibly on ${label}`, () => {
      // It sits on the page rather than on the strip, so it is the one thing
      // up there that keeps the page's ink.
      const ink = token(ruleFor('.g-home .g-browser-tab.active'), 'color');
      expect(ratioOn(id, ink, token(ruleFor('.g-home'), '--g-page'))).toBeGreaterThanOrEqual(
        AA_TEXT,
      );
    });
  }
});
