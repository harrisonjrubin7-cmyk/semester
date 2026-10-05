import type { BenchmarkAdapter, AdapterRun } from './types';
import { capabilityGuard } from './capability-guard';
const MANUAL = 'No approved programmatic integration for creating Claude Artifacts is assumed. Paste the exact prompt into claude.ai, publish the artifact, and record its URL, source and console notes.';
export const claudeArtifactsAdapter: BenchmarkAdapter = {
  platform: 'claude-artifacts',
  canRun(task) { const g = capabilityGuard('claude-artifacts', task); return g.ok ? { ok: false, status: 'manual-review-required', reason: MANUAL } : g; },
  async run(task) { const g = this.canRun(task); return { platform: 'claude-artifacts', status: g.ok ? 'completed' : g.status, reason: g.ok ? undefined : g.reason, executedPrompt: task.prompt }; },
  collectEvidence(run: AdapterRun) { return { outputUrl: run.outputUrl, manifest: run.manifest ?? [], notes: [run.consoleNotes ?? '', run.reason ?? ''].filter(Boolean) }; },
  evaluatePersistence() { return { tested: false, survivedReload: null, mode: 'local-preview' }; },
  reportUnsupported(reason) { return { platform: 'claude-artifacts', status: 'unsupported', reason, executedPrompt: '' }; },
};
