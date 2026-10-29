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

function NewCampaign({ d, reload }: { d: any; reload: () => void }) {
  const [f, setF] = useState({ name: '', channel: 'email', goal: '', templateId: '' });
  const tpls = d.templates.filter((t: any) => t.state === 'approved' && t.channel === f.channel);
  const paused = d.channels.find((c: any) => c.channel === f.channel)?.status === 'paused';
  const { run, busy } = useRun(reload);
  return (
    <Panel title="New campaign">
      <form className="grid gap-2 sm:grid-cols-[2fr_1fr_2fr_2fr_auto]" onSubmit={async (e) => { e.preventDefault(); const { templateId, ...rest } = f; if (await run({ action: 'create', ...rest, ...(templateId ? { templateId } : {}) })) setF({ name: '', channel: 'email', goal: '', templateId: '' }); }}>
        <Input aria-label="Campaign name" placeholder="Campaign name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <select aria-label="Channel" className="rounded-[3px] border border-input bg-background p-2 text-sm" value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value, templateId: '' })}>
          <option value="email">Email</option><option value="event">Event</option><option value="social">Social</option></select>
        <Input aria-label="Goal" placeholder="Goal (e.g. 3 pilot conversations)" value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })} />
        <select aria-label="Start from template" className="rounded-[3px] border border-input bg-background p-2 text-sm" value={f.templateId} onChange={(e) => setF({ ...f, templateId: e.target.value })}>
          <option value="">{tpls.length ? 'Blank (or choose a template)' : 'No approved template for this channel'}</option>{tpls.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        <Button type="submit" disabled={busy || paused || f.name.trim().length < 3}>Create draft</Button>
      </form>
      {paused && <p role="status" className="mt-2 text-sm">The {f.channel} channel is paused, so new {f.channel} campaigns cannot be started.</p>}
    </Panel>
  );
}

const KINDS = ['price', 'customer', 'outcome', 'certification', 'security', 'metric', 'availability', 'integration'];

function Claims({ c, d, reload, editable }: { c: C; d: any; reload: () => void; editable: boolean }) {
  const { run, busy } = useRun(reload);
  const [f, setF] = useState({ kind: 'outcome', text: '', sourceId: '' });
  const usable = d.sources.filter((x: any) => x.usable && x.kind === f.kind);
  return (
    <Panel title={`Claims · ${c.claims.length}`}>
      <p className="mb-2 text-xs text-muted-foreground">Every price, customer, outcome, certification, security, metric, availability or integration claim must cite an approved, current source of the same kind with recorded publication permission.</p>
      {c.hints.length > 0 && !c.claims.length && <p role="alert" className="mb-2 text-sm">The text reads like a claim ({c.hints.join(', ')}). List each claim below or remove the wording.</p>}
      {c.claimBlockers.map((b: string, i: number) => <p key={i} role="alert" className="text-sm">✗ {b}</p>)}
      {c.a11y.map((b: string, i: number) => <p key={i} role="alert" className="text-sm">✗ Accessibility: {b}</p>)}
      <ul className="mt-2 space-y-1 text-sm">{c.claims.map((k: any) => {
        const src = d.sources.find((x: any) => x.id === k.sourceId);
        return <li key={k.id} className="flex flex-wrap items-center gap-2"><span aria-hidden>{k.sourced ? '✓' : '✗'}</span><span className="sr-only">{k.sourced ? 'Sourced' : 'Not sourced'}</span>
          <Chip value={k.kind} /> “{k.text}” — {src ? `${src.title} (${src.state}${src.usable ? '' : ', not usable'})` : 'no source'}
          {editable && <Button size="sm" variant="ghost" disabled={busy} onClick={() => run({ action: 'claim_remove', campaignId: c.id, version: c.version, claimId: k.id })}>Remove</Button>}</li>;
      })}</ul>
      {editable && <form className="mt-3 grid gap-2 sm:grid-cols-[1fr_2fr_2fr_auto]" onSubmit={async (e) => { e.preventDefault();
        if (await run({ action: 'claim_add', campaignId: c.id, version: c.version, kind: f.kind, text: f.text, ...(f.sourceId ? { sourceId: f.sourceId } : {}) })) setF({ ...f, text: '', sourceId: '' }); }}>
        <label className="text-xs">Kind<select className="mt-1 block h-9 w-full rounded-[3px] border border-border bg-background px-2 text-sm" value={f.kind} onChange={(x) => setF({ ...f, kind: x.target.value, sourceId: '' })}>{KINDS.map((k) => <option key={k}>{k}</option>)}</select></label>
        <label className="text-xs">Claim, exactly as written<Input className="mt-1" value={f.text} onChange={(x) => setF({ ...f, text: x.target.value })} /></label>
        <label className="text-xs">Approved source<select className="mt-1 block h-9 w-full rounded-[3px] border border-border bg-background px-2 text-sm" value={f.sourceId} onChange={(x) => setF({ ...f, sourceId: x.target.value })}>
          <option value="">{usable.length ? 'Choose a source' : `No approved ${f.kind} source yet`}</option>{usable.map((x: any) => <option key={x.id} value={x.id}>{x.title}</option>)}</select></label>
        <Button size="sm" className="self-end" disabled={busy || f.text.trim().length < 3}>Add claim</Button>
      </form>}
    </Panel>
  );
}

