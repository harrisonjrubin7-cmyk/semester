import type { ReactNode } from 'react';
import { CONTACT_EMAIL, type SiteConfig } from './config';
import { href } from './Layout';
import { Cards, Hero, Section } from './pages';
import { INSTEAD, MENTOR_FLOW, QUESTIONS, ROLLOUT } from '../community/connect';

/*
 * The community pages: the Semester Community, ambassadors, stories,
 * partners and events.
 *
 * The rules in `pages.tsx` hold here word for word, and two more from the
 * community brief these pages come from. Nothing here is a feed, a count or
 * a ranking; and nothing here says a programme is running that is not. No
 * community programme is switched on for any campus today
 * (`community_programs` defaults to off), no ambassador has been recruited,
 * no story has been published, no partner is listed and no event is
 * scheduled. Every page says its own version of that, and offers the one
 * real next step — a person, by mail — rather than a form that leads to a
 * queue nobody reads. The data on these pages is what
 * `lib/connectregister.ts` cites.
 */

type Page = (props: { config: SiteConfig }) => ReactNode;

const mail = (subject: string) => `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`;

/** The line every page here carries, held by `site.test.tsx`. */
export const NOT_ON_YET = 'No community programme is switched on for any campus today.';

// ── /community/ ─────────────────────────────────────────────────────────────

/** Who the community is for, and what each gets. */
export const AUDIENCES: [string, string][] = [
  ['For students', 'Find clarity, resources, peers, clubs, mentors and opportunities — at the moment each is useful, not in a feed.'],
  ['For campus organizations', 'Reach the right students, manage events, recruit members and build community in a space your school has verified.'],
  ['For mentors and alumni', 'Give back through structured, student-led connections that are time-limited and consented on both sides.'],
  ['For educators and staff', 'Share verified resources and support students without adding another disconnected platform.'],
  ['For ambassadors', 'Help shape a more connected university experience, and be recognised for it.'],
  ['For institutions', 'Bring campus communities, services and opportunities into one governed system, switched on programme by programme.'],
];

/** The calls to action, each with somewhere real to go. */
export const CALLS = (config: SiteConfig): [string, string][] => [
  ['Join the student community', href(config, '/signup/')],
  ['Become a campus ambassador', href(config, '/community/ambassadors/')],
  ['Register your organization', mail('Register an organization with Semester')],
  ['Become a mentor', mail('Mentoring with Semester')],
  ['Share your story', href(config, '/community/stories/')],
  ['Partner with Semester', href(config, '/community/partners/')],
  ['Apply for a campus pilot', href(config, '/institutions/')],
];

