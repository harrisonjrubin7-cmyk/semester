// Homepage (owner source S-94 §3, 13 sections). Every demonstration is synthetic and labelled; nothing on this page reads or
// changes a record. Availability wording is deliberately conservative: Semester is in development and no institution runs it
// in production. Links go only to pages that exist today.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@project/components/ui/button';
import { Eyebrow, Section, useDocTitle } from './Layout';

const DEMO = 'Demonstration — synthetic data, not connected to any student record';
const AVAILABILITY = 'In development. What is verified in test is listed on the Trust pages; nothing here runs with real student records yet.';

type Scenario = { key: string; label: string; situation: string; action: string; why: string; source: string; owner: string; when: string; kind: 'Personal plan' | 'Request' | 'Confirmed outcome'; logic: string };
const SCENARIOS: Scenario[] = [
  { key: 'reg', label: 'Prepare for registration', situation: 'Registration opens in 9 days. One planned course needs advising approval.', action: 'Review your registration checklist',
    why: 'Confirm your planned courses and check whether advising approval is required before your window opens.', source: 'Example advising checklist', owner: 'Your advisor (example)', when: 'Before your registration window', kind: 'Personal plan',
    logic: 'In this demonstration, the checklist rule says a course outside the plan needs approval, so the next step is to review it — not to register. Registration itself stays with the institution’s process.' },
  { key: 'study', label: 'Turn course materials into a study plan', situation: 'A midterm is in two weeks; three readings and one problem set are still open.', action: 'Plan four study sessions from the syllabus',
    why: 'Spreading the open work across the days left keeps any one evening from becoming the whole plan.', source: 'Example course syllabus', owner: 'You', when: 'Sessions before the exam date', kind: 'Personal plan',
    logic: 'The demonstration counts the open items in the sample syllabus and the days until the sample exam. A plan is yours to change; it is not a grade or an official record.' },
  { key: 'support', label: 'Find support and follow the handoff', situation: 'You asked for help with a financial question that advising can’t answer.', action: 'Track your referral to the aid office',
    why: 'The referral shows who accepted it and what happens next, so you are not left guessing whether anyone saw it.', source: 'Example referral record', owner: 'Financial aid office (example)', when: 'Accepted within the office’s stated time', kind: 'Request',
    logic: 'A referral is a request, not an outcome: it becomes a confirmed result only when the receiving office records one. This demonstration does not send a referral.' },
];

const STEPS = [
  { key: 'plan', label: 'Plan', links: 'Requirements and your goals shape which courses make sense next.' },
  { key: 'register', label: 'Register', links: 'A plan becomes a request through the institution’s registration process; the confirmed result is the institution’s.' },
  { key: 'learn', label: 'Learn', links: 'Enrolled courses bring assignments, materials, feedback and deadlines.' },
  { key: 'support', label: 'Get support', links: 'Questions turn into accountable referrals with a named owner.' },
  { key: 'evidence', label: 'Build evidence', links: 'Coursework and experiences become evidence you choose to share.' },
  { key: 'next', label: 'Take the next opportunity', links: 'Shared evidence reaches approved opportunities — and feeds the next plan.' },
];

const FOUNDATIONS: [string, string][] = [
  ['Connected identity', 'Move between eligible experiences with clear role and institution context.'],
  ['Action Center', 'Understand what needs attention, who owns it, and what happens next.'],
  ['Search', 'Find permitted information with understandable sources.'],
  ['Workspace', 'Keep plans, documents, notes, and shared work organized.'],
  ['Education graph', 'Connect courses, requirements, assignments, services, evidence, and opportunities.'],
  ['Policy-controlled AI', 'Use approved information and bounded assistance without giving AI institutional authority.'],
];

