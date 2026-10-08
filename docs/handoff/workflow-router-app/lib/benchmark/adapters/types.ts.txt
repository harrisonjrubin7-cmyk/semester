import type { Platform, WorkflowSpec } from '../benchmark.config';
import type { PersistenceObservation } from '../probes/persistence';
export type RunStatus = 'completed' | 'manual-review-required' | 'unsupported' | 'failed';
export interface AdapterRun { platform: Platform; status: RunStatus; reason?: string; executedPrompt: string; outputUrl?: string; manifest?: { path: string; bytes?: number }[]; consoleNotes?: string; durationMs?: number }
export interface Evidence { outputUrl?: string; manifest: { path: string }[]; notes: string[] }
export interface BenchmarkAdapter {
  platform: Platform;
  canRun(task: WorkflowSpec): { ok: true } | { ok: false; status: 'manual-review-required' | 'unsupported'; reason: string };
  run(task: WorkflowSpec): Promise<AdapterRun>;
  collectEvidence(run: AdapterRun): Evidence;
  evaluatePersistence(run: AdapterRun): PersistenceObservation;
  reportUnsupported(reason: string): AdapterRun;
}
