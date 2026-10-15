import type { BenchmarkAdapter, AdapterRun } from './types';
import { capabilityGuard } from './capability-guard';
const MANUAL = 'Run the prompt in v0, push to GitHub, and record the repo/deployment URL, file manifest and test log. Persistence is graded only from a reload test with a row id or log.';
export const v0Adapter: BenchmarkAdapter = {
  platform: 'v0',
  canRun(task) { const g = capabilityGuard('v0', task); return g.ok ? { ok: false, status: 'manual-review-required', reason: MANUAL } : g; },
  async run(task) { const g = this.canRun(task); return { platform: 'v0', status: g.ok ? 'completed' : g.status, reason: g.ok ? undefined : g.reason, executedPrompt: task.prompt }; },
  collectEvidence(run: AdapterRun) { return { outputUrl: run.outputUrl, manifest: run.manifest ?? [], notes: [run.consoleNotes ?? '', run.reason ?? ''].filter(Boolean) }; },
  evaluatePersistence() { return { tested: false, survivedReload: null, mode: 'project-backed' }; },
  reportUnsupported(reason) { return { platform: 'v0', status: 'unsupported', reason, executedPrompt: '' }; },
};
