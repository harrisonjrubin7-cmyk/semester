// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import { loadSeed } from '../data/seed';
import { STORAGE_KEY, type State } from '../state/shape';
import { StoreProvider, useStore } from '../state/store';
import { Housing } from './Housing';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let seen: State;

function Probe() {
  const { state } = useStore();
  useEffect(() => {
    seen = state;
  });
  return null;
}

function button(name: string) {
  const found = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.ariaLabel === name || candidate.textContent?.trim() === name,
  );
  if (!found) throw new Error(`No button named ${name}. Screen: ${host.textContent ?? ''}`);
  return found;
}

beforeAll(async () => {
  await loadSeed();
});

beforeEach(async () => {
  localStorage.clear();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    schemaVersion: 6,
    term: '2026FA',
    residences: [{
      id: 'residence-1',
      hall: 'Branscomb Hall',
      room: '214',
      term: '2026FA',
      moveOut: '2026-12-19',
      hoursAfterLastExam: 24,
      created: 1,
    }],
  }));
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root.render(
      <StoreProvider>
        <Probe />
        <Housing />
      </StoreProvider>,
    );
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
});

it('names the exact saved residence and previews its device-only consequence', async () => {
  await act(async () => button('Remove Branscomb Hall · 214 for Fall 2026').click());

  const dialog = document.querySelector('[role="dialog"]');
  expect(dialog?.textContent).toContain('Remove this saved room?');
  expect(dialog?.textContent).toContain('Branscomb Hall · 214');
  expect(dialog?.textContent).toContain('Fall 2026 · move out 2026-12-19 · 24 hours after the last exam');
  expect(dialog?.textContent).toContain('removes this saved room and its move-out calculation from this device');
  expect(dialog?.textContent).toContain('maintenance requests, application plan and official housing assignment stay unchanged');
  expect(dialog?.textContent).toContain('Undo is available for eight seconds');
  expect(document.activeElement?.textContent).toBe('Cancel');
  expect(seen.residences).toHaveLength(1);

  await act(async () => button('Cancel').click());
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(seen.residences).toHaveLength(1);
});

it('removes only the represented residence after confirmation and keeps Undo recovery', async () => {
  await act(async () => button('Remove Branscomb Hall · 214 for Fall 2026').click());
  await act(async () => button('Remove saved room').click());

  expect(seen.residences).toEqual([]);
  expect(seen.undone?.label).toBe('Room removed');
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});
