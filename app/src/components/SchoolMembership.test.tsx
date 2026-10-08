// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSeed } from '../data/seed';
import { autoClaimDeclined, type KnownSchool } from '../lib/schoolclaim';
import { StoreProvider } from '../state/store';
import { SchoolClaim, type SchoolApi } from './SchoolClaim';

/**
 * Full-beta G-03: a university is claimed for you only when your address is
 * unambiguously its own; otherwise you ask, and nothing changes until its staff
 * say yes; you can leave; and staff see and decide only what is theirs.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;

const NORTH: KnownSchool = { id: 'north', name: 'North University', shortName: 'North', domains: ['north.example'] };
const SOUTH: KnownSchool = { id: 'south', name: 'South College', shortName: 'South', domains: ['south.example'] };

beforeAll(async () => {
  await loadSeed();
});

beforeEach(() => {
  localStorage.clear();
  host = document.createElement('div');
  host.className = 'device';
  document.body.append(host);
  act(() => {
    root = createRoot(host);
  });
});

/* No root outlives the test that made it. See `src/rootunmount.test.ts`. */
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const ok = { ok: true } as const;

/** A server that agrees with itself: claiming moves `claimed`, so the read-back sees it. */
function fake(over: Partial<SchoolApi> = {}, state: { claimed?: string } = {}): SchoolApi & { claimed: () => string } {
  let claimed = state.claimed ?? '';
  const api: SchoolApi = {
    knownSchools: async () => [NORTH, SOUTH],
    claimedSchool: async () => claimed,
    claimSchool: vi.fn(async (id: string) => {
      claimed = id;
      return { ok: true as const, schoolId: id };
    }),
    requestMembership: vi.fn(async () => ok),
    withdrawRequest: vi.fn(async () => ok),
    leaveSchool: vi.fn(async () => {
      claimed = '';
      return ok;
    }),
    decideRequest: vi.fn(async () => ok),
    schoolEnforced: async () => false,
    myRequests: async () => [],
    waitingFor: async () => [],
    readinessOf: async () => null,
    ...over,
  };
  return Object.assign(api, { claimed: () => claimed });
}

