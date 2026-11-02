import { useState } from 'react';
import { toast } from 'sonner';
import { marketing } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Header, Panel, Chip, Loadable, useLoad, fmt, errMsg } from './ui';

/* eslint-disable @typescript-eslint/no-explicit-any */
type C = any;
const usd = (minor: number) => `$${(minor / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}`;

function useRun(reload: () => void) {
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const run = async (input: Record<string, unknown>) => {
    setBusy(true);
    try {
      const r = await marketing({ op: 'run', commandKey: key, ...input } as never) as { resultCode: string; message: string; replay: boolean };
      (r.resultCode === 'OK' ? toast.success : toast.error)(`${r.replay ? '(already done) ' : ''}${r.message}`);
      if (r.resultCode === 'OK') { setKey(crypto.randomUUID()); reload(); return true; }
    } catch (e) { toast.error(errMsg(e)); }
    finally { setBusy(false); }
    return false;
  };
  return { run, busy };
}

function NewCampaign({ reload }: { reload: () => void }) {
  const [f, setF] = useState({ name: '', channel: 'email', goal: '' });
  const { run, busy } = useRun(reload);
  return (
    <Panel title="New campaign">
      <form className="grid gap-2 sm:grid-cols-[2fr_1fr_2fr_auto]" onSubmit={async (e) => { e.preventDefault(); if (await run({ action: 'create', ...f })) setF({ name: '', channel: 'email', goal: '' }); }}>
        <Input aria-label="Campaign name" placeholder="Campaign name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <select aria-label="Channel" className="rounded-[3px] border border-input bg-background p-2 text-sm" value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value })}>
          <option value="email">Email</option><option value="event">Event</option><option value="social">Social</option></select>
        <Input aria-label="Goal" placeholder="Goal (e.g. 3 pilot conversations)" value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })} />
        <Button type="submit" disabled={busy || f.name.trim().length < 3}>Create draft</Button>
      </form>
    </Panel>
  );
}

