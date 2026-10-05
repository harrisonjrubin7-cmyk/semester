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
  thread: Record<string, unknown>[] | ((args?: Record<string, unknown>) => Record<string, unknown>[]);
  calls: { name: string; args?: Record<string, unknown> }[];
  /** Holds the next call to an RPC until the test releases it. */
  gates: Map<string, Promise<void>>;
  errors: Map<string, { message: string }>;
  noticeOutcome: 'on' | 'off' | 'off_with_in_flight';
}
let world: World;

vi.mock('../lib/cloud', () => ({
  cloudConfigured: true,
  cloud: async () => ({
    rpc: async (name: string, args?: Record<string, unknown>) => {
      world.calls.push({ name, args });
      // What the world held when the call was made, not when it returns.
      const tickets = world.tickets;
      const thread = typeof world.thread === 'function' ? world.thread(args) : world.thread;
      const gate = world.gates.get(name);
      if (gate) { world.gates.delete(name); await gate; }
      const error = world.errors.get(name);
      if (error) return { data: null, error };
      if (name === 'my_support_tickets') return { data: tickets, error: null };
      if (name === 'my_support_email_notices') return {
        data: tickets.map((ticket) => ({ ticket_id: ticket.id, enabled: ticket.email_notice_enabled === true })),
        error: null,
      };
      if (name === 'my_support_thread') return { data: thread, error: null };
      if (name === 'open_support_ticket') return { data: 'new-ticket', error: null };
      if (name === 'set_support_email_notice') return { data: world.noticeOutcome, error: null };
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
  world = { tickets: [], thread: [], calls: [], gates: new Map(), errors: new Map(), noticeOutcome: 'on' };
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

/** Hold the next call to `name`; the returned function lets it answer. */
function hold(name: string): () => Promise<void> {
  let release!: () => void;
  world.gates.set(name, new Promise<void>((r) => { release = r; }));
  return async () => { await act(async () => { release(); }); };
}

const ticket = (id: string, subject: string) => ({
  id, category: 'bug', subject, status: 'open', priority: 'normal',
  created_at: '2026-09-27T00:00:00Z', first_response_due: '2026-09-30T00:00:00Z', first_responded_at: null,
  email_notice_enabled: false,
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
    expect(boxes).toHaveLength(7);
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
    expect(sent.args).toEqual({
      want_category: 'how_to', want_subject: 'Sync', want_body: 'My phone and laptop disagree.', want_context: {}, want_email_notice: false,
    });
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

  it('keeps email notices off by default and previews explicit opt-in before sending', async () => {
    await draw();
    await write('Reply notice', 'Tell me when support replies.');
    const emailBox = [...host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].at(-1)!;
    expect(emailBox.checked).toBe(false);
    await click(emailBox);
    await click(button('Check before sending'));
    expect(host.querySelector('dl[aria-label="What will be sent"]')?.textContent).toMatch(/Email noticeOn — generic notice only/);
    await click(button('Send to Semester support'));
    expect(world.calls.find((call) => call.name === 'open_support_ticket')?.args?.want_email_notice).toBe(true);
  });

  it('shows a question and its thread, and lets the student reply or close it', async () => {
    world.tickets = [{
      id: '123e4567-e89b-42d3-a456-426614174000', category: 'bug', subject: 'Drill freezes', status: 'waiting_on_student', priority: 'normal',
      created_at: '2026-09-27T00:00:00Z', first_response_due: '2026-09-30T00:00:00Z', first_responded_at: '2026-09-27T02:00:00Z',
      email_notice_enabled: false,
    }];
    world.thread = [
      { from_side: 'student', body: 'It freezes on card 3.', created_at: '2026-09-27T00:00:00Z' },
      { from_side: 'support', body: 'Which browser?', created_at: '2026-09-27T02:00:00Z' },
    ];
    await draw();
    expect(host.textContent).toContain('Reference SUP-123E-4567-E89B-42D3');
    await click(button('Drill freezes · Support replied — waiting for you'));
    expect(host.textContent).toContain('Semester support · Which browser?');
    await click(button('Close this question'));
    expect(world.calls.find((c) => c.name === 'close_my_ticket')?.args).toEqual({ want_ticket: '123e4567-e89b-42d3-a456-426614174000' });
  });

  it('keeps the saved notice choice visible when the post-write refresh fails', async () => {
    world.tickets = [ticket('t1', 'Notice choice')];
    await draw();
    await click(button('Notice choice · Waiting for Semester support'));
    const noticeBox = host.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    world.errors.set('my_support_tickets', { message: 'Could not refresh questions.' });
    await click(noticeBox);
    expect(noticeBox.checked).toBe(true);
    expect(host.textContent).toContain('Generic email notices are on for this question.');
    expect(host.textContent).toContain('Could not refresh questions.');
    expect(host.textContent).toContain('The saved setting is shown.');
  });

  it('warns when opt-out happens after a notice is already in flight', async () => {
    world.tickets = [{ ...ticket('t1', 'Notice choice'), email_notice_enabled: true }];
    world.noticeOutcome = 'off_with_in_flight';
    await draw();
    await click(button('Notice choice · Waiting for Semester support'));
    const noticeBox = host.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    expect(noticeBox.checked).toBe(true);
    await click(noticeBox);
    expect(host.textContent).toContain('One notice was already being delivered and may still arrive.');
  });

  it('shows the next account none of the last one’s questions, even when the old answer arrives last', async () => {
    world.tickets = [ticket('a1', 'Ada’s private question')];
    const adaAnswers = hold('my_support_tickets');
    await draw({ id: 'ada', email: 'ada@x.example' });
    // Another tab signs Ada out and Ben in, while Ada's list is still coming.
    world.tickets = [ticket('b1', 'Ben’s question')];
    await draw({ id: 'ben', email: 'ben@x.example' });
    expect(host.textContent).toContain('Ben’s question');
    await adaAnswers();
    expect(host.textContent).not.toContain('Ada’s private question');
    expect(host.textContent).toContain('Ben’s question');
  });

  it('clears an opened conversation when the account changes', async () => {
    world.tickets = [ticket('a1', 'Ada’s private question')];
    world.thread = [{ from_side: 'student', body: 'Ada’s words', created_at: '2026-09-27T00:00:00Z' }];
    await draw({ id: 'ada', email: 'ada@x.example' });
    await click(button('Ada’s private question · Waiting for Semester support'));
    expect(host.textContent).toContain('Ada’s words');
    // Ben's list has not arrived yet; until it does, nothing of Ada's shows.
    world.tickets = [];
    const benAnswers = hold('my_support_tickets');
    await draw({ id: 'ben', email: 'ben@x.example' });
    expect(host.textContent).not.toContain('Ada’s words');
    expect(host.textContent).not.toContain('Ada’s private question');
    await benAnswers();
  });

  it('shows the thread of the question last opened, not the one whose answer came last', async () => {
    world.tickets = [ticket('t1', 'First'), ticket('t2', 'Second')];
    world.thread = (args) => [{ from_side: 'student', body: `Thread of ${String(args?.want_ticket)}`, created_at: '2026-09-27T00:00:00Z' }];
    await draw();
    const firstAnswers = hold('my_support_thread');
    await click(button('First · Waiting for Semester support'));
    await click(button('Second · Waiting for Semester support'));
    expect(host.textContent).toContain('Thread of t2');
    await firstAnswers();
    expect(host.textContent).toContain('Thread of t2');
    expect(host.textContent).not.toContain('Thread of t1');
  });
});
