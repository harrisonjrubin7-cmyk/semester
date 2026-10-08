'use client';
import { useMemo, useState, useTransition } from 'react';
import type { RouterAnswers } from '@/lib/validation/workflow-router';
import { recommend } from '@/lib/workflow-router/engine';
import { buildPrompt, githubPlan, supabasePrompt } from '@/lib/workflow-router/prompts';
import { recommendationMarkdown } from '@/lib/exports/markdown';
import { toJson } from '@/lib/exports/json';
import { DecisionTree } from './decision-tree';
import { RecommendationPanel } from './recommendation-panel';
import { CopyBlock } from './prompt-builder';
import { saveRecommendation } from '@/app/workflow-router/actions';
const DEFAULT: RouterAnswers = { deliverable: 'interactive-tool', interaction: 'complex-local', backend: 'file-export', technology: 'react', persistence: 'none', handoff: 'share' };
const download = (name: string, type: string, body: string) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([body], { type })); a.download = name; a.click(); URL.revokeObjectURL(a.href); };
export function WorkflowRouter({ signedIn }: { signedIn: boolean }) {
  const [a, setA] = useState<RouterAnswers>(DEFAULT); const r = useMemo(() => recommend(a), [a]); const prompt = buildPrompt(a, r);
  const [said, setSaid] = useState(''); const [pending, start] = useTransition();
  return (<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
    <DecisionTree value={a} onChange={setA} />
    <div className="grid content-start gap-4"><RecommendationPanel r={r} />
      <div className="flex flex-wrap gap-2"><button className="min-h-10 rounded border px-3 text-sm" onClick={() => download('semester-recommendation.md', 'text/markdown', recommendationMarkdown(a, r, prompt))}>Download Markdown</button>
        <button className="min-h-10 rounded border px-3 text-sm" onClick={() => download('semester-recommendation.json', 'application/json', toJson({ answers: a, recommendation: r, prompt }))}>Download JSON</button>
        <button disabled={!signedIn || pending} title={signedIn ? '' : 'Sign in to save'} className="min-h-10 rounded bg-slate-800 px-3 text-sm text-white disabled:opacity-50" onClick={() => start(async () => { const res = await saveRecommendation({ title: a.deliverable + ' → ' + r.primary, organizationId: null, answers: a, visibility: 'private' }); setSaid(res.ok ? 'Saved to your recommendations.' : typeof res.error === 'string' ? res.error : 'Check the inputs.'); })}>{signedIn ? 'Save recommendation' : 'Sign in to save'}</button></div>
      <p role="status" className="text-sm">{said}</p>
      <CopyBlock label="Build prompt" text={prompt} /><CopyBlock label="GitHub handoff plan" text={githubPlan(r).map((x, i) => i + 1 + '. ' + x).join('\n')} />
      {(a.technology === 'nextjs-supabase' || a.persistence !== 'none') && <CopyBlock label="Supabase implementation prompt" text={supabasePrompt()} />}</div></div>);
}
