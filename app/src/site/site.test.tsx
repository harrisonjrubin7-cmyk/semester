import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTACT_EMAIL, DEFAULT_SITE, PROMISE, type SiteConfig } from './config';
import { ROUTES, renderPage, renderSite } from './render';
import { NOT_ON_YET } from './community';
import { BASELINE, districtReady } from '../lib/k12/requirements';
import { PARTS } from '../lib/advancement/edition';

/**
 * The public site, as it ships: the same `renderSite` the build script
 * writes to disk, read back as HTML.
 */

const pages = ROUTES.map((r) => ({ route: r, html: renderPage(r, DEFAULT_SITE) }));
const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;
const hrefs = (html: string) => [...html.matchAll(/<a [^>]*href="([^"]*)"/g)].map((m) => m[1]);

describe('every page', () => {
  it('covers the routes the brief names', () => {
    const want = ['/', '/product/', '/students/', '/institutions/', '/pricing/', '/tools/', '/resources/', '/about/', '/careers/', '/contact/', '/security/', '/privacy/', '/accessibility/', '/help/', '/login/', '/signup/', '/account/', '/membership/',
      '/launch-readiness/', '/proof/', '/legal/', '/known-limitations/',
      '/tools/graduation/', '/tools/schedule/', '/tools/checklist/', '/tools/advisor/',
      '/platform/availability/', '/platform/service-map/', '/platform/system-boundaries/', '/start/', '/demo/', '/trust/product-quality/', '/launch/', '/pricing/how-it-works/', '/resources/campus-launch-kit/',
      '/semester-standard/', '/trust/data-and-ai-transparency/', '/platform/integrations/', '/platform/vocabulary/', '/resources/ai-governance-canvas/', '/research/', '/tools/navigation/', '/tools/stack/',
      '/platform/one-operating-system/', '/platform/why-not-another-tool/',
      '/community/', '/community/ambassadors/', '/community/stories/', '/community/partners/', '/community/events/',
      '/k-12/', '/solutions/advancement/', '/alumni/'];
    expect(ROUTES.map((r) => r.path).sort()).toEqual([...want].sort());
  });

  it('has one h1, one main, a skip link and a language', () => {
    for (const { route, html } of pages) {
      expect(count(html, /<h1[ >]/g), route.path).toBe(1);
      expect(count(html, /<main[ >]/g), route.path).toBe(1);
      expect(html, route.path).toContain('href="#main"');
      expect(html, route.path).toContain('<html lang="en">');
    }
  });

  it('has a title and a description of its own', () => {
    const titles = new Set(ROUTES.map((r) => r.title));
    const descriptions = new Set(ROUTES.map((r) => r.description));
    expect(titles.size).toBe(ROUTES.length);
    expect(descriptions.size).toBe(ROUTES.length);
    for (const r of ROUTES) expect(r.description.length, r.path).toBeLessThanOrEqual(160);
  });

  it('ships no script outside the tools, and says so in its policy', () => {
    for (const { route, html } of pages.filter((p) => !p.route.tool)) {
      expect(html, route.path).not.toMatch(/<script/i);
      expect(html, route.path).toContain("script-src 'none'");
    }
  });

  it('gives each tool page exactly one script, from its own origin, and no way to send', () => {
    const tools = pages.filter((p) => p.route.tool);
    expect(tools.map((p) => p.route.tool)).toEqual(['graduation', 'schedule', 'checklist', 'advisor', 'navigation', 'stack']);
    for (const { route, html } of tools) {
      expect([...html.matchAll(/<script\b[^>]*>/gi)].map((m) => m[0]), route.path).toEqual(['<script type="module" src="/tools/tools.js">']);
      expect(html, route.path).not.toMatch(/<script[^>]*>[^<]/i);
      expect(html, route.path).toContain("script-src 'self'");
      expect(html, route.path).toContain("connect-src 'none'");
      expect(html, route.path).not.toContain("'unsafe-inline'");
      expect(html, route.path).toContain(`data-tool="${route.tool}"`);
      expect(html, route.path).toContain('<noscript>');
    }
  });

  it('links only to real pages, the app, or mail', () => {
    const paths = new Set(ROUTES.map((r) => r.path));
    for (const { route, html } of pages) {
      for (const h of hrefs(html)) {
        const ok =
          h === '#main' ||
          h.startsWith(DEFAULT_SITE.appUrl) ||
          h.startsWith('mailto:') ||
          paths.has(h);
        expect(ok, `${route.path} → ${h}`).toBe(true);
      }
    }
  });

  it('marks the page you are on', () => {
    for (const { route, html } of pages.filter((p) => ['/pricing/', '/tools/'].includes(p.route.path))) {
      expect(html, route.path).toContain(`href="${route.path}" aria-current="page"`);
    }
  });
});

