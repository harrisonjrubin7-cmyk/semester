import type { ReactNode } from 'react';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import { defaultNext } from '../lib/graduation';
import { STATUS_LABEL } from '../lib/ops/claims';
import { MODULES as CORE_MODULES } from './modules';
import { PROMISE, type SiteConfig } from './config';
import { Layout, href } from './Layout';
import * as B from './benchmark';
import * as C from './community';
import * as K from './k12';
import * as AD from './advancement';
import * as O from './oneos';
import * as M from './more';
import * as P from './pages';
import { TOOL_LIST, Tool, type ToolId, type ToolProps } from './tools/Tools';

/**
 * Every public page, rendered to static HTML.
 *
 * Used by `scripts/build-site.mjs`, which writes the files, and by
 * `site.test.tsx`, which checks them — the same function, so what is tested is
 * what ships. Pages carry no script: the site must work, and be indexable,
 * with JavaScript switched off. The one exception is the four tool pages, which
 * load a single same-origin script to make the prerendered tool interactive.
 */

export interface Route {
  path: string;
  title: string;
  description: string;
  Page: (props: { config: SiteConfig }) => ReactNode;
  /** Set on a tool page: the page loads `tools/tools.js` to hydrate it. */
  tool?: ToolId;
}

export const ROUTES: Route[] = [
  { path: '/', title: `Semester — ${PROMISE}`, description: 'Semester shows students where they stand, what matters now and the next step worth taking, with the source of every fact beside it.', Page: P.Home },
  { path: '/product/', title: 'How Semester works', description: 'Today, My Path, Search, Plan and Me: five places, each answering one question a student has.', Page: P.Product },
  { path: '/students/', title: 'Semester for students', description: 'Plan registration, prepare for advising and see the next deadline first.', Page: P.Students },
  { path: '/institutions/', title: 'Semester for institutions', description: 'A small, measured pilot that turns fragmented systems into clearer student action.', Page: P.Institutions },
  { path: '/pricing/', title: 'Semester pricing', description: 'Free, Plus, Pro and Semester Institutional. During the pilot every student feature is free.', Page: P.Pricing },
  { path: '/tools/', title: 'Free tools from Semester', description: 'A graduation timeline calculator, schedule builder, registration checklist and advisor meeting planner.', Page: P.Tools },
  { path: '/resources/', title: 'Semester resources', description: 'Guides for registration, advising and planning a degree.', Page: P.Resources },
  { path: '/about/', title: 'About Semester', description: 'Why Semester exists and how it works with student data.', Page: P.About },
  { path: '/careers/', title: 'Careers at Semester', description: 'Help make college easier to navigate.', Page: P.Careers },
  { path: '/contact/', title: 'Contact Semester', description: 'How to reach the people who build Semester.', Page: P.Contact },
  { path: '/security/', title: 'Security at Semester', description: 'What protects student data today, and what is not done yet.', Page: P.Security },
  { path: '/privacy/', title: 'Privacy at Semester', description: 'Student data is the student’s: export or delete it at any time.', Page: P.Privacy },
  { path: '/accessibility/', title: 'Accessibility at Semester', description: 'Built toward WCAG 2.2 AA, with checks on every build and known gaps listed.', Page: P.Accessibility },
  { path: '/help/', title: 'Semester help', description: 'Answers to the questions students ask first.', Page: P.Help },
  { path: '/known-limitations/', title: 'Known limitations — Semester', description: 'What does not work yet for pilot users, what to do instead, and how to report something. Dated, and held to the code by a test.', Page: P.KnownLimitations },
  { path: '/launch-readiness/', title: 'Are we ready? — Semester', description: 'What runs today, what is built but not deployed, and what is still planned, for students, departments, institutions and reviewers.', Page: P.LaunchReadiness },
  { path: '/proof/', title: 'How Semester shows proof', description: 'No invented metrics, no unapproved logos, no causal claims without a method. The rules, written before there is proof to show.', Page: P.Proof },
  { path: '/legal/', title: 'Semester legal and policies', description: 'Every policy, its status, version and effective date. Nothing is in force yet, and this page says so.', Page: P.Legal },
  { path: '/login/', title: 'Log in to Semester', description: 'Sign in inside the Semester app.', Page: P.Login },
  { path: '/signup/', title: 'Get started with Semester', description: 'Start free, with no card and no account required.', Page: P.Signup },
  { path: '/account/', title: 'Your Semester account', description: 'Your profile, sign-in and data controls, in the Semester app.', Page: P.Account },
  { path: '/membership/', title: 'Your Semester membership', description: 'Plans, and what every plan always includes.', Page: P.Membership },
  // The platform, trust and buying pages (`more.tsx`): what is available to
  // whom, what stays official elsewhere, and what happens after a signature.
  { path: '/platform/availability/', title: 'What is available, to whom — Semester', description: 'Every capability by plan, each marked Available, Pilot, Planned or Services-led, so a plan is never mistaken for a product.', Page: M.Availability },
  { path: '/platform/service-map/', title: 'The Semester service map', description: 'Identity, planning, course learning, AI, integrations, support, status and export — and who decides what.', Page: M.ServiceMap },
  { path: '/platform/system-boundaries/', title: 'System boundaries — Semester', description: 'Area by area: what Semester does, and what remains authoritative with the registrar, the record system, faculty and students.', Page: M.SystemBoundaries },
  { path: '/start/', title: 'What happens after you get started — Semester', description: 'A student’s first session, step by step, and the nine steps of an institution’s pilot.', Page: M.StartPage },
  { path: '/demo/', title: 'Explore a sample university — Semester', description: 'A fictional university with fictional people. Try each role, change things, reset it, and take the next step that matches why you came.', Page: M.Demo },
  { path: '/trust/product-quality/', title: 'Product quality — Semester', description: 'What is checked on every build, what is known, and which measures are deliberately not published yet.', Page: M.ProductQuality },
  { path: '/launch/', title: 'Your launch site — Semester', description: 'The private page a department or institution gets when it signs: timeline, contacts, training, templates, known issues and readiness.', Page: M.Launch },
  { path: '/pricing/how-it-works/', title: 'How Semester pricing works', description: 'What drives individual, institutional and enterprise pricing, what implementation and migration cover, and how renewals avoid surprises.', Page: M.HowWePrice },
  { path: '/resources/campus-launch-kit/', title: 'Campus launch kit — Semester', description: 'Email, announcement, signage and social templates, an FAQ, the source-label explainer and a launch agenda, ready to adapt.', Page: M.CampusLaunchKit },
  // The benchmark pages (`benchmark.tsx`): the public standard, data and AI
  // transparency, the integration registry, the vocabulary, the AI governance
  // canvas and the research programmes.
  { path: '/semester-standard/', title: 'The Semester Standard', description: 'Eleven public commitments, each with what holds it in the code today and the gap where it is only partly held.', Page: B.SemesterStandard },
  { path: '/trust/data-and-ai-transparency/', title: 'Data & AI Transparency — Semester', description: 'What information Semester uses, where it came from, who can access it, how long it is kept, and when AI is involved, each line linked to what holds it.', Page: B.DataAndAITransparency },
  { path: '/platform/integrations/', title: 'Integrations and standards — Semester', description: 'Every standard Semester supports or intends to — LTI, OneRoster, SSO, SCIM, Caliper, QTI, Open Badges, CLR — each with its status word.', Page: B.Integrations },
  { path: '/platform/vocabulary/', title: 'The words we use — Semester', description: 'Nine terms, what each means and the page each lives on: Student Action Layer, Academic Navigation, No Wrong Door and six more.', Page: B.Vocabulary },
  { path: '/resources/ai-governance-canvas/', title: 'AI Governance Readiness Canvas — Semester', description: 'Ten boxes an institution fills in before it turns on an assistant: allowed, restricted and prohibited uses, sources, review, data, retention, escalation.', Page: B.AIGovernanceCanvas },
  { path: '/research/', title: 'Research and community — Semester', description: 'The Academic Friction Index, its method set before its data, and the design-partner council, clinics, advisory network and design challenge.', Page: B.Research },
  // The one-operating-system pages (`oneos.tsx`): the architecture the second
  // brief asked for and the comparison, each area and row at the register's word.
  { path: '/platform/one-operating-system/', title: 'One Operating System. Every Student Moment. — Semester', description: 'The student at the centre and nine areas around them, each with what connects, what stays official, and the register’s word for where it stands today.', Page: O.OneOperatingSystem },
  { path: '/platform/why-not-another-tool/', title: 'Why not another tool? — Semester', description: 'The traditional approach beside the Semester approach, eight rows, each with the register’s word for where Semester stands today.', Page: O.WhyNotAnotherTool },
  // The community pages (community.tsx).
  { path: '/community/', title: 'The Semester Community', description: 'Students, organizations, mentors, educators, ambassadors and institutions: what each gets, what is built instead of a social network, and in what order.', Page: C.Community },
  { path: '/community/ambassadors/', title: 'Campus ambassadors — Semester', description: 'What an ambassador does, what they get, and the boundaries: never paid per sign-up, and no access to other students’ data.', Page: C.Ambassadors },
  { path: '/community/stories/', title: 'Student stories — Semester', description: 'Real campus journeys in the student’s own words, published only with permission, anonymous, attributed, campus-only or public as they chose.', Page: C.Stories },
  { path: '/k-12/', title: 'Semester for high school', description: 'The K–12 edition, described and not yet offered: no district uses Semester, and nobody under 13 may hold an account.', Page: K.K12 },
  { path: '/solutions/advancement/', title: 'Alumni relations and fundraising', description: 'Planned, not built: no school uses Semester for alumni relations or fundraising, and no gift has been taken.', Page: AD.Advancement },
  { path: '/alumni/', title: 'For graduates', description: 'What a graduate can do in Semester today, and what a school’s alumni office might one day add. Nothing here asks for a gift.', Page: AD.Alumni },
  { path: '/community/partners/', title: 'Partner community directory — Semester', description: 'Who can be listed, the four verification labels, and the rules: visibility is never sold and a partner never sees a student’s record.', Page: C.Partners },
  { path: '/community/events/', title: 'Events and sessions — Semester', description: 'Workshops, registration-prep sessions, roundtables and panels, each with registration, calendar save, accessibility information, a replay and a next step.', Page: C.Events },
  ...TOOL_LIST.map(
    (t): Route => ({
      path: `/tools/${t.id}/`,
      title: `${t.title} — Semester`,
      description: t.description,
      tool: t.id,
      Page: ({ config }) => <P.ToolPage config={config} id={t.id} title={t.title} lead={t.lead} body={toolMarkup(t.id)} />,
    }),
  ),
];

