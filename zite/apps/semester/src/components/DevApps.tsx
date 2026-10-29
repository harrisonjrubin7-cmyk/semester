import { useState } from 'react';
import { toast } from 'sonner';
import { devApps, sandboxApi, DevAppsInputType, DevAppsOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Checkbox } from '@project/components/ui/checkbox';
import { Panel, Empty, Status, fmt, useLoad, Loadable, errMsg } from './kit';
import { ConfirmAction } from './overlays';

type D = DevAppsOutputType;

function Installer({ d, onDone }: { d: D; onDone: (r: D) => void }) {
  const [appId, setAppId] = useState('');
  const [scopes, setScopes] = useState<string[]>([]);
  const active = d.apps.filter((a) => a.status === 'sandbox');
  if (!active.length) return <Empty>Register an app first.</Empty>;
  const app = active.find((a) => a.id === appId);
  const offered = d.scopes.filter((s) => app?.requestedScopes.includes(s.key));
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">{active.map((a) => <Button key={a.id} size="sm" variant={appId === a.id ? 'default' : 'outline'} onClick={() => { setAppId(a.id); setScopes([]); }}>{a.name}</Button>)}</div>
      {app && !app.mine && app.review !== 'approved' && <p role="status" className="text-xs">This app is from another institution and hasn't passed Semester review, so it can't be installed here yet.</p>}
      {app && !offered.length && <p className="text-xs text-muted-foreground">This app hasn't declared any scopes yet.</p>}
      {offered.map((s) => (
        <label key={s.key} className="flex items-start gap-2 text-sm"><Checkbox checked={scopes.includes(s.key)} onCheckedChange={(c) => setScopes(c ? [...scopes, s.key] : scopes.filter((x) => x !== s.key))} />
          <span><span className="font-mono text-xs">{s.key}</span><span className="block text-xs text-muted-foreground">{s.label}</span></span></label>
      ))}
      <p className="text-xs text-muted-foreground">Grades, education records, enrollment changes and payments can never be granted to apps.</p>
      <Button size="sm" disabled={!appId || !scopes.length} onClick={async () => { try { onDone(await devApps({ action: 'install', appId, scopes, days: 30 })); setScopes([]); } catch (e) { toast.error(errMsg(e)); } }}>Install for 30 days</Button>
    </div>
  );
}

function TryIt({ scopes }: { scopes: string[] }) {
  const [token, setToken] = useState('');
  const [out, setOut] = useState('');
  return (
    <div className="space-y-2">
      <Input placeholder="Paste an app token" value={token} onChange={(e) => setToken(e.target.value)} className="font-mono text-xs" />
      <div className="flex flex-wrap gap-1">{scopes.map((s) => <Button key={s} size="sm" variant="outline" disabled={!token} onClick={async () => { try { const r = await sandboxApi({ token, scope: s }); setOut(JSON.stringify(r, null, 2)); } catch (e) { setOut(errMsg(e)); } }}>Call {s}</Button>)}</div>
      {out && <pre className="max-h-48 overflow-auto rounded-[3px] bg-muted p-2 text-[11px]">{out}</pre>}
    </div>
  );
}

