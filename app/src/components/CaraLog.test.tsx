// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_ATHLETICS, type AthleticsLibrary, type CaraEntry } from '../lib/athletics';

vi.mock('../state/store', () => ({ useNow: () => new Date(2026, 8, 23) }));

const { CaraLog } = await import('./CaraLog');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const first: CaraEntry = {
  id: 'cara-one',
  date: '2026-09-22',
  hours: 2,
  kind: 'Practice',
  note: 'Morning session',
};
const second: CaraEntry = {
  id: 'cara-two',
  date: '2026-09-23',
  hours: 1.5,
  kind: 'Film or team meeting',
  note: '',
};
const later: CaraEntry = {
  id: 'cara-later',
  date: '2026-09-24',
  hours: 1,
  kind: 'Required weights or conditioning',
  note: '',
};

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

function Harness() {
  const [value, setValue] = useState<AthleticsLibrary>({ ...EMPTY_ATHLETICS, cara: [first, second] });
  const update = (change: (old: AthleticsLibrary) => AthleticsLibrary) => {
    setValue(change);
    return true;
  };
  return (
    <>
      <CaraLog value={value} update={update} blocked={false} />
      <button type="button" onClick={() => update((old) => ({ ...old, cara: [...old.cara, later] }))}>
        Add later work
      </button>
      <output data-testid="ids">{value.cara.map((entry) => entry.id).join(',')}</output>
    </>
  );
}

const button = (name: string) =>
  [...host.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.getAttribute('aria-label') === name || candidate.textContent?.trim() === name,
  );

describe('student athletics-hours removal', () => {
  it('offers a bounded undo with an exact accessible remove name', async () => {
    await act(async () => root.render(<Harness />));

    const remove = button('Remove 2 hours of Practice on 2026-09-22');
    expect(remove).toBeDefined();
    act(() => remove!.click());

    expect(host.querySelector('[data-testid="ids"]')?.textContent).toBe('cara-two');
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Hours entry removed.');
    expect(button('Undo removal')).toBeDefined();

    act(() => button('Add later work')!.click());
    act(() => button('Undo removal')!.click());

    expect(host.querySelector('[data-testid="ids"]')?.textContent).toBe('cara-one,cara-two,cara-later');
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Hours entry restored.');
  });

  it('retires the undo after the shared eight-second window', async () => {
    await act(async () => root.render(<Harness />));
    act(() => button('Remove 2 hours of Practice on 2026-09-22')!.click());
    expect(button('Undo removal')).toBeDefined();

    act(() => vi.advanceTimersByTime(8_000));

    expect(button('Undo removal')).toBeUndefined();
    expect(host.querySelector('[data-testid="ids"]')?.textContent).toBe('cara-two');
  });
});