function Launch({ c, reload }: { c: C; reload: () => void }) {
  const { run, busy } = useRun(reload);
  return (
    <Panel title="Launch gate">
      <p className="text-sm">Checks approval, unchanged content, current consent, sourced claims and accessibility. <strong>Sending is disabled</strong>: a clean check sends nothing.</p>
      {c.launch && <div className="mt-2 text-sm" role="status">Last check by {c.launch.by} · {fmt(c.launch.at)}: {c.launch.outcome === 'blocked' ? 'blocked' : 'every check passes (sending disabled)'}
        <ul className="mt-1 list-disc pl-5">{c.launch.blockers.map((b: string, i: number) => <li key={i}>{b}</li>)}</ul></div>}
      <Button size="sm" variant="outline" className="mt-2" disabled={busy} onClick={() => run({ action: 'launch_check', campaignId: c.id, version: c.version })}>Run launch check</Button>
    </Panel>
  );
}

const KIND_OPTIONS = ['Pilot request', 'Pricing request', 'Security document request', 'Accessibility feedback', 'Contact', 'Demo request'];
const sel = 'mt-1 block h-9 w-full rounded-[3px] border border-border bg-background px-2 text-sm';

function useAdmin(reload: () => void) {
  const [busy, setBusy] = useState(false);
  const call = async (input: Record<string, unknown>) => {
    setBusy(true);
    try { const r = await marketing({ op: 'admin', ...input } as never) as { resultCode: string; message: string };
      if (r.resultCode === 'OK') { toast.success(r.message); reload(); return true; } toast.error(r.message); return false;
    } catch (e) { toast.error(errMsg(e)); return false; } finally { setBusy(false); }
  };
  return { call, busy };
}

