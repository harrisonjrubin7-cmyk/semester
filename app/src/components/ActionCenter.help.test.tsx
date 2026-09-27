// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { loadSeed } from '../data/seed';
import type { Action } from '../lib/actions';
import { payload, emptyDraft, helpSeedWaiting, takeHelpSeed } from '../lib/help-routes';
import { StoreProvider, useStore } from '../state/store';
import { ActionCenter } from './ActionCenter';

/**
 * "Ask for help" with the help route on: it goes to a person when the action
 * has one, and keeps the note when it does not. The flag is read at import,
 * so it is switched on here, in its own file, rather than in ActionCenter.test.
 */

vi.mock('../lib/experience-flags', async (importOriginal) => {
  const real = await importOriginal<typeof import('../lib/experience-flags')>();
  return { ...real, EXPERIENCE_FLAGS: { ...real.EXPERIENCE_FLAGS, humanHelp: 'preview' } };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const KEY = 'semester.actions.v1:device';
let root: Root;
let host: HTMLDivElement;

beforeAll(async () => {
  await loadSeed();
});

beforeEach(() => {
  localStorage.clear();
  takeHelpSeed();
  host = document.createElement('div');
  document.body.append(host);
  act(() => {
    root = createRoot(host);
  });
});

/* No root outlives the test that made it. See `src/rootunmount.test.ts`. */
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  takeHelpSeed();
});

const action = (type: string, title: string): Action => ({
  id: `${type}-1`,
  type,
  title,
  whyItMatters: 'Because.',
  priority: 'normal',
  dueAt: Date.now() + 3 * 86_400_000,
  source: { label: 'imported', system: 'Test source' },
  explanation: { trigger: 'x', factors: [], expectedImpact: 'x', limitations: [], alternatives: [] },
  primary: { label: 'Open it', kind: 'navigate', target: '#/courses', requiresConfirmation: false },
});

/** Where the store says the app is. */
function Where() {
  const { state } = useStore();
  return <i data-screen={state.screen} />;
}

const render = (actions: Action[]) =>
  act(() => {
    root.render(
      <StoreProvider>
        <ActionCenter actions={actions} />
        <Where />
      </StoreProvider>,
    );
  });

const button = (name: RegExp) =>
  [...host.querySelectorAll('button')].find((b) => name.test(b.textContent ?? '')) as HTMLButtonElement | undefined;
const screen = () => host.querySelector('[data-screen]')?.getAttribute('data-screen');
const history = (id: string) => JSON.parse(localStorage.getItem(KEY) ?? '{"choices":{}}').choices[id]?.history ?? [];

it('goes to Get help with the action filled in, records the ask, and sends nothing', () => {
  render([action('deadline', 'Problem Set 3')]);
  act(() => button(/Ask for help/)!.click());

  expect(screen()).toBe('university');
  expect(history('deadline-1').at(-1)).toMatchObject({ event: 'help', note: expect.stringMatching(/Get help/) });
  expect(host.querySelector('textarea')).toBeNull();

  expect(helpSeedWaiting()).toBe(true);
  const seed = takeHelpSeed()!;
  expect(seed.need).toBe('course');
  expect(seed.fields.assignment).toBe('Problem Set 3');
  // Handed over filled, not ticked: on its own it sends only a question.
  expect(payload({ ...emptyDraft(), question: 'q', fields: seed.fields }).context).toEqual({});
});

it('keeps the note for an action no person answers', () => {
  render([action('setup', 'Add your courses')]);
  const before = screen();
  act(() => button(/Ask for help/)!.click());
  expect(host.querySelector('textarea')?.closest('label')?.textContent).toContain('What do you need help with?');
  expect(helpSeedWaiting()).toBe(false);
  expect(screen()).toBe(before);
});
