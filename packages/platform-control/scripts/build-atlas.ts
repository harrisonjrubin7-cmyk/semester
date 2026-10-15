import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { capabilityReport } from '../validators/capability-validator.ts';
import { buildExecutionPlan } from '../validators/backlog-validator.ts';
import { REQUIRED_RELEASE_ARTIFACTS, inceptionCoverage } from '../validators/inception-validator.ts';
import { renderRegistryProjection } from './projection.ts';
import { loadRegistry, repositoryRoot, writeGenerated, writeGeneratedText } from './registry-io.ts';
import { validateSnapshot } from './validation.ts';
import { renderCoverageMarkdown } from './coverage-markdown.ts';

const snapshot = await loadRegistry();
const issues = await validateSnapshot(snapshot);
if (issues.length) throw new Error(`Registry is invalid:\n${JSON.stringify(issues, null, 2)}`);
const inception = snapshot.inception!;

const routes = snapshot.screens.map(({ key, name, owner, status, route }) => ({ key, name, owner, status, route })).sort((a, b) => a.key.localeCompare(b.key));
const events = snapshot.capabilities.flatMap(({ key, events }) => events.map((event) => ({ event, capability: key }))).sort((a, b) => a.event.localeCompare(b.event));
const readiness = capabilityReport(snapshot.capabilities);

const coverage = inceptionCoverage(snapshot);
const eventCoverage = [...inception.events]
  .map(({ os, event, catalog_event, status }) => ({ os, event, catalog_event, status }))
  .sort((a, b) => a.os.localeCompare(b.os) || a.event.localeCompare(b.event));
const exists = (path: string) => access(resolve(repositoryRoot, path)).then(() => true, () => false);
const artifacts = await Promise.all([...inception.evidence_pack]
  .sort((a, b) => a.artifact.localeCompare(b.artifact))
  .map(async ({ artifact, producer, status }) => ({ artifact, producer, status, present: await exists(`release/${artifact}`) })));
const evidencePack = { required: REQUIRED_RELEASE_ARTIFACTS.length, present: artifacts.filter((a) => a.present).length, artifacts };

await Promise.all([
  writeGenerated('capability-report.json', readiness),
  writeGenerated('screen-atlas.json', snapshot.screens),
  writeGenerated('route-manifest.json', routes),
  writeGenerated('event-catalog.json', events),
  writeGenerated('readiness-report.json', readiness),
  writeGenerated('execution-board.json', snapshot.backlog),
  writeGenerated('execution-plan.json', buildExecutionPlan(snapshot.backlog)),
  writeGenerated('inception-coverage.json', coverage),
  writeGenerated('event-coverage.json', eventCoverage),
  writeGenerated('release-evidence-pack.json', evidencePack),
  writeGeneratedText('INCEPTION-COVERAGE.md', renderCoverageMarkdown(snapshot, coverage, eventCoverage, evidencePack)),
  writeGeneratedText('registry-projection.sql', renderRegistryProjection(snapshot)),
]);
console.log(JSON.stringify({
  generated: 12, capabilities: snapshot.capabilities.length, screens: snapshot.screens.length, events: events.length, backlogItems: snapshot.backlog.length,
  operatingSystems: inception.operating_systems.length, journeys: inception.journeys.length, requiredEvents: inception.events.length,
  eventsCarriedByCatalog: eventCoverage.filter((e) => e.catalog_event !== null).length, adapters: inception.adapters.length, evidenceArtifactsPresent: evidencePack.present,
}, null, 2));
