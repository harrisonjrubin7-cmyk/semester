// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { askForHelp, payload, type Draft } from '../lib/help-routes';
import { GetHelp } from './GetHelp';

const mock = vi.hoisted(() => ({ load: vi.fn(), send: vi.fn(), withdraw: vi.fn() }));

vi.mock('../lib/help-routes', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/help-routes')>()),
  loadHelp: mock.load,
  sendHelp: mock.send,
  withdrawHelp: mock.withdraw,
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

const ADVISING = {
  id: 'adv', kind: 'advisor', name: 'Advising Office', officialUrl: 'https://advising.example.edu',
  hours: 'Mon–Fri 9–5', acceptsRequests: true,
};
const ME = { id: 'me', email: 'me@example.edu', via: 'email' } as const;

function type(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}
const radio = (text: string) =>
  [...host.querySelectorAll('label')].find((l) => l.textContent?.includes(text))?.querySelector('input') as HTMLInputElement;
const button = (text: string) =>
  [...host.querySelectorAll('button')].find((b) => b.textContent?.includes(text)) as HTMLButtonElement | undefined;
const sentPreview = () => host.querySelector('dl[data-lines]')?.textContent ?? '';
const identity = () => host.querySelector('dl[data-identity]')?.textContent ?? '';

describe('arriving from the Action Center', () => {
  it('opens on the need with the action filled in, and sends none of it until ticked', async () => {
    mock.load.mockResolvedValue({ destinations: [{ ...ADVISING, id: 'tut', kind: 'tutoring', name: 'Tutoring Center' }], requests: [], name: 'harrison_r' });
    mock.send.mockResolvedValue('req-1');
    askForHelp({ type: 'deadline', title: 'Problem Set 3', dueAt: Date.UTC(2099, 9, 14, 12) }, () => {});
    await act(async () => root.render(<GetHelp account={ME} />));

    expect(radio('Stuck on course material').checked).toBe(true);
    expect(host.textContent).toContain('From your Action Center: Problem Set 3');
    expect(host.textContent).toMatch(/not included until you tick them/);

    const values = [...host.querySelectorAll('input.input')].map((i) => (i as HTMLInputElement).value);
    expect(values).toContain('Problem Set 3');
    // The deadline is shown even though course help does not normally offer it.
    expect(host.textContent).toContain('The deadline');
    expect([...host.querySelectorAll('input[type=checkbox]')].every((c) => !(c as HTMLInputElement).checked)).toBe(true);

    act(() => radio('Tutoring Center').click());
    act(() => type(host.querySelector('textarea')!, 'I am stuck on question 2'));
    expect(sentPreview()).not.toContain('Problem Set 3');

    act(() => button('Review and send')!.click());
    await act(async () => button('Yes, send to Tutoring Center')!.click());
    const [, draft] = mock.send.mock.calls[0] as [string, Draft];
    expect(payload(draft)).toEqual({ question: 'I am stuck on question 2', context: {} });
  });

  it('with nothing handed over, it opens on no need at all', async () => {
    mock.load.mockResolvedValue({ destinations: [], requests: [], name: '' });
    await act(async () => root.render(<GetHelp account={ME} />));
    expect(host.textContent).not.toContain('From your Action Center');
    expect(host.querySelectorAll('input[name=help-need]:checked')).toHaveLength(0);
  });
});

describe('asking a person for help', () => {
  it('signed out, it still helps: a note to take, and nothing is loaded or sent', () => {
    act(() => root.render(<GetHelp account={null} />));
    act(() => radio('Registration or degree requirements').click());
    act(() => type(host.querySelector('textarea')!, 'Which statistics course?'));
    expect(mock.load).not.toHaveBeenCalled();
    expect(button('Review and send')).toBeUndefined();
    expect(button('Copy as a note')?.disabled).toBe(false);
    expect(host.textContent).toContain('Sign in with your university account');
    // Nothing is sent from here, so no identity is listed as sent.
    expect(identity()).toBe('');
  });

  it('sends only the question and the lines the student ticked, after they confirm', async () => {
    mock.load.mockResolvedValue({ destinations: [ADVISING], requests: [], name: 'harrison_r' });
    mock.send.mockResolvedValue('req-1');
    await act(async () => root.render(<GetHelp account={ME} />));

    act(() => radio('Registration or degree requirements').click());
    act(() => radio('Advising Office').click());
    act(() => type(host.querySelector('textarea')!, 'Which statistics course fits?'));

    const inputs = [...host.querySelectorAll('input.input')] as HTMLInputElement[];
    const [requirement, plan] = inputs;
    act(() => type(requirement, 'Statistics before PSY 340'));
    act(() => type(plan, 'Take PSY 340 in spring'));

    // Typed but not ticked: not in the preview.
    expect(sentPreview()).toContain('Which statistics course fits?');
    expect(sentPreview()).not.toContain('Statistics before PSY 340');

    act(() => (host.querySelector('input[aria-label="Include which requirement"]') as HTMLInputElement).click());
    expect(sentPreview()).toContain('Statistics before PSY 340');
    expect(sentPreview()).not.toContain('Take PSY 340 in spring');

    // Who they are is listed, with the real values, before anything is sent.
    expect(identity()).toContain('Your name on Semester');
    expect(identity()).toContain('harrison_r');
    expect(identity()).toContain('Your university email');
    expect(identity()).toContain('me@example.edu');
    expect(identity()).toMatch(/always included/i);

    act(() => button('Review and send')!.click());
    expect(mock.send).not.toHaveBeenCalled();
    await act(async () => button('Yes, send to Advising Office')!.click());

    expect(mock.send).toHaveBeenCalledTimes(1);
    const [destination, draft] = mock.send.mock.calls[0] as [string, Draft];
    expect(destination).toBe('adv');
    expect(payload(draft)).toEqual({
      question: 'Which statistics course fits?',
      context: { requirement: 'Statistics before PSY 340' },
    });
  });

  it('wellbeing offers a crisis line and no way to send anything', async () => {
    mock.load.mockResolvedValue({ destinations: [ADVISING], requests: [] });
    await act(async () => root.render(<GetHelp account={ME} />));
    act(() => radio('Wellbeing or someone to talk to').click());
    expect(host.textContent).toContain('988');
    expect(host.querySelector('textarea')).toBeNull();
    expect(button('Review and send')).toBeUndefined();
  });

  it('shows the student every open, and lets them withdraw and erase', async () => {
    mock.load.mockResolvedValue({
      destinations: [ADVISING],
      requests: [{
        id: 'req-1', destinationId: 'adv', question: 'Which statistics course fits?', context: {},
        status: 'scheduled', reply: 'Tuesday 2pm', createdAt: '2099-01-01T00:00:00Z', opens: 2,
      }],
    });
    mock.withdraw.mockResolvedValue(undefined);
    await act(async () => root.render(<GetHelp account={ME} />));
    expect(host.textContent).toContain('Opened 2 times by the office');
    expect(host.textContent).toContain('Prepare for it: Tuesday 2pm');
    await act(async () => button('Withdraw and erase')!.click());
    expect(mock.withdraw).toHaveBeenCalledWith('req-1');
  });

  it('still offers to erase a request the office has closed', async () => {
    mock.load.mockResolvedValue({
      destinations: [ADVISING],
      requests: [{
        id: 'req-9', destinationId: 'adv', question: 'Old question', context: {},
        status: 'closed', reply: 'Done', createdAt: '2099-01-01T00:00:00Z', opens: 1,
      }],
      name: '',
    });
    mock.withdraw.mockResolvedValue(undefined);
    await act(async () => root.render(<GetHelp account={ME} />));
    await act(async () => button('Withdraw and erase')!.click());
    expect(mock.withdraw).toHaveBeenCalledWith('req-9');
  });
});
