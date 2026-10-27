import { BrowserRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { cn } from '@project/components/lib/utils';
import { OverviewPage, RequestsPage, RisksPage, EvidencePage } from './pages';
import Simulator from './Simulator';
import { DataProvider } from './crm/data';
import EntityPage from './crm/EntityPage';
import CrmOverview from './crm/CrmOverview';
import Audit from './crm/Audit';
import FinancePage from './FinancePage';
import PublicationsPage from './PublicationsPage';
import TrustCenterPage from './TrustCenterPage';
import AppReviewPage from './AppReviewPage';
import IncidentsPage from './IncidentsPage';
import MarketingPage from './MarketingPage';
import MigrationsPage from './MigrationsPage';
import SupportAccessPage from './SupportAccessPage';
import BoardPage from './BoardPage';
import DecisionsPage from './DecisionsPage';
import AtlasPage from './AtlasPage';
import WorkspacePage, { WORKSPACE_KEYS } from './WorkspacePage';
import { Wordmark } from '@project/components/brand/Mark';

const GROUPS: [string, [string, string][]][] = [
  ['Workspaces', WORKSPACE_KEYS.map(([k, l]) => [`/w/${k}`, l] as [string, string])],
  ['Operations', [['/overview', 'Overview'], ['/atlas', 'Atlas'], ['/requests', 'Inbound requests'], ['/risks', 'Risk register'], ['/decisions', 'Decision register'], ['/evidence', 'Release evidence'], ['/publications', 'Site publications'], ['/trust-center', 'Trust Center'], ['/incidents', 'Incidents'], ['/marketing', 'Marketing'], ['/app-review', 'App review'], ['/simulator', 'Simulator']]],
  ['Customers', [['/crm', 'Pipeline'], ['/finance', 'Invoices & approvals'], ['/accounts', 'Accounts'], ['/deals', 'Deals'], ['/contracts', 'Contracts'], ['/implementation', 'Implementation'], ['/migrations', 'Migrations'], ['/support', 'Support'], ['/support-access', 'Support access'], ['/board', 'Board reporting'], ['/audit', 'Audit log']]],
];

// Internal app: the platform signs in organization members only. No student content is ever loaded here.
export default function App() {
  return (
    <BrowserRouter>
      <DataProvider>
        <div className="min-h-screen bg-background md:grid md:grid-cols-[220px_1fr]">
          <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">Skip to content</a>
          <aside className="border-b border-sidebar-border bg-sidebar-background text-sidebar-foreground md:min-h-screen md:border-b-0 md:border-r">
            <div className="px-4 py-4"><p className="text-lg text-sidebar-accent-foreground"><Wordmark /></p><p className="text-[11px] uppercase tracking-widest text-sidebar-foreground/70">Company OS · restricted</p></div>
            <nav aria-label="Company OS" className="flex gap-1 overflow-x-auto px-2 pb-3 md:flex-col md:overflow-visible">
              {GROUPS.map(([g, items]) => (
                <div key={g} className="flex gap-1 md:flex-col">
                  <p className="hidden px-3 pt-3 text-[10px] uppercase tracking-widest text-sidebar-foreground/60 md:block">{g}</p>
                  {items.map(([to, label]) => <NavLink key={to} to={to} className={({ isActive }) => cn('whitespace-nowrap rounded-[3px] border-l-2 border-transparent px-3 py-2 text-sm hover:bg-sidebar-accent', isActive && 'border-sidebar-primary bg-sidebar-accent font-medium text-sidebar-accent-foreground')}>{label}</NavLink>)}
                </div>
              ))}
            </nav>
          </aside>
          <main id="main" className="min-w-0 px-4 py-6 sm:px-6">
            <Routes>
              <Route path="/overview" element={<OverviewPage />} />
              <Route path="/atlas" element={<AtlasPage />} />
              <Route path="/requests" element={<RequestsPage />} />
              <Route path="/risks" element={<RisksPage />} />
              <Route path="/roles" element={<Navigate to="/atlas" replace />} />
              <Route path="/decisions" element={<DecisionsPage />} />
              <Route path="/evidence" element={<EvidencePage />} />
              <Route path="/w/:key" element={<WorkspacePage />} />
              <Route path="/publications" element={<PublicationsPage />} />
              <Route path="/trust-center" element={<TrustCenterPage />} />
              <Route path="/app-review" element={<AppReviewPage />} />
              <Route path="/incidents" element={<IncidentsPage />} />
              <Route path="/marketing" element={<MarketingPage />} />
              <Route path="/migrations" element={<MigrationsPage />} />
              <Route path="/support-access" element={<SupportAccessPage />} />
              <Route path="/board" element={<BoardPage />} />
              <Route path="/simulator" element={<Simulator />} />
              <Route path="/finance" element={<FinancePage />} />
              <Route path="/crm" element={<CrmOverview />} />
              <Route path="/accounts" element={<EntityPage key="a" table="accounts" />} />
              <Route path="/deals" element={<EntityPage key="d" table="deals" />} />
              <Route path="/contracts" element={<EntityPage key="c" table="contracts" />} />
              <Route path="/implementation" element={<EntityPage key="p" table="projects" />} />
              <Route path="/support" element={<EntityPage key="t" table="tickets" />} />
              <Route path="/audit" element={<Audit />} />
              <Route path="*" element={<Navigate to="/overview" replace />} />
            </Routes>
          </main>
        </div>
        <Toaster position="bottom-right" />
      </DataProvider>
    </BrowserRouter>
  );
}
