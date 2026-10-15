/**
 * The Strategic Expansion Register: every long-horizon capability the three
 * expansion plans name — supply chain, credentials, research, continuity,
 * architecture review, the learner profile and evidence graph, data-quality
 * correction, content governance, service and vendor operations, analytics,
 * release management, ethics, workforce, knowledge, interoperability,
 * benchmark, evidence and councils — and where the repository stands on each.
 *
 * `docs/STRATEGIC-EXPANSION-REGISTER.md` is rendered from this file by
 * `expansionregister.test.ts`; edit the data, then `npm run registers` from app/.
 *
 * ## How this relates to what is already here
 *
 * `masterregister.ts` is what must be true at launch; this is what makes
 * Semester durable after it. Where an area overlaps a master row, the area
 * names the row rather than restating it. It borrows that file's rule and its
 * four lower statuses: `designed` cites a document, `building` cites code,
 * `tested` cites a test. Nothing here is above `tested`, because nothing has
 * an artifact under `docs/evidence/`.
 *
 * How a capability is ranked and admitted — the priority formula, the tiers,
 * phases, frameworks, deferred list and gate — is `expansiongovernance.ts`.
 *
 * Assessed against `origin/main` at `e89e2ce` on 2026-09-28, with this
 * branch's supply-chain work counted where it closes an item.
 */

import type { Phase, Tier } from './expansiongovernance';

export const STATUSES = ['not-started', 'designed', 'building', 'tested'] as const;
export type Status = (typeof STATUSES)[number];

export interface Area {
  id: string;
  title: string;
  /** Why it matters, in one sentence. */
  why: string;
  tier: Tier;
  phase: Phase;
  /** Master-register rows that overlap, so the two are read together. */
  master: readonly string[];
}

export interface Item {
  id: string;
  item: string;
  status: Status;
  evidence: readonly { path: string; shows: string }[];
  gap: string;
}

type Row = [item: string, status: Status, evidence: [path: string, shows: string][], gap: string];

