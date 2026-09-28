// @vitest-environment jsdom
/**
 * The private-beta panel as a member, an invitee and everybody else sees it.
 *
 * Faked: `lib/cloud`, answering the beta RPCs from a small world and
 * recording every call with its arguments. Everything else — the mapping in
 * `lib/beta.ts`, the copy, the forms — is the shipping code.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface World {
  invitation: Record<string, unknown>[];
  membership: Record<string, unknown>[];
  issues: Record<string, unknown>[];
  calls: { name: string; args?: Record<string, unknown> }[];
  /** Holds the next call to an RPC until the test releases it. */
  gates: Map<string, Promise<void>>;
  /** Every RPC fails, as it would before the migration is applied. */
  broken?: boolean;
}
let world: World;

vi.mock('../lib/cloud', () => ({
  cloudConfigured: true,
  cloud: async () => ({
    rpc: async (name: string, args?: Record<string, unknown>) => {
      world.calls.push({ name, args });
      if (world.broken) return { data: null, error: { message: 'Could not find the function' } };
      // What the world held when the call was made, not when it returns.
      const membership = world.membership;
      const invitation = world.invitation;
      const gate = world.gates.get(name);
      if (gate) { world.gates.delete(name); await gate; }
      if (name === 'my_beta') return { data: membership, error: null };
      if (name === 'beta_invitation_for_me') return { data: invitation, error: null };
      if (name === 'beta_known_issues_for_me') return { data: world.issues, error: null };
      return { data: null, error: null };
    },
  }),
}));

const { BetaPanel } = await import('./BetaPanel');

const member = (live: boolean) => ({
  program_id: 'fall-pilot', program_name: 'Fall pilot', cohort_kind: 'students', status: 'active', live,
  support_contact: 'beta-help@x.example', joined_at: '2026-09-27T00:00:00Z', flags: [],
});
const account = { id: 'me', email: 'me@x.example' } as never;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  world = { invitation: [], membership: [], issues: [], calls: [], gates: new Map() };
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

async function draw(who: unknown = account, offerInvitations: boolean | undefined = true) {
  await act(async () => {
    root.render(offerInvitations === undefined
      ? <BetaPanel account={who as never} />
      : <BetaPanel account={who as never} offerInvitations={offerInvitations} />);
  });
  await act(async () => { await Promise.resolve(); });
}

function hold(name: string): () => Promise<void> {
  let release!: () => void;
  world.gates.set(name, new Promise<void>((r) => { release = r; }));
  return async () => { await act(async () => { release(); await Promise.resolve(); }); };
}

const button = (label: RegExp) =>
  [...host.querySelectorAll('button')].find((b) => label.test(b.textContent ?? '')) as HTMLButtonElement | undefined;

