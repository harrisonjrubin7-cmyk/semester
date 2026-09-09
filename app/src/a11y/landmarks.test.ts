import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * One main, one h1, and a navigation you can jump to.
 *
 * Landmarks are how somebody using a screen reader moves around a page
 * without reading it — "go to the navigation", "go to the main content" — and
 * this app was mostly good at them: a real `<header>`, `<main>` in
 * `ScrollArea`, the screen's name as the `<h1>`, `SectionLabel` as an `<h2>`.
 *
 * Three places did not hold, and all three are the same mistake: a part
 * written as though it were the whole page, mounted inside a shell that
 * already provides what it was providing for itself.
 */
function tsx(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) tsx(p, out);
    else if (/\.tsx$/.test(e) && !/\.test\./.test(e)) out.push(p);
  }
  return out;
}

/**
 * The file with its comments taken out.
 *
 * Every rule below asks "does this file render an `<h1>`", and this codebase
 * writes at length about the markup it renders — the first draft of this test
 * failed on four files, every one of them a paragraph *explaining* a landmark
 * rather than opening one, including the paragraphs directly above the fixes.
 * A rule that cannot tell code from prose about code would have to be watered
 * down until it caught nothing.
 */
function code(src: string): string {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/([^:])\/\/.*$/gm, '$1');
}

const FILES = tsx('src').map((f) => ({ file: f, src: code(readFileSync(f, 'utf8')) }));
const find = (end: string) => FILES.find(({ file }) => file.endsWith(end))!;

/**
 * The app draws exactly one navigation, whichever of the four is chosen —
 * `lib/chrome.ts` is the rule and `chrome.test.ts` proves it. Two of the four
 * were not landmarks, so "one navigation" was true on screen and false to a
 * reader: choosing the home screen left the app with no `<nav>` anywhere.
 */
describe('every navigation is a landmark', () => {
  it('marks the bar, the rail, the shelves and the home screen', () => {
    expect(find('App.tsx').src, 'the tab bar').toContain('<nav ref={bar}');
    expect(find('App.tsx').src, 'the rail').toContain('<nav className="rail"');
    // `[ "]` rather than a closing quote: the assertion is that the shelves
    // are a `<nav>` carrying their own class, not that the class is alone on
    // the element. It already is not — `pane-strip` joined it, which is what
    // puts the pills on the content column at desktop widths — and a landmark
    // test that fails when a second class arrives is a test people edit
    // without reading rather than one that catches a lost landmark.
    expect(find('nav/ShelfNav.tsx').src, 'the shelves').toMatch(/<nav className="shelf-nav[ "]/);
    // The whole screen: a field that searches screens, the icons, and the
    // dock its own comment calls "this layout's own navigation".
    expect(find('Springboard.tsx').src, 'the home screen').toMatch(/<nav\s+aria-label="Sections"/);
  });

  it('names them, since a landmark with no name is one of several "navigation"s', () => {
    for (const [file, src] of [
      ['App.tsx', find('App.tsx').src],
      ['ShelfNav.tsx', find('nav/ShelfNav.tsx').src],
      ['Springboard.tsx', find('Springboard.tsx').src],
    ] as const) {
      for (const nav of src.match(/<nav[^>]*>/g) ?? []) {
        expect(nav.includes('aria-label') || nav.includes('ref={bar}'), `${file}: ${nav}`).toBe(true);
      }
    }
  });
});

/**
 * `<main>` may not descend from `<main>`. Every settings sub-page did:
 * `ScrollArea` wraps each screen in `<main id="main">`, and the settings page
 * opened a second one inside it — invalid, and two main landmarks on the eight
 * screens that have them.
 */
describe('there is one main', () => {
  it('is the one in ScrollArea', () => {
    expect(find('ScrollArea.tsx').src).toContain('<main id="main"');
  });

  it('is not opened again by a screen mounted inside it', () => {
    const nested = FILES.filter(({ file, src }) => {
      if (file.endsWith('ScrollArea.tsx')) return false;
      // Onboarding is the exception, and a real one: it is the whole page
      // while it is up, and `ScrollArea` is not mounted at all behind it.
      if (file.endsWith('Onboarding.tsx')) return false;
      return /<main[\s>]/.test(src);
    });
    expect(nested.map(({ file }) => file), 'a <main> inside the app shell').toEqual([]);
  });
});

/**
 * And one `<h1>`: the screen's name, in the header, which `Header` focuses on
 * every navigation. The settings pages printed a second one — "About" over
 * "About", "Colour" over "Colour and type" — and made it a second focus
 * target, so two effects raced to say where you were.
 */
describe('there is one h1', () => {
  it('is the header’s', () => {
    expect(find('App.tsx').src, 'the screen’s name is the page’s h1').toMatch(/<h1/);
  });

  it('is not printed again by a screen inside the shell', () => {
    const extra = FILES.filter(({ file, src }) => {
      if (file.endsWith('App.tsx')) return false;
      // Same exception, for the same reason.
      if (file.endsWith('Onboarding.tsx')) return false;
      return /<h1[\s>]/.test(src);
    });
    expect(extra.map(({ file }) => file), 'a second h1 under the header’s').toEqual([]);
  });

  it('is the only thing focus is moved to on arrival', () => {
    // Two `tabIndex={-1}` headings both focused on mount is a race, and it ran
    // on every settings page.
    const page = find('settings/Page.tsx').src;
    expect(page, 'the shell moves focus; this page should not').not.toMatch(/heading\.current\?\.focus\(\)/);
    expect(page, 'and so needs no landing point of its own').not.toMatch(/tabIndex=\{-1\}/);
  });
});
