import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from 'zitejs/auth';
import { Activity, Boxes, FileCheck2, Gauge, KeyRound, Layers, LayoutGrid, ListChecks, Map, ShieldAlert, ScrollText } from 'lucide-react';
import { cn } from '@project/components/lib/utils';
import { Wordmark } from '@project/components/brand/Mark';

const nav = [
  { to: '/', label: 'Overview', icon: Activity },
  { to: '/jwt', label: 'JWT & scope', icon: KeyRound },
  { to: '/bucket', label: 'Token bucket', icon: Gauge },
  { to: '/isolation', label: 'Tenant isolation', icon: Layers },
  { to: '/rls', label: 'RLS audit', icon: ShieldAlert },
  { to: '/suites', label: 'Suites & runs', icon: ListChecks },
  { to: '/policies', label: 'Policy registry', icon: Boxes },
  { to: '/gates', label: 'Release gates', icon: FileCheck2 },
  { to: '/artifacts', label: 'Artifact parity', icon: ScrollText },
  { to: '/capabilities', label: 'Capability register', icon: Map },
  { to: '/portfolio', label: 'App portfolio', icon: LayoutGrid },
];

export default function Layout() {
  const { user } = useAuth();
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0">
        <div className="px-5 py-5">
          <div className="text-sm text-sidebar-primary"><Wordmark /></div>
          <div className="text-lg font-semibold text-sidebar-accent-foreground">Security Lab</div>
          <div className="mt-1 text-[11px] text-sidebar-foreground/60">Restricted · synthetic data only</div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => cn('flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors', isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'hover:bg-sidebar-accent/60')}>
              <n.icon className="h-4 w-4" />{n.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden px-5 pt-4 text-xs text-sidebar-foreground/60 md:block">{user?.email}</div>
      </aside>
      <main className="flex-1 px-5 py-8 md:px-10"><div className="mx-auto max-w-6xl"><Outlet /></div></main>
    </div>
  );
}
