/// <reference types="node" />
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import admissionsFixtures from './fixtures.json';
import aidFixtures from '../aid/fixtures.json';
import { ADMISSION_STATUSES, DECISIONS, capabilityFor, forwardFrom, isAdmissionStatus, statusLegal, textProblem, textRefused } from './rules';
import { LIMITS } from './model';
import { LIMITS as AID_LIMITS } from '../aid/model';
import {
  AID_STATUSES,
  AWARD_TYPES,
  DEFAULT_HIGH_VALUE_CENTS,
  approvalProblem,
  disbursementAfter,
  isHigh,
  recordableFrom,
  statusLegal as aidLegal,
} from '../aid/rules';

/**
 * The admissions and aid records' rules, held to their SQL twins, and the things
 * this slice promises it never does, held to the source.
 *
 *   * every case in the two fixtures files, which `supabase/admissions-aid.check.sql`
 *     also runs through the SQL functions;
 *   * every closed list, limit and capability repeated in TypeScript, equal to
 *     the migration's;
 *   * the migration, the library and the screens never use a word that would
 *     make an order of applicants a ranking, or a number about one a score;
 *   * nothing in the library or the migration writes to the student-accounts
 *     ledger, and no table can hold federal or tax data.
 */

const ROOT = join(__dirname, '..', '..', '..', '..');
const SQL = readFileSync(join(ROOT, 'supabase', 'migrations', '20260930270000_admissions_aid.sql'), 'utf8');
const SRC = join(ROOT, 'app', 'src');

/** The code and the strings of a file, without its comments: comments may say what the code never does. */
function withoutComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}
function sqlWithoutComments(src: string): string {
  return src.replace(/--.*$/gm, '');
}

describe('the admissions rules, held to the shared fixtures', () => {
  it('has every status pair as the fixture says', () => {
    expect(ADMISSION_STATUSES).toEqual(admissionsFixtures.statuses);
    let pairs = 0;
    for (const from of admissionsFixtures.statuses) {
      for (const to of admissionsFixtures.statuses) {
        const want = (admissionsFixtures.forward as Record<string, string[]>)[from].includes(to);
        expect(statusLegal(from as never, to as never), `${from} -> ${to}`).toBe(want);
        pairs += 1;
      }
    }
    expect(pairs).toBe(49);
  });

  it('can tell a legal step from an illegal one (control)', () => {
    expect(statusLegal('in_review', 'admitted')).toBe(true);
    expect(statusLegal('admitted', 'in_review')).toBe(false);
    expect(statusLegal('submitted', 'admitted')).toBe(false);
    expect(statusLegal('denied', 'admitted')).toBe(false);
  });

  it('never moves backwards: no step goes to an earlier status', () => {
    const ORDER = ['submitted', 'in_review', 'waitlisted', 'admitted', 'enrolled'];
    for (const from of ADMISSION_STATUSES) {
      for (const to of forwardFrom(from)) {
        if (ORDER.includes(from) && ORDER.includes(to)) expect(ORDER.indexOf(to), `${from} -> ${to}`).toBeGreaterThan(ORDER.indexOf(from));
      }
    }
  });

  it('names the decisions as the fixture does, and asks the decide capability of exactly those', () => {
    expect(DECISIONS).toEqual(admissionsFixtures.decisions);
    for (const s of ADMISSION_STATUSES) expect(capabilityFor(s), s).toBe(DECISIONS.includes(s) ? 'admissions:decide' : 'admissions:record');
  });

  it('refuses a card and an SSN-shaped run, as every text case says', () => {
    for (const c of admissionsFixtures.text) {
      expect(textRefused(c.text), `${c.name}: "${c.text}"`).toBe(c.refused);
    }
    expect(textProblem('That reason', '123-45-6789')).toMatch(/social security/);
    expect(textProblem('That reason', '4111 1111 1111 1111')).toMatch(/card number/);
    expect(textProblem('That reason', 'Received through the portal')).toBeNull();
  });

  it('is a net for the SSN shape and not for a longer run', () => {
    expect(textRefused('1234567890')).toBeNull();
    expect(textRefused('ref 123456789.')).toBe('ssn');
  });
});

