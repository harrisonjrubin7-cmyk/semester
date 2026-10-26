import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { useAuth, loginWithRedirect, logout } from 'zitejs/auth';
import { Toaster } from '@project/components/ui/sonner';
import { Button } from '@project/components/ui/button';
import { LayoutDashboard, GitPullRequestArrow, Ban, PlugZap, ScrollText, LogOut, Landmark, Building2 } from 'lucide-react';
import { cn } from '@project/components/lib/utils';
import Overview from './pages/Overview';
import Requests from './pages/Requests';
import Holds from './pages/Holds';
import Console from './pages/Console';
import Audit from './pages/Audit';
import Structure from './pages/Structure';

const NAV = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/requests', label: 'Section requests', icon: GitPullRequestArrow },
  { to: '/structure', label: 'Departments & rooms', icon: Building2 },
  { to: '/holds', label: 'Holds', icon: Ban },
  { to: '/console', label: 'Members & connections', icon: PlugZap },
  { to: '/audit', label: 'Audit log', icon: ScrollText },
];

function Shell() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-background font-sans text-foreground md:flex">
      <aside className="border-b border-border bg-card md:sticky md:top-0 md:h-screen md:w-64 md:border-b-0 md:border-r">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground"><Landmark className="h-5 w-5" /></div>
          <div><p className="text-sm font-extrabold leading-none">Semester</p><p className="text-xs text-muted-foreground">Institution</p></div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => cn(
              'flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
              <Icon className="h-4 w-4" />{label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden px-5 py-4 md:absolute md:bottom-0 md:block md:w-64">
          <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          <Button variant="ghost" size="sm" className="mt-1 -ml-2" onClick={() => logout()}><LogOut className="mr-2 h-4 w-4" />Sign out</Button>
        </div>
      </aside>
      <main className="flex-1 px-4 py-8 md:px-10">
        <div className="mx-auto max-w-6xl">
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/requests" element={<Requests />} />
            <Route path="/structure" element={<Structure />} />
            <Route path="/holds" element={<Holds />} />
            <Route path="/console" element={<Console />} />
            <Route path="/audit" element={<Audit />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
      <Toaster />
    </div>
  );
}

export default function App() {
  const { user, isLoading } = useAuth();
  useEffect(() => { if (!isLoading && !user) loginWithRedirect(); }, [isLoading, user]);
  if (isLoading || !user) return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Loading Semester Institution…</div>;
  return <BrowserRouter><Shell /></BrowserRouter>;
}
