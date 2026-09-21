// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StoreProvider } from '../state/store';
import { loadSeed } from '../data/seed';
import { Reply, Using } from './Turns';
import { readMode, type Read } from '../lib/mode';
import { build as buildContext } from '../lib/context';
import { buildCatalog } from '../data/catalog';
import { DEFAULT_PERSISTED, initialEphemeral, type State } from '../state/shape';
import ECON from '../data/courses/econ';

/**
 * The app said the same thing about three different questions.
 *
 * `lib/mode.ts` reads every question as one of three — about this app, about
 * this student's records, or general — and returns four things. `converse.ts`
 * kept one of them, the mode, for routing, and dropped the rest at the moment
 * they were computed. Two of the three dropped are documented as shown:
 *
 *   says:    "Shown next to the answer: 'Using: your courses'. Never a mystery."
 *   because: "What in the question decided it, for the same reason a quote is shown."
 *
 * A third place said so too — `Conversation.mode`'s own docblock read *"What
 * the last question was read as. Shown, never hidden."* It was a `Mode | null`
 * that neither surface ever read.
 *
 * What made it invisible is the first test below: `Looked` was already on
 * screen saying "Read 4 parts of your records", and it says that whatever the
 * mode. Something was always there, so nothing looked missing.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

const QUESTIONS = {
  general: 'explain price elasticity',
  grounded: 'what is due Thursday',
  app: 'where do I set my grade scale',
};

describe('why the line is needed at all', () => {
  it('is that what was already shown does not vary with the mode', () => {
    /*
     * The measurement this pass turns on. `Looked` renders from `used`, and
     * `buildContext` pushes the date, the term, the screen and the course
     * codes on every question regardless of how it was read — so the row
     * reads "Read 4 parts of your records" for all three.
     *
     * If this ever stops holding, `Using` may be saying something `Looked`
     * has started saying too, and the two should be reconsidered rather than
     * stacked.
     */
    const state = { ...DEFAULT_PERSISTED, ...initialEphemeral(), courses: [ECON], term: '2026FA' } as State;
    const cat = buildCatalog([ECON]);
    const now = new Date(2026, 8, 15);
    const used = Object.values(QUESTIONS).map((q) =>
      buildContext(q, readMode(q).mode, state, cat, now, 'home', '').used.join('|'),
    );
    expect(new Set(used).size, `three modes gave ${used.length} different lists`).toBe(1);

    // …and the modes really are three, so this is not one question asked thrice.
    expect(new Set(Object.values(QUESTIONS).map((q) => readMode(q).mode)).size).toBe(3);
  });
});

describe('what the line says', () => {
  const draw = (read: Read | null) => {
    act(() => {
      root.render(
        <StoreProvider>
          <Reply text="An answer." extra={<Using read={read} />} />
        </StoreProvider>,
      );
    });
    return host.textContent ?? '';
  };

  it('names what the question was taken to be, and quotes what decided it', () => {
    const said = draw(readMode(QUESTIONS.grounded));
    expect(said).toContain('Using: your courses');
    expect(said).toContain('what is due');
  });

  it('says so for a question about the app', () => {
    const said = draw(readMode(QUESTIONS.app));
    expect(said).toContain('Using: this app');
    expect(said).toContain('where do I set');
  });

  it('quotes nothing when nothing in particular decided it', () => {
    // A general question is the default rather than a match, so `because` is
    // empty and there is no phrase to put in quotes.
    const read = readMode(QUESTIONS.general);
    expect(read.because).toBe('');
    const said = draw(read);
    expect(said).toContain('General');
    expect(said).not.toContain('“');
  });

  it('draws nothing before a question has been read — the control', () => {
    // Without this, "it renders the line" would pass against a component
    // printing one unconditionally.
    const said = draw(null);
    expect(said).toContain('An answer.');
    expect(said).not.toContain('Using:');
    expect(said).not.toContain('General');
  });
});

describe('and both surfaces draw it', () => {
  /*
   * From the source: this was a wiring fault for four years of commits — the
   * value was in live state and neither surface read it — and wiring is what
   * a component test cannot see.
   *
   * `process.cwd()`, not `import.meta.url`, which resolves to `/src/ai/…`
   * under jsdom. See `state/keyread.test.ts`.
   */
  for (const file of ['Chat.tsx', 'Panel.tsx']) {
    it(`${file} hands the reading to the answer`, () => {
      const src = readFileSync(join(process.cwd(), 'src', 'ai', file), 'utf8');
      expect(src, `${file} does not draw <Using>`).toContain('<Using read={talk.read}');
    });
  }
});
