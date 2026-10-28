// SIS/LMS replacement status register (replacement spec §11 "Status register", §16 first executable increment).
// Each capability carries six statuses, each needing its own evidence. Deployment does not prove authorization; tests do
// not prove production use. institution_authorized and production_enabled can only be set from an approval reference
// recorded by the owner; nothing in code sets them (tests/replacementRegister.test.ts enforces this).
export const STAGES = ['designed', 'implemented', 'tested', 'deployed', 'institution_authorized', 'production_enabled'] as const;
export type Stage = (typeof STAGES)[number];
export type Evidence = { stage: Stage; ref: string };
export type Capability = { id: string; area: 'SIS' | 'LMS' | 'Platform'; name: string; spec: string; route: string | null; evidence: Evidence[]; gaps: string[] };

const D = (ref: string): Evidence => ({ stage: 'designed', ref });
const I = (ref: string): Evidence => ({ stage: 'implemented', ref });
const T = (ref: string): Evidence => ({ stage: 'tested', ref });

/** §16 path, in order: section → enrollment → roster → submission → released course grade → certified official entry. */
export const FIRST_PATH = ['sec.approved', 'reg.enroll', 'lms.roster', 'lms.submission', 'grd.course', 'rec.official'];

export const CAPABILITIES: Capability[] = [
  { id: 'sec.approved', area: 'SIS', name: 'Approved section (catalog course → section with capacity)', spec: '§3.4–3.5', route: '/institution/sections',
    evidence: [D('Master Build Book; sreq-001'), I('lib/sreqMigration.ts sreq_submit/sreq_step: department → chair → registrar → create → reconcile; room/instructor clash re-check under a per-term lock'), T('dbchecks/sectionRequests.ts 28 Oct: 21/21; concurrent clashing authorizations → 1 authorized, control without the term lock → 2')],
    gaps: ['Linked components (lab/lecture) and cross-listed capacity pools not modelled', 'Section changes after students enroll (room, time, cancellation) not governed by this workflow'] },
  { id: 'reg.enroll', area: 'SIS', name: 'Concurrency-safe enrollment (last seat, idempotent submit, receipts)', spec: '§3.6, §7 Workflow A', route: '/plan/registration',
    evidence: [D('migrations/001_registrar_backend.sql'), I('lib/pgMigration.ts reg_decide/reg_seats/reg_section_locks; subMigration submit keys; serMigration per-student serialization; wlMigration waitlists and all-or-nothing swap'), T('dbchecks/registrationRace.ts 27 Oct: 20 concurrent last-seat claims → 1 seat (also with a 0.3 s window); replay and reused-key conflict; control without the row lock double-booked 6')],
    gaps: ['Race test covers reg_decide only; swap and waitlist promotion races not yet run', 'Registration opening-burst load not measured'] },
  { id: 'lms.roster', area: 'LMS', name: 'Course roster from enrollments', spec: '§4.1', route: '/learn',
    evidence: [D('Native capability matrix'), I('Zite Enrollments → section pages, gradebook, group sets; api/reconciliation.ts run compares reg_seats with Enrollments and repairs only what the ledger proves'), T('tests/reconRules.test.ts diffLedger: repairable seat, matching control, unledgered enrollment flagged (8/8)')],
    gaps: ['Sections with no ledger seats are never compared, so an enrollment created outside the registrar there is not flagged', 'Reconciliation is a manual run by an integration admin, not scheduled', 'Course space is the section itself; one space for several sections not modelled'] },
  { id: 'lms.submission', area: 'LMS', name: 'Assignment submission with states', spec: '§4.2, §7 Workflow B', route: '/today',
    evidence: [D('Native capability matrix'), I('Tasks + Submissions; private file store (fil_*, SHA-256, locked on submit); sbm_submit receipts with file manifest, on-time/late stamp, request-key replay; dln_extensions per-student deadlines (instructor or accommodation letter) applied to the late stamp, receipt records due_source'), T('dbchecks/submissions.ts 26/26 + 3 mutants (28 Oct)')],
    gaps: ['No file safety (malware) scan step', 'Extension endpoint not yet exercised by a signed-in instructor (needs a second sample account)', 'One attempt per assignment; multiple attempts and group submissions not modelled'] },
  { id: 'grd.course', area: 'LMS', name: 'Released course grade (gradebook snapshot → proposal → release)', spec: '§4.4', route: '/records/final-grades',
    evidence: [D('Replacement spec §4.4 three-records rule'), I('lib/ogrMigration.ts ogr_propose/ogr_release; api/staff.ts setFinal now proposes only'), T('dbchecks/officialGrades.ts O1–O10 (32/32)')],
    gaps: ['Weighted categories, drop rules and late policies not modelled (basis is points earned/possible)'] },
  { id: 'rec.official', area: 'SIS', name: 'Certified official academic grade (append-only revisions, corrections)', spec: '§3.7, §7 Workflow C', route: '/records/final-grades',
    evidence: [D('Replacement spec §7 Workflow C'), I('lib/ogrMigration.ts ogr_certify/ogr_post/ogr_correct; aum_modes authority gate; lib/ogrServer.ts projection'), T('dbchecks/officialGrades.ts O11–O32 (32/32) + 3 mutants')],
    gaps: ['Institution approval routing beyond registrar posting not configurable'] },
  { id: 'rec.transcript', area: 'SIS', name: 'Transcript and GPA from official revisions only', spec: '§3.7', route: '/records/final-grades',
    evidence: [D('Replacement spec §3.7'), I('lib/transcriptRules.ts buildTranscript; ogrServer transcriptEntries; Word download; registrar view is audited'), T('tests/transcript.test.ts 16/16 incl. repeat rules, standing and honors, policy check; repeat and referral mutants fail (28 Oct)')],
    gaps: ['Institution grading policy is stored and two-registrar approved (gpl_*, dbchecks/gradingPolicy.ts 18/18); not yet exercised signed in by two registrars', 'Standing decisions, notices, suspension holds and appeals recorded (stn_*, dbchecks/standing.ts 21/21 + 3 mutants); not yet exercised signed in by a registrar and a student; notices are in-app only (no email)', 'No stored, signed transcript snapshot or verification code yet'] },
  // Broader inventory (coarse; detail lives in roleApps and the parity CSV)
  { id: 'sis.admissions', area: 'SIS', name: 'Admissions and onboarding', spec: '§3.3', route: '/plan/transition', evidence: [D('Master Build Book'), I('applications, transition (trn_*)'), T('dbchecks/transition.ts')], gaps: ['Committee review and rubric scoring partial'] },
  { id: 'sis.degree', area: 'SIS', name: 'Degree audit and graduation', spec: '§3.8', route: '/progress/degree', evidence: [D('Master Build Book'), I('degree audit page')], gaps: ['Versioned requirement rules, allocation and conferral not built'] },
  { id: 'sis.finance', area: 'SIS', name: 'Student accounts and financial aid', spec: '§3.9', route: '/you/account', evidence: [D('Master Build Book'), I('ledger entries, payment plans, aid office (afo_*)'), T('dbchecks/aidOffice.ts')], gaps: ['Money movement disabled by standing rule; agency exchanges not built'] },
  { id: 'lms.assessment', area: 'LMS', name: 'Assessment engine (versions, attempts, moderation)', spec: '§4.3', route: '/learn', evidence: [D('Native capability matrix'), I('lib/asmMigration.ts asm_*')], gaps: ['Question-type registry, QTI import/export and accommodations timing not built'] },
  { id: 'lms.content', area: 'LMS', name: 'Course content, modules and versions', spec: '§4.1', route: '/learn', evidence: [D('Native capability matrix'), I('syllabi, resources, study guides (sgd_*)'), T('dbchecks/guides.ts')], gaps: ['Module release conditions, course copy/rollover and Common Cartridge not built'] },
  { id: 'plat.authority', area: 'Platform', name: 'Authority modes per tenant and domain', spec: '§2 operating modes', route: null, evidence: [D('Replacement spec §2'), I('aum_modes, aum_set (two administrators + evidence)'), T('dbchecks/officialGrades.ts O26–O31')], gaps: ['Only the records domain reads its mode so far'] },
  { id: 'plat.permissions', area: 'Platform', name: 'Zite deny-by-default permissions', spec: '§5 Zite controls', route: null, evidence: [D('Replacement spec §5')],
    gaps: ['zite.permissions.json has no defaultPolicy and no roles; direct-table access by signed-in users is NOT verified', 'Needs Zite documentation or a second test account to verify before any change'] },
];

/** Highest stage a capability reaches with unbroken evidence (no skipping). */
export function stageOf(c: Capability): Stage | null {
  let best: Stage | null = null;
  for (const s of STAGES) { if (c.evidence.some((e) => e.stage === s && e.ref.trim())) best = s; else break; }
  return best;
}
export function problems(list: Capability[]): string[] {
  const out: string[] = [];
  for (const c of list) {
    for (const e of c.evidence) {
      if (!e.ref.trim()) out.push(`${c.id}: ${e.stage} has no evidence`);
      const i = STAGES.indexOf(e.stage);
      if (i > 0 && !c.evidence.some((x) => x.stage === STAGES[i - 1])) out.push(`${c.id}: ${e.stage} claimed without ${STAGES[i - 1]}`);
      if (e.stage === 'institution_authorized' || e.stage === 'production_enabled') { if (!/^APPROVAL:/.test(e.ref)) out.push(`${c.id}: ${e.stage} needs an owner approval reference (APPROVAL:…)`); }
    }
  }
  return out;
}
