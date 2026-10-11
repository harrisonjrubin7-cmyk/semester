#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
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

const workflowNames = {
  Student: 'Student journey',
  Faculty: 'Faculty course lifecycle',
  'Advisor / student success': 'Advising & student success',
  Registrar: 'Registrar & academic operations',
  'Institutional implementation': 'Institution implementation',
  'Controlled integration': 'Controlled integration',
  AI: 'Governed AI request',
  Support: 'Support request',
  Incident: 'Incident response',
  'Domain migration': 'Domain migration',
  'Student finance': 'Student finance & payment',
  'Campus services': 'Campus services',
  'Community & moderation': 'Community & moderation',
  'Career & employer': 'Career, employer & alumni',
  'Family consent': 'Family & guardian consent',
  'Developer platform': 'Developer platform & marketplace',
  'Analytics & outcomes': 'Analytics, outcomes & reliability',
};

const repositoryRows = [];
for (const line of read('docs/master/REPO_AUDIT.md').split('\n')) {
  const match = /^\| ([^|]+#\d+) \| ([^|]+) \| (exists|partial|missing) \| ([^|]+) \| ([^|]+) \|$/.exec(line);
  if (!match) continue;
  const hash = match[1].lastIndexOf('#');
  repositoryRows.push({
    key: match[1],
    workflow: match[1].slice(0, hash),
    step: Number(match[1].slice(hash + 1)),
    label: match[2].trim(),
    status: match[3],
    evidence: match[4].trim(),
    note: match[5].trim(),
  });
}

const archiveTotal = Object.values(catalog.workflows).reduce((total, rows) => total + rows.length, 0);
if (archiveTotal !== 319) throw new Error(`Expected 319 archive workflow rows, found ${archiveTotal}`);
if (repositoryRows.length !== 319) throw new Error(`Expected 319 repository workflow rows, found ${repositoryRows.length}`);
if (new Set(repositoryRows.map((row) => row.key)).size !== 319) throw new Error('Repository workflow keys are not unique');
if (catalog.addedScreens.length !== 84) throw new Error(`Expected 84 workflow-screen aliases, found ${catalog.addedScreens.length}`);

const profileByWorkflow = {
  'Student journey': 'P5',
  'Faculty course lifecycle': 'P6',
  'Advising & student success': 'P7',
  'Registrar & academic operations': 'P6',
  'Institution implementation': 'P6',
  'Controlled integration': 'P6',
  'Governed AI request': 'P8',
  'Support request': 'P7',
  'Incident response': 'P3',
  'Domain migration': 'P6',
  'Student finance & payment': 'P6',
  'Campus services': 'P7',
  'Community & moderation': 'P7',
  'Career, employer & alumni': 'P7',
  'Family & guardian consent': 'P7',
  'Developer platform & marketplace': 'P9',
  'Analytics, outcomes & reliability': 'P3',
};

const ownerByWorkflow = {
  'Student journey': 'app/src/screens/; app/src/components/; app/src/lib/',
  'Faculty course lifecycle': 'app/src/components/CourseStudio.tsx; app/src/components/gradebook/; app/src/lib/coursestudio.ts',
  'Advising & student success': 'app/src/components/AdvisorSharedView.tsx; app/src/lib/advisor-shares.ts; app/server/institution/advising.ts',
  'Registrar & academic operations': 'app/src/components/enrollment/RegistrarDesk.tsx; app/src/lib/enrollment/; app/src/lib/record/',
  'Institution implementation': 'app/src/components/institutional/; app/src/lib/ops/readiness.ts; docs/institutional-implementation/',
  'Controlled integration': 'app/src/components/institutional/IntegrationDashboard.tsx; app/src/lib/integration/; app/server/integration/',
  'Governed AI request': 'app/src/ai/; app/src/lib/governance/; app/server/institution/ai-data-class.ts',
  'Support request': 'app/src/components/HelpInbox.tsx; app/src/lib/help-routes.ts; app/server/institution/',
  'Incident response': 'app/src/components/console/; app/src/lib/ops/; docs/INCIDENT-RECOVERY-PLAYBOOK.md',
  'Domain migration': 'app/src/components/institutional/MigrationCenter.tsx; app/src/lib/migration/; app/server/institution/',
  'Student finance & payment': 'app/src/components/MyStudentAccount.tsx; app/src/components/institutional/StudentAccounts.tsx; app/src/lib/finance/',
  'Campus services': 'app/src/screens/University.tsx; app/src/screens/Housing.tsx; app/src/components/dining/; app/server/institution/',
  'Community & moderation': 'app/src/screens/Community.tsx; app/src/components/community/; app/src/lib/communitiesregister.ts',
  'Career, employer & alumni': 'app/src/screens/Career.tsx; app/src/components/VerifiedListings.tsx; app/server/institution/career.ts',
  'Family & guardian consent': 'app/src/screens/Family.tsx; app/src/components/FamilySharing.tsx; app/src/lib/familyshare.ts',
  'Developer platform & marketplace': 'docs/API-PLATFORM.md; docs/decisions/D-1287.md',
  'Analytics, outcomes & reliability': 'app/src/components/institutional/; app/src/lib/institution-ops.ts; app/src/lib/ops/',
};

const acceptanceByWorkflow = {
  'Student journey': 'Student-owned or explicitly authoritative data; discoverable path, persistence, provenance/freshness, reversible explicit actions, complete states, 320px/accessibility and student journey tests.',
  'Faculty course lifecycle': 'Exact course membership and teaching capability; course-scoped persistence, human authority over academic records, audited consequential actions, recovery, complete states and faculty/student tests.',
  'Advising & student success': 'Student consent or a verified advisor relationship; no hidden risk score or broad roster, scoped writes, revocation/read audit, appeal/recovery and two-account tenant tests.',
  'Registrar & academic operations': 'Registrar capability and institution scope; official SIS authority, validated/audited/idempotent mutation, reconciliation/rollback, complete states and RLS/journey tests.',
  'Institution implementation': 'Current contract and named institutional authority; tenant-scoped configuration, second-person approval where consequential, evidence expiry, rollback and readiness gates separated from activation.',
  'Controlled integration': 'Approved provider contract and exact scopes; server-held credentials, mapping version, tenant isolation, idempotent sync, reconciliation/rollback, degraded states and adapter/RLS tests.',
  'Governed AI request': 'Policy ceiling, data minimization, explicit purpose and source provenance; exact tool permission, content-free audit where required, refusal/recovery, evaluation and human handoff tests.',
  'Support request': 'Minimum necessary student context and exact office role; tenant-scoped case state, status visibility, audit, safe escalation/recovery, rate controls and two-account tests.',
  'Incident response': 'Exact operations capability and staffed ownership; append-only incident timeline, approval for risky actions, communication authority, recovery/restore evidence and operator tests.',
  'Domain migration': 'Approved data owner and mapping; staged validation, conflict handling, reconciliation/dual run, institution acceptance, reversible cutover, retention and migration tests.',
  'Student finance & payment': 'Finance capability and official ledger/provider authority; validated/audited/idempotent changes, processor boundary, reversal/reconciliation, complete states and finance/RLS tests.',
  'Campus services': 'Authorized campus source and least-privilege role; purpose-limited data, official-office handoff for sensitive decisions, freshness, recovery, complete states and role tests.',
  'Community & moderation': 'Community membership/moderation capability; privacy and safety boundaries, audited moderation, appeal/recovery, abuse/rate controls and tenant-isolation tests; no declined marketplace model.',
  'Career, employer & alumni': 'Student-created evidence grant or verified career relationship; employer isolation from records, audited/revocable access, official-status provenance, complete states and cross-role tests.',
  'Family & guardian consent': 'Student-created delegated grant; field-minimized scope, expiry/revocation/read audit, no independent record access, complete states and two-account tests.',
  'Developer platform & marketplace': 'No production acceptance contract exists: D-1287 retains this as a roadmap concept requiring a newer decision, product owner, tenant/data contract and security model.',
  'Analytics, outcomes & reliability': 'Approved purpose and metric definition; aggregate/minimum-cell privacy, provenance, freshness, no invented pilot outcome, evidence review/expiry and operator tests.',
};

const roadmap = new Map([
  ['Community & moderation#1', 'Per-field campus-directory visibility remains a roadmap concept under D-1287; the current product shares only bounded handles and explicit grants.'],
  ['Career, employer & alumni#18', 'Continuing-education enrollment is a roadmap concept without a current program, authority/data contract or repository owner.'],
]);
const blocked = new Map([
  ['Campus services#13', 'An accommodation decision belongs to the authorized institutional accessibility office and source system. The repository can route a request but cannot issue or fabricate approval.'],
  ['Analytics, outcomes & reliability#2', 'A signed measures sheet requires an actual sponsor and institutional approval; repository artifacts cannot supply the signature or claim agreement.'],
]);
const excluded = new Map([
  ['Community & moderation#10', 'D-1287 declines the marketplace/directory model; no newer decision authorizes listings.'],
  ['Community & moderation#11', 'The declined marketplace has no listing to scan, and D-1298 separately rejects importing the archive free-text scanner.'],
  ['Community & moderation#12', 'D-1287 declines marketplace commerce and chat offers; current community scope does not include them.'],
  ['Community & moderation#13', 'D-1287 declines marketplace meet-up flows; current community sessions do not authorize a commerce handoff.'],
]);

const aliasByArchiveKey = new Map();
for (const alias of catalog.addedScreens) {
  const labels = catalog.workflows[alias.flow];
  if (!labels || labels[alias.step] !== alias.name) {
    throw new Error(`Workflow alias does not resolve: ${alias.flow}#${alias.step} ${alias.name}`);
  }
  const archiveKey = `${alias.flow}#${alias.step + 1}`;
  const list = aliasByArchiveKey.get(archiveKey) ?? [];
  list.push(`${alias.group} / ${alias.name}`);
  aliasByArchiveKey.set(archiveKey, list);
}

const result = [];
for (const [archiveWorkflow, labels] of Object.entries(catalog.workflows)) {
  const repositoryWorkflow = workflowNames[archiveWorkflow];
  if (!repositoryWorkflow) throw new Error(`No repository workflow mapping for ${archiveWorkflow}`);
  const rows = repositoryRows.filter((row) => row.workflow === repositoryWorkflow);
  if (rows.length !== labels.length) {
    throw new Error(`${archiveWorkflow} has ${labels.length} archive rows but ${rows.length} repository rows`);
  }

  labels.forEach((label, index) => {
    const repository = rows[index];
    if (repository.step !== index + 1 || repository.label !== label) {
      throw new Error(`Workflow drift at ${archiveWorkflow}#${index + 1}: ${label}`);
    }

    let disposition = repository.status === 'missing' ? 'Missing and in scope' : 'Existing but incomplete';
    let basis = repository.status === 'missing'
      ? 'The repository audit records this workflow behavior as absent. Current scope permits a bounded implementation only after the recorded authority, data and dependency contract is satisfied.'
      : `Exact ${repository.status} row in the repository workflow audit. That label does not prove the full end-to-end completion contract.`;

    if (repositoryWorkflow === 'Developer platform & marketplace') {
      disposition = 'Documentation or roadmap only';
      basis = 'D-1287 retains the developer platform and marketplace as a roadmap concept. Partial technical primitives do not authorize a partner product or marketplace lifecycle.';
    } else if (roadmap.has(repository.key)) {
      disposition = 'Documentation or roadmap only';
      basis = roadmap.get(repository.key);
    } else if (blocked.has(repository.key)) {
      disposition = 'Blocked by external authority, credentials, vendor, environment, legal review, staffing, or institutional decision';
      basis = blocked.get(repository.key);
    } else if (excluded.has(repository.key)) {
      disposition = 'Intentionally excluded with a repository-backed rationale';
      basis = excluded.get(repository.key);
    }

    const archiveKey = `${archiveWorkflow}#${index + 1}`;
    result.push({
      archiveKey,
      archiveWorkflow,
      step: index + 1,
      label,
      disposition,
      profile: profileByWorkflow[repositoryWorkflow],
      repositoryKey: repository.key,
      repositoryStatus: repository.status,
      owner: repository.evidence === '—' ? ownerByWorkflow[repositoryWorkflow] : repository.evidence.replaceAll('<br>', '; '),
      aliases: (aliasByArchiveKey.get(archiveKey) ?? []).join('; ') || 'none',
      dependencies: acceptanceByWorkflow[repositoryWorkflow],
      basis,
    });
  });
}

if (result.length !== 319) throw new Error(`Expected 319 output rows, found ${result.length}`);
if (new Set(result.map((row) => row.archiveKey)).size !== 319) throw new Error('Archive workflow keys are not unique');
if (result.filter((row) => row.aliases !== 'none').length !== 84) throw new Error('Expected 84 workflow rows with catalog-screen aliases');
if ([...aliasByArchiveKey.values()].some((aliases) => aliases.length !== 1)) throw new Error('A workflow row has multiple screen aliases');
const allowedDispositions = new Set([
  'Existing and verified',
  'Existing but incomplete',
  'Missing and in scope',
  'Prototype only',
  'Duplicate or superseded',
  'Documentation or roadmap only',
  'Blocked by external authority, credentials, vendor, environment, legal review, staffing, or institutional decision',
  'Intentionally excluded with a repository-backed rationale',
]);
if (result.some((row) => !allowedDispositions.has(row.disposition))) throw new Error('Workflow row has an invalid disposition');
if (result.some((row) => !row.profile || !row.owner || !row.dependencies || !row.basis)) {
  throw new Error('Workflow row is missing its evidence profile, owner, dependency contract or basis');
}

function csv(value) {
  const string = String(value ?? '');
  return /[",\n]/.test(string) ? `"${string.replaceAll('"', '""')}"` : string;
}

const headers = [
  'archive_workflow_key', 'archive_workflow', 'step', 'label', 'disposition', 'evidence_profile',
  'repository_workflow_key', 'repository_status', 'current_owner_or_evidence', 'catalog_screen_alias',
  'dependencies_and_acceptance', 'basis_and_release_boundary',
];
const output = [headers.join(',')];
for (const row of result) {
  output.push([
    row.archiveKey, row.archiveWorkflow, row.step, row.label, row.disposition, row.profile,
    row.repositoryKey, row.repositoryStatus, row.owner, row.aliases, row.dependencies, row.basis,
  ].map(csv).join(','));
}

const target = resolve(root, 'docs/design-system/REFERENCE-WORKFLOW-RECONCILIATION.csv');
writeFileSync(target, `${output.join('\n')}\n`);

const counts = Object.fromEntries(
  [...new Set(result.map((row) => row.disposition))].sort()
    .map((disposition) => [disposition, result.filter((row) => row.disposition === disposition).length]),
);
const groups = Object.fromEntries(Object.keys(catalog.workflows).map((workflow) => {
  const rows = result.filter((row) => row.archiveWorkflow === workflow);
  const dispositions = Object.fromEntries(
    [...new Set(rows.map((row) => row.disposition))].sort()
      .map((disposition) => [disposition, rows.filter((row) => row.disposition === disposition).length]),
  );
  return [workflow, { rows: rows.length, aliases: rows.filter((row) => row.aliases !== 'none').length, dispositions }];
}));
console.log(JSON.stringify({ target, rows: result.length, aliasedRows: 84, counts, groups }, null, 2));