function Segments({ d, reload }: { d: any; reload: () => void }) {
  const { call, busy } = useAdmin(reload);
  const blank = { name: '', kinds: [] as string[], roleTerms: '', utmSource: '', utmCampaign: '', since: '' };
  const [f, setF] = useState(blank);
  const marketer = d.roles.includes('marketer');
  return (
    <Panel title={`Audience segments · ${d.segments.filter((g: any) => g.state === 'active').length} active`}>
      <p className="mb-2 text-xs text-muted-foreground">A segment narrows the consented audience by request type, stated role, link tags or date. It never reads message text or any student record, and its definition cannot change after it is made.</p>
      <ul className="space-y-1 text-sm">{d.segments.map((g: any) => (
        <li key={g.id} className="flex flex-wrap items-center gap-2"><strong>{g.name}</strong> <Chip value={g.state} /> {g.size} people now
          <span className="text-xs text-muted-foreground">{[g.kinds.join(', '), g.roleTerms.length ? `role has ${g.roleTerms.join(' or ')}` : '', g.utmSource && `source ${g.utmSource}`, g.utmCampaign && `campaign ${g.utmCampaign}`, g.since && `since ${g.since}`].filter(Boolean).join(' · ') || 'everyone who consented'}</span>
          {marketer && g.state === 'active' && <Button size="sm" variant="ghost" disabled={busy} onClick={() => call({ action: 'segment_retire', segmentId: g.id })}>Retire</Button>}</li>))}
        {!d.segments.length && <li className="text-muted-foreground">No segments yet; campaigns go to everyone who consented.</li>}</ul>
      {marketer && <form className="mt-3 grid gap-2 sm:grid-cols-3" onSubmit={async (e) => { e.preventDefault();
        const ok = await call({ action: 'segment_create', name: f.name, kinds: f.kinds, roleTerms: f.roleTerms.split(',').map((x) => x.trim()).filter(Boolean),
          ...(f.utmSource ? { utmSource: f.utmSource } : {}), ...(f.utmCampaign ? { utmCampaign: f.utmCampaign } : {}), ...(f.since ? { since: f.since } : {}) });
        if (ok) setF(blank); }}>
        <label className="text-xs">Name<Input className="mt-1" value={f.name} onChange={(x) => setF({ ...f, name: x.target.value })} /></label>
        <label className="text-xs">Role contains (comma separated)<Input className="mt-1" placeholder="dean, provost" value={f.roleTerms} onChange={(x) => setF({ ...f, roleTerms: x.target.value })} /></label>
        <label className="text-xs">Requests since<Input type="date" className="mt-1" value={f.since} onChange={(x) => setF({ ...f, since: x.target.value })} /></label>
        <fieldset className="text-xs sm:col-span-3"><legend>Request types (none = all)</legend><span className="mt-1 flex flex-wrap gap-3">{KIND_OPTIONS.map((k) => (
          <label key={k} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={f.kinds.includes(k)} onChange={(x) => setF({ ...f, kinds: x.target.checked ? [...f.kinds, k] : f.kinds.filter((y) => y !== k) })} />{k}</label>))}</span></fieldset>
        <label className="text-xs">Link source tag<Input className="mt-1" value={f.utmSource} onChange={(x) => setF({ ...f, utmSource: x.target.value })} /></label>
        <label className="text-xs">Link campaign tag<Input className="mt-1" value={f.utmCampaign} onChange={(x) => setF({ ...f, utmCampaign: x.target.value })} /></label>
        <Button size="sm" className="self-end" disabled={busy || f.name.trim().length < 3}>Create segment</Button>
      </form>}
    </Panel>
  );
}

function Templates({ d, reload }: { d: any; reload: () => void }) {
  const { call, busy } = useAdmin(reload);
  const blank = { name: '', channel: 'email', subject: '', body: '' };
  const [f, setF] = useState(blank);
  const marketer = d.roles.includes('marketer');
  const approver = d.roles.includes('marketing_approver');
  return (
    <Panel title={`Templates · ${d.templates.filter((t: any) => t.state === 'approved').length} approved`}>
      <p className="mb-2 text-xs text-muted-foreground">Someone other than the author approves a template. Approved templates carry no claims and pass the accessibility checks. A campaign started from one is still reviewed.</p>
      <ul className="space-y-2 text-sm">{d.templates.map((t: any) => (
        <li key={t.id} className="rounded-[3px] border border-border p-2">
          <span className="flex flex-wrap items-center gap-2"><strong>{t.name}</strong> <Chip value={t.channel} /> <Chip value={t.state} /> <span className="text-xs text-muted-foreground">by {t.author}{t.approvedBy ? ` · approved by ${t.approvedBy}` : ''}</span></span>
          <span className="mt-1 block font-medium">{t.subject}</span><span className="block whitespace-pre-wrap text-xs">{t.body}</span>
          <span className="mt-1 flex gap-2">
            {approver && t.state === 'draft' && t.authorId !== d.me && <Button size="sm" disabled={busy} onClick={() => call({ action: 'template_approve', templateId: t.id, seenBody: t.seen })}>Approve exactly this</Button>}
            {approver && t.state === 'draft' && t.authorId === d.me && <span className="text-xs text-muted-foreground">Someone else must approve your template.</span>}
            {t.state !== 'retired' && (approver || t.authorId === d.me) && <Button size="sm" variant="outline" disabled={busy} onClick={() => call({ action: 'template_retire', templateId: t.id })}>Retire</Button>}</span>
        </li>))}{!d.templates.length && <li className="text-muted-foreground">No templates yet.</li>}</ul>
      {marketer && <form className="mt-3 grid gap-2" onSubmit={async (e) => { e.preventDefault(); if (await call({ action: 'template_create', ...f })) setF(blank); }}>
        <span className="grid gap-2 sm:grid-cols-[2fr_1fr]"><label className="text-xs">Name<Input className="mt-1" value={f.name} onChange={(x) => setF({ ...f, name: x.target.value })} /></label>
          <label className="text-xs">Channel<select className={sel} value={f.channel} onChange={(x) => setF({ ...f, channel: x.target.value })}><option value="email">Email</option><option value="event">Event</option><option value="social">Social</option></select></label></span>
        <label className="text-xs">Subject<Input className="mt-1" value={f.subject} onChange={(x) => setF({ ...f, subject: x.target.value })} /></label>
        <label className="text-xs">Body{f.channel === 'email' ? ' (must include {{unsubscribe}})' : ''}<Textarea className="mt-1" rows={4} value={f.body} onChange={(x) => setF({ ...f, body: x.target.value })} /></label>
        <Button size="sm" className="justify-self-start" disabled={busy || f.name.trim().length < 3}>Create template</Button>
      </form>}
    </Panel>
  );
}

