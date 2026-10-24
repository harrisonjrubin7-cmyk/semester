import { useState } from 'react';
import { toast } from 'sonner';
import { registration, RegistrationOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Textarea } from '@project/components/ui/textarea';
import { Input } from '@project/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Link } from 'react-router-dom';
import { PageHeader, Panel, Empty, useLoad, Loadable, errMsg, ActionPreview, Status } from '../components/kit';
import { ConfirmAction } from '../components/overlays';

type Check = { key: string; label: string; state: 'ok' | 'blocked' | 'info'; detail: string; fixPath?: string };
const MARK = { ok: '✓', blocked: '!', info: 'i' } as const;

function ReadinessPanel({ checks, ready, count, onSubmit }: { checks: Check[]; ready: boolean; count: number; onSubmit: () => Promise<void> }) {
  return (
    <Panel title={ready ? 'Ready to submit' : 'Not ready yet'}>
      <ul className="space-y-2 text-sm" aria-label="Registration readiness checks">
        {checks.map((c) => (
          <li key={c.key} className="flex gap-2">
            <span aria-hidden className={c.state === 'blocked' ? 'font-semibold text-destructive' : 'text-muted-foreground'}>{MARK[c.state]}</span>
            <div><p className="font-medium">{c.label}<span className="sr-only"> — {c.state === 'ok' ? 'met' : c.state === 'blocked' ? 'not met' : 'for information'}</span></p>
              <p className="text-xs text-muted-foreground">{c.detail}{c.fixPath && <> <Link to={c.fixPath} className="text-primary underline">Get help with this</Link></>}</p></div>
          </li>))}
      </ul>
      <div className="mt-3">
        {ready ? (
          <ConfirmAction trigger={<Button className="w-full">Submit registration request</Button>} title={`Send ${count} ${count === 1 ? 'section' : 'sections'} to the Registrar?`} confirmLabel="Submit request" onConfirm={onSubmit}>
            <ActionPreview says="Your draft goes to the Registrar's enrollment queue. You are enrolled only when the Registrar confirms each section; you'll get a notification." stays="Your sections stay reserved in your plan, not in the official system, until then." recovery={{ kind: 'undo', how: 'withdraw any section the Registrar has not acted on yet.' }} />
          </ConfirmAction>
        ) : <Button className="w-full" disabled>Submit registration request</Button>}
        {!ready && <p className="mt-2 text-xs text-muted-foreground">Fix the items marked ! to submit.</p>}
      </div>
    </Panel>
  );
}

const TERM = 'Spring 2027';
type Row = { sectionId: string; code: string; title: string; missing: string[]; approved: boolean; pending: boolean };

