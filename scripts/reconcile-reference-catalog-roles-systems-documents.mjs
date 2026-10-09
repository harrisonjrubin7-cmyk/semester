#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const EXPECTED_ARCHIVE = '12edfe6ad1c1c02e7c4f0512f1ca4233b0b9f3943b30adde822bd67062867086';
const root = resolve(import.meta.dirname, '..');
const referenceRoot = resolve(process.argv[2] ?? '');

if (!process.argv[2] || !referenceRoot.endsWith(EXPECTED_ARCHIVE)) {
  throw new Error(`Pass the extracted reference root ending in ${EXPECTED_ARCHIVE}`);
}

const read = (path) => readFileSync(resolve(root, path), 'utf8');
const source = readFileSync(resolve(referenceRoot, 'ui_kits/master-catalog/catalog-data.js'), 'utf8');
const firstBrace = source.indexOf('{');
const lastBrace = source.lastIndexOf('}');
if (firstBrace < 0 || lastBrace <= firstBrace) throw new Error('Could not locate catalog JSON');
const catalog = JSON.parse(source.slice(firstBrace, lastBrace + 1));

const dispositions = {
  incomplete: 'Existing but incomplete',
  missing: 'Missing and in scope',
  duplicate: 'Duplicate or superseded',
  roadmap: 'Documentation or roadmap only',
  blocked: 'Blocked by external authority, credentials, vendor, environment, legal review, staffing, or institutional decision',
  excluded: 'Intentionally excluded with a repository-backed rationale',
};

