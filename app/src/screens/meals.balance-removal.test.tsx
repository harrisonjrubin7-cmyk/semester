// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import { loadSeed } from '../data/seed';
import { formatDate } from '../lib/locale';
import { STORAGE_KEY, type State } from '../state/shape';
import { StoreProvider, useStore } from '../state/store';
import { Meals } from './Meals';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const FIRST_AT = new Date(2026, 9, 15, 12).getTime();
const SECOND_AT = new Date(2026, 9, 8, 12).getTime();

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
    balances: [
      { id: 'newer', at: FIRST_AT, swipes: 42, cashCents: 1250, diningCents: 1800, term: '2026FA' },
      { id: 'older', at: SECOND_AT, swipes: 55, cashCents: 900, diningCents: -1, term: '2026FA' },
    ],
  }));
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root.render(
      <StoreProvider>
        <Probe />
        <Meals />
      </StoreProvider>,
    );
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
});

it('identifies a balance removal with every value in the represented reading', async () => {
  const name = `Remove balance reading from ${formatDate(FIRST_AT)}: 42 swipes · $12.50 Commodore Cash · $18.00 meal money`;
  const remove = host.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`);

  expect(host.textContent).toContain('42 swipes · $12.50 Commodore Cash · $18.00 meal money');
  expect(remove).not.toBeNull();

  await act(async () => remove?.click());

  expect(seen.balances.map((reading) => reading.id)).toEqual(['older']);
  expect(seen.undone?.label).toBe('Reading removed');
});
