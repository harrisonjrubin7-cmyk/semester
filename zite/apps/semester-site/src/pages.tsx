import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { trustCenter } from 'zitejs/api';
import { Skeleton } from '@project/components/ui/skeleton';
import { Button } from '@project/components/ui/button';
import { cn } from '@project/components/lib/utils';
import { Eyebrow, PageTitle, Section, StatusWord, useDocTitle } from './Layout';
import RequestForm from './RequestForm';

// Copy follows the Semester books (GTM copy, objections, personas) and two rules from them:
// "Status, not certifications" and "every public claim or number needs a source".
// Planning prices are assumptions, not quotes, so no price is published. No customer is named.

const Check = ({ children }: { children: React.ReactNode }) => <li className="flex gap-2"><span aria-hidden className="text-primary">✓</span><span>{children}</span></li>;

export function Home() {
  useDocTitle(null);
  return (
    <>
      <header className="mx-auto max-w-5xl px-4 pb-16 pt-16 sm:px-6 sm:pt-24">
        <Eyebrow>For universities and their students</Eyebrow>
        <h1 className="font-editorial mt-3 max-w-3xl text-balance text-4xl leading-[1.1] sm:text-6xl">One clear next step for every student.</h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">Semester turns the semester into the next thing to do, and shows where each fact came from. Your current systems stay authoritative until each area is verified, reconciled and authorized to move.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg"><Link to="/pilot/request">Request a pilot design session</Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/pilot">How the pilot works</Link></Button>
        </div>
      </header>

      <Section eyebrow="What students get" title="The next thing to do, with its source" intro="Students see what needs them today, why, and who can help, in one calm place.">
        <div className="grid gap-px overflow-hidden rounded-[3px] border border-border bg-border sm:grid-cols-3">
          {[
            ['Today', 'Deadlines, holds and approvals that need the student, each labelled Official, Connected, Yours or Sample.'],
            ['Registration readiness', 'Holds, missing prerequisites and time conflicts surface weeks before the registration window, with the office that can fix each one.'],
            ['Help that knows the rules', 'Advising and support booking, and an assistant that follows each course’s AI rules and cites its sources.'],
          ].map(([t, d]) => <div key={t} className="bg-card p-6"><h3 className="text-xl">{t}</h3><p className="mt-2 text-sm text-muted-foreground">{d}</p></div>)}
        </div>
      </Section>

      <Section eyebrow="How it fits" title="It sits on top of what you have" intro="Nothing is replaced in a pilot. Semester reads approved records, works out what is ready and what is blocked, and hands official actions back to the office that owns them.">
        <ol className="grid gap-3 sm:grid-cols-5">
          {['Your student information system stays authoritative', 'Semester reads only the fields you approve', 'Deterministic checks show what is ready or blocked', 'The student gets one next step and who can help', 'Official changes go back to the owning office'].map((s, i) => (
            <li key={s} className="rounded-[3px] border border-border bg-card p-4 text-sm"><span className="font-mono text-xs text-muted-foreground">{i + 1}</span><p className="mt-1">{s}</p></li>
          ))}
        </ol>
      </Section>

      <Section eyebrow="Questions institutions ask" title="Straight answers">
        <dl className="divide-y divide-border border-y border-border">
          {[
            ['We already have a portal.', 'Semester sits on top of it and turns its data into a next step. Nothing is replaced in the pilot.'],
            ['Our advisors are overloaded.', 'Students resolve more on their own. Advisors see only what a student chooses to share with them, not a new inbox.'],
            ['What about AI?', 'Course AI rules are enforced before anything is read, answers are labelled and cited, and student records never reach an AI provider.'],
            ['Will it change official records?', 'No. Your SIS stays authoritative. Semester labels what it works out itself and hands official actions to your offices.'],
            ['You are a small company.', 'Insurance, a data processing addendum, security questionnaire answers and exit and export terms belong in the contract. See Trust for what is in place today and what is not yet.'],
          ].map(([q, a]) => <div key={q} className="grid gap-1 py-4 sm:grid-cols-[1fr_2fr] sm:gap-6"><dt className="font-display text-lg">{q}</dt><dd className="text-muted-foreground">{a}</dd></div>)}
        </dl>
      </Section>
    </>
  );
}