describe('what the site says', () => {
  const all = pages.map((p) => p.html).join('\n');

  it('leads with the promise', () => {
    expect(pages[0].html).toContain(PROMISE.replace('’', '’'));
  });

  it('says on the K–12 page that no district uses Semester, and never that one does', () => {
    const k12 = pages.find((p) => p.route.path === '/k-12/')!.html;
    expect(k12).toContain('No district or school uses Semester today.');
    expect(k12).toMatch(/Nobody under 13 may hold an account/);
    expect(k12).not.toMatch(/districts? (use|trust|rely on) Semester|schools (use|trust|rely on) Semester|now serving/i);
  });

  it('says on the advancement pages that nothing is built, no gift has been taken, and asks nobody for one', () => {
    for (const path of ['/solutions/advancement/', '/alumni/']) {
      const html = pages.find((p) => p.route.path === path)!.html;
      expect(html, path).toContain('No school uses Semester for alumni relations or fundraising.');
      expect(html, path).toContain('No gift has been taken and no receipt has been issued.');
      expect(html, path).not.toMatch(/donate now|give now|make a gift|schools? (use|trust|rely on) Semester|now serving/i);
      // The page names donor scoring only to refuse it.
      expect(html, path).not.toMatch(/(we|semester) (score|rank|screen)s? (your )?(donors|alumni|prospects)/i);
    }
    const adv = pages.find((p) => p.route.path === '/solutions/advancement/')!.html;
    expect(adv).toContain('Wealth screening');
    expect(adv).toContain('No price has been set for this module.');
    expect(adv).toContain('no money moves through Semester');
  });

  it('prints every advancement part with its status and what it still needs, as text and not in a scrolling table', () => {
    const adv = pages.find((p) => p.route.path === '/solutions/advancement/')!.html;
    expect((adv.match(/Status: planned\./g) ?? []).length).toBe(PARTS.length);
    for (const p of PARTS) expect(adv, p.title).toContain(p.needs.split('.')[0].replace(/’/g, '’'));
    expect(adv).not.toContain('site-scroll');
  });

  it('links to the advancement and graduate pages from every page', () => {
    for (const p of pages) {
      expect(p.html, `${p.route.path} has no link to /solutions/advancement/`).toMatch(/href="[^"]*\/solutions\/advancement\/"/);
      expect(p.html, `${p.route.path} has no link to /alumni/`).toMatch(/href="[^"]*\/alumni\/"/);
    }
  });

  it('links to the K–12 page from every page, so it can be found without its address', () => {
    for (const p of pages) expect(p.html, `${p.route.path} has no link to /k-12/`).toMatch(/href="[^"]*\/k-12\/"/);
  });

  it('marks as held on the K–12 page only what the baseline counts as met', () => {
    const k12 = pages.find((p) => p.route.path === '/k-12/')!.html;
    // "held by a test" followed by the end of the item, not "…, not yet done".
    const held = (k12.match(/held by a test<\/li>/g) ?? []).length;
    expect(held).toBe(BASELINE.length - districtReady().short.length);
    expect(k12).toContain(`${districtReady().short.length} of the ${BASELINE.length} things it waits on are not done`);
  });

  it('never claims to work at any university, or to be live with one', () => {
    expect(all).not.toMatch(/works (at|with|for) (any|every) (university|college|school)|for (any|every) university|all universities/i);
    expect(all).toContain('built at Vanderbilt first');
    expect(all).not.toMatch(/integrates with|connected to your registrar|live integration/i);
    expect(all).toContain('No institutional connection is live today');
  });

  it('presents official-system replacement only as a separately approved future cutover', () => {
    const institutions = pages.find((p) => p.route.path === '/institutions/')!.html;
    const pricing = pages.find((p) => p.route.path === '/pricing/')!.html;

    expect(institutions).toContain('Pilot a student action layer beside existing systems');
    expect(institutions).toContain('could an institution separately authorize Semester');
    expect(institutions).not.toContain('Replace the LMS gradebook');
    expect(institutions).toContain('off until separately approved for the institution');
    expect(pricing).toContain('alongside existing systems');
    expect(pricing).toContain('off until an institution-approved cutover');
    expect(pricing).not.toContain('Native LMS and gradebook of record');
  });

  // The five claims the reinforcement briefs of 29 September say never to
  // make without an agreement, evidence or an auditable scope behind them.
  const OVERCLAIMS: readonly [string, RegExp][] = [
    ['replaces an official system', /replac(es|ing) (your |the )?(SIS|LMS|registrar|student information system|learning management system|financial[- ]aid system)/i],
    ['guarantees an outcome', /guarantee(s|d)? (your |a |that you )?(graduat|transfer credit|course availability|financial aid|a job|job placement|admission|outcomes?)/i],
    ['improves retention without evidence', /(improves|increases|boosts|raises|drives) (student )?(retention|persistence|graduation rates?|completion rates?|grades)/i],
    ['fully compliant', /fully (FERPA[- ])?compliant|100% compliant/i],
    ['AI-safe', /\bAI[- ]safe\b|safe AI guaranteed/i],
  ];

  it('can tell an overclaim from ordinary copy', () => {
    const bad = ['Semester replaces your SIS.', 'We guarantee graduation.', 'Semester improves retention.', 'Fully compliant with FERPA.', 'The first AI-safe planner.'];
    for (const [i, [what, re]] of OVERCLAIMS.entries()) expect(bad[i], what).toMatch(re);
    expect('Semester does not replace your institution’s official systems.').not.toMatch(OVERCLAIMS[0][1]);
  });

  it('makes none of the five overclaims on any page', () => {
    for (const p of pages) for (const [what, re] of OVERCLAIMS) expect(p.html, `${p.route.path}: ${what}`).not.toMatch(re);
  });

  it('holds all individual paid acquisition and labels prices as planned', () => {
    const pricing = pages.find((p) => p.route.path === '/pricing/')!.html;
    expect(pricing).not.toMatch(/buy now|subscribe now|start (your )?subscription|add (a |your )?card|enter your card/i);
    expect(pricing).toContain('Individual paid plans are planned, not on sale');
    expect(pricing).toContain('New checkout is disabled');
    expect(pricing).toContain('(planned)');
    expect(pricing).toContain('Plus and Pro are planned, not on sale');
    expect(pricing).toContain('Export all of your data');
  });

  it('gives careers its line and the contact address', () => {
    const careers = pages.find((p) => p.route.path === '/careers/')!.html;
    expect(careers).toContain('Help make college easier to navigate.');
    expect(careers).toContain(CONTACT_EMAIL);
  });

  it('labels the product preview as demo data', () => {
    expect(pages[0].html).toMatch(/<figcaption[^>]*>Demo data\./);
  });

  it('lists what is not done yet on the security page', () => {
    const security = pages.find((p) => p.route.path === '/security/')!.html;
    expect(security).toContain('Not done yet');
    expect(security).toMatch(/SOC 2/);
  });

  it('gives the security page the contact address and its security.txt, and promises no response time', () => {
    // HECVAT VULN-1: the disclosure contact is public in both forms, the human
    // one and the RFC 9116 one, and they are the same address. The site still
    // promises no response time — the remediation clocks are internal targets.
    const security = pages.find((p) => p.route.path === '/security/')!.html;
    expect(security).toContain(`mailto:${CONTACT_EMAIL}?subject=Security%20report`);
    expect(security).toContain(`href="${DEFAULT_SITE.appUrl}.well-known/security.txt"`);
    expect(security).toContain('No response time is promised yet');
    expect(security).not.toMatch(/within (one|two|1|2) business day/i);
  });

  it('asks each visitor what brought them, and sends them to a real page', () => {
    const home = pages[0].html;
    expect(home).toContain('What brings you to Semester?');
    expect(home).toMatch(/I am a student/);
    expect(home).toMatch(/security/);
  });

  it('puts a status word beside every capability it names, and explains the words once', () => {
    const labelled = pages.filter((p) => /data-claim="/.test(p.html)).map((p) => p.route.path);
    expect(labelled).toEqual(expect.arrayContaining(['/', '/security/', '/accessibility/', '/institutions/', '/pricing/', '/privacy/', '/contact/', '/legal/', '/launch-readiness/']));
    const ready = pages.find((p) => p.route.path === '/launch-readiness/')!.html;
    expect(ready).toContain('Available now');
    expect(ready).toContain('Planned');
    expect(ready).toContain('status.html');
  });

  it('says every price in dollars, with what happens at cancellation', () => {
    const pricing = pages.find((p) => p.route.path === '/pricing/')!.html;
    expect(pricing).toContain('US dollars');
    expect(pricing).toMatch(/[Cc]ancel/);
    expect(pricing).toMatch(/[Rr]efund/);
  });

  it('routes every contact topic to a seat, and promises no response time it cannot keep', () => {
    const contact = pages.find((p) => p.route.path === '/contact/')!.html;
    expect(contact).toContain('Security / vCISO');
    expect(contact).toContain('Accessibility lead');
    expect(contact).toContain('No response time is promised yet');
    expect(contact).not.toMatch(/within (one|two|1|2) business day/i);
  });

  it('offers a community, and says no programme is running, no ambassador recruited, no story, partner or event yet', () => {
    const community = pages.find((p) => p.route.path === '/community/')!.html;
    expect(community).toContain(NOT_ON_YET);
    expect(community).toContain('What we build instead of a social network');
    expect(community).not.toMatch(/\d+ (students|members|campuses|universities)/i);
    for (const [path, sentence] of [
      ['/community/ambassadors/', 'never paid per sign-up'],
      ['/community/stories/', 'No story has been published yet'],
      ['/community/partners/', 'No partner is listed yet'],
      ['/community/events/', 'No event is scheduled yet'],
    ]) {
      const html = pages.find((p) => p.route.path === path)!.html;
      expect(html, path).toContain(sentence);
      expect(html, path).toContain(`href="${DEFAULT_SITE.base}community/"`);
    }
    // The community pages carry no follower count, ranking or streak: the words the community layer forbids.
    const all = ['/community/', '/community/ambassadors/', '/community/stories/', '/community/partners/', '/community/events/'].map((path) => pages.find((p) => p.route.path === path)!.html).join('\n');
    expect(all).not.toMatch(/followers?\b(?! count)/i);
    expect(all).not.toMatch(/\bstreaks?\b/i);
  });

  it('shows no policy as in force', () => {
    const legal = pages.find((p) => p.route.path === '/legal/')!.html;
    expect(legal).toContain('Nothing is in force');
    expect(legal).toContain('Terms of Service');
    expect(legal).not.toMatch(/has (been )?reviewed by a lawyer|in force since/i);
  });
});

describe('configuration', () => {
  const at: SiteConfig = { appUrl: 'https://app.example/', base: '/site/', origin: 'https://www.example' };
  const built = renderSite(at);

  it('puts every link under the base path', () => {
    const home = built.find((b) => b.file === 'index.html')!.content;
    expect(home).toContain('href="/site/pricing/"');
    expect(home).toContain('href="/site/site.css"');
    expect(home).not.toMatch(/href="\/pricing\//);
  });

  it('writes canonical links and a sitemap only when it knows the origin', () => {
    const pricing = built.find((b) => b.file === 'pricing/index.html')!.content;
    expect(pricing).toContain('<link rel="canonical" href="https://www.example/site/pricing/">');
    expect(built.find((b) => b.file === 'sitemap.xml')?.content).toContain('<loc>https://www.example/site/</loc>');
    expect(renderSite(DEFAULT_SITE).some((b) => b.file === 'sitemap.xml')).toBe(false);
    expect(renderPage(ROUTES[0], DEFAULT_SITE)).not.toContain('rel="canonical"');
  });
});

describe('one visual language', () => {
  it('uses the app’s own colours', () => {
    const app = readFileSync(new URL('../styles/app.css', import.meta.url), 'utf8');
    const site = readFileSync(new URL('./site.css', import.meta.url), 'utf8');
    const token = (css: string, name: string) => new RegExp(`--${name}:\\s*([^;]+);`).exec(css)?.[1].trim();
    for (const [s, a] of [['site-bg', 'app-bg'], ['site-panel', 'app-panel'], ['site-fg', 'app-fg'], ['site-accent', 'app-accent'], ['site-line', 'app-line']]) {
      expect(token(site, s), s).toBe(token(app, a));
    }
  });
});

describe('the sample university page', () => {
  const demo = () => pages.find((p) => p.route.path === '/demo/')!.html;

  it('names every role the demo has, and no view the demo does not', async () => {
    const { PREVIEW_ROLES } = await import('../data/institutional-preview');
    const { ROLE_WORKSPACE_TITLES } = await import('../components/institutional/role-workspace');
    expect(Object.keys(ROLE_WORKSPACE_TITLES).sort()).toEqual([...PREVIEW_ROLES].sort());
    const html = demo();
    for (const title of Object.values(ROLE_WORKSPACE_TITLES)) expect(html, title).toContain(title.replace(/ workspace$/i, ''));
    // The three the brief names that do not exist are said to be missing, not shown.
    expect(html).toContain('Not in the sample yet: a registrar view, a gift-officer view, and a K-12 parent view.');
    expect(html).not.toMatch(/registrar workspace|gift.officer workspace|guardian workspace/i);
  });

  it('says what stays in the browser, and offers the entry from the institutions page', () => {
    expect(demo()).toContain('Nothing you do there is sent to Semester');
    expect(demo()).toContain('a reset button starts it again');
    const inst = pages.find((p) => p.route.path === '/institutions/')!.html;
    expect(inst).toContain('Explore a sample university');
    expect(inst).toContain('href="/demo/"');
  });
});
