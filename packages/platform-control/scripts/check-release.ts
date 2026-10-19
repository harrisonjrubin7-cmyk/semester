import { resolve } from 'node:path';
import { validateRelease } from '../validators/release-validator.ts';
import { loadRegistry, repositoryRoot, writeGenerated } from './registry-io.ts';
import { isRegularFileInRepository, resolveInside, validateSnapshot } from './validation.ts';

const snapshot = await loadRegistry();
const registryIssues = await validateSnapshot(snapshot);
const artifacts = (snapshot.inception?.evidence_pack ?? []).map(({ artifact }) => artifact);
const releaseDirectory = resolve(repositoryRoot, 'release');
const presentArtifacts = new Set<string>();
for (const artifact of artifacts) {
  const absolute = resolveInside(releaseDirectory, artifact);
  if (absolute !== null && await isRegularFileInRepository(absolute)) presentArtifacts.add(artifact);
}
const decision = validateRelease(snapshot, presentArtifacts);
const report = { ...decision, allowed: registryIssues.length === 0 && decision.allowed, registryIssues };
await writeGenerated('release-evidence.json', report);
console.log(JSON.stringify(report, null, 2));
if (!report.allowed && !process.argv.includes('--report-only')) process.exitCode = 1;
