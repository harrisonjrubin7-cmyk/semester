import type { Opportunity } from './career';

export type SkillVerification = 'suggested' | 'student-confirmed' | 'institution-verified';
export type SkillFreshness = 'current' | 'stale';
export type SkillSourceType = 'course' | 'project' | 'work' | 'organization';

export interface SkillSource {
  id: string;
  title: string;
  details: string;
  sourceLabel?: string;
}

export interface SkillEvidenceLink {
  sourceId: string;
  sourceType: SkillSourceType;
  label: string;
}

export interface SkillClaim {
  id: string;
  skill: string;
  level: 'emerging' | 'demonstrated';
  verification: SkillVerification;
  freshness: SkillFreshness;
  evidence: SkillEvidenceLink[];
}

export interface SkillGraphInput {
  courses: SkillSource[];
  projects: SkillSource[];
  work: SkillSource[];
  organizations: SkillSource[];
}

const SKILLS: Array<[string, RegExp]> = [
  ['Research', /\bresearch|literature review|interview design\b/i],
  ['SQL', /\bsql|database quer/i],
  ['Writing', /\bwriting|written|report|brief|essay\b/i],
  ['Data analysis', /\bdata analys|econometric|regression|statistics|statistical|excel|stata|r studio\b/i],
  ['Leadership', /\bleadership|led |managed|captain|president\b/i],
  ['Communication', /\bcommunication|presented|presentation|public speaking\b/i],
  ['Project management', /\bproject management|coordinated|planned|roadmap\b/i],
  ['Design', /\bdesign|figma|prototype|user research\b/i],
  ['Programming', /\bprogramming|typescript|javascript|python|software\b/i],
];

const slug = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function deriveSkillClaims(input: SkillGraphInput): SkillClaim[] {
  const claims = new Map<string, SkillClaim>();
  const groups: Array<[SkillSourceType, SkillSource[]]> = [
    ['course', input.courses],
    ['project', input.projects],
    ['work', input.work],
    ['organization', input.organizations],
  ];
  for (const [sourceType, sources] of groups) {
    for (const source of sources) {
      const text = `${source.title} ${source.details}`;
      for (const [skill, pattern] of SKILLS) {
        if (!pattern.test(text)) continue;
        const id = `skill-${slug(skill)}`;
        const evidence = {
          sourceId: source.id,
          sourceType,
          label: source.sourceLabel || source.title,
        };
        const existing = claims.get(id);
        if (existing) existing.evidence.push(evidence);
        else {
          claims.set(id, {
            id,
            skill,
            level: 'emerging',
            verification: 'suggested',
            freshness: 'current',
            evidence: [evidence],
          });
        }
      }
    }
  }
  return [...claims.values()];
}

const requiredSkills = (opportunity: Opportunity): string[] => {
  const explicit = opportunity.skills
    .split(/[,;|]/)
    .map((skill) => skill.trim())
    .filter(Boolean);
  if (explicit.length > 0) return [...new Set(explicit)];
  const text = `${opportunity.description} ${opportunity.requirements}`;
  return SKILLS.filter(([, pattern]) => pattern.test(text)).map(([skill]) => skill);
};

export interface OpportunityFit {
  opportunityId: string;
  matched: Array<{ skill: string; claimId: string; evidence: SkillEvidenceLink[] }>;
  missing: string[];
  uncertainties: string[];
}

export function explainFit(opportunity: Opportunity, claims: SkillClaim[]): OpportunityFit {
  const matched: OpportunityFit['matched'] = [];
  const missing: string[] = [];
  const uncertainties: string[] = [];
  for (const required of requiredSkills(opportunity)) {
    const claim = claims.find((candidate) => candidate.skill.toLowerCase() === required.toLowerCase());
    if (!claim) {
      missing.push(required);
      continue;
    }
    matched.push({ skill: required, claimId: claim.id, evidence: claim.evidence });
    if (claim.freshness === 'stale') uncertainties.push(`${required} evidence is stale and should be refreshed.`);
    if (claim.verification === 'suggested') uncertainties.push(`${required} is suggested, not yet confirmed.`);
  }
  return { opportunityId: opportunity.id, matched, missing, uncertainties };
}

const searchWords = (query: string) =>
  query.toLowerCase().match(/[a-z0-9+#.]+/g)?.filter((word) => !['a', 'an', 'the', 'for', 'with'].includes(word)) ?? [];

export function searchOpportunities(query: string, opportunities: Opportunity[]): Opportunity[] {
  const words = searchWords(query);
  if (words.length === 0) return opportunities;
  return opportunities
    .map((opportunity, index) => {
      const hay = [
        opportunity.title,
        opportunity.organization,
        opportunity.kind,
        opportunity.location,
        opportunity.format,
        opportunity.skills,
        opportunity.description,
        opportunity.requirements,
      ]
        .join(' ')
        .toLowerCase();
      return { opportunity, index, matches: words.filter((word) => hay.includes(word)).length };
    })
    .filter((row) => row.matches === words.length)
    .sort((a, b) => b.matches - a.matches || a.index - b.index)
    .map((row) => row.opportunity);
}

export function missingSkillPlan(fit: OpportunityFit): Array<{ skill: string; action: string }> {
  return fit.missing.map((skill) => ({
    skill,
    action: `Choose one course, project or campus activity that can produce reviewable ${skill} evidence.`,
  }));
}
