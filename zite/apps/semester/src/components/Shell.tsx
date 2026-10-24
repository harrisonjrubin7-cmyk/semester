import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import { CalendarDays, ClipboardList, Briefcase, BookOpen, Layers, Sparkles, LifeBuoy, Users, TrendingUp, Shield, Sun, Search, LogOut, Building2, Bell, Mail, PenLine, Copy, MessageSquare, MessagesSquare, MapPin, GraduationCap, Award, Table2, Inbox, ClipboardCheck, Receipt, HeartHandshake, Scale, Share2, Ban, BarChart3, Accessibility, LayoutGrid, Handshake, ScrollText, Forward } from 'lucide-react';
import { logout } from 'zitejs/auth';
import { cn } from '@project/components/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@project/components/ui/dropdown-menu';
import { useWorkspace } from '../lib/workspace';
import CommandPalette from './CommandPalette';

const NAV = [
  { group: null, items: [{ to: '/today', label: 'Today', icon: Sun }, { to: '/today/notifications', label: 'Notifications', icon: Bell }, { to: '/today/mail', label: 'Mail', icon: Mail }] },
  { group: 'Plan', items: [{ to: '/plan', label: 'Calendar', icon: CalendarDays }, { to: '/plan/registration', label: 'Registration', icon: ClipboardList }, { to: '/plan/career', label: 'Career', icon: Briefcase }] },
  { group: 'Learn', items: [{ to: '/learn', label: 'Courses', icon: BookOpen }, { to: '/learn/study', label: 'Study', icon: Layers }, { to: '/learn/tutoring', label: 'Tutoring', icon: Handshake }, { to: '/learn/write', label: 'Write', icon: PenLine }, { to: '/learn/decks', label: 'Decks', icon: Copy }, { to: '/learn/ask', label: 'Ask Semester', icon: Sparkles }] },
  { group: 'Help', items: [{ to: '/help', label: 'Advising & support', icon: LifeBuoy }, { to: '/help/advising', label: 'Advising prep', icon: MessageSquare }, { to: '/help/referrals', label: 'Referrals', icon: Forward }] },
  { group: 'Campus', items: [{ to: '/campus', label: 'Clubs & events', icon: Users }, { to: '/campus/community', label: 'Community', icon: MessagesSquare }, { to: '/campus/places', label: 'Places', icon: MapPin }, { to: '/campus/accommodations', label: 'Accommodations', icon: Accessibility }] },
  { group: 'Apps', items: [{ to: '/apps', label: 'Your apps', icon: LayoutGrid }] },
  { group: 'Progress', items: [{ to: '/progress', label: 'Degree path', icon: TrendingUp }, { to: '/progress/degree', label: 'Requirements', icon: GraduationCap }, { to: '/progress/graduate', label: 'Graduate milestones', icon: ScrollText }, { to: '/progress/grades', label: 'Grades', icon: Award }] },
  { group: 'You', items: [{ to: '/you/account', label: 'Tuition & payments', icon: Receipt }, { to: '/you', label: 'Privacy & data', icon: Shield }] },
];
const STAFF_NAV: { to: string; label: string; icon: typeof Sun; roles: string[]; action: string }[] = [
  { to: '/staff/gradebook', label: 'Gradebook', icon: Table2, roles: ['Faculty'], action: 'grade.write' },
  { to: '/staff/queue', label: 'Grading queue', icon: Inbox, roles: ['Faculty', 'Tutor'], action: 'teaching.queue' },
  { to: '/staff/regrades', label: 'Regrade queue', icon: Scale, roles: ['Faculty', 'Staff', 'Administrator'], action: 'regrade.decide' },
  { to: '/staff/shared', label: 'Shared with me', icon: Share2, roles: ['Advisor'], action: 'caseload.read' },
  { to: '/staff/registrar', label: 'Registrar desk', icon: ClipboardCheck, roles: ['Staff', 'Administrator'], action: 'registrar.read' },
  { to: '/staff/calendar', label: 'Academic calendar', icon: CalendarDays, roles: ['Staff', 'Administrator'], action: 'registrar.read' },
  { to: '/staff/holds', label: 'Registration holds', icon: Ban, roles: ['Staff', 'Administrator'], action: 'registration.request.decide' },
  { to: '/staff/analytics', label: 'Analytics', icon: BarChart3, roles: ['Staff', 'Administrator'], action: 'readiness.read' },
  { to: '/staff/accounts', label: 'Student accounts', icon: Receipt, roles: ['Staff', 'Administrator'], action: 'accounts.read' },
  { to: '/staff/affairs', label: 'Support requests', icon: HeartHandshake, roles: ['Staff', 'Administrator', 'Advisor'], action: 'caseload.read' },
  { to: '/staff/mentoring', label: 'Mentoring', icon: MessageSquare, roles: ['Alumni'], action: 'mentoring.offer' },
  { to: '/staff/admissions', label: 'Admissions', icon: HeartHandshake, roles: ['Staff', 'Administrator'], action: 'admission.decide' },
];
const TABS = [{ to: '/today', label: 'Today', icon: Sun }, { to: '/progress', label: 'My path', icon: TrendingUp }, { to: '#search', label: 'Search', icon: Search }, { to: '/plan', label: 'Plan', icon: CalendarDays }, { to: '/you', label: 'Me', icon: Shield }];
const AREA: Record<string, string> = { today: 'Today', plan: 'Plan', learn: 'Learn', help: 'Help', campus: 'Campus', progress: 'Progress', you: 'You', staff: 'Workspace' };

function weekOfTerm() {
  const start = new Date('2026-08-24');
  return Math.max(1, Math.ceil((Date.now() - start.getTime()) / (7 * 864e5)));
}

