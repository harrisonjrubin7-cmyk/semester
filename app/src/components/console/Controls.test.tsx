// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { CONTROLS, FAMILIES, STATES, type Control } from '../../lib/ops/trustcontrols';
import { Controls } from './Controls';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;
beforeEach(() => { host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

const mount = (filter = '', controls?: readonly Control[]) => act(async () => root.render(<Controls filter={filter} controls={controls} />));
const text = () => host.textContent ?? '';
const rows = () => [...host.querySelectorAll('tbody tr')];
const stateColumn = () => rows().map((tr) => tr.querySelector('td[data-label="State"]')?.textContent);
const WORD = { enforced: 'Enforced', partial: 'Partial', documented: 'Documented only', absent: 'Absent' } as const;

it('lists every control in the register with its own id and state in words', async () => {
  await mount();
  expect(rows()).toHaveLength(CONTROLS.length);
  expect(stateColumn()).toEqual(CONTROLS.map((c) => WORD[c.state]));
  for (const c of CONTROLS) expect(text()).toContain(c.id);
});

it('says the states are claims about the repository, not production, and leads with it', async () => {
  await mount();
  expect(text()).toContain('not about production');
  expect(text()).toContain('does not mean the control is operating');
  expect(text()).toContain('Nothing on this page can change a state');
});

it('counts each state from the register rather than a fixed figure', async () => {
  await mount();
  for (const s of STATES) expect(text()).toContain(`${CONTROLS.filter((c) => c.state === s).length} ${WORD[s].toLowerCase()}`);
  expect(text()).toContain(`across ${FAMILIES.length} families`);
  const flipped = CONTROLS.map((c) => ({ ...c, state: 'absent' as const }));
  await mount('', flipped);
  expect(text()).toContain(`${CONTROLS.length} absent`);
  expect(stateColumn().every((s) => s === 'Absent')).toBe(true);
});

it('shows the files that fail without a control, and "Nothing" when there are none', async () => {
  await mount();
  const withProof = CONTROLS.find((c) => c.proof.length > 0)!;
  expect(text()).toContain(withProof.proof[0]);
  const none = CONTROLS.find((c) => c.proof.length === 0);
  if (none) expect(rows().some((tr) => tr.querySelector('td[data-label="Fails without it"]')?.textContent === 'Nothing')).toBe(true);
});

it('is read-only: nothing that would pretend to change a control', async () => {
  await mount();
  expect(host.querySelectorAll('button, input, select, textarea, [role="switch"], [role="checkbox"]')).toHaveLength(0);
});

it('filters by id, state word or gap text, and says when nothing matches', async () => {
  await mount(CONTROLS[0].id);
  expect(rows()).toHaveLength(1);
  await mount('documented only');
  expect(rows().length).toBe(CONTROLS.filter((c) => c.state === 'documented').length);
  await mount('no-such-control');
  expect(rows()).toHaveLength(0);
  expect(text()).toContain('No controls match.');
});

it('wraps every sentence-length cell in Prose, since the shared table keeps cells on one line', async () => {
  await mount();
  const long = [...host.querySelectorAll('td')].filter((td) => (td.textContent ?? '').length > 60);
  expect(long.length).toBeGreaterThan(0);
  for (const td of long) expect(td.querySelector('[data-prose]'), (td.textContent ?? '').slice(0, 40)).not.toBeNull();
});
