import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth, loginWithRedirect, logout } from 'zitejs/auth';
import { Button } from '@project/components/ui/button';
import { getWorkspace, GetWorkspaceOutputType } from 'zitejs/api';
import { Toaster } from '@project/components/ui/sonner';
import { WorkspaceContext } from './lib/workspace';
import Shell from './components/Shell';
import Onboarding from './pages/Onboarding';
import Today from './pages/Today';
import CalendarPage from './pages/CalendarPage';
import Registration from './pages/Registration';
import Career from './pages/Career';
import Courses from './pages/Courses';
import SectionPage from './pages/SectionPage';
import Study from './pages/Study';
import Ask from './pages/Ask';
import Help from './pages/Help';
import Campus from './pages/Campus';
import Accommodations from './pages/Accommodations';
import RoleApps, { RoleAppHome } from './pages/RoleApps';
import Tutoring from './pages/Tutoring';
import Graduate from './pages/Graduate';
import Referrals from './pages/Referrals';
import AcademicCalendar from './pages/AcademicCalendar';
import Catalog from './pages/Catalog';
import Transfer from './pages/Transfer';
import FinancialAid from './pages/FinancialAid';
import Files from './pages/Files';
import { MyAccountServices, AccountServicesStaff } from './components/AccountServices';
import Progress from './pages/Progress';
import You from './pages/You';
import Console from './pages/Console';
import Inbox from './pages/Inbox';
import Grades from './pages/Grades';
import Account from './pages/Account';
import Degree from './pages/Degree';
import Advising from './pages/Advising';
import Write from './pages/Write';
import Decks from './pages/Decks';
import Community from './pages/Community';
import Maps from './pages/Maps';
import Mentoring from './pages/Mentoring';
import Network from './pages/Network';
import Admissions from './pages/Admissions';
import { Gradebook, TAQueue, RegistrarDesk, StudentAccounts, StudentAffairs } from './pages/Staff';
import { Analytics, RegistrationHolds } from './pages/Institution';
import RegradeQueue from './pages/RegradeQueue';
import { InstitutionHome, SectionRequests } from './pages/InstitutionHome';
import Faculty, { Appointments } from './pages/Faculty';
import Integrity from './pages/Integrity';
import Housing from './pages/Housing';
import ITService from './pages/ITService';
import Offices from './pages/Offices';
import DepartmentForms from './pages/DepartmentForms';
import DepartmentStaffing from './pages/DepartmentStaffing';
import CommunityAdmin from './pages/CommunityAdmin';
import Research from './pages/Research';
import ResearchProtocols from './pages/ResearchProtocols';
import ControlPlane from './pages/ControlPlane';
import College from './pages/College';
import ProgramReview from './pages/ProgramReview';
import Announcements from './pages/Announcements';
import Athletics from './pages/Athletics';
import Knowledge from './pages/Knowledge';
import Library from './pages/Library';
import Parking from './pages/Parking';
import Inventory from './pages/Inventory';
import Facilities from './pages/Facilities';
import IdCard from './pages/IdCard';
import Audit from './pages/Audit';
import Workspaces from './pages/Workspaces';
import Continuing from './pages/Continuing';
import Design from './pages/Design';
import Governance from './pages/Governance';
import Council from './pages/Council';
import ResLife from './pages/ResLife';
import CareerServices from './pages/CareerServices';
import PeerSupport from './pages/PeerSupport';
import DisabilityServices from './pages/DisabilityServices';
import Guides from './pages/Guides';
import { ToolkitHub, ToolkitTool } from './pages/Toolkit';
import Sources from './pages/Sources';
import Sheet from './pages/Sheet';
import Deck from './pages/Deck';
import Diagram from './pages/Diagram';
import Proof from './pages/Proof';
import Paper from './pages/Paper';
import GroupWork from './pages/GroupWork';
import FinalGrades from './pages/FinalGrades';
import { AppSwitcher } from './components/AppSwitcher';
import HumanResources from './pages/HumanResources';
import Recruiting from './pages/Recruiting';
import Procurement from './pages/Procurement';
import Contracts from './pages/Contracts';
import BudgetPlanning from './pages/BudgetPlanning';
import ResearchAdmin from './pages/ResearchAdmin';
import Grants from './pages/Grants';
import EthicsReview from './pages/EthicsReview';
import Organizations from './pages/Organizations';
import Transition from './pages/Transition';
import Partners from './pages/Partners';
import StudyAbroad from './pages/StudyAbroad';
import Scholarships from './pages/Scholarships';
import Curriculum from './pages/Curriculum';
import Programs from './pages/Programs';
import Dining from './pages/Dining';
import GradeTracker from './pages/GradeTracker';
import SyllabusHub from './pages/SyllabusHub';
import SharedWithMe from './pages/SharedWithMe';
import { Wordmark } from '@project/components/brand/Mark';

