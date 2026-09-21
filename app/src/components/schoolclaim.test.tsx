// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

/**
 * Claiming a university, and the four ways a screen could lie about it.
 *
 * `lib/schoolclaim.ts` is tested on its own, and the migration behind it is
 * tested in `supabase/tenancy.check.sql`. What is left for this file is the
 * reasoning in between — the part where a screen can report a claim that did
 * not happen, offer one that cannot, or hide the server's refusal.
 *
 * The account service and the store are both replaced. Nothing here reaches a
 * database; what is under test is what the component does with the answers.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let email = 'ada@northern.edu';

vi.mock('../state/store', () => ({
  useStore: () => ({ account: email ? { email } : null }),
}));

type Known = { id: string; name: string; shortName: string; domains: string[] };
type Claim = { ok: true; schoolId: string } | { ok: false; because: string };

let known: Known[] = [];
/** What the *server* holds. Only `claimSchool` may move it — see below. */
let stored = '';
/**
 * How the list arrives, swappable per test.
 *
 * Indirection rather than `vi.doMock`, which cannot rebind a module the worker
 * has already evaluated — the first version of the loading case did that and
 * silently tested the immediate path twice.
 */
let listing: () => Promise<Known[]> = async () => known;

const claimSchool = vi.fn<(id: string) => Promise<Claim>>(async (id) => {
  stored = id;
  return { ok: true, schoolId: id };
});

vi.mock('../lib/schoolclaim', async () => {
  const real = await vi.importActual<typeof import('../lib/schoolclaim')>('../lib/schoolclaim');
  return {
    // The real predicate and the real domain reading. Mocking those would
    // leave the one piece of logic this screen shows nobody's to get wrong.
    looksClaimable: real.looksClaimable,
    domainOf: real.domainOf,
    knownSchools: () => listing(),
    claimedSchool: async () => stored,
    claimSchool: (id: string) => claimSchool(id),
  };
});

const { SchoolClaim } = await import('./SchoolClaim');

let host: HTMLDivElement;
let root: Root;

const draw = async () => {
  await act(async () => {
    root.render(<SchoolClaim />);
  });
};

const text = () => host.textContent ?? '';
const buttons = () => [...host.querySelectorAll('button')];
const pressing = (label: string) => {
  const found = buttons().find((b) => (b.textContent ?? '').includes(label));
  if (!found) throw new Error(`no button says “${label}”; saw: ${buttons().map((b) => b.textContent).join(' | ')}`);
  return found;
};

