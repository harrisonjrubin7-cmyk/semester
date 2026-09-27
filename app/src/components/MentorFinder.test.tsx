// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Rosters } from '../lib/mentors';

let rosters: Rosters = { me: null, offers: [], requests: [] };
const calls: string[] = [];

vi.mock('../lib/mentors', async () => {
  const real = await vi.importActual<typeof import('../lib/mentors')>('../lib/mentors');
  return {
    ...real,
    loadRosters: () => Promise.resolve(rosters),
    askMentor: (o: { name: string }, name: string) => { calls.push(`ask ${o.name} as ${name}`); return Promise.resolve(); },
    answerRequest: (id: string, s: string) => { calls.push(`${s} ${id}`); return Promise.resolve(); },
  };
});

const { MentorFinder } = await import('./MentorFinder');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  rosters = { me: null, offers: [], requests: [] };
  calls.length = 0;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const draw = async (interests: string[]) => {
  await act(async () => {
    root.render(<MentorFinder kind="peer" interests={interests} types={['first-year']} fallback={<p>not connected</p>} />);
  });
};
const button = (t: string) => [...host.querySelectorAll('button')].find((b) => b.textContent === t);

it('keeps the fallback until the school has an offer this student can see', async () => {
  rosters = { me: 'me', offers: [], requests: [] };
  await draw(['Research']);
  expect(host.textContent).toBe('not connected');
});

it('proposes only mentors whose topics match what was ticked, and asks under a chosen name', async () => {
  rosters = { me: 'me', requests: [], offers: [
    { kind: 'peer', userId: 'a', cohort: 'c', name: 'Ana', topics: ['Research'] },
    { kind: 'peer', userId: 'b', cohort: 'c', name: 'Ben', topics: ['Campus jobs'] },
  ] };
  await draw(['Research']);
  expect(host.textContent).toContain('Ana');
  expect(host.textContent).not.toContain('Ben');
  const input = host.querySelector('input[aria-label="Name to show a mentor"]') as HTMLInputElement;
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => { set.call(input, 'Alex'); input.dispatchEvent(new Event('input', { bubbles: true })); });
  await act(async () => button('Ask Ana')!.click());
  expect(calls).toEqual(['ask Ana as Alex']);
});

it('lets the person asked accept or decline, and says contact goes through the program', async () => {
  rosters = { me: 'me', offers: [{ kind: 'peer', userId: 'x', cohort: 'c', name: 'Xi', topics: [] }], requests: [
    { id: 'r1', kind: 'peer', requester: 's', recipient: 'me', requesterName: 'Sam', topics: ['Research'], note: '', status: 'pending', createdAt: '' },
    { id: 'r2', kind: 'peer', requester: 'me', recipient: 'x', requesterName: 'Me', topics: [], note: '', status: 'accepted', createdAt: '' },
  ] };
  await draw([]);
  expect(host.textContent).toContain('Sam');
  expect(host.textContent).toContain('no contact details go through Semester');
  await act(async () => button('Accept')!.click());
  expect(calls).toEqual(['accepted r1']);
});

it('keeps an accepted request on the mentor’s screen, with the program handoff', async () => {
  rosters = { me: 'me', offers: [], requests: [
    { id: 'r3', kind: 'peer', requester: 's', recipient: 'me', requesterName: 'Sam', topics: ['Research'], note: '', status: 'accepted', createdAt: '' },
  ] };
  await draw([]);
  expect(host.textContent).toContain('You are mentoring');
  expect(host.textContent).toContain('Sam');
  expect(host.textContent).toContain('no contact details go through Semester');
  expect(button('Accept')).toBeUndefined();
});