const AREA_LIST: readonly (Area & { rows: readonly Row[] })[] = [
  {
    id: 'SUP',
    title: 'Software supply-chain security',
    why: 'NIST CSF 2.0 puts supplier and third-party risk in Govern: a compromised dependency, Action or build is a breach of every tenant at once.',
    tier: 0,
    phase: 0,
    master: ['SEC-003', 'SEC-004', 'SEC-010', 'IAM-011', 'SRE-008'],
    rows: [
      ['Component inventory per production service: repository, owner, runtime, target, data class, dependencies, criticality', 'building', [['app/src/lib/governance/charters.ts', 'owners, source dependency and data class per module flag']], 'Charters are per feature flag, not per service; no runtime, deployment target or criticality column.'],
      ['Approved dependency and source registry', 'tested', [['app/src/lib/supplychain.ts', 'approved licences, named packages, one registry'], ['app/src/lib/supplychain.test.ts', 'every lockfile entry admitted or the build fails']], 'Approval is by licence and source, not by package name; a new MIT package still enters on review alone.'],
      ['Inventory of Actions, CI plugins, registries, build images and deploy integrations', 'tested', [['app/src/lib/supplychain.test.ts', 'only approved Actions run; one registry']], 'Build images (ubuntu-latest) and deploy integrations (Pages, Supabase) are not listed with an owner.'],
      ['Owner for each critical dependency or service', 'not-started', [], 'No dependency has a named owner; one person owns everything today.'],
      ['Locked versions and lockfiles in every package', 'tested', [['app/src/lib/supplychain.test.ts', 'app, video and pipeline lockfiles; sha512 on every entry'], ['.github/workflows/ci.yml', 'npm ci installs the lockfile exactly']], 'A reproducible build (same inputs, same bytes) has never been demonstrated.'],
      ['Review required for a new production dependency', 'building', [['.github/pull_request_template.md', 'New dependency section: purpose, data touched, licence']], 'A checklist, not a gate: no CODEOWNERS entry makes a reviewer approve package.json.'],
      ['Continuous vulnerability scanning', 'building', [['.github/dependabot.yml', 'weekly npm and Actions updates'], ['.github/workflows/ci.yml', 'npm audit --audit-level=high, non-blocking by design']], 'Findings are annotations; no one is assigned to read them, and scan history is not kept.'],
      ['Severity-based patch targets', 'tested', [['app/src/lib/supplychain.ts', 'PATCH_POLICY: 2, 14, 60 and 180 days'], ['app/src/lib/supplychain.test.ts', 'worse findings answered faster']], 'Targets accepted unchanged by the founder acting in the security seat on 29 September 2026 (D-124); no finding has yet been answered against them. The contact HECVAT VULN-1 also asks for is published in SECURITY.md and app/public/.well-known/security.txt.'],
      ['Maintainer, reputation and provenance review for critical dependencies', 'not-started', [], 'No list of critical dependencies and no record of who maintains them.'],
      ['Private registry, cache or allowlist for critical packages', 'building', [['app/src/lib/supplychain.ts', 'REGISTRY: every entry from registry.npmjs.org']], 'One public registry is enforced; there is no package-name allowlist or cache.'],
      ['Remove unused dependencies', 'not-started', [], 'No unused-dependency check runs.'],
      ['Licence inventory with prohibited categories', 'tested', [['app/src/lib/supplychain.test.ts', 'forbidden families refused even by name'], ['docs/SUPPLY-CHAIN.md', 'rendered inventory of all three lockfiles']], 'The Remotion licence under video/ is an open decision.'],
      ['SBOM for every production release', 'tested', [['.github/workflows/pages.yml', 'CycloneDX SBOM after every build, kept 90 days'], ['app/src/lib/supplychain.test.ts', 'the step exists, between build and deploy']], 'Kept 90 days with the run, not with a release; not attached to anything a buyer can download.'],
      ['MFA required for source-control access', 'not-started', [], 'A GitHub setting; nothing in the repository records it. Needs an export under docs/evidence/.'],
      ['Organization-owned repository', 'not-started', [['.github/workflows/ci.yml', 'notes the repository is owned by a personal account']], 'Owned by a personal account: the company does not own its source.'],
      ['Branch protection, required checks and no force-push on main', 'not-started', [['VALIDATED.md', 'recommends requiring up-to-date branches']], 'Recommended, not recorded as configured.'],
      ['Peer review for protected paths', 'not-started', [], 'No CODEOWNERS file.'],
      ['Least-privilege tokens for bots, apps and CI', 'tested', [['app/src/lib/supplychain.test.ts', 'every workflow read-only by default; only Pages may write']], 'Deploy keys and GitHub App grants are settings, not reviewed here.'],
      ['Secret scanning and push protection', 'building', [['.github/workflows/ci.yml', 'gitleaks over every push'], ['.gitleaks.toml', 'rules']], 'Push protection is a setting and is not recorded.'],
      ['Access revoked promptly on departure; quarterly access review', 'not-started', [['docs/market-readiness/HECVAT_READINESS.md', 'IAM-3 access review NOT_STARTED']], 'No review cadence, no retained export.'],
      ['Actions pinned to an immutable commit', 'not-started', [], 'Pinned to major tags, which a publisher can move.'],
      ['Third-party Actions reviewed before use', 'tested', [['app/src/lib/supplychain.test.ts', 'a new publisher fails until named with a reason']], 'The review is the diff to ACTIONS; nobody signs it.'],
      ['Separate build, staging and production credentials', 'designed', [['SECRETS.md', 'where each secret lives'], ['STAGING.md', 'the staging environment']], 'Not verified that no credential is shared between environments.'],
      ['No production secrets in build logs', 'building', [['.github/workflows/pages.yml', 'settings passed as masked secrets']], 'No scan of logs for a leaked value.'],
      ['Protected environment approval for production', 'not-started', [['.github/workflows/pages.yml', 'deploys to the github-pages environment']], 'The environment exists; no approval rule is recorded on it.'],
      ['Build provenance generated, signed and retained', 'not-started', [], 'No provenance attestation; below SLSA build level 2.'],
      ['Release artifact tied to commit, run, lockfile, tests, reviewer and deploy record', 'building', [['.github/workflows/pages.yml', 'SBOM named by commit SHA']], 'Only the SBOM carries the commit; nothing binds reviewer or test result to the artifact.'],
      ['Artifact identity verified before promotion; no rebuild after approval', 'not-started', [['ROLLBACK.md', 'rolls back by rebuilding an earlier ref']], 'Rollback rebuilds rather than redeploying the approved bytes.'],
      ['Production artifact and manifest retained for rollback and audit', 'building', [['.github/workflows/pages.yml', 'SBOM retained 90 days']], 'The built bundle itself is not archived.'],
      ['Rollback and artifact restoration tested', 'tested', [['ROLLBACK.md', 'redeploy any earlier ref'], ['app/src/lib/rollback.test.ts', 'rollback preconditions held']], 'No rollback drill recorded under docs/evidence/.'],
      ['Advisory monitoring linked to affected services and tenants', 'building', [['.github/dependabot.yml', 'advisories open pull requests']], 'No map from a package to the services and tenants it reaches.'],
      ['Emergency patch and feature-disable workflow', 'tested', [['app/src/lib/flags.ts', 'kill switches'], ['app/src/lib/flags.test.ts', 'kill switch holds'], ['docs/SUPPLY-CHAIN.md', 'the dependency workflow']], 'No written emergency patch path for a dependency with no fix.'],
      ['Supplier-compromise runbook and tabletop exercise', 'not-started', [], 'No runbook and no tabletop.'],
      ['Customer notification when a supply-chain event is material', 'tested', [['app/src/lib/governance/incident-comms.ts', 'audiences, approvers, cadence'], ['app/src/lib/governance/incident-comms.test.ts', 'held']], 'No supply-chain trigger names when it applies.'],
      ['Vendor and third-party component risk register', 'tested', [['app/src/lib/trust/subprocessors.ts', 'every host named'], ['app/src/lib/trust/subprocessors.test.ts', 'held to the CSP']], 'No risk rating or review date per vendor.'],
      ['Corrective actions tracked and re-tested; scan history kept', 'not-started', [], 'Nothing records a finding from report to re-test.'],
    ],
  },
  {
    id: 'CRD',
    title: 'Digital credentials and the Credential Wallet',
    why: 'A student-owned, verifiable record of learning is portable value no LMS offers, but only once issuer, sharing and privacy controls are mature.',
    tier: 2,
    phase: 3,
    master: ['UOS-004', 'UOS-007', 'LMS-015'],
    rows: [
      ['CASE competency and learning-outcome registry', 'not-started', [], 'No competency identifiers anywhere.'],
      ['Skills taxonomy and evidence model', 'tested', [['app/src/lib/skills-graph.ts', 'skills with evidence links'], ['app/src/lib/skills-graph.test.ts', 'held']], 'Free-text skills, not a governed taxonomy.'],
      ['Verified-skills workflow with scoped verifiers', 'building', [['supabase/migrations/20260926150000_expansion_roles_and_features.sql', 'skill_records: student requests, scoped skill:verify decides'], ['supabase/expansion.check.sql', 'SQL check']], 'No screen uses it.'],
      ['Issuer correction and revocation, audited', 'not-started', [['docs/CREDENTIAL-WALLET.md', 'names the gap']], 'Once verified, no policy lets the issuer revise or revoke.'],
      ['Institution issuer governance', 'building', [['supabase/migrations/20260926150000_expansion_roles_and_features.sql', 'skill:verify granted per course or office']], 'No issuer register, no credential type an institution defines.'],
      ['Open Badges support', 'not-started', [['docs/CREDENTIAL-WALLET.md', 'standards order']], 'Nothing exports a badge.'],
      ['Comprehensive Learner Record plan', 'designed', [['docs/CREDENTIAL-WALLET.md', 'CLR-compatible export after the foundation']], 'No mapping written.'],
      ['Student-controlled wallet: private by default, share, revoke, view history', 'designed', [['docs/CREDENTIAL-WALLET.md', 'flows and safeguards'], ['supabase/migrations/20260926150000_expansion_roles_and_features.sql', 'talent_profiles opt-in expires; a receipt per view']], 'Only the employer opt-in exists; named-recipient and time-limited shares do not.'],
      ['Sensitive classes excluded from sharing by default', 'designed', [['docs/CREDENTIAL-WALLET.md', 'grade, disability, financial, health, conduct, immigration, private study']], 'No share model, so no filter.'],
      ['Verifiable portfolio artifacts', 'tested', [['app/src/lib/career-evidence.ts', 'an artifact must cite its course or entry'], ['app/src/lib/career-evidence.test.ts', 'held']], 'Device-local; nothing an outsider can verify.'],
      ['Employer verification flow', 'building', [['supabase/migrations/20260926150000_expansion_roles_and_features.sql', 'employers read opted-in profiles with talent:search']], 'Employers see; they cannot verify a credential.'],
    ],
  },
  {
    id: 'RES',
    title: 'Research ethics and institutional review',
    why: 'Measuring outcomes or publishing on student data without a protocol is how a vendor loses a university.',
    tier: 3,
    phase: 4,
    master: ['SEC-008', 'SEC-009', 'UOS-008'],
    rows: [
      ['Research data governance policy', 'not-started', [['PILOT.md', 'says the pilot is product development, not research']], 'No policy for when it becomes research.'],
      ['IRB decision tree', 'not-started', [], 'Nothing says when a study needs review.'],
      ['Consent and recruitment templates', 'designed', [['PILOT.md', 'consent with optional quoting and a way out'], ['docs/operating-model/RESEARCH-AND-SERVICE-DESIGN.md', 'recruitment matrix']], 'Product research only; no research-study consent.'],
      ['De-identification review', 'not-started', [], 'No review step.'],
      ['Data-access approval workflow', 'building', [['supabase/migrations/20260926150000_expansion_roles_and_features.sql', 'research_partner reads aggregates only, n ≥ 10']], 'No approval record for a partner\'s access.'],
      ['Research partnership agreement', 'not-started', [], 'No template.'],
      ['Publication review', 'designed', [['PILOT.md', 'publication needs IRB review and re-consent']], 'One sentence, no process.'],
      ['Research data retention schedule', 'not-started', [], 'RETENTION.md covers product data only.'],
      ['Participant compensation policy', 'designed', [['PILOT.md', 'no payment, told before that changes'], ['docs/operating-model/ACCESSIBILITY-GOVERNANCE.md', 'paid assistive-tech panel']], 'No research rate or disclosure rule.'],
      ['Methodology and limitations standards', 'tested', [['app/src/lib/institution-ops.ts', 'metric definitions, lineage, pre-registered intervention metric'], ['app/src/lib/institution-ops.test.ts', 'held']], 'Metric-level only; no study-level standard.'],
      ['Independent ethics or advisory review', 'not-started', [], 'None.'],
    ],
  },
  {
    id: 'BCP',
    title: 'Business continuity beyond technology',
    why: 'A company of one is a single point of failure that no restore drill covers.',
    tier: 1,
    phase: 2,
    master: ['SRE-006', 'SRE-010', 'SEC-007', 'SUP-002', 'PRG-001', 'LEG-001'],
    rows: [
      ['Key-person dependency plan', 'not-started', [['ROLLBACK.md', 'names the single owner as a single point of failure']], 'Named, not planned for.'],
      ['Leadership succession and emergency operating authority', 'not-started', [['docs/FEATURE-FLAG-REGISTRY.md', 'kill-switch authority only']], 'No one else can act for the company.'],
      ['Remote-work continuity', 'not-started', [], 'None.'],
      ['Vendor failure contingency', 'designed', [['docs/market-readiness/DISASTER_RECOVERY.md', 'recovery path per component']], 'No exit plan per vendor.'],
      ['Payment-provider outage plan', 'not-started', [['docs/DECISION-LOG.md', 'D-009: no payment processor yet']], 'Not applicable until there is a processor.'],
      ['Domain and DNS recovery', 'not-started', [], 'Registrar access and recovery are undocumented.'],
      ['Identity-provider lockout recovery', 'designed', [['docs/superpowers/specs/2026-09-24-vanderbilt-production-readiness-design.md', 'break-glass admin accounts with MFA and audit']], 'Not built; GitHub and Supabase account lockout not covered.'],
      ['Legal counsel continuity', 'not-started', [], 'No counsel engaged.'],
      ['Customer communication tree', 'tested', [['app/src/lib/governance/incident-comms.ts', 'thirteen audiences, approvers, cadence'], ['app/src/lib/governance/incident-comms.test.ts', 'held']], 'Incident-scoped; no company-event (ownership, closure) path.'],
      ['Media and crisis communications', 'not-started', [['docs/operating-model/TRUST-BRAND-AND-LEGAL.md', 'points crisis comms at incident comms']], 'No media plan.'],
      ['Annual company continuity exercise', 'designed', [['docs/trust/SOC2-READINESS.md', 'incident and DR tabletop planned']], 'None run.'],
    ],
  },
  {
    id: 'ARB',
    title: 'Architecture Review Board',
    why: 'Keeps a large product from becoming a collection of inconsistent technical choices.',
    tier: 1,
    phase: 2,
    master: ['PRG-003', 'SEC-002', 'AI-001', 'AI-002', 'SRE-006', 'SRE-007', 'A11Y-007'],
    rows: [
      ['A board with a charter, members and cadence', 'not-started', [], 'Review is spread across governance docs; no board.'],
      ['Architecture decision records', 'designed', [['docs/architecture/README.md', 'ADRs 0001–0006'], ['DECISIONS.md', 'platform decisions']], 'No rule that a change of this size needs one.'],
      ['Approved technology standards', 'designed', [['docs/design/SEMESTER-UI-CONSTITUTION.md', 'UI components and tokens']], 'UI only; no approved languages, stores or services.'],
      ['Data boundary rules', 'tested', [['app/src/lib/integration/classification.ts', 'T0–T6 classes and allowed destinations'], ['app/src/lib/integration/classification.test.ts', 'held']], 'Integration-scoped.'],
      ['API and integration standards', 'tested', [['app/src/lib/institution-ops.ts', 'API scopes, rate limits, key rotation'], ['app/src/lib/institution-ops.test.ts', 'held']], 'No public API style guide.'],
      ['Deprecation and migration standards', 'tested', [['app/src/lib/institution-ops.ts', 'mayRetire needs 12 months\' notice'], ['app/src/lib/institution-ops.test.ts', 'held']], 'API-scoped.'],
      ['Threat-model review', 'designed', [['docs/INTEGRATION-THREAT-MODEL.md', 'integrations'], ['docs/ai-toolkit/AI-TOOLKIT-THREAT-MODEL.md', 'AI toolkit']], 'Two models; no register or review cadence.'],
      ['Performance and capacity review', 'tested', [['app/src/lib/governance/error-budgets.ts', 'journey SLOs'], ['app/src/lib/governance/error-budgets.test.ts', 'held']], 'No load or capacity test.'],
      ['Accessibility architecture review', 'designed', [['docs/operating-model/ACCESSIBILITY-GOVERNANCE.md', 'review required per extension']], 'No review of core architecture changes.'],
      ['AI model and provider review', 'tested', [['docs/operating-model/AI-GOVERNANCE-BOARD.md', 'board approves provider changes'], ['app/src/lib/governance/ai-lifecycle.test.ts', 'lifecycle gates']], 'Board has no members.'],
      ['Disaster-recovery architecture review', 'designed', [['docs/market-readiness/DISASTER_RECOVERY.md', 'recovery paths']], 'No RTO/RPO; the gateway journal has no backup.'],
      ['Scalability and cost review', 'designed', [['docs/operating-model/COMMERCIAL-GOVERNANCE.md', 'AI cost controls']], 'No cost-per-tenant model reviewed.'],
    ],
  },
  {
    id: 'PRF',
    title: 'Student-owned portable learning profile',
    why: 'A profile that survives courses and institutions, which the student controls and institutions can only add verified elements to.',
    tier: 2,
    phase: 3,
    master: ['STU-008', 'STU-011', 'IAM-002', 'UOS-004', 'UOS-007'],
    rows: [
      ['Academic goals', 'tested', [['app/src/lib/path-profile.ts', 'programme, target term, goals'], ['app/src/lib/path-profile.test.ts', 'held']], 'Not in one exportable profile.'],
      ['Learning preferences', 'tested', [['app/src/lib/aboutme.ts', 'student-typed preferences'], ['app/src/lib/aboutme.test.ts', 'held']], 'Not in one exportable profile.'],
      ['Accessibility preferences', 'building', [['app/src/lib/accessmode.ts', 'accessibility presets']], 'Device-local; accommodation passports are separate and never store diagnoses.'],
      ['Portfolio artifacts and projects', 'tested', [['app/src/lib/career-evidence.ts', 'artifacts, bullets, résumé versions'], ['app/src/lib/career-evidence.test.ts', 'held']], 'Device-local.'],
      ['Verified skills and credentials', 'building', [['supabase/migrations/20260926150000_expansion_roles_and_features.sql', 'skill_records verification']], 'See CRD.'],
      ['Selected learning reflections', 'not-started', [], 'None.'],
      ['Student-controlled sharing', 'tested', [['app/src/lib/advisor-shares.ts', 'scoped, expiring, revocable shares'], ['app/src/lib/sharing.test.ts', 'held']], 'Advisor-scoped only.'],
      ['Exportable record', 'tested', [['app/src/lib/export.ts', 'CSV, Markdown, ICS'], ['app/src/lib/export.test.ts', 'held']], 'Career evidence is not in the export.'],
    ],
  },
  {
    id: 'EVG',
    title: 'Academic and career evidence graph',
    why: 'Shows where a skill came from without inventing a claim: outcome → work → skill → artifact → credential → pathway.',
    tier: 2,
    phase: 3,
    master: ['LMS-015', 'UOS-004'],
    rows: [
      ['Course outcomes', 'tested', [['app/src/lib/institution-ops.ts', 'curriculumMap: course → outcome → skill → credential → career'], ['app/src/lib/institution-ops.test.ts', 'held']], 'No data source feeds it.'],
      ['Assignments and projects → demonstrated skills', 'not-started', [], 'The skills graph reads courses, projects, work and organisations, not assignments.'],
      ['Skills with evidence', 'tested', [['app/src/lib/skills-graph.ts', 'claims with reasons'], ['app/src/lib/skills-graph.test.ts', 'held']], ''],
      ['Portfolio artifacts', 'tested', [['app/src/lib/career-evidence.ts', 'artifact tied to course, tagged with confirmed skills'], ['app/src/lib/career-evidence.test.ts', 'held']], ''],
      ['Verified credentials', 'building', [['app/src/lib/institution-ops.ts', 'a credentials field in curriculumMap']], 'A field, not a credential.'],
      ['Internships, jobs and graduate pathways', 'tested', [['app/src/lib/skills-graph.ts', 'explainFit, missingSkillPlan'], ['app/src/lib/skills-graph.test.ts', 'held']], 'Graduate pathways are not modelled.'],
    ],
  },
  {
    id: 'DQC',
    title: 'Student-facing data-quality correction',
    why: 'Students see wrong data first; letting them flag it gives them agency and fixes the source.',
    tier: 1,
    phase: 2,
    master: ['TRUST-001', 'TRUST-002', 'TRUST-004', 'STU-002', 'STU-004', 'INT-014'],
    rows: [
      ['A student can flag a requirement, section, deadline, material or source', 'tested', [['app/src/lib/actions.ts', 'correct event: say what is wrong'], ['app/src/lib/actions.test.ts', 'held']], 'The five named reasons are free text, not choices.'],
      ['Needs-review label shown on flagged data', 'tested', [['app/src/lib/source.ts', 'needs_review source label'], ['app/src/lib/source.test.ts', 'held']], ''],
      ['Correction queue to the data steward', 'building', [['supabase/migrations/20260926150000_expansion_roles_and_features.sql', 'data_requests kind correct, data_request:handle']], 'A queue with no screen.'],
      ['Routed to the source owner per domain', 'tested', [['app/src/lib/governance/data-contracts.ts', 'correctionProcess per domain'], ['app/src/lib/governance/data-contracts.test.ts', 'held']], ''],
      ['Resolve, reject or needs official review', 'building', [['supabase/migrations/20260926150000_expansion_roles_and_features.sql', 'completed or rejected']], 'No "needs official review" state.'],
      ['Student notified of the outcome', 'designed', [['docs/operating-model/DATA-STEWARDSHIP.md', 'student sees corrected at source']], 'Not built.'],
      ['Correction audited', 'building', [['supabase/migrations/20260926150000_expansion_roles_and_features.sql', 'handled_by, completed_at']], 'No audit view.'],
    ],
  },
  {
    id: 'CGV',
    title: 'Institution content governance',
    why: 'Without an owner and an expiry on every page, a campus hub goes stale in a term.',
    tier: 1,
    phase: 2,
    master: ['UOS-001', 'LMS-002', 'A11Y-006'],
    rows: [
      ['Content owner, department scope and publishing rights', 'building', [['supabase/migrations/20260928302000_office_action_feed.sql', 'offices, publish roles, department scope'], ['supabase/officeactions.check.sql', 'SQL check']], 'Office actions only; campus pages and resources are not covered.'],
      ['Approval status', 'tested', [['app/src/lib/office-actions.ts', 'draft → in review → published → withdrawn'], ['app/src/lib/office-actions.test.ts', 'held']], ''],
      ['Last reviewed, expiry, source URL and audience', 'tested', [['app/src/lib/launch/content.ts', 'owner, source, review period, visibility, expiry'], ['app/src/lib/launch/content.test.ts', 'held']], 'Launch content only.'],
      ['Accessibility status', 'designed', [['docs/operating-model/ACCESSIBILITY-GOVERNANCE.md', 'validated before publishing']], 'No per-item field.'],
      ['Version history', 'tested', [['supabase/migrations/20260928309000_course_studio.sql', 'append-only published versions'], ['app/src/lib/coursestudio.test.ts', 'held']], 'Course Studio only.'],
      ['Retirement and archive policy', 'building', [['supabase/migrations/20260928302000_office_action_feed.sql', 'withdrawn status']], 'Withdrawn, not archived on a schedule.'],
    ],
  },
  {
    id: 'SVC',
    title: 'Service catalogue and service ownership',
    why: 'Each service Semester sells needs an owner, an SLO, a runbook and a way out.',
    tier: 1,
    phase: 2,
    master: ['PRG-003', 'PRG-005', 'SRE-001', 'SRE-002', 'SRE-010'],
    rows: [
      ['A catalogue of services: platform, LMS, AI, LTI, SIS, SSO/SCIM, migration, marketplace, career, support, implementation, analytics, API', 'not-started', [], 'Charters are per feature flag; no service list.'],
      ['Owner, dependencies and data categories', 'tested', [['app/src/lib/governance/charters.ts', 'owners, source dependency, classification'], ['app/src/lib/governance/charters.test.ts', 'every module flag has one']], 'Per flag, not per service.'],
      ['SLO', 'tested', [['app/src/lib/governance/error-budgets.ts', 'journey SLOs'], ['app/src/lib/governance/error-budgets.test.ts', 'held']], ''],
      ['Support tier', 'designed', [['docs/trust/SLA.md', 'SLA framework']], 'Not a commitment.'],
      ['Runbook', 'designed', [['docs/INTEGRATION-OPERATOR-RUNBOOK.md', 'integrations']], 'Most services have none.'],
      ['Status components', 'building', [['.github/workflows/production-smoke.yml', 'hourly probe']], 'No public status page.'],
      ['Cost and security owners', 'building', [['app/src/lib/governance/charters.ts', 'costModel field']], 'No named cost owner.'],
      ['Continuity plan and deprecation policy per service', 'designed', [['docs/operating-model/PORTFOLIO-GOVERNANCE.md', 'sunset process']], 'No per-service continuity.'],
    ],
  },
  {
    id: 'VND',
    title: 'Dependency and vendor observability',
    why: 'Vendor risk on paper does not say what students see when Supabase is down.',
    tier: 1,
    phase: 2,
    master: ['INT-001', 'INT-014', 'AI-003', 'AI-012', 'SEC-010', 'SRE-006'],
    rows: [
      ['Vendor inventory', 'tested', [['app/src/lib/trust/subprocessors.ts', 'every host'], ['app/src/lib/trust/subprocessors.test.ts', 'held to the CSP']], 'No owner, fallback or exit columns.'],
      ['Identity provider: status, fallback, impact', 'designed', [['docs/vanderbilt/incident-routing.md', 'SSO/SCIM row with containment']], 'Owner unassigned.'],
      ['Database (Supabase): status and alerting', 'designed', [['MONITORING.md', 'one alert and a weekly check']], 'No status-source subscription.'],
      ['Application edge: synthetic checks', 'building', [['.github/workflows/production-smoke.yml', 'hourly']], 'Not tied to a customer-impact statement.'],
      ['Email and SMS provider', 'not-started', [], 'None.'],
      ['AI provider: availability and kill switch', 'tested', [['app/src/lib/flags.ts', 'kill.ai_generation'], ['app/src/lib/flags.test.ts', 'held']], 'No provider status subscription.'],
      ['LMS/SIS connectors: owner, retry, dead-letter', 'tested', [['supabase/migrations/20260928040000_integration_quality.sql', 'source owner, backup, escalation'], ['app/src/lib/integration/pipeline.test.ts', 'retry, backoff, dead-letter']], ''],
      ['Payments, calendar/file APIs, monitoring, DNS/CDN', 'not-started', [], 'None observed.'],
      ['Circuit breakers', 'not-started', [], 'Named as a mitigation, not built.'],
      ['Incident communication rule per dependency', 'tested', [['app/src/lib/governance/incident-comms.ts', 'integration_delay audience'], ['app/src/lib/governance/incident-comms.test.ts', 'held']], 'Integrations only.'],
      ['Exit plan per vendor', 'not-started', [], 'None.'],
    ],
  },
  {
    id: 'PPA',
    title: 'Privacy-preserving analytics engineering',
    why: 'Aggregates about students must never become a way to find one.',
    tier: 1,
    phase: 2,
    master: ['UOS-008', 'LMS-017', 'SEC-006', 'SEC-009'],
    rows: [
      ['Aggregation standards', 'tested', [['app/src/lib/institution-ops.ts', 'no per-student grain'], ['app/src/lib/institution-ops.test.ts', 'held']], ''],
      ['Small-cell suppression, primary and complementary', 'tested', [['app/src/lib/institution-ops.ts', 'suppression'], ['app/src/lib/cohortfloor.test.ts', 'held']], ''],
      ['Cohort minimums', 'tested', [['app/src/lib/cohortfloor.test.ts', 'SQL floors equal MIN_COHORT = 10']], ''],
      ['Differential privacy review where appropriate', 'not-started', [], 'None.'],
      ['Metric approval workflow', 'tested', [['app/src/lib/institution-ops.ts', 'sensitive exports need a non-author reviewer'], ['app/src/lib/institution-ops.test.ts', 'held']], ''],
      ['Data-access logging', 'building', [['supabase/migrations/20260921143653_access_log.sql', 'who read your rows']], 'SQL only.'],
      ['Research separated from operational analytics', 'building', [['supabase/migrations/20260926150000_expansion_roles_and_features.sql', 'research_partner aggregates only']], 'No separate store.'],
      ['No re-identification policy', 'tested', [['app/src/lib/institution-ops.ts', 'complementary suppression'], ['app/src/lib/institution-ops.test.ts', 'held']], 'Enforced in code; no written policy a partner signs.'],
      ['Dashboard export controls', 'tested', [['app/src/lib/institution-ops.test.ts', 'exportReport refusals']], ''],
      ['Analytics retention limits', 'tested', [['RETENTION.md', 'activity kept 400 days'], ['app/src/lib/retention.test.ts', 'held']], ''],
      ['Student-facing transparency', 'tested', [['app/src/lib/privacy.ts', 'claims on the Privacy screen'], ['app/src/lib/privacy.test.ts', 'held']], ''],
    ],
  },
  {
    id: 'REL',
    title: 'Release management for institutions',
    why: 'A registrar will not trust a platform that changes under them in finals week.',
    tier: 0,
    phase: 1,
    master: ['SRE-008', 'SRE-009', 'SRE-010', 'PRG-006', 'PRG-007', 'SEC-003'],
    rows: [
      ['Release calendar', 'not-started', [], 'Main deploys on every merge.'],
      ['Customer release notes', 'designed', [['CHANGELOG.md', 'tester-facing changelog']], 'Not written for an institution.'],
      ['Tenant-specific release windows', 'not-started', [], 'None.'],
      ['Preview or staging tenant', 'tested', [['STAGING.md', 'staging'], ['app/src/lib/institutional-preview.test.ts', 'held']], ''],
      ['Beta and early-access agreement', 'tested', [['docs/PRIVATE-BETA-PROGRAM.md', 'invite-only rules'], ['app/src/lib/beta.test.ts', 'held']], ''],
      ['Feature-flag rollout', 'tested', [['app/src/lib/flags.ts', 'off, preview, sandbox, production per tenant'], ['app/src/lib/flags.test.ts', 'held']], ''],
      ['Canary releases', 'not-started', [], 'None.'],
      ['Rollback commitments', 'tested', [['ROLLBACK.md', 'any earlier ref'], ['app/src/lib/rollback.test.ts', 'held']], 'No drill evidence.'],
      ['Change impact assessment: security, privacy, accessibility, data, integration, training, support', 'not-started', [], 'release-readiness scores a feature, not a change.'],
      ['Customer notification rules', 'tested', [['app/src/lib/governance/incident-comms.ts', 'rollback and maintenance audiences'], ['app/src/lib/governance/incident-comms.test.ts', 'held']], ''],
      ['Post-release verification', 'building', [['.github/workflows/production-smoke.yml', 'hourly synthetic check']], 'Not triggered by a release.'],
    ],
  },
  {
    id: 'ETH',
    title: 'Compensation, incentives and sales ethics',
    why: 'Incentives that reward overselling undo every trust control in this register.',
    tier: 1,
    phase: 2,
    master: ['PRG-002', 'COM-002', 'COM-004'],
    rows: [
      ['Sales compensation that does not reward overselling', 'not-started', [], 'No sales team yet; write it before hiring one.'],
      ['Customer-success incentives tied to adoption and renewal', 'not-started', [], 'None.'],
      ['Ambassador disclosure and compensation', 'designed', [['docs/LAUNCH-CONTENT-AND-TRAINING.md', 'never paid per sign-up']], 'No disclosure text.'],
      ['Partner referral disclosure', 'not-started', [], 'None.'],
      ['Executive conflict-of-interest policy', 'not-started', [], 'None.'],
      ['Gift and procurement ethics policy', 'not-started', [], 'None.'],
      ['Customer reference permission', 'designed', [['docs/PILOT-TO-ANNUAL-CONVERSION.md', 'written consent, no sub-threshold outcomes']], ''],
      ['Responsible marketing review', 'tested', [['app/src/lib/marketreadiness.test.ts', 'claims held to code'], ['app/src/lib/gtm/rfp.test.ts', 'RFP answers need evidence']], ''],
    ],
  },
  {
    id: 'WFA',
    title: 'Workforce accessibility and inclusion',
    why: 'A company that sells accessibility should be one people with disabilities can work at.',
    tier: 1,
    phase: 2,
    master: [],
    rows: [
      ['Accessible hiring and interview accommodations', 'not-started', [], 'No hiring process yet.'],
      ['Accessible internal tools and documents', 'not-started', [], 'Product accessibility only.'],
      ['Captioned meetings', 'not-started', [], 'None.'],
      ['Neurodiversity-inclusive practices and support structures', 'not-started', [], 'None.'],
      ['Inclusive performance review', 'not-started', [], 'None.'],
      ['Manager accessibility training', 'not-started', [], 'None.'],
    ],
  },
  {
    id: 'KNW',
    title: 'Knowledge retention and onboarding',
    why: 'Company knowledge cannot live only in the founder\'s head.',
    tier: 1,
    phase: 2,
    master: ['COM-003'],
    rows: [
      ['Decision log and ADRs', 'designed', [['docs/DECISION-LOG.md', 'product decisions'], ['docs/architecture/README.md', 'ADRs']], ''],
      ['Product requirement archive', 'designed', [['docs/PLATFORM_REQUIREMENTS.md', 'requirements']], ''],
      ['Customer implementation library', 'designed', [['docs/superpowers/plans/2026-09-24-vanderbilt-06-accessibility-legal.md', 'dated implementation plans']], 'Plans, not a library of customer implementations.'],
      ['Incident learning library', 'not-started', [], 'No post-incident reviews kept.'],
      ['Sales and procurement FAQ', 'tested', [['app/src/lib/gtm/rfp.ts', 'answers need evidence and status'], ['app/src/lib/gtm/rfp.test.ts', 'held']], ''],
      ['Engineering onboarding', 'designed', [['SETUP.md', 'setup'], ['REGRESSION-CHECKLIST.md', 'the gates']], ''],
      ['Role-specific playbooks', 'designed', [['docs/market-readiness/SUPPORT_PLAYBOOK.md', 'support'], ['docs/INTEGRATION-OPERATOR-RUNBOOK.md', 'integration']], ''],
      ['Documentation ownership and expiry', 'building', [['app/src/lib/runbooklinks.test.ts', 'no dead links in operational docs']], 'No owner or expiry per doc.'],
      ['Internal search', 'not-started', [], 'None beyond the repository.'],
      ['Succession handover checklists', 'not-started', [], 'None.'],
    ],
  },
  {
    id: 'IOP',
    title: 'Public interoperability commitment',
    why: 'Institutions wary of lock-in buy from vendors who promise the way out in public.',
    tier: 2,
    phase: 3,
    master: ['LEG-004', 'INT-006', 'INT-007', 'INT-008'],
    rows: [
      ['Open standards commitment', 'designed', [['docs/FERPA-COPPA-1EDTECH-READINESS.md', '1EdTech readiness register']], 'Internal; not published.'],
      ['Data portability promise', 'designed', [['docs/DATA-PORTABILITY-AND-OFFBOARDING.md', 'portability and offboarding']], 'Internal; not published.'],
      ['Integration plan', 'designed', [['docs/operating-model/PILOT-TO-PRODUCTION.md', 'LMS interoperability phase']], 'Internal.'],
      ['Customer export commitment', 'tested', [['app/src/lib/export.ts', 'exports'], ['app/src/lib/export.test.ts', 'held']], 'Student export; no tenant bulk export commitment.'],
      ['No unnecessary lock-in policy', 'designed', [['docs/operating-model/DEFENSIBILITY.md', 'data portability, not lock-in']], 'Internal.'],
      ['Standards conformance evidence', 'tested', [['app/src/lib/integration/providers.ts', 'certified only with dated, person-verified evidence'], ['app/src/lib/integration/quality.test.ts', 'held']], 'No certification held.'],
    ],
  },
  {
    id: 'BEN',
    title: 'Higher-ed operating benchmark',
    why: 'A published benchmark positions Semester as a strategic voice, not only a vendor — with methodology and privacy first.',
    tier: 3,
    phase: 3,
    master: [],
    rows: [
      ['A benchmark programme with methodology and privacy review', 'designed', [['docs/operating-model/DEFENSIBILITY.md', 'annual aggregated outcome benchmarks']], 'No methodology.'],
      ['Navigation friction', 'tested', [['app/src/lib/institution-ops.ts', 'workflow_friction metric'], ['app/src/lib/institution-ops.test.ts', 'held']], 'Definition only.'],
      ['Registration readiness', 'tested', [['app/src/lib/institution-ops.ts', 'registration_ready cohort metric'], ['app/src/lib/institution-ops.test.ts', 'held']], 'Definition only.'],
      ['Accessibility, AI governance and integration maturity', 'tested', [['app/src/lib/integration/providers.ts', 'maturity ladder'], ['app/src/lib/governance/ai-lifecycle.test.ts', 'AI gates']], 'No institution-facing maturity scale.'],
      ['Student data transparency and advising preparation', 'tested', [['app/src/lib/advisor-meeting.ts', 'advising prep'], ['app/src/lib/advisor-meeting.test.ts', 'held']], ''],
      ['Career evidence maturity', 'not-started', [], 'None.'],
    ],
  },
  {
    id: 'OUT',
    title: 'Outcome and impact evidence programme',
    why: 'An outcome claim without a protocol and an independent evaluator is marketing.',
    tier: 2,
    phase: 3,
    master: ['SUP-003', 'UOS-008'],
    rows: [
      ['Theory of change and outcome taxonomy', 'tested', [['app/src/lib/institution-ops.ts', 'metric dictionary'], ['app/src/lib/institution-ops.test.ts', 'held'], ['docs/operating-model/COMMERCIAL-GOVERNANCE.md', 'outcome ladder']], 'No written theory of change.'],
      ['Measurement plan', 'tested', [['app/src/lib/gtm/pilot.ts', 'baseline required per metric'], ['app/src/lib/gtm/pilot.test.ts', 'held']], ''],
      ['Institution-approved research protocol', 'not-started', [], 'None.'],
      ['Cohort comparison methodology', 'building', [['app/src/lib/institution-ops.ts', 'pre-registered matched cohort, definition only']], 'Never run.'],
      ['Confounder and limitation disclosure', 'designed', [['docs/operating-model/COMMERCIAL-GOVERNANCE.md', 'careful attribution']], ''],
      ['Aggregate reporting', 'tested', [['app/src/lib/cohortfloor.test.ts', 'floors']], ''],
      ['Case-study standards', 'designed', [['docs/PILOT-TO-ANNUAL-CONVERSION.md', 'consent and thresholds']], ''],
      ['Independent evaluation partner', 'not-started', [], 'None.'],
    ],
  },
  {
    id: 'CNL',
    title: 'Strategic customer councils',
    why: 'Each constituency with a charter, a cadence and visible decisions, not just an advisory board.',
    tier: 2,
    phase: 3,
    master: ['AI-001', 'PRG-001'],
    rows: [
      ['Student council', 'not-started', [['docs/operating-model/AI-GOVERNANCE-BOARD.md', 'a student seat on the AI board only']], 'None.'],
      ['Faculty council', 'not-started', [], 'A faculty seat on the AI board only.'],
      ['Advisor, registrar and CIO/CISO councils', 'not-started', [], 'None.'],
      ['Accessibility council', 'designed', [['docs/operating-model/ACCESSIBILITY-GOVERNANCE.md', 'paid assistive-tech panel, monthly']], 'No members.'],
      ['AI governance council', 'designed', [['docs/operating-model/AI-GOVERNANCE-BOARD.md', 'membership, quorum, quarterly']], 'No members, no compensation policy.'],
      ['Enterprise customer council', 'designed', [['docs/operating-model/RESEARCH-AND-SERVICE-DESIGN.md', 'annual customer advisory board']], 'No members.'],
    ],
  },
];

