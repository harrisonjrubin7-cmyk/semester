import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, loginWithRedirect, logout } from 'zitejs/auth';
import { Toaster } from '@project/components/ui/sonner';
import { Button } from '@project/components/ui/button';
import { LayoutDashboard, GitPullRequestArrow, Ban, PlugZap, ScrollText, Building2, ClipboardList, GraduationCap, Briefcase, Globe, ListChecks, Mail, CalendarDays, FolderOpen, FileText, ShoppingCart, Calculator, FlaskConical, Award, Scale } from 'lucide-react';
import { institutionOps } from 'zitejs/api';
import { useLoad } from './lib/useLoad';
import { DeniedOrError } from './components/States';
import { AppShell, type NavGroup, type NavItem } from '../../semester/src/components/AppShell';
import Overview from './pages/Overview';
import Requests from './pages/Requests';
import Holds from './pages/Holds';
import Employers from './pages/Employers';
import Programs from './pages/Programs';
import Visits from './pages/Visits';
import Console from './pages/Console';
import Audit from './pages/Audit';
import Structure from './pages/Structure';
import Records from './pages/Records';
import Registration from './pages/Registration';
import Today from '../../semester/src/pages/Today';
import InboxPage from '../../semester/src/pages/Inbox';
import CalendarPage from '../../semester/src/pages/CalendarPage';
import Workspaces from '../../semester/src/pages/Workspaces';
import Files from '../../semester/src/pages/Files';
import Procurement from '../../semester/src/pages/Procurement';
import Contracts from '../../semester/src/pages/Contracts';
import BudgetPlanning from '../../semester/src/pages/BudgetPlanning';
import ResearchAdmin from '../../semester/src/pages/ResearchAdmin';
import Grants from '../../semester/src/pages/Grants';
import EthicsReview from '../../semester/src/pages/EthicsReview';

type Access = { roles: string[]; member: boolean; institutionName: string; isSample: boolean; can: Record<string, boolean> };

// Institution navigation manifest (owner PDFs 28 Oct, Institution IA). A destination appears when the person's current role
// includes the capability its page needs; the server still authorizes every request. Planned workspaces (catalog, scheduling,
// records, admissions, aid, workforce, finance, campus, research, governance…) are tracked in the platform build plan.
function groupsFor(can: Record<string, boolean>): NavGroup[] {
  const items = (xs: (NavItem & { need?: string })[]) => xs.filter((x) => !x.need || can[x.need]);
  return [
    { group: null, items: items([{ to: '/', label: 'Today', icon: LayoutDashboard, end: true }]) },
    { group: 'Personal', items: items([{ to: '/today', label: 'Action Center', icon: ListChecks, hint: 'tasks notices deadlines' }, { to: '/mail', label: 'Mail', icon: Mail, hint: 'messages inbox' }, { to: '/calendar', label: 'Calendar', icon: CalendarDays, hint: 'schedule plan' }, { to: '/workspace', label: 'Workspace', icon: FolderOpen, hint: 'workspaces affiliations' }, { to: '/files', label: 'Files', icon: FileText, hint: 'documents' }]) },
    { group: 'Academics', items: items([{ to: '/requests', label: 'Sections & teaching assignments', icon: GitPullRequestArrow, hint: 'section requests' },
      { to: '/structure', label: 'Academic structure', icon: Building2, hint: 'departments rooms' },
      { to: '/programs', label: 'Public programs', icon: Globe, need: 'catalog.manage', hint: 'public site admissions listing' },
      { to: '/visits', label: 'Visit slots', icon: CalendarDays, need: 'catalog.manage', hint: 'admissions tours information sessions interviews' },
      { to: '/registration', label: 'Registration & enrollment', icon: ClipboardList, need: 'registrar.read', hint: 'registrar desk waitlist add drop overrides' },
      { to: '/records', label: 'Academic records', icon: GraduationCap, need: 'registrar.read', hint: 'official grades transcripts standing grading policy' }]) },
    { group: 'Student lifecycle', items: items([{ to: '/holds', label: 'Holds', icon: Ban, need: 'registration.request.decide' },
      { to: '/employers', label: 'Employer partnerships', icon: Briefcase, need: 'approval.decide', hint: 'career employers recruiters' }]) },
    { group: 'Campus operations', items: items([{ to: '/procurement', label: 'Procurement', icon: ShoppingCart, hint: 'budgets requisitions purchase orders suppliers' },
      { to: '/contracts', label: 'Contracts', icon: FileText, hint: 'partner agreements terms acceptance' },
      { to: '/budget-planning', label: 'Budget & planning', icon: Calculator, hint: 'fiscal year plans variance' },
      { to: '/research', label: 'Research admin', icon: FlaskConical, hint: 'research requests project registration' },
      { to: '/grants', label: 'Grants', icon: Award, hint: 'sponsored projects verification spend reports' },
      { to: '/ethics', label: 'Ethics review', icon: Scale, hint: 'protocol review committee' }]) },
    { group: 'Governance', items: items([{ to: '/console', label: 'Access & connections', icon: PlugZap, need: 'member.manage', hint: 'members' },
      { to: '/audit', label: 'Audit & assurance', icon: ScrollText, need: 'audit.read', hint: 'audit log' }]) },
  ];
}

