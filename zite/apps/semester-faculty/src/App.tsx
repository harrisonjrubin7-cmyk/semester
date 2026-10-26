import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { useAuth, loginWithRedirect, logout } from 'zitejs/auth';
import { Toaster } from '@project/components/ui/sonner';
import { Button } from '@project/components/ui/button';
import { Home, Scale, CalendarClock, LogOut, GraduationCap, Table2, Inbox, ShieldAlert, GitPullRequestArrow } from 'lucide-react';
import { getWorkspace, GetWorkspaceOutputType } from 'zitejs/api';
import { WorkspaceContext } from '../../semester/src/lib/workspace';
import CourseStudio from '../../semester/src/pages/SectionPage';
import { Gradebook, TAQueue } from '../../semester/src/pages/Staff';
import Integrity from '../../semester/src/pages/Integrity';
import { SectionRequests } from '../../semester/src/pages/InstitutionHome';
import { cn } from '@project/components/lib/utils';
import Teaching from './pages/Teaching';
import SectionPage from './pages/Section';
import Regrades from './pages/Regrades';
import OfficeHours from './pages/OfficeHours';

const NAV = [
  { to: '/', label: 'Teaching', icon: Home },
  { to: '/regrades', label: 'Regrade requests', icon: Scale },
  { to: '/office-hours', label: 'Office hours', icon: CalendarClock },
  { to: '/queue', label: 'Grading queue', icon: Inbox },
  { to: '/gradebook', label: 'Gradebook', icon: Table2 },
  { to: '/integrity', label: 'Academic integrity', icon: ShieldAlert },
  { to: '/section-requests', label: 'Section requests', icon: GitPullRequestArrow },
];

/** The shared pages link to the main app's paths; these send them to this app's equivalents. */
function LearnRedirect() {
  const id = location.pathname.split('/')[2];
  return <Navigate to={id && id !== 'ask' ? `/course/${id}` : '/'} replace />;
}

function Shell() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-background font-sans text-foreground md:flex">
      <aside className="border-b border-border bg-card md:sticky md:top-0 md:flex md:h-screen md:w-60 md:flex-col md:border-b-0 md:border-r">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground"><GraduationCap className="h-5 w-5" /></div>
          <div><p className="text-sm font-extrabold leading-none">Semester</p><p className="text-xs text-muted-foreground">Faculty</p></div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:pb-0">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => cn('flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
              <Icon className="h-4 w-4" />{label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden px-5 py-4 md:block">
          <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          <Button variant="ghost" size="sm" className="-ml-2 mt-1" onClick={() => logout()}><LogOut className="mr-2 h-4 w-4" />Sign out</Button>
        </div>
      </aside>
      <main className="flex-1 px-4 py-8 md:px-10">
        <div className="mx-auto max-w-5xl">
          <Routes>
            <Route path="/" element={<Teaching />} />
            <Route path="/sections/:id" element={<SectionPage />} />
            <Route path="/regrades" element={<Regrades />} />
            <Route path="/office-hours" element={<OfficeHours />} />
            <Route path="/course/:sectionId" element={<CourseStudio />} />
            <Route path="/queue" element={<TAQueue />} />
            <Route path="/gradebook" element={<Gradebook />} />
            <Route path="/integrity" element={<Integrity />} />
            <Route path="/section-requests" element={<SectionRequests />} />
            <Route path="/learn/*" element={<LearnRedirect />} />
            <Route path="/learn" element={<Navigate to="/" replace />} />
            <Route path="/staff/regrades" element={<Navigate to="/regrades" replace />} />
            <Route path="/staff/queue" element={<Navigate to="/queue" replace />} />
            <Route path="/staff/gradebook" element={<Navigate to="/gradebook" replace />} />
            <Route path="/you/integrity" element={<Navigate to="/integrity" replace />} />
            <Route path="/help/appointments" element={<Navigate to="/office-hours" replace />} />
            <Route path="/institution/sections" element={<Navigate to="/section-requests" replace />} />
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
  const [ws, setWs] = useState<GetWorkspaceOutputType | null>(null);
  const [role, setRole] = useState('Faculty');
  useEffect(() => { if (!isLoading && !user) loginWithRedirect(); }, [isLoading, user]);
  const refresh = () => getWorkspace({}).then(setWs).catch(() => setWs({ memberships: [], firstName: '' }));
  useEffect(() => { if (user) refresh(); }, [user]);
  if (isLoading || !user || !ws) return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Loading Semester Faculty…</div>;
  const membership = ws.memberships.find((m) => m.status === 'Active');
  if (!membership) {
    return (
      <div className="grid min-h-screen place-items-center px-6">
        <div className="max-w-md rounded-md border border-border bg-card p-6">
          <h1 className="text-2xl">No active membership</h1>
          <p className="mt-2 text-sm text-muted-foreground">Join your institution in the Semester app first; an administrator approves Faculty access.</p>
          <div className="mt-6 flex gap-2"><Button onClick={refresh}>Check again</Button><Button variant="outline" onClick={() => logout()}>Sign out</Button></div>
        </div>
      </div>
    );
  }
  // Display only: the server authorizes every call from the reloaded membership, never from this value.
  const current = membership.roles.includes(role) ? role : membership.roles[0] ?? 'Faculty';
  return (
    <WorkspaceContext.Provider value={{ membership, role: current, setRole, refresh }}>
      <BrowserRouter><Shell /></BrowserRouter>
    </WorkspaceContext.Provider>
  );
}
