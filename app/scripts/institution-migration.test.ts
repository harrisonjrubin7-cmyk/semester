import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DOMAIN_SPECS } from '../src/lib/migration/domain-specs';
import { syntheticPair } from '../src/lib/migration/fixtures';
import { DEFAULT_ROLLBACK_TRIGGERS } from '../src/lib/migration/rehearsal';
import { parse, run } from './institution-migration.ts';

/*
 * The command line, end to end, against a real directory. It never connects to
 * anything, so a temp directory is the whole environment.
 */
let dir: string;
let lines: string[];
let tick: number;
const io = () => ({ now: () => new Date(Date.parse('2026-11-01T09:00:00Z') + (tick += 60_000)).toISOString(), out: (l: string) => lines.push(l) });
const cli = async (...args: string[]) => { lines = []; const code = await run(args, io()); return { code, text: lines.join('\n') }; };
const spec = (id: string) => DOMAIN_SPECS.find((d) => d.id === id)!;
const ledger = () => readFileSync(join(dir, 'ledger.jsonl'), 'utf8');
const queue = () => JSON.parse(readFileSync(join(dir, 'exceptions.json'), 'utf8')) as { key: string; state: string; origin?: string; severity: string }[];

function writeExtract(id: string, mutate?: (t: Record<string, Record<string, unknown>[]>) => void) {
  const d = spec(id);
  const pair = syntheticPair(d);
  const own = (data: Record<string, readonly unknown[]>) => Object.fromEntries(d.entities.map((e) => [e.name, data[e.name]]));
  const target = own(pair.target) as Record<string, Record<string, unknown>[]>;
  mutate?.(target);
  mkdirSync(join(dir, id), { recursive: true });
  writeFileSync(join(dir, id, 'source.json'), JSON.stringify(own(pair.source)));
  writeFileSync(join(dir, id, 'target.json'), JSON.stringify(target));
  writeFileSync(join(dir, id, 'crosswalk.json'), JSON.stringify(Object.fromEntries(d.entities.map((e) => [e.name, pair.crosswalk[e.name]]))));
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'semester-migration-'));
  tick = 0;
  writeExtract('identity');
  writeExtract('academic_records');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const init = () => cli('init', dir, '--tenant', 'tenant-a', '--wave', 'wave-1', '--domains', 'identity,academic_records', '--retain-until', '2036-01-01', '--actor', 'ana');
const validate = (domain: string) => cli('validate', dir, domain, '--actor', 'ana', '--independent-source-read');

describe('init', () => {
  it('opens a migration directory and writes the workbook templates the institution fills in', async () => {
    const r = await init();
    expect(r.code).toBe(0);
    for (const f of ['inventory.csv', 'mapping.csv', 'cleansing.csv', 'excluded.csv']) expect(existsSync(join(dir, 'identity', f))).toBe(true);
    expect(readFileSync(join(dir, 'academic_records', 'mapping.csv'), 'utf8')).toContain('needs:scope.migration.academic_records.course_result');
    expect((await init()).text).toContain('already a migration directory');
  });

  it('refuses an unknown domain, a missing flag, and a retention date that is not from a records schedule', async () => {
    expect((await cli('init', dir, '--tenant', 't', '--wave', 'w', '--domains', 'nope', '--retain-until', '2036-01-01', '--actor', 'a')).text).toContain('Unknown domain');
    expect((await cli('init', dir, '--wave', 'w', '--domains', 'identity', '--retain-until', '2036-01-01', '--actor', 'a')).text).toContain('--tenant is required');
    expect((await cli('init', dir, '--tenant', 't', '--wave', 'w', '--domains', 'identity', '--actor', 'a')).text).toContain('--retain-until is required');
    expect((await cli('init', dir, '--tenant', 't', '--wave', 'w', '--domains', 'identity', '--retain-until', 'someday', '--actor', 'a')).text).toContain('records schedule');
  });
});

