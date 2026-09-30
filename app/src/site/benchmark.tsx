import type { ReactNode } from 'react';
import { CONTACT_EMAIL, type SiteConfig } from './config';
import { appHref, href } from './Layout';
import { Cards, Hero, Section } from './pages';
import { StatusBadge, StatusLegend } from './claims';
import { claim } from '../lib/ops/claims';
import { STANDARD, summary } from '../lib/standard';
import { AI_SHOWS, ARTIFACT_WORD, CATEGORIES, CONTACTS, CONTROLS, LEGAL_CAVEAT, NEVER, artifacts, inventoryPhrases } from '../lib/transparency';
import { CREDENTIAL_LIFECYCLE, PRINCIPLES, STAGES, STANDARDS } from '../lib/interop';
import { TERMS } from '../lib/vocabulary';
import { MIN_COHORT } from '../lib/institution-ops';

/*
 * The benchmark pages: the Semester Standard, Data & AI Transparency, the
 * public integration registry, the vocabulary, the AI governance canvas and
 * the research and community programmes.
 *
 * The rules in `pages.tsx` hold here word for word, and one more from the
 * briefs these pages come from: nothing here is "we take privacy seriously".
 * Every sentence names a thing that is held, where it is held, or a gap. The
 * tables are data (`lib/standard.ts`, `lib/transparency.ts`, `lib/interop.ts`,
 * `lib/vocabulary.ts`), each with a test that holds its paths to the tree, so
 * a page cannot describe a check nobody wrote.
 */

type Page = (props: { config: SiteConfig }) => ReactNode;

const mail = (subject: string) => `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`;

const HELD_WORD = { held: 'Held', partly: 'Partly held', owed: 'Owed' } as const;

// ── /semester-standard/ ─────────────────────────────────────────────────────

