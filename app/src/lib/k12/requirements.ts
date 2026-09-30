/**
 * The K–12 requirements, the district baseline, and what only counsel can
 * answer — before any district's student data is accepted.
 *
 * The owner chose the full K–12 edition (D-140) on the terms of D-139: the
 * minimum age is 13, so K–12 here means only the grades where students are 13
 * and over: in practice high school, early college and CTE. Two briefs of
 * 29 September set the gate this file holds: the feature benchmark's
 * "for K–12, do not accept student PII from a district until you have" list of
 * sixteen, and the playbook's K–12 note. They are kept under `docs/expansion/`
 * as supplied and are never cited as evidence.
 *
 * `docs/k12/K12-REQUIREMENTS.md` is rendered from this file by
 * `requirements.test.ts`; edit the data, then `npm run registers` from app/.
 *
 * ## The rule this file is for
 *
 * `districtReady()` answers one question: may a district's student data be
 * accepted? It is false while any baseline item is short of `tested`, and it
 * is false today. Nothing in the K–12 edition may take district data until it
 * is true; the edition that follows this file asks it before anything else.
 *
 * Statuses and the evidence rule are the communities register's: `designed`
 * cites a document, `building` cites code, `tested` cites a test, and nothing
 * is above `tested` because nothing has an artifact under `docs/evidence/`.
 */
import type { Seat } from '../launchreadiness';
import type { Status } from '../communitiesregister';

export { STATUSES, type Status } from '../communitiesregister';

export interface Held {
  id: string;
  item: string;
  status: Status;
  evidence: readonly { path: string; shows: string }[];
  gap: string;
  owner: Seat;
}

type Row = [item: string, status: Status, evidence: [path: string, shows: string][], gap: string, owner: Seat];

const rows = (prefix: string, list: readonly Row[]): Held[] =>
  list.map(([item, status, evidence, gap, owner], i) => ({
    id: `${prefix}-${String(i + 1).padStart(2, '0')}`,
    item,
    status,
    evidence: evidence.map(([path, shows]) => ({ path, shows })),
    gap,
    owner,
  }));

/** The sixteen things a district's student data waits on, in the brief's order. */
export const BASELINE: readonly Held[] = rows('KB', [
  ['A district data privacy agreement or DPSA', 'designed', [['docs/trust/DPA-CHECKLIST.md', 'what the agreement must settle, for counsel']], 'No signable agreement; the 1EdTech DPSA template has not been adapted.', 'privacy'],
  ['FERPA-aligned school-official and use-limitation terms', 'tested', [['docs/trust/FERPA-CONSENT-WORKFLOW.md', 'the school-official basis and its limits'], ['app/src/lib/trust/ferpa-consent.test.ts', 'held']], 'The terms are a workflow in the tree, not yet a signed clause.', 'privacy'],
  ['A COPPA assessment for users under 13', 'tested', [['supabase/minimum-age.check.sql', 'nobody under 13 may hold an account']], 'Nobody under 13 is served, so there is nothing to assess until a district asks for elementary grades; counsel confirms that reading.', 'privacy'],
  ['A parent or guardian consent approach where required', 'building', [['docs/SUPPORTER-FAMILY-PRIVACY-MODEL.md', 'the limited-grant model a guardian would use'], ['supabase/k12-guardians.check.sql', 'school staff record and verify a minor’s guardian; the link stops counting at 18']], 'A K–12 school’s staff can record and verify a guardian (D-1022), but no guardian-facing screen reads through the link, and whether any state requires verified consent at 13–17 is counsel’s question.', 'privacy'],
  ['Age-aware product design', 'tested', [['supabase/minimum-age.check.sql', 'a minor is out of discovery, matching, messaging and employer visibility']], '', 'product'],
  ['Strict role, school, class and guardian boundaries', 'building', [['supabase/rolegrants.check.sql', 'roles held per school'], ['supabase/family.check.sql', 'a guardian sees only what was granted']], 'No grade or class-section boundary exists; a district tenant is one school.', 'security'],
  ['No behavioural advertising', 'tested', [['app/src/lib/gtm/campaign.test.ts', 'no targeting on education records']], '', 'privacy'],
  ['No sale of student data', 'tested', [['app/src/lib/trust/ai-training-policy.test.ts', 'never sold, never used to train']], '', 'privacy'],
  ['No public student discovery by default', 'tested', [['supabase/minimum-age.check.sql', 'a minor cannot be found, matched or opted into employer view'], ['supabase/expansion.check.sql', 'employer visibility is opt-in for everyone']], '', 'trust'],
  ['Human moderation and an escalation plan', 'tested', [['app/src/community/moderation.test.ts', 'the queue and its actions'], ['docs/CRISIS-RESPONSE-RUNBOOK.md', 'escalation']], 'No moderator has been trained for minors.', 'trust'],
  ['Safe messaging restrictions', 'tested', [['supabase/minimum-age.check.sql', 'a minor cannot connect, request a mentor or post in class rooms']], '', 'trust'],
  ['A data retention and deletion schedule', 'tested', [['app/src/lib/retention.test.ts', 'the schedule, held to the tables']], 'No district-specific retention period; the schedule is one for every tenant.', 'data'],
  ['A district-controlled AI policy', 'building', [['app/src/lib/coursestudio.ts', 'a course sets its own AI policy']], 'A course sets its AI policy; no district-level policy overrides it.', 'product'],
  ['Accessibility documentation', 'designed', [['docs/operating-model/ACCESSIBILITY-GOVERNANCE.md', 'the governance, not a statement']], 'No accessibility statement and no VPAT.', 'accessibility'],
  ['An incident-response process', 'tested', [['app/src/lib/governance/incident-comms.test.ts', 'who is told, how fast']], 'Never exercised with a district.', 'operations'],
  ['A district security questionnaire package', 'designed', [['docs/market-readiness/HECVAT_DRAFT_RESPONSE.md', 'the higher-ed questionnaire, drafted']], 'Drafted for higher education; no K–12 questionnaire answered.', 'security'],
]);