describe('the private-beta panel', () => {
  it('draws nothing, and asks nothing, when signed out', async () => {
    await draw(null);
    expect(host.textContent).toBe('');
    expect(world.calls).toEqual([]);
  });

  it('draws nothing for an account with no invitation and no membership', async () => {
    await draw();
    expect(world.calls.map((c) => c.name).sort()).toEqual(['beta_invitation_for_me', 'my_beta']);
    expect(host.textContent).toBe('');
  });

  it('states the rules before an invitee joins, and joins only when asked', async () => {
    world.invitation = [{ invitation_id: 'inv-1', program_name: 'Fall pilot', cohort_kind: 'transfer_students', support_contact: 'beta-help@x.example' }];
    await draw();
    expect(host.textContent).toMatch(/invited to Fall pilot/);
    expect(host.textContent).toMatch(/transfer students/);
    expect(host.textContent).toMatch(/Nothing official is sent anywhere/);
    expect(host.textContent).toMatch(/without your name or address/);
    expect(host.textContent).toMatch(/leave at any time/);
    expect(world.calls.some((c) => c.name === 'join_beta')).toBe(false);

    await act(async () => { button(/Join the beta/)!.click(); });
    expect(world.calls.find((c) => c.name === 'join_beta')?.args).toEqual({ want_invitation: 'inv-1' });
  });

  it('shows a member the published known issues, with their workaround', async () => {
    world.membership = [member(true)];
    world.issues = [{ id: 'k1', title: 'Sync can lag', detail: 'Seen twice.', workaround: 'Reload.', status: 'open', updated_at: 'x' }];
    await draw();
    expect(host.textContent).toMatch(/The beta is running/);
    expect(host.querySelector('[aria-label="Known issues"]')?.textContent).toMatch(/Sync can lag.*Open.*Reload\./);
  });

  it('says paused, not running, when the database says the beta is not live', async () => {
    world.membership = [member(false)];
    await draw();
    expect(host.textContent).toMatch(/The beta is paused/);
    expect(host.textContent).not.toMatch(/The beta is running/);
  });

  it('sends feedback as its kind and words, with no screen attached', async () => {
    world.membership = [member(true)];
    await draw();
    const select = host.querySelector('select') as HTMLSelectElement;
    const text = host.querySelector('textarea') as HTMLTextAreaElement;
    await act(async () => {
      select.value = 'accessibility';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
      set.call(text, 'The drill buttons are hard to reach.');
      text.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => { button(/Send feedback/)!.click(); });
    expect(world.calls.find((c) => c.name === 'beta_send_feedback')?.args).toEqual({
      want_kind: 'accessibility', want_body: 'The drill buttons are hard to reach.', want_route: '',
    });
  });

  it('offers the export before leaving, and leaving says what happened to the account', async () => {
    world.membership = [member(true)];
    await draw();
    await act(async () => { button(/Leave the beta…/)!.click(); });
    expect(host.querySelector('a[href="#/export"]')).not.toBeNull();
    const drop = [...host.querySelectorAll('input[type="radio"]')][1] as HTMLInputElement;
    await act(async () => { drop.click(); });
    await act(async () => { button(/Leave the beta now/)!.click(); });
    expect(world.calls.find((c) => c.name === 'leave_beta')?.args).toEqual({ want_reason: '', want_keeps_account: false });
    expect(host.textContent).toMatch(/You have left the beta/);
    expect(host.querySelector('a[href="#/privacy"]')).not.toBeNull();
  });
});

describe('with the beta flag off, which is the documented rollback', () => {
  it('still gives a member the export and the way out', async () => {
    world.membership = [member(true)];
    await draw(account, false);
    expect(button(/Leave the beta…/)).toBeDefined();
    await act(async () => { button(/Leave the beta…/)!.click(); });
    expect(host.querySelector('a[href="#/export"]')).not.toBeNull();
  });

  it('offers no new invitation', async () => {
    world.invitation = [{ invitation_id: 'i1', program_name: 'Fall pilot', cohort_kind: 'students', support_contact: 'x@x.example' }];
    await draw(account, false);
    expect(host.textContent).toBe('');
    expect(button(/Join the beta/)).toBeUndefined();
  });

  it('draws nothing, and no error, before the database has the beta at all', async () => {
    world.broken = true;
    await draw(account, false);
    expect(host.textContent).toBe('');
  });

  it('follows VITE_PRIVATE_BETA when no one says otherwise; unset here, so a member still sees the way out', async () => {
    world.membership = [member(true)];
    world.invitation = [];
    await draw(account, undefined);
    expect(button(/Leave the beta…/)).toBeDefined();
  });
});

describe('when the signed-in account changes under the panel', () => {
  it('shows the next account nothing of the last one’s beta, even when the old answer arrives last', async () => {
    world.membership = [member(true)];
    const aliceAnswers = hold('my_beta');
    await draw({ id: 'alice', email: 'alice@x.example' });
    world.membership = [];
    await draw({ id: 'ben', email: 'ben@x.example' });
    await aliceAnswers();
    await act(async () => { await Promise.resolve(); });
    expect(host.textContent).not.toMatch(/Fall pilot/);
  });

  it('clears what was on screen at once, before the new account’s answer', async () => {
    world.membership = [member(true)];
    await draw({ id: 'alice', email: 'alice@x.example' });
    expect(host.textContent).toMatch(/Fall pilot/);
    world.membership = [];
    const benAnswers = hold('my_beta');
    await draw({ id: 'ben', email: 'ben@x.example' });
    expect(host.textContent).not.toMatch(/Fall pilot/);
    await benAnswers();
  });
});