export default function Shell() {
  const { membership, role, setRole } = useWorkspace();
  // Pages a member's approved role templates unlock that their current role workspace doesn't already show.
  const assigned = STAFF_NAV.filter((i) => !i.roles.includes(role) && (membership.templateActions ?? []).includes(i.action));
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((o) => !o); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
  const area = AREA[loc.pathname.split('/')[1]] ?? 'Today';
  const staffScope = role !== 'Student';

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar px-3 py-4 text-sm text-sidebar-foreground md:flex">
        <p className="mb-4 px-2 font-display tracking-[0.3em] text-sidebar-accent-foreground">SEMESTER</p>
        <DropdownMenu>
          <DropdownMenuTrigger className="mb-4 flex w-full items-center gap-2 rounded-[3px] bg-sidebar-accent px-2 py-2 text-left text-xs">
            <Building2 className="h-3.5 w-3.5" strokeWidth={1.5} /><span className="flex-1 truncate">{membership.institutionName} · {role}</span>▾
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Switch role workspace</DropdownMenuLabel>
            {membership.roles.map((r) => <DropdownMenuItem key={r} onClick={() => setRole(r)}>{r === role ? '● ' : '○ '}{r}</DropdownMenuItem>)}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => logout()}><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <nav className="flex-1 space-y-3">
          {NAV.map((g) => (
            <div key={g.group ?? 'top'}>
              {g.group && <p className="mb-1 px-2 font-display text-[11px] uppercase tracking-[0.18em] opacity-50">{g.group}</p>}
              {g.items.map((i) => (
                <NavLink key={i.to} to={i.to} end className={({ isActive }) => cn('flex items-center gap-2 rounded-[3px] border-l-2 border-transparent px-2 py-1.5 transition-colors duration-150 hover:bg-sidebar-accent', isActive && 'border-sidebar-primary bg-sidebar-accent font-medium text-sidebar-accent-foreground')}>
                  <i.icon className="h-4 w-4" strokeWidth={1.5} />{i.label}
                </NavLink>
              ))}
            </div>
          ))}
          {assigned.length > 0 && (
            <div>
              <p className="mb-1 px-2 font-display text-[11px] uppercase tracking-[0.18em] opacity-50">Assigned tools</p>
              {assigned.map((i) => (
                <NavLink key={i.to} to={i.to} className={({ isActive }) => cn('flex items-center gap-2 rounded-[3px] border-l-2 border-transparent px-2 py-1.5 transition-colors duration-150 hover:bg-sidebar-accent', isActive && 'border-sidebar-primary bg-sidebar-accent font-medium text-sidebar-accent-foreground')}>
                  <i.icon className="h-4 w-4" strokeWidth={1.5} />{i.label}
                </NavLink>
              ))}
            </div>
          )}
          {STAFF_NAV.some((i) => i.roles.includes(role)) && (
            <div>
              <p className="mb-1 px-2 font-display text-[11px] uppercase tracking-[0.18em] opacity-50">{role} workspace</p>
              {STAFF_NAV.filter((i) => i.roles.includes(role)).map((i) => (
                <NavLink key={i.to} to={i.to} className={({ isActive }) => cn('flex items-center gap-2 rounded-[3px] border-l-2 border-transparent px-2 py-1.5 transition-colors duration-150 hover:bg-sidebar-accent', isActive && 'border-sidebar-primary bg-sidebar-accent font-medium text-sidebar-accent-foreground')}>
                  <i.icon className="h-4 w-4" strokeWidth={1.5} />{i.label}
                </NavLink>
              ))}
            </div>
          )}
        </nav>
        {role === 'Administrator' && <Link to="/console" className="mt-4 rounded-[3px] border border-sidebar-border px-2 py-2 text-xs hover:bg-sidebar-accent">Open Institution Console →</Link>}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-2.5 text-sm backdrop-blur md:px-8">
          <span className="hidden truncate text-muted-foreground sm:block">{area} · Fall 2026 · Week {weekOfTerm()}</span>
          <button onClick={() => setOpen(true)} className="mx-auto flex w-full max-w-sm items-center gap-2 rounded-[3px] border border-input bg-card px-3 py-1.5 text-left font-sans text-muted-foreground">
            <Search className="h-4 w-4" strokeWidth={1.5} /><span className="flex-1">Search</span><kbd className="font-mono text-[11px]">⌘K</kbd>
          </button>
          <span className="hidden whitespace-nowrap text-xs text-muted-foreground lg:block">○ Connectors off · {membership.isSample ? '◌ Sample data' : 'Live'}</span>
          <Link to="/today/notifications" aria-label="Notifications" className="rounded-[3px] p-1.5 text-muted-foreground hover:bg-accent"><Bell className="h-4 w-4" strokeWidth={1.5} /></Link>
        </header>
        {staffScope && <div className="border-b border-border bg-accent px-4 py-1.5 text-xs text-accent-foreground md:px-8">Scope: {membership.institutionName} · {role} workspace · Every record view is logged</div>}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 md:px-8 md:pb-10"><Outlet /></main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-sidebar-border bg-sidebar text-sidebar-foreground md:hidden">
        {TABS.map((t) => t.to === '#search'
          ? <button key={t.label} onClick={() => setOpen(true)} className="flex flex-col items-center gap-0.5 py-2 text-[11px]"><t.icon className="h-5 w-5" strokeWidth={1.5} />{t.label}</button>
          : <NavLink key={t.to} to={t.to} end className={({ isActive }) => cn('flex flex-col items-center gap-0.5 py-2 text-[11px]', isActive && 'text-sidebar-primary')}><t.icon className="h-5 w-5" strokeWidth={1.5} />{t.label}</NavLink>)}
      </nav>
      <CommandPalette open={open} onOpenChange={setOpen} />
    </div>
  );
}
