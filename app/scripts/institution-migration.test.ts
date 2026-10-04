import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DOMAINS } from '../src/lib/migration-assurance/domains';
import { syntheticPair } from '../src/lib/migration-assurance/fixtures';
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
const domain = (id: string) => DOMAINS.find((d) => d.id === id)!;

function writeExtract(id: string, mutate?: (t: Record<string, Record<string, unknown>[]>) => void) {
  const d = domain(id);
  const pair = syntheticPair(d);
  const own = (data: Record<string, readonly unknown[]>) => Object.fromEntries(d.entities.map((e) => [e.name, data[e.name]]));
  const target = own(pair.target) as Record<string, Record<string, unknown>[]>;
  mutate?.(target);
  mkdirSync(join(dir, id), { recursive: true });
  writeFileSync(join(dir, id, 'source.json'), JSON.stringify(own(pair.source)));
  writeFileSync(join(dir, id, 'target.json'), JSON.stringify(target));
  writeFileSync(join(dir, id, 'crosswalk.json'), JSON.stringify(Object.fromEntries(d.entities.map((e) => [e.name, pair.crosswalk[e.name]]))));
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'semester-migration-'));
  tick = 0;
  writeExtract('identity');
  writeExtract('academic_records');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const init = () => cli('init', dir, '--tenant', 'tenant-a', '--wave', 'wave-1', '--domains', 'identity,academic_records', '--actor', 'ana');

describe('init', () => {
  it('opens a ledger and writes the workbook templates the institution fills in', async () => {
    const r = await init();
    expect(r.code).toBe(0);
    for (const f of ['inventory.csv', 'mapping.csv', 'cleansing.csv', 'excluded.csv']) expect(existsSync(join(dir, 'identity', f))).toBe(true);
    expect(readFileSync(join(dir, 'academic_records', 'mapping.csv'), 'utf8')).toContain('needs:scope.migration.academic_records.course_result');
    expect((await init()).text).toContain('already has a ledger');
  });

  it('refuses an unknown domain and a missing flag', async () => {
    expect((await cli('init', dir, '--tenant', 't', '--wave', 'w', '--domains', 'nope', '--actor', 'a')).text).toContain('Unknown domain');
    expect((await cli('init', dir, '--wave', 'w', '--domains', 'identity', '--actor', 'a')).text).toContain('--tenant is required');
  });
});

describe('validate', () => {
  it('passes clean data, files the evidence, and keeps every id out of the reports', async () => {
    await init();
    const r = await cli('validate', dir, 'identity', '--actor', 'ana', '--independent-source-read');
    expect(r).toMatchObject({ code: 0 });
    expect(r.text).toContain('identity: PASS');
    const report = readFileSync(join(dir, 'identity', 'validation-report.json'), 'utf8');
    expect(report).not.toContain('person-0');
    expect(report).not.toContain('example.test');
    expect(readFileSync(join(dir, 'ledger.jsonl'), 'utf8')).not.toContain('person-0');
    expect((await cli('verify', dir)).text).toContain('Ledger intact: 4 entries');
  });

  it('fails a defect the migration introduced, names no value, and queues it', async () => {
    await init();
    writeExtract('identity', (t) => { t.person[0].legal_name = 'Alexandra Q. Student'; });
    const r = await cli('validate', dir, 'identity', '--actor', 'ana', '--independent-source-read');
    expect(r.code).toBe(1);
    expect(r.text).toContain('identity: FAIL');
    expect(r.text).toContain('open exceptions: 1 critical');
    expect(readFileSync(join(dir, 'identity', 'validation-report.json'), 'utf8')).not.toContain('Alexandra');
    expect(JSON.parse(readFileSync(join(dir, 'exceptions.json'), 'utf8'))).toHaveLength(1);
  });

  it('refuses to validate without the attestation that the source was read independently', async () => {
    await init();
    expect((await cli('validate', dir, 'identity', '--actor', 'ana')).text).toContain('--independent-source-read');
  });

  it('reads a referenced entity from the domain that owns it, and says when that domain has no files', async () => {
    await init();
    expect((await cli('validate', dir, 'academic_records', '--actor', 'ana', '--independent-source-read')).code).toBe(0);
    rmSync(join(dir, 'identity', 'source.json'));
    expect((await cli('validate', dir, 'academic_records', '--actor', 'ana', '--independent-source-read')).text).toContain('identity/source.json is missing');
  });

  it('refuses an exclusion with no real reason', async () => {
    await init();
    writeFileSync(join(dir, 'identity', 'excluded.json'), JSON.stringify({ person: { 'person-0': 'old' } }));
    expect((await cli('validate', dir, 'identity', '--actor', 'ana', '--independent-source-read')).text).toContain('needs a reason');
  });
});