function Shell() {
  const access = useLoad(() => institutionOps({ action: 'access' }) as Promise<Access>);
  if (access.loading && !access.data) return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Loading Semester Institution…</div>;
  if (access.error || !access.data) return <div className="grid min-h-screen place-items-center px-6"><DeniedOrError message={access.error ?? 'Your access could not be checked.'} onRetry={access.reload} /></div>;
  const a = access.data;
  if (!a.member) return (
    <div className="grid min-h-screen place-items-center px-6"><div className="max-w-md rounded-md border border-border bg-card p-6">
      <h1 className="text-2xl">No active institution membership</h1>
      <p className="mt-2 text-sm text-muted-foreground">Semester Institution is for people who work for an institution. Ask your administrator to approve your membership.</p>
      <Button className="mt-6" variant="outline" onClick={() => logout()}>Sign out</Button></div></div>);
  return (
    <AppShell app="Institution" appKey="institution" institutionName={a.institutionName} role={a.roles.join(', ') || 'Member'} roles={[]} isSample={a.isSample} groups={groupsFor(a.can)}>
      <Routes>
        <Route path="/" element={<Overview />} />
        <Route path="/today" element={<Today />} />
        <Route path="/mail" element={<InboxPage key="m" initial="mail" />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/workspace" element={<Workspaces />} />
        <Route path="/files" element={<Files />} />
        <Route path="/today/mail" element={<Navigate to="/mail" replace />} />
        <Route path="/plan" element={<Navigate to="/calendar" replace />} />
        <Route path="/you/files" element={<Navigate to="/files" replace />} />
        <Route path="/you/workspaces" element={<Navigate to="/workspace" replace />} />
        <Route path="/requests" element={<Requests />} />
        <Route path="/structure" element={<Structure />} />
        <Route path="/holds" element={<Holds />} />
        <Route path="/programs" element={<Programs />} />
        <Route path="/visits" element={<Visits />} />
        <Route path="/employers" element={<Employers />} />
        <Route path="/registration" element={<Registration />} />
        <Route path="/records" element={<Records />} />
        <Route path="/procurement" element={<Procurement />} />
        <Route path="/contracts" element={<Contracts />} />
        <Route path="/budget-planning" element={<BudgetPlanning />} />
        <Route path="/research" element={<ResearchAdmin />} />
        <Route path="/grants" element={<Grants />} />
        <Route path="/ethics" element={<EthicsReview />} />
        <Route path="/console" element={<Console />} />
        <Route path="/audit" element={<Audit />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </AppShell>
  );
}

export default function App() {
  const { user, isLoading } = useAuth();
  useEffect(() => { if (!isLoading && !user) loginWithRedirect(); }, [isLoading, user]);
  if (isLoading || !user) return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Loading Semester Institution…</div>;
  return <BrowserRouter><Shell /></BrowserRouter>;
}