export const SemesterStandard: Page = ({ config }) => (
  <>
    <Hero title="The Semester Standard" lead="A public standard with measurable commitments, each with what holds it today and what does not yet. Trust by Design means the gaps are on this page, not in a footnote." />
    <Section title="Where it stands" id="ss-now">
      <p>{summary()}</p>
      <p className="site-small">
        <strong>Held</strong> means a test or check in the code fails when the line is broken. <strong>Partly held</strong> means it holds on some surfaces and the gap says where it does not. <strong>Owed</strong> means it is stated and nothing holds it yet. This is a Source-Aware Student Experience described the way it is built: every line below is the same kind of claim as every fact in the app.
      </p>
    </Section>
    <Section title="The commitments" id="ss-lines">
      <div className="site-scroll">
        <table className="site-table">
          <caption>Every commitment, how it is measured, its status, what holds it, and the gap</caption>
          <thead>
            <tr><th scope="col">Commitment</th><th scope="col">Measured by</th><th scope="col">Status</th><th scope="col">Held by</th><th scope="col">Gap</th></tr>
          </thead>
          <tbody>
            {STANDARD.map((c) => (
              <tr key={c.id}>
                <th scope="row">{c.line}</th>
                <td>{c.measure}</td>
                <td><span className={`site-badge site-held-${c.status}`}>{HELD_WORD[c.status]}</span></td>
                <td>
                  <ul className="site-plain">
                    {c.holds.map((h) => (
                      <li key={h.path}><code>{h.path}</code> — {h.shows}</li>
                    ))}
                  </ul>
                </td>
                <td>{c.gap || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
    <Section title="Progress against it" id="ss-progress">
      <p>
        A progress report is published once a year of measurement exists behind it. None has, so none is published; when the first is, it will say for each line what moved, what did not, and the method. Until then this page is the report: it is rendered from the same data on every change.
      </p>
      <p className="site-small">
        <a href={href(config, '/trust/product-quality/')}>Product quality</a> · <a href={href(config, '/launch-readiness/')}>Are we ready?</a> · <a href={href(config, '/proof/')}>How we show proof</a>
      </p>
    </Section>
  </>
);

// ── /trust/data-and-ai-transparency/ ────────────────────────────────────────

export const DataAndAITransparency: Page = ({ config }) => (
  <>
    <Hero title="Data & AI Transparency" lead="What information Semester uses, where it came from, who can access it, how long it is kept, and when AI is involved — in plain language, each line linked to what holds it." />
    <Section title="Our plain-language commitment" id="dt-commit">
      <p>
        Semester helps people organise academic work, understand authorised information, and prepare for the next right action. You should be able to understand what information Semester uses, where it came from, who can access it, how long it is kept, and when AI is involved.
      </p>
      <p>
        Today Semester runs beside your institution’s official systems and takes a module over only when you switch it to Core. Either way it does not make official academic, financial-aid, registration, disciplinary, medical, legal or admissions decisions.
      </p>
      <p>
        When Semester shows information, provides an estimate, recommends an action or uses AI, three things are made clear:
      </p>
      <dl className="site-legend">
        <div><dt><strong>Source</strong></dt><dd>Where the information came from.</dd></div>
        <div><dt><strong>Scope</strong></dt><dd>Who can access it or act on it.</dd></div>
        <div><dt><strong>Status</strong></dt><dd>Whether it is current, verified, estimated, draft, pending, restricted, or needs review.</dd></div>
      </dl>
      <figure className="site-template">
        <figcaption>For example</figcaption>
        <pre>{'Requirement status: Estimated planning result\nSource: Institution-approved program information\nScope: Your private planning workspace\nStatus: Needs official degree-audit confirmation'}</pre>
      </figure>
    </Section>
    <Section title="What information we process" id="dt-what">
      <p>
        Only what a requested feature needs, what operating and securing the service needs, what the law requires, and what improves the product within these commitments. The table is built from the app’s own inventory — the same list the privacy screen is held to by a test — so it cannot name a category the app does not hold.
      </p>
      <div className="site-scroll">
        <table className="site-table">
          <caption>Information categories, with the inventory’s own words for each</caption>
          <thead>
            <tr><th scope="col">Category</th><th scope="col">Examples</th><th scope="col">Why it may be used</th><th scope="col">From the inventory</th></tr>
          </thead>
          <tbody>
            {CATEGORIES.map((c) => (
              <tr key={c.category}>
                <th scope="row">{c.category}</th>
                <td>{c.examples}</td>
                <td>{c.why}</td>
                <td>{c.note ? <span className="site-small">{c.note}</span> : inventoryPhrases(c).join('; ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="site-small">
        The retention rule for each is in the <a href={appHref(config, '#/privacy')}>privacy screen in the app</a> and the retention schedule below. Student work is kept until the student deletes it; the clocks that run are on records about it, not on it.
      </p>
    </Section>
    <Section title="How AI works in Semester" id="dt-ai">
      <p>
        Governed Campus AI means this: the assistant can summarise authorised material, create study prompts, explain concepts, organise what you provided, draft non-official material, and help you prepare questions for the right person or office. It does not make official determinations about registration, degree conferral, financial aid, accommodations, discipline, admissions, employment, health or any other high-impact matter.
      </p>
      <p>When AI is used, Semester shows:</p>
      <dl className="site-legend">
        {AI_SHOWS.map((s) => (
          <div key={s.what}><dt><strong>{s.what}</strong></dt><dd>{s.where}</dd></div>
        ))}
      </dl>
      <p className="site-small">The assistant’s modes are set by your school’s policy where one is in force, and by your own controls otherwise. <a href={href(config, '/platform/availability/')}>What is available, to whom</a>.</p>
    </Section>
    <Section title="Your choices and controls" id="dt-controls">
      <p>Student Data Agency is one list under Me in the app, in the order the questions come. Each row opens the screen where the control lives:</p>
      <ul>
        {CONTROLS.map((c) => (
          <li key={c.id}><strong>{c.label}</strong> — {c.sub}.</li>
        ))}
      </ul>
      <p className="site-small">Institutional customers may configure some features, access models, retention rules and AI controls under their agreement and applicable law; the <a href={href(config, '/platform/system-boundaries/')}>system boundaries</a> say what stays theirs.</p>
    </Section>
    <Section title="What Semester does not do" id="dt-never">
      <ul>
        {NEVER.map((n) => (
          <li key={n.path}>{n.line} <span className="site-small">Held by <code>{n.path}</code>: {n.shows}.</span></li>
        ))}
      </ul>
      <p className="site-small">{LEGAL_CAVEAT}</p>
    </Section>
    <Section title="Retention, deletion and portability" id="dt-retention">
      <p>
        Information is kept only for as long as the service, its security, the law, a contract or an approved retention rule needs it. The specific rule depends on the data type, the customer’s configuration, the law and whether a preservation obligation applies. Export, deletion, correction and restriction are requested through the account screens or the privacy contact below.
      </p>
      <p className="site-small"><a href={href(config, '/privacy/')}>Privacy</a> · the retention schedule is <code>RETENTION.md</code>, held to the database by a test.</p>
    </Section>
    <Section title="Questions, reports and documents" id="dt-contact">
      <ul>
        {CONTACTS.map((c) => (
          <li key={c.topic}><strong>{c.topic}:</strong> <a href={mail(c.subject)}>{CONTACT_EMAIL}</a> with “{c.subject}” in the subject; read by {c.seat}.</li>
        ))}
        <li><strong>Service status:</strong> <a href={appHref(config, 'status.html')}>the status page</a>, checked from your own browser.</li>
      </ul>
      <div className="site-scroll">
        <table className="site-table">
          <caption>The supporting documents this page rests on, and where each stands. None is in force.</caption>
          <thead>
            <tr><th scope="col">Document</th><th scope="col">Status</th><th scope="col">Where</th></tr>
          </thead>
          <tbody>
            {artifacts().map((a) => (
              <tr key={a.title}>
                <th scope="row">{a.title}{a.note ? <span className="site-small site-claim-scope">{a.note}</span> : null}</th>
                <td><span className="site-badge">{ARTIFACT_WORD[a.status]}</span></td>
                <td>{a.path ? <code>{a.path}</code> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="site-small">
        <a href={href(config, '/security/')}>Security</a> · <a href={href(config, '/accessibility/')}>Accessibility</a> · <a href={href(config, '/legal/')}>Legal</a> · <a href={href(config, '/platform/integrations/')}>Integrations</a>
      </p>
    </Section>
  </>
);

// ── /platform/integrations/ ─────────────────────────────────────────────────

const PRIORITY_WORD = { 1: 'Foundation', 2: 'After core value', 3: 'Credential phase' } as const;

export const Integrations: Page = ({ config }) => (
  <>
    <Hero title="Integrations and standards" lead="Every standard Semester supports or intends to, with the word the register gives it. What is planned is called planned; no certification is claimed before it is awarded." />
    <Section title="The registry" id="in-registry">
      <p>No institutional connection is live today. Each row prints the status word from the same register that holds the rest of this site to its word.</p>
      <div className="site-scroll">
        <table className="site-table">
          <caption>Standards by priority: what each is used for, which way data moves, its scope, and its status</caption>
          <thead>
            <tr><th scope="col">Standard</th><th scope="col">Used for</th><th scope="col">Direction</th><th scope="col">Scope</th><th scope="col">Timing</th><th scope="col">Status</th><th scope="col">Documentation</th></tr>
          </thead>
          <tbody>
            {STANDARDS.map((s) => {
              const c = claim(s.claim);
              return (
                <tr key={s.id} data-claim={c.id}>
                  <th scope="row">{s.standard}<span className="site-small site-claim-scope">{c.claim}</span></th>
                  <td>{s.use}</td>
                  <td>{s.direction}</td>
                  <td>{s.scope}</td>
                  <td>{PRIORITY_WORD[s.priority]}{s.timing !== 'foundation' && s.timing !== 'credential phase' && s.timing !== 'after core value' ? ` · ${s.timing}` : ''}</td>
                  <td><StatusBadge c={c} /><span className="site-small site-claim-scope">{c.scope}</span></td>
                  <td><code>{s.documentation}</code></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <StatusLegend />
    </Section>
    <Section title="How each is implemented" id="in-principles">
      <Cards
        items={[
          ['LTI', PRINCIPLES.lti.join(' ')],
          ['OneRoster', PRINCIPLES.oneroster.join(' ')],
          ['Caliper', PRINCIPLES.caliper.join(' ')],
        ]}
      />
      <p className="site-small">Learning analytics must not become surveillance: nothing here becomes a risk score, and nothing under n = {MIN_COHORT} is shown to an institution.</p>
    </Section>
    <Section title="Credentials" id="in-credentials">
      <p>A badge ships only when the achievement is real, evidence-backed, issuer-controlled and portable, and every step below is in place:</p>
      <ol className="site-flow" aria-label="The credential lifecycle">
        {CREDENTIAL_LIFECYCLE.map((step) => (
          <li key={step}><strong>{step}</strong></li>
        ))}
      </ol>
    </Section>
    <Section title="The 1EdTech plan, and where it stands" id="in-plan">
      <ol className="site-flow" aria-label="The four stages">
        {STAGES.map((st) => (
          <li key={st.n}>
            <strong>{st.title}</strong>
            <span>{st.steps.join(' ')} <em>{st.standing}</em></span>
          </li>
        ))}
      </ol>
      <p className="site-small">
        Interoperability is a customer right, not an enterprise upsell: export is on every plan. <a href={href(config, '/platform/availability/')}>What is available, to whom</a> · <a href={href(config, '/institutions/')}>For institutions</a> · technical questions to <a href={mail('Integrations')}>{CONTACT_EMAIL}</a>.
      </p>
    </Section>
  </>
);

// ── /platform/vocabulary/ ───────────────────────────────────────────────────

export const Vocabulary: Page = ({ config }) => (
  <>
    <Hero title="The words we use" lead="Nine terms, what each means, and the page each lives on. A term used once is not owned, so every one of these has a home and a definition that says what the thing is, never what it is better than." />
    <Section title="The terms" id="vo-terms">
      <dl className="site-legend">
        {TERMS.map((t) => (
          <div key={t.term}>
            <dt><strong>{t.term}</strong></dt>
            <dd>{t.means} <a href={href(config, t.where)}>Where it lives</a>.</dd>
          </div>
        ))}
      </dl>
    </Section>
    <Section title="What a term is not" id="vo-not">
      <p>A term is not a claim. A page may print a term beside a capability’s status word, never instead of one; <a href={href(config, '/launch-readiness/')}>the words that carry status</a> are six, and they come from a register a test holds.</p>
    </Section>
  </>
);

// ── /resources/ai-governance-canvas/ ────────────────────────────────────────

const CANVAS: [string, string][] = [
  ['Allowed uses', 'What students and staff may ask an assistant to do with course material, by course. Write it as verbs: summarise, quiz me, explain, draft a question for office hours.'],
  ['Restricted uses', 'What is allowed only under a condition: with citation, on a draft not the submission, after the instructor has published the rule.'],
  ['Prohibited uses', 'What is never allowed, and the words the syllabus uses for it, so the assistant and the student read the same sentence.'],
  ['Source rules', 'Which sources an answer may rest on — the course’s own material, the library’s databases, general knowledge — and which it must quote from.'],
  ['Human-review rules', 'Which outputs need a person before they count: anything graded, anything about a requirement, anything an office decides.'],
  ['Data boundaries', 'What the assistant may see: the course, the student’s own work, never grades of record or another person’s work; and what leaves the institution.'],
  ['Retention rules', 'How long a conversation is kept, by whom, and what the student can delete.'],
  ['Course-level configuration', 'Who sets the rule for a course, who may loosen it (nobody below the platform floor), and how a student sees it before asking.'],
  ['Escalation and incident process', 'Who a student or instructor tells when an answer is wrong, harmful or against policy, and what happens within a day.'],
  ['Student transparency language', 'The sentence a student reads before the first answer: what the assistant read, under whose policy, and what it cannot determine.'],
];

export const AIGovernanceCanvas: Page = ({ config }) => (
  <>
    <Hero title="AI Governance Readiness Canvas" lead="Ten boxes an institution fills in before it turns on an assistant, useful before any contract is signed. Print it, or copy it into your own document." />
    <Section title="The canvas" id="cv-boxes">
      <dl className="site-legend">
        {CANVAS.map(([box, prompt]) => (
          <div key={box}><dt><strong>{box}</strong></dt><dd>{prompt}</dd></div>
        ))}
      </dl>
    </Section>
    <Section title="How Semester answers the same ten" id="cv-semester">
      <p>
        For a course, the first eight boxes are what an instructor publishes in Course Studio and what the student sees before the assistant answers; the last two are the six reasons under every reply and the “How to read this answer” line. <a href={href(config, '/trust/data-and-ai-transparency/')}>Data & AI Transparency</a> says how, and <a href={href(config, '/platform/availability/')}>the availability matrix</a> says which of it is available to whom.
      </p>
      <p className="site-small">This canvas is guidance, not certification, and it is not legal advice. Questions to <a href={mail('AI governance canvas')}>{CONTACT_EMAIL}</a>.</p>
    </Section>
  </>
);

// ── /research/ ──────────────────────────────────────────────────────────────

const INDEX_QUESTIONS: string[] = [
  'Registration confusion',
  'Deadline discoverability',
  'Policy clarity',
  'Accessibility barriers',
  'Course-AI-policy ambiguity',
  'Support-routing friction',
  'Information freshness',
  'Mobile and keyboard barriers',
  'Student data-control awareness',
];

const PROGRAMMES: [string, string][] = [
  ['Campus design partners council', 'A small, diverse group — students, disability-services leaders, faculty, advisors, registrars, IT and security leaders, institutional researchers — meeting quarterly, with student participation compensated, themes and decisions published, no sensitive student information exposed, a conflicts-of-interest policy and accessible formats. No member yet; the charter exists.'],
  ['Open office hours and implementation clinics', 'Recurring, topic-specific sessions — LTI and OneRoster, accessible course content, AI policy configuration, student-data controls, change management, navigation audits, pilot measurement — teaching methods, never disguised demos. None scheduled yet.'],
  ['Student advisory network', 'A structured, paid programme: usability and accessibility testing, feature feedback, campus navigation research, content co-design, disclosed ambassador activity. Compensation is never tied to sharing data, referrals or positive feedback. Not yet running.'],
  ['“No Wrong Door” campus design challenge', 'A public challenge: choose one confusing student journey, map it, redesign it around clarity, source, ownership, accessibility and recovery, share a non-sensitive case study. Implementation workshops rather than a prize. Not yet announced.'],
];

export const Research: Page = ({ config }) => (
  <>
    <Hero title="Research and community" lead="The Academic Friction Index, and the programmes that will feed it. Nothing has been published yet, and this page says what will be measured and how before there is a number to show." />
    <Section title="The Academic Friction Index" id="re-index">
      <p>An annual public report on where students lose time and confidence navigating university systems, on nine questions:</p>
      <ul>
        {INDEX_QUESTIONS.map((q) => (
          <li key={q}>{q}</li>
        ))}
      </ul>
      <p>
        The method is set before the data: consented research only, sampling limitations stated, no fabricated ranking, no institution named without its written permission, and nothing under n = {MIN_COHORT} reported. No edition exists. The first will be published when a consented sample exists behind it, and not before.
      </p>
      <p className="site-small"><a href={href(config, '/proof/')}>How we show proof</a> applies to every number here.</p>
    </Section>
    <Section title="Programmes" id="re-programmes">
      <Cards items={PROGRAMMES} />
      <p className="site-small">
        To take part in any of these: <a href={mail('Research and community')}>{CONTACT_EMAIL}</a>. No response time is promised yet. The <a href={href(config, '/tools/navigation/')}>academic navigation diagnostic</a> is the self-assessment an institution can run today.
      </p>
    </Section>
  </>
);
