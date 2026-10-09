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

const screenTotal = Object.values(catalog.screens).reduce((total, rows) => total + rows.length, 0);
if (screenTotal !== 673) throw new Error(`Expected 673 archive screen rows, found ${screenTotal}`);
if (catalog.addedScreens.length !== 84) throw new Error(`Expected 84 added-screen aliases, found ${catalog.addedScreens.length}`);

const auditRows = [];
let auditGroup = '';
for (const line of read('docs/master/REPO_AUDIT.md').split('\n')) {
  const heading = /^### ([A-N] · .+)$/.exec(line);
  if (heading) auditGroup = heading[1];
  const match = /^\| ([A-N]-\d{3}) \| ([^|]+) \| (exists|partial|missing) \| ([^|]+) \| ([^|]+) \|$/.exec(line);
  if (!match) continue;
  auditRows.push({
    id: match[1],
    label: match[2].trim(),
    status: match[3],
    evidence: match[4].trim(),
    note: match[5].trim(),
    group: auditGroup,
  });
}
if (auditRows.length !== 589) throw new Error(`Expected 589 repository screen rows, found ${auditRows.length}`);

const profiles = {
  A: 'P1', B: 'P5', C: 'P6', D: 'P7', E: 'P6', F: 'P6', G: 'P7',
  H: 'P7', I: 'P7', J: 'P7', K: 'P6', L: 'P6', M: 'P3', N: 'P3',
};

const plannedOwners = {
  A: 'company-site/; app/src/site/',
  B: 'app/src/screens/; app/src/components/',
  C: 'app/src/components/CourseStudio.tsx; app/server/institution/',
  D: 'app/src/components/SharedPlan.tsx; app/server/institution/advising.ts',
  E: 'app/src/screens/Registrar.tsx; app/src/components/institutional/',
  F: 'app/src/components/StudentAccounts.tsx; app/src/lib/finance/',
  G: 'app/src/screens/University.tsx; app/src/components/community/',
  H: 'app/src/screens/Community.tsx; app/src/components/community/',
  I: 'app/src/screens/Family.tsx; app/src/components/FamilySharing.tsx',
  J: 'app/src/screens/Career.tsx; app/server/institution/career.ts',
  K: 'app/src/components/institutional/; app/server/institution/',
  L: 'app/src/components/institutional/IntegrationDashboard.tsx; app/src/lib/integration/',
  M: 'app/src/components/console/; app/src/lib/governance/',
  N: 'app/src/components/console/; app/src/lib/console/',
};

const dependencyAcceptance = {
  A: 'Public route and claims-register owner; validate intake server-side, recovery/error states, accessibility, responsive behavior, focused route tests, and keep deployment separate.',
  B: 'Self-owned student data or explicit official-source boundary; discoverable route, persistence, provenance/freshness, reversible actions, complete states, accessibility/responsive tests.',
  C: 'Course membership plus exact teaching capability; institution/course-scoped persistence, audit for consequential academic actions, recovery, full UI states, and faculty journey tests.',
  D: 'Student consent plus advisor relationship; no hidden risk score or broad roster, scoped server read/write, revocation/audit, recovery, complete states, and two-account tests.',
  E: 'Registrar capability and institution scope; official SIS authority, validated/audited/idempotent mutation, reconciliation and rollback, complete states, RLS and journey tests.',
  F: 'Finance capability and institution/student scope; ledger or official-provider authority, validated/audited/idempotent mutation, reversal path, complete states, RLS and finance tests.',
  G: 'Institution-authorized campus source and least-privilege role; scoped persistence, provenance/freshness, safe recovery, complete states, accessibility/responsive and role tests.',
  H: 'Community membership/moderation capability; privacy and safety boundaries, audited moderation, appeal/recovery, complete states, abuse/rate controls and tenant-isolation tests.',
  I: 'Student-created delegated grant; field-minimized read, expiry/revocation/audit, no independent record access, complete states, accessibility/responsive and two-account tests.',
  J: 'Career relationship or consented evidence grant; employer isolation from student records, audited/revocable access, complete states, accessibility/responsive and cross-role tests.',
  K: 'Exact institution-admin capability; tenant-scoped server operation, audit/recovery/rollback, source authority and freshness, complete states, RLS and operator journey tests.',
  L: 'Approved provider contract and exact scopes; vault-held credentials, tenant isolation, idempotent sync/reconciliation/rollback, degraded states, adapter and RLS tests.',
  M: 'Exact trust/privacy/security capability; evidence provenance and expiry, audited sensitive operation, recovery/rollback, denied/degraded states, policy and operator tests.',
  N: 'Exact console action capability beyond console shell access; customer-data boundary, audit-before-action, idempotency/recovery, denied/degraded states and operator tests.',
};

const existingOverrides = new Set(['D-002', 'D-003']);
const excluded = new Map([
  ['C-024', 'Current faculty design refuses an institution-wide student-progress roster; only course/consent-bounded evidence may be introduced.'],
  ['C-032', 'Current institution-operations policy forbids automated academic-integrity accusations; a later human-governed case workflow needs new authority.'],
  ['D-016', 'Current product authority forbids hidden student risk scoring or ranking. Student-controlled signals do not authorize this staff surface.'],
  ['G-031', 'D-1287 declines directory/marketplace-style local listings; no newer decision reopens them.'],
  ['H-004', 'The current community data contract deliberately has no reactions table; archive engagement mechanics do not override that boundary.'],
  ['J-027', 'Employer talent discovery would expose student records without a student-created evidence grant; current isolation rules prohibit that model.'],
]);
const blocked = new Map([
  ['A-035', 'Booking requires an approved calendar/vendor, operational owner and availability policy; none is current repository evidence.'],
  ['L-024', 'A production OneRoster REST adapter requires an approved provider contract, endpoint, credentials and conformance environment.'],
  ['L-025', 'Edu-API configuration requires an approved provider, endpoint, credentials and conformance environment.'],
  ['M-027', 'Penetration-test evidence must come from an actual authorized assessment; the repository cannot self-create assurance evidence.'],
]);
const roadmap = new Map([
  ['J-039', 'Advancement and donation handoff remains a roadmap concept; the current product explicitly has no giving integration.'],
]);