/**
 * The tool's first render, and the props it used, for `client.tsx` to hydrate.
 *
 * `renderToString` rather than static markup: its text-node separators are
 * what lets hydration match adjacent text ("15 credits · no conflicts") without
 * a mismatch. The next term is fixed here, at build time, and handed to the
 * client in the page, so both renders agree on it.
 */
export function toolMarkup(id: ToolId, now = new Date()): { html: string; props: string } {
  const props: ToolProps = { next: defaultNext(now) };
  if (id === 'stack') {
    props.statuses = Object.fromEntries(CORE_MODULES.map((m) => [m.id, STATUS_LABEL[m.status]]));
  }
  return { html: renderToString(<Tool id={id} props={props} />), props: JSON.stringify(props) };
}

/** Escaped for an attribute or a `<title>`. */
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * The page's own content-security policy. No script at all on the static
 * pages, which makes an injected one inert rather than merely unlikely.
 */
export const SITE_CSP =
  "default-src 'self'; script-src 'none'; style-src 'self'; img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'";

/**
 * A tool page's policy: the same, except that scripts from the site's own
 * origin may run — the one bundled `tools/tools.js`, nothing inline, nothing
 * from elsewhere. `connect-src 'none'` holds the tools to their word that
 * nothing entered is sent anywhere.
 */