beforeEach(() => {
  email = 'ada@northern.edu';
  known = [];
  stored = '';
  listing = async () => known;
  claimSchool.mockClear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('when there is nothing to claim', () => {
  it('says the server has no universities rather than showing an empty box', async () => {
    await draw();
    expect(text()).toMatch(/no universities are set up/i);
    expect(buttons()).toHaveLength(0);
  });

  /*
   * The distinction that matters while the first read is in flight. "None" and
   * "not yet known" look identical on screen and mean opposite things, and the
   * wrong one tells a student their university is absent when it is loading.
   */
  it('does not say "none" before the answer has arrived', async () => {
    let release: (v: Known[]) => void = () => {};
    const slow = new Promise<Known[]>((r) => { release = r; });
    listing = () => slow;

    await act(async () => { root.render(<SchoolClaim />); });
    expect(text()).not.toMatch(/no universities are set up/i);
    expect(text()).toMatch(/checking/i);

    await act(async () => { release([]); await slow; });
    // And it does arrive at "none" once the answer is in, or the assertion
    // above would pass on a component that never renders anything.
    expect(text()).toMatch(/no universities are set up/i);
  });
});

describe('offering the claim', () => {
  beforeEach(() => {
    known = [
      { id: 'northern', name: 'Northern University', shortName: 'Northern', domains: ['northern.edu'] },
      { id: 'southern', name: 'Southern University', shortName: 'Southern', domains: ['southern.edu'] },
    ];
  });

  it('names every university the server knows', async () => {
    await draw();
    expect(text()).toContain('Northern University');
    expect(text()).toContain('Southern University');
  });

  it('says which one the address fits, and what the other one needs', async () => {
    await draw();
    expect(text()).toMatch(/your address is one Northern publishes/i);
    expect(text()).toMatch(/@southern\.edu/);
  });

  /*
   * The button is offered on the school the address does not fit, on purpose.
   *
   * A screen that hid it would be making an access decision in the client,
   * which is the thing this whole column exists to stop doing — and it would
   * be doing it on the address the *client* holds, which is not the one the
   * server checks. Someone whose confirmed address differs from the one shown
   * here must still be able to ask and be told no by the only thing that knows.
   */
  it('still offers the one the address does not fit', async () => {
    await draw();
    expect(pressing('Claim Southern').disabled).toBe(false);
  });

  it('refuses a school that publishes no addresses, because nobody can claim it', async () => {
    known = [{ id: 'closed', name: 'Closed University', shortName: 'Closed', domains: [] }];
    await draw();
    expect(pressing('Claim Closed').disabled).toBe(true);
    expect(text()).toMatch(/publishes no addresses/i);
  });

  it('asks the server for the id of the school that was pressed', async () => {
    await draw();
    await act(async () => { pressing('Claim Southern').click(); });
    expect(claimSchool).toHaveBeenCalledWith('southern');
  });
});

describe('what it does with the answer', () => {
  beforeEach(() => {
    known = [
      { id: 'northern', name: 'Northern University', shortName: 'Northern', domains: ['northern.edu'] },
    ];
  });

  it('shows the school once the server holds it', async () => {
    await draw();
    await act(async () => { pressing('Claim Northern').click(); });
    expect(text()).toContain('Northern University');
    expect(text()).toMatch(/the server has you at/i);
  });

  /*
   * The one that decides whether this screen can lie.
   *
   * `claimSchool` resolving is not the claim landing — the value of this
   * column is that it cannot be bluffed, and a screen trusting its own
   * optimism is the one place that could bluff it. Here the call answers
   * `ok` and the server holds nothing, which is what a definer function
   * whose UPDATE matched no row looks like from the outside.
   *
   * Written against a component that set `claimed` from the return value:
   * that version reports success and this goes red.
   */
  it('does not report a claim the server did not keep', async () => {
    claimSchool.mockImplementationOnce(async () => ({ ok: true, schoolId: 'northern' }));
    await draw();
    await act(async () => { pressing('Claim Northern').click(); });
    expect(text()).not.toMatch(/the server has you at/i);
  });

  it('passes the server’s refusal through in its own words', async () => {
    claimSchool.mockImplementationOnce(async () => ({
      ok: false,
      because: 'that address is not one northern publishes',
    }));
    await draw();
    await act(async () => { pressing('Claim Northern').click(); });
    expect(text()).toContain('that address is not one northern publishes');
    expect(text()).not.toMatch(/the server has you at/i);
  });

  it('puts a refusal where a screen reader is interrupted by it', async () => {
    claimSchool.mockImplementationOnce(async () => ({ ok: false, because: 'confirm your address first' }));
    await draw();
    await act(async () => { pressing('Claim Northern').click(); });
    const alert = host.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('confirm your address first');
  });

  it('shows the school it already holds, without being asked', async () => {
    stored = 'northern';
    await draw();
    expect(text()).toMatch(/the server has you at/i);
    expect(claimSchool).not.toHaveBeenCalled();
  });
});

describe('what it promises', () => {
  beforeEach(() => {
    known = [
      { id: 'northern', name: 'Northern University', shortName: 'Northern', domains: ['northern.edu'] },
    ];
  });

  /*
   * Nothing reads `school_id` yet. A screen implying that claiming protects
   * something today would be describing a policy that is not switched on, and
   * the day one is, somebody has to be able to trust what this said before it.
   */
  it('does not claim the university limits anything yet', async () => {
    await draw();
    expect(text()).toMatch(/changes nothing you can see today/i);
  });

  it('says the same after the claim, rather than implying it took effect', async () => {
    await draw();
    await act(async () => { pressing('Claim Northern').click(); });
    expect(text()).toMatch(/nothing uses that yet/i);
  });
});
