/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The button is cheap and the panel is not, and that has to stay true.
 *
 * `App.tsx` mounts `<Assistant />` in all three shells, so whatever that file
 * imports, every student downloads and parses before the app's first render.
 * It used to import the whole conversation — twenty modules and 7,287 lines on
 * the eager import graph — to draw a button with a glyph in it.
 *
 * Splitting it is invisible from inside either file: both compile, both work,
 * and re-importing `converse.ts` into the button half to reach one value would
 * put all of it back with nothing failing. So the split is asserted here
 * rather than left to whoever is next.
 */

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

/**
 * The same file with its comments taken out.
 *
 * For the negative assertions only, and `ai/live.test.ts` learned this the
 * same way: this codebase explains at length what a file used to do, so a test
 * that cannot tell the explanation from the thing being explained fails on its
 * own documentation. Both of the two below did, on the paragraph saying why
 * `lazy()` is not used here.
 */
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

describe('the assistant is a cheap half and an expensive half', () => {
  it('keeps the conversation out of the half that is always mounted', () => {
    const button = read('./Assistant.tsx');
    for (const heavy of [
      "from './converse'",
      "from './Turns'",
      "from './Composer'",
      "from './Actions'",
      "from './Opening'",
      "from '../lib/claude'",
      "from '../lib/tools'",
      "from '../lib/spend'",
      "from '../lib/threads'",
    ]) {
      expect(button, `Assistant.tsx should not import ${heavy}`).not.toContain(heavy);
    }
  });

  it('and reaches the panel through an import() rather than a static one', () => {
    const button = read('./Assistant.tsx');
    expect(button).toContain("import('./Panel')");
    expect(button).not.toMatch(/^import .*from '\.\/Panel'/m);
  });

  it('fetches the panel before it is wanted, so a tap waits for nothing', () => {
    // Off the critical path is not the same as late. The panel is fetched when
    // the browser is idle, long before anybody reaches for it.
    const button = read('./Assistant.tsx');
    expect(button).toContain('requestIdleCallback');
  });

  /*
   * The one that is a measurement rather than a rule.
   *
   * The first version of this split used `lazy()` and a `Suspense` with a null
   * fallback, which is the obvious shape and made opening the panel twenty
   * times slower: tap to panel-in-the-DOM went from 14–28ms to a flat 314ms on
   * the production build, with the chunk already fetched and in memory.
   *
   * The flatness is the clue — that is a delay, not work. `lazy` calls its
   * factory only at the first render that needs it, so even an already-loaded
   * module suspends for a tick; the fallback is committed; and React then
   * throttles un-showing a fallback it has just shown, so a flash of spinner
   * cannot be briefer than the eye can follow. The rule is right. Not
   * suspending at all is the way not to pay it.
   *
   * Written as a test because the `lazy()` version looks more idiomatic, reads
   * as a simplification, and costs a third of a second that nothing in the
   * code says it costs.
   */
  it('does not suspend to open, because that cost 300ms of throttle', () => {
    const button = code('./Assistant.tsx');
    expect(button).not.toContain('lazy(');
    expect(button).not.toContain('<Suspense');
  });

  it('survives a panel that will not load, rather than blanking the app', () => {
    // `<Assistant />` is mounted in the shell, outside the boundary that wraps
    // the screen — so an uncaught throw here takes the whole tree with it,
    // which is the white page `components/Boundary.tsx` was written about. An
    // installed app open across a deploy asks for a file that is no longer
    // served; an app with no signal asks for one it never fetched.
    const button = read('./Assistant.tsx');
    expect(button).toContain('getDerivedStateFromError');
    expect(button).toContain('faultOf');
    // A failed fetch is not cached for the life of the page: walking back into
    // signal and tapping again has to be a real attempt.
    expect(button).toContain('loading = null');
  });

  /*
   * The same rule, one level up.
   *
   * `AIProvider` is mounted by `main.tsx`, above the router, so what
   * `ai/store.tsx` imports is parsed before the first render — and it used to
   * import `providerFor`, which reaches every screen's account of itself.
   * Between them those read the spreadsheet engine, the equation library, the
   * chart model and the whole insights tree: twenty-three modules and 7,543
   * lines, to hold a function nothing calls until the assistant is opened.
   *
   * The store keeps what only it can know — which screen, the live store,
   * what is registered — and `ai/assemble.ts` holds the part that needs the
   * providers. It is reached from `Panel.tsx`, `Opening.tsx` and
   * `converse.ts`, all of which are already behind a chunk.
   */
  it('keeps the providers out of the store that is mounted above the router', () => {
    const store = code('./store.tsx');
    expect(store).not.toContain("from './providers'");
    expect(store).not.toContain('providerFor');
    // What is left in its place: the raw inputs, which cost nothing to hand
    // over and are what `assemble` needs.
    expect(store).toContain('live:');
    expect(store).toContain('registered:');
  });

  it('and the assembly is reached only from behind a chunk', () => {
    // If a fourth caller appears in something eager, the module comes back
    // onto the critical path and nothing here fails — so the callers are the
    // thing to assert, not the module.
    for (const eager of ['./store.tsx', './AskAbout.tsx', './Assistant.tsx']) {
      expect(code(eager), `${eager} is mounted eagerly`).not.toContain("from './assemble'");
    }
    for (const behindAChunk of ['./Panel.tsx', './Opening.tsx', './converse.ts']) {
      expect(code(behindAChunk)).toContain("from './assemble'");
    }
  });

  it('leaves the panel owning everything that is only true while it is open', () => {
    const panel = read('./Panel.tsx');
    expect(panel).toContain("from './converse'");
    expect(panel).toContain("from './Composer'");
    // Mount and unmount say open and shut, so nothing reads the flag.
    expect(code('./Panel.tsx')).not.toContain('ai.open ?');
  });
});