describe('the aid rules, held to the shared fixtures', () => {
  it('has every status pair as the fixture says', () => {
    expect(AID_STATUSES).toEqual(aidFixtures.statuses);
    let pairs = 0;
    for (const from of aidFixtures.statuses) {
      for (const to of aidFixtures.statuses) {
        const want = (aidFixtures.forward as Record<string, string[]>)[from].includes(to);
        expect(aidLegal(from as never, to as never), `${from} -> ${to}`).toBe(want);
        pairs += 1;
      }
    }
    expect(pairs).toBe(25);
  });

  it('puts disbursed out of reach of a hand: it is reached by recording disbursements', () => {
    expect(recordableFrom('accepted')).toEqual(['declined', 'cancelled']);
    expect(recordableFrom('offered')).toEqual(['accepted', 'declined', 'cancelled']);
    expect(recordableFrom('disbursed')).toEqual([]);
  });

  it('calls an award high at or above the threshold, and at D-146’s default when the school set none', () => {
    for (const c of aidFixtures.high) expect(isHigh(c.amount, c.threshold), c.name).toBe(c.high);
    expect(DEFAULT_HIGH_VALUE_CENTS).toBe(100000);
  });

  it('says why a second person is refused, in the fixture’s order', () => {
    for (const c of aidFixtures.approval) expect(approvalProblem(c.high, c.recorder, c.approver, c.holds), c.name).toBe(c.problem);
  });

  it('never lets the person who recorded an award approve it (control: a different person may)', () => {
    expect(approvalProblem(true, 'u1', 'u1', true)).toBe('same_person');
    expect(approvalProblem(true, 'u1', 'u2', true)).toBeNull();
  });

  it('says what one more disbursement does to an award', () => {
    for (const c of aidFixtures.disbursement) expect(disbursementAfter(c.award, c.soFar, c.add), c.name).toBe(c.after);
  });
});