function Campaign({ c, d, reload }: { c: C; d: any; reload: () => void }) {
  const { run, busy } = useRun(reload);
  const [e, setE] = useState({ subject: c.subject, body: c.body, spend: String(c.spendMinor / 100) });
  const [note, setNote] = useState('');
  const mine = c.authorId === d.me;
  const canApprove = d.roles.includes('marketing_approver') && !mine && c.state === 'in_review';
  const go = (action: string, extra: Record<string, unknown> = {}) => run({ action, campaignId: c.id, version: c.version, ...extra });
  return (
    <div className="space-y-4">
      <Panel title={<span className="flex flex-wrap items-center gap-2">#{c.number} {c.name} <Chip value={c.state.replace('_', ' ')} /><Chip value={c.channel} /></span>}>
        <p className="text-sm">By {c.author}{c.goal ? ` · Goal: ${c.goal}` : ''}</p>
        <p className="mt-1 text-sm">Audience: {c.audienceSize ?? '—'} consented contacts{c.audienceSize == null ? ' (counted when submitted)' : ' (snapshot at submission)'} · Spend: {usd(c.spendMinor)}</p>
        {c.state === 'approved' && <p className="mt-2 text-sm">Approved by {c.approvedBy} · {fmt(c.approvedAt)}. <strong>Sending is disabled:</strong> nothing has been or can be sent from here.</p>}
        {c.note && <p className="mt-1 text-xs text-muted-foreground">Review note: {c.note}</p>}
      </Panel>
      {mine && c.state !== 'in_review' ? (
        <Panel title="Content">
          {c.state === 'approved' && <p role="status" className="mb-2 text-xs">Editing an approved campaign voids its approval.</p>}
          <div className="space-y-2">
            <Input aria-label="Subject" placeholder="Subject" value={e.subject} onChange={(x) => setE({ ...e, subject: x.target.value })} />
            <Textarea aria-label="Body" rows={8} placeholder={c.channel === 'email' ? 'Body. Must include {{unsubscribe}}.' : 'Body'} value={e.body} onChange={(x) => setE({ ...e, body: x.target.value })} />
            <label className="block text-xs">Paid spend (USD)<Input type="number" min={0} step="0.01" value={e.spend} onChange={(x) => setE({ ...e, spend: x.target.value })} className="mt-1 w-40" /></label>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={busy} onClick={() => go('edit', { subject: e.subject, body: e.body, spendMinor: Math.round(Number(e.spend || 0) * 100) })}>Save</Button>
              {['draft', 'rejected'].includes(c.state) && <Button size="sm" variant="outline" disabled={busy} onClick={() => go('submit')}>Submit for approval</Button>}
            </div>
            <p className="text-xs text-muted-foreground">Audience is fixed: only the {d.audience} contacts who consented to contact. Student and education records can never be an audience.</p>
          </div>
        </Panel>
      ) : (
        <Panel title="Content (exactly as it would be approved)">
          <p className="font-medium">{c.subject || '—'}</p>
          <p className="mt-2 whitespace-pre-wrap text-sm">{c.body || '—'}</p>
          {mine && c.state === 'in_review' && <Button size="sm" variant="outline" className="mt-3" disabled={busy} onClick={() => go('withdraw')}>Withdraw to edit</Button>}
          {canApprove && <div className="mt-3 space-y-2 border-t border-border pt-3">
            <Textarea aria-label="Review note" rows={2} placeholder="Review note (required to reject)" value={note} onChange={(x) => setNote(x.target.value)} />
            <div className="flex gap-2">
              <Button size="sm" disabled={busy} onClick={() => go('approve', { seenHash: c.hash, note })}>Approve exactly this</Button>
              <Button size="sm" variant="outline" disabled={busy || note.trim().length < 5} onClick={() => go('reject', { seenHash: c.hash, note })}>Reject</Button>
            </div></div>}
          {!mine && c.state === 'in_review' && !d.roles.includes('marketing_approver') && <p className="mt-2 text-xs text-muted-foreground">Waiting for a marketing approver.</p>}
          {mine && c.state === 'in_review' && <p className="mt-2 text-xs text-muted-foreground">Someone other than you must approve it.</p>}
        </Panel>
      )}
      <Panel title={`History · ${c.timeline.length}`}>
        <ol className="space-y-1 text-sm">{c.timeline.map((t: any, i: number) => <li key={i}><span className="text-xs text-muted-foreground">{fmt(t.at)} · {t.actor}</span> — {t.action}{t.detail ? ` · ${t.detail}` : ''}</li>)}</ol>
      </Panel>
    </div>
  );
}

export default function MarketingPage() {
  const s = useLoad(() => marketing({ op: 'list' }) as Promise<any>, []);
  const [sel, setSel] = useState<string | null>(null);
  return (
    <div className="mx-auto max-w-6xl">
      <Header eyebrow="Growth" title="Marketing" sub="Campaigns reach only contacts who consented. Someone other than the author approves the exact content, audience and spend. Sending is disabled." />
      <Loadable state={s}>{(d: any) => {
        const cur = d.campaigns.find((c: C) => c.id === sel) ?? d.campaigns[0];
        return (
          <div className="space-y-4">
            {d.roles.includes('marketer') && <NewCampaign reload={s.reload} />}
            {!d.campaigns.length ? <Panel><p className="text-sm text-muted-foreground">No campaigns yet.</p></Panel> : (
              <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
                <nav aria-label="Campaigns" className="space-y-1">{d.campaigns.map((c: C) => (
                  <button key={c.id} onClick={() => setSel(c.id)} className={`block w-full rounded-[3px] border p-2 text-left text-sm ${c.id === cur.id ? 'border-primary bg-accent' : 'border-border hover:bg-muted'}`}>
                    #{c.number} {c.name}<span className="mt-1 flex gap-1"><Chip value={c.state.replace('_', ' ')} /></span></button>))}</nav>
                <Campaign key={`${cur.id}:${cur.version}`} c={cur} d={d} reload={s.reload} />
              </div>)}
          </div>
        );
      }}</Loadable>
    </div>
  );
}
