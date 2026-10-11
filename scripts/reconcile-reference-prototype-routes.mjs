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
const prototype = JSON.parse(readFileSync(resolve(referenceRoot, 'handoff/prototype/screens.json'), 'utf8'));
if (prototype.routes.length !== 281) throw new Error(`Expected 281 prototype routes, found ${prototype.routes.length}`);

const types = read('app/src/lib/types.ts');
const screenBlock = /export type Screen =([\s\S]*?);\n/.exec(types)?.[1];
if (!screenBlock) throw new Error('Could not read the current Screen union');
const screenIds = new Set([...screenBlock.matchAll(/\| '([^']+)'/g)].map((match) => match[1]));
const navIds = new Set([...read('app/src/lib/nav.ts').matchAll(/screen:\s*'([^']+)'/g)].map((match) => match[1]));

const auditRows = [];
for (const line of read('docs/master/REPO_AUDIT.md').split('\n')) {
  const match = /^\| ([A-Z]+-\d{3}) \| ([^|]+) \| (exists|partial|missing) \| ([^|]+) \| ([^|]+) \|$/.exec(line);
  if (match) auditRows.push({ id: match[1], label: match[2].trim(), status: match[3], evidence: match[4].trim() });
}
if (auditRows.length !== 589) throw new Error(`Expected 589 repository catalog rows, found ${auditRows.length}`);

const capabilityRows = [];
for (const line of read('docs/design-system/REFERENCE-CAPABILITY-REGISTRY-RECONCILIATION.md').split('\n')) {
  const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
  if (cells.length !== 6 || !/^`[^`]+`$/.test(cells[0]) || !/\*\*P\d+\*\*/.test(cells[3])) continue;
  capabilityRows.push({
    id: cells[0].slice(1, -1),
    area: cells[1].split('/').at(-1).trim(),
    archiveContract: cells[2],
    archiveRoutes: [...cells[2].matchAll(/\/(?:[a-z0-9_*.:-]+)(?:\/[a-z0-9_*.:-]+)*/gi)].map((match) => match[0]),
    owner: cells[3].replace(/`/g, ''),
    disposition: cells[4],
  });
}
if (capabilityRows.length !== 122) throw new Error(`Expected 122 reconciled capability rows, found ${capabilityRows.length}`);

const normalize = (value) => value
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\b(?:the|and|a|an|my)\b/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const workspaceProfile = {
  public: ['P1', 'company-site/index.html; app/src/site/'],
  applicant: ['P2', 'app/src/components/Credentials.tsx; app/src/screens/Applying.tsx'],
  student: ['P5', 'app/src/screens.tsx; app/src/lib/nav.ts'],
  faculty: ['P6', 'app/src/components/CourseStudio.tsx; app/src/components/Gradebook.tsx'],
  institution: ['P6', 'app/src/screens/Registrar.tsx; app/src/components/institutional/'],
  advisor: ['P7', 'app/src/components/SharedPlan.tsx; app/src/components/HelpInbox.tsx'],
  ta: ['P6', 'app/src/components/Gradebook.tsx; app/src/components/HelpInbox.tsx'],
  finops: ['P6', 'app/src/components/StudentAccounts.tsx; app/src/lib/finance/'],
  support: ['P7', 'app/src/components/HelpInbox.tsx; app/src/components/console/'],
  admissions: ['P6', 'docs/master/REPO_AUDIT.md; docs/ROLE-LAUNCH-REGISTER.md'],
  career: ['P7', 'app/src/screens/Career.tsx; app/src/components/ListingDesk.tsx'],
  campus: ['P7', 'app/src/screens/University.tsx; app/src/components/Dining.tsx'],
  marketplace: ['P11', 'docs/decisions/D-1287.md'],
  insights: ['P6', 'app/src/screens/Console.tsx; app/src/components/institutional/'],
  trust: ['P3', 'app/src/screens/Console.tsx; app/src/components/console/'],
  family: ['P7', 'app/src/screens/Family.tsx; app/src/components/FamilySharing.tsx'],
  alumni: ['P7', 'app/src/screens/Pathway.tsx; app/src/components/community/'],
  employer: ['P7', 'app/src/components/ListingDesk.tsx; docs/ROLE-LAUNCH-REGISTER.md'],
  company: ['P9', 'app/src/screens/Console.tsx; app/src/components/console/'],
  operations: ['P3', 'app/src/screens/Console.tsx; app/src/lib/console/'],
  os: ['P10', 'docs/master/REPO_AUDIT.md; docs/master/SEMESTER_EXECUTION_ROADMAP.md'],
  success: ['P7', 'app/src/components/HelpInbox.tsx; app/src/components/institutional/'],
  executive: ['P6', 'app/src/screens/Console.tsx; app/src/components/institutional/'],
  clubs: ['P7', 'app/src/screens/Community.tsx; app/src/components/community/'],
  social: ['P7', 'app/src/screens/Community.tsx; app/src/components/community/'],
  studio: ['P5', 'app/src/screens/Work.tsx; app/src/screens/Write.tsx'],
};

