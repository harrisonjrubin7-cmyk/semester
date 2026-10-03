import type { ReactNode } from 'react';
import { CONTACT_EMAIL, type SiteConfig } from './config';
import { appHref, href } from './Layout';
import { Cards, Hero, Section, Start } from './pages';
import { claim } from '../lib/ops/claims';
import { StatusBadge, StatusLegend } from './claims';
import { MODULES } from './modules';
import { STATUS_LABEL } from '../lib/ops/claims';
import { ROLE_WORKSPACE_FUNCTIONS, ROLE_WORKSPACE_TITLES } from '../components/institutional/role-workspace';
import { ROLLOUT_PHASES } from '../lib/institutional-package';
import { AUTHORITIES, AVAILABILITY, BOUNDARIES, DEMO_PATHS, SERVICES, TIERS } from './platform';

/*
 * The platform, trust and buying pages.
 *
 * The rules in `pages.tsx` hold here word for word: no integration claimed
 * that is not live, no "any university", no invented number, quote or logo.
 * These pages exist because a buyer who cannot tell a plan from a product
 * stops trusting the parts that are products — so every one of them says
 * which is which, and the tables are data (`platform.ts`) a test can read.
 */

type Page = (props: { config: SiteConfig }) => ReactNode;

/** A run of steps, in order, drawn as a numbered list rather than arrows. */
function Flow({ steps, label }: { steps: [string, string][]; label: string }) {
  return (
    <ol className="site-flow" aria-label={label}>
      {steps.map(([title, body]) => (
        <li key={title}>
          <strong>{title}</strong>
          <span>{body}</span>
        </li>
      ))}
    </ol>
  );
}

/** A short template, ready to copy, with what to change in square brackets. */
function Template({ title, lines }: { title: string; lines: string[] }) {
  return (
    <figure className="site-template">
      <figcaption>{title}</figcaption>
      <pre>{lines.join('\n')}</pre>
    </figure>
  );
}

const mail = (subject: string) => `mailto:${CONTACT_EMAIL}?subject=${subject}`;

// ── /platform/availability/ ─────────────────────────────────────────────────