describe('the library repeats the migration, never allows more', () => {
  it('has the same admissions statuses in the table and the type', () => {
    for (const s of ADMISSION_STATUSES) expect(SQL, s).toContain(`'${s}'`);
    expect(isAdmissionStatus('accepted')).toBe(false);
    const listed = [...SQL.matchAll(/status\s+text\s+not null default 'submitted' check \(status in \(([^)]*)\)/g)][0][1];
    expect([...listed.matchAll(/'([a-z_]+)'/g)].map((m) => m[1])).toEqual([...ADMISSION_STATUSES]);
  });

  it('has the same aid statuses and award types in the table and the type', () => {
    const status = [...SQL.matchAll(/status\s+text\s+not null default 'offered' check \(status in \(([^)]*)\)/g)][0][1];
    expect([...status.matchAll(/'([a-z_]+)'/g)].map((m) => m[1])).toEqual([...AID_STATUSES]);
    const types = [...SQL.matchAll(/award_type\s+text\s+not null check \(award_type in \(([^)]*)\)/g)][0][1];
    expect([...types.matchAll(/'([a-z_]+)'/g)].map((m) => m[1])).toEqual([...AWARD_TYPES]);
  });

  it('has the limits the forms name', () => {
    expect(SQL).toContain(`{0,${LIMITS.cycle - 1}}`);
    expect(SQL).toContain(`{1,${LIMITS.applicantRef}}`);
    expect(SQL).toContain(`length(btrim(program)) >= 1 and length(btrim(program)) <= ${LIMITS.program}`);
    expect(SQL).toContain(`length(btrim(reason)) >= ${LIMITS.reasonMin} and length(btrim(reason)) <= ${LIMITS.reasonMax}`);
    expect(SQL).toContain(`length(btrim(fund_name)) >= 1 and length(btrim(fund_name)) <= ${AID_LIMITS.fundName}`);
    expect(SQL).toContain(`between 1 and ${AID_LIMITS.amountMaxCents}`);
    expect(AID_LIMITS.reasonMin).toBe(LIMITS.reasonMin);
  });

  it('adds six capabilities, and gives them only to roles that already exist', () => {
    const block = /insert into public\.app_capabilities[\s\S]*?on conflict/.exec(SQL)![0];
    const caps = [...block.matchAll(/\('((?:admissions|aid):[a-z_]+)',\s+'/g)].map((m) => m[1]);
    expect(caps.sort()).toEqual(['admissions:decide', 'admissions:read', 'admissions:record', 'aid:approve_high', 'aid:read', 'aid:record']);
    const roles = new Set<string>();
    for (const f of readdirSync(join(ROOT, 'supabase', 'migrations'))) {
      if (f === '20260930270000_admissions_aid.sql') continue;
      for (const m of readFileSync(join(ROOT, 'supabase', 'migrations', f), 'utf8').matchAll(/insert into public\.app_roles[^;]*?values([^;]*);/gis)) {
        for (const r of m[1].matchAll(/\(\s*'([a-z_]+)'/g)) roles.add(r[1]);
      }
    }
    const granted = [...SQL.matchAll(/^\s+\('([a-z_]+)',\s+'((?:admissions|aid):[a-z_]+)'\)/gm)];
    expect(granted.length).toBe(10);
    for (const [, role] of granted) expect(roles.has(role) || role === 'registrar' || role === 'dean', `${role} is an existing role`).toBe(true);
    // No role is created here.
    expect(sqlWithoutComments(SQL)).not.toMatch(/insert into public\.app_roles/);
  });

  it('puts the aid officer apart from the approver: the one who records does not hold the approving capability', () => {
    const rows = [...SQL.matchAll(/^\s+\('([a-z_]+)',\s+'(aid:[a-z_]+)'\)/gm)].map((m) => `${m[1]}|${m[2]}`);
    expect(rows).toContain('financial_aid_officer|aid:record');
    expect(rows).not.toContain('financial_aid_officer|aid:approve_high');
    expect(rows).toContain('business_admin|aid:approve_high');
    expect(rows).not.toContain('business_admin|aid:record');
  });
});

describe('what this slice promises it never does', () => {
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]));
  const OURS = [
    ...files(join(SRC, 'lib', 'admissions')),
    ...files(join(SRC, 'lib', 'aid')),
    ...files(join(SRC, 'components', 'admissions')),
    ...files(join(SRC, 'components', 'aid')),
    join(SRC, 'screens', 'Admissions.tsx'),
    join(SRC, 'screens', 'Aid.tsx'),
  ].filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f));

  // A word that would make a list a ranking, a number a score, or a suggestion a recommendation.
  const BANNED = /\b(score[sd]?|scoring|rank(?:s|ed|ing|ings)?|rating|ratings|recommend(?:s|ed|ation|ations)?|predict(?:s|ed|ion|ions|ive)?|likelihood|likely|probability|yield|propensity|percentile|top\s+applicants?|best\s+applicants?|rubric|match\s+score)\b/i;

  it('shows no score, rank, rating, prediction or recommendation anywhere in the library or the screens', () => {
    expect(OURS.length).toBeGreaterThan(14);
    for (const f of OURS) {
      const code = withoutComments(readFileSync(f, 'utf8'));
      expect(code, f.replace(ROOT, '')).not.toMatch(BANNED);
    }
  });

  it('can tell a banned word from a clean file (control)', () => {
    expect(BANNED.test('the applicant score')).toBe(true);
    expect(BANNED.test('ranked by likelihood')).toBe(true);
    expect(BANNED.test('recommended for admission')).toBe(true);
    expect(BANNED.test('Applicants in the order of the school’s own reference')).toBe(false);
  });

  it('has no score, rank or prediction in any table, column or function of the migration', () => {
    const code = sqlWithoutComments(SQL);
    expect(code).not.toMatch(BANNED);
  });

  it('writes nothing to the student-accounts ledger, and only reads one entry of it', () => {
    const code = sqlWithoutComments(SQL);
    expect(code).not.toMatch(/(insert\s+into|update|delete\s+from)\s+public\.student_account_/i);
    expect([...code.matchAll(/from\s+public\.(student_account_[a-z_]+)/g)].map((m) => m[1])).toEqual(
      expect.arrayContaining(['student_account_entries', 'student_account_settings']),
    );
    for (const f of OURS) {
      expect(withoutComments(readFileSync(f, 'utf8')), f.replace(ROOT, '')).not.toMatch(/student_account_(entries|requests)/);
    }
  });

  it('can tell a ledger write from a ledger read (control)', () => {
    const write = /(insert\s+into|update|delete\s+from)\s+public\.student_account_/i;
    expect(write.test('insert into public.student_account_entries (x) values (1)')).toBe(true);
    expect(write.test('select * from public.student_account_entries e where e.id = 1')).toBe(false);
  });

  it('has no column for federal, tax, citizenship or identity data, and no SSN field', () => {
    const tables = [...SQL.matchAll(/create table if not exists public\.([a-z_]+) \(([\s\S]*?)\n\);/g)];
    expect(tables.length).toBe(8);
    for (const [, name, body] of tables) {
      for (const col of body.split('\n').map((l) => /^\s{2}([a-z_]+)\s/.exec(l)?.[1]).filter(Boolean) as string[]) {
        expect(col, `${name}.${col}`).not.toMatch(/ssn|social|fafsa|isir|tax|citizen|federal|pell|title_iv|income|dob|birth|passport|visa|ethnic|race|disab/i);
      }
    }
  });

  it('refuses a K-12 school in the one function every mutation passes through', () => {
    expect(SQL).toMatch(/s\.edition into ed from public\.schools s where s\.id = school;\s+if ed is distinct from 'higher_ed' then\s+raise exception 'semester: applicant and aid records are held for post-secondary schools only/);
    expect(SQL.match(/private\.adm_aid_require_core\(school, '(admissions|financial_aid)'\)/g)?.length).toBe(9);
  });

  it('gates every mutation on its module: admissions on admissions, aid on financial_aid', () => {
    const fns = [...SQL.matchAll(/create or replace function public\.([a-z_]+)\([\s\S]*?\nend \$\$;/g)];
    expect(fns.map((m) => m[1]).sort()).toEqual([
      'admissions_applicant_add', 'admissions_applicant_link', 'admissions_status_correct', 'admissions_status_record',
      'aid_award_approve', 'aid_award_record', 'aid_disbursement_record', 'aid_status_correct', 'aid_status_record',
    ]);
    for (const [, name, ] of fns) {
      const body = fns.find((m) => m[1] === name)![0];
      const want = name.startsWith('admissions_') ? 'admissions' : 'financial_aid';
      expect(body, name).toContain(`private.adm_aid_require_core(school, '${want}')`);
      expect(body, name).toContain('private.adm_aid_replay');
      expect(body, name).toContain('private.adm_aid_spend');
    }
  });

  it('creates no student, account or academic-record subject from here', () => {
    const code = sqlWithoutComments(SQL);
    expect(code).not.toMatch(/insert\s+into\s+public\.academic_record_subjects/i);
    expect(code).not.toMatch(/insert\s+into\s+auth\./i);
    expect(code).not.toMatch(/insert\s+into\s+public\.(profiles|role_grants)/i);
  });

  it('stays out of anything the gateway imports', () => {
    for (const f of OURS) expect(readFileSync(f, 'utf8'), f.replace(ROOT, '')).not.toMatch(/supabase\/functions/);
  });
});
