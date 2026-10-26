import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { useAuth, loginWithRedirect, logout } from 'zitejs/auth';
import { Toaster } from '@project/components/ui/sonner';
import { Button } from '@project/components/ui/button';
import { Home, Scale, CalendarClock, LogOut, GraduationCap } from 'lucide-react';
import { cn } from '@project/components/lib/utils';
import Teaching from './pages/Teaching';
import SectionPage from './pages/Section';
import Regrades from './pages/Regrades';
import OfficeHours from './pages/OfficeHours';

const NAV = [
  { to: '/', label: 'Teaching', icon: Home },
  { to: '/regrades', label: 'Regrade requests', icon: Scale },
  { to: '/office-hours', label: 'Office hours', icon: CalendarClock },
];

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
  if (isLoading || !user) return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Loading Semester Faculty…</div>;
  return <BrowserRouter><Shell /></BrowserRouter>;
}
