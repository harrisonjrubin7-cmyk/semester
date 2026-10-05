#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REQUIRED_PUBLICATION_SLUGS = [
  'master-specification', 'executive-institutional-brief', 'current-product-live-site-audit',
  'capability-disposition-matrix', 'canonical-data-model-permissions',
  'product-systems-user-journeys', 'ai-governance-automation', 'integration-architecture',
  'security-privacy-compliance', 'accessibility-conformance-plan',
  'migration-rollback-disaster-recovery', 'testing-verification-plan',
  'pilot-institutional-rollout-runbook', 'procurement-security-review-package',
  'claude-code-execution-guide', 'requirements-traceability-source-index',
  'decisions-risks-external-blockers',
];

const PROHIBITED = /\b(TBD|TODO|TK)\b|coming soon|implement later/i;
const VERIFIED_ON = '2026-09-23';
const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const docsRoot = join(repo, 'docs', 'institutional-rollout');
const generated = join(docsRoot, 'generated');

const definitions = [
  ['master-specification', 'Semester Institutional Rollout Master Specification', ['§1–§18 approved design'], 'Semester product and engineering'],
  ['executive-institutional-brief', 'Executive Institutional Brief', ['§1 purpose', '§3 product identity', '§13 delivery program'], 'Institutional program owner'],
  ['current-product-live-site-audit', 'Current Product and Live Site Audit', ['current-state census', 'source index', '§2 truth policy'], 'Product engineering'],
  ['capability-disposition-matrix', 'Capability Disposition Matrix', ['60-capability registry', 'requirements traceability'], 'Product engineering'],
  ['canonical-data-model-permissions', 'Canonical Data Model and Permissions', ['§5 platform architecture', '§6 identity and permissions', 'tenant-role schema map'], 'Platform engineering'],
  ['product-systems-user-journeys', 'Product Systems and User Journeys', ['§4 information architecture', '§7 product systems'], 'Product design'],
  ['ai-governance-automation', 'AI Governance and Automation', ['§7.11 Ask Semester', '§9 security and governance'], 'AI governance owner'],
  ['integration-architecture', 'Integration Architecture', ['§5 platform architecture', '§8 integration architecture'], 'Integration engineering'],
  ['security-privacy-compliance', 'Security, Privacy and Compliance', ['§6 permissions', '§9 security and governance'], 'Security and privacy owners'],
  ['accessibility-conformance-plan', 'Accessibility Conformance Plan', ['§10 accessibility and responsive behavior', '§12 testing'], 'Accessibility owner'],
  ['migration-rollback-disaster-recovery', 'Migration, Rollback and Disaster Recovery', ['§11 data continuity', '§13 delivery program'], 'Platform operations'],
  ['testing-verification-plan', 'Testing and Verification Plan', ['§12 testing', '§13 delivery gates'], 'Quality engineering'],
  ['pilot-institutional-rollout-runbook', 'Pilot Institutional Rollout Runbook', ['§13 delivery program', '§14 local preview'], 'Institutional implementation lead'],
  ['procurement-security-review-package', 'Procurement and Security Review Package', ['§5 architecture', '§9 governance', '§13 rollout gates'], 'Institutional program owner'],
  ['claude-code-execution-guide', 'Claude Code Execution Guide', ['§16 execution model', '§17 program decomposition'], 'Engineering lead'],
  ['requirements-traceability-source-index', 'Requirements Traceability and Source Index', ['§2 source hierarchy', 'traceability registry', 'source index'], 'Program assurance'],
  ['decisions-risks-external-blockers', 'Decisions, Risks and External Blockers', ['§2 truth policy', '§13 gates', '§16 stop conditions'], 'Program owner'],
];

