import { describe, expect, it } from 'vitest';
import { toCsv } from '@/lib/exports/csv';
import { recommendationMarkdown } from '@/lib/exports/markdown';
import { recommend } from '@/lib/workflow-router/engine';
describe('exports', () => {
  it('escapes CSV and guards formulas', () => { expect(toCsv([{ a: 'x,y', b: '=SUM(1)' }])).toBe('a,b\r\n"x,y","\'=SUM(1)"\r\n'); });
  it('writes a Markdown recommendation with primary and escalation', () => { const a = { deliverable: 'full-stack', interaction: 'multi-user', backend: 'database', technology: 'nextjs-supabase', persistence: 'multi-tenant', handoff: 'vercel' } as const; const md = recommendationMarkdown(a, recommend(a), 'p'); expect(md).toContain('| Primary | v0 |'); expect(md).toContain('Production escalation | Yes'); });
});