function Channel({ c, approver, reload }: { c: any; approver: boolean; reload: () => void }) {
  const { call, busy } = useAdmin(reload);
  const [f, setF] = useState({ status: c.status, senderLabel: c.senderLabel, dailyCap: String(c.dailyCap), note: '' });
  return (
    <li className="rounded-[3px] border border-border p-2 text-sm">
      <span className="flex flex-wrap items-center gap-2"><strong className="capitalize">{c.channel}</strong> <Chip value={c.status} /> <Chip value="sending disabled" />
        <span className="text-xs text-muted-foreground">Sender: {c.senderLabel || 'not set'} · daily cap {c.dailyCap || 'none'}{c.updatedBy ? ` · last changed by ${c.updatedBy}` : ''}{c.note ? ` · ${c.note}` : ''}</span></span>
      {approver && <form className="mt-2 grid gap-2 sm:grid-cols-[1fr_2fr_1fr_2fr_auto]" onSubmit={async (e) => { e.preventDefault();
        if (await call({ action: 'channel_set', channel: c.channel, version: c.version, status: f.status, senderLabel: f.senderLabel, dailyCap: Number(f.dailyCap || 0), note: f.note })) setF({ ...f, note: '' }); }}>
        <label className="text-xs">Status<select className={sel} value={f.status} onChange={(x) => setF({ ...f, status: x.target.value })}><option value="open">Open</option><option value="paused">Paused</option></select></label>
        <label className="text-xs">Sender name<Input className="mt-1" value={f.senderLabel} onChange={(x) => setF({ ...f, senderLabel: x.target.value })} /></label>
        <label className="text-xs">Daily cap<Input type="number" min={0} className="mt-1" value={f.dailyCap} onChange={(x) => setF({ ...f, dailyCap: x.target.value })} /></label>
        <label className="text-xs">Why<Input className="mt-1" value={f.note} onChange={(x) => setF({ ...f, note: x.target.value })} /></label>
        <Button size="sm" className="self-end" disabled={busy || f.note.trim().length < 5}>Save</Button>
      </form>}
    </li>
  );
}

function Channels({ d, reload }: { d: any; reload: () => void }) {
  const approver = d.roles.includes('marketing_approver');
  return (
    <Panel title="Channels">
      <p className="mb-2 text-xs text-muted-foreground">A paused channel blocks new campaigns, submission, approval and launch. Email needs a sender name before launch. Sending is disabled on every channel; these settings do not change that.</p>
      <ul className="space-y-2">{d.channels.map((c: any) => <Channel key={`${c.channel}:${c.version}`} c={c} approver={approver} reload={reload} />)}</ul>
      {d.adminEvents.length > 0 && <details className="mt-3 text-sm"><summary>Admin history · {d.adminEvents.length}</summary>
        <ol className="mt-1 space-y-1">{d.adminEvents.map((e: any, i: number) => <li key={i}><span className="text-xs text-muted-foreground">{fmt(e.at)} · {e.actor}</span> — {e.kind} {e.action}{e.detail ? ` · ${e.detail}` : ''}</li>)}</ol></details>}
    </Panel>
  );
}