export default function Registration() {
  const state = useLoad(() => registration({ action: 'get', term: TERM }) as Promise<RegistrationOutputType>);
  const [q, setQ] = useState('');
  const [override, setOverride] = useState<Row | null>(null);
  const [step, setStep] = useState<'review' | 'confirm'>('review');
  const [reason, setReason] = useState('');
  const act = async (fn: () => Promise<unknown>, ok?: string) => { try { await fn(); if (ok) toast.success(ok); await state.reload(); } catch (e) { toast.error(errMsg(e)); } };

  const statusOf = (r: Row & { conflicts?: string[] }) =>
    r.missing.length && !r.approved ? (r.pending ? `… Override pending` : `! Prerequisite missing: ${r.missing.join(', ')}`)
      : r.conflicts?.length ? `⇄ Time conflict with ${r.conflicts.join(', ')}` : '✓ Fits';

  return (
    <>
      <PageHeader eyebrow="Plan" title={`${TERM} registration draft`} sub="Prepare your schedule before your window opens. This is a plan, not an enrollment." />
      <Loadable state={state}>{(d) => {
        const credits = d.draft.reduce((n: number, r: { credits: number }) => n + r.credits, 0);
        const catalog = d.catalog.filter((c: Row) => (c.code + c.title).toLowerCase().includes(q.toLowerCase()));
        return (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              {d.holds.length > 0 && <div className="rounded-md border border-destructive/40 bg-card p-3 text-sm">! {d.holds[0]} — you can still plan, but registration needs it cleared.</div>}
              <Panel title={`Your draft · ${credits} credits`}>
                {d.draft.length === 0 ? <Empty>Add sections from the catalog to start a draft.</Empty> : (
                  <div className="overflow-x-auto"><table className="w-full text-sm">
                    <thead><tr className="eyebrow text-left"><th className="py-1 font-semibold">Course</th><th className="font-semibold">Section</th><th className="font-semibold">Time</th><th className="font-semibold">Status</th><th /></tr></thead>
                    <tbody>{d.draft.map((r: Row & { enrollmentId: string; section: string; times: string; conflicts: string[] }) => (
                      <tr key={r.enrollmentId} className="border-t border-border align-top">
                        <td className="py-2"><p className="font-medium">{r.code}</p><p className="text-xs text-muted-foreground">{r.title}</p></td>
                        <td className="py-2 font-mono text-xs">{r.section}</td><td className="py-2">{r.times}</td>
                        <td className="py-2 text-xs">{statusOf(r)}{r.missing.length > 0 && !r.approved && !r.pending && <button className="ml-1 block text-primary underline" onClick={() => { setOverride(r); setStep('review'); setReason(''); }}>Request override</button>}</td>
                        <td className="py-2 text-right"><Button size="sm" variant="ghost" onClick={() => act(() => registration({ action: 'remove', enrollmentId: r.enrollmentId }))}>Remove</Button></td>
                      </tr>))}</tbody>
                  </table></div>)}
              </Panel>
            </div>
            <div className="space-y-4">
            <ReadinessPanel checks={d.readiness.checks as Check[]} ready={d.readiness.ready} count={d.draft.length}
              onSubmit={async () => {
                // Keep the same key across retries so a timed-out submit can't create a second request.
                const w = window as unknown as { __regKey?: string };
                w.__regKey ??= crypto.randomUUID();
                await registration({ action: 'submit', term: TERM, requestKey: w.__regKey });
                w.__regKey = undefined;
                toast.success('Received by the Registrar. Enrollment is not confirmed yet.'); await state.reload(); }} />
            {d.status.length > 0 && (
              <Panel title="Registration status">
                <ul className="divide-y divide-border text-sm">{d.status.map((r: { enrollmentId: string; code: string; title: string; status: string }) => (
                  <li key={r.enrollmentId} className="flex items-center justify-between gap-2 py-2">
                    <span><span className="font-medium">{r.code}</span> <span className="text-xs text-muted-foreground">{r.title}</span></span>
                    <span className="flex items-center gap-2"><Status value={r.status === 'Requested' ? 'Waiting for Registrar' : r.status} />
                      {r.status === 'Requested' && <Button size="sm" variant="ghost" onClick={() => act(() => registration({ action: 'withdrawRequest', enrollmentId: r.enrollmentId }), 'Moved back to your draft')}>Withdraw</Button>}</span>
                  </li>))}</ul>
              </Panel>
            )}
            <Panel title="Catalog">
              <Input placeholder="Filter courses" value={q} onChange={(e) => setQ(e.target.value)} className="mb-3" />
              <div className="space-y-2">{catalog.length === 0 ? <Empty>No sections match.</Empty> : catalog.map((c: Row & { times: string; credits: number }) => (
                <div key={c.sectionId} className="flex items-center justify-between gap-2 border-b border-border pb-2 text-sm last:border-0">
                  <div><p className="font-medium">{c.code} · {c.title}</p><p className="text-xs text-muted-foreground">{c.times} · {c.credits} cr{c.missing.length > 0 && ` · needs ${c.missing.join(', ')}`}</p></div>
                  <Button size="sm" variant="outline" onClick={() => act(() => registration({ action: 'add', sectionId: c.sectionId }))}>Add</Button>
                </div>))}</div>
            </Panel>
            </div>
          </div>
        );
      }}</Loadable>
      <Dialog open={!!override} onOpenChange={(o) => !o && setOverride(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{step === 'review' ? 'Review' : 'Confirm'} · Prerequisite override · {override?.code}</DialogTitle></DialogHeader>
          {step === 'review' ? (<>
            <p className="text-sm text-muted-foreground">Missing: {override?.missing.join(', ')}. Tell your advisor why you’re ready.</p>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. I completed equivalent coursework at…" />
            <DialogFooter><Button variant="outline" onClick={() => setOverride(null)}>Keep draft</Button><Button disabled={reason.trim().length < 5} onClick={() => setStep('confirm')}>Review request</Button></DialogFooter>
          </>) : (<>
            <p className="text-sm">Your request goes to the <strong>Academic Advising</strong> approval queue. Someone other than you must approve it. You are not enrolled until the registrar confirms it.</p>
            <DialogFooter><Button variant="outline" onClick={() => setStep('review')}>Back</Button><Button onClick={() => { const r = override!; setOverride(null); act(() => registration({ action: 'requestOverride', sectionId: r.sectionId, reason }), 'Request sent to Academic Advising'); }}>Send request</Button></DialogFooter>
          </>)}
        </DialogContent>
      </Dialog>
    </>
  );
}
