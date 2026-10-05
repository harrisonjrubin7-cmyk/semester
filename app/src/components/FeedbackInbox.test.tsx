// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StoreProvider } from '../state/store';
import { STORAGE_KEY } from '../state/shape';
import { loadSeed } from '../data/seed';
import { FeedbackInbox } from './FeedbackInbox';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * A comment filed on a cold open still belongs to a course.
 *
 * The store mounts before the catalog arrives, so a panel that reads the first
 * course once at mount holds an empty one for good, and what the student files
 * is saved against no course — which no per-course view ever shows. This files
 * a comment the moment the panel is up, the way a person on a slow device
 * would, and reads what was written to storage.
 */
let host: HTMLDivElement;
let root: Root;

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

/** React listens for `input`, so a value has to be set through the native setter and announced. */
const type = (el: HTMLInputElement | HTMLTextAreaElement, value: string) =>
  act(async () => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });

const controlFor = <T extends HTMLElement>(text: string) =>
  [...host.querySelectorAll('.feedback-inbox form label')].find((l) => l.textContent?.startsWith(text))?.querySelector('input,textarea,select') as T;

const stored = () => {
  const key = Object.keys(localStorage).find((k) => k.startsWith('semester.feedback-inbox.v1'));
  return key ? (JSON.parse(localStorage.getItem(key)!) as { items: { courseId: string; work: string }[] }).items : [];
};

async function mount() {
  await act(async () => {
    root.render(
      <StoreProvider>
        <FeedbackInbox />
      </StoreProvider>,
    );
  });
}

describe('the feedback inbox on a cold open', () => {
  it('files a comment against a real course even when it was mounted before the catalog loaded', async () => {
    await mount();
    // Filled and submitted at once: the catalog is allowed to arrive at any point after mount.
    await type(controlFor<HTMLInputElement>('Piece of work'), 'Essay 1');
    await type(controlFor<HTMLTextAreaElement>('The comment'), 'Claims need support.');
    for (let i = 0; i < 30 && !host.querySelector('.feedback-inbox form select option'); i++) await act(async () => void (await new Promise((r) => setTimeout(r, 10))));
    await act(async () => void (host.querySelector('.feedback-inbox form') as HTMLFormElement).requestSubmit());
    const items = stored();
    expect(items).toHaveLength(1);
    expect(items[0].courseId, 'saved against no course').not.toBe('');
  });
});