export const Availability: Page = ({ config }) => (
  <>
    <Hero title="What is available, to whom" lead="One table, so a plan is never mistaken for a product. Every row carries the word the claims register gives it." />
    <div className="site-scroll">
      <table className="site-table">
        <caption>Capabilities by plan, with the status of each</caption>
        <thead>
          <tr>
            <th scope="col">Capability</th>
            {TIERS.map((t) => <th key={t.id} scope="col">{t.label}</th>)}
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {AVAILABILITY.map((row) => {
            const c = claim(row.claim);
            return (
              <tr key={c.id} data-claim={c.id}>
                <th scope="row">{c.claim}</th>
                {TIERS.map((t) => <td key={t.id}>{row.tiers[t.id]}</td>)}
                <td><StatusBadge c={c} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    <Section title="What each status means" id="av-status">
      <StatusLegend />
    </Section>
    <Section title="The sentence behind each row" id="av-notes">
      <dl className="site-dl">
        {AVAILABILITY.map((row) => (
          <div key={row.claim}>
            <dt>{claim(row.claim).claim}</dt>
            <dd>{row.note}</dd>
          </div>
        ))}
      </dl>
      <p className="site-small">
        No institutional connection is live today. Anything not yet available to an institution starts read-only,
        least-privilege and under a written agreement. <a href={href(config, '/launch-readiness/')}>Everything else that is ready or not</a>{' · '}
        <a href={href(config, '/platform/system-boundaries/')}>What stays official elsewhere</a>{' · '}
        <a href={href(config, '/platform/service-map/')}>How the services fit together</a>
      </p>
    </Section>
  </>
);

// ── /platform/service-map/ ──────────────────────────────────────────────────

export const ServiceMap: Page = ({ config }) => (
  <>
    <Hero title="The service map" lead="What Semester is made of, in the order a student meets it, and who decides what." />
    <Section title="The services" id="sm-services">
      <Flow steps={SERVICES} label="Semester’s services, in order" />
    </Section>
    <Section title="Who decides what" id="sm-authority">
      <p>Today Semester coordinates. It becomes the record for a module only when the institution switches that module to Core, in writing.</p>
      <Cards items={AUTHORITIES} />
    </Section>
    <Section title="Read next" id="sm-next">
      <p>
        <a href={href(config, '/platform/system-boundaries/')}>System boundaries, area by area</a>{' · '}
        <a href={href(config, '/platform/availability/')}>What is available, to whom</a>
      </p>
    </Section>
  </>
);

// ── /platform/system-boundaries/ ────────────────────────────────────────────

export const SystemBoundaries: Page = ({ config }) => (
  <>
    <Hero title="System boundaries" lead="Semester runs beside your systems today and takes each one over, a module at a time, when you are ready. Here is every module, what it would replace, and how far it has got." />
    <Section title="The takeover map" id="sb-map">
      <p>
        Each module has two modes. In <strong>Connect</strong>, which is how Semester works today, it reads from your system and prepares actions. In <strong>Core</strong>, your school switches that one module to Semester in writing and Semester becomes the record for it. Switching back never deletes anything. <strong>Nothing below is built yet</strong>; the status word is the claims register’s, and a test refuses a module that claims more than the code holds.
      </p>
      <div className="site-table-wrap">
        <table className="site-table">
          <caption>Modules, the systems they would replace, and their status</caption>
          <thead>
            <tr>
              <th scope="col">Module</th>
              <th scope="col">Would replace</th>
              <th scope="col">Today (Connect)</th>
              <th scope="col">When switched to Core</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {MODULES.map((m) => (
              <tr key={m.id}>
                <th scope="row">{m.name}</th>
                <td>{m.replaces}</td>
                <td>{m.today}</td>
                <td>{m.core}</td>
                <td><span className={`site-badge site-status site-status-${m.status}`}>{STATUS_LABEL[m.status]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="site-small">Product names belong to their owners and are listed only to say which system a module is meant to take over. Semester replaces none of them today.</p>
    </Section>
    <Section title="Who is official today" id="sb-today">
      <p>Until a module is switched to Core, the system named below stays the official record.</p>
    </Section>
    <div className="site-table-wrap">
      <table className="site-table">
        <caption>What Semester does, and who is official</caption>
        <thead>
          <tr>
            <th scope="col">Area</th>
            <th scope="col">Semester does</th>
            <th scope="col">Official authority</th>
          </tr>
        </thead>
        <tbody>
          {BOUNDARIES.map((b) => (
            <tr key={b.area}>
              <th scope="row">{b.area}</th>
              <td>{b.does}</td>
              <td>{b.authority}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <Section title="Why it is written down" id="sb-why">
      <p>
        A student should never wonder whether a Path Snapshot is a degree audit, and a registrar should never wonder
        whether Semester registered anyone. While the module is in Connect, it did not. Every fact in the app carries where it came from —{' '}
        <em>Institution verified</em>, <em>Imported</em>, <em>Student entered</em>, <em>Estimated</em> or{' '}
        <em>Needs review</em> — and a planning estimate is labelled as one wherever it appears.
      </p>
      <p><a href={href(config, '/platform/service-map/')}>The service map</a> shows how the pieces fit.</p>
    </Section>
  </>
);

// ── /start/ ─────────────────────────────────────────────────────────────────

const STUDENT_STEPS: [string, string][] = [
  ['Open Semester', 'In the browser. Nothing to install and no account needed; your work stays on this device until you say otherwise.'],
  ['A short introduction', 'Two screens that say what the app does and what it will not do.'],
  ['Add your first course', 'Upload a syllabus, or type a course code. Deadlines and a study guide are read out of it, each marked with its source.'],
  ['Today shows one next step', 'The most important thing, why it is there, and where the fact came from.'],
  ['Take it', 'Open the deadline, mark it done, snooze it, or say it is wrong. Saying it is wrong is a first-class action.'],
  ['Build your Path Snapshot', 'Enter your requirements and credits when you are ready. It is a planning estimate, and it says so.'],
  ['Keep it across devices', 'Add an account when you want your work to follow you. Everything still works without one.'],
];

const INSTITUTION_STEPS: [string, string][] = ROLLOUT_PHASES.map((phase) => [phase.name, phase.outcome]);

export const StartPage: Page = ({ config }) => (
  <>
    <Hero title="What happens after you get started" lead="For a student, a few minutes. For an institution, a measured pilot. Here is each, step by step." />
    <Section title="For students" id="st-students">
      <Flow steps={STUDENT_STEPS} label="A student’s first session" />
      <p className="site-actions">
        <a className="site-button" href={href(config, '/signup/')}>Get started free</a>
        <a href={appHref(config, 'demo/')}>Look at the demo first</a>
      </p>
    </Section>
    <Section title="For institutions" id="st-institutions">
      <Flow steps={INSTITUTION_STEPS} label="An institution’s phased adoption" />
      <p className="site-small">
        No institution has gone through this yet; the first will be the pilot, and its steps are written down before it starts.{' '}
        <a href={href(config, '/institutions/')}>What a pilot looks like</a> · <a href={mail('Semester%20pilot')}>Talk to us</a>
      </p>
    </Section>
  </>
);

// ── /demo/ ──────────────────────────────────────────────────────────────────

export const Demo: Page = ({ config }) => (
  <>
    <Hero title="Explore a sample university" lead="A fictional institution with fictional students, staff and courses. Pick a role, click around, change things, and reset it when you are done. You do not need an account.">
      <p className="site-actions">
        <a className="site-button" href={appHref(config, 'demo/')}>Open the sample university</a>
        <a href={href(config, '/product/')}>How Semester works</a>
      </p>
      <p className="site-small">
        Every record in it is made up, and it says so on every screen. Nothing you do there is sent to Semester: it is not connected to any
        account or any university system, what you change stays in your browser, and a reset button starts it again.
      </p>
    </Hero>
    <Section title="Who you can be" id="dm-roles">
      <p>Switch role from the label at the corner of the demo. Each role opens its own workspace, and each shows only what that role is allowed to see.</p>
      <ul className="site-cards">
        {Object.entries(ROLE_WORKSPACE_TITLES).map(([role, title]) => (
          <li key={role}>
            <h3>{title.replace(/ workspace$/i, '')}</h3>
            <p>{[...new Set(ROLE_WORKSPACE_FUNCTIONS[role as keyof typeof ROLE_WORKSPACE_TITLES].map((f) => f.label))].join('; ')}.</p>
          </li>
        ))}
      </ul>
      <p className="site-small">
        Not in the sample yet: a registrar view, a gift-officer view, and a K-12 parent view. Those belong to modules that are planned and not built, and the
        demo does not pretend otherwise. The <a href={href(config, '/platform/system-boundaries/')}>replacement map</a> says where each stands.
      </p>
    </Section>
    <Section title="After the demo" id="dm-after">
      <p>Not everyone came with the same problem, so not everyone should leave with the same next step.</p>
      <ul className="site-cards">
        {DEMO_PATHS.map((d) => (
          <li key={d.who}>
            <h3>{d.who}</h3>
            <p>You came {d.came}.</p>
            <p><a href={d.mail ? mail(d.to) : d.app ? appHref(config, d.to) : href(config, d.to)}>{d.action}</a></p>
          </li>
        ))}
      </ul>
    </Section>
  </>
);

// ── /trust/product-quality/ ─────────────────────────────────────────────────

export const ProductQuality: Page = ({ config }) => {
  const stamp = config.build
    ? `Build ${config.build.commit.slice(0, 10)}, made ${config.build.at}.`
    : 'This copy of the site was built without a stamp, so it does not show a version. The live app updates within minutes of a change landing.';
  const rows: [string, ReactNode][] = [
    ['Current public build', stamp],
    ['Release cadence', 'Every change that lands reaches the live page within a few minutes. There is no separate release train, so there is no release date to wait for.'],
    ['Known critical issues', <>None open. Incidents are listed, as they happen, on the <a href={appHref(config, 'status.html')}>status page</a>, which checks the service from your own browser.</>],
    ['Latest accessibility review', 'Automated on every build: every control has a name, every page has one main region and a skip link, and an axe-core run starts each case from the page’s own title. No human evaluation yet, so no conformance report (VPAT).'],
    ['Latest security evidence review', 'Every change is scanned for leaked credentials; database access is enforced by row-level policy and tested as a second account in every build; a software bill of materials is produced for every deploy. No independent penetration test and no SOC 2 report.'],
    ['Service health', <>Live, from your browser, on the <a href={appHref(config, 'status.html')}>status page</a>. It also shows the last 90 days, recorded hourly from the day recording began; a percentage there states how many checks and days it rests on, and none is a promise.</>],
    ['Integration status', 'No institutional connection is live today. Calendar subscriptions a student adds are the only connections, and they are read-only.'],
    ['Planned maintenance', 'None scheduled. When there is, it will be on the status page and, in the app, only on the screens it affects.'],
    ['Major changes', 'Every change a tester can notice is written down, dated by when it reached the live page, including things taken away again.'],
  ];
  return (
    <>
      <Hero title="Product quality" lead="Beyond “is it up”: what is checked, what is known, and what is deliberately not published yet." />
      <Section title="Where it stands" id="pq-now">
        <dl className="site-dl">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <Section title="What is not published, and why" id="pq-not">
        <ul>
          <li>No uptime commitment, response time or satisfaction score. The status page shows measured uptime with the checks behind it, but a measurement is not a commitment; a response time and a satisfaction score have not been measured for long enough to be real, current and interpretable, and a number that is not all three is worse than none.</li>
          <li>No customer names, logos or outcomes: there is no customer yet. <a href={href(config, '/proof/')}>How we show proof</a> when there is.</li>
        </ul>
        <p className="site-small">
          <a href={href(config, '/security/')}>Security</a> · <a href={href(config, '/accessibility/')}>Accessibility</a> · <a href={href(config, '/privacy/')}>Privacy</a>
        </p>
      </Section>
    </>
  );
};

// ── /launch/ ────────────────────────────────────────────────────────────────

export const Launch: Page = ({ config }) => (
  <>
    <Hero title="Your launch site" lead="When a department or institution signs, it gets a private page of its own, so the first day of implementation feels organised rather than improvised." />
    <Section title="What a launch site holds" id="la-holds">
      <Cards
        items={[
          ['Welcome', 'Who you are working with, and the one address to write to.'],
          ['Implementation timeline', 'The nine steps from discovery to outcome review, with your dates against them.'],
          ['Key contacts', 'Your champion, your reviewers and your Semester contact, by role.'],
          ['Training dates', 'Sessions for advisors, faculty and support staff.'],
          ['Launch FAQs', 'The questions your students and staff will ask, answered in your words.'],
          ['Communication templates', 'The campus launch kit, already adapted to your institution.'],
          ['Sign-in and connection status', 'Which connections are configured, which are being reviewed, and which are off.'],
          ['Known issues', 'What is open, who owns it and when it is expected to close.'],
          ['Support', 'How to reach a person during hypercare, and after.'],
          ['Status and go-live readiness', 'Each readiness item, and whether it is met.'],
        ]}
      />
    </Section>
    <Section title="How it is shared" id="la-shared">
      <p>
        By an expiring link, to named people at your institution, and recorded. It is not on this site and not indexed.
        No launch site exists yet, because no institution has signed; the first is built with the pilot.
      </p>
      <p><a href={href(config, '/start/')}>The nine steps</a> · <a href={href(config, '/resources/campus-launch-kit/')}>The campus launch kit</a></p>
    </Section>
  </>
);

// ── /pricing/how-it-works/ ──────────────────────────────────────────────────

export const HowWePrice: Page = ({ config }) => (
  <>
    <Hero title="How pricing works" lead="Semester Institutional is a proposed package delivered only after a separately approved paid pilot and phased implementation. Individual paid plans are planned, not on sale." />
    <Section title="Individual students" id="hp-individual">
      <p>
        A student pays for features, never for their own data. Free, Plus and Pro differ in how many plans and scenarios
        you can keep and compare, not in what Semester knows about you. Export, deletion and every plan you saved are on
        every plan, including Free, and stay yours if a paid plan lapses.
      </p>
      <p><a href={href(config, '/pricing/')}>The plans and their planned prices</a></p>
    </Section>
    <Section title="Departments and institutions" id="hp-institution">
      <p>The institution buys the full package. Four scope variables move the price and delivery plan:</p>
      <ul>
        <li>How many students are in the cohort, and later the population.</li>
        <li>Which capabilities enter the first pilot and when the remaining capabilities phase in.</li>
        <li>Which official systems are connected, each of which is project work to set up.</li>
        <li>The support tier: who you can reach, how fast, and in which critical periods.</li>
      </ul>
    </Section>
    <Section title="Enterprise" id="hp-enterprise">
      <p>The same four, across more than one campus or tenant, plus whatever custom terms, residency or review obligations the agreement carries. Custom is a word for a list, and the list is written down.</p>
    </Section>
    <Section title="What implementation includes" id="hp-implementation">
      <p>
        The full path on <a href={href(config, '/start/')}>what happens after you sign</a>: agreement, pilot,
        integration, parallel run, migration, cutover and expansion, with training and hypercare included.
        Implementation is priced once, as a project, not as a running fee.
      </p>
    </Section>
    <Section title="What a support tier means" id="hp-support">
      <p>
        A tier names three things: the hours a person answers, how fast a first response comes for each severity, and
        whether registration mornings and finals weeks are covered as critical periods. No service-level agreement is
        offered yet. The figures one would commit to are drafted, and will be offered only once monitoring has shown they
        can be met.
      </p>
    </Section>
    <Section title="What AI usage means commercially" id="hp-ai">
      <p>
        AI runs through a metered gateway, so usage is measured and can be capped. A student plan’s price is the price:
        there is no per-question charge. An institutional agreement carries an allowance, and nothing beyond it is billed
        without the institution agreeing first.
      </p>
    </Section>
    <Section title="What migration costs cover" id="hp-migration">
      <p>
        Moving courses from an existing learning system is project work with your team: mapping, a rehearsal run, the
        real run, and verification. It is priced as the project it is, and the rehearsal is not optional.
      </p>
    </Section>
    <Section title="How renewals will work" id="hp-renewals">
      <ul>
        <li>Annual terms, with the renewal price stated in writing before the notice period, never after it.</li>
        <li>No increase applied without notice, and no module added to a bill that nobody switched on.</li>
        <li>Leaving means a complete export in open formats, and deletion when you confirm it. Both are in the agreement.</li>
      </ul>
    </Section>
    <Section title="How you avoid surprise fees" id="hp-surprise">
      <p>
        Every line on an invoice maps to one of the drivers above. If something appears that does not, it is a mistake,
        and it is ours. Write to <a href={mail('Pricing%20question')}>{CONTACT_EMAIL}</a> with any question before or after a quote.
      </p>
    </Section>
  </>
);

// ── /resources/campus-launch-kit/ ───────────────────────────────────────────

export const CampusLaunchKit: Page = ({ config }) => (
  <>
    <Hero title="Campus launch kit" lead="Everything an institution needs to tell its campus about Semester, ready to adapt. Square brackets mark what to change." />
    <Section title="Before you send anything" id="lk-before">
      <ul>
        <li>Say what is connected and what is not. If no official system is connected, say so; students will find out either way.</li>
        <li>Say that Semester never registers anyone and never certifies a degree, in every message that mentions registration or progress.</li>
        <li>Say that an account is optional and that a student’s data is theirs to export or delete.</li>
      </ul>
    </Section>
    <Section title="Student email" id="lk-student">
      <Template
        title="To students in the pilot cohort"
        lines={[
          'Subject: A clearer picture of your semester, from [Institution]',
          '',
          'Hello [first name],',
          '',
          'You are one of [number] students invited to try Semester this term. It shows where you stand,',
          'what matters now and the one next step worth taking, with the source of every fact beside it.',
          '',
          'What it does: reads your syllabi into deadlines and a study guide, checks a registration plan for',
          'time conflicts, and prepares a snapshot you can bring to your advisor.',
          'What it does not do: register you, drop you, or tell you your degree is complete. [Institution]’s',
          'own systems do that, and Semester points you to them.',
          '',
          'No account is needed. Your data stays on your device unless you choose to add one, and you can',
          'export or delete it at any time. Start here: [link]',
          '',
          '[Name], [role]',
        ]}
      />
    </Section>
    <Section title="Advisor email" id="lk-advisor">
      <Template
        title="To advisors whose students are in the cohort"
        lines={[
          'Subject: What your advisees may bring to their next meeting',
          '',
          'Some of your advisees are trying Semester this term. Before a meeting, a student can prepare a',
          'Path Snapshot — their requirements and credits as they entered them — and a short agenda.',
          '',
          'Three things to know. It is the student’s own planning estimate, not a degree audit. You see only what',
          'a student chooses to share, for as long as they choose, and they can revoke it. Nothing in it changes',
          'a record anywhere.',
          '',
          'A 30-minute walkthrough is on [date] at [time]: [link]. Questions to [contact].',
        ]}
      />
    </Section>
    <Section title="Faculty announcement" id="lk-faculty">
      <Template
        title="For a department meeting or faculty newsletter"
        lines={[
          'Students in [programme] are piloting Semester, a planning tool that reads a syllabus into deadlines',
          'and a study guide. Your syllabus is read only when a student uploads it, and only for that student.',
          '',
          'If your course has rules about AI use, Semester shows them to the student before its assistant',
          'answers, when you publish them in Course Studio. [Course Studio is / is not] switched on for',
          '[Institution] this term. Details and a short demo: [date], [place], [link].',
        ]}
      />
    </Section>
    <Section title="Registrar communication" id="lk-registrar">
      <Template
        title="To the registrar’s office"
        lines={[
          'Semester prepares students for registration: a plan checked for time conflicts, backup sections,',
          'and a checklist. It then hands off to [registration system] and does not register, add, drop or',
          'waitlist anyone.',
          '',
          'It holds no connection to [student information system] during the pilot. Students enter their own',
          'plans, and every planning estimate is labelled as one. Registration-day questions that reach us are',
          'routed to [office contact]; questions about the tool itself come to [Semester contact].',
        ]}
      />
    </Section>
    <Section title="Digital signage" id="lk-signage">
      <Template
        title="One screen, ten words or fewer per line"
        lines={[
          'Know where you stand. Know what’s next.',
          'Semester — now in the [programme] pilot.',
          'No account needed. Your data stays yours.',
          '[short link]',
        ]}
      />
    </Section>
    <Section title="Social posts" id="lk-social">
      <Template
        title="Three posts, for the institution’s own channels"
        lines={[
          '1. Registration is [date]. Students in the [programme] pilot can check a plan for conflicts and pick',
          '   backups in Semester before then. [link]',
          '2. Meeting your advisor? A Path Snapshot puts your requirements and credits on one page — as a planning',
          '   estimate you can talk through together. [link]',
          '3. What Semester will not do: register you, or tell you your degree is done. That stays with',
          '   [Institution]. What it will do: show you the next step, with its source. [link]',
        ]}
      />
    </Section>
    <Section title="FAQ" id="lk-faq">
      <dl className="site-dl">
        <div><dt>Do I need an account?</dt><dd>No. Everything works on your device. An account keeps your work in step across devices.</dd></div>
        <div><dt>Does it register me?</dt><dd>No. It helps you plan and check conflicts; you register in [registration system].</dd></div>
        <div><dt>Is the Path Snapshot official?</dt><dd>No. It is a planning estimate from what you entered. Confirm anything that matters with your advisor and the registrar.</dd></div>
        <div><dt>Who can see my plan?</dt><dd>Nobody, unless you share it, and then only who you chose, for as long as you chose.</dd></div>
        <div><dt>Can I get my data out, or delete it?</dt><dd>Yes, both, at any time, on every plan.</dd></div>
      </dl>
    </Section>
    <Section title="Privacy and source labels, explained" id="lk-labels">
      <p>Every fact in Semester carries one of five labels. Put this explanation wherever students first meet them.</p>
      <dl className="site-dl">
        <div><dt>Institution verified</dt><dd>From an official system your institution connected. None is connected during the pilot, so you will not see this label yet.</dd></div>
        <div><dt>Imported</dt><dd>Read from a file or a calendar you added: a syllabus, a subscribed calendar.</dd></div>
        <div><dt>Student entered</dt><dd>You typed it.</dd></div>
        <div><dt>Estimated</dt><dd>Semester worked it out from the above, and could be wrong. A Path Snapshot is always Estimated.</dd></div>
        <div><dt>Needs review</dt><dd>Something changed, or two sources disagree, and a person should look.</dd></div>
      </dl>
    </Section>
    <Section title="Launch event agenda" id="lk-agenda">
      <Flow
        label="A 45-minute launch session"
        steps={[
          ['Why (5 min)', 'The registration or advising moment this pilot is about, in the institution’s words.'],
          ['What it is and is not (5 min)', 'The system boundaries, read aloud: what Semester does, and who stays official.'],
          ['Live walk-through (15 min)', 'A syllabus in, Today out, a plan checked for conflicts, a Path Snapshot prepared.'],
          ['Privacy and labels (5 min)', 'The five source labels, sharing, export and deletion.'],
          ['Accessibility (5 min)', 'How to change text size, contrast and motion, and where to report a barrier.'],
          ['Questions (10 min)', 'And where to send the ones that come later.'],
        ]}
      />
    </Section>
    <Section title="Accessibility communication" id="lk-a11y">
      <ul>
        <li>Say in every announcement how to report an accessibility barrier, and that it is treated as a bug.</li>
        <li>Offer the walkthrough with captions and a transcript, and send the slides in advance.</li>
        <li>Name the accommodations route your campus already has; Semester does not replace it.</li>
        <li>State plainly that there is no conformance report yet, and what is checked on every build instead.</li>
      </ul>
      <p className="site-small">
        <a href={href(config, '/accessibility/')}>Accessibility at Semester</a> · <a href={href(config, '/launch/')}>Your launch site</a> · <a href={href(config, '/institutions/')}>For institutions</a>
      </p>
    </Section>
    <Start config={config} />
  </>
);
