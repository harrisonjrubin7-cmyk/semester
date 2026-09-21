// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StoreProvider } from '../state/store';
import { loadSeed } from '../data/seed';
import { Question } from './Turns';
import { Locally } from './Actions';

/**
 * The answer that needs no key was only ever drawn beside one that did.
 *
 * `lib/localask.ts` answers a question about this app with no model, no key
 * and no connection, and its docblock says why that is the case most worth
 * having: *"a student on a train with no signal, or one who has never set up
 * a key, is exactly the person asking where a setting lives."*
 *
 * `<Locally>` rendered it — as `extra` on `<Reply>`, and nowhere else. A reply
 * only exists when a request came back: `converse.ts` pushes the question with
 * `remember(next)`, and every assistant turn is appended *after* a response.
 * So on a keyless profile the app worked the answer out on every question and
 * threw it away, because there was no reply to hang it on.
 *
 * Driven, before: asking "where is the meal plan" with no key drew the
 * question, then *"No key yet. Sign in to use the shared one…"*, and nothing
 * else. After: the question, then **FROM THIS APP, WITH NOTHING SENT**, then
 * the Meal plan card and the guidebook line under it.
 *
 * The offline branch of `converse.ts` had been promising it the whole time —
 * *"No connection, so this is what the app can tell you about itself"* —
 * pointing at a panel that could not be on screen.
 *
 * Two halves here because the fault had two: the component could not carry it
 * (no `extra` on `Question`), and neither surface passed it. A structural test
 * alone would pass against a prop that is accepted and dropped; a render test
 * alone would pass against a component nobody hands it to.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/*
 * `StoreProvider` starts fetching the four shipped courses the moment it
 * mounts and does not await it, so a file that ends first leaves a promise in
 * flight for Vitest to tear down under — and the error lands on whichever file
 * was running when it resolved. `loadSeed` caches, so one await here settles
 * the store's own call. See `seedawait.test.ts`, which is what caught this.
 */
beforeAll(async () => {
  await loadSeed();
});

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  act(() => {
    root = createRoot(host);
  });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const SAID = 'From this app, with nothing sent';

describe('a question that got no reply can still carry an answer', () => {
  it('draws what was handed to it', () => {
    act(() => {
      root.render(
        <StoreProvider>
          <Question
            text="where is the meal plan"
            extra={
            <Locally
              locally={{
                matches: [
                  { screen: 'meals', label: 'Meal plan', blurb: 'What is on your plan.', group: 'Campus', score: 3 },
                ],
                fromGuide: ['Open it when you are thinking about meal, meals, plan.'],
              }}
                onGo={() => {}}
              />
            }
          />
        </StoreProvider>,
      );
    });
    const said = host.textContent ?? '';
    expect(said).toContain('where is the meal plan');
    expect(said).toContain(SAID);
    expect(said).toContain('Meal plan');
    expect(said).toContain('Open it when you are thinking about');
  });

  it('draws the question alone when there is nothing to add — the control', () => {
    // Without this, "it renders the panel" would pass against a Question that
    // had started printing one unconditionally.
    act(() => {
      root.render(
        <StoreProvider>
          <Question text="where is the meal plan" extra={<Locally locally={null} onGo={() => {}} />} />
        </StoreProvider>,
      );
    });
    const said = host.textContent ?? '';
    expect(said).toContain('where is the meal plan');
    expect(said).not.toContain(SAID);
  });
});

describe('and both surfaces hand it one', () => {
  /*
   * Read from the source, because this is a wiring fault and wiring is what a
   * render test of a component cannot see. The assertion is deliberately about
   * the `<Question …/>` element rather than about the file: `<Locally` appears
   * in both of these files already, in the `<Reply>` branch, and did while the
   * panel was unreachable.
   */
  const questionElement = (file: string): string => {
    /*
     * `process.cwd()`, not `import.meta.url`. Under jsdom that resolves to
     * `/src/ai/…` and every read here fails as ENOENT — the same trap
     * `state/keyread.test.ts` hit, recorded in its own note.
     */
    const src = readFileSync(join(process.cwd(), 'src', 'ai', file), 'utf8');
    const at = src.indexOf('<Question');
    expect(at, `${file} draws no <Question>`).toBeGreaterThan(-1);
    const end = src.indexOf('/>', at);
    expect(end, `${file}'s <Question> is not self-closing`).toBeGreaterThan(at);
    return src.slice(at, end);
  };

  for (const file of ['Chat.tsx', 'Panel.tsx']) {
    it(`${file} passes the local answer to the question too`, () => {
      const el = questionElement(file);
      expect(el, 'no extra on <Question>').toContain('extra=');
      expect(el, 'the extra is not the local answer').toContain('Locally');
    });
  }
});
