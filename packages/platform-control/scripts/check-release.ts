import { validateRelease } from '../validators/release-validator.ts';
import { loadRegistry, writeGenerated } from './registry-io.ts';
import { validateSnapshot } from './validation.ts';

const snapshot = await loadRegistry();
const registryIssues = await validateSnapshot(snapshot);
const decision = validateRelease(snapshot);
const report = { ...decision, allowed: registryIssues.length === 0 && decision.allowed, registryIssues };
await writeGenerated('release-evidence.json', report);
console.log(JSON.stringify(report, null, 2));
if (!report.allowed) process.exitCode = 1;
