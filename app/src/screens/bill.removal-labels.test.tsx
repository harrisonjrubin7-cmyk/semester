// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import { loadSeed } from '../data/seed';
import { STORAGE_KEY, type State } from '../state/shape';
import { StoreProvider, useStore } from '../state/store';
import { Bill } from './Bill';

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
    charges: [
      { id: 'charge-1', term: '2026FA', what: 'Tuition', kind: 'tuition', cents: 324150, at: 1 },
      { id: 'charge-2', term: '2026FA', what: 'Tuition', kind: 'tuition', cents: 324150, at: 2 },
    ],
    aid: [
      { id: 'aid-1', term: '2026FA', what: 'Need-based award', kind: 'grant', cents: 125000, pending: true, at: 3 },
      { id: 'aid-2', term: '2026FA', what: 'Need-based award', kind: 'grant', cents: 125000, pending: true, at: 4 },
    ],
    payments: [
      { id: 'payment-1', term: '2026FA', what: 'Instalment', cents: 50000, on: '2026-10-15', at: 5 },
      { id: 'payment-2', term: '2026FA', what: 'Instalment', cents: 50000, on: '2026-10-15', at: 6 },
    ],
  }));
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root.render(
      <StoreProvider>
        <Probe />
        <Bill schoolAccount={false} />
      </StoreProvider>,
    );
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
});

it('identifies exact duplicate ledger removals by position and complete represented facts', async () => {
  const charge = host.querySelector<HTMLButtonElement>(
    'button[aria-label="Remove charge 2 of 2, Tuition: Tuition · $3,241.50"]',
  );
  const aid = host.querySelector<HTMLButtonElement>(
    'button[aria-label="Remove aid 2 of 2, Need-based award: Grant · $1,250.00 · not yet confirmed"]',
  );
  const payment = host.querySelector<HTMLButtonElement>(
    'button[aria-label="Remove payment 2 of 2, Instalment: $500.00 paid Thu Oct 15"]',
  );

  expect(charge).not.toBeNull();
  expect(aid).not.toBeNull();
  expect(payment).not.toBeNull();
  expect(new Set([...host.querySelectorAll<HTMLButtonElement>('button[aria-label^="Remove charge "]')].map((button) => button.ariaLabel)).size).toBe(2);
  expect(new Set([...host.querySelectorAll<HTMLButtonElement>('button[aria-label^="Remove aid "]')].map((button) => button.ariaLabel)).size).toBe(2);
  expect(new Set([...host.querySelectorAll<HTMLButtonElement>('button[aria-label^="Remove payment "]')].map((button) => button.ariaLabel)).size).toBe(2);

  await act(async () => payment?.click());

  expect(seen.payments.map((row) => row.id)).toEqual(['payment-1']);
  expect(seen.undone?.label).toBe('Payment record removed');
});
