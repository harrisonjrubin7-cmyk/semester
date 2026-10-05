import type { BenchmarkAdapter, AdapterRun } from './types';
import { capabilityGuard } from './capability-guard';
const MANUAL = 'No approved programmatic integration for ChatGPT Canvas is assumed. Run the prompt in Canvas, export the document/code, and attach the file manifest and a share link.';
export const chatgptCanvasAdapter: BenchmarkAdapter = {
  platform: 'chatgpt-canvas',
  canRun(task) { const g = capabilityGuard('chatgpt-canvas', task); return g.ok ? { ok: false, status: 'manual-review-required', reason: MANUAL } : g; },
  async run(task) { const g = this.canRun(task); return { platform: 'chatgpt-canvas', status: g.ok ? 'completed' : g.status, reason: g.ok ? undefined : g.reason, executedPrompt: task.prompt }; },
  collectEvidence(run: AdapterRun) { return { outputUrl: run.outputUrl, manifest: run.manifest ?? [], notes: [run.consoleNotes ?? '', run.reason ?? ''].filter(Boolean) }; },
  evaluatePersistence() { return { tested: false, survivedReload: null, mode: 'local-preview' }; },
  reportUnsupported(reason) { return { platform: 'chatgpt-canvas', status: 'unsupported', reason, executedPrompt: '' }; },
};
