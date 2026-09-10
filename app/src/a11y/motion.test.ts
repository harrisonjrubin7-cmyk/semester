// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { prefersLessMotion, revealKindly, scrollKindly } from '../lib/prefers';

/**
 * The reduced-motion setting reaches the scrolls the app performs itself.
 *
 * `app.css` has flattened every CSS animation and transition for a long time,
 * which reads as complete and is half the job. `scrollTo({ behavior:
 * 'smooth' })` is a script asking for motion rather than a style declaring it,
 * and no media query applies to it — so five places went on sweeping the page
 * its whole length for somebody who had asked the operating system, in as many
 * words, not to be moved like that.
 *
 * That is the case the setting is for. Reduced motion is not a preference
 * about taste: large sweeping movement is what provokes nausea and vertigo in
 * vestibular disorders, and a page travelling from its bottom to its top under
 * its own power is the largest movement this app makes.
 */
function match(reduce: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('prefers-reduced-motion') ? reduce : false,
    media: q,
    addEventListener() {},
    removeEventListener() {},
  }));
}

describe('when the device asks for less motion', () => {
  it('reads the setting', () => {
    match(true);
    expect(prefersLessMotion()).toBe(true);
    match(false);
    expect(prefersLessMotion()).toBe(false);
  });

  it('jumps instead of gliding', () => {
    match(true);
    const el = { scrollTo: vi.fn(), scrollIntoView: vi.fn() };
    scrollKindly(el as unknown as Element, { top: 0 });
    revealKindly(el as unknown as Element, { block: 'start' });
    expect(el.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
    expect(el.scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'auto' });
  });

  it('glides when it does not', () => {
    match(false);
    const el = { scrollTo: vi.fn(), scrollIntoView: vi.fn() };
    scrollKindly(el as unknown as Element, { top: 40 });
    revealKindly(el as unknown as Element, { block: 'center' });
    expect(el.scrollTo).toHaveBeenCalledWith({ top: 40, behavior: 'smooth' });
    expect(el.scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' });
  });

  it('does not fall over on a missing element or a browser with no matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(() => scrollKindly(null, { top: 0 })).not.toThrow();
    expect(() => revealKindly(undefined)).not.toThrow();
  });

  it('reduces when it cannot ask, which is the direction the cost is uneven in', () => {
    /*
     * This assertion used to read `toBe(false)`, tucked inside the test above
     * as an incidental of not throwing — and it pinned the answer the opposite
     * way round from the one `lib/prefers.ts` argues for two paragraphs above
     * the function: "answering 'yes, reduce' wherever `matchMedia` cannot be
     * asked … The wrong answer in that direction is a jump instead of a glide;
     * in the other it is a symptom."
     *
     * The cost is not symmetric, which is the whole reason the file states a
     * direction rather than picking whichever is tidier. Asserted on its own
     * now, so it is a decision rather than a side effect of a robustness test.
     */
    vi.stubGlobal('matchMedia', undefined);
    expect(prefersLessMotion()).toBe(true);

    // And the same for a browser that has `matchMedia` and throws on the query.
    vi.stubGlobal('matchMedia', () => {
      throw new Error('unsupported query');
    });
    expect(prefersLessMotion()).toBe(true);

    const el = { scrollTo: vi.fn(), scrollIntoView: vi.fn() };
    scrollKindly(el as unknown as Element, { top: 0 });
    expect(el.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
  });
});

/**
 * And nowhere asks for a smooth scroll behind the helpers' back.
 *
 * The same shape as the `aria-modal` rule next door: the failure is silent —
 * a raw `behavior: 'smooth'` looks correct, reads correctly, and is wrong only
 * for the people who cannot see the tests pass.
 */
function sources(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (/\.tsx?$/.test(e) && !/\.test\./.test(e)) out.push(p);
  }
  return out;
}

describe('every scroll the app performs', () => {
  const files = sources('src')
    .filter((f) => !f.endsWith('lib/prefers.ts'))
    .map((f) => ({ file: f, src: readFileSync(f, 'utf8') }));

  it('goes through the helpers rather than naming a behaviour itself', () => {
    const raw = files.filter(({ src }) => /behaviou?r:\s*'smooth'/.test(src)).map(({ file }) => file);
    expect(raw, 'use scrollKindly or revealKindly from lib/prefers').toEqual([]);
  });

  it('still has scrolls to check', () => {
    // Guards the rule above: were the helpers renamed, an empty app would
    // pass it without a single scroll being kind to anybody.
    const users = files.filter(({ src }) => /scrollKindly|revealKindly/.test(src));
    expect(users.length).toBeGreaterThanOrEqual(4);
  });

  it('leaves the CSS half in place, which covers everything else', () => {
    const css = readFileSync('src/styles/app.css', 'utf8');
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    expect(css, 'the blanket rule over animations and transitions').toMatch(
      /animation-duration:\s*0\.001ms\s*!important/,
    );
  });
});
