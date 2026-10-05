// @vitest-environment jsdom
/**
 * The academic-record ledger, driven through an injected client. The client
 * is the only fake, and it keeps the trigger's rules — no deciding your own
 * change, an override only for an override holder, an entry naming what it
 * replaced — using the same `inEffect` and `isOverride` the screen reads.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const downloads: { name: string; body: string }[] = [];
vi.mock('../../lib/deliver', () => ({
  download: (p: { name: string; body: string }) => downloads.push({ name: p.name, body: p.body }),
}));

import type { RecordApi } from '../../lib/record/api';
import { inEffect, isOverride, type LedgerEntry, type Proposal, type RecordChange } from '../../lib/record/ledger';
import { RecordLedger } from './RecordLedger';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const REG = 'user-registrar';
const PROF = 'user-prof';
const TODAY = '2027-02-01';

/** A database that keeps the trigger's rules, with `holdsOverride` standing in for record:override. */
function fake(viewer: string, holdsOverride: boolean) {
  const entries: LedgerEntry[] = [];
  const changes: RecordChange[] = [];
  let clock = Date.parse('2026-12-20T00:00:00Z');
  let n = 0;
  const tick = () => new Date((clock += 3_600_000)).toISOString();
  const approve = (c: RecordChange, by: string) => {
    const prior = inEffect(entries, c.kind, c.subject_key, c.effective_on);
    const override = isOverride(entries, c);
    entries.push({
      id: `e${++n}`, tenant_id: 'vu', student_ref: c.student_ref, kind: c.kind, subject_key: c.subject_key, action: c.action, value: c.value,
      previous_value: prior?.value ?? null, previous_entry_id: prior?.id ?? null, effective_on: c.effective_on, reason: c.reason, source: c.source,
      change_id: c.id, proposed_by: c.proposed_by, approved_by: by, override, recorded_at: tick(),
    });
    c.status = 'approved';
    c.decided_by = by;
  };
  const make = (p: Proposal, by: string): RecordChange => {
    const c: RecordChange = { id: `c${++n}0000000`, tenant_id: 'vu', ...p, status: 'proposed', proposed_by: by, proposed_at: tick(), decided_by: null, decided_at: null, decision_note: '' };
    changes.push(c);
    return c;
  };
  // A posted grade and an enrollment, proposed by the professor and approved by the registrar.
  approve(make({ student_ref: 'S100', kind: 'grade', subject_key: 'PSCI 2100 · Fall 2026', action: 'set', value: 'B+', effective_on: '2026-12-18', reason: 'Posted from the final roster.', source: 'faculty' }, PROF), REG);
  approve(make({ student_ref: 'S100', kind: 'enrollment', subject_key: 'ECON 1010 · Spring 2027', action: 'set', value: 'Enrolled', effective_on: '2027-01-10', reason: 'Registered in the first window.', source: 'sis_import' }, PROF), REG);
  // A regrade the professor proposed, waiting.
  make({ student_ref: 'S100', kind: 'grade', subject_key: 'PSCI 2100 · Fall 2026', action: 'set', value: 'A-', effective_on: '2027-01-20', reason: 'Regrade after appeal, minute 14.', source: 'appeal' }, PROF);

  const api = {
    lookup: vi.fn(async (_t: string, ref: string) => ({ entries: entries.filter((e) => e.student_ref === ref), changes: changes.filter((c) => c.student_ref === ref) })),
    pending: vi.fn(async () => changes.filter((c) => c.status === 'proposed')),
    propose: vi.fn(async (_t: string, p: Proposal) => make(p, viewer).id),
    decide: vi.fn(async (id: string, status: 'approved' | 'rejected') => {
      const c = changes.find((x) => x.id === id)!;
      if (c.proposed_by === viewer) throw new Error('The person who proposed a change does not decide it.');
      if (status === 'approved' && isOverride(entries, c) && !holdsOverride) throw new Error('Correcting a grade already on the record is a registrar override.');
      if (status === 'approved') approve(c, viewer);
      else c.status = 'rejected';
    }),
    withdraw: vi.fn(async (id: string) => {
      changes.find((x) => x.id === id)!.status = 'withdrawn';
    }),
  };
  return api as unknown as RecordApi & Record<keyof RecordApi, ReturnType<typeof vi.fn>>;
}

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  downloads.length = 0;
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

type Who = { viewerId: string; propose: boolean; decide: boolean; override: boolean; read: boolean };
const registrar: Who = { viewerId: REG, propose: true, decide: true, override: true, read: true };
const dean: Who = { viewerId: 'user-dean', propose: false, decide: true, override: false, read: true };
const professor: Who = { viewerId: PROF, propose: true, decide: false, override: false, read: false };

async function mount(api: RecordApi, who: Who) {
  await act(async () => {
    root.render(<RecordLedger tenantId="vu" api={api} today={TODAY} {...who} />);
  });
}
const button = (re: RegExp) => [...host.querySelectorAll('button')].find((b) => re.test(b.textContent ?? '')) as HTMLButtonElement | undefined;
async function click(el: HTMLElement | undefined) {
  expect(el, 'control not found').toBeTruthy();
  await act(async () => el!.click());
}
function type(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
}
const field = (re: RegExp, within: ParentNode = host) =>
  [...within.querySelectorAll('label')].find((l) => re.test(l.textContent ?? ''))!.querySelector('input, select, textarea') as HTMLInputElement;
