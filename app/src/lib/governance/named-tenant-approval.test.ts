import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cell, controlLine, renderedFrom, table } from '../ops/render';
import { CAPABILITY_DEFINITIONS } from './capability-governance';
import { evaluateL9Readiness, repositoryL4Evidence } from './l9-readiness';
import {
  APPROVERS_BY_CLASS,
  VANDERBILT_L5_DECISIONS,
  VANDERBILT_L5_PACKETS,
  VANDERBILT_TENANT,
  evaluateNamedTenantApproval,
  namedTenantL5Evidence,
  type NamedTenantApprovalPacket,
  type TenantApprovalDecision,
} from './named-tenant-approval';

const root = join(import.meta.dirname, '../../../..');
const DOC = 'docs/vanderbilt/L5-NAMED-TENANT-APPROVAL-REGISTER.md';
const AS_OF = '2026-09-30';
const packet = (kind: NamedTenantApprovalPacket['activationClass']) => VANDERBILT_L5_PACKETS.find((item) => item.activationClass === kind)!;
const decision = (p: NamedTenantApprovalPacket, role: TenantApprovalDecision['role'], overrides: Partial<TenantApprovalDecision> = {}): TenantApprovalDecision => ({
  tenantId: p.tenantId,
  capabilityId: p.capabilityId,
  configurationVersion: p.configurationVersion,
  role,
  subjectRef: `directory://vanderbilt/${role}`,
  decision: 'approved',
  decidedAt: '2026-09-30T12:00:00Z',
  expiresAt: '2026-12-31T23:59:59Z',
  artifactRef: `trust-room://vanderbilt/${p.capabilityId}/${role}`,
  ...overrides,
});
const approve = (p: NamedTenantApprovalPacket) => p.requiredApprovers.map((role) => decision(p, role));

describe('Vanderbilt named-tenant L5 approval', () => {
  it('prepares exactly one pending packet for every stable capability without manufacturing approval', () => {
    expect(VANDERBILT_L5_PACKETS).toHaveLength(60);
    expect(new Set(VANDERBILT_L5_PACKETS.map((item) => item.capabilityId))).toEqual(new Set(CAPABILITY_DEFINITIONS.map((item) => item.id)));
    expect(VANDERBILT_L5_PACKETS.every((item) => item.tenantId === VANDERBILT_TENANT.id && item.status === 'approval-pending')).toBe(true);
    expect(VANDERBILT_L5_PACKETS.every((item) => item.dataRules.length > 0 && item.accessibility && item.fallback && item.lifecycle && item.masterRows.length > 0)).toBe(true);
    expect(VANDERBILT_L5_DECISIONS).toEqual([]);
    expect(namedTenantL5Evidence(VANDERBILT_L5_PACKETS, VANDERBILT_L5_DECISIONS, AS_OF)).toEqual([]);
  });

  it('keeps all capabilities at L4 until authorized Vanderbilt evidence exists', () => {
    const evidence = repositoryL4Evidence(CAPABILITY_DEFINITIONS);
    const readiness = CAPABILITY_DEFINITIONS.map((capability) => evaluateL9Readiness(capability, evidence, AS_OF));
    expect(readiness.filter((item) => item.achieved === 'L4')).toHaveLength(60);
    expect(readiness.filter((item) => item.achieved === 'L5')).toHaveLength(0);
  });

  it.each(['standard', 'controlled', 'high-risk'] as const)('accepts %s only with every required tenant role', (kind) => {
    const p = packet(kind);
    expect(evaluateNamedTenantApproval(p, approve(p), AS_OF)).toMatchObject({ approved: true, missingRoles: [] });
    expect(evaluateNamedTenantApproval(p, approve(p).slice(1), AS_OF)).toMatchObject({ approved: false });
  });

  it('binds approval to Vanderbilt, the capability, the configuration version, a secure artifact, and a current period', () => {
    const p = packet('controlled');
    expect(evaluateNamedTenantApproval(p, approve(p).map((item) => ({ ...item, tenantId: 'other-school' })), AS_OF).approved).toBe(false);
    expect(evaluateNamedTenantApproval(p, approve(p).map((item) => ({ ...item, configurationVersion: 'older' })), AS_OF).approved).toBe(false);
    expect(evaluateNamedTenantApproval(p, approve(p).map((item, index) => index ? item : { ...item, artifactRef: 'TODO' }), AS_OF).approved).toBe(false);
    expect(evaluateNamedTenantApproval(p, approve(p).map((item) => ({ ...item, expiresAt: '2026-09-29T23:59:59Z' })), AS_OF).approved).toBe(false);
  });

  it('ignores expired historical approvals after configuration rotation', () => {
    const p = packet('controlled');
    const history = approve(p).map((item) => ({ ...item, configurationVersion: 'older', expiresAt: '2026-09-29T23:59:59Z' }));
    expect(evaluateNamedTenantApproval(p, [...history, ...approve(p)], AS_OF).approved).toBe(true);
  });

  it('fails closed on a rejection or revocation and enforces high-risk separation of duties', () => {
    const p = packet('high-risk');
    expect(evaluateNamedTenantApproval(p, approve(p).map((item) => ({ ...item, subjectRef: 'directory://vanderbilt/one-person' })), AS_OF).approved).toBe(false);
    expect(evaluateNamedTenantApproval(p, approve(p).map((item, index) => index ? item : { ...item, decision: 'revoked' }), AS_OF).approved).toBe(false);
  });

  it('produces L5 evidence only after the complete approved packet', () => {
    const p = packet('standard');
    const evidence = namedTenantL5Evidence([p], approve(p), AS_OF);
    expect(evidence).toHaveLength(1);
    expect(evidence[0]).toMatchObject({ kind: 'tenant-approval', tenantId: VANDERBILT_TENANT.id, capabilityId: p.capabilityId });
  });

  it(`is what ${DOC} says`, () => {
    const rendered = render();
    if (process.env.REGISTERS === 'write') writeFileSync(join(root, DOC), rendered);
    expect(readFileSync(join(root, DOC), 'utf8'), `${DOC} is stale; run npm run registers from app/`).toBe(rendered);
  });
});

