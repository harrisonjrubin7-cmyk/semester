import { ReactNode, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { cn } from '@project/components/lib/utils';
import { Button } from '@project/components/ui/button';
import { Wordmark } from '@project/components/brand/Mark';

const NAV = [
  { to: '/pilot', label: 'Pilot' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/trust', label: 'Trust' },
  { to: '/updates', label: 'Updates' },
  { to: '/mission', label: 'Mission' },
  { to: '/contact', label: 'Contact' },
];

export function Mark({ className }: { className?: string }) {
  return <span className={cn('text-lg text-foreground', className)}><Wordmark /></span>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="eyebrow text-[hsl(var(--editorial))]">{children}</p>;
}

export function Section({ eyebrow, title, intro, children, id }: { eyebrow?: string; title: string; intro?: ReactNode; children?: ReactNode; id?: string }) {
  return (
    <section id={id} className="border-t border-border py-14">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h2 className="mt-2 max-w-3xl text-balance text-3xl leading-tight sm:text-4xl">{title}</h2>
        {intro && <div className="mt-3 max-w-2xl text-base text-muted-foreground">{intro}</div>}
        {children && <div className="mt-8">{children}</div>}
      </div>
    </section>
  );
}

export function PageTitle({ eyebrow, title, intro }: { eyebrow: string; title: string; intro?: ReactNode }) {
  return (
    <header className="mx-auto max-w-5xl px-4 pb-10 pt-14 sm:px-6">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="mt-2 max-w-3xl text-balance text-4xl leading-tight sm:text-5xl">{title}</h1>
      {intro && <div className="mt-4 max-w-2xl text-lg text-muted-foreground">{intro}</div>}
    </header>
  );
}

/** Status chip that always pairs colour with a word (never colour alone). */
export function StatusWord({ value }: { value: 'In place' | 'Verified in test' | 'In progress' | 'Not yet in place' | 'Planned' }) {
  const glyph = { 'In place': '✓', 'Verified in test': '✓', 'In progress': '◐', 'Not yet in place': '○', Planned: '○' }[value];
  const tone = value === 'Verified in test' || value === 'In place' ? 'text-[hsl(var(--chart-2))]' : 'text-muted-foreground';
  return <span className={cn('whitespace-nowrap text-sm font-medium', tone)}><span aria-hidden>{glyph}</span> {value}</span>;
}

export default function Layout() {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [loc.pathname]);
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-[3px] focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">Skip to content</a>
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" aria-label="Semester home"><Mark /></Link>
          <nav aria-label="Main" className="hidden items-center gap-6 md:flex">
            {NAV.map((n) => <NavLink key={n.to} to={n.to} className={({ isActive }) => cn('text-sm hover:text-foreground', isActive ? 'font-medium text-foreground' : 'text-muted-foreground')}>{n.label}</NavLink>)}
            <Button asChild size="sm"><Link to="/pilot/request">Request a pilot</Link></Button>
          </nav>
          <button className="inline-flex h-11 w-11 items-center justify-center rounded-[3px] md:hidden" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen(!open)}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {open && (
          <nav id="mobile-nav" aria-label="Main" className="border-t border-border px-4 pb-4 md:hidden">
            <ul className="flex flex-col">{NAV.map((n) => <li key={n.to}><NavLink to={n.to} className="block py-3 text-base">{n.label}</NavLink></li>)}</ul>
            <Button asChild className="mt-2 w-full"><Link to="/pilot/request">Request a pilot</Link></Button>
          </nav>
        )}
      </header>
      <main id="main" className="flex-1"><Outlet /></main>
      <footer className="border-t border-border bg-card">
        <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 text-sm sm:grid-cols-4 sm:px-6">
          <div className="sm:col-span-2">
            <Mark className="text-base" />
            <p className="mt-2 max-w-sm text-muted-foreground">One clear next step for every student. Your official systems stay official.</p>
          </div>
          <div><p className="eyebrow">Product</p><ul className="mt-2 space-y-1.5"><li><Link to="/pilot" className="hover:underline">Registration Readiness Pilot</Link></li><li><Link to="/pricing" className="hover:underline">Pricing</Link></li><li><Link to="/pricing#compare" className="hover:underline">Feature comparison</Link></li></ul></div>
          <div><p className="eyebrow">Company</p><ul className="mt-2 space-y-1.5"><li><Link to="/trust" className="hover:underline">Trust</Link></li><li><Link to="/mission" className="hover:underline">Mission</Link></li><li><Link to="/contact" className="hover:underline">Contact</Link></li></ul></div>
        </div>
        <p className="mx-auto max-w-5xl px-4 pb-8 text-xs text-muted-foreground sm:px-6">Terms of Service, Privacy Policy and Data Processing Addendum are drafts under counsel review and are available on request through Contact. © {new Date().getFullYear()} Semester.</p>
      </footer>
    </div>
  );
}