export default function DevApps() {
  const s = useLoad(() => devApps({ action: 'list' }));
  const [name, setName] = useState('');
  const [want, setWant] = useState<string[]>([]);
  const [view, setView] = useState<D | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const act = async (i: DevAppsInputType) => {
    try { const r = await devApps(i); setView(r); if (r.token) setToken(r.token); if (r.message) toast.success(r.message); }
    catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <Loadable state={s}>{(loaded) => { const d = view ?? loaded; return (
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">Developer sandbox. Apps only ever see synthetic data. Every call re-checks the install, so revoking stops the very next request.</p>
        {token && <Panel title="New app token — shown once" className="border-primary">
          <code className="block break-all rounded-[3px] bg-muted p-2 text-xs">{token}</code>
          <div className="mt-2 flex gap-2"><Button size="sm" onClick={() => { navigator.clipboard.writeText(token); toast.success('Copied'); }}>Copy</Button><Button size="sm" variant="outline" onClick={() => setToken(null)}>I've stored it</Button></div>
        </Panel>}
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel title="Register a sandbox app">
            <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (name.trim() && want.length) { act({ action: 'register', name, scopes: want }); setName(''); setWant([]); } }}>
              <Input aria-label="App name" placeholder="App name" value={name} onChange={(e) => setName(e.target.value)} />
              <fieldset><legend className="text-xs text-muted-foreground">Scopes the app needs</legend>
                {d.scopes.map((s) => <label key={s.key} className="flex items-center gap-2 text-sm"><Checkbox checked={want.includes(s.key)} onCheckedChange={(c) => setWant(c ? [...want, s.key] : want.filter((x) => x !== s.key))} /><span className="font-mono text-xs">{s.key}</span></label>)}
              </fieldset>
              <Button type="submit" disabled={!name.trim() || !want.length}>Register</Button>
              <p className="text-xs text-muted-foreground">Your institution can install it right away. Other institutions can install it only after Semester reviews it, and changing its scopes needs a new review.</p>
            </form>
            <ul className="mt-3 space-y-1 text-sm">{d.apps.map((a) => <li key={a.id} className="flex items-center justify-between gap-2"><span>{a.name}<span className="block font-mono text-[11px] text-muted-foreground">{a.requestedScopes.join(' · ') || 'no scopes declared'}</span><span className="block text-[11px] text-muted-foreground">Semester review: {a.review}{a.reviewNote ? ` · ${a.reviewNote}` : ''}</span></span> <span className="flex items-center gap-2"><Status value={a.status} />{a.status === 'sandbox' && <Button size="sm" variant="ghost" onClick={() => act({ action: 'suspend', appId: a.id })}>Suspend</Button>}</span></li>)}</ul>
          </Panel>
          <Panel title="Install with scopes"><Installer d={d} onDone={(r) => { setView(r); setToken(r.token); }} /></Panel>
          <Panel title="Try the sandbox API"><TryIt scopes={d.scopes.map((x) => x.key)} /></Panel>
        </div>
        <Panel title={`Installations · ${d.installs.filter((i) => i.status === 'active').length} active`}>
          {d.installs.length ? <table className="w-full text-sm"><tbody>{d.installs.map((i) => (
            <tr key={i.id} className="border-t border-border align-top">
              <td className="py-2 pr-3">{i.appName}<span className="block font-mono text-[11px] text-muted-foreground">{i.scopes.join(' · ')}</span></td>
              <td className="pr-3"><Status value={i.status} /><span className="block text-xs text-muted-foreground">expires {fmt(i.expiresAt)}</span></td>
              <td className="pr-3 text-xs">{i.calls} calls · {i.denied} denied<span className="block text-muted-foreground">{i.lastCall ? `last ${fmt(i.lastCall)}` : 'never called'}</span></td>
              <td className="text-right">{i.status === 'active' && <span className="flex justify-end gap-2"><ConfirmAction trigger={<Button size="sm" variant="outline">Rotate token</Button>} title={`Rotate the token for ${i.appName}?`} confirmLabel="Rotate" keepLabel="Keep" onConfirm={() => act({ action: 'rotate', installId: i.id })}><p className="text-sm">A new token replaces the old one, which stops working immediately. The new token is shown once and lasts 30 days. Use rotation when a token may have leaked or on a regular schedule.</p></ConfirmAction><ConfirmAction trigger={<Button size="sm" variant="outline">Revoke</Button>} title={`Revoke ${i.appName}?`} confirmLabel="Revoke" keepLabel="Keep" onConfirm={() => act({ action: 'revoke', installId: i.id })}><p className="text-sm">The app's next call fails. This can't be undone; install again to restore access.</p></ConfirmAction></span>}</td>
            </tr>))}</tbody></table> : <Empty>No installations.</Empty>}
        </Panel>
      </div>
    ); }}</Loadable>
  );
}
