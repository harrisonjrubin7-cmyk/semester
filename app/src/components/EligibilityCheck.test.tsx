// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_ATHLETICS, type AthleticsLibrary } from '../lib/athletics';
import type { Requirement } from '../lib/degree';

vi.mock('../state/store', () => ({
  useStore: () => ({ state: { taken: [] }, dispatch: vi.fn() }),
}));

const { EligibilityCheck } = await import('./EligibilityCheck');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const first: Requirement = {
  id: 'eligibility-one',
  programme: 'Compliance office',
  name: 'Earn 24 credit hours',
  need: 'hours',
  count: 24,
  accepts: [],
  note: 'Annual progress rule',
};
const second: Requirement = {
  id: 'eligibility-two',
  programme: 'Compliance office',
  name: 'Earn 24 credit hours',
  need: 'courses',
  count: 6,
  accepts: ['BIOL', 'CHEM 1101'],
  note: 'Conference progress rule',
};
const later: Requirement = {
  id: 'eligibility-later',
  programme: 'Academic advisor',
  name: 'Complete writing course',
  need: 'courses',
  count: 1,
  accepts: ['WRIT'],
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

function Harness({ refuse = false }: { refuse?: boolean }) {
  const [value, setValue] = useState<AthleticsLibrary>({
    ...EMPTY_ATHLETICS,
    eligibility: [first, second],
  });
  const update = (change: (old: AthleticsLibrary) => AthleticsLibrary) => {
    if (refuse) return false;
    setValue(change);
    return true;
  };
  return (
    <>
      <EligibilityCheck value={value} update={update} blocked={false} />
      <button
        type="button"
        onClick={() => setValue((old) => ({ ...old, eligibility: [...old.eligibility, later] }))}
      >
        Add later work
      </button>
      <output data-testid="ids">{value.eligibility.map((requirement) => requirement.id).join(',')}</output>
    </>
  );
}

const button = (name: string) =>
  [...host.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.getAttribute('aria-label') === name || candidate.textContent?.trim() === name,
  );

describe('student-entered eligibility requirement removal', () => {
  it('offers a bounded undo with an exact accessible remove name', async () => {
    await act(async () => root.render(<Harness />));

    const remove = button(
      'Remove eligibility requirement 1 of 2, Earn 24 credit hours from Compliance office: 24 credit hours · any recorded course counts · Annual progress rule',
    );
    expect(remove).toBeDefined();
    act(() => remove!.click());

    expect(host.querySelector('[data-testid="ids"]')?.textContent).toBe('eligibility-two');
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Eligibility requirement removed.');
    expect(button('Undo removal')).toBeDefined();

    act(() => button('Add later work')!.click());
    act(() => button('Undo removal')!.click());

    expect(host.querySelector('[data-testid="ids"]')?.textContent).toBe(
      'eligibility-one,eligibility-two,eligibility-later',
    );
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Eligibility requirement restored.');
  });

  it('retires the undo after the shared eight-second window', async () => {
    await act(async () => root.render(<Harness />));
    act(() =>
      button(
        'Remove eligibility requirement 1 of 2, Earn 24 credit hours from Compliance office: 24 credit hours · any recorded course counts · Annual progress rule',
      )!.click(),
    );
    expect(button('Undo removal')).toBeDefined();

    act(() => vi.advanceTimersByTime(8_000));

    expect(button('Undo removal')).toBeUndefined();
    expect(host.querySelector('[data-testid="ids"]')?.textContent).toBe('eligibility-two');
  });

  it('keeps the requirement represented when device storage refuses the write', async () => {
    await act(async () => root.render(<Harness refuse />));
    act(() =>
      button(
        'Remove eligibility requirement 1 of 2, Earn 24 credit hours from Compliance office: 24 credit hours · any recorded course counts · Annual progress rule',
      )!.click(),
    );

    expect(host.querySelector('[data-testid="ids"]')?.textContent).toBe('eligibility-one,eligibility-two');
    expect(host.querySelector('[role="status"]')?.textContent).toContain(
      'Eligibility requirement could not be removed from this device.',
    );
    expect(button('Undo removal')).toBeUndefined();
  });

  it('distinguishes repeated names and removes only the represented requirement', async () => {
    await act(async () => root.render(<Harness />));

    expect(
      button(
        'Remove eligibility requirement 1 of 2, Earn 24 credit hours from Compliance office: 24 credit hours · any recorded course counts · Annual progress rule',
      ),
    ).toBeDefined();
    const removeSecond = button(
      'Remove eligibility requirement 2 of 2, Earn 24 credit hours from Compliance office: 6 courses · accepted courses: BIOL, CHEM 1101 · Conference progress rule',
    );
    expect(removeSecond).toBeDefined();

    act(() => removeSecond!.click());

    expect(host.querySelector('[data-testid="ids"]')?.textContent).toBe('eligibility-one');
  });
});
