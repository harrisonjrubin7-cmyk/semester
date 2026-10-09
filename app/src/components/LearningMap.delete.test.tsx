// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { loadSeed } from '../data/seed';
import { StoreProvider } from '../state/store';
import { STORAGE_KEY } from '../state/shape';
import { LearningMap } from './LearningMap';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
    root.render(
      <StoreProvider>
        <LearningMap />
      </StoreProvider>,
    );
  });
  for (let i = 0; i < 30 && !host.querySelector('.learning-map select option'); i++) {
    await act(async () => void (await new Promise((resolve) => setTimeout(resolve, 10))));
  }
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
});

const button = (label: string) => {
  const found = [...host.querySelectorAll('button')].find((candidate) => candidate.textContent?.trim() === label);
  if (!found) throw new Error(`No button named "${label}"`);
  return found as HTMLButtonElement;
};

const click = (label: string) => act(async () => void button(label).click());

const type = (field: HTMLInputElement | HTMLTextAreaElement, value: string) =>
  act(async () => {
    const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });

const savedMap = () => {
  const key = Object.keys(localStorage).find((candidate) => candidate.startsWith('semester.learning-map.v1'));
  return key ? JSON.parse(localStorage.getItem(key)!) as { own: { name: string }[]; checks: Record<string, unknown> } : null;
};

describe('Learning Map deletion previews', () => {
  it('previews a private concept deletion and preserves it on cancel', async () => {
    const form = host.querySelector('.learning-map form') as HTMLFormElement;
    await type(form.querySelector('input.input') as HTMLInputElement, 'Confounders');
    await type(form.querySelector('textarea') as HTMLTextAreaElement, 'Ask about this in office hours.');
    await act(async () => void form.requestSubmit());

    await click('Delete');
    const dialog = host.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain('Delete this private concept?');
    expect(dialog.textContent).toContain('Confounders');
    expect(dialog.textContent).toContain('Ask about this in office hours.');
    expect(dialog.textContent).toContain('removes it from the office-hours agenda choices');
    expect(dialog.textContent).toContain('Course-guide concepts, grades, saved plan actions and other private concepts stay unchanged.');
    expect(dialog.textContent).toContain('Restore only from a device workspace backup created before deletion.');

    await click('Cancel');
    expect(savedMap()?.own.map((item) => item.name)).toContain('Confounders');

    await click('Delete');
    await click('Delete concept');
    expect(savedMap()?.own.map((item) => item.name)).not.toContain('Confounders');
  });

  it('previews deleting a Start Here result before it stops shaping the map', async () => {
    await click('Start the check');
    for (let i = 0; i < 20 && ![...host.querySelectorAll('button')].some((candidate) => candidate.textContent?.trim() === 'Delete this result'); i++) {
      await click('Show the answer');
      await click('I knew it');
    }
    expect(button('Delete this result')).toBeTruthy();

    await click('Delete this result');
    const dialog = host.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain('Delete this Start Here result?');
    expect(dialog.textContent).toContain('saved answers and its choice about shaping your map and study plan');
    expect(dialog.textContent).toContain('future recommendations will no longer use these answers');
    expect(dialog.textContent).toContain('Course content, review evidence, grades, saved plan actions and your private concepts stay unchanged.');
    expect(dialog.textContent).toContain('Restore only from a device workspace backup created before deletion.');

    await click('Cancel');
    expect(Object.keys(savedMap()?.checks ?? {})).not.toHaveLength(0);

    await click('Delete this result');
    await click('Delete result');
    expect(Object.keys(savedMap()?.checks ?? {})).toHaveLength(0);
  });
});
