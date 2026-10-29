import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, loginWithRedirect, logout } from 'zitejs/auth';
import { Toaster } from '@project/components/ui/sonner';
import { Button } from '@project/components/ui/button';
import { Home, Scale, CalendarClock, Table2, Inbox, ShieldAlert, GitPullRequestArrow, BookMarked, Award, ListChecks, Mail, CalendarDays, FolderOpen, FileText } from 'lucide-react';
import { getWorkspace, GetWorkspaceOutputType } from 'zitejs/api';
import { WorkspaceContext, useWorkspace } from '../../semester/src/lib/workspace';
import { AppShell, type NavGroup } from '../../semester/src/components/AppShell';
import CourseStudio from '../../semester/src/pages/SectionPage';
import { Gradebook, TAQueue } from '../../semester/src/pages/Staff';
import Integrity from '../../semester/src/pages/Integrity';
import Curriculum from '../../semester/src/pages/Curriculum';
import Guides from '../../semester/src/pages/Guides';
import Sources from '../../semester/src/pages/Sources';
import { SectionRequests } from '../../semester/src/pages/InstitutionHome';
import Teaching from './pages/Teaching';
import FinalGrades from './pages/FinalGrades';
import SectionPage from './pages/Section';
import Regrades from './pages/Regrades';
import OfficeHours from './pages/OfficeHours';
import Capstone from '../../semester/src/pages/Capstone';
import Today from '../../semester/src/pages/Today';
import InboxPage from '../../semester/src/pages/Inbox';
import CalendarPage from '../../semester/src/pages/CalendarPage';
import Workspaces from '../../semester/src/pages/Workspaces';
import Files from '../../semester/src/pages/Files';

// Faculty navigation manifest (owner PDFs 28 Oct, Faculty IA). Only destinations that exist are listed; planned workspaces
// (content & modules, announcements, teaching portfolio, research, workload…) are tracked in docs/execution/platform-build-plan-2026-10-28.md.
const GROUPS: NavGroup[] = [
  { group: null, items: [{ to: '/', label: 'Today', icon: Home, end: true }, { to: '/office-hours', label: 'Office hours', icon: CalendarClock }] },
  { group: 'Personal', items: [{ to: '/today', label: 'Action Center', icon: ListChecks, hint: 'tasks notices deadlines' }, { to: '/mail', label: 'Mail', icon: Mail, hint: 'messages inbox' }, { to: '/calendar', label: 'Calendar', icon: CalendarDays, hint: 'schedule plan' }, { to: '/workspace', label: 'Workspace', icon: FolderOpen, hint: 'workspaces affiliations' }, { to: '/files', label: 'Files', icon: FileText, hint: 'documents' }] },
  { group: 'Teach', items: [{ to: '/queue', label: 'Grading queue', icon: Inbox }, { to: '/gradebook', label: 'Gradebook', icon: Table2 }, { to: '/final-grades', label: 'Final grades', icon: Award, hint: 'course grade certify registrar' }] },
  { group: 'Support', items: [{ to: '/capstones', label: 'Capstones', icon: Award, hint: 'capstone supervision second reader' }, { to: '/regrades', label: 'Extensions & regrades', icon: Scale, hint: 'regrade requests' }, { to: '/integrity', label: 'Academic integrity', icon: ShieldAlert }] },
  { group: 'Develop', items: [{ to: '/curriculum', label: 'Curriculum proposals', icon: BookMarked }, { to: '/section-requests', label: 'Section requests', icon: GitPullRequestArrow },
    { to: '/guides', label: 'Study guides', icon: BookMarked }, { to: '/sources', label: 'Reading lists', icon: BookMarked, hint: 'sources bibliography' }] },
];

/** The shared pages link to the main app's paths; these send them to this app's equivalents. */
function LearnRedirect() {
  const id = location.pathname.split('/')[2];
  return <Navigate to={id && id !== 'ask' ? `/course/${id}` : '/'} replace />;
}

function Shell() {
  const { membership, role, setRole } = useWorkspace();
  return (
    <AppShell app="Faculty" appKey="faculty" institutionName={membership.institutionName} role={role} roles={membership.roles} onRole={setRole}
      isSample={!!membership.isSample} groups={GROUPS}>
      <Routes>
            <Route path="/" element={<Teaching />} />
            <Route path="/today" element={<Today />} />
            <Route path="/capstones" element={<Capstone />} />
            <Route path="/mail" element={<InboxPage key="m" initial="mail" />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/workspace" element={<Workspaces />} />
            <Route path="/files" element={<Files />} />
            <Route path="/today/mail" element={<Navigate to="/mail" replace />} />
            <Route path="/plan" element={<Navigate to="/calendar" replace />} />
            <Route path="/you/files" element={<Navigate to="/files" replace />} />
            <Route path="/you/workspaces" element={<Navigate to="/workspace" replace />} />
            <Route path="/sections/:id" element={<SectionPage />} />
            <Route path="/regrades" element={<Regrades />} />
            <Route path="/office-hours" element={<OfficeHours />} />
            <Route path="/course/:sectionId" element={<CourseStudio />} />
            <Route path="/queue" element={<TAQueue />} />
            <Route path="/gradebook" element={<Gradebook />} />
            <Route path="/final-grades" element={<FinalGrades />} />
            <Route path="/records/final-grades" element={<Navigate to="/final-grades" replace />} />
            <Route path="/integrity" element={<Integrity />} />
            <Route path="/section-requests" element={<SectionRequests />} />
            <Route path="/curriculum" element={<Curriculum />} />
            <Route path="/guides" element={<Guides />} />
            <Route path="/sources" element={<Sources />} />
            <Route path="/learn/sources" element={<Navigate to="/sources" replace />} />
            <Route path="/learn/guides" element={<Navigate to="/guides" replace />} />
            <Route path="/institution/curriculum" element={<Navigate to="/curriculum" replace />} />
            <Route path="/staff/catalog" element={<Navigate to="/curriculum" replace />} />
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
      <Toaster />
    </AppShell>
  );
}

export default function App() {
  const { user, isLoading } = useAuth();
  const [ws, setWs] = useState<GetWorkspaceOutputType | null>(null);
  const [role, setRole] = useState('Faculty');
  useEffect(() => { if (!isLoading && !user) loginWithRedirect(); }, [isLoading, user]);
  const refresh = () => getWorkspace({}).then(setWs).catch(() => setWs({ memberships: [], firstName: '', currentId: null }));
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