export const TOOL_CSP = SITE_CSP.replace("script-src 'none'", "script-src 'self'").replace("default-src 'self';", "default-src 'self'; connect-src 'none';");

export function renderPage(route: Route, config: SiteConfig): string {
  const body = renderToStaticMarkup(
    <Layout config={config} path={route.path}>
      <route.Page config={config} />
    </Layout>,
  );
  const canonical = config.origin ? `${config.origin}${href(config, route.path)}` : '';
  const image = config.origin ? `${config.origin}${href(config, '/og.png')}` : '';
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<meta http-equiv="Content-Security-Policy" content="${esc(route.tool ? TOOL_CSP : SITE_CSP)}">`,
    `<title>${esc(route.title)}</title>`,
    `<meta name="description" content="${esc(route.description)}">`,
    '<meta name="theme-color" content="#090a0e">',
    `<meta property="og:title" content="${esc(route.title)}">`,
    `<meta property="og:description" content="${esc(route.description)}">`,
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="Semester">',
    '<meta name="twitter:card" content="summary">',
    canonical ? `<link rel="canonical" href="${esc(canonical)}">` : '',
    canonical ? `<meta property="og:url" content="${esc(canonical)}">` : '',
    image ? `<meta property="og:image" content="${esc(image)}">` : '',
    `<link rel="icon" href="${esc(href(config, '/icon.svg'))}" type="image/svg+xml">`,
    `<link rel="stylesheet" href="${esc(href(config, '/site.css'))}">`,
    '</head>',
    route.tool ? `<body>${body}\n<script type="module" src="${esc(href(config, '/tools/tools.js'))}"></script></body>` : `<body>${body}</body>`,
    '</html>',
    '',
  ]
    .filter(Boolean)
    .join('\n');
}

export interface Built {
  file: string;
  content: string;
}

/** Every file the site is made of, apart from the stylesheet, fonts and icons the script copies. */
export function renderSite(config: SiteConfig): Built[] {
  const pages = ROUTES.map((r) => ({ file: `${r.path.replace(/^\//, '')}index.html`, content: renderPage(r, config) }));
  const extra: Built[] = [
    { file: 'robots.txt', content: `User-agent: *\nAllow: /\n${config.origin ? `Sitemap: ${config.origin}${href(config, '/sitemap.xml')}\n` : ''}` },
  ];
  if (config.origin) {
    const urls = ROUTES.map((r) => `  <url><loc>${esc(`${config.origin}${href(config, r.path)}`)}</loc></url>`).join('\n');
    extra.push({
      file: 'sitemap.xml',
      content: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    });
  }
  return [...pages, ...extra];
}