export function Pilot() {
  return (
    <>
      <PageTitle eyebrow="Registration Readiness Pilot" title="One term. One cohort. Measures agreed before day one." intro="The pilot targets students surprised by holds and missed registration steps, and the advisors who catch them too late." />
      <Section eyebrow="Scope" title="What a pilot covers">
        <div className="grid gap-6 sm:grid-cols-2">
          <div><h3 className="text-xl">For students</h3><ul className="mt-3 space-y-2 text-sm"><Check>Today: holds, deadlines and approvals in one list</Check><Check>Registration readiness: holds, prerequisites and conflicts checked before the window</Check><Check>Advising: book time, share a plan with an advisor, see every view of it</Check><Check>Ask Semester, following each course’s AI rules</Check></ul></div>
          <div><h3 className="text-xl">For staff</h3><ul className="mt-3 space-y-2 text-sm"><Check>Registrar enrollment queue and override approvals (two-person rule)</Check><Check>Advisors see only what students share with them</Check><Check>Instructor and Registrar regrade queue</Check><Check>Institution console: memberships, roles, audit log</Check></ul></div>
        </div>
      </Section>
      <Section eyebrow="What stays the same" title="Your systems stay official" intro="During the pilot Semester reads; it does not write back. Enrollment, grades and holds remain the institution’s records. A request sent from Semester is a request, not a registration.">
      </Section>
      <Section eyebrow="Before a pilot starts" title="What Semester completes first" intro="These are the contract and readiness items a pilot needs. Their current status is on the Trust page.">
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          {['Data processing / FERPA addendum, reviewed by counsel', 'Higher-education security questionnaire (HECVAT Full)', 'Accessibility conformance report', 'University single sign-on (SAML)', 'Cyber liability and E&O insurance', 'Signed success-measures sheet with a baseline'].map((x) => <li key={x} className="rounded-[3px] border border-border bg-card px-4 py-3">{x}</li>)}
        </ul>
        <p className="mt-4 text-sm"><Link to="/trust" className="text-primary underline">See current status on the Trust page →</Link></p>
      </Section>
      <Section eyebrow="Start" title="Request a pilot design session">
        <Button asChild size="lg"><Link to="/pilot/request">Request a pilot</Link></Button>
      </Section>
    </>
  );
}

export function PilotRequest() {
  return (
    <>
      <PageTitle eyebrow="Registration Readiness Pilot" title="Request a pilot design session" intro="Tell us about your institution and the students you want to help. We reply personally; there is no automated sequence." />
      <div className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
        <RequestForm kind="Pilot request" messageLabel="Which students, and what goes wrong for them today?" messagePlaceholder="e.g. First-year students who miss advising holds before the spring registration window." />
      </div>
    </>
  );
}