function csv(value) {
  const string = String(value ?? '');
  return /[",\n]/.test(string) ? `"${string.replaceAll('"', '""')}"` : string;
}

const addedByGroup = new Map();
for (const row of catalog.addedScreens) {
  const list = addedByGroup.get(row.group) ?? [];
  list.push(row);
  addedByGroup.set(row.group, list);
}

const result = [];
for (const [group, labels] of Object.entries(catalog.screens)) {
  const letter = group[0];
  const repositoryRows = auditRows.filter((row) => row.id.startsWith(`${letter}-`));
  const baseLabels = labels.slice(0, repositoryRows.length);
  if (baseLabels.some((label, index) => label !== repositoryRows[index].label)) {
    throw new Error(`Archive base rows no longer exactly match repository catalog group ${letter}`);
  }

  for (const [index, repository] of repositoryRows.entries()) {
    let disposition = repository.status === 'missing' ? 'Missing and in scope' : 'Existing but incomplete';
    let basis = repository.status === 'missing'
      ? 'The current repository catalog records this item as absent; current scope permits a bounded implementation subject to the recorded dependencies and acceptance contract.'
      : `Exact ${repository.status} row in the current repository catalog. That status does not verify the full vertical-slice completion contract.`;

    if (existingOverrides.has(repository.id)) {
      disposition = 'Existing but incomplete';
      basis = repository.id === 'D-002'
        ? 'The shared-plan list is the consent-bounded Caseload analogue; an institution-wide roster remains blocked on authority, relationship data and consent.'
        : 'The advisor can inspect a student-consented shared-plan snapshot; a general student profile remains outside that grant.';
    } else if (excluded.has(repository.id)) {
      disposition = 'Intentionally excluded with a repository-backed rationale';
      basis = excluded.get(repository.id);
    } else if (blocked.has(repository.id)) {
      disposition = 'Blocked by external authority, credentials, vendor, environment, legal review, staffing, or institutional decision';
      basis = blocked.get(repository.id);
    } else if (roadmap.has(repository.id)) {
      disposition = 'Documentation or roadmap only';
      basis = roadmap.get(repository.id);
    }

    const owner = repository.evidence === '—' ? plannedOwners[letter] : repository.evidence.replaceAll('<br>', '; ');
    result.push({
      key: repository.id,
      group,
      position: index + 1,
      label: repository.label,
      origin: 'base catalog row',
      disposition,
      profile: profiles[letter],
      repositoryRow: repository.id,
      repositoryStatus: repository.status,
      owner,
      dependencies: dependencyAcceptance[letter],
      basis,
    });
  }

  const aliases = labels.slice(repositoryRows.length);
  const declaredAliases = addedByGroup.get(group) ?? [];
  if (aliases.length !== declaredAliases.length || aliases.some((label, index) => label !== declaredAliases[index].name)) {
    throw new Error(`Added-screen aliases do not match the appended rows for group ${letter}`);
  }
  aliases.forEach((label, index) => {
    const alias = declaredAliases[index];
    result.push({
      key: `${letter}-W${String(index + 1).padStart(3, '0')}`,
      group,
      position: repositoryRows.length + index + 1,
      label,
      origin: `workflow alias ${alias.flow}#${alias.step}`,
      disposition: 'Duplicate or superseded',
      profile: profiles[letter],
      repositoryRow: 'none',
      repositoryStatus: 'not an independent repository screen row',
      owner: 'docs/master/REPO_AUDIT.md#Workflow steps',
      dependencies: 'Reconcile the canonical workflow step in the 319-row workflow pass; do not create a route or screen solely because this alias appears in the screen array.',
      basis: 'catalog-data.js declares this row in addedScreens as a workflow-step projection. The canonical workflow item, not this duplicate screen alias, owns implementation and acceptance.',
    });
  });
}

if (result.length !== 673) throw new Error(`Expected 673 output rows, found ${result.length}`);
if (new Set(result.map((row) => row.key)).size !== 673) throw new Error('Archive catalog keys are not unique');
if (result.filter((row) => row.origin.startsWith('workflow alias ')).length !== 84) throw new Error('Expected 84 workflow aliases');

const headers = [
  'archive_catalog_key', 'archive_group', 'group_position', 'label', 'row_origin', 'disposition',
  'evidence_profile', 'repository_catalog_row', 'repository_status', 'current_owner_or_evidence',
  'dependencies_and_acceptance', 'basis_and_release_boundary',
];
const output = [headers.join(',')];
for (const row of result) {
  output.push([
    row.key, row.group, row.position, row.label, row.origin, row.disposition, row.profile,
    row.repositoryRow, row.repositoryStatus, row.owner, row.dependencies, row.basis,
  ].map(csv).join(','));
}

const target = resolve(root, 'docs/design-system/REFERENCE-CATALOG-SCREEN-RECONCILIATION.csv');
writeFileSync(target, `${output.join('\n')}\n`);

const counts = Object.fromEntries(
  [...new Set(result.map((row) => row.disposition))].sort()
    .map((disposition) => [disposition, result.filter((row) => row.disposition === disposition).length]),
);
console.log(JSON.stringify({ target, rows: result.length, baseRows: 589, workflowAliases: 84, counts }, null, 2));
