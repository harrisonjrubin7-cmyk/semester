import { test, eq } from './harness';
import { existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { CAPABILITIES, FIRST_PATH, stageOf, problems, DOMAINS, domainStatus, domainProblems, sharedFiles, OWNER_STAGES, type Capability, type Domain } from '../src/lib/replacementRegister';
import { CONNECTIONS } from '../src/lib/connectionRegister';

let base = resolve('.');
while (!existsSync(join(base, 'apps', 'semester', 'src', 'lib')) && dirname(base) !== base) base = dirname(base);

test('the register has no unsupported claims', () => { eq(problems(CAPABILITIES), []); });
test('nothing is marked institution-authorized or production-enabled without an owner approval', () => {
  eq(CAPABILITIES.filter((c) => c.evidence.some((e) => OWNER_STAGES.includes(e.stage))).map((c) => c.id), []);
});
test('the §16 first path is fully listed and every link names its open gaps or evidence', () => {
  const ids = new Set(CAPABILITIES.map((c) => c.id));
  eq(FIRST_PATH.every((id) => ids.has(id)), true);
  eq(FIRST_PATH.map((id) => stageOf(CAPABILITIES.find((c) => c.id === id)!)), ['tested', 'tested', 'tested', 'tested', 'tested', 'tested']);
});
test('stages cannot be skipped and evidence cannot be blank (control)', () => {
  const bad: Capability = { id: 'x', area: 'SIS', name: 'x', spec: '', route: null, evidence: [{ stage: 'designed', ref: 'd' }, { stage: 'deployed', ref: 'build 1' }, { stage: 'production_enabled', ref: 'yes' }], gaps: [] };
  eq(stageOf(bad), 'designed');
  eq(problems([bad]), ['x: deployed claimed without tested', 'x: production_enabled claimed without institution_authorized', 'x: production_enabled needs an owner approval reference (APPROVAL:…)']);
});

// S-91 university domain register
const S91 = ['sis', 'curriculum', 'degree', 'scheduling', 'lms', 'assessment', 'continuing', 'graduate', 'dual', 'materials',
  'admissions', 'advising', 'tutoring', 'accessibility', 'housing', 'dining', 'organizations', 'career', 'advancement', 'family',
  'finance', 'hr', 'procurement', 'expenses', 'aid', 'research', 'ethics', 'corelabs', 'facultyaffairs', 'ir',
  'library', 'repository', 'facilities', 'space', 'transport', 'access', 'safety', 'conduct', 'international', 'athletics', 'itsm', 'cms', 'iam', 'clinical'];
test('every S-91 §3 domain is present once, in order, plus clinical on hold', () => {
  eq(DOMAINS.map((d) => d.id), S91);
  eq(DOMAINS.filter((d) => d.onHold).map((d) => d.id), ['clinical']);
  eq(domainStatus(DOMAINS.find((d) => d.id === 'clinical')!), 'on hold');
});
test('the domain register has no unsupported claims, unknown links or unowned rows', () => {
  eq(domainProblems(DOMAINS, CAPABILITIES, CONNECTIONS.map((c) => c.id)), []);
});
test('no domain claims an owner stage, and none is marked deployed', () => {
  eq(DOMAINS.filter((d) => d.evidence.some((e) => e.stage === 'deployed' || OWNER_STAGES.includes(e.stage))).map((d) => d.id), []);
});
test('no migration is owned by two domains', () => { eq(sharedFiles(DOMAINS), []); });
test('every cited code file and every tested-evidence file exists', () => {
  const missing: string[] = [];
  for (const d of DOMAINS) {
    for (const f of d.files) if (!existsSync(join(base, f))) missing.push(`${d.id} ${f}`);
    for (const e of d.evidence.filter((x) => x.stage === 'tested')) {
      let dir = '';
      for (const tok of e.ref.match(/[\w./-]+\.ts\b/g) ?? []) {
        const p = tok.includes('/') ? tok : dir + tok; if (tok.includes('/')) dir = tok.slice(0, tok.lastIndexOf('/') + 1);
        if (!existsSync(join(base, p))) missing.push(`${d.id} ${p}`);
      }
    }
  }
  eq(missing, []);
});
test('the domain guards catch overclaims (control)', () => {
  const bad: Domain = { ...DOMAINS[0], id: 'x', files: [], evidence: [{ stage: 'designed', ref: 'd' }, { stage: 'implemented', ref: 'i' }, { stage: 'operationally_supported', ref: 'yes' }], capabilities: ['nope'], connections: ['C99'] };
  eq(domainProblems([bad], CAPABILITIES, ['C01']), ['x: operationally_supported claimed without production_enabled',
    'x: operationally_supported needs an owner approval reference (APPROVAL:…)', 'x: implemented needs code files', 'x: unknown capability nope', 'x: unknown connection C99']);
  const dup = [{ ...DOMAINS[0] }, { ...DOMAINS[1], files: [DOMAINS[0].files.find((f) => f.endsWith('Migration.ts'))!] }];
  eq(sharedFiles(dup).length, 1);
  eq(domainStatus({ ...DOMAINS[0], evidence: [] }), 'not started');
});