function Sources({ d, reload }: { d: any; reload: () => void }) {
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ kind: 'outcome', title: '', reference: '', expiresOn: '' });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const approver = d.roles.includes('marketing_approver');
  const call = async (input: Record<string, unknown>) => {
    setBusy(true);
    try { const r = await marketing({ op: 'source', ...input } as never) as { resultCode: string; message: string };
      if (r.resultCode === 'OK') { toast.success(r.message); reload(); return true; } toast.error(r.message); return false;
    } catch (e) { toast.error(errMsg(e)); return false; } finally { setBusy(false); }
  };
  return (
    <Panel title={`Approved sources · ${d.sources.filter((x: any) => x.usable).length} usable`}>
      <p className="mb-2 text-xs text-muted-foreground">A source is evidence for one kind of claim. Someone other than the proposer approves it and records who gave publication permission. Revoking a source returns every campaign citing it to draft.</p>
      <ul className="space-y-2 text-sm">{d.sources.map((x: any) => (
        <li key={x.id} className="rounded-[3px] border border-border p-2">
          <span className="flex flex-wrap items-center gap-2"><Chip value={x.kind} /> <strong>{x.title}</strong> <Chip value={x.usable ? 'usable' : x.state === 'approved' ? 'expired' : x.state} /></span>
          <span className="block text-xs text-muted-foreground">Evidence: {x.reference} · proposed by {x.proposedBy}{x.approvedBy ? ` · approved by ${x.approvedBy}` : ''}{x.expiresOn ? ` · expires ${x.expiresOn}` : ''}</span>
          {x.permissionNote && <span className="block text-xs">Permission: {x.permissionNote}</span>}
          {x.revokeReason && <span className="block text-xs">Revoked: {x.revokeReason}</span>}
          {approver && x.state !== 'revoked' && (x.state === 'proposed' && x.proposedById === d.me ? <span className="block text-xs text-muted-foreground">Someone else must approve your proposal.</span> : (
            <span className="mt-1 flex flex-wrap gap-2"><Input aria-label={x.state === 'proposed' ? 'Publication permission' : 'Reason to revoke'} className="h-8 max-w-sm" placeholder={x.state === 'proposed' ? 'Who gave publication permission, and where it is recorded' : 'Reason to revoke'}
              value={notes[x.id] ?? ''} onChange={(e) => setNotes({ ...notes, [x.id]: e.target.value })} />
              {x.state === 'proposed' && <Button size="sm" disabled={busy} onClick={() => call({ action: 'approve', sourceId: x.id, permissionNote: notes[x.id] ?? '' })}>Approve</Button>}
              <Button size="sm" variant="outline" disabled={busy} onClick={() => call({ action: 'revoke', sourceId: x.id, reason: notes[x.id] ?? '' })}>Revoke</Button></span>))}
        </li>))}{!d.sources.length && <li className="text-muted-foreground">No sources yet. Claims cannot be approved until one exists.</li>}</ul>
      <form className="mt-3 grid gap-2 sm:grid-cols-[1fr_2fr_2fr_1fr_auto]" onSubmit={async (e) => { e.preventDefault();
        if (await call({ action: 'propose', kind: f.kind, title: f.title, reference: f.reference, ...(f.expiresOn ? { expiresOn: f.expiresOn } : {}) })) setF({ ...f, title: '', reference: '', expiresOn: '' }); }}>
        <label className="text-xs">Supports<select className="mt-1 block h-9 w-full rounded-[3px] border border-border bg-background px-2 text-sm" value={f.kind} onChange={(x) => setF({ ...f, kind: x.target.value })}>{KINDS.map((k) => <option key={k}>{k}</option>)}</select></label>
        <label className="text-xs">Title<Input className="mt-1" value={f.title} onChange={(x) => setF({ ...f, title: x.target.value })} /></label>
        <label className="text-xs">Where the evidence is kept<Input className="mt-1" value={f.reference} onChange={(x) => setF({ ...f, reference: x.target.value })} /></label>
        <label className="text-xs">Expires (optional)<Input type="date" className="mt-1" value={f.expiresOn} onChange={(x) => setF({ ...f, expiresOn: x.target.value })} /></label>
        <Button size="sm" className="self-end" disabled={busy || f.title.trim().length < 3}>Propose</Button>
      </form>
    </Panel>
  );
}