const packetDefinitions = [
  ['00-baseline-foundation', 'Baseline and foundation', 'CAP-001–CAP-060', 'none', 'app/scripts; app/src/lib; docs/institutional-rollout'],
  ['01-identity-tenancy-authorization', 'Identity, tenancy and authorization', 'CAP-005, CAP-008, CAP-010, CAP-012', '00-baseline-foundation', 'supabase/migrations; supabase/functions; app/server/institution; app/src/lib/institutional-access.ts'],
  ['02-canonical-academic-data', 'Canonical academic data', 'CAP-009, CAP-011, CAP-015, CAP-021–CAP-024, CAP-044–CAP-045', '01-identity-tenancy-authorization', 'supabase/migrations; app/src/lib; app/src/data; app/server/institution'],
  ['03-capture-planning-provenance', 'Capture, planning and provenance', 'CAP-001–CAP-004, CAP-013–CAP-020', '02-canonical-academic-data', 'app/src/screens; app/src/state; app/src/lib; supabase/functions'],
  ['04-study-creation-ai', 'Study, creation and governed AI', 'CAP-025–CAP-040, CAP-056–CAP-057', '03-capture-planning-provenance', 'app/src/ai; app/src/screens; app/src/lib; supabase/functions'],
  ['05-campus-career-messaging', 'Campus, career and messaging systems', 'CAP-041–CAP-055, CAP-058–CAP-060', '02-canonical-academic-data, 04-study-creation-ai', 'app/server/institution; app/src/screens; app/src/lib; supabase/migrations'],
  ['06-integrations-operations', 'Integrations and operations', 'CAP-008–CAP-012, CAP-043, CAP-050–CAP-051', '01-identity-tenancy-authorization, 02-canonical-academic-data', 'app/server/institution; supabase/functions; app/src/lib/connect.ts; .github/workflows'],
  ['07-security-accessibility-quality', 'Security, accessibility and quality gates', 'CAP-001–CAP-060', '01–06', 'app/src; app/scripts; supabase; .github/workflows; docs/market-readiness'],
  ['08-institutional-rollout', 'Institutional pilot and rollout', 'CAP-001–CAP-060', '00–07', 'docs/institutional-rollout; app/scripts; supabase; .github/workflows'],
];

function sha(text) {
  return createHash('sha256').update(text).digest('hex');
}

function read(relative) {
  return readFileSync(join(repo, relative), 'utf8');
}

function section(spec, number) {
  const match = new RegExp(`^## ${number}\\.[\\s\\S]*?(?=^## \\d+\\.|\\s*$)`, 'm').exec(spec);
  return match?.[0]?.trim() ?? '';
}

function sourceHeader(title, sources, census) {
  return `# ${title}\n\n` +
    `**Version date:** ${VERIFIED_ON}  \n**Status:** Controlled rollout source  \n` +
    `**Evidence basis:** ${sources.join('; ')}\n\n` +
    `> Truth boundary: repository behavior and reproduced checks are current evidence. Provider activation, institutional approval and production data exchange remain external gates until authoritative readback succeeds.\n\n` +
    `## Verified baseline\n\n| Measure | Current value |\n| --- | ---: |\n` +
    `| Registered destinations | ${census.destinations.count} |\n| Screen union members | ${census.screens.count} |\n` +
    `| Accounted non-destinations | ${census.screens.accounted.length} |\n| Unaccounted screens | ${census.screens.unaccounted.length} |\n` +
    `| Database migrations | ${census.migrations.count} |\n| Duplicate migration versions | ${census.migrations.duplicateVersions.length} |\n` +
    `| Institution gateway files | ${census.institutionServer.length} |\n\n`;
}

