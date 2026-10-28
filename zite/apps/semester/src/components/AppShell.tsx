import { ReactNode, useEffect, useMemo, useState } from 'react';
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { Building2, LogOut, Search, Bell, type LucideIcon } from 'lucide-react';
import { logout } from 'zitejs/auth';
import { cn } from '@project/components/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@project/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Input } from '@project/components/ui/input';
import { Wordmark } from '@project/components/brand/Mark';
import { AppSwitcher } from './AppSwitcher';

// One Semester shell for every app (owner PDFs 28 Oct: "build a shared shell, not three imitations"). It is the Student
// shell's layout and tokens — dark rail, wordmark, institution/role selector, grouped navigation, top bar with term context,
// search and notifications, scope bar, app launcher — driven by a per-app navigation manifest. The manifest only decides what
// is shown; every page still authorizes on the server.
export type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean; hint?: string };
export type NavGroup = { group: string | null; items: NavItem[] };

const termWeek = () => Math.max(1, Math.ceil((Date.now() - new Date('2026-08-24').getTime()) / (7 * 864e5)));
const linkCls = ({ isActive }: { isActive: boolean }) => cn('flex items-center gap-2 rounded-[3px] border-l-2 border-transparent px-2 py-1.5 transition-colors duration-150 hover:bg-sidebar-accent',
  isActive && 'border-sidebar-primary bg-sidebar-accent text-sidebar-accent-foreground');

/** "All workspaces": search every destination this person's manifest offers, so the rail can stay short. */
function Finder({ open, onOpenChange, groups }: { open: boolean; onOpenChange: (o: boolean) => void; groups: NavGroup[] }) {
  const [q, setQ] = useState('');
  const nav = useNavigate();
  const all = groups.flatMap((g) => g.items.map((i) => ({ ...i, group: g.group ?? 'Daily' })));
  const hits = all.filter((i) => `${i.label} ${i.group} ${i.hint ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setQ(''); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Go to</DialogTitle></DialogHeader>
        <Input autoFocus aria-label="Search destinations" placeholder="Search your workspaces" value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && hits[0]) { nav(hits[0].to); onOpenChange(false); } }} />
        <ul className="mt-2 max-h-80 overflow-y-auto text-sm" role="listbox" aria-label="Destinations">
          {hits.length === 0 ? <li className="px-2 py-3 text-muted-foreground">Nothing matches. Destinations appear here only when your role includes them.</li>
            : hits.map((i) => (
              <li key={i.to}><button type="button" className="flex w-full items-center gap-2 rounded-[3px] px-2 py-2 text-left hover:bg-accent" onClick={() => { nav(i.to); onOpenChange(false); }}>
                <i.icon className="h-4 w-4" strokeWidth={1.5} /><span className="flex-1">{i.label}</span><span className="text-xs text-muted-foreground">{i.group}</span></button></li>))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

export function AppShell({ app, appKey, institutionName, role, roles, onRole, isSample, groups, tabs, notificationsTo, children }: {
  app: string; appKey: Parameters<typeof AppSwitcher>[0]['current']; institutionName: string; role: string; roles: string[]; onRole?: (r: string) => void;
  isSample: boolean; groups: NavGroup[]; tabs?: NavItem[]; notificationsTo?: string; children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((o) => !o); } };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, []);
  const here = useMemo(() => groups.flatMap((g) => g.items).filter((i) => (i.end ? loc.pathname === i.to : loc.pathname.startsWith(i.to))).sort((a, b) => b.to.length - a.to.length)[0], [groups, loc.pathname]);
  const mobile = (tabs ?? groups.flatMap((g) => g.items)).slice(0, 4);
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar px-3 py-4 text-sm text-sidebar-foreground md:flex">
        <p className="mb-1 px-2 text-base text-sidebar-accent-foreground"><Wordmark /></p>
        <p className="mb-3 px-2 text-[11px] uppercase tracking-[0.18em] opacity-60">{app}</p>
        <DropdownMenu>
          <DropdownMenuTrigger className="mb-4 flex w-full items-center gap-2 rounded-[3px] bg-sidebar-accent px-2 py-2 text-left text-xs">
            <Building2 className="h-3.5 w-3.5" strokeWidth={1.5} /><span className="flex-1 truncate">{institutionName || 'No institution'} · {role}</span>▾
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {roles.length > 1 && onRole && <><DropdownMenuLabel>Switch role</DropdownMenuLabel>
              {roles.map((r) => <DropdownMenuItem key={r} onClick={() => onRole(r)}>{r === role ? '● ' : '○ '}{r}</DropdownMenuItem>)}<DropdownMenuSeparator /></>}
            <DropdownMenuItem onClick={() => logout()}><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <nav className="flex-1 space-y-3" aria-label={`${app} navigation`}>
          {groups.filter((g) => g.items.length).map((g) => (
            <div key={g.group ?? 'top'}>
              {g.group && <p className="mb-1 px-2 font-display text-[11px] uppercase tracking-[0.18em] opacity-50">{g.group}</p>}
              {g.items.map((i) => <NavLink key={i.to} to={i.to} end={i.end} className={linkCls}><i.icon className="h-4 w-4" strokeWidth={1.5} />{i.label}</NavLink>)}
            </div>))}
        </nav>
        <button type="button" onClick={() => setOpen(true)} className="mt-4 rounded-[3px] border border-sidebar-border px-2 py-2 text-left text-xs hover:bg-sidebar-accent">All workspaces… <kbd className="float-right font-mono opacity-60">⌘K</kbd></button>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-2.5 text-sm backdrop-blur md:px-8">
          <span className="hidden truncate text-muted-foreground sm:block">{here?.label ?? app} · Fall 2026 · Week {termWeek()}</span>
          <button type="button" onClick={() => setOpen(true)} className="mx-auto flex w-full max-w-sm items-center gap-2 rounded-[3px] border border-input bg-card px-3 py-1.5 text-left font-sans text-muted-foreground">
            <Search className="h-4 w-4" strokeWidth={1.5} /><span className="flex-1">Search</span><kbd className="font-mono text-[11px]">⌘K</kbd>
          </button>
          <span className="hidden whitespace-nowrap text-xs text-muted-foreground lg:block">{isSample ? '◌ Sample data' : 'Live'}</span>
          {notificationsTo && <Link to={notificationsTo} aria-label="Notifications" className="rounded-[3px] p-1.5 text-muted-foreground hover:bg-accent"><Bell className="h-4 w-4" strokeWidth={1.5} /></Link>}
        </header>
        <div className="border-b border-border bg-accent px-4 py-1.5 text-xs text-accent-foreground md:px-8">Scope: {institutionName || 'No institution'} · {role} · {app} · Every record view is logged</div>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 md:px-8 md:pb-10">{children}</main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-sidebar-border bg-sidebar text-sidebar-foreground md:hidden" aria-label="Main">
        {mobile.map((t) => <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => cn('flex flex-col items-center gap-0.5 py-2 text-[11px]', isActive && 'text-sidebar-primary')}><t.icon className="h-5 w-5" strokeWidth={1.5} />{t.label.split(' ')[0]}</NavLink>)}
        <button type="button" onClick={() => setOpen(true)} className="flex flex-col items-center gap-0.5 py-2 text-[11px]"><Search className="h-5 w-5" strokeWidth={1.5} />More</button>
      </nav>
      <Finder open={open} onOpenChange={setOpen} groups={groups} />
      <AppSwitcher current={appKey} />
    </div>
  );
}
