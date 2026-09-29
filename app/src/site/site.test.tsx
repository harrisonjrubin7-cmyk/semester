import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTACT_EMAIL, DEFAULT_SITE, PROMISE, type SiteConfig } from './config';
import { ROUTES, renderPage, renderSite } from './render';
import { NOT_ON_YET } from './community';

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
      '/semester-standard/', '/trust/data-and-ai-transparency/', '/platform/integrations/', '/platform/vocabulary/', '/resources/ai-governance-canvas/', '/research/', '/tools/navigation/',
      '/community/', '/community/ambassadors/', '/community/stories/', '/community/partners/', '/community/events/'];
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
    expect(tools.map((p) => p.route.tool)).toEqual(['graduation', 'schedule', 'checklist', 'advisor', 'navigation']);
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

  it('never claims to work at any university, or to be live with one', () => {
    expect(all).not.toMatch(/works (at|with|for) (any|every) (university|college|school)|for (any|every) university|all universities/i);
    expect(all).toContain('built at Vanderbilt first');
    expect(all).not.toMatch(/integrates with|connected to your registrar|live integration/i);
    expect(all).toContain('No institutional connection is live today');
  });

  it('sells nothing: no checkout, and every price is planned', () => {
    const pricing = pages.find((p) => p.route.path === '/pricing/')!.html;
    expect(pricing).not.toMatch(/buy now|subscribe now|start (your )?subscription|add (a |your )?card|enter your card/i);
    expect(pricing).toContain('There is no checkout on this site');
    expect(pricing).toContain('(planned)');
    expect(pricing).toContain('not on sale yet');
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

  it('says every price in dollars, with what happens at cancellation, and no checkout', () => {
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