/** What the K–12 edition must do, by the areas the playbook names. */
export const REQUIREMENTS: readonly (Held & { area: string })[] = (
  [
    ['Age-aware identity', rows('KI', [
      ['Nobody under 13; a date of birth at sign-up, refused in the database', 'tested', [['supabase/minimum-age.check.sql', 'held']], '', 'privacy'],
      ['An age stated once and never changed; only the day a minor turns 18 kept', 'tested', [['supabase/minimum-age.check.sql', 'held'], ['app/src/lib/age.test.ts', 'the rules as the app explains them']], 'Self-reported; a district roster would be the better source and is not connected.', 'privacy'],
      ['A district-asserted grade or age, where a district provides one', 'not-started', [], 'Rostering from a district SIS is not built; an institution-asserted age would override a stated one.', 'data'],
    ])],
    ['Guardian consent', rows('KG', [
      ['A student grants a guardian a limited, expiring view of chosen items', 'tested', [['supabase/familyinvites.check.sql', 'invites'], ['supabase/familyshare.check.sql', 'shared items, re-checked on read']], 'Built for adults’ supporters; open to a minor.', 'privacy'],
      ['Verifiable guardian consent where the law requires it', 'not-started', [], 'Not needed while nobody under 13 is served; counsel decides whether 13–17 needs it in any state.', 'privacy'],
      ['No default guardian access to a student’s private work', 'tested', [['supabase/family.check.sql', 'a grant names items; nothing is visible by default']], '', 'privacy'],
    ])],
    ['Safety and moderation', rows('KS', [
      ['Minors kept out of discovery, matching, messaging and employer visibility until 18', 'tested', [['supabase/minimum-age.check.sql', 'held']], 'Video-call and canvas links are open to anyone holding the link, for every age.', 'trust'],
      ['Reporting always open to a minor', 'tested', [['supabase/minimum-age.check.sql', 'a minor may report']], '', 'trust'],
      ['Media and community safety rules', 'designed', [['docs/COMMUNITY-MEDIA-SAFETY.md', 'the rules for everyone']], 'Nothing specific to minors (maturity MN-08).', 'trust'],
    ])],
    ['AI restrictions', rows('KA', [
      ['AI answers within a course’s policy, citing the source', 'tested', [['app/src/lib/coursestudio.test.ts', 'the course policy'], ['app/src/lib/governance/ai-lifecycle.test.ts', 'the release gates']], '', 'product'],
      ['District-controlled AI policy and approved source packs', 'not-started', [], 'No district level exists above the course.', 'product'],
      ['Age-aware limits on AI features', 'not-started', [], 'The assistant does not read the account’s standing.', 'product'],
    ])],
    ['District configuration', rows('KD', [
      ['District, school, grade, cohort, teacher and counselor configuration', 'designed', [['docs/operating-model/MULTI-CAMPUS.md', 'multi-campus scoping; "district" there means a community-college district']], 'A tenant is one school; no district or grade level.', 'product'],
      ['Tenant isolation', 'tested', [['supabase/tenancy.check.sql', 'held']], '', 'security'],
    ])],
    ['Data boundaries', rows('KX', [
      ['Only the fields a workflow needs; no grades, discipline, special education or health records', 'tested', [['app/src/lib/institution-ops.test.ts', 'forbidden measures refused']], 'The field list for a district connector is not written.', 'data'],
      ['Sponsored content kept out of a student’s view', 'tested', [['app/src/lib/gtm/sponsor.test.ts', 'protected surfaces']], '', 'privacy'],
    ])],
  ] as const
).flatMap(([area, list]) => list.map((r) => ({ ...r, area })));

/** What the tree cannot decide, for counsel. Each names the rows it would move. */
export const COUNSEL: readonly { question: string; moves: readonly string[] }[] = [
  { question: 'Confirm that a minimum age of 13, refused at sign-up, takes the service outside COPPA’s parental-consent requirement for every district served.', moves: ['KB-03'] },
  { question: 'The guardian-agreement wording for students aged 13 to 17 in the terms, and whether any state requires verified guardian consent at those ages.', moves: ['KB-04', 'KG-02'] },
  { question: 'Adapt the 1EdTech DPSA template to what Semester actually does, and the school-official clause that goes with it.', moves: ['KB-01', 'KB-02'] },
  { question: 'Which state student-privacy laws apply in each district’s state, and what each adds to the baseline.', moves: ['KB-01'] },
  { question: 'Whether a dual-enrollment high-school student in a university tenant needs anything beyond the minor rules.', moves: ['KB-06'] },
  { question: 'A retention period for a district’s student records, and what happens to them when a student leaves the district.', moves: ['KB-12'] },
];

/** May a district's student data be accepted? Only when every baseline item is tested. */
export function districtReady(baseline: readonly Held[] = BASELINE): { ready: boolean; short: string[] } {
  // Every one of the sixteen must be here: a filtered or half-loaded list is
  // not a baseline that has been met.
  const given = new Set(baseline.map((b) => b.id));
  const missing = BASELINE.filter((b) => !given.has(b.id)).map((b) => `${b.id} ${b.item} (not given)`);
  // Tested and with nothing still written against it. A gap is the item
  // saying what is not done; a status cannot outvote it.
  const short = baseline
    .filter((b) => b.status !== 'tested' || b.gap.trim() !== '')
    .map((b) => `${b.id} ${b.item}`);
  const all = [...missing, ...short];
  return { ready: all.length === 0, short: all };
}