const PLANS = [
  { name: 'Student', for: 'An individual student, without an institution agreement.', covers: 'Personal planning: Today, tasks, calendar, notes and study tools.' },
  { name: 'Department', for: 'One department or program.', covers: 'Course spaces, gradebook and regrades, and advising for that department’s students.' },
  { name: 'Institution', for: 'A college or university.', covers: 'Everything above, plus registration readiness from official records, the Registrar queue and the Institution Console.' },
  { name: 'Enterprise', for: 'Systems and multi-campus groups.', covers: 'Institution coverage across several campuses, with central administration.' },
];
const ROWS: [string, string, string[]][] = [
  ['Personal planning: Today, tasks, calendar, notes, study', 'Available in this build', ['✓', '✓', '✓', '✓']],
  ['Ask Semester with course AI rules and cited sources', 'Available in this build', ['✓', '✓', '✓', '✓']],
  ['Course spaces, gradebook, regrade queue', 'Available in this build', ['—', '✓', '✓', '✓']],
  ['Advising with student-controlled sharing', 'Available in this build', ['Share only', '✓', '✓', '✓']],
  ['Registration readiness from official records', 'Needs an authorized SIS connection', ['—', '—', '✓', '✓']],
  ['Registrar enrollment queue and overrides', 'Available in this build', ['—', '—', '✓', '✓']],
  ['Institution Console: memberships, roles, audit', 'Available in this build', ['—', '—', '✓', '✓']],
  ['University single sign-on (SAML)', 'Not yet available', ['—', '—', 'Planned', 'Planned']],
  ['Multi-campus administration', 'Not yet available', ['—', '—', '—', 'Planned']],
];

export function Pricing() {
  return (
    <>
      <PageTitle eyebrow="Pricing" title="Priced after the pilot, not before" intro="A pilot is quoted per institution for one term. Annual pricing for each plan is set from pilot results, so we don’t publish planning numbers as prices." />
      <Section eyebrow="Plans" title="Four plan types">
        <div className="grid gap-px overflow-hidden rounded-[3px] border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((p) => (
            <div key={p.name} className="flex flex-col bg-card p-6">
              <h3 className="text-2xl">{p.name}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{p.for}</p>
              <p className="mt-3 text-sm">{p.covers}</p>
              <p className="mt-auto pt-5 text-sm font-medium">Price on request</p>
            </div>
          ))}
        </div>
      </Section>
      <Section id="compare" eyebrow="Feature comparison" title="What each plan type is designed to cover" intro="Final plan contents are set with pilot results. The second column says whether a capability exists in the current build.">
        <div className="overflow-x-auto rounded-[3px] border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">Capabilities by plan type</caption>
            <thead className="bg-card"><tr className="text-left"><th scope="col" className="p-3">Capability</th><th scope="col" className="p-3">Today</th>{PLANS.map((p) => <th key={p.name} scope="col" className="p-3 text-center">{p.name}</th>)}</tr></thead>
            <tbody>{ROWS.map(([cap, now, marks]) => (
              <tr key={cap} className="border-t border-border"><th scope="row" className="p-3 text-left font-normal">{cap}</th><td className="p-3 text-xs text-muted-foreground">{now}</td>
                {marks.map((m, i) => <td key={i} className="p-3 text-center">{m === '✓' ? <><span aria-hidden>✓</span><span className="sr-only">Included</span></> : m === '—' ? <><span aria-hidden>—</span><span className="sr-only">Not included</span></> : m}</td>)}</tr>))}</tbody>
          </table>
        </div>
      </Section>
      <Section eyebrow="Talk to us" title="Request pricing">
        <div className="max-w-3xl"><RequestForm kind="Pricing request" messageLabel="Which plan type, and roughly how many students?" /></div>
      </Section>
    </>
  );
}

// ---------- Trust (live from Neon via trustCenter) ----------
type Trust = {
  controls: { section: string; control: string; status: 'In place' | 'Verified in test' | 'In progress' | 'Not yet in place'; detail: string; reviewedOn: string }[];
  subprocessors: { name: string; purpose: string; addedOn: string }[];
  notices: { title: string; state: string; body: string; postedAt: string }[];
};
let cache: Promise<Trust> | null = null;
function useTrust() {
  const [d, setD] = useState<Trust | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => { (cache ??= (trustCenter({}) as unknown as Promise<Trust>).catch((e) => { cache = null; throw e; })).then(setD, () => setErr(true)); }, []);
  return { d, err };
}
const fmt = (iso: string) => iso ? new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

function Loading({ err }: { err: boolean }) {
  if (err) return <p role="alert" className="text-sm text-destructive">! The trust status couldn’t load. Refresh to try again.</p>;
  return <div className="space-y-2" aria-busy="true">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
}

