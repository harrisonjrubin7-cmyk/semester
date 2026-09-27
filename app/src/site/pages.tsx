import type { ReactNode } from 'react';
import { ALWAYS_INCLUDED, PILOT_NOTE, PLANS, priceLine } from '../lib/plans';
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
 */

type Page = (props: { config: SiteConfig }) => ReactNode;

function Section({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <section className="site-section" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  );
}

function Cards({ items }: { items: [string, string][] }) {
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

function Hero({ title, lead, children }: { title: string; lead: string; children?: ReactNode }) {
  return (
    <div className="site-hero">
      <h1>{title}</h1>
      <p className="site-lead">{lead}</p>
      {children}
    </div>
  );
}

function Start({ config }: { config: SiteConfig }) {
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

export const Home: Page = ({ config }) => (
  <>
    <Hero title={PROMISE} lead="Semester shows you where you stand, what matters now, and the one next step worth taking — with the source of every fact beside it.">
      <Start config={config} />
    </Hero>
    <TodayPreview />
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
    <Start config={config} />
  </>
);

export const Institutions: Page = ({ config }) => (
  <>
    <Hero title="For institutions" lead="Turn fragmented systems into clearer student action — starting with a small, measured pilot." />
    <Section title="What a pilot looks like" id="i-pilot">
      <ul>
        <li>One cohort of 25 to 100 students around a registration or advising moment.</li>
        <li>Student-entered data first, so no records change hands before an agreement exists.</li>
        <li>Clear measures: can students say what to do next, and are advising conversations better prepared?</li>
      </ul>
    </Section>
    <Section title="How Semester connects" id="i-connect">
      <p>
        Official systems stay official. Semester links to your registration, learning and billing systems rather than
        replacing them, and any connection starts read-only, least-privilege, and under a written agreement. No
        institutional connection is live today.
      </p>
    </Section>
    <Section title="Talk to us" id="i-talk">
      <p><a href={`mailto:${CONTACT_EMAIL}?subject=Semester%20pilot`}>{CONTACT_EMAIL}</a></p>
      <p><a href={href(config, '/security/')}>Read how Semester handles security and privacy</a></p>
    </Section>
  </>
);

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
      <p>Nothing you built on a free plan is taken away. There is no checkout on this site, and no payment details are collected anywhere in Semester.</p>
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

export const Resources: Page = ({ config }) => (
  <>
    <Hero title="Resources" lead="Guides for registration, advising and planning your degree." />
    <Section title="Coming soon" id="r-soon">
      <p>Guides are being written with students during the pilot. Until then, <a href={href(config, '/help/')}>Help</a> covers how Semester works.</p>
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

export const Contact: Page = () => (
  <>
    <Hero title="Contact" lead="One address for now, read by a person." />
    <Section title="Write to us" id="ct-write">
      <ul>
        <li>General questions and support: <a href={`mailto:${CONTACT_EMAIL}?subject=Semester%20question`}>{CONTACT_EMAIL}</a></li>
        <li>Partnerships and pilots: <a href={`mailto:${CONTACT_EMAIL}?subject=Semester%20partnership`}>{CONTACT_EMAIL}</a></li>
        <li>Security reports: <a href={`mailto:${CONTACT_EMAIL}?subject=Security%20report`}>{CONTACT_EMAIL}</a></li>
      </ul>
      <p className="site-small">There is no contact form, so nothing you type here is stored by this site.</p>
    </Section>
  </>
);

export const Security: Page = () => (
  <>
    <Hero title="Security" lead="What protects your data today, and what is not done yet." />
    <Section title="In place" id="se-now">
      <ul>
        <li>Your working copy lives on your device. An account is optional.</li>
        <li>With an account, access to every table is enforced by the database itself, and tested as a second account in every build.</li>
        <li>No secret keys are shipped to the browser, and every change is scanned for leaked credentials.</li>
        <li>Semester never stores payment cards, bank details or university passwords.</li>
      </ul>
    </Section>
    <Section title="Not done yet" id="se-not">
      <ul>
        <li>No independent audit or certification such as SOC 2.</li>
        <li>A restore from backup has not yet been rehearsed end to end.</li>
      </ul>
    </Section>
    <Section title="Report a problem" id="se-report">
      <p>Write to <a href={`mailto:${CONTACT_EMAIL}?subject=Security%20report`}>{CONTACT_EMAIL}</a>. Please do not test against other students’ accounts.</p>
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
        <li>You can export everything, and delete your account, at any time, on any plan.</li>
        <li>No advertising and no selling of data. Semester reads your university’s systems only when you connect them yourself, or under a written agreement with your university.</li>
      </ul>
    </Section>
    <Section title="The full detail" id="pv-full">
      <p>The app’s own privacy page lists every place your data is kept and what deleting it removes.</p>
      <p><a href={appHref(config, '#/privacy')}>Read the privacy page in the app</a></p>
    </Section>
  </>
);

export const Accessibility: Page = () => (
  <>
    <Hero title="Accessibility" lead="Semester is built toward WCAG 2.2 AA." />
    <Section title="What is checked on every build" id="ac-checked">
      <ul>
        <li>Every control has a name a screen reader can read.</li>
        <li>Every page has one main region and a skip link.</li>
        <li>Visible focus, reduced motion, and no task that needs dragging.</li>
        <li>Nothing is said only with colour or shape.</li>
      </ul>
    </Section>
    <Section title="Known gaps" id="ac-gaps">
      <p>There is no formal conformance report (VPAT) yet. If something does not work for you, write to <a href={`mailto:${CONTACT_EMAIL}?subject=Accessibility`}>{CONTACT_EMAIL}</a> and it will be treated as a bug.</p>
    </Section>
  </>
);

export const Help: Page = ({ config }) => (
  <>
    <Hero title="Help" lead="Answers to the questions students ask first." />
    <Section title="Do I need an account?" id="hp-account"><p>No. Everything works on your device without one. An account keeps your work in step across devices.</p></Section>
    <Section title="Does Semester register me for classes?" id="hp-register"><p>No. It helps you plan, check conflicts and choose backups, then you register in your university’s own system.</p></Section>
    <Section title="Is my Path Snapshot official?" id="hp-official"><p>No. It is a planning estimate from what you entered. Confirm anything that matters with your advisor and registrar.</p></Section>
    <Section title="Still stuck?" id="hp-more"><p>The app has a full guide to every screen: <a href={appHref(config, '#/help')}>How this works</a>. Or write to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p></Section>
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
