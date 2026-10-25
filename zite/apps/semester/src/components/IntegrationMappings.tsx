import { useState } from 'react';
import { toast } from 'sonner';
import { integrationMappings } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Panel, Empty, fmt, useLoad, Loadable, errMsg } from './kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
const CONNECTORS = ['SIS', 'LMS', 'SSO', 'Calendar'] as const;
type C = (typeof CONNECTORS)[number];
/** One line per field: source, target, transform, required (yes/no). */
const parseRows = (text: string) => text.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
  const [source = '', target = '', transform = 'copy', req = 'no'] = l.split(',').map((x) => x.trim());
  return { source, target, transform: transform as any, required: /^(y|yes|true|required)$/i.test(req) };
});
const rowsText = (rows: any[]) => rows.map((r) => `${r.source}, ${r.target}, ${r.transform}, ${r.required ? 'yes' : 'no'}`).join('\n');

/** Console tab (Integration Admin): versioned field mappings with two-person approval, and drift checks. */
export default function IntegrationMappings() {
  const s = useLoad(() => integrationMappings({ action: 'get' }));
  const [connector, setConnector] = useState<C>('SIS');
  const [rows, setRows] = useState('');
  const [note, setNote] = useState('');
  const [sent, setSent] = useState('');
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [drift, setDrift] = useState<any>(null);
  const call = async (input: any, ok: string) => {
    try { const r = await integrationMappings(input); toast(ok); if (r.lastDrift) setDrift(r.lastDrift); s.reload(); return true; } catch (e) { toast(`! ${errMsg(e)}`); return false; }
  };
  return (
    <Loadable state={s}>{(d: any) => {
      const current = d.approved.find((m: any) => m.connector === connector);
      return (
        <div className="grid gap-4">
          <Panel title="Field mappings">
            <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Connector">
              {CONNECTORS.map((c) => <Button key={c} size="sm" variant={c === connector ? 'default' : 'outline'} aria-pressed={c === connector} onClick={() => { setConnector(c); setDrift(null); }}>{c}</Button>)}
            </div>
            {current ? <div className="text-sm">
              <p className="mb-1">Approved version {current.version} · proposed by {current.proposedBy}, approved by {current.decidedBy}</p>
              <ul className="text-xs text-muted-foreground">{current.rows.map((r: any) => <li key={r.source}>{r.source} → {r.target} ({r.transform}{r.required ? ', required' : ''})</li>)}</ul>
            </div> : <Empty>No approved {connector} mapping yet. Propose one below; another administrator approves it.</Empty>}
            <p className="mt-3 text-xs text-muted-foreground">Allowed targets for {connector}: {d.targets[connector].join(', ')}. Transforms: {d.transforms.join(', ')}. {d.protectedTargets.join(' and ')} can be mapped for reading only; nothing here writes them.</p>
          </Panel>
          <Panel title={`Propose a ${connector} mapping`}>
            <label className="text-sm" htmlFor="map-rows">One field per line: source, target, transform, required (yes/no)</label>
            <Textarea id="map-rows" rows={6} className="mt-1 font-mono text-xs" placeholder="student_id, person.externalId, trim, yes" value={rows} onChange={(e) => setRows(e.target.value)} />
            <div className="mt-2 flex flex-wrap gap-2">
              {current && <Button size="sm" variant="outline" onClick={() => setRows(rowsText(current.rows))}>Start from approved version</Button>}
              <Input aria-label="Why this change" className="max-w-sm" placeholder="Why this change" value={note} onChange={(e) => setNote(e.target.value)} />
              <Button size="sm" disabled={!rows.trim()} onClick={async () => { if (await call({ action: 'propose', connector, rows: parseRows(rows), note }, 'Proposed. Another administrator must approve it.')) { setRows(''); setNote(''); } }}>Propose</Button>
            </div>
          </Panel>
          {d.pending.length > 0 && <Panel title="Waiting for approval">
            {d.pending.map((m: any) => (
              <div key={m.id} className="border-t border-border py-2 text-sm first:border-0">
                <p>{m.connector} version {m.version} · by {m.proposedBy}{m.note && ` · ${m.note}`}</p>
                <ul className="text-xs text-muted-foreground">{m.rows.map((r: any) => <li key={r.source}>{r.source} → {r.target} ({r.transform}{r.required ? ', required' : ''})</li>)}</ul>
                {m.mine ? <p className="text-xs text-muted-foreground">Another administrator approves.</p> : <div className="mt-1 flex flex-wrap gap-2">
                  <Input aria-label="Decision note" className="max-w-sm" placeholder="Note (needed to reject)" value={notes[m.id] ?? ''} onChange={(e) => setNotes({ ...notes, [m.id]: e.target.value })} />
                  <Button size="sm" onClick={() => call({ action: 'decide', id: m.id, approve: true, note: notes[m.id] ?? '' }, 'Approved.')}>Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => call({ action: 'decide', id: m.id, approve: false, note: notes[m.id] ?? '' }, 'Rejected.')}>Reject</Button>
                </div>}
              </div>))}
          </Panel>}
          <Panel title={`Drift check · ${connector}`}>
            <label className="text-sm" htmlFor="sent-fields">Field names the source sends now (comma or line separated). Names only, never record values.</label>
            <Textarea id="sent-fields" rows={3} className="mt-1 font-mono text-xs" value={sent} onChange={(e) => setSent(e.target.value)} />
            <Button size="sm" className="mt-2" disabled={!current || !sent.trim()} onClick={() => call({ action: 'checkDrift', connector, sentFields: sent.split(/[\n,]/).map((x) => x.trim()).filter(Boolean) }, 'Drift check recorded.')}>Check drift</Button>
            {drift && drift.connector === connector && <div className="mt-3 text-sm" role="status">
              <p className="font-medium">{drift.ok ? 'No blocking drift' : 'Drift blocks sync'} (against version {drift.version})</p>
              {drift.missingRequired.length > 0 && <p>Missing required: {drift.missingRequired.join(', ')}</p>}
              {drift.missingOptional.length > 0 && <p>Missing optional: {drift.missingOptional.join(', ')}</p>}
              {drift.newFields.length > 0 && <p>New, unmapped: {drift.newFields.join(', ')}</p>}
              {drift.protectedTargets?.length > 0 && <p>Protected targets in mapping: {drift.protectedTargets.join(', ')}</p>}
            </div>}
          </Panel>
          <Panel title="Recent drift checks">
            {!d.drift.length ? <Empty>No drift checks yet.</Empty> : <ul className="text-sm">{d.drift.map((x: any) => <li key={x.id} className="border-t border-border py-1.5 first:border-0">{x.connector} v{x.version ?? '—'} · {x.ok ? 'OK' : 'Drift'} · {x.by} · {fmt(x.at)}</li>)}</ul>}
          </Panel>
          {d.history.length > 0 && <Panel title="History">
            <ul className="text-sm">{d.history.map((m: any) => <li key={m.id} className="border-t border-border py-1.5 first:border-0">{m.connector} v{m.version} · {m.state} · by {m.proposedBy}{m.decidedBy && `, decided by ${m.decidedBy}`}{m.decisionNote && ` · ${m.decisionNote}`}</li>)}</ul>
          </Panel>}
        </div>);
    }}</Loadable>
  );
}
