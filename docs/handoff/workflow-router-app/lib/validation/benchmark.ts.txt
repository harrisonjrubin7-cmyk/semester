import { z } from 'zod';
import { CRITERIA, PERSISTENCE_MODES, PLATFORMS } from '../benchmark/benchmark.config';
const grade = z.number().int().min(0).max(5).nullable();
export const RunSchema = z.object({
  taskId: z.string().uuid(), platform: z.enum(PLATFORMS), executedPrompt: z.string().min(1),
  modelName: z.string().max(120).optional(), modelVersion: z.string().max(120).optional(),
  status: z.enum(['pending', 'running', 'completed', 'manual-review-required', 'unsupported', 'failed']),
  statusReason: z.string().max(2000).optional(), outputUrl: z.string().url().optional().or(z.literal('')),
  sourceManifest: z.array(z.object({ path: z.string(), bytes: z.number().int().nonnegative().optional() })).default([]),
  runtimeNotes: z.string().max(4000).optional(), consoleNotes: z.string().max(8000).optional(), durationMs: z.number().int().nonnegative().optional(),
  persistenceTested: z.boolean().default(false), persistenceSurvivedReload: z.boolean().nullable().default(null),
  persistenceMode: z.enum(PERSISTENCE_MODES).default('none'), persistenceEvidence: z.string().max(2000).optional(), persistenceFailureNotes: z.string().max(2000).optional(),
}).superRefine((r, ctx) => {
  if ((r.status === 'manual-review-required' || r.status === 'unsupported') && !r.statusReason) ctx.addIssue({ code: 'custom', path: ['statusReason'], message: 'Explain why the run needs manual review or is unsupported' });
  if (r.persistenceTested && r.persistenceSurvivedReload === null) ctx.addIssue({ code: 'custom', path: ['persistenceSurvivedReload'], message: 'Record whether state survived reload' });
  if (r.persistenceTested && !r.persistenceEvidence) ctx.addIssue({ code: 'custom', path: ['persistenceEvidence'], message: 'Persistence evidence (URL, row id, screenshot or log) is required' });
});
export const GradeSchema = z.object({ runId: z.string().uuid(), ...Object.fromEntries(CRITERIA.map((c) => [c, grade])) as Record<(typeof CRITERIA)[number], typeof grade>, evidence: z.string().max(4000).optional(), notes: z.string().max(4000).optional() });
