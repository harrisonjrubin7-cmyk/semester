// @vitest-environment jsdom
/**
 * The Migration Center, driven through an injected client. The client is the
 * only fake, and it keeps the database's rules by calling the same
 * `gateFailures` the screen reads — so a move the screen offers is one the
 * fake allows, and a refusal comes back in the trigger's own words. The
 * screen, its copy, its gating and the in-browser preview and reconciliation
 * are the shipping code.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refusal, type MigrationApi } from '../../lib/migration/api';
import {
  STAGES, gateFailures, nextStage, passes,
  type FieldMap, type MigrationApproval, type MigrationProject, type MigrationRun, type RunCounts, type Stage,
} from '../../lib/migration/center';
import { MigrationCenter } from './MigrationCenter';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const LEAD = 'user-lead';
const REGISTRAR = 'user-registrar';

function project(over: Partial<MigrationProject> = {}): MigrationProject {
  return {
    id: 'm1', tenant_id: 'vu', name: 'Retire the legacy gradebook', domain: 'lms', source_platform: '', source_version: '',
    data_owner: '', classifications: [], retention: '', historical_cutoff: null, duplicate_rule: null, cutover_date: null,
    rollback_plan: '', archive_location: '', required_approvals: ['data_owner', 'it'], parallel_runs_required: 2,
    stage: 'inventory', stage_entered_at: '2026-10-01T00:00:00.000Z', created_by: LEAD, created_at: '2026-10-01T00:00:00.000Z', ...over,
  };
}

const MAPS: FieldMap[] = [
  { id: 'f1', source_field: 'Student ID', target_field: 'student_ref', transform: 'trim', required: true, is_key: true },
  { id: 'f2', source_field: 'Final Grade', target_field: 'final_grade', transform: 'uppercase', required: true, is_key: false },
];

/** An in-memory database that refuses what the trigger refuses. */
function fake(start: MigrationProject, maps: FieldMap[] = [], approvals: MigrationApproval[] = []) {
  let p = { ...start };
  const runs: MigrationRun[] = [];
  let clock = Date.parse('2026-10-02T00:00:00.000Z');
  const tick = () => new Date((clock += 60_000)).toISOString();
  const api = {
    list: vi.fn(async () => [p]),
    create: vi.fn(async () => 'm2'),
    save: vi.fn(async (_id: string, patch: Partial<MigrationProject>) => {
      p = { ...p, ...patch };
    }),
    move: vi.fn(async (_id: string, to: Stage) => {
      if (to === nextStage(p.stage)) {
        const owed = gateFailures(p, maps, runs, approvals);
        if (owed.length) throw refusal({ message: `This migration cannot move to ${to} yet: ${owed.join(', ')}` }, '');
      }
      p = { ...p, stage: to, stage_entered_at: tick() };
    }),
    maps: vi.fn(async () => maps),
    addMap: vi.fn(async (_p: MigrationProject, m: FieldMap) => {
      maps = [...maps, { ...m, id: `f${maps.length + 1}` }];
    }),
    removeMap: vi.fn(async () => undefined),
    runs: vi.fn(async () => runs),
    recordRun: vi.fn(async (_p: MigrationProject, kind: MigrationRun['kind'], c: RunCounts, sha: string, period: string) => {
      runs.unshift({ ...c, kind, stage: p.stage, period_label: period, sample_sha256: sha, passed: passes(kind, c), recorded_by: LEAD, recorded_at: tick() });
    }),
    approvals: vi.fn(async () => approvals),
    decide: vi.fn(async () => undefined),
  };
  return api as unknown as MigrationApi & Record<keyof MigrationApi, ReturnType<typeof vi.fn>>;
}

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

