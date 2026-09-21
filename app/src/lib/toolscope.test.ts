import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { APP_TOOLS, toolsFor } from './toolscope';
import { TOOLS } from './tools';
import { LOOKUPS } from './lookup';
import { readMode } from './mode';

/**
 * Least privilege for the assistant's modes — platform §309.
 *
 * `ai/converse.ts` already withheld `LOOKUPS` from app mode, with a comment
 * saying why: app mode "answers from the guidebook and nothing else — that
 * narrowness is what stops it inventing a feature". The writes were never
 * withheld, so the mode built to be the narrow one carried every write tool
 * in the app.
 *
 * ## What these tests are careful about
 *
 * "App mode gets fewer tools" would pass against a `toolsFor` that returned
 * an empty array, and that version would break app mode entirely — it could
 * no longer take anybody to the screen they asked about. So the controls are
 * the interesting half: the other two modes must keep everything, and app
 * mode must keep exactly the tools that are its whole job.
 */

describe('what each mode may propose', () => {
  it('leaves grounded and general untouched', () => {
    const all = [...TOOLS, ...LOOKUPS];
    expect(toolsFor('grounded', all)).toEqual(all);
    expect(toolsFor('general', all)).toEqual(all);
  });

  it('narrows app mode to the tools that operate the app', () => {
    expect(toolsFor('app', TOOLS).map((t) => t.name).sort()).toEqual([...APP_TOOLS].sort());
  });

  /*
   * The control, and the reason this is a filter rather than a deletion. App
   * mode's entire job is answering "where is this setting" — a mode that
   * cannot then open the screen is worse than the one this replaces.
   */
  it('keeps app mode able to do its own job', () => {
    const names = toolsFor('app', TOOLS).map((t) => t.name);
    expect(names, 'app mode must still be able to take you there').toContain('open_screen');
    expect(names.length).toBeGreaterThan(0);
  });

  /*
   * The second control. Naming the excluded tools individually would rot the
   * moment a tool is added — and silently, in the widening direction. This
   * asserts the shape instead: everything that is not an app tool is gone,
   * so a new write tool is excluded by default and has to be added to
   * `APP_TOOLS` on purpose.
   */
  it('excludes every tool that writes into a semester, including ones added later', () => {
    const got = toolsFor('app', TOOLS).map((t) => t.name);
    for (const t of TOOLS) {
      if (APP_TOOLS.includes(t.name)) continue;
      expect(got, `${t.name} writes into a semester and is not app furniture`).not.toContain(t.name);
    }
    expect(got.length).toBeLessThan(TOOLS.length);
  });

  it('names only tools that exist', () => {
    const real = new Set([...TOOLS, ...LOOKUPS].map((t) => t.name));
    for (const name of APP_TOOLS) expect(real, name).toContain(name);
  });
});

describe('the questions this actually changes', () => {
  /*
   * Read through the real router rather than asserted by hand, so this fails
   * if `lib/mode.ts` stops sending these where the test assumes.
   */
  it('narrows a question about a setting', () => {
    const read = readMode('where do I change my grade scale');
    expect(read.mode).toBe('app');
    expect(toolsFor(read.mode, TOOLS).map((t) => t.name)).not.toContain('make_sheet');
  });

  it('leaves a question about the student alone', () => {
    const read = readMode('what do I have due tomorrow');
    expect(read.mode).toBe('grounded');
    expect(toolsFor(read.mode, TOOLS).length).toBe(TOOLS.length);
  });
});

describe('the caller', () => {
  /*
   * A module nothing imports is a decision nobody is subject to. This is the
   * whole reason the filter is worth having, so it is asserted rather than
   * assumed — the same check `a11y/motion.test.ts` makes about its helpers.
   */
  it('is used by the one place that sends tools to the model', () => {
    const src = readFileSync(join(process.cwd(), 'src', 'ai', 'converse.ts'), 'utf8');
    expect(src).toContain('toolsFor(');
  });
});
