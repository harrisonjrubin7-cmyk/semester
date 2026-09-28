// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HelpInbox } from './HelpInbox';

const mock = vi.hoisted(() => ({ load: vi.fn(), open: vi.fn(), answer: vi.fn() }));

vi.mock('../lib/help-routes', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/help-routes')>()),
  loadInboxes: mock.load,
  openRequest: mock.open,
  answerRequest: mock.answer,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const ME = { id: 'advisor', email: 'advisor@example.edu', via: 'email' } as const;
const INBOX = {
  destination: { id: 'adv', kind: 'advisor', name: 'Advising Office' },
  items: [{ id: 'req-1', status: 'sent', createdAt: '2099-01-01T00:00:00Z', updatedAt: '2099-01-01T00:00:00Z' }],
};
const button = (text: RegExp) =>
  [...host.querySelectorAll('button')].find((b) => text.test(b.textContent ?? '')) as HTMLButtonElement | undefined;

function type(el: HTMLTextAreaElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('the staff help inbox', () => {
  it('draws nothing for an account that answers for no office', async () => {
    mock.load.mockResolvedValue([]);
    await act(async () => root.render(<HelpInbox account={ME} />));
    expect(host.textContent).toBe('');
  });

  it('draws nothing and loads nothing signed out', () => {
    act(() => root.render(<HelpInbox account={null} />));
    expect(host.textContent).toBe('');
    expect(mock.load).not.toHaveBeenCalled();
  });

  it('shows no words until opened, and says the student will see the open', async () => {
    mock.load.mockResolvedValue([INBOX]);
    await act(async () => root.render(<HelpInbox account={ME} />));
    expect(host.textContent).toContain('Advising Office');
    expect(host.textContent).toContain('Sent');
    expect(host.querySelector('dl')).toBeNull();
    expect(button(/student will see this/i)).toBeTruthy();
    expect(mock.open).not.toHaveBeenCalled();
  });

  it('opens, shows exactly what was shared, and schedules with a reply', async () => {
    mock.load.mockResolvedValue([INBOX]);
    mock.open.mockResolvedValue({
      studentName: 'harrison_r',
      studentEmail: 'h.rubin@example.edu',
      question: 'Which statistics course fits?',
      context: { requirement: 'Statistics before PSY 340' },
      status: 'sent',
      reply: '',
      createdAt: '2099-01-01T00:00:00Z',
    });
    mock.answer.mockResolvedValue(undefined);
    await act(async () => root.render(<HelpInbox account={ME} />));
    // Before opening, nobody is named.
    expect(host.textContent).not.toContain('h.rubin@example.edu');
    await act(async () => button(/student will see this/i)!.click());
    expect(host.querySelector('dl')?.textContent).toContain('Fromharrison_r · h.rubin@example.edu');
    expect(host.querySelector('a[href="mailto:h.rubin@example.edu"]')).toBeTruthy();

    expect(mock.open).toHaveBeenCalledWith('req-1');
    const shown = host.querySelector('dl')?.textContent ?? '';
    expect(shown).toContain('Which statistics course fits?');
    expect(shown).toContain('Statistics before PSY 340');
    expect(shown).not.toMatch(/course fits\?.*Your plan/);

    // Every forward move from "sent" is offered; nothing backward.
    expect(button(/^mark as seen$/i)).toBeTruthy();
    expect(button(/^mark as scheduled$/i)).toBeTruthy();
    expect(button(/^close$/i)).toBeTruthy();

    act(() => type(host.querySelector('textarea')!, 'Tuesday 2pm, bring your plan'));
    await act(async () => button(/^mark as scheduled$/i)!.click());
    expect(mock.answer).toHaveBeenCalledWith('req-1', 'sent', 'scheduled', 'Tuesday 2pm, bring your plan');

    // Once scheduled, only closing is left — and the reply just sent is on the card.
    expect(button(/^mark as seen$/i)).toBeUndefined();
    expect(button(/^close$/i)).toBeTruthy();
    expect(host.querySelector('[data-reply]')?.textContent).toBe('Tuesday 2pm, bring your plan');
  });

  it('shows the reply already sent when a request is reopened, and keeps it on a blank answer', async () => {
    mock.load.mockResolvedValue([{ ...INBOX, items: [{ ...INBOX.items[0], status: 'scheduled' }] }]);
    mock.open.mockResolvedValue({
      studentName: 'harrison_r', studentEmail: 'h.rubin@example.edu',
      question: 'Which statistics course fits?', context: {},
      status: 'scheduled', reply: 'Tuesday 2pm, bring your plan', createdAt: '2099-01-01T00:00:00Z',
    });
    mock.answer.mockResolvedValue(undefined);
    await act(async () => root.render(<HelpInbox account={ME} />));
    expect(host.querySelector('[data-reply]')).toBeNull();
    await act(async () => button(/student will see this/i)!.click());

    expect(host.querySelector('[data-reply]')?.textContent).toBe('Tuesday 2pm, bring your plan');
    expect(host.textContent).toContain('Replace your reply');

    await act(async () => button(/^close$/i)!.click());
    expect(mock.answer).toHaveBeenCalledWith('req-1', 'scheduled', 'closed', '');
    expect(host.querySelector('[data-reply]')?.textContent).toBe('Tuesday 2pm, bring your plan');
  });

  describe('the status filter', () => {
    const at = (id: string, status: string) => ({
      id, status, createdAt: '2099-01-01T00:00:00Z', updatedAt: '2099-01-01T00:00:00Z',
    });
    const MIXED = [
      {
        destination: { id: 'adv', kind: 'advisor', name: 'Advising Office' },
        items: [at('s', 'sent'), at('a', 'acknowledged'), at('k', 'scheduled'), at('c', 'closed')],
      },
      { destination: { id: 'reg', kind: 'registrar', name: 'Registrar' }, items: [at('r', 'closed')] },
    ];
    const cards = () => [...host.querySelectorAll('article > strong')].map((e) => e.textContent?.split(' · ')[0]);
    const chip = (name: RegExp) => button(name)!;

    it('starts on Open, the working queue, with a count on every choice', async () => {
      mock.load.mockResolvedValue(MIXED);
      await act(async () => root.render(<HelpInbox account={ME} />));
      expect(chip(/^Open \(3\)$/).getAttribute('aria-pressed')).toBe('true');
      expect(chip(/^New \(1\)$/)).toBeTruthy();
      expect(chip(/^Closed \(2\)$/)).toBeTruthy();
      expect(chip(/^All \(5\)$/)).toBeTruthy();
      expect(cards()).toEqual(['Sent', 'Seen by the office', 'Scheduled']);
      // An office with nothing open says so rather than disappearing.
      expect(host.textContent).toContain('Nothing waiting.');
    });

    it('narrows to new, to closed, and widens to all', async () => {
      mock.load.mockResolvedValue(MIXED);
      await act(async () => root.render(<HelpInbox account={ME} />));
      act(() => chip(/^New/).click());
      expect(cards()).toEqual(['Sent']);
      expect(host.textContent).toContain('Nothing new.');
      act(() => chip(/^Closed/).click());
      expect(cards()).toEqual(['Closed', 'Closed']);
      act(() => chip(/^All/).click());
      expect(cards()).toHaveLength(5);
    });

    it('keeps a request closed under Open on screen, reply and all, until the filter changes', async () => {
      mock.load.mockResolvedValue([{ ...INBOX, items: [{ ...INBOX.items[0], status: 'scheduled' }] }]);
      mock.open.mockResolvedValue({
        studentName: 'harrison_r', studentEmail: 'h.rubin@example.edu',
        question: 'Which statistics course fits?', context: {},
        status: 'scheduled', reply: '', createdAt: '2099-01-01T00:00:00Z',
      });
      mock.answer.mockResolvedValue(undefined);
      await act(async () => root.render(<HelpInbox account={ME} />));
      await act(async () => button(/student will see this/i)!.click());
      act(() => type(host.querySelector('textarea')!, 'All sorted, see you Tuesday'));
      // The database now holds it as closed.
      mock.load.mockResolvedValue([{ ...INBOX, items: [{ ...INBOX.items[0], status: 'closed' }] }]);
      await act(async () => button(/^close$/i)!.click());

      expect(cards()).toEqual(['Closed']);
      expect(host.querySelector('[data-reply]')?.textContent).toBe('All sorted, see you Tuesday');

      // Pressing the chip already chosen changes nothing, so the card stays.
      act(() => chip(/^Open/).click());
      expect(cards()).toEqual(['Closed']);

      act(() => chip(/^New/).click());
      act(() => chip(/^Open/).click());
      expect(cards()).toEqual([]);
      act(() => chip(/^Closed/).click());
      expect(cards()).toEqual(['Closed']);
    });
  });
});

