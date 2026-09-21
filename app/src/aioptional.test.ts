/// <reference types="node" />
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The app has to work when the model does not.
 *
 * This is the one promise about the assistant that is worth more than the
 * assistant: a student opens Semester to see what is due, and a provider
 * outage, a revoked key, a rate limit or a country that cannot reach the API
 * must cost them the chat box and nothing else. `lib/privacy.ts` already tells
 * them so on a screen — everything but the assistant works on the device — and
 * `components/PushSwitch.tsx`'s whole shape is the same idea applied to push.
 *
 * It is true today. Nothing was keeping it true.
 *
 * ## Why a structural test rather than a runtime one
 *
 * A runtime test would mount a screen with the provider stubbed to fail and
 * assert it still draws. That proves one screen, on the one path the test
 * happened to take, with the failure shaped the way the test imagined it —
 * and it passes for a screen that imports the whole assistant and merely
 * catches well. This reads the imports instead, which is the property that
 * actually decides the answer, and reads all seventy-one screens rather than
 * the one somebody remembered to cover.
 *
 * It is the `src/rootunmount.test.ts` and `src/isolation.test.ts` shape: a
 * grep that cannot be fooled by a race that did not fire, a mock that was too
 * kind, or a probe with a bug in it.
 *
 * ## What it does not claim
 *
 * That the assistant is unreachable from a screen — it is, and should be.
 * `components/DeadlineRow.tsx` draws an Ask button and `components/Command.tsx`
 * reads whether the panel is open. Those are affordances that *open* the
 * assistant, and none of them is a model call. The line this draws is between
 * a screen that offers the assistant and a screen that needs it, and the
 * import graph is where that line is visible: a screen with no path to
 * `ai/` cannot be broken by one.
 *
 * `ai/Panel.tsx` holds the request, and `ai/Assistant.tsx` reaches it through
 * a dynamic `import('./Panel')` — deliberately not `lazy()`, for the speed
 * reason its own comment gives. Either way the module that talks to a provider
 * is not in the first parse, which is the second half of the same promise and
 * is asserted below.
 */

const ROOT = new URL('..', import.meta.url).pathname;

/** Every source file under a directory, tests excluded. */
function sources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const at = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...sources(at));
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(at);
  }
  return out;
}

/** A static `import … from '…/ai/…'`, which is the kind that cannot be deferred. */
const IMPORTS_AI = /^\s*import\s[^;]*?from\s+'(?:\.\.\/)+ai\/[^']*'/m;

describe('the app does not need the model', () => {
  it('has no screen that statically imports the assistant', () => {
    const guilty = sources('src/screens').filter((f) =>
      IMPORTS_AI.test(readFileSync(join(ROOT, f), 'utf8')),
    );

    /*
     * The message is the point. A future session adding `import { useAsk }
     * from '../ai/store'` to a screen will not have read this file, so the
     * failure has to explain itself where it appears.
     */
    expect(
      guilty,
      'A screen may offer the assistant, but must not be built out of it — see this file. ' +
        'Put the affordance in a component under src/components, the way DeadlineRow does.',
    ).toEqual([]);
  });

  it('keeps the module that calls a provider out of the first parse', () => {
    const shell = readFileSync(join(ROOT, 'src/ai/Assistant.tsx'), 'utf8');
    // Reached by `import('./Panel')`, never by a top-level import of it.
    expect(shell).toMatch(/import\('\.\/Panel'\)/);
    expect(shell).not.toMatch(/^\s*import\s[^;]*?from\s+'\.\/Panel'/m);
  });

  /*
   * The control.
   *
   * Both assertions above are satisfied by a repository with no screens in it
   * and by a regex that matches nothing — the two ways this file could pass
   * while testing nothing at all. So: the sweep must find the screens, and the
   * pattern must be able to convict.
   */
  it('is actually looking at the screens, and can actually fail', () => {
    const files = sources('src/screens');
    expect(files.length).toBeGreaterThan(50);
    expect(files).toContain('src/screens/Today.tsx');

    expect(IMPORTS_AI.test("import { useAsk } from '../ai/store';")).toBe(true);
    expect(IMPORTS_AI.test("import { useAsk } from '../../ai/store';")).toBe(true);
    expect(IMPORTS_AI.test("import { Page } from '../components/Page';")).toBe(false);
  });
});
