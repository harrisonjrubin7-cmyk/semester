import { Link, NavLink, useParams, Navigate } from 'react-router-dom';
import { cn } from '@project/components/lib/utils';
import { workspaces, WorkspacesOutputType } from 'zitejs/api';
import { useLoad, Loadable, Header, Panel, Figure, fmt } from './ui';

type W = WorkspacesOutputType['workspaces'][0];

export const WORKSPACE_KEYS: [string, string][] = [
  ['executive', 'Executive'], ['sales', 'Sales & RevOps'], ['success', 'Customer Success'], ['support', 'Support'], ['people', 'People'],
  ['legal', 'Legal & Privacy'], ['trust', 'Trust'], ['engineering', 'Engineering'], ['ops', 'Operations'], ['board', 'Board'],
];

export default function WorkspacePage() {
  const { key = 'executive' } = useParams();
  const state = useLoad(() => workspaces({}), []);
  if (!WORKSPACE_KEYS.some(([k]) => k === key)) return <Navigate to="/w/executive" replace />;
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-border pb-2">
        {WORKSPACE_KEYS.map(([k, l]) => <NavLink key={k} to={`/w/${k}`} className={({ isActive }) => cn('whitespace-nowrap rounded-[3px] px-3 py-1.5 text-sm', isActive ? 'bg-accent font-medium' : 'text-muted-foreground hover:bg-muted')}>{l}</NavLink>)}
      </div>
      <Loadable state={state}>{(d) => <Workspace w={d.workspaces.find((x) => x.key === key)!} sample={d.sampleRows} at={d.generatedAt} reload={state.reload} />}</Loadable>
    </div>
  );
}

function Workspace({ w, sample, at, reload }: { w: W; sample: number; at: string; reload: () => void }) {
  return (
    <>
      <Header eyebrow="Workspace" title={w.title} sub={w.purpose}
        right={<button onClick={reload} className="text-xs text-muted-foreground underline">Refreshed {fmt(at)}</button>} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{w.figures.map((f) => <Figure key={f.label} {...f} />)}</div>
      {sample > 0 && <p className="mt-2 text-xs text-muted-foreground">{sample} synthetic sample records are excluded from these figures.</p>}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_280px]">
        <Panel title="Needs attention">
          {w.attention.length === 0 ? <p className="text-sm text-muted-foreground">Nothing waiting right now.</p> : (
            <ul className="divide-y divide-border">{w.attention.map((a, i) => (
              <li key={i}><Link to={a.to} className="block py-2.5 hover:bg-muted/50"><span className="block text-sm font-medium">{a.title}</span><span className="text-xs text-muted-foreground">{a.detail}</span></Link></li>))}</ul>)}
        </Panel>
        <div className="space-y-4">
          {w.links.length > 0 && <Panel title="Go to">{w.links.map(([to, l]) => <Link key={to} to={to} className="block py-1 text-sm text-primary underline">{l}</Link>)}</Panel>}
          {w.gaps.length > 0 && <Panel title="Not built yet"><ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">{w.gaps.map((g) => <li key={g}>{g}</li>)}</ul></Panel>}
        </div>
      </div>
    </>
  );
}
