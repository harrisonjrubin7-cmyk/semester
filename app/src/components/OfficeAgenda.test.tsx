// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StoreProvider, useStore } from '../state/store';
import { STORAGE_KEY } from '../state/shape';
import { loadSeed } from '../data/seed';
import { OfficeAgenda } from './OfficeAgenda';
import { LearningMap } from './LearningMap';
import { LearningPanels } from './LearningPanels';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Nothing is on the agenda until the student puts it there.
 *
 * `lib/officeagenda.test.ts` shows the agenda holds what it is given. Whether
 * anything is *given* by default is the component's state, and that is the
 * property the panel promises in words ("nothing is chosen for you"), so it is
 * held here by rendering it against a store that has a private question in it.
 */
let host: HTMLDivElement;
let root: Root;
const SECRET = 'a question I would rather nobody read unless I choose';

beforeAll(async () => {
  await loadSeed();
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

/** What the store calls this term and its first course, read off a throwaway render's DOM. */
async function probe() {
  function Probe() {
    const { state, catalog } = useStore();
    return <output data-term={state.term} data-course={catalog.courses[0]?.id ?? ''} />;
  }
  await act(async () => {
    root.render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
  });
  // The catalog arrives a tick after the store mounts; wait for it rather than assume it.
  for (let i = 0; i < 20 && !host.querySelector('output')?.getAttribute('data-course'); i++) await act(async () => void (await new Promise((r) => setTimeout(r, 10))));
  const out = host.querySelector('output');
  const seen = { term: out?.getAttribute('data-term') ?? '', courseId: out?.getAttribute('data-course') ?? '' };
  await act(async () => root.unmount());
  await act(async () => {
    root = createRoot(host);
  });
  return seen;
}

async function showWithSecret() {
  const { term, courseId } = await probe();
  expect(courseId, 'no course to attach the question to').not.toBe('');
  const map = { version: 1, own: [{ id: 'o1', courseId, name: SECRET, note: '', label: 'Not started', question: true }], checks: {} };
  localStorage.setItem(`semester.learning-map.v1:device:${term}`, JSON.stringify(map));
  await act(async () => {
    root.render(
      <StoreProvider>
        <OfficeAgenda />
      </StoreProvider>,
    );
  });
  return {
    boxes: () => [...host.querySelectorAll<HTMLInputElement>('fieldset input[type=checkbox]')],
    preview: () => host.querySelector('pre')?.textContent ?? '',
  };
}

const click = (el: HTMLElement) => act(async () => void el.click());

describe('the office-hours agenda panel', () => {
  it('offers a private question but starts with nothing ticked and none of it in the text', async () => {
    const view = await showWithSecret();
    expect(view.boxes()).toHaveLength(1);
    expect(view.boxes()[0].checked).toBe(false);
    expect(view.preview()).not.toContain(SECRET);
    expect(view.preview()).toMatch(/Nothing chosen yet/);
  });

  it('puts it in the text only while it is ticked', async () => {
    const view = await showWithSecret();
    await click(view.boxes()[0]);
    expect(view.boxes()[0].checked).toBe(true);
    expect(view.preview()).toContain(SECRET);
    await click(view.boxes()[0]);
    expect(view.preview()).not.toContain(SECRET);
  });
});

/** React listens for `input`, so a value has to be set through the native setter and announced. */
const type = (el: HTMLInputElement | HTMLTextAreaElement, value: string) =>
  act(async () => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });

describe('the map and the agenda together', () => {
  async function both() {
    await act(async () => {
      root.render(
        <StoreProvider>
          <LearningMap />
          <OfficeAgenda />
        </StoreProvider>,
      );
    });
    for (let i = 0; i < 20 && !host.querySelector('.office-agenda option'); i++) await act(async () => void (await new Promise((r) => setTimeout(r, 10))));
  }
  const file = async (name: string, asQuestion: boolean) => {
    const form = host.querySelector('.learning-map form') as HTMLFormElement;
    await type(form.querySelector('input.input') as HTMLInputElement, name);
    const box = form.querySelector('input[type=checkbox]') as HTMLInputElement;
    if (box.checked !== asQuestion) await click(box);
    await act(async () => void form.requestSubmit());
  };
  const offered = () => [...host.querySelectorAll('.office-agenda fieldset label')].map((l) => l.textContent ?? '');

  it('offers a question filed in the map, and not a plain concept filed beside it', async () => {
    await both();
    await file('A question I need help with', true);
    await file('Just a concept I am tracking', false);
    const got = offered();
    expect(got.some((t) => t.includes('A question I need help with'))).toBe(true);
    expect(got.some((t) => t.includes('Just a concept I am tracking'))).toBe(false);
  });
});

describe('an agenda in progress does not outlive the person or the course it was written for', () => {
  /** A button inside the provider that switches term, standing in for the store changing scope under a mounted panel. */
  function Switch() {
    const { dispatch } = useStore();
    return <button id="switch" onClick={() => dispatch({ type: 'setTerm', term: '2099XX' })} />;
  }
  async function panels() {
    await act(async () => {
      root.render(
        <StoreProvider>
          <Switch />
          <LearningPanels />
        </StoreProvider>,
      );
    });
    for (let i = 0; i < 30 && !host.querySelector('.office-agenda option'); i++) await act(async () => void (await new Promise((r) => setTimeout(r, 10))));
  }
  const goal = () => host.querySelector('.office-agenda input.input') as HTMLInputElement;

  it('is cleared when the store switches term under the mounted panel', async () => {
    await panels();
    await type(goal(), 'a draft I have not saved');
    expect(goal().value).toBe('a draft I have not saved');
    await click(host.querySelector('#switch') as HTMLElement);
    expect(goal().value, 'the last scope’s draft is still on screen').toBe('');
  });

  it('is cleared when the course is changed', async () => {
    await panels();
    await type(goal(), 'a draft for the first course');
    const select = host.querySelector('.office-agenda select') as HTMLSelectElement;
    await act(async () => {
      select.value = select.options[1].value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(goal().value).toBe('');
  });
});