const DOMAINS: { title: string; line: string; caps: string[] }[] = [
  { title: 'Academic planning', line: 'See requirements, plans and what-if choices in one place. A plan stays yours until you act on it.', caps: ['Requirement progress', 'What-if plans', 'Transfer credit'] },
  { title: 'Learning and coursework', line: 'Assignments, submissions, feedback and study plans connected to the course. Draft feedback stays private until released.', caps: ['Versioned assignments', 'Submission receipts', 'Released feedback'] },
  { title: 'Registration and records', line: 'Readiness before the window, then the institution’s own process for the authoritative result.', caps: ['Holds and prerequisites', 'Enrollment requests', 'Official grade certification'] },
  { title: 'Advising, tutoring, and support', line: 'Requests reach a named owner and come back with an outcome you can see.', caps: ['Accountable referrals', 'Appointments', 'Accommodation notices'] },
  { title: 'Career and evidence', line: 'Build evidence from your work and share only what you choose with approved employers.', caps: ['Verified evidence', 'Approved opportunities', 'Student-chosen sharing'] },
  { title: 'Campus life and services', line: 'Housing, dining, organizations and services alongside everything else that shapes a term.', caps: ['Housing and dining', 'Organizations', 'Service requests'] },
];

const AUDIENCES: { key: string; label: string; text: string; boundary: string }[] = [
  { key: 'students', label: 'Students', text: 'Connect plans, courses, support, and opportunities.', boundary: 'Your private work stays yours; official records come from the institution.' },
  { key: 'faculty', label: 'Faculty', text: 'Coordinate course preparation, assignments, feedback, and authorized academic handoffs.', boundary: 'Teaching access covers your own sections, not the whole institution.' },
  { key: 'staff', label: 'Advisors and staff', text: 'Manage assigned work and accountable referrals.', boundary: 'Each office sees what its role and assignment allow.' },
  { key: 'institutions', label: 'Institutions', text: 'Govern access, implementation, data authority, and domain activation.', boundary: 'Nothing becomes authoritative until the institution verifies and authorizes it.' },
  { key: 'applicants', label: 'Applicants', text: 'Discover programs, prepare applications, and follow decisions.', boundary: 'Recommendation letters stay confidential from the applicant.' },
  { key: 'families', label: 'Families', text: 'Participate only through permitted, scoped sharing.', boundary: 'A student invites you, chooses what you see and when it ends.' },
  { key: 'employers', label: 'Employers', text: 'Engage with approved opportunities and student-shared evidence.', boundary: 'You see only what a student shares with you, never private academic records.' },
];

const JOURNEY: [string, 'Plan' | 'Request' | 'Authoritative result'][] = [
  ['A student reviews a proposed academic plan.', 'Plan'],
  ['A requirement needs clarification.', 'Plan'],
  ['The student requests advising.', 'Request'],
  ['The advisor reviews authorized information.', 'Request'],
  ['The student updates the personal plan.', 'Plan'],
  ['Registration proceeds through the institution-authorized process.', 'Request'],
  ['The confirmed outcome updates the permitted schedule view.', 'Authoritative result'],
];

const FAQ: [string, string][] = [
  ['What is Semester?', 'An education operating system in development: one connected experience for students and the institutions that support them, from the next task to the systems behind it.'],
  ['Is Semester only a registration tool?', 'No. Registration readiness is one place to start. The direction covers planning, learning, support, careers and campus life.'],
  ['Who is it designed for?', 'Students, faculty, advisors and staff, institutions, applicants, families and employers — each with its own experience and its own limits.'],
  ['How do the different Semester apps connect?', 'Each audience has its own app, and they share one set of records and permissions, so a decision in one place reaches the right people in another without copying data around.'],
  ['Can institutions keep existing systems during transition?', 'Yes. Your current systems stay authoritative. Semester can compare its results with them before anything moves.'],
  ['What does native replacement require?', 'For each area: verified records, permissions and reliability, reconciliation with the current system, and an explicit decision by the institution to switch.'],
  ['Can family members see student information?', 'Only what a student invites them to see, for as long as the student chooses. The student can stop it at any time and sees each time a family member looks.'],
  ['What can the AI do?', 'Help within each course’s AI rules, cite its sources, and never make institutional decisions. Student records are never sent to an AI provider.'],
  ['What is currently available?', 'Semester is in development and is not running in production at any institution. The Trust pages list what has been verified in test with synthetic data.'],
  ['How does a pilot begin?', 'With a design session: we agree one workflow, its owners, the evidence to collect, and how the pilot will be judged.'],
];

