// @vitest-environment jsdom
/**
 * Asking Semester support, as the student sees it.
 *
 * Faked: `lib/cloud`, answering the ticket RPCs from a small world and
 * recording every call with its arguments. Everything else — the mapping in
 * `lib/supporttickets.ts`, the copy, the forms — is the shipping code. The
 * rule under test is the one the migration opens with: nothing about the app
 * goes with a question unless the student ticked it, and they see all of it
 * before it goes.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface World {
  tickets: Record<string, unknown>[];
  thread: Record<string, unknown>[];
  calls: { name: string; args?: Record<string, unknown> }[];
}
let world: World;

vi.mock('../lib/cloud', () => ({
  cloudConfigured: true,
  cloud: async () => ({
    rpc: async (name: string, args?: Record<string, unknown>) => {
      world.calls.push({ name, args });
      if (name === 'my_support_tickets') return { data: world.tickets, error: null };
      if (name === 'my_support_thread') return { data: world.thread, error: null };
      if (name === 'open_support_ticket') return { data: 'new-ticket', error: null };
      return { data: null, error: null };
    },
  }),
}));

const { SupportTicketsPanel } = await import('./SupportTicketsPanel');

const account = { id: 'me', email: 'me@x.example' } as never;
const context = {
  app_version: 'build-42', device_class: 'phone', screen: '#/help',
  signed_in: 'yes', sync_state: 'synced', offline: 'no',
};

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  world = { tickets: [], thread: [], calls: [] };
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

async function draw(who: unknown = account) {
  await act(async () => { root.render(<SupportTicketsPanel account={who as never} context={context} />); });
}

const button = (text: string) =>
  [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === text) as HTMLButtonElement;

async function click(el: HTMLElement) {
  await act(async () => { el.click(); });
}

async function type(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function write(subject: string, body: string) {
  await click(button('Ask a question'));
  await type(host.querySelector('input.input') as HTMLInputElement, subject);
  await type(host.querySelector('textarea') as HTMLTextAreaElement, body);
}

describe('asking Semester support', () => {
  it('draws nothing for a signed-out visitor, and calls nothing', async () => {
    await draw(null);
    expect(host.textContent).toBe('');
    expect(world.calls).toEqual([]);
  });

  it('says what support will and will not see before anything is written', async () => {
    await draw();
    expect(host.textContent).toMatch(/without your name or email address/);
    expect(host.textContent).toMatch(/only if you tick them/);
    expect(host.querySelector('a[href="#/support"]')).not.toBeNull();
  });

  it('starts every app detail unticked, with its value shown beside it', async () => {
    await draw();
    await write('Sync', 'My phone and laptop disagree.');
    const boxes = [...host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
    expect(boxes).toHaveLength(6);
    expect(boxes.every((b) => !b.checked)).toBe(true);
    expect(host.textContent).toContain('build-42');
  });

  it('sends no app detail the student did not tick — the preview says None and the call carries {}', async () => {
    await draw();
    await write('Sync', 'My phone and laptop disagree.');
    await click(button('Check before sending'));
    const preview = host.querySelector('dl[aria-label="What will be sent"]')!;
    expect(preview.textContent).toMatch(/App detailsNone/);
    await click(button('Send to Semester support'));
    const sent = world.calls.find((c) => c.name === 'open_support_ticket')!;
    expect(sent.args).toEqual({ want_category: 'how_to', want_subject: 'Sync', want_body: 'My phone and laptop disagree.', want_context: {} });
  });

  it('sends exactly the ticked details, and shows them in the preview first', async () => {
    await draw();
    await write('Offline', 'It will not load on the train.');
    const boxes = [...host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
    await click(boxes[1]); // device_class
    await click(boxes[5]); // offline
    await click(button('Check before sending'));
    const preview = host.querySelector('dl[aria-label="What will be sent"]')!.textContent!;
    expect(preview).toContain('Kind of device: phone');
    expect(preview).toContain('Whether I am offline: no');
    expect(preview).not.toContain('build-42');
    await click(button('Send to Semester support'));
    const sent = world.calls.find((c) => c.name === 'open_support_ticket')!;
    expect(sent.args?.want_context).toEqual({ device_class: 'phone', offline: 'no' });
  });

  it('shows a question and its thread, and lets the student reply or close it', async () => {
    world.tickets = [{
      id: 't1', category: 'bug', subject: 'Drill freezes', status: 'waiting_on_student', priority: 'normal',
      created_at: '2026-09-27T00:00:00Z', first_response_due: '2026-09-30T00:00:00Z', first_responded_at: '2026-09-27T02:00:00Z',
    }];
    world.thread = [
      { from_side: 'student', body: 'It freezes on card 3.', created_at: '2026-09-27T00:00:00Z' },
      { from_side: 'support', body: 'Which browser?', created_at: '2026-09-27T02:00:00Z' },
    ];
    await draw();
    await click(button('Drill freezes · Support replied — waiting for you'));
    expect(host.textContent).toContain('Semester support · Which browser?');
    await click(button('Close this question'));
    expect(world.calls.find((c) => c.name === 'close_my_ticket')?.args).toEqual({ want_ticket: 't1' });
  });
});
