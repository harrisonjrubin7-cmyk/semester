import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ask, AskOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Textarea } from '@project/components/ui/textarea';
import { PageHeader, Panel, SourceTag, errMsg } from '../components/kit';
import { ModeBar, ExecutiveBrief, WorkflowConcierge, AskMode } from '../components/Intelligence';

type Turn = { q: string; step: 'reading' | 'ready'; res?: AskOutputType };

export default function Ask() {
  const [q, setQ] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [mode, setMode] = useState<AskMode | 'executive_assistant' | 'workflow_concierge'>(undefined);
  const send = async () => {
    const question = q.trim(); if (!question) return;
    setQ(''); setTurns((t) => [{ q: question, step: 'reading' }, ...t]);
    try {
      const res = await ask({ question, mode: mode === 'executive_assistant' || mode === 'workflow_concierge' ? undefined : mode });
      setTurns((t) => t.map((x, i) => (i === 0 ? { ...x, step: 'ready', res } : x)));
    } catch (e) { toast.error(errMsg(e)); setTurns((t) => t.slice(1)); }
  };
  return (
    <>
      <PageHeader eyebrow="Learn" title="Ask Semester" sub="Assistive and source-linked. It reads only what you can already see, and anything that changes data needs your confirmation." />
      <ModeBar mode={mode} setMode={setMode} />
      {mode === 'executive_assistant' && <ExecutiveBrief />}
      {mode === 'workflow_concierge' && <WorkflowConcierge />}
      <Panel className="mb-4">
        <Textarea value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. What do I still need for my major?" onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground"><span>✦ Answers are labeled AI-assisted. Ask Semester can be wrong. Check the sources.</span><Button size="sm" onClick={send} disabled={!q.trim()}>Ask</Button></div>
      </Panel>
      <div className="space-y-4">
        {turns.map((t, i) => (
          <Panel key={i}>
            <p className="text-sm text-muted-foreground">You asked: {t.q}</p>
            <div className="mt-3 border-l-2 border-border pl-4 text-sm">
              <div className="flex flex-wrap items-center gap-2 text-xs"><SourceTag source="AI Assisted" /><span className="text-muted-foreground">Step: {t.step === 'reading' ? 'Reading your records…' : 'Ready'}</span></div>
              {t.res && (<>
                {!t.res.allowed ? (
                  <p className="mt-2">⊘ You haven’t allowed Ask Semester to read your materials. Turn it on in <Link to="/you" className="text-primary underline">You → Privacy & data</Link>.</p>
                ) : t.res.decision?.level === 'blocked' ? (
                  <div role="status" className="mt-2 rounded-[3px] border border-destructive/40 bg-destructive/5 p-3">
                    <p className="font-medium">⊘ Course AI rules: {t.res.decision.course} · {t.res.decision.rule}</p>
                    <p className="mt-1">{t.res.decision.reason}</p>
                    <p className="mt-1 text-xs text-muted-foreground">No records were read and nothing was sent to an AI provider.</p>
                  </div>
                ) : (<>
                  {t.res.decision?.level === 'outline' && (
                    <p role="status" className="mt-2 rounded-[3px] border border-border bg-muted/40 p-2 text-xs">◐ Outline only{t.res.decision.course ? ` · ${t.res.decision.course}` : ''}: {t.res.decision.reason}</p>
                  )}
                  <p className="mt-2 text-muted-foreground">Allowed to read: {t.res.scope.join(', ')}</p>
                  {t.res.withheld && <p className="mt-1 text-xs text-muted-foreground">Kept inside Semester, not sent to the AI provider: {t.res.withheld}. Semester never sends student records to AI providers; they are listed below for you to read.</p>}
                  {t.res.answer ? <p className="mt-2 whitespace-pre-wrap">{t.res.answer}</p>
                    : <p className="mt-2">{t.res.sources.some((x: { sentToAI: boolean }) => x.sentToAI) ? '! Ask Semester couldn’t write an answer this time. Here are the matching records.' : t.res.sources.length ? 'These matching records are yours to read. They are student records, so Semester does not send them to an AI provider for a written answer.' : 'No records in your scope match this question, so there’s nothing to answer from.'}</p>}
                  {t.res.sources.length === 0 ? <p className="mt-2 text-muted-foreground">No matching records you can see.</p> : (
                    <ol className="mt-2 space-y-1.5">{t.res.sources.map((s: AskOutputType['sources'][0], n: number) => (
                      <li key={s.id} className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs">[{n + 1}]</span><Link to={s.path} className="hover:underline">{s.title}</Link><span className="text-xs text-muted-foreground">{s.kind} · {s.detail}</span><SourceTag source={s.source} />{!s.sentToAI && <span className="text-[11px] text-muted-foreground">· not sent to AI</span>}</li>))}</ol>)}
                  <p className="mt-3 text-xs text-muted-foreground">Confidence: {t.res.confidence ?? 'not applicable'}.{t.res.limits ? ` Can't know: ${t.res.limits}` : ''} It can be wrong; check the sources. Policy: {t.res.policy}. Decisions about your record go to a person.</p>
                </>)}
              </>)}
            </div>
          </Panel>
        ))}
      </div>
    </>
  );
}