function StatusTable({ section, caption }: { section: string; caption: string }) {
  const { d, err } = useTrust();
  if (!d) return <Loading err={err} />;
  const rows = d.controls.filter((c) => c.section === section);
  const latest = rows.reduce((m, r) => (r.reviewedOn > m ? r.reviewedOn : m), '');
  return (
    <>
      <div className="overflow-x-auto rounded-[3px] border border-border">
        <table className="w-full min-w-[560px] text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-card"><tr className="text-left"><th scope="col" className="p-3">Control</th><th scope="col" className="p-3">Status</th><th scope="col" className="p-3">Detail</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.control} className="border-t border-border align-top"><th scope="row" className="p-3 text-left font-medium">{r.control}</th><td className="p-3"><StatusWord value={r.status} /></td><td className="p-3 text-muted-foreground">{r.detail || '—'}</td></tr>)}</tbody>
        </table>
      </div>
      {latest && <p className="mt-2 text-xs text-muted-foreground">Last reviewed {fmt(latest)}.</p>}
    </>
  );
}

const TRUST_NAV = [['/trust/security', 'Security'], ['/trust/privacy', 'Privacy'], ['/trust/accessibility', 'Accessibility'], ['/trust/responsible-ai', 'Responsible AI'], ['/trust/status', 'Status']];

export function TrustLayout() {
  return (
    <>
      <PageTitle eyebrow="Trust" title="What is verified, and what isn’t yet" intro="We state status, never a certification we don’t hold. “Verified in test” means checked with synthetic data before any pilot; nothing here is running with real student records yet. Anything else is not done." />
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <nav aria-label="Trust sections" className="flex flex-wrap gap-2 border-b border-border pb-3">
          {TRUST_NAV.map(([to, l]) => <NavLink key={to} to={to} className={({ isActive }) => cn('rounded-[3px] px-3 py-2 text-sm', isActive ? 'bg-accent font-medium text-accent-foreground' : 'text-muted-foreground hover:bg-accent/60')}>{l}</NavLink>)}
        </nav>
      </div>
      <div className="mx-auto max-w-5xl px-4 pb-16 pt-8 sm:px-6"><Outlet /></div>
    </>
  );
}
const SECTION_OF: Record<string, string> = { '/trust/security': 'security', '/trust/privacy': 'privacy', '/trust/accessibility': 'accessibility', '/trust/responsible-ai': 'ai' };
export function TrustOverview() {
  const { d } = useTrust();
  const summary = (section?: string) => {
    if (!section) return d ? (d.notices.length ? `${d.notices.length} notice${d.notices.length > 1 ? 's' : ''} in the last 90 days` : 'No public incidents in the last 90 days') : 'Loading…';
    if (!d) return 'Loading…';
    const rows = d.controls.filter((c) => c.section === section);
    return `${rows.filter((r) => r.status === 'Verified in test' || r.status === 'In place').length} of ${rows.length} controls verified`;
  };
  return (
    <div className="grid gap-px overflow-hidden rounded-[3px] border border-border bg-border sm:grid-cols-2">
      {TRUST_NAV.map(([to, l]) => <Link key={to} to={to} className="bg-card p-6 hover:bg-accent/40"><h2 className="text-2xl">{l}</h2><p className="mt-1 text-sm text-muted-foreground">{summary(SECTION_OF[to])} →</p></Link>)}
    </div>
  );
}
export const TrustSecurity = () => (<><h2 className="mb-4 text-3xl">Security</h2><StatusTable section="security" caption="Security controls and status" /><div className="mt-10 max-w-3xl"><h3 className="mb-3 text-xl">Request security documents</h3><RequestForm kind="Security document request" messageLabel="Which documents do you need?" /></div></>);
function Subprocessors() {
  const { d, err } = useTrust();
  if (!d) return <Loading err={err} />;
  return <ul className="divide-y divide-border rounded-[3px] border border-border text-sm">{d.subprocessors.map((s) => <li key={s.name} className="grid gap-1 p-3 sm:grid-cols-[200px_1fr_auto]"><span className="font-medium">{s.name}</span><span className="text-muted-foreground">{s.purpose}</span><span className="text-xs text-muted-foreground">Since {fmt(s.addedOn)}</span></li>)}</ul>;
}
export const TrustPrivacy = () => (
  <>
    <h2 className="mb-4 text-3xl">Privacy</h2><StatusTable section="privacy" caption="Privacy controls and status" />
    <h3 className="mb-3 mt-10 text-xl">Subprocessors for this deployment</h3>
    <Subprocessors />
  </>
);
export const TrustAccessibility = () => (<><h2 className="mb-4 text-3xl">Accessibility</h2><StatusTable section="accessibility" caption="Accessibility status" /><div className="mt-10 max-w-3xl"><h3 className="mb-3 text-xl">Tell us about a barrier</h3><RequestForm kind="Accessibility feedback" messageLabel="What happened, and where?" /></div></>);
export const TrustAI = () => (<><h2 className="mb-4 text-3xl">Responsible AI</h2><StatusTable section="ai" caption="AI controls and status" /></>);
export function TrustStatus() {
  const { d, err } = useTrust();
  return (
    <>
      <h2 className="mb-2 text-3xl">Status and incident notices</h2>
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">Notices appear here only after two people at Semester approve the exact wording. We show the last 90 days.</p>
      {!d ? <Loading err={err} /> : d.notices.length === 0
        ? <div role="status" className="rounded-[3px] border border-border bg-card p-6"><p className="font-medium">No public incidents in the last 90 days.</p></div>
        : <ol className="space-y-3">{d.notices.map((n, i) => <li key={i} className="rounded-[3px] border border-border bg-card p-5"><p className="text-xs text-muted-foreground">{fmt(n.postedAt)} · <span className="capitalize">{n.state}</span></p><h3 className="mt-1 text-lg font-medium">{n.title}</h3><p className="mt-2 whitespace-pre-line text-sm">{n.body}</p></li>)}</ol>}
    </>
  );
}