const KIND_STYLE: Record<string, string> = { 'Personal plan': 'border-dashed', Request: '', 'Confirmed outcome': 'border-2', 'Authoritative result': 'border-2' };

function ActionCenterDemo() {
  const [k, setK] = useState(SCENARIOS[0].key);
  const s = SCENARIOS.find((x) => x.key === k)!;
  return (
    <div>
      <div role="tablist" aria-label="Demonstration scenarios" className="flex flex-wrap gap-2">
        {SCENARIOS.map((x) => <Button key={x.key} role="tab" aria-selected={x.key === k} size="sm" variant={x.key === k ? 'default' : 'outline'} onClick={() => setK(x.key)}>{x.label}</Button>)}
      </div>
      <div role="tabpanel" aria-label={s.label} className="mt-4 rounded-[3px] border border-border bg-card p-5">
        <p className="text-xs text-muted-foreground">◌ {DEMO}</p>
        <p className="mt-2 text-sm text-muted-foreground">{s.situation}</p>
        <p className="mt-3 font-display text-xl">{s.action}</p>
        <p className="mt-1 text-sm">{s.why}</p>
        <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
          <div><dt className="inline text-muted-foreground">Who owns it: </dt><dd className="inline">{s.owner}</dd></div>
          <div><dt className="inline text-muted-foreground">When: </dt><dd className="inline">{s.when}</dd></div>
          <div><dt className="inline text-muted-foreground">What it is: </dt><dd className={`inline rounded-[3px] border border-border px-1.5 ${KIND_STYLE[s.kind]}`}>{s.kind}</dd></div>
        </dl>
        <details className="mt-3 text-sm"><summary className="cursor-pointer text-primary underline">View source</summary><p className="mt-1">Source: {s.source}. In a real deployment this links to the record the step came from.</p></details>
        <details className="mt-2 text-sm"><summary className="cursor-pointer text-primary underline">Why this action?</summary><p className="mt-1">{s.logic}</p></details>
        <p className="mt-3 text-xs text-muted-foreground">Selecting a scenario changes nothing: no registration, referral or calendar change happens on this page.</p>
      </div>
    </div>
  );
}

function ConnectionMap() {
  const [k, setK] = useState(STEPS[0].key);
  const s = STEPS.find((x) => x.key === k)!;
  return (
    <div>
      <ol className="flex flex-wrap items-center gap-2" aria-label="How the steps connect">
        {STEPS.map((x, i) => <li key={x.key} className="flex items-center gap-2"><Button size="sm" variant={x.key === k ? 'default' : 'outline'} aria-pressed={x.key === k} onClick={() => setK(x.key)}>{x.label}</Button>{i < STEPS.length - 1 && <span aria-hidden className="text-muted-foreground">→</span>}</li>)}
      </ol>
      <p className="mt-3 text-sm" aria-live="polite"><span className="font-medium">{s.label}:</span> {s.links}</p>
      <details className="mt-2 text-sm"><summary className="cursor-pointer text-primary underline">Read all connections as text</summary>
        <ul className="mt-1 list-disc space-y-1 pl-5">{STEPS.map((x) => <li key={x.key}><span className="font-medium">{x.label}</span>: {x.links}</li>)}</ul></details>
    </div>
  );
}

