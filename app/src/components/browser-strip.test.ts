import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { AA_TEXT, contrast } from '../lib/contrast';
import { GROUNDS, readLook, tokensFor } from '../lib/look';

/**
 * The browser navigation's tab strip, and whether it can be seen.
 *
 * On the home screen that strip is inverted — `--app-fg` as its ground, the
 * same trade the omnibox beside it makes — and its contents went on
 * inheriting `--app-fg` as their ink. Everything up there that is not the
 * active tab was drawn at 1:1: the new-tab button, the bookmarks button, and
 * every inactive tab, on a blank white band. With several tabs open only the
 * active one could be seen at all, which read as the strip having lost them.
 *
 * Nothing in the suite could tell. `shell-overlap.test.tsx` mounts this same
 * shell in jsdom and passed throughout, because jsdom does no painting and
 * two colours are the same to it whatever they are. So it is held here on
 * the palette instead, the way `styles/stacking.test.ts` holds the same
 * shell's stacking on the source — the sheet says which tokens the strip
 * wears, `lib/look.ts` says what those tokens are on each ground, and a
 * contrast ratio is a division.
 *
 * Every ground rather than the one in front of somebody, because the pair is
 * inverted rather than dark: the ground's ink as a surface, its surface as
 * ink. That holds on Parchment as well as on Ink, and this is what says so.
 */

const css = readFileSync('src/components/google-shell.css', 'utf8');

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

/** What a rule sets a property to, as the token it names. */
function token(rule: Rule, property: string): string {
  const said = new RegExp(`(?:^|;)\\s*${property}:\\s*var\\((--[\\w-]+)\\)`).exec(rule.body);
  expect(said, `\`${rule.selector}\` still sets \`${property}\` to a token`).not.toBeNull();
  return said![1];
}

describe('the strip on the home screen', () => {
  /* Read inside the tests rather than beside them: a missing declaration is
     one of the faults being tested for, and read out here it would throw
     while the file was being collected and take every other test in it down
     with it. */
  const ratioOn = (id: string, front: string, back: string) => {
    const tokens = tokensFor(readLook({ ground: id }));
    const said = contrast(tokens[front], tokens[back]);
    expect(said, `\`${front}\` on \`${back}\` is a pair of colours`).not.toBeNull();
    return said!;
  };

  for (const { id, label } of GROUNDS) {
    it(`draws the strip's own controls legibly on ${label}`, () => {
      const strip = ruleFor('.g-home .g-browser-tabs');
      expect(ratioOn(id, token(strip, 'color'), token(strip, 'background'))).toBeGreaterThanOrEqual(
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
