import { PLATFORM_LABEL, WORKFLOWS } from '../benchmark/benchmark.config';
import type { Recommendation } from '../workflow-router/engine';
import type { RouterAnswers } from '../validation/workflow-router';
export function recommendationMarkdown(a: RouterAnswers, r: Recommendation, prompt: string): string {
  return ['# Semester AI workflow recommendation', '', '| | |', '| --- | --- |', '| Primary | ' + PLATFORM_LABEL[r.primary] + ' |', '| Secondary | ' + PLATFORM_LABEL[r.secondary] + ' |', '| Confidence | ' + Math.round(r.confidence * 100) + '% |', '| Production escalation | ' + (r.escalation ? 'Yes — ' + r.escalationReasons.join('; ') : 'No') + ' |', '| Handoff | ' + r.handoffFormat + ' |', '',
    '## Requirements', ...Object.entries(a).map(([k, v]) => '- ' + k + ': ' + v), '', '## Why', ...r.reasons[r.primary].map((x) => '- ' + x), '', '## Limitations', ...r.limitations.map((x) => '- ' + x), '', '## Prompt', '```', prompt, '```', ''].join('\n');
}
export function benchmarkMarkdown(rows: { workflow: number; platform: string; status: string; outOf100: number | null; graders: number }[]): string {
  const title = (n: number) => WORKFLOWS.find((w) => w.number === n)?.title ?? String(n);
  return ['# Semester benchmark report', '', '| # | Workflow | Platform | Status | Score /100 | Graders |', '| --- | --- | --- | --- | --- | --- |', ...rows.map((r) => '| ' + r.workflow + ' | ' + title(r.workflow) + ' | ' + r.platform + ' | ' + r.status + ' | ' + (r.outOf100 ?? '—') + ' | ' + r.graders + ' |'), ''].join('\n');
}