function publicationBody(slug, title, sources, inputs) {
  const { spec, census, capability, traceability, schema, sourceIndex } = inputs;
  const head = sourceHeader(title, sources, census);
  const shared = `## Operating decision\n\nSemester remains the authoritative React, TypeScript and Supabase product. The institutional program extends the existing routes and local-first behavior through server-enforced tenancy, verified grants, canonical academic records, governed integrations and observable release gates. Sample and sandbox evidence is labeled and cannot be promoted to production status by presentation alone.\n\n`;
  if (slug === 'master-specification') return `${head}${spec}\n`;
  if (slug === 'capability-disposition-matrix') return `${head}${shared}${capability}\n`;
  if (slug === 'requirements-traceability-source-index') {
    return `${head}${shared}${traceability}\n\n## Machine-readable source registry\n\n\`source-index.json\` contains ${sourceIndex.length} checked source records. Unverified sources remain explicitly unverified.\n`;
  }
  if (slug === 'canonical-data-model-permissions') return `${head}${shared}${section(spec, 5)}\n\n${section(spec, 6)}\n\n${schema}\n`;

  const sections = {
    'executive-institutional-brief': [1, 3, 13],
    'current-product-live-site-audit': [2, 12],
    'product-systems-user-journeys': [4, 7],
    'ai-governance-automation': [7, 9],
    'integration-architecture': [5, 8],
    'security-privacy-compliance': [6, 9],
    'accessibility-conformance-plan': [10, 12],
    'migration-rollback-disaster-recovery': [11, 13],
    'testing-verification-plan': [12, 13],
    'pilot-institutional-rollout-runbook': [13, 14],
    'procurement-security-review-package': [5, 9, 13],
    'claude-code-execution-guide': [16, 17],
    'decisions-risks-external-blockers': [2, 13, 16],
  }[slug] ?? [];
  const selected = sections.map((number) => section(spec, number)).filter(Boolean).join('\n\n');
  const close = `\n\n## Acceptance and evidence\n\nCompletion requires tests, artifacts and authoritative readback appropriate to the claim. A local build proves local behavior; a sandbox proves the adapter contract; only intended-provider readback proves production activation. Decisions that change architecture, data risk, tenant isolation or existing capabilities return to the owner before implementation continues.\n`;
  return `${head}${shared}${selected}${close}`;
}

function packetBody(index, packet, stopConditions) {
  const [slug, title, requirements, dependencies, areas] = packet;
  const phase = String(index).padStart(2, '0');
  return `# Packet ${phase} — ${title}\n\n**Execution order:** ${phase} of 08  \n**Status:** implementation handoff\n\n` +
    `## Objective\n\nImplement ${title.toLowerCase()} as a bounded increment in the existing Semester repository without deleting or silently repurposing a working capability. Fetch and inspect current \`main\` before editing.\n\n` +
    `## Outcomes\n\n- A repository-backed implementation with explicit current, sandbox and external-gate status.\n- Deterministic tests and operator evidence for the affected boundary.\n- No regression to routes, stored data, offline behavior or the approved information architecture.\n\n` +
    `## Requirement IDs\n\n${requirements}\n\n## Dependencies\n\n${dependencies}\n\n` +
    `## Repository areas\n\n${areas}\n\n## Security, privacy and accessibility constraints\n\nEnforce tenancy and resource authorization server-side; minimize data; log privileged actions without sensitive payloads; keep presentation roles non-authoritative; preserve keyboard, screen-reader, contrast, reflow and reduced-motion behavior; never represent sample data as real.\n\n` +
    `## Tests-first steps\n\n1. Reproduce the current behavior and write a failing contract test.\n2. Add isolation, negative-permission, accessibility and migration cases before implementation.\n3. Implement the smallest compatible change.\n4. Mutation-check the highest-risk guard, then restore it.\n\n` +
    `## Verification commands\n\n\`cd app && npm run test\`  \n\`cd app && npm run build\`  \n\`cd app && npm run lint\`  \nRun the applicable disposable-database probe and browser smoke for this packet.\n\n` +
    `## Migration and rollback\n\nUse additive schema changes, backfill in bounded batches, prove old-client compatibility, record reversible application steps, and rehearse rollback against a disposable copy before production. Never remove or reinterpret existing data until readback and rollback evidence are approved.\n\n` +
    `## Definition of complete\n\nCode, schema, tests, documentation, telemetry, migration rehearsal and rollback evidence all pass in the intended environment. External integrations remain externally gated until credentialed authoritative readback succeeds.\n\n` +
    `## Evidence return format\n\nReturn commit SHA, changed paths, requirement IDs, test commands and results, migration and rollback evidence, screenshots or API readback where applicable, known risks, external gates, and a direct statement of what was not verified.\n\n` +
    `## Stop conditions\n\n${stopConditions}\n`;
}