function Campaign({ c, d, reload }: { c: C; d: any; reload: () => void }) {
  const { run, busy } = useRun(reload);
  const [e, setE] = useState({ subject: c.subject, body: c.body, spend: String(c.spendMinor / 100), segmentId: c.segmentId ?? '' });
  const seg = d.segments.find((g: any) => g.id === c.segmentId);
  const [note, setNote] = useState('');
  const [a11y, setA11y] = useState(false);
  const mine = c.authorId === d.me;
  const canApprove = d.roles.includes('marketing_approver') && !mine && c.state === 'in_review';
  const go = (action: string, extra: Record<string, unknown> = {}) => run({ action, campaignId: c.id, version: c.version, ...extra });
  return (
    <div className="space-y-4">
      <Panel title={<span className="flex flex-wrap items-center gap-2">#{c.number} {c.name} <Chip value={c.state.replace('_', ' ')} /><Chip value={c.channel} /></span>}>
        <p className="text-sm">By {c.author}{c.goal ? ` · Goal: ${c.goal}` : ''}</p>
        <p className="mt-1 text-sm">Segment: {seg ? `${seg.name}${seg.state === 'retired' ? ' (retired)' : ''}` : 'everyone who consented'}{c.templateId ? ` · From template: ${d.templates.find((t: any) => t.id === c.templateId)?.name ?? 'unknown'}` : ''}</p>
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
              <Button size="sm" disabled={busy} onClick={() => go('edit', { subject: e.subject, body: e.body, spendMinor: Math.round(Number(e.spend || 0) * 100), segmentId: e.segmentId || null })}>Save</Button>
              {['draft', 'rejected'].includes(c.state) && <Button size="sm" variant="outline" disabled={busy} onClick={() => go('submit')}>Submit for approval</Button>}
            </div>
            <label className="block text-xs">Audience<select className="mt-1 block h-9 w-full max-w-md rounded-[3px] border border-border bg-background px-2 text-sm" value={e.segmentId} onChange={(x) => setE({ ...e, segmentId: x.target.value })}>
              <option value="">Everyone who consented ({d.audience})</option>{d.segments.filter((g: any) => g.state === 'active' || g.id === c.segmentId).map((g: any) => <option key={g.id} value={g.id}>{g.name} ({g.size}{g.state === 'retired' ? ', retired' : ''})</option>)}</select></label>
            <p className="text-xs text-muted-foreground">Audiences only ever include contacts who consented and have not withdrawn. Student and education records can never be an audience.</p>
          </div>
        </Panel>
      ) : (
        <Panel title="Content (exactly as it would be approved)">
          <p className="font-medium">{c.subject || '—'}</p>
          <p className="mt-2 whitespace-pre-wrap text-sm">{c.body || '—'}</p>
          {mine && c.state === 'in_review' && <Button size="sm" variant="outline" className="mt-3" disabled={busy} onClick={() => go('withdraw')}>Withdraw to edit</Button>}
          {canApprove && <div className="mt-3 space-y-2 border-t border-border pt-3">
            <Textarea aria-label="Review note" rows={2} placeholder="Review note (required to reject)" value={note} onChange={(x) => setNote(x.target.value)} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={a11y} onChange={(x) => setA11y(x.target.checked)} /> I checked headings, link text, image descriptions and contrast</label>
            <div className="flex gap-2">
              <Button size="sm" disabled={busy || !a11y || c.claimBlockers.length > 0} onClick={() => go('approve', { seenHash: c.hash, note, a11yReviewed: true })}>Approve exactly this</Button>
              <Button size="sm" variant="outline" disabled={busy || note.trim().length < 5} onClick={() => go('reject', { seenHash: c.hash, note })}>Reject</Button>
            </div></div>}
          {!mine && c.state === 'in_review' && !d.roles.includes('marketing_approver') && <p className="mt-2 text-xs text-muted-foreground">Waiting for a marketing approver.</p>}
          {mine && c.state === 'in_review' && <p className="mt-2 text-xs text-muted-foreground">Someone other than you must approve it.</p>}
        </Panel>
      )}
      <Claims c={c} d={d} reload={reload} editable={mine && c.state !== 'in_review' && d.roles.includes('marketer')} />
      <Launch c={c} reload={reload} />
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
            {d.roles.includes('marketer') && <NewCampaign d={d} reload={s.reload} />}
            <details className="rounded-[3px] border border-border p-3"><summary className="cursor-pointer text-sm font-medium">Audiences, templates, channels and sources</summary>
              <div className="mt-3 space-y-4"><Segments d={d} reload={s.reload} /><Templates d={d} reload={s.reload} /><Channels d={d} reload={s.reload} /><Sources d={d} reload={s.reload} /></div></details>
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
