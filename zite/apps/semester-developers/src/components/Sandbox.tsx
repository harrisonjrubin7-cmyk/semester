import { useState } from 'react';
import { toast } from 'sonner';
import { Copy } from 'lucide-react';
import { sandbox, SandboxOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Checkbox } from '@project/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { act } from '../hooks';

type D = SandboxOutputType;
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => <section className="rounded-lg border bg-card p-4"><h3 className="eyebrow mb-3">{title}</h3>{children}</section>;

function ScopePick({ d, value, onChange, allowed }: { d: D; value: string[]; onChange: (v: string[]) => void; allowed?: string[] }) {
  return <div className="flex flex-wrap gap-3">{d.scopes.filter((s) => !allowed || allowed.includes(s.key)).map((s) => (
    <label key={s.key} className="flex items-center gap-2 text-sm"><Checkbox checked={value.includes(s.key)} onCheckedChange={(c) => onChange(c ? [...value, s.key] : value.filter((x) => x !== s.key))} /><code className="font-mono text-xs">{s.key}</code></label>))}</div>;
}

export function Sandbox({ d, set }: { d: D; set: (x: D) => void }) {
  const [name, setName] = useState(''); const [scopes, setScopes] = useState<string[]>([]);
  const [appId, setAppId] = useState(''); const [grant, setGrant] = useState<string[]>([]); const [days, setDays] = useState(7);
  const [token, setToken] = useState(''); const [scope, setScope] = useState('catalog:read');
  const app = d.apps.find((a) => a.id === appId);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <Section title="1 · Create a test app">
          <Input placeholder="App name" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="my-3"><ScopePick d={d} value={scopes} onChange={setScopes} /></div>
          <Button size="sm" disabled={name.trim().length < 2 || !scopes.length} onClick={() => act(() => sandbox({ action: 'createApp', name, scopes }), (r) => { set(r); setName(''); setScopes([]); toast.success(r.message); })}>Create</Button>
        </Section>
        <Section title="2 · Mint a test token">
          {d.apps.length ? <>
            <Select value={appId} onValueChange={(v) => { setAppId(v); setGrant([]); }}><SelectTrigger><SelectValue placeholder="Choose one of your test apps" /></SelectTrigger>
              <SelectContent>{d.apps.map((a) => <SelectItem key={a.id} value={a.id}>{a.name} · {a.tokens} active</SelectItem>)}</SelectContent></Select>
            {app && <div className="my-3"><ScopePick d={d} value={grant} onChange={setGrant} allowed={app.scopes} /></div>}
            <div className="flex items-center gap-2"><Input type="number" min={1} max={30} className="w-20" value={days} onChange={(e) => setDays(Math.min(30, Math.max(1, Number(e.target.value) || 1)))} /><span className="text-xs text-muted-foreground">days</span>
              <Button size="sm" disabled={!app || !grant.length} onClick={() => act(() => sandbox({ action: 'mintToken', appId, scopes: grant, days }), (r) => { set(r); if (r.token) setToken(r.token); toast.success(r.message); })}>Mint</Button></div>
            {d.token && <div className="mt-3 flex items-center gap-2 rounded border border-primary/40 bg-accent p-2"><code className="flex-1 break-all font-mono text-xs">{d.token}</code>
              <Button size="icon" variant="ghost" onClick={() => { navigator.clipboard.writeText(d.token!); toast('Copied'); }}><Copy className="h-4 w-4" /></Button></div>}
          </> : <p className="text-sm text-muted-foreground">Create a test app first.</p>}
        </Section>
      </div>
      <Section title="3 · Send a request">
        <div className="space-y-2">
          <Input className="font-mono text-xs" placeholder="smst_sbx_…" value={token} onChange={(e) => setToken(e.target.value)} />
          <div className="flex gap-2">
            <Select value={scope} onValueChange={setScope}><SelectTrigger className="font-mono text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{[...d.scopes.map((s) => s.key), ...d.forbidden].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
            <Button disabled={!token} onClick={() => act(() => sandbox({ action: 'call', token, scope }), set)}>Send</Button>
          </div>
        </div>
        {d.response ? <div className="mt-4">
          <p className="mb-1 font-mono text-xs"><span className={d.response.status === 200 ? 'text-primary' : 'text-destructive'}>{d.response.status}</span> · {d.response.ms} ms</p>
          <pre className="max-h-96 overflow-auto rounded bg-sidebar p-3 font-mono text-xs text-sidebar-foreground">{JSON.stringify(d.response.body, null, 2)}</pre>
        </div> : <p className="mt-4 text-xs text-muted-foreground">Try a revoked token, a scope you didn’t grant, or a forbidden scope to see each refusal.</p>}
      </Section>
    </div>
  );
}

