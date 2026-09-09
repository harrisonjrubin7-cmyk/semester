import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A `.bare` box cannot be pinned to both edges without saying `width: auto`.
 *
 * `.bare` is the app's unstyled button — no border, no padding, `font:
 * inherit`, and `width: 100%`, because almost every one of them is a row.
 * That last one is a trap for the few that are not. An absolutely positioned
 * element with `left`, `right` *and* `width` all set is over-constrained, and
 * CSS resolves it by dropping one edge — so a four-value `inset` written on a
 * `.bare` button is not the box that was asked for, silently.
 *
 * It shipped twice. `.rail-item` carries a note in `app.css` about the same
 * thing. The second was the slide deck's two step regions, meant to be the
 * left third and the right two thirds of the card: measured on the running app
 * at 390×844 both were the full 352px of the card, "Previous slide" covered
 * the whole slide, and "Next slide" started at 34% and ran 119px past the
 * card's right edge — the only horizontal overflow anywhere in the app, at any
 * width, and the reason the last slide's "Drill it now" could not be pressed.
 *
 * Nothing about that is visible in a screenshot, nothing throws, and jsdom has
 * no layout to measure it with. So the rule is held on the source: a `.bare`
 * element with an `inset` naming more than one edge must set `width` too.
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
 * Every JSX opening tag in a file, whole.
 *
 * Not a regex to the next `>`: an arrow function in a prop — `onClick={() =>
 * step(-1)}` — ends that match three attributes early, which is exactly the
 * region this test needs to read. So the scan tracks brace depth and quoting
 * and stops at the `>` that closes the tag rather than the first one it meets.
 */
function tags(src: string): string[] {
  const out: string[] = [];
  for (const start of [...src.matchAll(/<[a-zA-Z]/g)].map((m) => m.index)) {
    let depth = 0;
    let quote = '';
    for (let i = start + 1; i < src.length; i++) {
      const c = src[i];
      if (quote) {
        if (c === quote && src[i - 1] !== '\\') quote = '';
        continue;
      }
      if (c === '"' || c === "'" || c === '`') quote = c;
      else if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) {
        out.push(src.slice(start, i + 1));
        break;
      }
    }
  }
  return out;
}

describe('a bare button pinned to two edges', () => {
  const files = tsx('src');

  it('reads the tree it is meant to be reading', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('never leaves `.bare` over-constrained by a multi-edge inset', () => {
    const wrong: string[] = [];
    for (const file of files) {
      for (const el of tags(readFileSync(file, 'utf8'))) {
        if (!/className="[^"]*\bbare\b/.test(el)) continue;
        const inset = /inset:\s*'([^']*)'/.exec(el);
        // A single value (`inset: 0`, `inset: '0'`) sets all four to the same
        // thing and is not a request the width can contradict.
        if (!inset || inset[1].trim().split(/\s+/).length < 2) continue;
        if (!/\bwidth:/.test(el)) wrong.push(`${file}: inset '${inset[1]}' with no width`);
      }
    }
    expect(wrong, wrong.join('\n')).toEqual([]);
  });

  it('still finds the slide deck’s two, so the rule is checking something', () => {
    const slides = readFileSync('src/screens/Slides.tsx', 'utf8');
    const pinned = tags(slides).filter(
      (el) => /className="bare"/.test(el) && /inset: '0 /.test(el),
    );
    expect(pinned.length, 'the step regions have moved; point this test at them').toBe(2);
    for (const el of pinned) expect(el).toContain("width: 'auto'");
  });
});

/**
 * And the one control a slide holds is above the regions that cover it.
 *
 * The two step regions are drawn after the slide's content and cover the whole
 * card, which is the point — anywhere on a slide steps it. The end slide has a
 * button, and being later in the document is what decides a click, so the last
 * thing a deck asks you to do stepped you backwards instead. It was in the
 * document, named, enabled and painted; only the tap went elsewhere.
 */
describe('the end slide’s one button', () => {
  it('stands above the step regions', () => {
    const src = readFileSync('src/screens/Slides.tsx', 'utf8');
    const cta = /<button[^<]*?startDrill[\s\S]*?<\/button>/.exec(src);
    expect(cta, 'the drill button has moved; point this test at it').not.toBeNull();
    expect(cta?.[0]).toMatch(/position: 'relative'/);
    expect(cta?.[0]).toMatch(/zIndex: 1/);
  });
});
