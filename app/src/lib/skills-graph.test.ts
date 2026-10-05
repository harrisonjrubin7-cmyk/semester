import { describe, expect, it } from 'vitest';
import type { Opportunity } from './career';
import {
  deriveSkillClaims,
  explainFit,
  missingSkillPlan,
  searchOpportunities,
  type SkillClaim,
} from './skills-graph';

const course = () => ({
  id: 'econ-3010',
  title: 'Econometrics',
  details: 'Research design, regression analysis and SQL data work.',
  sourceLabel: 'ECON 3010 course record',
});

const opportunity = (): Opportunity => ({
  id: 'policy-intern',
  title: 'Policy research intern',
  organization: 'Civic Lab',
  kind: 'Internship',
  location: 'Nashville',
  format: 'Hybrid',
  compensation: '$20/hour',
  deadline: '2026-10-15',
  skills: 'Research, SQL, Writing',
  description: 'Support a public policy research team.',
  requirements: 'Research and SQL experience.',
  url: 'https://example.invalid/policy-intern',
  country: 'United States',
  term: 'Spring',
  cost: '',
  credit: '',
  saved: false,
});

const claim = (skill: string, freshness: SkillClaim['freshness'] = 'current'): SkillClaim => ({
  id: `skill-${skill.toLowerCase()}`,
  skill,
  level: 'emerging',
  verification: 'student-confirmed',
  freshness,
  evidence: [{ sourceId: 'project-1', sourceType: 'project', label: 'Research project' }],
});

describe('career skills evidence', () => {
  it('never calls a derived skill verified', () => {
    const [derived] = deriveSkillClaims({ courses: [course()], projects: [], work: [], organizations: [] });
    expect(derived.verification).toBe('suggested');
    expect(derived.evidence[0].sourceId).toBe(course().id);
  });

  it('marks evidence stale from source availability instead of a hardcoded current state', () => {
    const [derived] = deriveSkillClaims({ courses: [{ ...course(), available: false }], projects: [], work: [], organizations: [] });
    expect(derived.freshness).toBe('stale');
  });

  it('explains matches, gaps and stale evidence without a black-box percentage', () => {
    const fit = explainFit(opportunity(), [claim('Research'), claim('SQL', 'stale')]);
    expect(fit.matched).toContainEqual(expect.objectContaining({ skill: 'Research' }));
    expect(fit.missing).toContain('Writing');
    expect(fit.uncertainties.join(' ')).toContain('stale');
    expect(fit).not.toHaveProperty('score');
  });

  it('searches opportunity language and turns each gap into an evidence-building step', () => {
    expect(searchOpportunities('hybrid policy research', [opportunity()])).toHaveLength(1);
    const plan = missingSkillPlan(explainFit(opportunity(), [claim('Research')]));
    expect(plan.map((step) => step.skill)).toEqual(['SQL', 'Writing']);
    expect(plan.every((step) => step.action.length > 0)).toBe(true);
  });
});