describe('the ledger is the only memory', () => {
  it('reports the next stage and what it needs, and will not advance without it', async () => {
    await init();
    const s = await cli('status', dir);
    expect(s.text).toContain('Stage: inventory');
    expect(s.text).toContain('identity: no source_inventory');
    const a = await cli('advance', dir, 'extract', '--actor', 'lead');
    expect(a.code).toBe(1);
    expect(a.text).toContain('extract needs');
  });

  it('refuses to sign what is not there, and a signature does not let a stage skip its evidence', async () => {
    await init();
    expect((await cli('sign', dir, 'data_owner', 'source_inventory', '--actor', 'reg', '--domain', 'identity')).text).toContain('No source_inventory');
    await cli('file', dir, 'source_inventory', '--actor', 'ana', '--domain', 'identity');
    expect((await cli('sign', dir, 'data_owner', 'source_inventory', '--actor', 'reg', '--domain', 'identity')).code).toBe(0);
    expect((await cli('advance', dir, 'extract', '--actor', 'lead')).text).toContain('academic_records: no source_inventory');
  });

  it('opens the gate once the evidence and signatures are in', async () => {
    await init();
    for (const d of ['identity', 'academic_records']) {
      await cli('file', dir, 'source_inventory', '--actor', 'ana', '--domain', d);
      await cli('sign', dir, 'data_owner', 'source_inventory', '--actor', 'reg', '--domain', d);
    }
    expect((await cli('advance', dir, 'extract', '--actor', 'lead')).code).toBe(0);
    expect((await cli('status', dir)).text).toContain('Stage: extract');
  });

  it('detects a ledger edited by hand, and refuses to append to it', async () => {
    await init();
    const path = join(dir, 'ledger.jsonl');
    writeFileSync(path, readFileSync(path, 'utf8').replace('tenant-a', 'tenant-b'));
    const v = await cli('verify', dir);
    expect(v.code).toBe(1);
    expect(v.text).toContain('BROKEN at entry 0');
    expect((await cli('file', dir, 'source_inventory', '--actor', 'ana', '--domain', 'identity')).text).toContain('Nothing was written');
  });

  it('files an unsafe cutover plan on the record and says what is wrong with it', async () => {
    await init();
    const r = await cli('file', dir, 'cutover_plan', '--actor', 'ana', '--body', '{"windowMinutes":120,"rollbackMinutes":300}');
    expect(r.text).toContain('rolling back takes longer than the cutover window');
    expect(r.text).toContain('Filed anyway');
  });
});

describe('exceptions and sealing', () => {
  it('will not let the migration\'s own defect be waived from the command line', async () => {
    await init();
    writeExtract('identity', (t) => { t.person[0].legal_name = 'Changed'; });
    await cli('validate', dir, 'identity', '--actor', 'ana', '--independent-source-read');
    const id = JSON.parse(readFileSync(join(dir, 'exceptions.json'), 'utf8'))[0].id as string;
    const r = await cli('exception', dir, id, 'waive', '--actor', 'ana', '--approved-by', 'reg', '--reason', 'We would like this to go away today please', '--expires', '2026-11-20');
    expect(r.code).toBe(1);
    expect(r.text).toContain('fixed in the mapping');
    expect((await cli('exception', dir, id, 'fix_mapping', '--actor', 'ana')).code).toBe(0);
    // Claimed fixed is not fixed: the next run still finds it and reopens it.
    await cli('validate', dir, 'identity', '--actor', 'ana', '--independent-source-read');
    expect(JSON.parse(readFileSync(join(dir, 'exceptions.json'), 'utf8'))[0].status).toBe('open');
  });

  it('refuses to seal without a counsel-reviewed retention policy', async () => {
    await init();
    const r = await cli('seal', dir, '--retention', join(dir, 'none.json'), '--actor', 'lead');
    expect(r.code).toBe(1);
    expect(r.text).toContain('no retention policy');
    writeFileSync(join(dir, 'retention.json'), JSON.stringify({ permanent_record: 'permanent', program_record: 10, working: 2, counselReviewed: true }));
    expect((await cli('seal', dir, '--retention', join(dir, 'retention.json'), '--actor', 'lead')).code).toBe(0);
    expect(existsSync(join(dir, 'manifest.json'))).toBe(true);
  });
});

describe('arguments', () => {
  it('reads flags, treats the attestation as a switch, and leaves positionals alone', () => {
    expect(parse(['validate', 'd', 'identity', '--actor', 'ana', '--independent-source-read'])).toEqual({ positional: ['validate', 'd', 'identity'], flags: { actor: 'ana', 'independent-source-read': true } });
  });
});