function render(): string {
  const approved = namedTenantL5Evidence(VANDERBILT_L5_PACKETS, VANDERBILT_L5_DECISIONS, AS_OF);
  return [
    '# Vanderbilt named-tenant L5 approval register', '',
    renderedFrom('app/src/lib/governance/named-tenant-approval.ts', 'named-tenant-approval.test.ts'), '', controlLine(DOC), '',
    `**Tenant candidate:** ${VANDERBILT_TENANT.displayName} (\`${VANDERBILT_TENANT.id}\`)`, '',
    `**Configuration candidate:** \`${VANDERBILT_TENANT.candidateConfigurationVersion}\``, '',
    `**Status as of ${AS_OF}:** ${approved.length} approved · ${VANDERBILT_L5_PACKETS.length - approved.length} approval pending.`, '',
    'This register prepares a complete named-tenant approval surface. It is not a Vanderbilt endorsement, contract, authorization, deployment, or approval.',
    'Only current decisions from every required role, bound to this tenant, capability and configuration version and backed by secure evidence references, create L5 evidence.', '',
    '## Approval requirements by activation class', '',
    ...table(['Class', 'Required approving roles'], Object.entries(APPROVERS_BY_CLASS).map(([kind, roles]) => [kind, cell(roles.join(', '))])), '',
    '## Capability packets', '',
    ...table(['ID', 'Capability', 'Class', 'Status', 'Approvers', 'External activation gates'], VANDERBILT_L5_PACKETS.map((item) => [
      item.capabilityId, cell(item.capabilityName), item.activationClass, 'approval pending', cell(item.requiredApprovers.join(', ')), cell(item.externalGates.join('; ') || 'none beyond tenant approval'),
    ])), '',
    '## Evidence intake boundary', '',
    '- Store names, signatures, tickets, findings, credentials and institutional records outside the repository in an approved evidence system.',
    '- Record only secure references using `trust-room://`, `vault://`, or `ticket://` identifiers.',
    '- A rejection, revocation, expiry, tenant mismatch, capability mismatch or configuration-version mismatch fails closed.',
    '- High-risk capabilities require at least two distinct approving subjects and every class-specific role.',
    '- Provider credentials, authoritative data, contracts and live-system verification remain separate activation gates even after L5 approval.', '',
    '## Next institutional action', '',
    'Vanderbilt must name authorized owners, review the exact candidate configuration and capability scopes, and return signed or ticketed decisions through an approved secure channel. Until then, the repository ceiling remains L4.', '',
  ].join('\n');
}
