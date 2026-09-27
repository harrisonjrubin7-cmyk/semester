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
}
let world: World;

vi.mock('../lib/cloud', () => ({
  cloudConfigured: true,
  cloud: async () => ({
    rpc: async (name: string, args?: Record<string, unknown>) => {
      world.calls.push({ name, args });
      if (name === 'my_beta') return { data: world.membership, error: null };
      if (name === 'beta_invitation_for_me') return { data: world.invitation, error: null };
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
  world = { invitation: [], membership: [], issues: [], calls: [] };
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

async function draw(who: unknown = account) {
  await act(async () => { root.render(<BetaPanel account={who as never} />); });
  await act(async () => { await Promise.resolve(); });
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