export const AREAS: readonly Area[] = AREA_LIST.map(({ rows: _rows, ...a }) => a);

export const ITEMS: readonly Item[] = AREA_LIST.flatMap((a) =>
  a.rows.map(([item, status, evidence, gap], i) => ({
    id: `${a.id}-${String(i + 1).padStart(3, '0')}`,
    item,
    status,
    evidence: evidence.map(([path, shows]) => ({ path, shows })),
    // `tested` is a claim about code; with nothing else missing in the
    // repository, what is left is always the same thing.
    gap: gap || 'Held in code; nothing under docs/evidence/ shows it operating.',
  })),
);

export const areaOf = (id: string) => AREAS.find((a) => a.id === id.split('-')[0])!;

/**
 * The roadmap mapping: each phase's capabilities, who owns them, what proves
 * the phase is done, and where the repository tracks each.
 */
export const PHASE_EXITS: readonly { phase: Phase; capability: string; owner: string; exit: string; tracked: string }[] = [
  { phase: 0, capability: 'NIST CSF, Privacy Framework and AI RMF mapping', owner: 'Security, privacy, AI', exit: 'Framework crosswalk and risk register', tracked: 'expansiongovernance.ts FRAMEWORKS' },
  { phase: 0, capability: 'Tenant, RLS and object authorization', owner: 'Security, platform', exit: 'Automated positive and negative access tests', tracked: 'master IAM rows' },
  { phase: 0, capability: 'Secure SDLC and supply-chain basics', owner: 'Engineering, security', exit: 'MFA, branch protection, scans, lockfiles, SBOM', tracked: 'SUP' },
  { phase: 0, capability: 'Design system and WCAG baseline', owner: 'Design, accessibility', exit: 'Keyboard, reflow, contrast and component tests', tracked: 'master UX and A11Y rows' },
  { phase: 0, capability: 'Data inventory and lineage baseline', owner: 'Privacy, data', exit: 'Data map, classification, retention matrix', tracked: 'master TRUST rows' },
  { phase: 0, capability: 'SLOs, monitoring, backup and restore', owner: 'SRE', exit: 'Dashboards, restore drill, incident runbook', tracked: 'master SRE rows' },
  { phase: 0, capability: 'Claims, trust and procurement foundations', owner: 'Legal, security, marketing', exit: 'Trust Center, HECVAT/VPAT request process', tracked: 'master SEC and LEG rows' },
  { phase: 1, capability: 'Student platform and real auth', owner: 'Product, engineering', exit: 'Real account and persistence UAT', tracked: 'master STU and IAM rows' },
  { phase: 1, capability: 'Native LMS critical workflows', owner: 'LMS, product', exit: 'Course lifecycle, assessment and gradebook UAT', tracked: 'master LMS rows' },
  { phase: 1, capability: 'SSO, LTI and SIS integration base', owner: 'Integration', exit: 'Positive, negative, security and reconciliation tests', tracked: 'master INT rows' },
  { phase: 1, capability: 'AI source, policy and evaluation controls', owner: 'AI lead', exit: 'Eval, red-team and kill-switch evidence', tracked: 'master AI rows' },
  { phase: 1, capability: 'Billing, entitlement and support', owner: 'Commercial, support', exit: 'Checkout, cancel, dunning and support drills', tracked: 'master COM and SUP rows' },
  { phase: 1, capability: 'HECVAT, VPAT, DPA and SLA', owner: 'Security, accessibility, legal', exit: 'Current scoped evidence package', tracked: 'master SEC rows' },
  { phase: 1, capability: 'Release management for institutions', owner: 'Engineering, implementation', exit: 'Calendar, release notes, canary and change-impact records', tracked: 'REL' },
  { phase: 1, capability: 'Supply-chain security programme', owner: 'Engineering, security', exit: 'SBOM, scan, patch, provenance and CI evidence', tracked: 'SUP' },
  { phase: 2, capability: 'Data quality console and student correction', owner: 'Data, privacy, integration', exit: 'Freshness, reconciliation and correction workflows', tracked: 'DQC' },
  { phase: 2, capability: 'Content governance, service catalogue, vendor observability', owner: 'Operations', exit: 'Every service and vendor with owner, SLO, fallback and exit', tracked: 'CGV, SVC, VND' },
  { phase: 2, capability: 'Privacy-preserving analytics', owner: 'Data, privacy', exit: 'Written re-identification policy and access-log review', tracked: 'PPA' },
  { phase: 2, capability: 'Company continuity, ARB, ethics, workforce and knowledge', owner: 'Executive', exit: 'Succession plan, board charter, policies, first continuity exercise', tracked: 'BCP, ARB, ETH, WFA, KNW' },
  { phase: 3, capability: 'Credential Wallet foundation', owner: 'Product, career, privacy', exit: 'Evidence, share, revoke and export UAT', tracked: 'CRD, PRF' },
  { phase: 3, capability: 'Skills and evidence graph; verified skills', owner: 'Product, learning, career', exit: 'Course-to-skill model and verifier workflow', tracked: 'EVG, CRD' },
  { phase: 3, capability: 'CASE identifiers; Open Badges and CLR export pilot', owner: 'Curriculum, integration', exit: 'Standards-valid export with issuer controls', tracked: 'CRD' },
  { phase: 3, capability: 'Public interoperability and portability commitment', owner: 'Product, legal', exit: 'Published commitments mapped to controls', tracked: 'IOP' },
  { phase: 3, capability: 'Outcome evidence, benchmark and councils', owner: 'Research, product', exit: 'Protocol, methodology review, chartered councils', tracked: 'OUT, BEN, CNL' },
  { phase: 4, capability: 'Credential issuer network and employer verification', owner: 'Partnerships', exit: 'Issuer governance, revocation, verification API, contracts', tracked: 'CRD' },
  { phase: 4, capability: 'Research programme', owner: 'Research, privacy', exit: 'IRB, governance and methodology evidence', tracked: 'RES' },
  { phase: 4, capability: 'Partner certification, localization, ISO programmes', owner: 'Partnerships, security', exit: 'A business case and gap assessment each', tracked: 'expansiongovernance.ts FRAMEWORKS' },
];