const launchRoles = new Set(
  [...read('docs/ROLE-LAUNCH-REGISTER.md').matchAll(/^\| `([^`]+)` \|/gm)].map((match) => match[1]),
);

const roleMap = {
  'Prospective student': ['incomplete', 'prospective_student', 'R1'],
  Applicant: ['roadmap', 'none', 'R5'],
  Student: ['incomplete', 'student', 'R1'],
  'Transfer student': ['incomplete', 'transfer_student', 'R1'],
  'Online student': ['duplicate', 'student', 'R2'],
  'Adult learner': ['duplicate', 'student', 'R2'],
  'Graduate student': ['incomplete', 'graduate_student', 'R1'],
  'International student': ['duplicate', 'student', 'R2'],
  'Student athlete': ['duplicate', 'student', 'R2'],
  'Student worker': ['duplicate', 'student', 'R2'],
  'Student parent/caregiver': ['duplicate', 'student', 'R2'],
  Alumni: ['incomplete', 'alumni', 'R1'],
  'Family/guardian': ['incomplete', 'none', 'R3'],
  'Faculty/instructor': ['incomplete', 'faculty', 'R1'],
  'Teaching assistant': ['incomplete', 'teaching_assistant', 'R1'],
  'Department chair': ['incomplete', 'department_chair', 'R1'],
  'Program director': ['duplicate', 'department_chair; dean', 'R2'],
  'Academic advisor': ['incomplete', 'academic_advisor', 'R1'],
  'Student success staff': ['incomplete', 'academic_advisor; first_year_staff', 'R1'],
  'Registrar staff': ['incomplete', 'registrar', 'R1'],
  'Financial aid staff': ['incomplete', 'financial_aid_officer', 'R1'],
  'Student accounts staff': ['incomplete', 'student_accounts_officer', 'R1'],
  'Admissions staff': ['roadmap', 'none', 'R5'],
  'Housing staff': ['incomplete', 'residence_life_staff', 'R1'],
  'Dining/campus-card staff': ['incomplete', 'dining_staff', 'R1'],
  'Library staff': ['duplicate', 'learning_center_staff; university_staff', 'R2'],
  'Accessibility/disability services': ['incomplete', 'disability_services_officer; disability_services_staff', 'R1'],
  'Counseling/wellbeing staff': ['incomplete', 'counseling_liaison', 'R1'],
  'Career staff': ['incomplete', 'career_center_staff; career_coach', 'R1'],
  Employer: ['incomplete', 'employer', 'R1'],
  Mentor: ['duplicate', 'peer_mentor; alumni', 'R2'],
  'Peer mentor': ['incomplete', 'peer_mentor', 'R1'],
  'Campus safety staff': ['roadmap', 'none', 'R5'],
  'Community moderator': ['incomplete', 'moderator; trust_safety_reviewer', 'R1'],
  'Student organization leader': ['incomplete', 'organization_officer', 'R1'],
  'Institutional IT': ['incomplete', 'integration_admin', 'R1'],
  'Institutional security/privacy': ['incomplete', 'trust_officer; compliance_owner; data_steward', 'R1'],
  'Institutional executive': ['incomplete', 'dean; university_admin', 'R1'],
  'Institutional auditor': ['incomplete', 'institutional_researcher; trust_officer', 'R1'],
  'Semester support operator': ['incomplete', 'support_agent', 'R4'],
  'Semester implementation lead': ['incomplete', 'implementation_manager', 'R4'],
  'Semester customer-success manager': ['incomplete', 'customer_success', 'R4'],
  'Semester revenue operations': ['incomplete', 'account_executive; business_admin', 'R4'],
  'Semester finance operator': ['incomplete', 'finance_operator', 'R4'],
  'Semester security operator': ['incomplete', 'incident_responder; trust_officer', 'R4'],
  'Semester privacy/legal operator': ['incomplete', 'compliance_owner; data_steward', 'R4'],
  'Semester product operator': ['incomplete', 'platform_admin; content_owner', 'R4'],
  'Semester executive': ['incomplete', 'business_admin', 'R4'],
  'Developer/partner': ['roadmap', 'none', 'R6'],
};

const roleProfiles = {
  R1: {
    owner: 'docs/ROLE-LAUNCH-REGISTER.md; supabase/migrations/20260921223000_role_grants.sql',
    contract: 'Use the current role/capability/grant model, exact institution or relationship scope, deny-by-default server checks, revocation and positive/negative authorization tests. A modeled role is not launch-approved.',
    basis: 'The archive persona maps to one or more current grantable roles. Current launch evidence remains incomplete and no role is launch-approved.',
  },
  R2: {
    owner: 'docs/ROLE-LAUNCH-REGISTER.md; docs/ROLE-PERMISSION-MATRIX.md',
    contract: 'Represent learner context, program or service assignment as scoped attributes or relationships unless a distinct permission boundary is proven; do not create a text-role alias.',
    basis: 'The archive label is a persona or organizational synonym, not evidence for a new authorization principal. Current roles and scoped relationships supersede it.',
  },
  R3: {
    owner: 'app/src/screens/Family.tsx; app/src/components/FamilySharing.tsx; app/src/lib/familyshare.ts',
    contract: 'Student-created, field-minimized delegated grant with expiry, revocation, read audit and no independent access to academic records.',
    basis: 'Family access exists as a consent-bound grant rather than a broad app role; the end-to-end experience remains incomplete.',
  },
  R4: {
    owner: 'docs/ROLE-LAUNCH-REGISTER.md; app/src/components/console/; app/src/lib/console/',
    contract: 'Time- and tenant-scoped operational duty, least privilege, audit-before-action, approval for consequential actions and no implicit student-record access.',
    basis: 'The current platform role model contains the operational analogue, but supportability and launch approval remain incomplete.',
  },
  R5: {
    owner: 'docs/master/SEMESTER_ROLE_CATALOG.md; docs/master/REPO_AUDIT.md',
    contract: 'Requires a current product owner, institutional authority/data contract, permission model and accepted workflow before a grantable role or dedicated surface may be added.',
    basis: 'The archive names a persona but current repository authority does not establish a distinct production role or a dependency-ready workflow for it.',
  },
  R6: {
    owner: 'docs/API-PLATFORM.md; docs/decisions/D-1287.md',
    contract: 'Requires a newer human decision, partner security model, tenant/scopes contract and lifecycle independent of the declined marketplace concept.',
    basis: 'D-1287 keeps developer platform and marketplace concepts at roadmap status; archive role text is not newer authority.',
  },
};

const systemProfiles = {
  S1: ['app/server/institution/auth.ts; docs/ROLE-LAUNCH-REGISTER.md; supabase/migrations/', 'Identity, tenant and policy controls require server-side deny-by-default enforcement, tenant isolation, auditable grants/revocation and current RLS checks.'],
  S2: ['app/src/screens/; app/src/components/; app/src/lib/', 'Student-owned behavior requires persistence, provenance/freshness, explicit and reversible actions, complete states, accessibility, 320px behavior and focused journey tests.'],
  S3: ['app/src/components/CourseStudio.tsx; app/src/lib/enrollment/; app/src/lib/record/; supabase/migrations/', 'Academic behavior requires course/role scope, official-source ownership, audited and recoverable consequential actions, reconciliation and faculty/student/registrar tests.'],
  S4: ['app/src/screens/University.tsx; app/src/screens/Community.tsx; app/src/components/community/; app/server/institution/', 'Campus, support and community behavior requires exact relationship scope, minimum necessary data, abuse/rate controls, appeal or office handoff and tenant-isolation tests.'],
  S5: ['app/src/screens/Career.tsx; app/src/screens/Family.tsx; app/src/lib/finance/; app/src/lib/career.ts', 'Finance, career and delegated access require official or student-granted authority, validation, audit, idempotency where consequential, revocation/reconciliation and cross-role tests.'],
  S6: ['app/src/ai/; app/src/lib/governance/; app/server/institution/ai-data-class.ts', 'AI requests require the policy ceiling, minimization, exact tool permission, source provenance, refusal/recovery, evaluation, audit and human escalation.'],
  S7: ['app/src/components/institutional/; app/src/lib/integration/; app/server/integration/; docs/trust/', 'Integration and trust controls require approved scopes, server-held credentials, versioned mappings, reconciliation, rollback/degraded behavior, evidence expiry and security tests.'],
  S8: ['app/src/components/console/; app/src/lib/console/; docs/company/; docs/commercial/', 'Company operations require scoped operational roles, approved claims/metrics, audit and separation from student records; documents and schemas alone do not prove an operated system.'],
};

const systemProfile = (name, group) => {
  if (group === 'Platform control systems') return 'S7';
  if (['Identity', 'Authorization', 'Tenant', 'Profile'].includes(name)) return 'S1';
  if (['Student Workspace', 'Task', 'Calendar', 'Notes', 'Files', 'Search', 'Knowledge Graph', 'Academic Path', 'Notification', 'Communication'].includes(name)) return 'S2';
  if (['Course', 'Learning', 'Assessment', 'Gradebook', 'Registration', 'Academic Record', 'Degree Audit', 'Transfer', 'Student Success'].includes(name)) return 'S3';
  if (['Support', 'Appointment', 'Community', 'Organization', 'Campus Services', 'Housing', 'Dining'].includes(name)) return 'S4';
  if (['Financial Account', 'Payment Plan', 'Career', 'Skills', 'Credential', 'Family/Guardian'].includes(name)) return 'S5';
  if (['AI Gateway', 'AI Policy Engine', 'AI Evaluation'].includes(name)) return 'S6';
  if (['Integration', 'Migration', 'Trust', 'Compliance', 'Privacy', 'Security', 'Audit', 'Release'].includes(name)) return 'S7';
  return 'S8';
};

const systemOverrides = new Map([
  ['Product systems/Marketplace', ['excluded', 'S4', 'D-1287 declines the marketplace and its data model; no newer decision reopens it.']],
  ['Product systems/Developer Platform', ['roadmap', 'S7', 'D-1287 retains a developer platform as roadmap-only and separate authority is required.']],
  ['Product systems/Board/Investor Reporting', ['roadmap', 'S8', 'Current board materials are documents and templates, not evidence of an operated reporting system or authorized investor portal.']],
  ['Platform control systems/Projection/Read Models', ['missing', 'S7', 'SEMESTER_MASTER_CURRENT_STATE records no projection worker, watermarks, read-model registry or rebuild path.']],
]);

const documentEvidence = {
  SEMESTER_UNIFIED_EDUCATION_OS_THESIS: 'docs/product/SEMESTER_UNIFIED_EDUCATION_OS_THESIS.md',
  EDUCATION_GRAPH_ARCHITECTURE: 'docs/product/EDUCATION_GRAPH_ARCHITECTURE.md',
  ROLE_EXPERIENCE_MATRIX: 'docs/product/ROLE_EXPERIENCE_MATRIX.md; docs/ROLE-LAUNCH-REGISTER.md',
  DOMAIN_AUTHORITY_MATRIX: 'docs/master/SEMESTER_DOMAIN_AUTHORITY_MATRIX.md',
  DOMAIN_REPLACEMENT_MATRIX: 'docs/product/DOMAIN_REPLACEMENT_MATRIX.md; docs/DOMAIN-REPLACEMENT-REGISTER.md',
  CONNECT_REPLACE_OPERATE_STRATEGY: 'docs/product/CONNECT_REPLACE_OPERATE_STRATEGY.md',
  INTEROPERABILITY_AND_MIGRATION_STRATEGY: 'docs/product/INTEROPERABILITY_AND_MIGRATION_STRATEGY.md',
  PRODUCT_COHERENCE_MODEL: 'docs/finish-line/SEMESTER_PRODUCT_COHERENCE_AUDIT.md',
  PRODUCT_NAVIGATION_SYSTEM: 'docs/design/DESIGN-SYSTEM-PRODUCT-SPEC.md; app/src/lib/nav.ts',
  MOBILE_AND_DESKTOP_INTERACTION_MODEL: 'docs/CROSS-DEVICE-CONTINUITY.md; app/src/lib/media.ts',
  DESIGN_SYSTEM_GUIDE: 'docs/design-system/README.md; DESIGN-SYSTEM-GUIDE.md',
  ACCESSIBILITY_ARCHITECTURE: 'docs/accessibility/PROGRAM.md; docs/accessibility/ACCEPTANCE-CRITERIA.md',
  COURSE_STUDIO_SPEC: 'docs/FACULTY-COURSE-STUDIO-DESIGN.md',
  LEARNING_OBJECTIVE_MODEL: 'docs/LEARNING-ASSESSMENT-GRADEBOOK-REGISTER.md; app/src/lib/coursestudio.ts',
  ASSESSMENT_AND_GRADEBOOK_SPEC: 'docs/LEARNING-ASSESSMENT-GRADEBOOK-REGISTER.md',
  ACADEMIC_INTEGRITY_POLICY: 'docs/learning-integrity/04-ACADEMIC-INTEGRITY-CONTROLS.md',
  ACADEMIC_RECORD_LEDGER_SPEC: 'docs/learning-university-systems/ACADEMIC-RECORDS-DATA-MODEL.md',
  REGISTRATION_ENGINE_SPEC: 'docs/learning-university-systems/REGISTRATION-READINESS-SPEC.md',
  DEGREE_AUDIT_SPEC: 'docs/learning-university-systems/DEGREE-PLANNING-AND-AUDIT-SPEC.md',
  TRANSFER_AND_ARTICULATION_SPEC: 'docs/TRANSFER-TRANSITION-HUB.md',
  FACULTY_WORKSPACE_SPEC: 'docs/FACULTY-COURSE-STUDIO-DESIGN.md',
  STUDENT_SUCCESS_MODEL: 'docs/learning-university-systems/STUDENT-SUCCESS-OPERATING-MODEL.md',
  AI_GOVERNANCE_POLICY: 'docs/legal-drafts/AI-USE-AND-DATA-GOVERNANCE-POLICY-DRAFT.md; docs/ai-governance/README.md',
  AI_MODEL_ROUTING: 'docs/product/AI_GOVERNANCE_AND_MODEL_ROUTING.md',
  AI_DATA_CLASSIFICATION: 'docs/trust/DATA-CLASSIFICATION-STANDARD.md',
  AI_EVALUATION_HARNESS: 'docs/AI-RECOMMENDATION-EVALUATION-HARNESS.md',
  AI_RED_TEAM_PLAN: 'docs/ai-governance/10-red-team-and-launch-gates.md',
  AI_PROVIDER_REGISTRY: 'docs/ai-governance/02-model-gateway.md; app/src/ai/providers/',
  AI_COURSE_POLICY_MODEL: 'docs/ai-toolkit/RUBRIC-AND-AI-USE-POLICY.md; app/src/lib/coursestudio.ts',
  AI_SPEND_AND_QUOTA_POLICY: 'docs/sre/runbooks/RB-05-ai-provider-or-spend.md; docs/ai-governance/02-model-gateway.md',
  AI_INCIDENT_RESPONSE: 'docs/ai-governance/07-incident-response-and-shutdown.md',
  AI_TRANSPARENCY_UX: 'docs/ai-governance/09-user-transparency.md',
  LTI_IMPLEMENTATION: 'docs/LTI-1.3-LAUNCH-RUNBOOK.md; docs/institutional-readiness/LTI-READINESS.md',
  ONEROSTER_IMPLEMENTATION: 'docs/institutional-readiness/ONEROSTER-READINESS.md',
  EDU_API_STRATEGY: 'docs/API-PLATFORM.md; docs/INTEGRATION-CONTROL-PLANE.md',
  SIS_ERP_MIGRATION_FACTORY: 'docs/master/SEMESTER_MIGRATION_FACTORY.md',
  INTEGRATION_GOVERNANCE: 'docs/INTEGRATION-CONTROL-PLANE.md; docs/INTEGRATION-PERMISSION-MATRIX.md',
  DATA_MAPPING_STANDARD: 'docs/institutional-readiness/DATA-MAPPING-TEMPLATE.md',
  RECONCILIATION_STANDARD: 'docs/INTEGRATION-QUALITY-AND-RECONCILIATION.md',
  DUAL_RUN_AND_CUTOVER: 'docs/migration/05-REHEARSAL-PARALLEL-RUN-CUTOVER-ROLLBACK.md',
  ROLLBACK_STANDARD: 'docs/engineering-operations/MIGRATION-AND-ROLLBACK-RUNBOOK.md',
  INTEGRATION_OFFBOARDING: 'docs/DATA-PORTABILITY-AND-OFFBOARDING.md',
  SECURITY: 'docs/business/compliance/CLOUD_SECURITY_PLAN.md; docs/SECURITY-THREAT-MODEL.md',
  PRIVACY: 'docs/institutional-readiness/INSTITUTIONAL-PRIVACY-PACKAGE.md',
  ACCESSIBILITY: 'docs/accessibility/PROGRAM.md; docs/accessibility/TESTING-AND-EVIDENCE.md',
  DATA_INVENTORY: 'docs/DATA-INVENTORY-AND-LINEAGE.md',
  DATA_CLASSIFICATION: 'docs/trust/DATA-CLASSIFICATION-STANDARD.md',
  DATA_RETENTION: 'docs/DATA-RETENTION-EXPORT-DELETION.md',
  LEGAL_HOLDS: 'docs/legal-drafts/LEGAL-HOLD-PROCEDURE-DRAFT.md; supabase/legal-holds.check.sql',
  INCIDENT_RESPONSE: 'docs/business/compliance/INCIDENT_RESPONSE_PLAN.md; docs/INCIDENT-RECOVERY-PLAYBOOK.md',
  BUSINESS_CONTINUITY: 'docs/company/BUSINESS-CONTINUITY-OPERATING-PLAN.md',
  DISASTER_RECOVERY: 'docs/engineering-operations/DISASTER-RECOVERY-TEST-PLAN.md',
  HECVAT_ROADMAP: 'docs/business/compliance/HECVAT_ROADMAP.md',
  TRUST_CENTER: 'docs/TRUST-CENTER.md; docs/business/compliance/TRUST_CENTER_INVENTORY.md',
  VENDOR_RISK: 'docs/business/compliance/VENDOR_RISK_REGISTER.md',
  SECURITY_QUESTIONNAIRE_LIBRARY: 'docs/business/compliance/SECURITY_QUESTIONNAIRE_LIBRARY.md',
  PUBLIC_CLAIMS_REGISTER: 'docs/legal/PUBLIC_CLAIMS_APPROVAL_REGISTER.md',
  COMPANY_OPERATING_SYSTEM: 'docs/master/SEMESTER_COMPANY_OPERATING_SYSTEM.md',
  GTM_PLAYBOOK: 'docs/business/gtm/SEMESTER_MASTER_GTM_PLAYBOOK.md',
  SALES_PLAYBOOK: 'docs/commercial/SALES-PLAYBOOK.md',
  PILOT_DELIVERY_FACTORY: 'docs/finish-line/SEMESTER_PILOT_DELIVERY_FACTORY.md',
  CUSTOMER_SUCCESS_PLAYBOOK: 'docs/commercial/CUSTOMER-SUCCESS-PLAYBOOK.md',
  PRICING_AND_PACKAGING: 'docs/business/finance/PRICING_AND_PACKAGING.md',
  FINANCIAL_MODEL: 'docs/business/finance/FINANCIAL_MODEL_SPEC.md',
  BUDGET_AND_RUNWAY: 'docs/company/BUDGET-AND-CASH-RUNWAY-TEMPLATE.md',
  KPI_TREE: 'docs/business/gtm/SEMESTER_GTM_KPI_TREE.md',
  RISK_REGISTER: 'docs/company/RISK-REGISTER.md',
  OPERATING_CADENCE: 'docs/finish-line/SEMESTER_COMPANY_OPERATING_CADENCE.md',
  BOARD_REPORTING: 'docs/finance/09-BOARD-REPORTING-PACKAGE.md',
  PARTNERSHIPS: 'docs/PROVIDER-MATURITY-CERTIFICATION-PARTNERSHIPS.md',
  PEOPLE_AND_HIRING: 'docs/company/leadership-system/04-organization-and-hiring.md',
  ENGINEERING_STANDARDS: 'docs/architecture/modularization/04-engineering-standards.md',
  TEST_STRATEGY: 'docs/engineering-operations/TEST-STRATEGY.md',
  RELEASE_POLICY: 'docs/trust/RELEASE-MANAGEMENT-POLICY.md',
  SLO_POLICY: 'docs/operating-model/SLOS-AND-ERROR-BUDGETS.md',
  ERROR_BUDGET_POLICY: 'docs/engineering-operations/ERROR-BUDGET-DRAFT.md',
  OBSERVABILITY: 'docs/engineering-operations/OBSERVABILITY-PLAN.md',
  CQRS_READ_MODEL_ARCHITECTURE: 'docs/ops/CQRS_READ_MODEL_ARCHITECTURE.md',
  OPERATIONS_CONSOLE_ARCHITECTURE: 'docs/product/operations-console-ux-architecture.md',
  RUNBOOK_INDEX: 'docs/RUNBOOKS.md; docs/sre/runbooks/',
  BACKUP_RESTORE_TESTS: 'docs/trust/BACKUP-RESTORE-AND-ROLLBACK-RUNBOOK.md; docs/engineering-operations/DISASTER-RECOVERY-TEST-PLAN.md',
  SECURE_SDLC: 'docs/trust/SECURE-DEVELOPMENT-LIFECYCLE.md',
};

const rows = [];
for (const [index, [name, job]] of catalog.roles.entries()) {
  const mapped = roleMap[name];
  if (!mapped) throw new Error(`No role mapping for ${name}`);
  const [dispositionKey, roles, profileKey] = mapped;
  for (const role of roles.split('; ').filter((value) => value !== 'none')) {
    if (!launchRoles.has(role)) throw new Error(`Role mapping ${name} references unknown role ${role}`);
  }
  const profile = roleProfiles[profileKey];
  rows.push({ population: 'role', key: `role-${String(index + 1).padStart(2, '0')}`, group: 'Archive role catalog', name, disposition: dispositions[dispositionKey], profile: profileKey, evidence: roles === 'none' ? profile.owner : `${profile.owner}; mapped roles: ${roles}`, dependency: profile.contract, basis: `${profile.basis} Archive job: ${job}` });
}

for (const [group, systems] of Object.entries(catalog.systems)) {
  systems.forEach((name, index) => {
    const override = systemOverrides.get(`${group}/${name}`);
    const dispositionKey = override?.[0] ?? 'incomplete';
    const profileKey = override?.[1] ?? systemProfile(name, group);
    const [owner, contract] = systemProfiles[profileKey];
    const basis = override?.[2] ?? 'Current repository code, schema, checks or operational documents cover part of this domain, but the archive label does not prove the full operated-system completion contract.';
    rows.push({ population: 'system', key: `${group === 'Product systems' ? 'system-product' : 'system-control'}-${String(index + 1).padStart(2, '0')}`, group, name, disposition: dispositions[dispositionKey], profile: profileKey, evidence: owner, dependency: contract, basis });
  });
}

for (const [group, documents] of Object.entries(catalog.docs)) {
  documents.forEach((name, index) => {
    const evidence = documentEvidence[name];
    if (!evidence) throw new Error(`No current document authority mapped for ${name}`);
    for (const path of evidence.split('; ')) {
      if (path.endsWith('/')) continue;
      if (!existsSync(resolve(root, path))) throw new Error(`Mapped document evidence does not exist: ${name} -> ${path}`);
    }
    rows.push({
      population: 'document',
      key: `document-${group.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replaceAll(/(^-|-$)/g, '')}-${String(index + 1).padStart(2, '0')}`,
      group,
      name,
      disposition: dispositions.duplicate,
      profile: 'D1',
      evidence,
      dependency: 'The current repository authority must stay versioned, owned and evidence-bounded. Drafts, templates and plans do not prove approval, operation, deployment or external acceptance.',
      basis: 'A current repository document or authority already covers this requested subject. The archive document requirement is superseded and is not imported as a parallel source of truth.',
    });
  });
}

if (catalog.roles.length !== 49) throw new Error(`Expected 49 archive roles, found ${catalog.roles.length}`);
if (Object.values(catalog.systems).flat().length !== 88) throw new Error('Expected 88 archive systems');
if (Object.values(catalog.docs).flat().length !== 82) throw new Error('Expected 82 archive documents');
if (rows.length !== 219 || new Set(rows.map((row) => row.key)).size !== 219) throw new Error('Expected 219 unique reconciliation rows');
if (rows.some((row) => !Object.values(dispositions).includes(row.disposition))) throw new Error('Invalid disposition');
if (rows.some((row) => !row.profile || !row.evidence || !row.dependency || !row.basis)) throw new Error('Incomplete reconciliation row');

function csv(value) {
  const string = String(value ?? '');
  return /[",\n]/.test(string) ? `"${string.replaceAll('"', '""')}"` : string;
}

const headers = ['population', 'archive_key', 'archive_group', 'archive_name', 'disposition', 'evidence_profile', 'current_owner_or_evidence', 'dependencies_and_acceptance', 'basis_and_release_boundary'];
const output = [headers.join(',')];
for (const row of rows) output.push([row.population, row.key, row.group, row.name, row.disposition, row.profile, row.evidence, row.dependency, row.basis].map(csv).join(','));
const target = resolve(root, 'docs/design-system/REFERENCE-ROLE-SYSTEM-DOCUMENT-RECONCILIATION.csv');
writeFileSync(target, `${output.join('\n')}\n`);

const summarize = (population) => Object.fromEntries(
  [...new Set(rows.filter((row) => row.population === population).map((row) => row.disposition))].sort()
    .map((disposition) => [disposition, rows.filter((row) => row.population === population && row.disposition === disposition).length]),
);
console.log(JSON.stringify({ target, rows: rows.length, roles: summarize('role'), systems: summarize('system'), documents: summarize('document') }, null, 2));