async function show(api: SchoolApi, email: string) {
  await act(async () => {
    root.render(
      <StoreProvider>
        <SchoolClaim api={api} who={{ id: 'acct-1', email }} />
      </StoreProvider>,
    );
  });
  // The first reads, then the auto-claim they may lead to, then its read-back.
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

const button = (name: RegExp, within: ParentNode = host) =>
  [...within.querySelectorAll('button')].find((b) => name.test(b.textContent ?? '')) as HTMLButtonElement | undefined;
const text = () => (host.textContent ?? '').replace(/\s+/g, ' ');

async function click(b: HTMLButtonElement | undefined) {
  expect(b, 'button').toBeTruthy();
  await act(async () => {
    b!.click();
    await new Promise((r) => setTimeout(r, 0));
  });
}
async function type(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('auto-claim', () => {
  it('claims once, and says so, for an address exactly one school publishes', async () => {
    const api = fake();
    await show(api, 'ana@north.example');
    expect(api.claimSchool).toHaveBeenCalledTimes(1);
    expect(api.claimSchool).toHaveBeenCalledWith('north');
    expect(text()).toContain('You are now at North University');
    expect(text()).toContain('You can leave at any time');
  });

  it('does not claim for an address no school publishes, and offers to ask', async () => {
    const api = fake();
    await show(api, 'ana@gmail.example');
    expect(api.claimSchool).not.toHaveBeenCalled();
    expect(button(/Ask to join North/)).toBeTruthy();
    expect(button(/Ask to join South/)).toBeTruthy();
  });

  it('asks instead of guessing when two schools publish the address', async () => {
    const twin: KnownSchool = { id: 'north-city', name: 'North City', shortName: '', domains: ['north.example'] };
    const api = fake({ knownSchools: async () => [NORTH, twin] });
    await show(api, 'ana@north.example');
    expect(api.claimSchool).not.toHaveBeenCalled();
    expect(button(/Claim North$/)).toBeTruthy();
  });

  it('does not undo a deliberate leave', async () => {
    localStorage.setItem('semester.school.declined:acct-1', '1');
    const api = fake();
    await show(api, 'ana@north.example');
    expect(api.claimSchool).not.toHaveBeenCalled();
  });
});

describe('asking to join', () => {
  it('needs a few words first, and sends them', async () => {
    const api = fake();
    await show(api, 'ana@gmail.example');
    await click(button(/Ask to join North/));
    expect(api.requestMembership).not.toHaveBeenCalled();
    const input = host.querySelector('input') as HTMLInputElement;
    expect(input.getAttribute('aria-invalid')).toBe('true');
    await type(input, 'ECON 1020 with Prof. Lee');
    await click(button(/Ask to join North/));
    expect(api.requestMembership).toHaveBeenCalledWith('north', 'ECON 1020 with Prof. Lee');
    expect(text()).toContain('Nothing changes until they approve it');
  });

  it('shows a waiting request with a way to withdraw it', async () => {
    const api = fake({ myRequests: async () => [{ id: 'r1', schoolId: 'north', status: 'pending', createdAt: '' }] });
    await show(api, 'ana@gmail.example');
    expect(text()).toContain('Waiting for North University');
    await click(button(/Withdraw request to North/));
    expect(api.withdrawRequest).toHaveBeenCalledWith('r1');
  });

  it('says what the server refused, in its words', async () => {
    const api = fake({ requestMembership: async () => ({ ok: false, because: 'you already have three requests waiting' }) });
    await show(api, 'ana@gmail.example');
    await type(host.querySelector('input') as HTMLInputElement, 'a course I take');
    await click(button(/Ask to join South/));
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('three requests waiting');
  });
});

describe('a membership that could not be read', () => {
  it('does not auto-claim, says it could not check, and retries on request', async () => {
    let failing = true;
    const api = fake({ claimedSchool: async () => (failing ? null : '') });
    await show(api, 'ana@north.example');
    expect(api.claimSchool).not.toHaveBeenCalled();
    expect(text()).toContain('could not check which university you are at');
    failing = false;
    await click(button(/^Try again$/));
    // The retry reads an empty claim, which is now a true empty, so the
    // explicit list is back (the automatic claim runs once, on first load).
    expect(text()).not.toContain('could not check which university you are at');
  });

  it('says it could not check the members-only setting rather than that it is off', async () => {
    await show(fake({ schoolEnforced: async () => null }, { claimed: 'north' }), 'ana@north.example');
    expect(text()).toContain('could not check just now whether its course rooms are limited');
    expect(text()).not.toContain('not limited to members yet');
  });
});

describe('being at a university', () => {
  it('says whether its rooms are members-only, without claiming a protection that is off', async () => {
    await show(fake({}, { claimed: 'north' }), 'ana@north.example');
    expect(text()).toContain('not limited to members yet');
    await act(async () => root.unmount());
    root = createRoot(host);
    await show(fake({ schoolEnforced: async () => true }, { claimed: 'north' }), 'ana@north.example');
    expect(text()).toContain('open only to people who have proved they are here');
  });

  it('leaves only after a preview and a confirm, and does not re-claim afterwards', async () => {
    const api = fake({}, { claimed: 'north' });
    await show(api, 'ana@north.example');
    await click(button(/^Leave this university$/));
    expect(api.leaveSchool).not.toHaveBeenCalled();
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain('Nothing you made is deleted');
    expect(dialog.textContent).toContain('You can undo this.');
    expect(dialog.textContent).toContain('Claim this university again from this screen.');
    await click(button(/^Leave$/, dialog));
    expect(api.leaveSchool).toHaveBeenCalledTimes(1);
    expect(autoClaimDeclined('acct-1')).toBe(true);
    expect(api.claimSchool).not.toHaveBeenCalled();
  });

  it('cancel leaves nothing changed', async () => {
    const api = fake({}, { claimed: 'north' });
    await show(api, 'ana@north.example');
    await click(button(/^Leave this university$/));
    await click(button(/^Cancel$/));
    expect(api.leaveSchool).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});

describe('for a university\'s staff', () => {
  const waiting = [{ id: 'w1', handle: 'visitor7', note: 'exchange student in ECON 1020', createdAt: '' }];
  const counts = { enforced: false, members: 12, enrolled: 20, lockedOut: 8, pending: 1 };

  it('shows nothing to somebody who may not decide', async () => {
    await show(fake({}, { claimed: 'north' }), 'ana@north.example');
    expect(text()).not.toContain('For this university');
  });

  it('shows the counts, names who is waiting, and approves only after a confirm', async () => {
    const api = fake({ waitingFor: async () => waiting, readinessOf: async () => counts }, { claimed: 'north' });
    await show(api, 'staff@north.example');
    expect(text()).toContain('8 would lose access');
    expect(text()).toContain('Members-only is off');
    expect(text()).toContain('visitor7');
    expect(text()).toContain('exchange student in ECON 1020');
    await click(button(/^Approve visitor7$/));
    expect(api.decideRequest).not.toHaveBeenCalled();
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain('You can undo this.');
    expect(dialog.textContent).toContain('You can remove them later from this screen.');
    expect(dialog.textContent).toContain('exchange student in ECON 1020');
    await click(button(/^Approve$/, dialog));
    expect(api.decideRequest).toHaveBeenCalledWith('w1', true);
  });

  it('declines without a dialog, and says nothing about switching members-only on', async () => {
    const api = fake({ waitingFor: async () => waiting, readinessOf: async () => counts }, { claimed: 'north' });
    await show(api, 'staff@north.example');
    await click(button(/^Decline visitor7$/));
    expect(api.decideRequest).toHaveBeenCalledWith('w1', false);
    expect(button(/switch|enforce|members-only on/i)).toBeUndefined();
  });
});