describe('validate', () => {
  it('passes a domain the engine can fully evidence, files it, and keeps every id out of what it writes', async () => {
    await init();
    const r = await validate('academic_records');
    expect(r.code).toBe(0);
    expect(r.text).toContain('academic_records: PASS');
    for (const text of [readFileSync(join(dir, 'academic_records', 'check-run.json'), 'utf8'), ledger()]) {
      expect(text).not.toContain('student_record-0');
      expect(text).not.toContain('example.test');
    }
    expect((await cli('verify', dir)).text).toContain('Ledger intact: 2 entries');
  });

  it('prints the counts to record in the Migration Center, in a form its own pass rule cannot misread', async () => {
    await init();
    const r = await validate('academic_records');
    expect(r.text).toContain('record in the Migration Center as validation: {"rows_in"');
    expect(r.text).toContain('record in the Migration Center as reconciliation');
  });

  it('holds a domain for the evidence only outside the extracts can supply, and passes it when that arrives', async () => {
    await init();
    const held = await validate('identity');
    expect(held.code).toBe(1);
    expect(held.text).toContain('missing_evidence_class: outcome');
    writeFileSync(join(dir, 'identity', 'external-checks.json'), JSON.stringify([{ id: 'identity.outcome.sign_in_resolution', domain: 'identity', evidenceClass: 'outcome', severity: 'critical', examined: 40, failures: [] }]));
    expect((await validate('identity')).code).toBe(0);
  });

  it('refuses external results for another domain, or that shadow a check the engine runs', async () => {
    await init();
    const base = { evidenceClass: 'outcome', severity: 'critical', examined: 1, failures: [] };
    writeFileSync(join(dir, 'identity', 'external-checks.json'), JSON.stringify([{ ...base, id: 'finance.x', domain: 'finance' }]));
    expect((await validate('identity')).text).toContain('is for finance, not identity');
    writeFileSync(join(dir, 'identity', 'external-checks.json'), JSON.stringify([{ ...base, id: 'identity.person.crosswalk', domain: 'identity' }]));
    expect((await validate('identity')).text).toContain('already a check the engine runs');
  });

  it('fails a defect the migration introduced, attributes it, names no value, and queues it', async () => {
    await init();
    writeExtract('identity', (t) => { t.person[0].legal_name = 'Alexandra Q. Student'; });
    const r = await validate('identity');
    expect(r.code).toBe(1);
    expect(r.text).toContain('critical_failure');
    expect(readFileSync(join(dir, 'identity', 'check-run.json'), 'utf8')).not.toContain('Alexandra');
    expect(queue().map((q) => [q.origin, q.severity, q.state])).toEqual([['migration', 'critical', 'open']]);
  });

  it('refuses to validate without the attestation that the source was read independently', async () => {
    await init();
    expect((await cli('validate', dir, 'identity', '--actor', 'ana')).text).toContain('--independent-source-read');
  });

  it('reads a referenced entity from the domain that owns it, and says when that domain has no files', async () => {
    await init();
    rmSync(join(dir, 'identity', 'source.json'));
    expect((await validate('academic_records')).text).toContain('identity/source.json is missing');
  });

  it('refuses an exclusion with no real reason', async () => {
    await init();
    writeFileSync(join(dir, 'identity', 'excluded.json'), JSON.stringify({ person: { 'person-0': 'old' } }));
    expect((await validate('identity')).text).toContain('needs a reason');
  });
});

describe('the exception queue, and a fix proven by the next run', () => {
  async function withDefect() {
    await init();
    writeExtract('identity', (t) => { t.person[0].legal_name = 'Changed'; });
    await validate('identity');
    return queue()[0].key;
  }

  it('will not let the migration\'s own defect be waived or descoped from the command line', async () => {
    const key = await withDefect();
    await cli('exception', dir, key.slice(0, 24), 'triage', '--owner', 'engineer', '--actor', 'lead');
    for (const act of ['waive', 'descope']) {
      const r = await cli('exception', dir, key.slice(0, 24), act, '--approver', 'registrar', '--reason', 'We would like this to go away today', '--expires', '2027-01-01', '--actor', 'lead');
      expect(r.code).toBe(1);
      // A critical defect is refused for being critical; the origin rule is pinned at lower severity in exceptions.test.ts.
      expect(r.text).toMatch(/critical exception cannot be waived|introduced/);
    }
  });

  it('walks triage and resolve, and a claimed fix is not a fix until the check stops failing', async () => {
    const key = await withDefect();
    expect((await cli('exception', dir, key.slice(0, 24), 'triage', '--owner', 'engineer', '--actor', 'lead')).code).toBe(0);
    expect((await cli('exception', dir, key.slice(0, 24), 'resolve', '--note', 'corrected the name mapping', '--actor', 'engineer')).code).toBe(0);
    expect(queue()[0].state).toBe('resolved');
    await validate('identity'); // still wrong
    expect(queue()[0].state).toBe('triaged');
    await cli('exception', dir, key.slice(0, 24), 'resolve', '--note', 'corrected it properly', '--actor', 'engineer');
    writeExtract('identity'); // actually fixed
    await validate('identity');
    expect(queue()[0].state).toBe('verified');
  });

  it('lists the queue, and asks for more of a key that is ambiguous or unknown', async () => {
    await withDefect();
    expect((await cli('queue', dir)).text).toContain('1 exception.');
    expect((await cli('exception', dir, 'nope', 'triage', '--owner', 'x', '--actor', 'lead')).text).toContain('No exception starts with');
  });
});

