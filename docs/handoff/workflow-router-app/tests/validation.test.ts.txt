import { describe, expect, it } from 'vitest';
import { RunSchema } from '@/lib/validation/benchmark';
const ok = { taskId: '00000000-0000-4000-8000-000000000000', platform: 'v0', executedPrompt: 'x', status: 'completed' };
describe('RunSchema', () => {
  it('accepts a minimal completed run', () => { expect(RunSchema.safeParse(ok).success).toBe(true); });
  it('requires a reason for manual-review-required', () => { expect(RunSchema.safeParse({ ...ok, status: 'manual-review-required' }).success).toBe(false); });
  it('requires reload result and evidence when persistence was tested', () => { expect(RunSchema.safeParse({ ...ok, persistenceTested: true }).success).toBe(false); expect(RunSchema.safeParse({ ...ok, persistenceTested: true, persistenceSurvivedReload: true, persistenceEvidence: 'row 42' }).success).toBe(true); });
  it('rejects unknown platforms', () => { expect(RunSchema.safeParse({ ...ok, platform: 'bolt' }).success).toBe(false); });
});
