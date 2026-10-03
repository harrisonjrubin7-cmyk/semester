import type { ReactNode } from 'react';
import { COUNCIL } from '../lib/launchreadiness';
import { KNOWN_LIMITATIONS, KNOWN_LIMITATIONS_AS_OF, REPORT } from '../lib/knownlimitations';
import { AUDIENCES, CLAIMS, PROOF_RULES, STATUS_LABEL } from '../lib/ops/claims';
import { ALWAYS_INCLUDED, PILOT_NOTE, PLANS, priceLine } from '../lib/plans';
import { INSTITUTIONAL_PACKAGE, ROLLOUT_PHASES } from '../lib/institutional-package';
import { AudienceClaims, ClaimItem, ClaimList, ClaimTable, PolicyTable, StatusLegend } from './claims';
import { CONTACT_EMAIL, PROMISE, type SiteConfig } from './config';
import { appHref, href } from './Layout';
import { TOOL_LIST, type ToolId } from './tools/Tools';

/*
 * The public pages.
 *
 * Three rules hold for every sentence here, because a marketing page is where
 * a product is most tempted to say more than it can back up:
 *  - No claim of an integration that is not live. Registrars, learning
 *    systems and payments are named as what they are: official systems
 *    Semester points to.
 *  - No "works at any university" (DECISIONS.md §1). Semester is built at
 *    Vanderbilt first.
 *  - No invented numbers, quotes or logos. There is no testimonial on this
 *    site because there is no pilot report yet.
 *
 * And a fourth, held by `lib/ops/claims.test.ts`: every capability a reader
 * might buy on is printed from the claims register with its status word —
 * Available now, Built and tested, In preparation, Planned — and the word may
 * not be above what the master register's rows support. A page cannot say
 * "available" about something the register calls planned.
 */

type Page = (props: { config: SiteConfig }) => ReactNode;

export function Section({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <section className="site-section" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  );
}

export function Cards({ items }: { items: [string, string][] }) {
  return (
    <ul className="site-cards">
      {items.map(([title, body]) => (
        <li key={title}>
          <h3>{title}</h3>
          <p>{body}</p>
        </li>
      ))}
    </ul>
  );
}

export function Hero({ title, lead, children }: { title: string; lead: string; children?: ReactNode }) {
  return (
    <div className="site-hero">
      <h1>{title}</h1>
      <p className="site-lead">{lead}</p>
      {children}
    </div>
  );
}

export function Start({ config }: { config: SiteConfig }) {
  return (
    <p className="site-actions">
      <a className="site-button" href={href(config, '/signup/')}>Get started free</a>
      <a href={href(config, '/product/')}>See how it works</a>
    </p>
  );
}

/** A picture of Today, built from demo data and labelled as such. */
function TodayPreview() {
  return (
    <figure className="site-preview" aria-labelledby="preview-caption">
      <div className="site-preview-card">
        <p className="site-kicker">Next best step</p>
        <p className="site-preview-title">Prepare Problem Set 3</p>
        <p>Due in 2 days · Open it to review the instructions and source.</p>
        <p><span className="site-badge">Imported</span> <span className="site-badge site-badge-warn">Estimated</span></p>
        <p className="site-kicker">Your path</p>
        <p>On track by what you recorded · 6 of 9 requirements covered</p>
      </div>
      <figcaption id="preview-caption">
        Demo data. This is what Today can look like; your own shows only what you add.
      </figcaption>
    </figure>
  );
}

/** Who arrives, and the page each should read first. The site is deep; this is the front door's map. */
const AUDIENCE_ROUTES: [string, string][] = [
  ['I am a student', '/students/'],
  ['I advise or teach students', '/institutions/'],
  ['I run academic operations, or lead a department or institution', '/institutions/'],
  ['I work in IT, security, privacy or accessibility', '/launch-readiness/'],
  ['I am in procurement or legal', '/legal/'],
  ['I want to join or partner', '/careers/'],
];

