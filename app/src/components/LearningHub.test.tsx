// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StoreProvider } from '../state/store';
import { STORAGE_KEY } from '../state/shape';
import { loadSeed } from '../data/seed';
import { LearningHub } from './LearningHub';
import { askToOpen, clear, peek } from '../lib/learningintent';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * The Learning row costs Study nothing until it is opened.
 *
 * Its six panels were about 6.8 KB gzipped on a screen budgeted at 89.0 KB, and
 * the row is closed until asked for. So they arrive on first open and then stay
 * — closing the row must not throw away what a student was typing. Both halves
 * are held here, because the second is the one that a plain "render when open"
 * gets wrong.
 */
let host: HTMLDivElement;
let root: Root;

beforeAll(async () => {
  await loadSeed();
  // The panels are a dynamic import; have the module cached so no import is in flight when a file ends.
  await import('./LearningPanels');
});

beforeEach(async () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 6 }));
  host = document.createElement('div');
  document.body.append(host);
  await act(async () => {
    root = createRoot(host);
  });
});

// No root outlives the test that made it. See `src/rootunmount.test.ts`.
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
});

afterEach(clear);

const details = () => host.querySelector('details.learning-hub') as HTMLDetailsElement;
const toggle = (open: boolean) =>
  act(async () => {
    details().open = open;
    details().dispatchEvent(new Event('toggle'));
  });
const settle = async (until: () => boolean) => {
  for (let i = 0; i < 50 && !until(); i++) await act(async () => void (await new Promise((r) => setTimeout(r, 10))));
};

async function mount() {
  await act(async () => {
    root.render(
      <StoreProvider>
        <LearningHub />
      </StoreProvider>,
    );
  });
}

describe('the learning row', () => {
  it('arrives closed with none of the six panels rendered', async () => {
    await mount();
    expect(details().open).toBe(false);
    expect(host.querySelectorAll('details.learning-hub details')).toHaveLength(0);
    expect(host.querySelector('.learning-map')).toBeNull();
  });

  it('brings all six panels the first time it is opened', async () => {
    await mount();
    await toggle(true);
    await settle(() => host.querySelectorAll('details.learning-hub > details').length === 6);
    expect(host.querySelectorAll('details.learning-hub > details')).toHaveLength(6);
    for (const cls of ['learning-map', 'feedback-inbox', 'learning-insights', 'office-agenda', 'course-agreement', 'learning-preferences']) {
      expect(host.querySelector(`.${cls}`), cls).not.toBeNull();
    }
  });

  it('keeps them mounted when the row is closed again, so nothing typed is lost', async () => {
    await mount();
    await toggle(true);
    await settle(() => !!host.querySelector('.office-agenda'));
    const goal = host.querySelector('.office-agenda input.input') as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(goal, 'ask about the paper');
      goal.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await toggle(false);
    expect(host.querySelector('.office-agenda')).not.toBeNull();
    expect((host.querySelector('.office-agenda input.input') as HTMLInputElement).value).toBe('ask about the paper');
  });
});

describe('the learning row opened from the assignment planner', () => {
  it('opens itself and the feedback inbox, with the work and course carried over, then lets go of the request', async () => {
    askToOpen({ panel: 'feedback', work: 'Essay 1 draft', courseCode: 'PSCI 1104' });
    await mount();
    await settle(() => !!host.querySelector('.feedback-inbox'));
    expect(details().open).toBe(true);
    const inbox = host.querySelector('.feedback-inbox') as HTMLDetailsElement;
    expect(inbox.open).toBe(true);
    expect((inbox.querySelector('form input.input') as HTMLInputElement).value).toBe('Essay 1 draft');
    await settle(() => !!inbox.querySelector('form select option'));
    const select = inbox.querySelector('form select') as HTMLSelectElement;
    expect(select.selectedOptions[0]?.textContent).toBe('PSCI 1104');
    await act(async () => void (await new Promise((r) => setTimeout(r, 10))));
    expect(peek('feedback')).toBeNull();
  });

  it('control: with nothing asked, it stays closed', async () => {
    await mount();
    expect(details().open).toBe(false);
  });
});
