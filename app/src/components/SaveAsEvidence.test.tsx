// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StoreProvider, useStore } from '../state/store';
import { STORAGE_KEY } from '../state/shape';
import { loadSeed } from '../data/seed';
import { SaveAsEvidence } from './SaveAsEvidence';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Saving something as evidence keeps the student's words, adds no skill, and
 * does nothing until they press the button.
 *
 * The three things the panel promises in words are held here against the
 * career evidence store it writes to: nothing is written on render, what is
 * written is exactly what the student had and claims no skill, and pressing
 * again updates the same entry instead of filing a copy.
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

const type = (el: HTMLInputElement | HTMLTextAreaElement, value: string) =>
  act(async () => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
const click = (el: HTMLElement) => act(async () => void el.click());
const button = (text: string) => [...host.querySelectorAll('button')].find((b) => b.textContent?.startsWith(text)) as HTMLButtonElement;
const artifacts = () => {
  const key = Object.keys(localStorage).find((k) => k.startsWith('semester.career-evidence.v1'));
  return key ? (JSON.parse(localStorage.getItem(key)!) as { artifacts: { id: string; title: string; description: string; skills: string[]; evidence: { kind: string; id: string } }[] }).artifacts : [];
};

function Host() {
  const { catalog } = useStore();
  return <SaveAsEvidence id="feedback:f1" courseId={catalog.courses[0]?.id ?? ''} title="Essay 1" description="I will list each claim with its source before drafting." />;
}

async function mount() {
  await act(async () => {
    root.render(
      <StoreProvider>
        <Host />
      </StoreProvider>,
    );
  });
  // The catalog arrives a tick after the store mounts; the button waits for a course.
  for (let i = 0; i < 30 && (!button('Save as evidence') || button('Save as evidence').disabled); i++) await act(async () => void (await new Promise((r) => setTimeout(r, 10))));
}

describe('save as evidence', () => {
  it('writes nothing until the button is pressed', async () => {
    await mount();
    expect(button('Save as evidence')).toBeTruthy();
    expect(artifacts()).toEqual([]);
  });

  it('keeps the student’s own words, ties it to a course, and adds no skill', async () => {
    await mount();
    await click(button('Save as evidence'));
    await click(button('Save to career evidence'));
    const saved = artifacts();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ id: 'feedback:f1', title: 'Essay 1', description: 'I will list each claim with its source before drafting.', skills: [] });
    expect(saved[0].evidence.kind).toBe('course');
    expect(saved[0].evidence.id).not.toBe('');
  });

  it('updates the same entry when pressed again instead of filing a copy', async () => {
    await mount();
    await click(button('Save as evidence'));
    await click(button('Save to career evidence'));
    await click(button('Update my evidence'));
    await type(host.querySelector('textarea') as HTMLTextAreaElement, 'Revised: I now outline every paragraph first.');
    await click(button('Update evidence'));
    const saved = artifacts();
    expect(saved).toHaveLength(1);
    expect(saved[0].description).toBe('Revised: I now outline every paragraph first.');
  });
});
