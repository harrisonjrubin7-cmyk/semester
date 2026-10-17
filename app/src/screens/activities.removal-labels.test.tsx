// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { loadSeed } from '../data/seed';
import { STORAGE_KEY, type State } from '../state/shape';
import { StoreProvider, useStore } from '../state/store';
import { Activities } from './Activities';

vi.mock('../components/CampusDirectory', () => ({ CampusDirectory: () => null }));

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

beforeAll(async () => {
  await loadSeed();
});

beforeEach(async () => {
  localStorage.clear();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    schemaVersion: 6,
    term: '2026FA',
    commitments: [
      {
        id: 'radio-host',
        name: 'Campus radio',
        kind: 'club',
        role: 'Host',
        where: 'Studio A',
        url: '',
        note: '',
        days: [1],
        at: 18 * 60,
        minutes: 60,
        hours: 0,
        active: true,
        created: 1,
      },
      {
        id: 'radio-producer',
        name: 'Campus radio',
        kind: 'club',
        role: 'Producer',
        where: 'Studio B',
        url: '',
        note: '',
        days: [3],
        at: 19 * 60 + 30,
        minutes: 90,
        hours: 0,
        active: true,
        created: 2,
      },
    ],
  }));
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root.render(
      <StoreProvider>
        <Probe />
        <Activities />
      </StoreProvider>,
    );
  });
  const mine = [...host.querySelectorAll<HTMLButtonElement>('button')]
    .find((button) => button.textContent === 'My week');
  await act(async () => mine?.click());
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
});

it('identifies duplicate activity removals by the represented commitment facts', async () => {
  const hostRemoval = host.querySelector<HTMLButtonElement>(
    'button[aria-label="Remove Campus radio: Club or organisation · Host · M · 6:00p · Studio A"]',
  );
  const producerRemoval = host.querySelector<HTMLButtonElement>(
    'button[aria-label="Remove Campus radio: Club or organisation · Producer · W · 7:30p · Studio B"]',
  );

  expect(hostRemoval).not.toBeNull();
  expect(producerRemoval).not.toBeNull();

  await act(async () => producerRemoval?.click());

  expect(seen.commitments.map((commitment) => commitment.id)).toEqual(['radio-host']);
  expect(seen.undone?.label).toBe('Activity removed');
});
