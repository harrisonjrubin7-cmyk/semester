import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REGISTER } from './masterregister';
import { item } from './ops/trustremediation';
import { EVIDENCE } from './trust/evidence-register';

/**
 * The trust packet is assembled from several registers written at different
 * times. This suite makes the facts that can be counted or cited fail closed:
 * a new SQL suite or deployed function directory requires the two narrative
 * documents to move with it, and repository evidence can never be promoted to
 * a target-operation or provider-configuration claim.
 */

const ROOT = join(import.meta.dirname, '../../..');
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');
const GAP = read('docs/SECURITY-GAP-ANALYSIS.md');
const THREAT = read('docs/SECURITY-THREAT-MODEL.md');
const SOC2 = read('docs/trust/SOC2-READINESS.md');
const EVIDENCE_DOC = read('docs/trust/EVIDENCE-REGISTER.md');

const checkSuites = readdirSync(join(ROOT, 'supabase')).filter((name) => name.endsWith('.check.sql')).length;
const deployedFunctions = readdirSync(join(ROOT, 'supabase/functions'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name !== '_shared').length;

describe('the reconciled trust registers', () => {
  it('counts the SQL suites and deployed function directories from this tree', () => {
    expect(checkSuites).toBeGreaterThan(0);
    expect(deployedFunctions).toBeGreaterThan(0);
    expect(GAP).toContain(`runs ${checkSuites}\n  \`*.check.sql\` suites`);
    expect(THREAT).toContain(`all ${deployedFunctions} deployed function directories`);
    expect(THREAT).toContain(`per-feature suites (${checkSuites} \`*.check.sql\`)`);
    expect(THREAT).not.toContain('all thirteen');
  });

  it('records the legal-hold mechanism without claiming a target exercise', () => {
    const hold = EVIDENCE.find((row) => row.id === 'RET-001');
    expect(hold?.status).toBe('defined');
    expect(hold?.holds.map((entry) => entry.path)).toEqual([
      'supabase/migrations/20260930100000_legal_holds.sql',
      'supabase/legal-holds.check.sql',
      'supabase/hold-aware-sweeps.check.sql',
      'supabase/hold-blind-sweeps.check.sql',
      'supabase/hold-gated-sweeps.check.sql',
    ]);
    expect(hold?.produce).toContain('authorized target');
    expect(hold?.produce).toContain('Counsel-owned placement criteria');
    expect(EVIDENCE_DOC).toContain('**RET-001**');
    expect(EVIDENCE_DOC).toContain('repository legal-hold mechanism');
    expect(EVIDENCE_DOC).toContain('no authorized target exercise or operated hold record is filed');
    expect(EVIDENCE_DOC).not.toContain('A legal hold cannot yet be placed');
    expect(EVIDENCE_DOC).not.toContain('no legal hold exists');
  });

  it('cites the risk register and tabletop at their repository evidence ceiling', () => {
    const security = REGISTER.find((row) => row.id === 'SEC-001');
    const incident = REGISTER.find((row) => row.id === 'SEC-007');
    const aiIncident = REGISTER.find((row) => row.id === 'AI-014');
    const paths = (row: typeof security) => row?.evidence.map((entry) => entry.path) ?? [];

    expect(paths(security)).toEqual(expect.arrayContaining([
      'app/src/lib/governance/risk.ts',
      'app/src/lib/governance/risk.test.ts',
      'docs/operating-model/RISK-GOVERNANCE.md',
    ]));
    expect(security?.gap).toContain('no accepted security owner');
    expect(security?.gap).toContain('first minuted quarterly risk review');
    expect(paths(incident)).toContain('docs/evidence/operations/2026-10-03-founder-readiness-tabletop.md');
    expect(paths(aiIncident)).toContain('docs/evidence/operations/2026-10-03-founder-readiness-tabletop.md');
    expect(incident?.gap).toContain('no authorized target or live exercise');
    expect(aiIncident?.gap).toContain('no authorized target incident exercise');

    expect(SOC2).toContain('| CC1-02 | CC1.1 |');
    expect(SOC2).toContain('| Quarterly | 1 | `app/src/lib/governance/risk.ts`, `app/src/lib/governance/risk.test.ts`, `docs/operating-model/RISK-GOVERNANCE.md` |');
    expect(SOC2).toContain('document/repository tabletop');
    expect(SOC2).toContain('authorized target exercise absent');
    expect(SOC2).not.toContain('No risk register exists');
    expect(SOC2).not.toContain('tabletop absent');
  });

  it('keeps repository MFA enforcement separate from production-provider exports', () => {
    const mfa = EVIDENCE.find((row) => row.id === 'SEC-IAM-002');
    expect(mfa?.status).toBe('defined');
    expect(mfa?.holds.map((entry) => entry.path)).toContain('supabase/privileged-mfa.check.sql');
    expect(mfa?.produce).toContain('dated configuration export from each production console and Supabase Auth');
    expect(SOC2).toContain('The product requires aal2 for platform_admin and support_agent');
    expect(SOC2).toContain('dated production Auth, GitHub, Supabase and AI-provider console exports are absent');
  });

  it('closes TR-04 only with this reconciliation guard', () => {
    const remediation = item('TR-04');
    expect(remediation?.finding).toContain(`branch has ${checkSuites}`);
    expect(remediation?.finding).toContain(`where ${deployedFunctions} exist`);
    expect(remediation?.done).toEqual({ proof: 'app/src/lib/trustreconciliation.test.ts', on: '2026-10-27' });
  });
});
