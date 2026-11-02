import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@project/components/ui/button';
import { roleApps } from 'zitejs/api';
import { contextSession } from '../lib/contextSession';
import { PageHeader, Panel, Empty, Status, useLoad, Loadable, errMsg } from '../components/kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
const STATE_WORD: Record<string, string> = { existing: 'Ready', incomplete: 'Partly built', missing: 'Not built yet' };

function Capability({ c, host }: { c: any; host: string }) {
  const inHere = host === 'semester' && c.route;
  return (
    <li className="flex items-center justify-between gap-3 border-t border-border py-2 text-sm first:border-0">
      <span>{inHere ? <Link to={c.route} className="hover:underline">{c.name}</Link> : c.name}</span>
      <span className="flex items-center gap-2 text-xs text-muted-foreground">{!inHere && c.route && `in ${host === 'company' ? 'Company OS' : 'its own app'}`}<Status value={STATE_WORD[c.state]} /></span>
    </li>
  );
}

/** Launcher: the role apps this person's memberships open. One account, separate apps, no merged permissions. */
export default function RoleApps() {
  const s = useLoad(() => roleApps({ action: 'mine' }));
  return (
    <>
      <PageHeader eyebrow="Apps" title="Your Semester apps" sub="One account, one app per role you hold. Each app opens only what that role may see; roles never combine." />
      <Loadable state={s}>{(d: any) => !d.apps.length ? <Empty>No role apps for your memberships yet.</Empty> : (
        <div className="grid gap-4 md:grid-cols-2">
          {d.apps.map((a: any) => (
            <Panel key={a.key} title={`${a.role}${d.active === a.key ? ' · active' : ''}`} action={<Link to={`/apps/${a.key}`} className="text-sm text-primary hover:underline">Open</Link>}>
              {a.spec && <p className="text-sm">{a.spec.target}</p>}
              <p className="mt-1 text-xs text-muted-foreground">{a.stats.existing} ready · {a.stats.incomplete} partly built · {a.stats.missing} not built · {a.hostLabel}</p>
            </Panel>))}
        </div>)}
      </Loadable>
    </>
  );
}

/** One role app's home: its capabilities, linked to the shared screens that serve them, with honest build state. */
export function RoleAppHome() {
  const { key = '' } = useParams();
  const s = useLoad(() => roleApps({ action: 'open', key }), [key]);
  return (
    <Loadable state={s}>{(a: any) => (
      <>
        <PageHeader eyebrow="App" title={`${a.role} app`} sub={`Built on shared Semester services. ${a.stats.existing} of ${a.stats.capabilities} capabilities are ready today.`} />
        {a.spec && <Panel className="mb-4" title="What this app shows you">
          <p className="text-sm">{a.spec.target}.</p>
          <p className="mt-1 text-sm text-muted-foreground">Boundary: {a.spec.boundary}.</p>
          {a.active ? <p className="mt-2 text-xs text-muted-foreground">This is your active app.</p>
            : <Button className="mt-2" size="sm" variant="outline" onClick={async () => { try { await roleApps({ action: 'switch', key: a.key }); await contextSession.switchApp(a.key); toast('Switched. Other apps’ screens and drafts stay in their own context.'); s.reload(); } catch (e) { toast(`! ${errMsg(e)}`); } }}>Make this my active app</Button>}
        </Panel>}
        <Panel title="Capabilities"><ul>{a.capabilities.map((c: any) => <Capability key={c.name} c={c} host={a.host} />)}</ul></Panel>
        <p className="mt-3 text-xs text-muted-foreground">“Not built yet” means exactly that; nothing on this page pretends otherwise. Opening this app grants no extra permission.</p>
      </>)}
    </Loadable>
  );
}

/** Console tab: the 69-app evidence and gap map. */
export function RoleAppsGapMap() {
  const s = useLoad(() => roleApps({ action: 'catalog' }));
  return (
    <Loadable state={s}>{(d: any) => !d.allowed ? <Panel><Empty>Administrators only.</Empty></Panel> : (
      <Panel title={`Role apps · ${d.stats.apps} apps · ${d.stats.capabilities} capabilities`}>
        <p className="text-sm text-muted-foreground">{d.stats.existing} ready · {d.stats.incomplete} partly built · {d.stats.missing} not built. Mapping is from capability wording and needs owner review; it is the starting gap map, not verification.</p>
        <div className="mt-3 overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1">App</th><th>Host</th><th>Ready</th><th>Partly</th><th>Not built</th><th>Gaps</th></tr></thead>
          <tbody>{d.apps.map((a: any) => (
            <tr key={a.key} className="border-t border-border align-top">
              <td className="py-2">{a.role}</td><td className="py-2">{a.hostLabel}</td>
              <td className="py-2 tabular-nums">{a.stats.existing}</td><td className="py-2 tabular-nums">{a.stats.incomplete}</td><td className="py-2 tabular-nums">{a.stats.missing}</td>
              <td className="py-2 text-xs text-muted-foreground">{a.capabilities.filter((c: any) => c.state === 'missing').map((c: any) => c.name).join(', ') || '—'}</td>
            </tr>))}</tbody>
        </table></div>
      </Panel>)}
    </Loadable>
  );
}
