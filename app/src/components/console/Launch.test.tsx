// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { COUNCIL, CURRENT, GATES, SEATS, decide, type LaunchState } from '../../lib/launchreadiness';
import { Launch } from './Launch';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;
beforeEach(() => { host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

const mount = (state?: LaunchState, filter = '') => act(async () => root.render(<Launch filter={filter} state={state} />));
const text = () => host.textContent ?? '';
const rows = (table: number) => [...host.querySelectorAll('table')[table].querySelectorAll('tbody tr')];

/** Everything met, every seat held and signed, nothing open: the one state `decide` answers go to. */
const clean: LaunchState = {
  gates: GATES.map((g) => ({ ...g, status: 'met' as const, gap: undefined, evidence: g.evidence.length ? g.evidence : [{ path: 'docs/x.md', shows: 'something' }] })),
  council: COUNCIL.map((s) => ({ ...s, holder: s.holder ?? 'Role holder' })),
  signoffs: [...SEATS],
  blockers: [],
  acceptances: [],
  on: '2026-10-05',
};
const conditional: LaunchState = {
  ...clean,
  blockers: [{ id: 'B-1', severity: 'P2', summary: 'A slow page' }],
  acceptances: [{ blocker: 'B-1', by: 'founder', reason: 'Fix is scheduled.', disclosure: 'The page can be slow for a few seconds.', expires: '2026-12-01' }],
};

it('lists every gate the model has, with its status in words, and the seats of the council', async () => {
  await mount();
  expect(rows(0)).toHaveLength(GATES.length);
  expect(rows(1)).toHaveLength(COUNCIL.length);
  for (const status of ['Met', 'Partial', 'Unmet']) expect(text(), status).toContain(status);
  const unmet = GATES.filter((g) => g.status === 'unmet');
  for (const g of unmet) expect(text()).toContain(g.gap!.slice(0, 40));
});

it('leads with the date of the record and says it is not a live check', async () => {
  await mount();
  expect(text()).toContain(CURRENT.on);
  expect(text()).toContain('not a live check');
  expect(text()).toContain('nothing on this page can clear one');
});

it('says what decide() says for the recorded state, and how many reasons it has', async () => {
  await mount();
  const v = decide(CURRENT);
  expect(v.verdict).toBe('no-go');
  expect(text()).toContain('No-go');
  expect(text()).toContain(`${v.reasons.length} open reasons`);
  expect(host.querySelector('details summary')?.textContent).toContain(`${v.reasons.length} reasons`);
});

it('says Go only for the state decide() answers go to, not as a fixed word', async () => {
  expect(decide(clean).verdict).toBe('go');
  await mount(clean);
  expect(text()).toContain('Go.');
  expect(text()).not.toContain('No-go');
  expect(text()).toContain(`${GATES.length} of ${GATES.length} gates met`);
});

it('says Go with conditions with the accepted risk, its expiry and what pilot users are told', async () => {
  expect(decide(conditional).verdict).toBe('go-with-conditions');
  await mount(conditional);
  expect(text()).toContain('Go with conditions');
  expect(text()).toContain('2026-12-01');
  expect(text()).toContain('The page can be slow for a few seconds.');
});

const signedColumn = () => rows(1).map((tr) => tr.querySelector('td[data-label="Signed"]')?.textContent);

it('shows a vacant seat and an unsigned one as what they are, and a seat as signed only when it signed', async () => {
  await mount();
  expect(rows(1).some((tr) => tr.querySelector('td[data-label="Held by"]')?.textContent === 'Vacant')).toBe(true);
  expect(signedColumn()).toEqual(COUNCIL.map(() => 'Not signed'));
  await mount(clean);
  expect(signedColumn()).toEqual(COUNCIL.map(() => 'Signed'));
  await mount({ ...clean, signoffs: SEATS.filter((s) => s !== 'security') });
  expect(signedColumn()).toEqual(COUNCIL.map((s) => (s.seat === 'security' ? 'Not signed' : 'Signed')));
});

it('is read-only: nothing that would pretend to clear a gate or sign a seat', async () => {
  await mount();
  expect(host.querySelectorAll('button, input, select, textarea, [role="switch"], [role="checkbox"]')).toHaveLength(0);
});

it('filters gates and seats, and says when nothing matches', async () => {
  const one = GATES[0];
  await mount(undefined, one.id);
  expect(rows(0).length).toBeGreaterThan(0);
  expect(rows(0).length).toBeLessThan(GATES.length);
  await mount(undefined, 'no-such-thing');
  expect(text()).toContain('No gates match.');
  expect(text()).toContain('No seats match.');
});

it('wraps every sentence-length cell in Prose, since the shared table keeps cells on one line and a sentence would overflow the window', async () => {
  await mount();
  const long = [...host.querySelectorAll('td')].filter((td) => (td.textContent ?? '').length > 60);
  expect(long.length).toBeGreaterThan(0);
  for (const td of long) expect(td.querySelector('[data-prose]'), (td.textContent ?? '').slice(0, 40)).not.toBeNull();
});