function AudienceExplorer() {
  const [k, setK] = useState(AUDIENCES[0].key);
  const a = AUDIENCES.find((x) => x.key === k)!;
  return (
    <div>
      <div role="tablist" aria-label="Audiences" className="flex flex-wrap gap-2">
        {AUDIENCES.map((x) => <Button key={x.key} role="tab" aria-selected={x.key === k} size="sm" variant={x.key === k ? 'default' : 'outline'} onClick={() => setK(x.key)}>{x.label}</Button>)}
      </div>
      <div role="tabpanel" aria-label={a.label} className="mt-4 rounded-[3px] border border-border bg-card p-5">
        <p className="font-display text-xl">{a.text}</p>
        <p className="mt-2 text-sm text-muted-foreground">Boundary: {a.boundary}</p>
      </div>
    </div>
  );
}

export function Home() {
  useDocTitle(null);
  return (
    <>
      {/* 1 Hero */}
      <header className="mx-auto max-w-5xl px-4 pb-14 pt-12 sm:px-6 sm:pt-16">
        <Eyebrow>The education operating system</Eyebrow>
        <h1 className="font-editorial mt-3 max-w-3xl text-balance text-4xl leading-[1.1] sm:text-6xl">One clear next step. One connected Semester.</h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">Semester is designed to bring planning, learning, registration, support, career development, and campus life into one connected experience — helping students understand what matters next and helping institutions coordinate the work behind it.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg"><Link to="/request-demo">Request a demo</Link></Button>
          <Button asChild size="lg" variant="outline"><a href="#platform">Explore the platform</a></Button>
        </div>
        <p className="mt-3 text-sm"><Link to="/pilot" className="text-primary underline">Start with registration readiness</Link></p>
      </header>

      {/* 2 Action Center preview */}
      <Section eyebrow="Action Center" title="See how the next step becomes clear." intro="Choose a scenario. Each shows the situation, the next action, why it matters, its source, who owns it, and whether it is a plan, a request or a confirmed outcome.">
        <ActionCenterDemo />
      </Section>

      {/* 3 Fragmentation */}
      <Section eyebrow="The problem" title="University life is connected. The tools often aren’t." intro="A course decision affects registration. Registration affects a schedule. A schedule affects work, support, and opportunities. Semester is designed to connect those relationships so students and staff do not have to reconstruct the whole picture themselves.">
        <ConnectionMap />
      </Section>

      {/* 4 Foundations */}
      <div id="platform" />
      <Section eyebrow="Foundation" title="Different responsibilities. One coherent system." intro="These are the platform’s design commitments. Their status is reported on the Trust pages, not assumed here.">
        <div className="grid gap-px overflow-hidden rounded-[3px] border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {FOUNDATIONS.map(([t, d]) => <div key={t} className="bg-card p-5"><h3 className="text-lg">{t}</h3><p className="mt-1 text-sm text-muted-foreground">{d}</p></div>)}
        </div>
      </Section>

      {/* 5 Domains */}
      <Section eyebrow="Domains" title="The whole semester, connected.">
        <div className="grid gap-px overflow-hidden rounded-[3px] border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {DOMAINS.map((d) => (
            <div key={d.title} className="flex flex-col bg-card p-5">
              <h3 className="text-lg">{d.title}</h3><p className="mt-1 text-sm">{d.line}</p>
              <ul className="mt-2 text-sm text-muted-foreground">{d.caps.map((c) => <li key={c}>· {c}</li>)}</ul>
              <p className="mt-auto pt-3 text-xs text-muted-foreground">{AVAILABILITY}</p>
            </div>))}
        </div>
      </Section>

      {/* 6 Audiences */}
      <Section eyebrow="Who it’s for" title="A connected experience for everyone who moves education forward.">
        <AudienceExplorer />
      </Section>

      {/* 7 Journey */}
      <Section eyebrow="One decision" title="Follow one decision across the system." intro="An illustration, not a live workflow. Notice what each step is: a personal plan, a submitted request, or the institution’s authoritative result.">
        <ol className="space-y-2">
          {JOURNEY.map(([t, kind], i) => <li key={t} className={`flex flex-wrap items-center justify-between gap-2 rounded-[3px] border border-border bg-card px-4 py-3 text-sm ${KIND_STYLE[kind]}`}><span><span className="font-mono text-xs text-muted-foreground">{i + 1}</span> {t}</span><span className="text-xs text-muted-foreground">{kind}</span></li>)}
        </ol>
      </Section>

      {/* 8 Native ambition and transition */}
      <Section eyebrow="Transition" title="Build native. Connect responsibly. Replace with proof." intro="Semester’s direction is a unified education platform — not another disconnected layer. Institutions can introduce approved workflows, connect existing systems during transition, and move a domain into native operation only when its records, permissions, reliability, and institutional authority have been verified.">
        <ol className="flex flex-wrap items-center gap-2 text-sm" aria-label="Transition stages">
          {['Discover', 'Configure', 'Validate', 'Reconcile', 'Authorize', 'Operate'].map((s, i, a) => <li key={s} className="flex items-center gap-2"><span className="rounded-[3px] border border-border bg-card px-3 py-1.5">{s}</span>{i < a.length - 1 && <span aria-hidden className="text-muted-foreground">→</span>}</li>)}
        </ol>
        <p className="mt-3 text-sm text-muted-foreground">No institution has moved a domain to native operation yet.</p>
      </Section>

      {/* 9 Trust and control */}
      <Section eyebrow="Trust" title="Clarity should not come at the cost of control.">
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          {['Private work remains distinct from official records.', 'Sharing needs a defined audience and purpose.', 'Sources and uncertainty should be visible.', 'Consequential decisions remain with authorized people.', 'Accessibility and resilience require testing.', 'AI assistance must respect the same permissions as the underlying workflow.'].map((t) => <li key={t} className="rounded-[3px] border border-border bg-card p-3">{t}</li>)}
        </ul>
        <p className="mt-3 text-sm"><Link to="/trust" className="text-primary underline">What is verified, and what isn’t yet</Link> · <Link to="/trust/privacy" className="text-primary underline">Privacy</Link> · <Link to="/trust/responsible-ai" className="text-primary underline">Responsible AI</Link></p>
      </Section>

      {/* 10 Ways to begin */}
      <Section eyebrow="Begin" title="Ways to begin">
        <div className="grid gap-px overflow-hidden rounded-[3px] border border-border bg-border sm:grid-cols-3">
          {[['Explore Semester', 'Understand the platform and the journeys that matter to you.', 'Request a demo', '/request-demo'],
            ['Design a bounded pilot', 'Define a workflow, its owners, the evidence to collect, and how it will be judged.', 'Request a pilot design session', '/pilot/request'],
            ['Plan an institutional implementation', 'Review governance, integrations, migration, and which domains to start with.', 'Discuss implementation', '/contact']].map(([t, d, cta, to]) => (
            <div key={t} className="flex flex-col bg-card p-5"><h3 className="text-lg">{t}</h3><p className="mt-1 text-sm text-muted-foreground">{d}</p><Button asChild variant="outline" className="mt-4 self-start"><Link to={to}>{cta}</Link></Button></div>))}
        </div>
      </Section>

      {/* 11 FAQ */}
      <Section eyebrow="Questions" title="Frequently asked">
        <dl className="divide-y divide-border border-y border-border">
          {FAQ.map(([q, a]) => <div key={q} className="grid gap-1 py-4 sm:grid-cols-[1fr_2fr] sm:gap-6"><dt className="font-display text-lg">{q}</dt><dd className="text-muted-foreground">{a}</dd></div>)}
        </dl>
      </Section>

      {/* 12 Final call to action */}
      <section className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
        <div className="rounded-[3px] border border-border bg-card p-8">
          <h2 className="font-editorial max-w-2xl text-3xl">Make the next step clearer — and the system behind it more connected.</h2>
          <div className="mt-6 flex flex-wrap gap-3"><Button asChild size="lg"><Link to="/request-demo">Request a demo</Link></Button><Button asChild size="lg" variant="outline"><Link to="/pilot/request">Discuss a pilot</Link></Button></div>
        </div>
      </section>
    </>
  );
}