export const Home: Page = ({ config }) => (
  <>
    <Hero title={PROMISE} lead="Semester shows you where you stand, what matters now, and the one next step worth taking — with the source of every fact beside it.">
      <Start config={config} />
    </Hero>
    <TodayPreview />
    <Section title="What brings you to Semester?" id="h-start">
      <ul className="site-router">
        {AUDIENCE_ROUTES.map(([label, p]) => (
          <li key={label}><a href={href(config, p)}>{label}</a></li>
        ))}
      </ul>
    </Section>
    <Section title="Know where you are. Know what’s next." id="h-what">
      <Cards
        items={[
          ['Today', 'One most important thing, a few more after it, and why each one is there.'],
          ['My Path', 'Your requirements, your credits and your target term, as a planning estimate you can take to your advisor.'],
          ['Plan', 'Your week, your deadlines and a registration plan with backups, checked for time conflicts.'],
          ['Study', 'Study tools built from your own course material.'],
        ]}
      />
    </Section>
    <Section title="Honest about what it knows" id="h-honest">
      <p>
        Every fact carries its source: <em>Institution verified</em>, <em>Imported</em>, <em>Student entered</em>,{' '}
        <em>Estimated</em> or <em>Needs review</em>. Semester never registers you for classes, never certifies your
        degree, and never sends anything without showing you first.
      </p>
      <ClaimList ids={['source-labels']} />
      <p className="site-small">
        Every capability on this site carries a word like the one above, and <a href={href(config, '/launch-readiness/')}>Are we ready?</a> explains the words.
      </p>
    </Section>
  </>
);

export const Product: Page = ({ config }) => (
  <>
    <Hero title="How Semester works" lead="Five places, each answering one question a student actually has." />
    <Section title="The five destinations" id="p-five">
      <Cards
        items={[
          ['Today', 'What matters now? A ranked list with one clear next step, and a reason for each.'],
          ['My Path', 'Am I on track? A Path Snapshot from the requirements and credits you entered.'],
          ['Search', 'Where is that? One search across your courses, deadlines and the whole app.'],
          ['Plan', 'When does it all happen? Your week, your deadlines and your registration plan.'],
          ['Me', 'Your profile, your data, your settings and your membership.'],
        ]}
      />
    </Section>
    <Section title="A Student Action Layer, not another portal" id="p-layer">
      <p>
        Semester sits over the systems your university already runs and turns what they say into the next thing to do. That is Academic Navigation: finding the official deadline, the right office and the next step, without claiming any authority the institution holds. For the moments that matter most — registration, an advising meeting — it prepares Decision Packets: the options, their requirement and cost impact, the assumptions, and what needs official approval, in one place.
      </p>
      <p className="site-small"><a href={href(config, '/platform/vocabulary/')}>The words we use</a></p>
    </Section>
    <Section title="What it will not do" id="p-not">
      <ul>
        <li>Register, add, drop or withdraw you. Your university’s system does that.</li>
        <li>Tell you your degree is complete. Only your registrar can.</li>
        <li>Send, share or export anything without a preview and your confirmation.</li>
        <li>Score you or predict your grades.</li>
      </ul>
    </Section>
    <Start config={config} />
  </>
);

export const Students: Page = ({ config }) => (
  <>
    <Hero title="For students" lead="Less time reconstructing where you are. More time doing the next right thing." />
    <Section title="Before registration" id="s-reg">
      <p>Build a term plan, see time conflicts, pick backup sections for classes that fill, and walk into registration with a checklist.</p>
    </Section>
    <Section title="Before you meet your advisor" id="s-adv">
      <p>Bring a Path Snapshot and your questions, so the meeting is about decisions rather than catching up.</p>
    </Section>
    <Section title="Every week" id="s-week">
      <p>Today puts the next deadline first and tells you why. Snooze it, mark it done, or say it is wrong.</p>
    </Section>
    <Section title="When you need people" id="s-people">
      <p>
        Who else is in your classes, a study group for a course, clubs and events, a mentor who opted in, and the
        people who will one day write about you — found by what you study, never by where you are.{' '}
        <a href={href(config, '/community/')}>The Semester Community</a> says what is built and in what order.
      </p>
    </Section>
    <Start config={config} />
  </>
);