export function validateManifest(manifest) {
  const slugs = manifest.documents?.map((entry) => entry.slug) ?? [];
  if (JSON.stringify(slugs) !== JSON.stringify(REQUIRED_PUBLICATION_SLUGS)) {
    throw new Error('required publication slugs are missing, extra, or out of order');
  }
  if (manifest.executionPackets?.length !== 9) throw new Error('exactly nine execution packets are required');
  for (const entry of [...manifest.documents, ...manifest.executionPackets]) {
    if (!entry.title || !entry.outputFilename || !entry.owner || !entry.verificationDate || !entry.generationStatus || !entry.sha256) {
      throw new Error(`incomplete manifest entry: ${entry.slug}`);
    }
    if (!Array.isArray(entry.sourceSections) || entry.sourceSections.length === 0 || entry.sourceSections.some((value) => !String(value).trim())) {
      throw new Error(`empty source section: ${entry.slug}`);
    }
  }
}

export function generateArtifacts() {
  const spec = read('docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md');
  const census = JSON.parse(read('docs/institutional-rollout/generated/current-state.json'));
  const capability = read('docs/institutional-rollout/generated/capability-disposition.md');
  const traceability = read('docs/institutional-rollout/generated/requirements-traceability.md');
  const schema = read('docs/institutional-rollout/tenant-role-schema-map.md');
  const sourceIndex = JSON.parse(read('docs/institutional-rollout/source-index.json'));
  const inputs = { spec, census, capability, traceability, schema, sourceIndex };
  const publicationDir = join(generated, 'publication');
  const packetDir = join(generated, 'claude-code');
  mkdirSync(publicationDir, { recursive: true });
  mkdirSync(packetDir, { recursive: true });

  const documents = definitions.map(([slug, title, sourceSections, owner]) => {
    const text = publicationBody(slug, title, sourceSections, inputs);
    if (PROHIBITED.test(text)) throw new Error(`prohibited placeholder in ${slug}`);
    const outputFilename = `${slug}.md`;
    writeFileSync(join(publicationDir, outputFilename), text);
    return { slug, title, sourceSections, outputFilename, owner, verificationDate: VERIFIED_ON, generationStatus: 'generated', sha256: sha(text) };
  });

  const stopConditions = section(spec, 16)
    .split('Claude Code must stop and report when:')[1]
    ?.trim() ?? 'Stop when the approved architecture, data safety, tenant isolation, capability preservation or truthful external verification cannot be maintained.';
  const executionPackets = packetDefinitions.map((packet, index) => {
    const text = packetBody(index, packet, stopConditions);
    if (PROHIBITED.test(text)) throw new Error(`prohibited placeholder in ${packet[0]}`);
    const outputFilename = `${packet[0]}.md`;
    writeFileSync(join(packetDir, outputFilename), text);
    return {
      slug: packet[0], title: packet[1], sourceSections: ['§16 execution model', 'approved requirements', 'current repository evidence'],
      outputFilename, owner: 'Claude Code implementation owner', verificationDate: VERIFIED_ON,
      generationStatus: 'generated', sha256: sha(text),
    };
  });

  const manifest = { schemaVersion: 1, generatedOn: VERIFIED_ON, documents, executionPackets };
  validateManifest(manifest);
  writeFileSync(join(docsRoot, 'publication-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = generateArtifacts();
  console.log(`Generated ${manifest.documents.length} publication sources and ${manifest.executionPackets.length} Claude Code packets.`);
}