export const Community: Page = ({ config }) => (
  <>
    <Hero title="The Semester Community" lead="The trusted network for campus life, learning, opportunity and belonging — built around real student goals, not a scrolling feed.">
      <p className="site-actions">
        {CALLS(config).slice(0, 2).map(([label, to], i) => (
          <a key={label} className={i === 0 ? 'site-button' : undefined} href={to}>{label}</a>
        ))}
      </p>
    </Hero>
    <Section title="What it helps a student answer" id="cm-questions">
      <ul>
        {QUESTIONS.map((q) => <li key={q}>{q}</li>)}
      </ul>
    </Section>
    <Section title="Who it is for" id="cm-who">
      <Cards items={AUDIENCES} />
    </Section>
    <Section title="What we build instead of a social network" id="cm-instead">
      <div className="site-scroll">
        <table className="site-table">
          <caption>The distinction the community layer is held to</caption>
          <thead>
            <tr><th scope="col">Not this</th><th scope="col">This</th></tr>
          </thead>
          <tbody>
            {INSTEAD.map((i) => (
              <tr key={i.avoid}><th scope="row">{i.avoid}</th><td>{i.build}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Peer matching, mentor connections, alumni discovery, employer visibility and sharing are opt-in, revocable and
        purpose-limited. Nothing about grades, attendance, health, money or messages is read to suggest a person or a
        group, and every suggestion says why it appeared. There is no follower count, no popularity ranking and no
        leaderboard of anybody.
      </p>
    </Section>
    <Section title="In what order" id="cm-order">
      <p>Verified connections first; anything broad last. {NOT_ON_YET} Each programme is switched on for one campus at a time, after its launch gates are passed.</p>
      <ol>
        {ROLLOUT.map((r) => <li key={r}>{r}</li>)}
      </ol>
    </Section>
    <Section title="Take a step" id="cm-calls">
      <ul className="site-cards">
        {CALLS(config).map(([label, to]) => (
          <li key={label}><h3><a href={to}>{label}</a></h3></li>
        ))}
      </ul>
      <p className="site-small">
        Registering an organization, mentoring and partnering are a message to a person, read by a person. No response
        time is promised yet. <a href={href(config, '/research/')}>The design-partner programmes</a>{' · '}
        <a href={href(config, '/trust/data-and-ai-transparency/')}>What Semester holds and who sees it</a>
      </p>
    </Section>
  </>
);

// ── /community/ambassadors/ ─────────────────────────────────────────────────

export const AMBASSADOR_DOES: string[] = [
  'Introduce Semester to classmates and campus organizations.',
  'Test new features and report friction.',
  'Host planning, study or career-preparation sessions.',
  'Create student-led content.',
  'Gather structured feedback.',
  'Help organize campus onboarding.',
  'Recruit clubs, mentors and event partners.',
  'Represent accessibility, transfer, commuter, athlete, graduate or other student perspectives.',
];

export const AMBASSADOR_GETS: [string, string][] = [
  ['A clear code of conduct', 'What an ambassador may say about Semester, and what they may never say about another student.'],
  ['Training and support', 'Before the first session, and a person to ask afterwards.'],
  ['Defined time expectations', 'A number of hours a term, agreed in writing, never more.'],
  ['Recognition you can use', 'Verified leadership on your record and in your portfolio.'],
  ['A private ambassador community', 'Other ambassadors, and the people building Semester.'],
  ['No access to other students’ data', 'An ambassador sees how many people came in through their link and how many are still here, and nothing about any of them.'],
];

export const Ambassadors: Page = ({ config }) => (
  <>
    <Hero title="Campus ambassadors" lead="Early campus density comes from students who believe the thing works and say so in their own words. That is the whole programme.">
      <p className="site-actions">
        <a className="site-button" href={mail('Campus ambassador')}>Ask to be an ambassador</a>
        <a href={href(config, '/community/')}>The Semester Community</a>
      </p>
    </Hero>
    <Section title="What an ambassador does" id="am-does">
      <ul>
        {AMBASSADOR_DOES.map((d) => <li key={d}>{d}</li>)}
      </ul>
    </Section>
    <Section title="What an ambassador gets" id="am-gets">
      <Cards items={AMBASSADOR_GETS} />
    </Section>
    <Section title="The boundaries" id="am-bounds">
      <p>
        An ambassador speaks for themselves and is never paid per sign-up. A referral link produces two numbers — how
        many people arrived through it and how many are still here — and nothing else, and that is held by the
        database rather than by a policy. Any stipend or referral structure is written down before it exists, and
        only if it is legally and operationally appropriate at that campus.
      </p>
      <p>
        {NOT_ON_YET} Applications open with the first campus pilot; until then a message to{' '}
        <a href={mail('Campus ambassador')}>{CONTACT_EMAIL}</a> is read by a person and answered when the programme opens.
      </p>
    </Section>
  </>
);

// ── /community/stories/ ─────────────────────────────────────────────────────

export const PROMPTS: string[] = [
  'How I planned my term.',
  'How I prepared for registration.',
  'How I found tutoring.',
  'How I balanced work, classes and a club.',
  'How I prepared for a career fair.',
  'How I transferred credits.',
  'How I made my first semester less overwhelming.',
  'My Semester Wrapped reflection.',
];

export const CONSENT: [string, string][] = [
  ['Anonymous', 'Your story, with nothing that identifies you, including the details that would on a small campus.'],
  ['Attributed', 'Your first name, your programme and your year, and only what you wrote.'],
  ['Campus-only', 'Shown to signed-in students at your school, not on the public site.'],
  ['Public', 'On this site and in Semester’s own social posts, exactly as you approved it.'],
];

export const Stories: Page = ({ config }) => (
  <>
    <Hero title="Student stories" lead="Real campus journeys, in the student’s own words, published only with their permission and only as they chose.">
      <p className="site-actions">
        <a className="site-button" href={mail('A story for Semester')}>Tell your story</a>
        <a href={href(config, '/community/')}>The Semester Community</a>
      </p>
    </Hero>
    <Section title="What we ask about" id="st-prompts">
      <ul>
        {PROMPTS.map((p) => <li key={p}>“{p}”</li>)}
      </ul>
    </Section>
    <Section title="You choose how it appears" id="st-consent">
      <Cards items={CONSENT} />
      <p>
        You see the exact text before it goes anywhere, and you can withdraw it at any time; a withdrawn story comes
        down from this site and is not used again. Nothing private — your plan, your grades, your messages, anything
        you did in the app — is ever used for marketing without your explicit written permission, and a story is
        never written from it.
      </p>
    </Section>
    <Section title="Where stories stand" id="st-now">
      <p>
        No story has been published yet. The first will come from pilot students who chose to write one, and this
        page will show them here.
      </p>
    </Section>
  </>
);

// ── /community/partners/ ────────────────────────────────────────────────────

export const KINDS: string[] = [
  'Student organizations', 'Nonprofits and community partners', 'Alumni groups', 'Employers offering student opportunities',
  'Scholarship providers', 'Research labs', 'Campus departments', 'Mentorship programmes', 'Transfer partners',
  'Study-abroad partners', 'Local businesses offering student benefits', 'Campus offices',
];

/** The labels a listing can carry, matching what the database can say about a community. */
export const LABELS: [string, string][] = [
  ['Institution-verified', 'The institution recognises it and stands behind the listing.'],
  ['Organization-verified', 'The organization itself confirmed the listing and who runs it.'],
  ['Faculty-approved', 'A named member of faculty approved it, for a course or a department.'],
  ['Student-created', 'A student made it; it is theirs, and says so.'],
];

export const RULES: string[] = [
  'Every listing carries its label, who stands behind it, and when it was last reviewed.',
  'Visibility is never sold. A partner cannot pay to appear where a student browses by default, and a paid placement, if one ever exists, is labelled as one where it appears.',
  'A listing never sees who looked at it, and a partner never receives a student’s record.',
  'A listing that is not reviewed on time says so, and one that is disputed comes down while somebody looks.',
];

export const Partners: Page = ({ config }) => (
  <>
    <Hero title="Partner community directory" lead="A verified directory of the organizations, programmes and partners that offer students something, with a label on every one that says who stands behind it.">
      <p className="site-actions">
        <a className="site-button" href={mail('Partner with Semester')}>Ask to be listed</a>
        <a href={href(config, '/community/')}>The Semester Community</a>
      </p>
    </Hero>
    <Section title="Who can be listed" id="pa-kinds">
      <ul>
        {KINDS.map((k) => <li key={k}>{k}</li>)}
      </ul>
    </Section>
    <Section title="What the labels mean" id="pa-labels">
      <Cards items={LABELS} />
    </Section>
    <Section title="The rules" id="pa-rules">
      <ul>
        {RULES.map((r) => <li key={r}>{r}</li>)}
      </ul>
    </Section>
    <Section title="The directory" id="pa-now">
      <p>
        No partner is listed yet. The directory opens with the first campus pilot, with that campus’s own
        organizations first. To be considered, write to <a href={mail('Partner with Semester')}>{CONTACT_EMAIL}</a>; no
        response time is promised yet.
      </p>
    </Section>
  </>
);

// ── /community/events/ ──────────────────────────────────────────────────────

export const SESSIONS: string[] = [
  'Student planning workshops', 'Live registration-prep sessions', 'Study-with-intention sessions', 'Student-success conversations',
  'Career and portfolio workshops', 'Founder updates and product demonstrations', 'Campus ambassador information sessions',
  'Advisor and institution roundtables', 'Student panel discussions', 'Responsible AI in education discussions',
];

export const CARRIES: [string, string][] = [
  ['Registration', 'Free, with your name and an address to send the link to, and nothing else.'],
  ['Calendar save', 'One file for your own calendar; nothing is written to it for you.'],
  ['Accessibility information', 'Captions, the format, and how to ask for what you need, said before you register.'],
  ['Replay, transcript and captions', 'Every session, afterwards, on this page.'],
  ['Resource links', 'What was shown, as links you can open without an account.'],
  ['A follow-up path into Semester', 'The one thing the session prepared you to do, and where to do it.'],
];

export const Events: Page = ({ config }) => (
  <>
    <Hero title="Events and sessions" lead="Workshops, registration-prep sessions, roundtables and panels, hosted here, each with a replay and a next step.">
      <p className="site-actions">
        <a className="site-button" href={mail('Tell me about Semester events')}>Ask to be told about the first one</a>
        <a href={href(config, '/community/')}>The Semester Community</a>
      </p>
    </Hero>
    <Section title="What we will host" id="ev-kinds">
      <ul>
        {SESSIONS.map((s) => <li key={s}>{s}</li>)}
      </ul>
    </Section>
    <Section title="What every event carries" id="ev-carries">
      <Cards items={CARRIES} />
    </Section>
    <Section title="Coming up" id="ev-now">
      <p>
        No event is scheduled yet. The first is a registration-prep session for pilot students, before their
        registration window; it will be listed here with its date, and the{' '}
        <a href={href(config, '/tools/checklist/')}>registration checklist</a> is free now, without waiting for it.
      </p>
      <p className="site-small">
        The mentor flow every session on mentoring describes: {MENTOR_FLOW.map((s) => s.toLowerCase()).join('; ')}.
      </p>
    </Section>
  </>
);
