import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CAPABILITIES } from '../rollout-capabilities';
import { controlLine, renderedFrom, table } from '../ops/render';
import {
  ACTIVATION_GATES,
  RELEASE_PROFILES,
  REPOSITORY_RELEASE_EVIDENCE,
  TECHNICAL_RELEASE_GATES,
  evaluateReleaseProfile,
  type ReleaseEvidence,
} from './release-profiles';

const root = join(import.meta.dirname, '../../../..');
const DOC = 'docs/PILOT-AND-INDIVIDUAL-RELEASE-PROFILES.md';
const AS_OF = '2026-10-02';
const runtime = (gate: (typeof ACTIVATION_GATES)[number]): ReleaseEvidence => ({
  gate, status: 'current', reference: `runtime://${gate}/verified`, checkedAt: AS_OF,
});

describe('pilot and individual release profiles', () => {
  it('binds every scoped capability to the canonical registry', () => {
    const ids = new Set(CAPABILITIES.map((capability) => capability.id));
    for (const profile of Object.values(RELEASE_PROFILES)) {
      expect(profile.capabilityIds.length).toBeGreaterThan(0);
      expect(profile.capabilityIds.every((id) => ids.has(id as (typeof CAPABILITIES)[number]['id']))).toBe(true);
      expect(new Set(profile.requiredTechnicalGates)).toEqual(new Set(TECHNICAL_RELEASE_GATES));
    }
  });

  it('makes the institutional pilot default-off and planning-only', () => {
    const pilot = RELEASE_PROFILES['institutional-pilot'];
    expect(pilot.defaultOff).toBe(true);
    expect(pilot.capabilityIds).toContain('CAP-050');
    expect(pilot.allowedOperations.join(' ')).toMatch(/planning|comparison|validation/i);
    expect(pilot.forbiddenOperations).toEqual(expect.arrayContaining(['enroll', 'drop', 'write to SIS', 'act as system of record']));
  });

  it('never turns repository evidence into deployment or tenant authorization', () => {
    for (const profile of Object.values(RELEASE_PROFILES)) {
      const result = evaluateReleaseProfile(profile, REPOSITORY_RELEASE_EVIDENCE, AS_OF);
      expect(result.technicalStatus).toBe('ready');
      expect(result.rolloutStatus).toBe('held');
      expect(result.missingActivation.length).toBeGreaterThan(0);
      expect(result.claim).toMatch(/technical release candidate/i);
    }
  });

  it('requires every profile-specific activation record before rollout', () => {
    for (const profile of Object.values(RELEASE_PROFILES)) {
      const evidence = [...REPOSITORY_RELEASE_EVIDENCE, ...profile.requiredActivationGates.map(runtime)];
      expect(evaluateReleaseProfile(profile, evidence, AS_OF)).toMatchObject({ technicalStatus: 'ready', rolloutStatus: 'authorized' });
      expect(evaluateReleaseProfile(profile, evidence.slice(0, -1), AS_OF).rolloutStatus).toBe('held');
    }
  });

  it('fails closed on stale, failed, revoked, or expired evidence', () => {
    const profile = RELEASE_PROFILES['individual-scale'];
    for (const status of ['expired', 'failed', 'revoked'] as const) {
      const evidence = REPOSITORY_RELEASE_EVIDENCE.map((item, index) => index === 0 ? { ...item, status } : item);
      expect(evaluateReleaseProfile(profile, evidence, AS_OF).technicalStatus).toBe('not-ready');
    }
    const expired = REPOSITORY_RELEASE_EVIDENCE.map((item, index) => index === 0 ? { ...item, expiresAt: '2026-10-01' } : item);
    expect(evaluateReleaseProfile(profile, expired, AS_OF).technicalStatus).toBe('not-ready');
  });

  it('keeps prohibited institutional and financial claims out of broad individual use', () => {
    const individual = RELEASE_PROFILES['individual-scale'];
    expect(individual.forbiddenOperations).toEqual(expect.arrayContaining(['official registration', 'financial aid', 'payroll', 'general ledger']));
    expect(individual.claimBoundary).toMatch(/no institutional connection, certification, or system-of-record claim/i);
  });

  it('points every repository evidence record at a real file', () => {
    for (const item of REPOSITORY_RELEASE_EVIDENCE) {
      expect(item.reference.startsWith('repo:')).toBe(true);
      expect(existsSync(join(root, item.reference.slice('repo:'.length))), item.reference).toBe(true);
    }
  });

  it(`is what ${DOC} says`, () => {
    const rendered = render();
    if (process.env.REGISTERS === 'write') writeFileSync(join(root, DOC), rendered);
    expect(readFileSync(join(root, DOC), 'utf8'), `${DOC} is stale; run npm run registers from app/`).toBe(rendered);
  });
});

function render(): string {
  const decisions = Object.values(RELEASE_PROFILES).map((profile) => evaluateReleaseProfile(profile, REPOSITORY_RELEASE_EVIDENCE, AS_OF));
  return [
    '# Pilot and individual release profiles', '',
    renderedFrom('app/src/lib/governance/release-profiles.ts', 'release-profiles.test.ts'), '', controlLine(DOC), '',
    'These executable profiles define the next honest release targets: broad individual use and a bounded institutional pilot.',
    'They do not rename repository completion as deployment, tenant approval, certification, or live operation.', '',
    '## Current repository decision', '',
    ...table(['Profile', 'Technical candidate', 'Rollout', 'Still required'], decisions.map((decision) => [
      decision.profileId, decision.technicalStatus, decision.rolloutStatus, decision.missingActivation.join(', '),
    ])), '',
    'The repository currently satisfies the technical evidence contract for both profiles. Rollout remains held because runtime',
    'and named-tenant activation records do not live in source code and have not been supplied to this evaluator.', '',
    '## Scope and boundaries', '',
    ...Object.values(RELEASE_PROFILES).flatMap((profile) => [
      `### ${profile.id}`, '',
      `**Audience:** ${profile.audience}`, '',
      `**Default:** ${profile.defaultOff ? 'off' : 'available after production release gates'}`, '',
      `**Capabilities:** ${profile.capabilityIds.map((id) => `\`${id}\``).join(', ')}`, '',
      `**Allowed:** ${profile.allowedOperations.join('; ')}`, '',
      `**Forbidden:** ${profile.forbiddenOperations.join('; ')}`, '',
      `**Claim boundary:** ${profile.claimBoundary}`, '',
      `**Fallback:** ${profile.fallback}`, '',
    ]),
    '## Technical evidence contract', '',
    ...table(['Gate', 'Repository reference'], TECHNICAL_RELEASE_GATES.map((gate) => [
      gate, REPOSITORY_RELEASE_EVIDENCE.find((item) => item.gate === gate)?.reference ?? 'missing',
    ])), '',
    '## Activation boundary', '',
    '- Individual scale still needs an exact deployed SHA, production smoke, a live support route, and current rollback evidence.',
    '- An institutional pilot additionally needs a named agreement, data owner, cohort consent, tenant accessibility/security/privacy reviews, and a staffed support roster.',
    '- CAP-050 is admitted only for search, comparison, validation, and official-system handoff. Enrollment, waitlist, drop, withdrawal, and SIS writes remain prohibited.',
    '- No profile activates financial aid, payments, payroll, general ledger, official grading, certification, or system-of-record authority.', '',
  ].join('\n');
}
