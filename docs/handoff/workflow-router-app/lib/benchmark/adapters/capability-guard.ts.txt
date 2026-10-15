import type { Platform, WorkflowSpec } from '../benchmark.config';
/** Honest boundaries: what each platform can be asked to do at all. Execution itself is always manual — no approved automation API is assumed. */
export function capabilityGuard(platform: Platform, task: WorkflowSpec): { ok: true } | { ok: false; status: 'unsupported'; reason: string } {
  if (platform !== 'v0' && task.requiresPersistence) return { ok: false, status: 'unsupported', reason: (platform === 'claude-artifacts' ? 'Claude Artifacts' : 'ChatGPT Canvas') + ' has no durable backend, auth or secret store; this task needs ' + task.requirements.join(', ') + '. Record a run only to document the gap.' };
  return { ok: true };
}