/** The immediate next actions the plan lists, and where each stands. */
export const NEXT_ACTIONS: readonly { action: string; state: 'done-here' | 'in-progress' | 'open'; where: string }[] = [
  { action: 'Establish the supply-chain register and CI/CD controls', state: 'done-here', where: 'docs/SUPPLY-CHAIN.md, SUP' },
  { action: 'Add SBOM generation to the release process', state: 'done-here', where: '.github/workflows/pages.yml' },
  { action: 'Create the data lineage and source-of-truth catalogue', state: 'in-progress', where: 'docs/FIELD-LINEAGE-AND-SOURCE-FRESHNESS.md; master TRUST rows' },
  { action: 'Adopt the immediate framework stack', state: 'in-progress', where: 'expansiongovernance.ts FRAMEWORKS — adopt now, mapping not written' },
  { action: 'Put the Credential Wallet in Phase 3, after data, privacy and issuer governance', state: 'done-here', where: 'docs/CREDENTIAL-WALLET.md; CRD is Tier 2, Phase 3' },
  { action: 'Run a quarterly prioritisation review with the scoring model', state: 'open', where: 'expansiongovernance.ts priority(); docs/operating-model/OPERATING-RHYTHM.md holds the quarterly portfolio review' },
  { action: 'Require the decision gate for every long-horizon capability', state: 'done-here', where: 'expansiongovernance.ts admit()' },
];