async function mount(api: MigrationApi, who: { viewerId?: string; manage?: boolean; approve?: boolean } = {}) {
  await act(async () => {
    root.render(<MigrationCenter tenantId="vu" viewerId={who.viewerId ?? LEAD} manage={who.manage ?? true} approve={who.approve ?? false} api={api} />);
  });
}
const button = (re: RegExp) => [...host.querySelectorAll('button')].find((b) => re.test(b.textContent ?? '')) as HTMLButtonElement | undefined;
async function click(el: HTMLElement | undefined) {
  expect(el, 'control not found').toBeTruthy();
  await act(async () => el!.click());
}
function type(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
const field = (label: RegExp) =>
  [...host.querySelectorAll('label')].find((l) => label.test(l.textContent ?? ''))!.querySelector('input, select, textarea') as HTMLInputElement;
async function open(api: MigrationApi, who?: Parameters<typeof mount>[1]) {
  await mount(api, who);
  await click(button(/Retire the legacy gradebook/));
}
async function pick(nth: number, name: string, text: string) {
  const input = host.querySelectorAll('input[type="file"]')[nth] as HTMLInputElement;
  const file = new File([text], name, { type: 'text/csv' });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  await act(async () => {
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  // File.text() resolves on a later turn.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}
const owedText = () => host.querySelector('[role="status"]')?.textContent ?? '';
/** Record, then wait for the write itself: the fingerprint is computed on a later turn than the press. */
async function record(api: { recordRun: ReturnType<typeof vi.fn> }) {
  const before = api.recordRun.mock.calls.length;
  await click(button(/Record these counts/));
  await act(async () => {
    await vi.waitFor(() => expect(api.recordRun.mock.calls.length).toBe(before + 1));
  });
  // And for the reload that follows it.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe('the migration list', () => {
  it('says so when the account can see no migrations, and offers a new one only to a lead', async () => {
    const empty = { ...fake(project()), list: vi.fn(async () => []) } as unknown as MigrationApi;
    await mount(empty);
    expect(host.textContent).toContain('No migrations yet');
    expect(button(/New migration/)).toBeTruthy();
    await act(async () => root.render(<MigrationCenter tenantId="vu" viewerId={REGISTRAR} manage={false} approve api={empty} />));
    expect(button(/New migration/)).toBeUndefined();
  });

  it('lists each migration with its stage out of twelve', async () => {
    await mount(fake(project({ stage: 'validation', source_platform: 'Legacy LMS' })));
    expect(host.textContent).toContain('from Legacy LMS');
    expect(host.textContent).toContain(`7 of ${STAGES.length}: Validation`);
  });

  it('asks only for this school’s migrations', async () => {
    const api = fake(project());
    await mount(api);
    // An account working at several schools reads all of theirs under RLS;
    // this tab is one school's.
    expect(api.list).toHaveBeenCalledWith('vu');
  });
});

describe('one migration', () => {
  it('says what its stage still needs, and offers the move only once nothing is owed', async () => {
    const api = fake(project());
    await open(api);
    expect(host.querySelector('[aria-current="step"]')?.textContent).toContain('Source inventory');
    expect(owedText()).toContain('Name the system being retired.');
    expect(owedText()).toContain('Name the person who owns the data.');
    expect(button(/Move to data classification/)?.disabled).toBe(true);

    type(field(/System being retired/), 'Legacy LMS');
    type(field(/Its version/), '2019.4');
    type(field(/Data owner/), 'Office of the Registrar');
    await click(button(/Save the record/));
    expect(api.save).toHaveBeenCalledWith('m1', expect.objectContaining({ source_platform: 'Legacy LMS', source_version: '2019.4', data_owner: 'Office of the Registrar' }));
    expect(owedText()).toContain('Everything this stage needs is recorded.');
    await click(button(/Move to data classification/));
    expect(api.move).toHaveBeenCalledWith('m1', 'classification');
    expect(host.querySelector('[aria-current="step"]')?.textContent).toContain('Data classification');
  });

  it('shows a refusal from the database in the gate’s own sentences', async () => {
    const api = fake(project({ stage: 'mapping' }));
    api.move.mockImplementationOnce(async () => {
      throw refusal({ message: 'This migration cannot move to cleaning yet: key_field' }, '');
    });
    // The screen would not offer this move; force it through a stale screen by adding a key the database never saw.
    await open({ ...api, maps: vi.fn(async () => MAPS) } as unknown as MigrationApi);
    await click(button(/Move to cleaning rules/));
    expect(host.querySelector('[role="alert"]')?.textContent).toBe('Not ready for cleaning rules: Mark at least one field that identifies a record.');
  });

  it('shows the record read-only, and no move, to an account that only views', async () => {
    await open(fake(project()), { viewerId: 'user-ir', manage: false });
    expect(button(/Move to/)).toBeUndefined();
    expect(button(/Save the record/)).toBeUndefined();
    expect(field(/System being retired/).readOnly).toBe(true);
    expect(host.textContent).not.toContain('Add field');
  });

  it('adds fields while the mapping is open, and says it is fixed after cleaning', async () => {
    const api = fake(project({ stage: 'mapping' }));
    await open(api);
    type(field(/Source field, as the export names it/), 'Student ID');
    type(field(/Semester field/), 'Student_Ref');
    await act(async () => field(/Identifies a record/).click());
    await click(button(/Add field/));
    expect(api.addMap).toHaveBeenCalledWith(expect.anything(), { source_field: 'Student ID', target_field: 'student_ref', transform: 'trim', required: false, is_key: true });

    await act(async () => root.unmount());
    root = createRoot(host);
    await open(fake(project({ stage: 'preview', duplicate_rule: 'reject' }), MAPS));
    expect(host.textContent).toContain('The mapping is fixed once a migration is past cleaning');
    expect(button(/Add field/)).toBeUndefined();
  });
});

describe('the evidence', () => {
  const EXPORT = 'Student ID,Final Grade\n900001,a\n900002,\n900003,b+\n900001,c\n';

  it('previews a sample in the browser and records only its counts and fingerprint', async () => {
    const api = fake(project({ stage: 'preview', duplicate_rule: 'reject' }), MAPS);
    await open(api);
    expect(host.textContent).toContain('The file is read in this browser and goes no further.');
    await pick(0, 'gradebook.csv', EXPORT);
    expect(host.textContent).toContain('4 rows read: 2 mapped cleanly, 2 failed, 1 duplicate.');
    expect(host.textContent).toContain('Row 2, final_grade: required and empty');
    expect(host.querySelector('table[aria-label="First mapped rows"]')?.textContent).toContain('B+');

    await record(api);
    expect(api.recordRun).toHaveBeenCalledTimes(1);
    const [, kind, counts, sha, period] = api.recordRun.mock.calls[0];
    expect(kind).toBe('preview');
    expect(counts).toEqual({ rows_in: 4, rows_ok: 2, rows_failed: 2, rows_missing: 0, rows_extra: 0, rows_differing: 0 });
    expect(sha).toMatch(/^[0-9a-f]{64}$/);
    expect(period).toBe('');
    // Nothing from the file travels: not a key, not a grade, not its name.
    // (The first argument is the migration itself, which the screen already holds.)
    expect(JSON.stringify(api.recordRun.mock.calls.map((c) => c.slice(1)))).not.toMatch(/900001|B\+|gradebook\.csv/);
    expect(host.textContent).toContain('Transformation preview: passed');
  });

  it('refuses a date that could be either order until the lead says which, and offers the choice only for date fields', async () => {
    const DATES: FieldMap[] = [
      { id: 'f1', source_field: 'Student ID', target_field: 'student_ref', transform: 'trim', required: true, is_key: true },
      { id: 'f2', source_field: 'Posted', target_field: 'posted_on', transform: 'date_iso', required: false, is_key: false },
    ];
    const plain = fake(project({ stage: 'preview', duplicate_rule: 'reject' }), MAPS);
    await open(plain);
    expect(host.textContent).not.toContain('Dates written like');
    act(() => root.unmount());
    host.replaceChildren();
    root = createRoot(host);

    const api = fake(project({ stage: 'preview', duplicate_rule: 'reject' }), DATES);
    await open(api);
    await pick(0, 'posted.csv', 'Student ID,Posted\n1,3/7/2026\n2,2026-01-05\n');
    expect(host.textContent).toContain('2 rows read: 1 mapped cleanly, 1 failed');
    expect(host.textContent).toContain('could be day-first or month-first');

    const order = field(/Dates written like/) as unknown as HTMLSelectElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(order, 'day_first');
      order.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(host.textContent).toContain('2 rows read: 2 mapped cleanly, 0 failed');
    expect(host.querySelector('table[aria-label="First mapped rows"]')?.textContent).toContain('2026-07-03');
  });

  it('reconciles the mapped export against Semester’s and names every difference', async () => {
    const api = fake(project({ stage: 'reconciliation', duplicate_rule: 'keep_first' }), MAPS);
    await open(api);
    await pick(0, 'legacy.csv', 'Student ID,Final Grade\n1,A\n2,B\n3,C\n');
    await pick(1, 'semester.csv', 'student_ref,final_grade\n1,A\n2,B+\n4,D\n');
    expect(host.textContent).toContain('2 of 3 records found in Semester; 1 missing, 1 only in Semester, 1 with a different value.');
    expect(host.textContent).toContain('2, final_grade: “B” in the old system, “B+” in Semester');
    expect(host.textContent).toContain('Missing from Semester (first 1 of 1)3');
    expect(host.textContent).toContain('Only in Semester (first 1 of 1)4');
    await record(api);
    expect(api.recordRun.mock.calls[0][2]).toEqual({ rows_in: 3, rows_ok: 1, rows_failed: 0, rows_missing: 1, rows_extra: 1, rows_differing: 1 });
    expect(host.textContent).toContain('Reconciliation: did not pass');
    expect(owedText()).toContain('Record a reconciliation in which every record matched.');
  });

  it('asks a parallel run for its period before recording it', async () => {
    const api = fake(project({ stage: 'parallel_run', duplicate_rule: 'reject' }), MAPS);
    await open(api);
    await pick(0, 'legacy.csv', 'Student ID,Final Grade\n1,A\n');
    await pick(1, 'semester.csv', 'student_ref,final_grade\n1,A\n');
    expect(button(/Record these counts/)?.disabled).toBe(true);
    type(field(/Period/), 'Week 1');
    await record(api);
    expect(api.recordRun.mock.calls[0][4]).toBe('Week 1');
  });
});

describe('cutover approvals', () => {
  const cutover = project({ stage: 'cutover', stage_entered_at: '2026-10-05T00:00:00.000Z' });

  it('lets an approver who did not open the migration decide, in a required area', async () => {
    const api = fake(cutover, MAPS);
    await open(api, { viewerId: REGISTRAR, manage: false, approve: true });
    const area = field(/^Area/) as unknown as HTMLSelectElement;
    expect([...area.options].map((o) => o.value)).toEqual(['data_owner', 'it']);
    await click(button(/^Approve$/));
    expect(api.decide).toHaveBeenCalledWith(expect.anything(), 'data_owner', 'approved', '');
  });

  it('tells the person who opened it that someone else approves', async () => {
    await open(fake(cutover, MAPS), { viewerId: LEAD, manage: true, approve: true });
    expect(host.textContent).toContain('You opened this migration, so its cutover is approved by someone else.');
    expect(button(/^Approve$/)).toBeUndefined();
  });

  it('counts only decisions recorded since the migration entered cutover', async () => {
    const old: MigrationApproval = { area: 'data_owner', decision: 'approved', approver_id: REGISTRAR, note: '', recorded_at: '2026-10-04T00:00:00.000Z' };
    const fresh: MigrationApproval = { area: 'it', decision: 'approved', approver_id: 'user-admin', note: 'IT checked', recorded_at: '2026-10-06T00:00:00.000Z' };
    await open(fake({ ...cutover, cutover_date: '2027-01-04', rollback_plan: 'Re-enable the legacy system.' }, MAPS, [old, fresh]));
    expect(host.textContent).toContain('IT: approved');
    expect(host.textContent).not.toContain('Data owner: approved');
    expect(owedText()).toContain('Collect every required approval.');
  });
});