function Splash({ text = 'Loading Semester…' }: { text?: string }) {
  return <div className="flex min-h-screen items-center justify-center bg-sidebar text-sidebar-foreground"><p className="text-lg"><Wordmark /></p><span className="sr-only">{text}</span></div>;
}

export default function App() {
  const { user, isLoading } = useAuth();
  const [ws, setWs] = useState<GetWorkspaceOutputType | null>(null);
  const [role, setRole] = useState(() => localStorage.getItem('semester.role') ?? '');

  useEffect(() => { if (!isLoading && !user) loginWithRedirect(); }, [isLoading, user]);
  const refresh = () => getWorkspace({}).then(setWs).catch(() => setWs({ memberships: [], firstName: '', currentId: null }));
  useEffect(() => { if (user) refresh(); }, [user]);

  if (isLoading || !user || !ws) return <Splash />;
  // The server picks the current membership (lib/server.ts currentMembership); the client only mirrors it.
  const membership = ws.memberships.find((m) => m.id === ws.currentId && m.status === 'Active') ?? ws.memberships.find((m) => m.status === 'Active');
  // Outside partner organizations have no institution membership; their page stands alone (authorization is server-side).
  if (!membership && window.location.pathname.startsWith('/partners')) return <div className="mx-auto max-w-4xl px-4 py-6"><Partners /><Toaster /></div>;
  if (!membership) {
    if (ws.memberships.length) {
      const m = ws.memberships[0];
      return (
        <div className="flex min-h-screen items-center justify-center bg-background px-6">
          <div className="max-w-md rounded-md border border-border bg-card p-6">
            <p className="eyebrow">{m.institutionName}</p>
            <h1 className="mt-2 text-3xl">{m.status === 'Suspended' ? '⊘ Membership suspended' : '… Waiting for approval'}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{m.status === 'Suspended' ? 'An administrator has suspended your access. Contact your institution to restore it.' : `Your request to join as ${m.roles.join(', ')} went to the institution's administrators. You'll get access once one of them approves it.`}</p>
            <div className="mt-6 flex gap-2"><Button onClick={refresh}>Check again</Button><Button variant="outline" onClick={() => logout()}>Sign out</Button></div>
          </div>
        </div>
      );
    }
    return <><Onboarding onDone={refresh} name={ws.firstName} /><Toaster /></>;
  }
  const current = membership.roles.includes(role) ? role : membership.roles[0] ?? 'Student';
  const changeRole = (r: string) => { localStorage.setItem('semester.role', r); setRole(r); };

  return (
    <WorkspaceContext.Provider value={{ membership, role: current, setRole: changeRole, refresh }}>
      <BrowserRouter>
        <AppSwitcher current="semester" />
        <Routes>
          <Route path="/console" element={current === 'Administrator' ? <Console /> : <Navigate to="/today" replace />} />
          <Route path="/console/control" element={current === 'Administrator' ? <ControlPlane /> : <Navigate to="/today" replace />} />
          <Route element={<Shell />}>
            <Route path="/today" element={<Today />} />
            <Route path="/today/notifications" element={<Inbox key="n" initial="notifications" />} />
            <Route path="/today/mail" element={<Inbox key="m" initial="mail" />} />
            <Route path="/learn/write" element={<Write />} />
            <Route path="/learn/decks" element={<Decks />} />
            <Route path="/help/advising" element={<Advising />} />
            <Route path="/campus/community" element={<Community />} />
            <Route path="/campus/communities" element={<CommunityAdmin />} />
            <Route path="/campus/groupwork" element={<GroupWork />} />
            <Route path="/records/final-grades" element={<FinalGrades />} />
            <Route path="/campus/places" element={<Maps />} />
            <Route path="/campus/accommodations" element={<Accommodations />} />
            <Route path="/campus/housing" element={<Housing />} />
            <Route path="/campus/it" element={<ITService />} />
            <Route path="/campus/library" element={<Library />} />
            <Route path="/campus/parking" element={<Parking />} />
            <Route path="/campus/inventory" element={<Inventory />} />
            <Route path="/campus/facilities" element={<Facilities />} />
            <Route path="/campus/card" element={<IdCard />} />
            <Route path="/campus/audit" element={<Audit />} />
            <Route path="/campus/dining" element={<Dining />} />
            <Route path="/learn/tutoring" element={<Tutoring />} />
            <Route path="/progress/graduate" element={<Graduate />} />
            <Route path="/help/referrals" element={<Referrals />} />
            <Route path="/apps" element={<RoleApps />} />
            <Route path="/apps/:key" element={<RoleAppHome />} />
            <Route path="/progress/degree" element={<Degree />} />
            <Route path="/progress/grades" element={<Grades />} />
            <Route path="/progress/tracker" element={<GradeTracker />} />
            <Route path="/staff/gradebook" element={<Gradebook />} />
            <Route path="/staff/queue" element={<TAQueue />} />
            <Route path="/staff/regrades" element={<RegradeQueue />} />
            <Route path="/staff/shared" element={<SharedWithMe />} />
            <Route path="/staff/registrar" element={<RegistrarDesk />} />
            <Route path="/staff/calendar" element={<AcademicCalendar />} />
            <Route path="/staff/catalog" element={<Catalog />} />
            <Route path="/plan/transfer" element={<Transfer />} />
            <Route path="/plan/abroad" element={<StudyAbroad />} />
            <Route path="/you/aid" element={<FinancialAid />} />
            <Route path="/you/scholarships" element={<Scholarships />} />
            <Route path="/you/files" element={<Files />} />
            <Route path="/you/workspaces" element={<Workspaces />} />
            <Route path="/learn/continuing" element={<Continuing />} />
            <Route path="/staff/design" element={<Design />} />
            <Route path="/staff/governance" element={<Governance />} />
            <Route path="/staff/council" element={<Council />} />
            <Route path="/campus/reslife" element={<ResLife />} />
            <Route path="/plan/career-services" element={<CareerServices />} />
            <Route path="/help/peer-support" element={<PeerSupport />} />
            <Route path="/campus/disability-services" element={<DisabilityServices />} />
            <Route path="/learn/guides" element={<Guides />} />
            <Route path="/learn/sources" element={<Sources />} />
            <Route path="/learn/sheet" element={<Sheet />} />
            <Route path="/learn/deck" element={<Deck />} />
            <Route path="/learn/diagram" element={<Diagram />} />
            <Route path="/learn/proof" element={<Proof />} />
            <Route path="/learn/paper" element={<Paper />} />
            <Route path="/learn/toolkit" element={<ToolkitHub />} />
            <Route path="/learn/toolkit/:kind" element={<ToolkitTool />} />
            <Route path="/you/work" element={<HumanResources />} />
            <Route path="/you/recruiting" element={<Recruiting />} />
            <Route path="/campus/procurement" element={<Procurement />} />
            <Route path="/campus/contracts" element={<Contracts />} />
            <Route path="/campus/budget-planning" element={<BudgetPlanning />} />
            <Route path="/campus/research" element={<ResearchAdmin />} />
            <Route path="/campus/grants" element={<Grants />} />
            <Route path="/campus/ethics" element={<EthicsReview />} />
            <Route path="/campus/organizations" element={<Organizations />} />
            <Route path="/plan/transition" element={<Transition />} />
            <Route path="/staff/holds" element={<RegistrationHolds />} />
            <Route path="/faculty" element={<Faculty />} />
            <Route path="/you/integrity" element={<Integrity />} />
            <Route path="/help/appointments" element={<Appointments />} />
            <Route path="/institution" element={<InstitutionHome />} />
            <Route path="/institution/sections" element={<SectionRequests />} />
            <Route path="/institution/forms" element={<DepartmentForms />} />
            <Route path="/institution/staffing" element={<DepartmentStaffing />} />
            <Route path="/institution/curriculum" element={<Curriculum />} />
            <Route path="/institution/programs" element={<Programs />} />
            <Route path="/staff/analytics" element={<Analytics />} />
            <Route path="/staff/research" element={<Research />} />
            <Route path="/staff/research-protocols" element={<ResearchProtocols />} />
            <Route path="/institution/college" element={<College />} />
            <Route path="/institution/program-review" element={<ProgramReview />} />
            <Route path="/campus/announcements" element={<Announcements />} />
            <Route path="/institution/athletics" element={<Athletics />} />
            <Route path="/staff/accounts" element={<><StudentAccounts /><AccountServicesStaff /></>} />
            <Route path="/staff/affairs" element={<StudentAffairs />} />
            <Route path="/staff/mentoring" element={<Mentoring />} />
            <Route path="/network" element={<Network />} />
            <Route path="/staff/admissions" element={<Admissions />} />
            <Route path="/plan" element={<CalendarPage />} />
            <Route path="/plan/registration" element={<Registration />} />
            <Route path="/plan/career" element={<Career />} />
            <Route path="/learn" element={<Courses />} />
            <Route path="/learn/study" element={<Study />} />
            <Route path="/learn/ask" element={<Ask />} />
            <Route path="/learn/syllabi" element={<SyllabusHub />} />
            <Route path="/learn/:sectionId" element={<SectionPage />} />
            <Route path="/help/offices" element={<Offices />} />
            <Route path="/help/knowledge" element={<Knowledge />} />
            <Route path="/help" element={<Help />} />
            <Route path="/campus" element={<Campus />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/you/account" element={<><Account /><MyAccountServices /></>} />
            <Route path="/partners" element={<Partners />} />
            <Route path="/you" element={<You />} />
            <Route path="*" element={<Navigate to="/today" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster />
    </WorkspaceContext.Provider>
  );
}
