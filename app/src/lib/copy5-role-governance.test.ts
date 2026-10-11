import { describe, expect, it } from 'vitest';
import { COPY5_ROLE_PROPOSALS, COPY7_ROLE_CONFLICTS, ROLE_PROPOSAL_AUTHORITY, proposalMatchLabel } from './copy5-role-governance';

describe('Copy 5 role governance proposals', () => {
  it('records Copy 7 as current authority without disguising the byte-identical Copy 5 lineage', () => {
    expect(ROLE_PROPOSAL_AUTHORITY).toEqual({
      current: 'Copy 7',
      inheritedFrom: 'Copy 5',
      relationship: 'byte-identical role dataset',
      reconciliation: 'Copy 5 annotations carried forward',
    });
  });

  it('preserves all 51 unique source proposals and the hand-checked status totals', () => {
    expect(COPY5_ROLE_PROPOSALS).toHaveLength(51);
    expect(new Set(COPY5_ROLE_PROPOSALS.map(({ id }) => id)).size).toBe(51);
    expect(Object.fromEntries(
      ['exact', 'candidate_alias', 'contextual_variant', 'governance_decision', 'roadmap', 'delegated_grant']
        .map((status) => [status, COPY5_ROLE_PROPOSALS.filter((proposal) => proposal.status === status).length]),
    )).toEqual({
      exact: 6,
      candidate_alias: 16,
      contextual_variant: 6,
      governance_decision: 18,
      roadmap: 4,
      delegated_grant: 1,
    });
  });

  it('does not turn exact identifier equality into activation evidence', () => {
    const student = COPY5_ROLE_PROPOSALS.find(({ id }) => id === 'student');
    expect(student).toMatchObject({ candidateRoles: ['student'], status: 'exact' });
    expect(proposalMatchLabel(student!)).toBe('Exact identifier match · not activation evidence');
  });

  it('keeps roadmap and delegated-grant rows non-authoritative rather than inventing app roles', () => {
    expect(COPY5_ROLE_PROPOSALS.find(({ id }) => id === 'applicant')).toMatchObject({ candidateRoles: [], status: 'roadmap' });
    expect(COPY5_ROLE_PROPOSALS.find(({ id }) => id === 'family')).toMatchObject({ candidateRoles: [], status: 'delegated_grant' });
  });

  it('keeps conflicting security break-glass proposals unapproved under the stricter server policy', () => {
    expect(COPY5_ROLE_PROPOSALS.find((proposal) => proposal.id === 'sem_security')?.requiredDecision)
      .toBe('Split incident response from platform administration; map each Copy 5 capability explicitly');
    for (const id of ['sem_security', 'inst_sec']) {
      expect(COPY5_ROLE_PROPOSALS.find((proposal) => proposal.id === id)).toMatchObject({
        status: 'governance_decision',
      });
      expect(COPY7_ROLE_CONFLICTS[id]).toContain('unapproved conflict');
    }
  });
});
