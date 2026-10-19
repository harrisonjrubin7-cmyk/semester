import { realpath, stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { validateRelease } from '../validators/release-validator.ts';
import { loadRegistry, repositoryRoot, writeGenerated } from './registry-io.ts';
import { resolveInside, validateSnapshot } from './validation.ts';

const snapshot = await loadRegistry();
const registryIssues = await validateSnapshot(snapshot);
const artifacts = (snapshot.inception?.evidence_pack ?? []).map(({ artifact }) => artifact);
const releaseDirectory = resolve(repositoryRoot, 'release');
// A directory, or a symlink whose target lies outside the checkout, is not evidence even though it exists.
async function isRegularFileInRepository(path: string): Promise<boolean> {
  const target = await realpath(path).catch(() => null);
  if (target === null) return false;
  return target.startsWith((await realpath(repositoryRoot)) + sep) && (await stat(target)).isFile();
}
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