export function Mission() {
  return (
    <>
      <PageTitle eyebrow="Mission" title="Make the whole educational journey understandable, actionable and manageable." />
      <Section title="What we want people to feel">
        <dl className="grid gap-px overflow-hidden rounded-[3px] border border-border bg-border sm:grid-cols-3">
          {[['Students', 'I know where I am, what matters next, and what I can do.'], ['Institutions', 'This is controlled, accurate, interoperable, auditable and governable.'], ['The people who run Semester', 'We can run the product and the company without losing visibility, accountability or control.']].map(([w, q]) => <div key={w} className="bg-card p-6"><dt className="eyebrow">{w}</dt><dd className="font-editorial mt-2 text-xl leading-snug">“{q}”</dd></div>)}
        </dl>
      </Section>
      <Section title="How we work" intro="Build core capabilities natively. Integrate responsibly during transition. Replace by domain only with evidence. Operate every domain as one coherent system.">
        <p className="max-w-2xl text-muted-foreground">Semester has to operate with the same coherence, evidence, reliability and trust it promises to institutions.</p>
      </Section>
    </>
  );
}

export function Contact() {
  return (
    <>
      <PageTitle eyebrow="Contact" title="Talk to Semester" intro="Questions about a pilot, pricing, security or accessibility. We reply personally." />
      <div className="mx-auto max-w-3xl px-4 pb-16 sm:px-6"><RequestForm /></div>
    </>
  );
}

export function NotFound() {
  return <PageTitle eyebrow="404" title="That page doesn’t exist" intro={<Link to="/" className="text-primary underline">Go to the home page</Link>} />;
}
