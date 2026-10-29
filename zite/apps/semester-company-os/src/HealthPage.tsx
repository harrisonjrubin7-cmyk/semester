import { useState } from 'react';
import { toast } from 'sonner';
import { infraHealth } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Header, Panel, Chip, Loadable, useLoad, fmt, errMsg } from './ui';

/* eslint-disable @typescript-eslint/no-explicit-any */
const WORD: Record<string, string> = { ok: 'OK', warn: 'Warning', fail: 'Failing', info: 'Information' };
const GLYPH: Record<string, string> = { ok: '✓', warn: '!', fail: '✗', info: 'i' };

// Platform Admin infrastructure health: each run measures the database now and is kept. Status is always a word and a glyph.
export default function HealthPage() {
  const s = useLoad(() => infraHealth({ action: 'get' }) as Promise<any>, []);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try { await infraHealth({ action: 'run' }); toast.success('Checks finished.'); s.reload(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <div className="mx-auto max-w-5xl">
      <Header eyebrow="Operations" title="Infrastructure health" sub="Measures the database these apps run on, now. Reads only catalog and statistics views, never a record." />
      <Loadable state={s}>{(d: any) => {
        const last = d.runs[0];
        return (
          <div className="space-y-4">
            <Panel title={last ? <span className="flex flex-wrap items-center gap-2">Latest run <Chip value={`${GLYPH[last.overall]} ${WORD[last.overall]}`} /></span> : 'No runs yet'}>
              {last && <p className="mb-2 text-xs text-muted-foreground">Run by {last.by} · {fmt(last.at)}</p>}
              {last && <ul className="space-y-2">{last.checks.map((c: any) => (
                <li key={c.key} className="text-sm"><span className="flex flex-wrap items-center gap-2"><Chip value={`${GLYPH[c.status]} ${WORD[c.status]}`} /><strong>{c.label}</strong></span>
                  <span className="mt-0.5 block">{c.detail}</span></li>))}</ul>}
              <Button size="sm" className="mt-3" disabled={busy} onClick={run}>{busy ? 'Measuring…' : 'Run checks now'}</Button>
            </Panel>
            <Panel title="Not measured here">
              <ul className="list-disc space-y-1 pl-5 text-sm">{d.notMeasured.map((m: string, i: number) => <li key={i}>{m}</li>)}</ul>
            </Panel>
            {d.runs.length > 1 && <Panel title={`Earlier runs · ${d.runs.length - 1}`}>
              <ol className="space-y-1 text-sm">{d.runs.slice(1).map((r: any) => (
                <li key={r.id}>{fmt(r.at)} · {r.by} — {GLYPH[r.overall]} {WORD[r.overall]}{r.checks.filter((c: any) => c.status === 'fail' || c.status === 'warn').map((c: any) => ` · ${c.label}`).join('')}</li>))}</ol>
            </Panel>}
          </div>
        );
      }}</Loadable>
    </div>
  );
}