describe('the ledger', () => {
  it('detects a ledger edited by hand, and refuses to append to it', async () => {
    await init();
    await validate('academic_records');
    writeFileSync(join(dir, 'ledger.jsonl'), ledger().replace('gate passed', 'gate edited'));
    const v = await cli('verify', dir);
    expect(v.code).toBe(1);
    expect(v.text).toContain('BROKEN at entry 1');
    expect((await validate('academic_records')).text).toContain('Nothing was written');
  });
});

describe('sign-off', () => {
  it('opens a gate only for the right people, none of whom prepared the evidence', async () => {
    await init();
    await validate('identity');
    const sign = (role: string, who: string) => cli('sign', dir, 'mapping_approved', 'identity', role, '--actor', who, '--decision', 'approve');
    await sign('it', 'it-lead');
    await sign('semester_reviewer', 'ana'); // she prepared the evidence
    const closed = await cli('signoffs', dir, 'mapping_approved', 'identity');
    expect(closed.code).toBe(1);
    expect(closed.text).toContain('semester_reviewer: preparer_signed');
    await sign('semester_reviewer', 'reviewer');
    expect((await cli('signoffs', dir, 'mapping_approved', 'identity')).code).toBe(0);
  });

  it('goes stale when new evidence is filed after the signatures', async () => {
    await init();
    await validate('identity');
    await cli('sign', dir, 'mapping_approved', 'identity', 'it', '--actor', 'it-lead', '--decision', 'approve');
    await cli('sign', dir, 'mapping_approved', 'identity', 'semester_reviewer', '--actor', 'reviewer', '--decision', 'approve');
    expect((await cli('signoffs', dir, 'mapping_approved', 'identity')).code).toBe(0);
    await validate('identity');
    expect((await cli('signoffs', dir, 'mapping_approved', 'identity')).text).toContain('it: stale');
  });

  it('refuses an unknown gate or decision', async () => {
    await init();
    expect((await cli('sign', dir, 'nope', 'identity', 'it', '--actor', 'a', '--decision', 'approve')).text).toContain('Unknown gate');
    expect((await cli('sign', dir, 'mapping_approved', 'identity', 'it', '--actor', 'a', '--decision', 'maybe')).text).toContain('approve or reject');
  });
});

describe('the cutover plan', () => {
  const plan = { windowMinutes: 360, rollbackMinutes: 120, rollbackWindowHours: 96, snapshotRef: 'snap-1', triggers: DEFAULT_ROLLBACK_TRIGGERS, decisionOwner: 'registrar', freezeStart: '2026-12-05T00:00:00Z', freezeEnd: '2026-12-05T06:00:00Z', incumbentReadOnlyUntil: '2026-12-20T00:00:00Z', commsApproved: true, supportStaffed: true };

  it('says a sound plan has no problems, and names the unsafe ones', async () => {
    writeFileSync(join(dir, 'plan.json'), JSON.stringify(plan));
    expect((await cli('plan', join(dir, 'plan.json'))).code).toBe(0);
    writeFileSync(join(dir, 'plan.json'), JSON.stringify({ ...plan, snapshotRef: '', rollbackWindowHours: 10 }));
    const r = await cli('plan', join(dir, 'plan.json'));
    expect(r.code).toBe(1);
    expect(r.text).toContain('no_snapshot');
    expect(r.text).toContain('rollback_window_short');
  });
});

describe('arguments', () => {
  it('reads flags, treats the attestation as a switch, and leaves positionals alone', () => {
    expect(parse(['validate', 'd', 'identity', '--actor', 'ana', '--independent-source-read'])).toEqual({ positional: ['validate', 'd', 'identity'], flags: { actor: 'ana', 'independent-source-read': true } });
  });
});