const CODES: [string, number, string][] = [
  ['OK', 200, 'Allowed. Returns synthetic data only.'], ['UNKNOWN_SCOPE', 400, 'Not a scope apps can ever hold (records, grades, enrollment writes and payments are never grantable).'],
  ['NO_INSTALL', 401, 'Token doesn’t match any install.'], ['REVOKED', 401, 'The institution or Semester revoked it.'], ['EXPIRED', 401, 'Past its expiry (max 90 days, 30 in sandbox).'],
  ['APP_SUSPENDED', 403, 'The developer or Semester suspended the app.'], ['SCOPE_NOT_GRANTED', 403, 'The app asked for it but this install didn’t grant it.'],
];

export function Docs({ d }: { d: D }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <Section title="How access works">
        <ol className="list-decimal space-y-2 pl-4 text-sm">
          <li>A developer registers an app and lists the scopes it requests.</li>
          <li>Their own institution can install it straight away. Any other institution needs Semester review first — approval covers exactly the scopes reviewed, and changing them voids it.</li>
          <li>Each install mints one token, shown once and stored as a hash.</li>
          <li>Every call re-checks token, install, app status, expiry and scope, so a revoke applies to the next request.</li>
        </ol>
      </Section>
      <Section title="Scopes">
        <ul className="space-y-1.5 text-sm">{d.scopes.map((s) => <li key={s.key}><code className="font-mono text-xs">{s.key}</code> — {s.label}</li>)}</ul>
        <p className="mt-3 text-xs text-muted-foreground">Never grantable: {d.forbidden.map((f) => <code key={f} className="mr-1 font-mono">{f}</code>)}</p>
      </Section>
      <Section title="Request">
        <pre className="overflow-auto rounded bg-sidebar p-3 font-mono text-xs text-sidebar-foreground">{`POST sandboxApi\n{ "token": "smst_sbx_…", "scope": "catalog:read" }`}</pre>
      </Section>
      <Section title="Result codes">
        <table className="w-full text-sm"><tbody>{CODES.map(([c, s, m]) => <tr key={c} className="border-b last:border-0 align-top"><td className="py-1.5 pr-2 font-mono text-xs">{c}</td><td className="pr-2 font-mono text-xs">{s}</td><td className="text-xs text-muted-foreground">{m}</td></tr>)}</tbody></table>
      </Section>
      <Section title="Token lifecycle">
        <ul className="list-disc space-y-2 pl-4 text-sm">
          <li>One token per install, shown once — at install time or after a rotation. Only its SHA-256 hash is stored, so a lost token cannot be recovered, only replaced.</li>
          <li>Tokens last at most 90 days (30 in the sandbox). Expiry is set at install and reset by rotation.</li>
          <li>Rotation happens on the institution's Developer apps page in Semester: the new token replaces the old one immediately, and the old token returns NO_INSTALL from the next call.</li>
          <li>Revocation by the institution or by Semester applies to the next call. Every call re-checks the token, the install, the app, its expiry and the scope.</li>
          <li>Developers manage their own keys day to day under My apps: review state, installs, expiries and call counts — never a token value.</li>
        </ul>
      </Section>
      <Section title="Example responses">
        <p className="mb-3 text-xs text-muted-foreground">Synthetic data, exactly as the request tester returns it. The envelope is the same for every scope; only <code className="font-mono">data</code> changes.</p>
        {d.examples.map((e) => (
          <div key={e.scope} className="mb-4 last:mb-0">
            <p className="mb-1 font-mono text-xs">{e.scope}</p>
            <pre className="overflow-auto rounded bg-sidebar p-3 font-mono text-xs text-sidebar-foreground">{`{ "ok": true, "code": "OK", "synthetic": true, "data": ${e.data} }`}</pre>
          </div>
        ))}
      </Section>
    </div>
  );
}
