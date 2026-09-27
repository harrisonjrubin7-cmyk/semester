import type { ReactNode } from 'react';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import { defaultNext } from '../lib/graduation';
import { PROMISE, type SiteConfig } from './config';
import { Layout, href } from './Layout';
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
  { path: '/pricing/', title: 'Semester pricing', description: 'Free, Plus, Pro and Institution Access. During the pilot every student feature is free.', Page: P.Pricing },
  { path: '/tools/', title: 'Free tools from Semester', description: 'A graduation timeline calculator, schedule builder, registration checklist and advisor meeting planner.', Page: P.Tools },
  { path: '/resources/', title: 'Semester resources', description: 'Guides for registration, advising and planning a degree.', Page: P.Resources },
  { path: '/about/', title: 'About Semester', description: 'Why Semester exists and how it works with student data.', Page: P.About },
  { path: '/careers/', title: 'Careers at Semester', description: 'Help make college easier to navigate.', Page: P.Careers },
  { path: '/contact/', title: 'Contact Semester', description: 'How to reach the people who build Semester.', Page: P.Contact },
  { path: '/security/', title: 'Security at Semester', description: 'What protects student data today, and what is not done yet.', Page: P.Security },
  { path: '/privacy/', title: 'Privacy at Semester', description: 'Student data is the student’s: export or delete it at any time.', Page: P.Privacy },
  { path: '/accessibility/', title: 'Accessibility at Semester', description: 'Built toward WCAG 2.2 AA, with checks on every build and known gaps listed.', Page: P.Accessibility },
  { path: '/help/', title: 'Semester help', description: 'Answers to the questions students ask first.', Page: P.Help },
  { path: '/login/', title: 'Log in to Semester', description: 'Sign in inside the Semester app.', Page: P.Login },
  { path: '/signup/', title: 'Get started with Semester', description: 'Start free, with no card and no account required.', Page: P.Signup },
  { path: '/account/', title: 'Your Semester account', description: 'Your profile, sign-in and data controls, in the Semester app.', Page: P.Account },
  { path: '/membership/', title: 'Your Semester membership', description: 'Plans, and what every plan always includes.', Page: P.Membership },
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
