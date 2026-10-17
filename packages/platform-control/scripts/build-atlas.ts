import { capabilityReport } from '../validators/capability-validator.ts';
import { buildExecutionPlan } from '../validators/backlog-validator.ts';
import { loadRegistry, writeGenerated } from './registry-io.ts';
import { validateSnapshot } from './validation.ts';
import { componentEvidence } from '../src/design-system-component-evidence.ts';

const snapshot = await loadRegistry();
const issues = await validateSnapshot(snapshot);
if (issues.length) throw new Error(`Registry is invalid:\n${JSON.stringify(issues, null, 2)}`);

const routes = snapshot.screens.map(({ key, name, owner, status, route }) => ({ key, name, owner, status, route })).sort((a, b) => a.key.localeCompare(b.key));
const events = snapshot.capabilities.flatMap(({ key, events }) => events.map((event) => ({ event, capability: key }))).sort((a, b) => a.event.localeCompare(b.event));
const readiness = capabilityReport(snapshot.capabilities);
const designSystemCoverage = componentEvidence();
await Promise.all([
  writeGenerated('capability-report.json', capabilityReport(snapshot.capabilities)),
  writeGenerated('screen-atlas.json', snapshot.screens),
  writeGenerated('route-manifest.json', routes),
  writeGenerated('event-catalog.json', events),
  writeGenerated('readiness-report.json', readiness),
  writeGenerated('execution-board.json', snapshot.backlog),
  writeGenerated('execution-plan.json', buildExecutionPlan(snapshot.backlog)),
  writeGenerated('operations-readiness.json', snapshot.operationsReadiness ?? []),
  writeGenerated('design-system-component-evidence.json', designSystemCoverage),
]);
console.log(JSON.stringify({ generated: 9, capabilities: snapshot.capabilities.length, screens: snapshot.screens.length, events: events.length, backlogItems: snapshot.backlog.length, designSystemComponents: designSystemCoverage.summary.total }, null, 2));
