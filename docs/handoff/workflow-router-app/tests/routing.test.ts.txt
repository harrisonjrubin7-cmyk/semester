import { describe, expect, it } from 'vitest';
import { recommend } from '@/lib/workflow-router/engine';
import type { RouterAnswers } from '@/lib/validation/workflow-router';
const base: RouterAnswers = { deliverable: 'interactive-tool', interaction: 'simple-local', backend: 'none', technology: 'none', persistence: 'none', handoff: 'share' };
describe('router', () => {
  it('sends a self-contained tool to Claude Artifacts', () => { expect(recommend(base).primary).toBe('claude-artifacts'); });
  it('sends documents and data analysis to Canvas', () => { expect(recommend({ ...base, deliverable: 'document', interaction: 'none', handoff: 'document-export' }).primary).toBe('chatgpt-canvas'); expect(recommend({ ...base, deliverable: 'data-analysis', interaction: 'none' }).primary).toBe('chatgpt-canvas'); });
  const forced: Partial<RouterAnswers>[] = [{ technology: 'nextjs' }, { technology: 'nextjs-postgres' }, { technology: 'nextjs-supabase' }, { backend: 'database' }, { backend: 'server-api' }, { backend: 'auth-secrets' }, { persistence: 'database' }, { persistence: 'auth' }, { persistence: 'multi-tenant' }, { persistence: 'realtime' }, { interaction: 'multi-user' }, { handoff: 'github' }, { handoff: 'vercel' }];
  for (const f of forced) it('forces v0 for ' + JSON.stringify(f), () => { const r = recommend({ ...base, deliverable: 'diagram', ...f }); expect(r.primary).toBe('v0'); expect(r.forcedV0).toBe(true); expect(r.escalation).toBe(true); });
  it('bounds confidence', () => { const c = recommend(base).confidence; expect(c).toBeGreaterThan(0.5); expect(c).toBeLessThanOrEqual(0.97); });
});