export const Institutions: Page = ({ config }) => (
  <>
    <Hero title="Semester Institutional" lead="Pilot a student action layer beside existing systems, with one package and a controlled path to any approved migration.">
      <p className="site-actions">
        <a className="site-button" href={href(config, '/demo/')}>Explore a sample university</a>
        <a href={href(config, '/contact/')}>Talk to us</a>
      </p>
    </Hero>
    <Section title="One package" id="i-package">
      <ul>
        {INSTITUTIONAL_PACKAGE.includes.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </Section>
    <Section title="Pilot to campus-wide cutover" id="i-pilot">
      <ol>
        {ROLLOUT_PHASES.map((phase) => <li key={phase.id}><strong>{phase.name}.</strong> {phase.outcome}</li>)}
      </ol>
      <p>The package removes a fragmented buying process. It does not remove security, privacy, accessibility, approval, reconciliation or rollback gates.</p>
    </Section>
    <Section title="How Semester connects" id="i-connect">
      <p>
        Semester starts beside the systems you have, read-only and least-privilege. Only after conformance, parallel-run,
        migration and customer acceptance evidence is approved could an institution separately authorize Semester as
        its LMS or gradebook of record. Registration, finance and every other official write remain off until the
        institution authorizes that exact workflow. No institutional connection is live today.
      </p>
      <p>Each connection below carries the word the register gives it. None is running for an institution yet.</p>
      <ClaimList ids={['sso', 'scim', 'lti', 'sis', 'connector-health', 'support-access', 'hecvat']} />
      <p className="site-small"><a href={href(config, '/launch-readiness/')}>What the words mean, and everything else that is ready or not</a></p>
    </Section>
    <Section title="Talk to us" id="i-talk">
      <p><a href={`mailto:${CONTACT_EMAIL}?subject=Semester%20pilot`}>{CONTACT_EMAIL}</a></p>
      <p><a href={href(config, '/security/')}>Read how Semester handles security and privacy</a></p>
    </Section>
  </>
);

/** What a student is told before anything is for sale. Each line is a promise the pricing page will keep. */
const COMMERCIAL_TERMS: [string, string][] = [
  ['Currency', 'US dollars.'],
  ['Billing period', 'Monthly or yearly, as shown. No other period.'],
  ['Tax', 'Determined for your location before anything is sold; the price shown is before tax.'],
  ['Free trial', 'Not decided. Everything a student can use is free during the pilot, which is more than a trial.'],
  ['Upgrading', 'Individual paid acquisition is held. Plus and Pro are planned, not on sale, until the required product, legal, privacy, accessibility, security and operational approvals are current.'],
  ['Cancelling', 'From the same screen. Cancelling stops the renewal at Stripe, Plus lasts to the end of the period you paid for, and everything you built stays.'],
  ['What stays available', 'Everything on Free, always, and every plan you saved.'],
  ['Refunds', 'The policy is a proposal: it is published on the legal page before a live payment is taken, not after.'],
  ['Receipts and invoices', 'Existing subscribers retain billing-history access. New individual checkout is disabled.'],
  ['Institution-sponsored access', 'If your university provides Semester, you sign in with your university account and pay nothing.'],
];

export const Pricing: Page = ({ config }) => (
  <>
    <Hero title="Pricing" lead={PILOT_NOTE} />
    <ul className="site-plans">
      {PLANS.map((p) => (
        <li key={p.id}>
          <h2>{p.name}</h2>
          <p className="site-small">{p.forWhom}</p>
          <p className="site-price">{priceLine(p)}</p>
          <ul>
            {p.includes.map((i) => <li key={i}>{i}</li>)}
          </ul>
        </li>
      ))}
    </ul>
    <Section title="On every plan, always" id="pr-always">
      <ul>
        {ALWAYS_INCLUDED.map((i) => <li key={i}>{i}</li>)}
      </ul>
      <p>Nothing you built on a free plan is taken away. Individual paid plans are planned, not on sale. New checkout is disabled while the required approvals remain open.</p>
    </Section>
    <Section title="Planned individual plans" id="pr-terms">
      <ClaimList ids={['no-sale']} />
      <dl className="site-legend">
        {COMMERCIAL_TERMS.map(([term, detail]) => (
          <div key={term}><dt><strong>{term}</strong></dt><dd>{detail}</dd></div>
        ))}
      </dl>
      <p className="site-small">
        Billing questions: <a href={`mailto:${CONTACT_EMAIL}?subject=Semester%20billing`}>{CONTACT_EMAIL}</a>. Policies, and their status, are on the{' '}
        <a href={href(config, '/legal/')}>legal page</a>.
      </p>
    </Section>
    <Start config={config} />
  </>
);

export const Tools: Page = ({ config }) => (
  <>
    <Hero title="Free tools" lead="Useful before you sign up. They run in this page, and nothing you enter is saved or sent." />
    <ul className="site-cards">
      {TOOL_LIST.map((t) => (
        <li key={t.id}>
          <h2>{t.title}</h2>
          <p>{t.lead}</p>
          <p><a href={href(config, `/tools/${t.id}/`)}>Open the {t.title.toLowerCase()}</a></p>
        </li>
      ))}
    </ul>
    <p className="site-small">
      Want it to remember? The same tools live in the <a href={appHref(config)}>Semester app</a>, which keeps your plan on your device.
    </p>
  </>
);

/** One public tool: its prerendered first state, hydrated by `tools/tools.js`. */
export function ToolPage({ config, id, title, lead, body }: { config: SiteConfig; id: ToolId; title: string; lead: string; body: { html: string; props: string } }) {
  return (
    <>
      <Hero title={title} lead={lead} />
      <noscript>
        <p className="site-badge site-badge-warn">This tool needs JavaScript to respond to what you type. Everything else on this site works without it.</p>
      </noscript>
      <div className="tool-host" data-tool={id} data-props={body.props} dangerouslySetInnerHTML={{ __html: body.html }} />
      <p className="site-small">
        <a href={href(config, '/tools/')}>All free tools</a> · <a href={appHref(config)}>Open the Semester app</a>
      </p>
    </>
  );
}

/** What every guide will carry before it is published. Written before the first guide, so the first one carries it. */
const RESOURCE_STANDARD: string[] = [
  'Who wrote it, and who with the relevant expertise reviewed it.',
  'Who it is for.',
  'When it was published, when it was last reviewed, and when it is next due.',
  'Its sources, and its method if it rests on data.',
  'An accessible format, checked the same way the app is.',
  'A way to report an error in it, and the product screen it relates to.',
];

/**
 * The free resource library. A resource with a path exists as a tool that
 * sends nothing anywhere; one without is being written, and is listed so a
 * reader knows it is coming rather than sent to a page that is not.
 */
export const LIBRARY: { title: string; path?: string }[] = [
  { title: 'Registration checklist', path: '/tools/checklist/' },
  { title: 'Advisor meeting agenda', path: '/tools/advisor/' },
  { title: 'Schedule builder', path: '/tools/schedule/' },
  { title: 'Graduation timeline', path: '/tools/graduation/' },
  { title: 'Academic navigation diagnostic', path: '/tools/navigation/' },
  { title: 'First-semester checklist' },
  { title: 'Transfer-credit planning guide' },
  { title: 'Study-plan template' },
  { title: 'Scholarship tracker template' },
  { title: 'Internship application tracker' },
  { title: 'Campus-club launch guide' },
  { title: 'Student organization event-planning kit' },
  { title: 'Group-project template' },
  { title: 'Career fair preparation checklist' },
  { title: '“How to ask for help in college” guide' },
];

export const Resources: Page = ({ config }) => (
  <>
    <Hero title="Resources" lead="Guides for registration, advising and planning your degree." />
    <Section title="Free, before you sign up" id="r-library">
      <p>
        Each of these is useful on its own and sends nothing anywhere. Use it free; save it to Semester if you make an
        account; turn it into your plan; put its deadlines where you will see them; share it with an advisor or a
        mentor. The ones without a link are being written with students during the pilot.
      </p>
      <ul>
        {LIBRARY.map((r) => (
          <li key={r.title}>{r.path ? <a href={href(config, r.path)}>{r.title}</a> : <>{r.title} <span className="site-small">(being written)</span></>}</li>
        ))}
      </ul>
    </Section>
    <Section title="For institutions" id="r-institutions">
      <p>
        The <a href={href(config, '/resources/campus-launch-kit/')}>campus launch kit</a> has the emails, announcements, signage, FAQ and launch agenda an institution needs to tell its campus about Semester, ready to adapt.
      </p>
    </Section>
    <Section title="Coming soon" id="r-soon">
      <p>Guides are being written with students during the pilot. Until then, <a href={href(config, '/help/')}>Help</a> covers how Semester works.</p>
    </Section>
    <Section title="What every guide will carry" id="r-standard">
      <p>Registration advice, transfer guidance, financial-aid navigation and anything about AI, privacy or accessibility is only as good as its review. Every guide published here states:</p>
      <ul>
        {RESOURCE_STANDARD.map((s) => <li key={s}>{s}</li>)}
      </ul>
    </Section>
  </>
);

export const About: Page = () => (
  <>
    <Hero title="About Semester" lead="Semester is both the company and the product." />
    <Section title="Why it exists" id="a-why">
      <p>
        College gives students a registrar, a learning system, a degree audit, an advisor, a billing office and a
        calendar — and leaves them to assemble the picture themselves. Semester started as a student’s answer to that
        at Vanderbilt: one place that says where you stand and what to do next, and is honest about what it knows.
      </p>
    </Section>
    <Section title="How we work" id="a-how">
      <ul>
        <li>Depth at one university before breadth across many.</li>
        <li>Your data is yours: export it or delete it at any time.</li>
        <li>No advertising, and no selling of student data.</li>
      </ul>
    </Section>
  </>
);

export const Careers: Page = () => (
  <>
    <Hero title="Careers" lead="Help make college easier to navigate." />
    <Section title="Work with us" id="c-work">
      <p>
        There are no open roles listed right now. If you want to help — as an engineer, a designer, a student
        ambassador, or an advisor willing to give feedback — write to{' '}
        <a href={`mailto:${CONTACT_EMAIL}?subject=Working%20with%20Semester`}>{CONTACT_EMAIL}</a>.
      </p>
    </Section>
  </>
);

/** Each topic, the council seat that answers it, and the subject line that routes it. */
const CONTACT_ROUTES: { topic: string; seat: string; subject: string; response: string }[] = [
  { topic: 'General questions and support', seat: 'success', subject: 'Semester question', response: 'Read by a person. No response time is promised yet.' },
  { topic: 'Partnerships and pilots', seat: 'founder', subject: 'Semester partnership', response: 'Read by a person. No response time is promised yet.' },
  { topic: 'Security reports', seat: 'security', subject: 'Security report', response: 'Read by a person. A confirmed exposure of your data brings notice within 72 hours; see Security.' },
  { topic: 'Privacy and your data', seat: 'privacy', subject: 'Privacy request', response: 'Read by a person. Export and deletion need no request: they are in the app, on every plan.' },
  { topic: 'Accessibility barriers', seat: 'accessibility', subject: 'Accessibility', response: 'Treated as a bug. Read by a person. No response time is promised yet.' },
  { topic: 'Press', seat: 'founder', subject: 'Semester press', response: 'Read by a person. No response time is promised yet.' },
];

const seatTitle = (seat: string) => COUNCIL.find((s) => s.seat === seat)?.title ?? seat;

export const Contact: Page = ({ config }) => (
  <>
    <Hero title="Contact" lead="One address for now, read by a person." />
    <Section title="Write to us" id="ct-write">
      <div className="site-scroll">
        <table className="site-table">
          <caption>Every topic, who answers it, and what to expect</caption>
          <thead>
            <tr><th scope="col">Topic</th><th scope="col">Answered by</th><th scope="col">Write to</th><th scope="col">What to expect</th></tr>
          </thead>
          <tbody>
            {CONTACT_ROUTES.map((r) => (
              <tr key={r.topic}>
                <th scope="row">{r.topic}</th>
                <td>{seatTitle(r.seat)}</td>
                <td><a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(r.subject)}`}>{CONTACT_EMAIL}</a></td>
                <td>{r.response}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="site-small">
        The seats are the accountabilities of the launch readiness council. Every one is vacant today, so every topic reaches the founder until a seat is held; the column says which seat will answer.
      </p>
      <ClaimList ids={['company-addresses']} />
      <p className="site-small">There is no contact form, so nothing you type here is stored by this site. <a href={href(config, '/accessibility/')}>Accessibility</a> says what to include in a barrier report.</p>
    </Section>
  </>
);

export const Security: Page = ({ config }) => (
  <>
    <Hero title="Security" lead="What protects your data today, and what is not done yet." />
    <Section title="In place" id="se-now">
      <ClaimList ids={['local-first', 'rls', 'secrets', 'no-payment-data']} />
    </Section>
    <Section title="Not done yet" id="se-not">
      <ClaimList ids={['incident-notice', 'audit-log', 'restore-drill', 'mfa', 'pen-test', 'soc2']} />
      <p className="site-small"><a href={href(config, '/launch-readiness/')}>What the words mean</a></p>
    </Section>
    <Section title="Report a problem" id="se-report">
      <p>Write to <a href={`mailto:${CONTACT_EMAIL}?subject=Security%20report`}>{CONTACT_EMAIL}</a>. Please do not test against other students’ accounts.</p>
      <p>
        The same address is published in machine-readable form at <a href={appHref(config, '.well-known/security.txt')}>/.well-known/security.txt</a>, whose policy link is the written process: how a report is handled, the four severities a finding is sorted into, and the remediation target each is held to.
      </p>
      <p className="site-small">Read by a person. No response time is promised yet, and there is no bounty; the remediation targets are internal, and a confirmed exposure of your data brings notice within 72 hours.</p>
    </Section>
  </>
);

export const Privacy: Page = ({ config }) => (
  <>
    <Hero title="Privacy" lead="Your data is yours. Here is what that means in practice." />
    <Section title="The short version" id="pv-short">
      <ul>
        <li>Signed out, what you add stays on your device.</li>
        <li>Signed in, it is also kept in your account so it can follow you between devices.</li>
        <ClaimItem id="export-delete" />
        <li>No advertising and no selling of data. Semester reads your university’s systems only when you connect them yourself, or under a written agreement with your university.</li>
      </ul>
    </Section>
    <Section title="The full detail" id="pv-full">
      <p>The app’s own privacy page lists every place your data is kept and what deleting it removes.</p>
      <p><a href={appHref(config, '#/privacy')}>Read the privacy page in the app</a></p>
      <p className="site-small">The privacy policy itself is a draft and not in force; the <a href={href(config, '/legal/')}>legal page</a> says where every policy stands.</p>
    </Section>
  </>
);

export const Accessibility: Page = ({ config }) => (
  <>
    <Hero title="Accessibility" lead="Semester is built toward WCAG 2.2 AA. An Accessible University OS treats every accessibility need as ordinary product quality, not a setting." />
    <Section title="What is checked on every build" id="ac-checked">
      <ul>
        <li>Every control has a name a screen reader can read.</li>
        <li>Every page has one main region and a skip link.</li>
        <li>Visible focus, reduced motion, and nothing that needs dragging.</li>
        <li>Nothing is said only with colour or shape.</li>
      </ul>
    </Section>
    <Section title="Where the evidence stands" id="ac-evidence">
      <ClaimTable ids={['a11y-site', 'a11y-app', 'a11y-human', 'vpat', 'a11y-lms']} caption="Each area, its status, how it is checked, and what is known not to be covered" />
      <p className="site-small"><a href={href(config, '/launch-readiness/')}>What the words mean</a></p>
    </Section>
    <Section title="Known gaps" id="ac-gaps">
      <p>There is no formal conformance report (VPAT) yet, and no review by a person with a screen reader has been recorded. Automated checks find a minority of barriers.</p>
    </Section>
    <Section title="Report a barrier" id="ac-report">
      <p>If something does not work for you, write to <a href={`mailto:${CONTACT_EMAIL}?subject=Accessibility`}>{CONTACT_EMAIL}</a> and it will be treated as a bug.</p>
      <ul>
        <li>Say which page or screen, what you were trying to do, and the browser and assistive technology you used.</li>
        <li>You will get a reply from a person that says what was found and what happens next. No response time is promised yet.</li>
        <li>A barrier that stops you finishing what you came to do is fixed before anything else in that screen ships.</li>
        <li>If the reply does not resolve it, write again with “Accessibility escalation” in the subject; it goes to the accessibility seat.</li>
      </ul>
    </Section>
  </>
);

export const Help: Page = ({ config }) => (
  <>
    <Hero title="Help" lead="Answers to the questions students ask first." />
    <Section title="Do I need an account?" id="hp-account"><p>No. Everything works on your device without one. An account keeps your work in step across devices.</p></Section>
    <Section title="Does Semester register me for classes?" id="hp-register"><p>No. It helps you plan, check conflicts and choose backups, then you register in your university’s own system.</p></Section>
    <Section title="Is my Path Snapshot official?" id="hp-official"><p>No. It is a planning estimate from what you entered. Confirm anything that matters with your advisor and registrar.</p></Section>
    <Section title="I do not know who to ask" id="hp-door"><p>No Wrong Door: on the app’s Help screen, describe the problem in your own words and Semester says whose question it is, what it can do first, and what to bring — with a summary to take to the person. Nothing you type there is kept.</p></Section>
    <Section title="Still stuck?" id="hp-more"><p>The app has a full guide to every screen: <a href={appHref(config, '#/help')}>How this works</a>. Or write to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p></Section>
  </>
);

/**
 * Known limitations, for pilot users: the same list the Help screen prints
 * and `docs/pilot/KNOWN-LIMITATIONS.md` is rendered from, so the three cannot
 * disagree. No claim register word here — nothing on this page is a
 * capability a reader might buy on; each is a thing that does not work yet.
 */
export const KnownLimitations: Page = ({ config }) => (
  <>
    <Hero title="Known limitations" lead={`What does not work yet, what to do instead, and how to report something. As of ${KNOWN_LIMITATIONS_AS_OF}.`} />
    <Section title="What does not work yet" id="kl-list">
      <p className="site-small">Semester works on your device without an account; everything below is about the edges of that. Each item is stated in a file in the repository, and a test fails when that file goes missing or this page differs from it.</p>
      {KNOWN_LIMITATIONS.map((l) => (
        <div key={l.id} id={`kl-${l.id}`}>
          <h3>{l.title}</h3>
          <p><strong>What does not work yet.</strong> {l.what}</p>
          <p><strong>What to do instead.</strong> {l.instead}</p>
        </div>
      ))}
    </Section>
    <Section title="How to report something" id="kl-report">
      <ul>
        {REPORT.lines.map((line) => <li key={line}>{line}</li>)}
      </ul>
      <p className="site-small"><a href={href(config, '/accessibility/')}>Accessibility</a> says the same for barriers · <a href={href(config, '/launch-readiness/')}>Are we ready?</a> is the status of every capability</p>
    </Section>
  </>
);

/** How many claims carry each word, for the sentence that says so. */
function countsLine(): string {
  const counts = Object.entries(STATUS_LABEL)
    .map(([s, label]) => [label, CLAIMS.filter((c) => c.status === s).length] as const)
    .filter(([, n]) => n > 0)
    .map(([label, n]) => `${n} ${label.toLowerCase()}`);
  return `${CLAIMS.length} capabilities are registered: ${counts.join(', ')}.`;
}

export const LaunchReadiness: Page = ({ config }) => (
  <>
    <Hero title="Are we ready?" lead="What runs today, what is built but not deployed, and what is still planned — from the same register that holds this site to its word." />
    <Section title="What the words mean" id="lr-words">
      <StatusLegend />
      <p className="site-small">{countsLine()} Nothing here is a limited beta or institution-configured, because there is no design partner and no configured institution yet.</p>
    </Section>
    {AUDIENCES.map((a) => (
      <Section key={a.id} title={a.question} id={`lr-${a.id}`}>
        <p className="site-kicker">{a.title}</p>
        <AudienceClaims audience={a.id} />
      </Section>
    ))}
    <Section title="Is it up right now?" id="lr-status">
      <p>
        <a href={appHref(config, 'status.html')}>The status page</a> checks Semester from your own browser when you open it. Up means your browser reached it just now; there is no uptime history to show yet.
      </p>
    </Section>
    <Section title="How this page stays honest" id="lr-how">
      <p>
        Every word above comes from a register in the code, beside the tests. Each capability names the readiness rows it rests on, and a test refuses a word above what those rows support, an “available” with no test behind it, and any page of this site that prints a status the register does not know. When evidence lapses, the build fails until the wording changes.
      </p>
      <p className="site-small"><a href={href(config, '/proof/')}>How Semester shows proof</a> · <a href={href(config, '/legal/')}>Where every policy stands</a></p>
    </Section>
  </>
);

export const Proof: Page = ({ config }) => (
  <>
    <Hero title="How we show proof" lead="Written before there is any to show, so the first customer story is held to it." />
    <Section title="The rules" id="pf-rules">
      <ul>
        {PROOF_RULES.map((r) => <li key={r}>{r}</li>)}
      </ul>
    </Section>
    <Section title="Why there is no testimonial here" id="pf-none">
      <p>There is no pilot report yet. A quote without one would describe an experience nobody has measured, and a logo would borrow a university’s name for a product it has not adopted. Both wait.</p>
    </Section>
    <Section title="How a claim gets onto this site" id="pf-claim">
      <p>
        A capability is written into the claims register with its wording, the readiness rows it rests on and the evidence behind it. A test decides which of six words it may carry, and every page prints that word beside it. <a href={href(config, '/launch-readiness/')}>Are we ready?</a> lists them all.
      </p>
    </Section>
  </>
);

export const Legal: Page = ({ config }) => (
  <>
    <Hero title="Legal" lead="Nothing is in force yet. Here is every policy, and where each one stands." />
    <Section title="Every policy" id="lg-all">
      <PolicyTable />
      <p className="site-small">Drafts exist for the terms and the privacy policy; they say on their first line that they are not in force. Nothing here has had a lawyer’s review.</p>
    </Section>
    <Section title="When a policy takes effect" id="lg-effect">
      <p>From the day one is in force, this page shows for it:</p>
      <ul>
        <li>The current version and its effective date.</li>
        <li>Every previous version, unchanged.</li>
        <li>A plain-language summary of what changed, and how you were told.</li>
        <li>The seat that owns it, the address to write to, and where it applies.</li>
      </ul>
      <ClaimList ids={['student-terms', 'dpa']} />
    </Section>
    <Section title="Until then" id="lg-until">
      <p>
        The promises that matter most are kept by the product rather than a document: export and deletion on every plan, no advertising, no sale of data, nothing sent without a preview. <a href={href(config, '/privacy/')}>Privacy</a> says how, and <a href={href(config, '/launch-readiness/')}>Are we ready?</a> says what is still to come.
      </p>
    </Section>
  </>
);

/** Sign-in, sign-up, account and membership live in the app; these pages hand off to it. */
function Handoff({ config, title, lead, label, hash }: { config: SiteConfig; title: string; lead: string; label: string; hash: string }) {
  return (
    <Hero title={title} lead={lead}>
      <p className="site-actions"><a className="site-button" href={appHref(config, hash)}>{label}</a></p>
      <p className="site-small">An account is optional. Without one, Semester keeps your work on this device only.</p>
    </Hero>
  );
}

export const Login: Page = ({ config }) => <Handoff config={config} title="Log in" lead="Sign in inside the Semester app." label="Open the app to sign in" hash="#/account" />;
export const Signup: Page = ({ config }) => <Handoff config={config} title="Get started" lead="Start free — no card, no account required to try it." label="Open Semester" hash="" />;
export const Account: Page = ({ config }) => <Handoff config={config} title="Your account" lead="Your profile, sign-in and data controls are in the app." label="Open your account" hash="#/account" />;
export const Membership: Page = ({ config }) => <Handoff config={config} title="Your membership" lead={PILOT_NOTE} label="Open membership in the app" hash="#/account" />;