async function openRecord(ref = 'S100') {
  await act(async () => type(field(/Student identifier/), ref));
  await click(button(/Open the record/));
}
const table = () => host.querySelector('table')?.textContent ?? '';

describe('reading a record', () => {
  it('shows the record as it stood on a date, and the history behind a line answers the eight questions', async () => {
    await mount(fake(REG, true), registrar);
    await openRecord();
    expect(table()).toContain('PSCI 2100 · Fall 2026');
    expect(table()).toContain('B+');
    expect(table()).toContain('ECON 1010 · Spring 2027');

    await act(async () => type(field(/As it stood on/), '2026-12-31'));
    expect(table()).not.toContain('ECON 1010');

    await click(button(/^History/));
    const hist = host.querySelector('section[aria-label="History"]')!.textContent!;
    for (const q of ['Who changed it?', 'Why did it change?', 'Who approved it?', 'What was the previous value?', 'Can it be corrected without deleting history?']) expect(hist).toContain(q);
    expect(hist).toContain('Another staff member');
    expect(hist).toContain('You');
    expect(hist).toContain('None — this was the first entry');
    expect(hist).toContain('Faculty grade submission');
  });

  it('exports the record on the chosen date, headed as not an official transcript', async () => {
    await mount(fake(REG, true), registrar);
    await openRecord();
    await click(button(/Export the record on this date/));
    expect(downloads).toHaveLength(1);
    expect(downloads[0].name).toBe(`record-S100-${TODAY}.csv`);
    expect(downloads[0].body.split('\n')[0]).toBe(`Record of,S100,as of,${TODAY},Not an official transcript`);
  });

  it('refuses a malformed identifier before asking the database', async () => {
    const api = fake(REG, true);
    await mount(api, registrar);
    await act(async () => type(field(/Student identifier/), 'S 100; drop'));
    expect(button(/Open the record/)?.disabled).toBe(true);
    expect(api.lookup).not.toHaveBeenCalled();
  });

  it('does not show the record to an account that only proposes', async () => {
    await mount(fake(PROF, false), professor);
    await openRecord();
    expect(host.querySelector('table')).toBeNull();
    expect(host.textContent).toContain('does not read the record itself');
    expect(host.textContent).not.toContain('Waiting for a decision');
  });
});

describe('proposing', () => {
  it('says what is missing, warns of an override, and proposes what was typed', async () => {
    const api = fake(REG, true);
    await mount(api, registrar);
    await openRecord();
    const form = host.querySelector('form[aria-label="Propose a change"]')!;
    type(field(/^About/, form), 'PSCI 2100 · Fall 2026');
    await act(async () => undefined);
    expect(form.textContent).toContain('Give the value');
    expect(form.textContent).toContain('Give the reason');
    expect(form.textContent).toContain('only an approver who holds registrar override can approve it');
    expect((form.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);

    type(field(/^Value/, form), ' A ');
    type(field(/^Effective from/, form), '2027-01-25');
    type(field(/^Reason/, form), 'Registrar correction of a transcription error.');
    await act(async () => undefined);
    await click(form.querySelector('button[type="submit"]') as HTMLButtonElement);
    expect(api.propose).toHaveBeenCalledWith('vu', expect.objectContaining({
      student_ref: 'S100', kind: 'grade', subject_key: 'PSCI 2100 · Fall 2026', action: 'set', value: ' A ', effective_on: '2027-01-25',
    }));
    expect(host.textContent).toContain('Your proposals waiting for a decision');
  });

  it('lets the proposer withdraw their own', async () => {
    const api = fake(PROF, false);
    await mount(api, professor);
    await openRecord();
    await click(button(/^Withdraw$/));
    expect(api.withdraw).toHaveBeenCalledTimes(1);
    expect(host.textContent).not.toContain('Your proposals waiting for a decision');
  });
});

describe('deciding', () => {
  it('offers no Approve on the viewer’s own proposal', async () => {
    const api = fake(PROF, true);
    await mount(api, { ...registrar, viewerId: PROF });
    expect(host.textContent).toContain('You proposed this, so someone else decides it.');
    expect(button(/^Approve$/)).toBeUndefined();
  });

  it('says an override is refused to an approver without it, and shows the database’s refusal', async () => {
    const api = fake('user-dean', false);
    await mount(api, dean);
    expect(host.textContent).toContain('needs registrar override, which your account does not hold');
    await click(button(/^Approve$/));
    expect(host.querySelector('[role="alert"]')?.textContent).toBe('Correcting a grade already on the record is a registrar override.');
  });

  it('approves a change, which then enters the record naming what it replaced', async () => {
    const api = fake(REG, true);
    await mount(api, registrar);
    await click(button(/^Approve$/));
    expect(api.decide).toHaveBeenCalledWith(expect.stringMatching(/^c/), 'approved', '');
    expect(host.textContent).toContain('Nothing is waiting.');
    await openRecord();
    expect(table()).toContain('A-');
    await click(button(/^History \(2\)/));
    const hist = host.querySelector('section[aria-label="History"]')!.textContent!;
    expect(hist).toContain('B+');
    expect(hist).toContain('as a registrar override');
  });
});