const excluded = new Set(['student/opportunities', 'student/market']);
const roadmap = new Set(['social/accounts', 'social/tests']);
const publicAliases = {
  home: 'A-001', pilot: 'A-022', trust: 'A-038', signup: 'A-076', solutions: 'A-013',
  pricing: 'A-027', resources: 'A-049', recover: 'A-077',
};
const capabilityPrefixes = {
  public: ['public'], applicant: ['admissions', 'shared'], student: ['student', 'shared'],
  faculty: ['course'], institution: ['inst', 'shared'], advisor: ['advising'], ta: ['course'],
  finops: ['finance'], support: ['support'], admissions: ['admissions'], career: ['career'],
  campus: ['campus'], insights: ['analytics', 'inst'], trust: ['ops', 'shared', 'ai'],
  family: ['family'], alumni: ['alumni'], employer: ['employer'], company: ['company', 'acct'],
  operations: ['ops'], success: ['success'], clubs: ['community'], social: ['community'], studio: ['studio'],
};

function csv(value) {
  const string = String(value ?? '');
  return /[",\n]/.test(string) ? `"${string.replaceAll('"', '""')}"` : string;
}

const result = prototype.routes.map((route) => {
  const routeId = `${route.ws}/${route.key}`;
  const currentPath = route.route.replace(/^#/, '');
  const prefixes = capabilityPrefixes[route.ws] ?? [];
  const capabilities = capabilityRows.filter((row) =>
    row.archiveRoutes.includes(currentPath)
    || (prefixes.some((prefix) => row.id === prefix || row.id.startsWith(`${prefix}.`))
      && normalize(row.area) === normalize(route.label)),
  );
  const catalog = auditRows.filter((row) => normalize(row.label) === normalize(route.label));
  const [fallbackProfile, fallbackOwner] = workspaceProfile[route.ws] ?? ['P10', 'docs/master/REPO_AUDIT.md'];
  const capabilityProfiles = [...new Set(capabilities.flatMap((row) => [...row.owner.matchAll(/\*\*(P\d+)\*\*/g)].map((match) => match[1])))];
  const profile = capabilityProfiles[0] ?? fallbackProfile;
  const owner = capabilities[0]?.owner.replace(/\s*\/\s*\*\*P\d+\*\*/, '') ?? fallbackOwner;
  const studentScreen = route.ws === 'student' && screenIds.has(route.key) ? route.key : '';
  let disposition = 'Prototype only';
  let basis = 'No exact current route, catalog row, or reconciled capability route implements this prototype URL.';

  if (route.ws === 'marketplace' || excluded.has(routeId)) {
    disposition = 'Intentionally excluded with a repository-backed rationale';
    basis = 'D-1287 keeps marketplace routes and models out of scope unless newer human authority reopens them.';
  } else if (route.ws === 'os' || roadmap.has(routeId)) {
    disposition = 'Documentation or roadmap only';
    basis = 'This architecture, mock-API, or test-harness view is reference material rather than an authorized product route.';
  } else if (capabilities.length) {
    const dispositions = [...new Set(capabilities.map((row) => row.disposition))];
    disposition = dispositions.includes('Existing but incomplete') ? 'Existing but incomplete' : dispositions[0];
    basis = `Capability register match: ${capabilities.map((row) => row.id).join('; ')}. The archive URL remains a prototype alias.`;
  } else if (studentScreen) {
    disposition = 'Existing but incomplete';
    basis = 'The student key maps to the current Screen union; the archive URL and combined prototype behavior are not independently verified.';
  } else if (catalog.some((row) => row.status !== 'missing')) {
    disposition = 'Existing but incomplete';
    basis = 'An exact normalized catalog label has current exists/partial evidence, but not proof for the archive URL and full prototype behavior.';
  } else if (route.ws === 'public' && publicAliases[route.key]) {
    disposition = 'Existing but incomplete';
    basis = `Current company-site catalog analogue ${publicAliases[route.key]} exists or is partial; the archive URL is not adopted.`;
  }

  const catalogIds = [...new Set([
    ...catalog.map((row) => `${row.id}:${row.status}`),
    ...(route.ws === 'public' && publicAliases[route.key] && catalog.length === 0 ? [publicAliases[route.key]] : []),
  ])];
  return {
    route: route.route,
    workspace: route.ws,
    key: route.key,
    label: route.label,
    stream: route.stream,
    prototypeComponent: `${route.file}#${route.component}`,
    disposition,
    profile,
    owner,
    appScreen: studentScreen || 'none',
    navigation: studentScreen ? (navIds.has(studentScreen) ? 'registered destination' : 'nested or shell-only') : 'no exact current destination',
    catalog: catalogIds.join('; ') || 'none',
    capability: capabilities.map((row) => row.id).join('; ') || 'none',
    basis,
  };
});

const uniqueRoutes = new Set(result.map((row) => row.route));
if (uniqueRoutes.size !== 281) throw new Error(`Expected 281 unique route keys, found ${uniqueRoutes.size}`);

const headers = ['archive_route', 'workspace', 'key', 'label', 'stream', 'prototype_component', 'disposition', 'evidence_profile', 'current_owner_path', 'current_app_screen', 'discoverability', 'repository_catalog_rows', 'capability_registry_rows', 'basis_and_release_boundary'];
const output = [headers.join(',')];
for (const row of result) output.push([
  row.route, row.workspace, row.key, row.label, row.stream, row.prototypeComponent, row.disposition,
  row.profile, row.owner, row.appScreen, row.navigation, row.catalog, row.capability, row.basis,
].map(csv).join(','));

const target = resolve(root, 'docs/design-system/REFERENCE-PROTOTYPE-ROUTE-RECONCILIATION.csv');
writeFileSync(target, `${output.join('\n')}\n`);

const counts = Object.fromEntries([...new Set(result.map((row) => row.disposition))].sort().map((disposition) => [disposition, result.filter((row) => row.disposition === disposition).length]));
console.log(JSON.stringify({ target, routes: result.length, counts }, null, 2));
