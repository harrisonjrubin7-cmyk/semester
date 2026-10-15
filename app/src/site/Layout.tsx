import type { ReactNode } from 'react';
import type { SiteConfig } from './config';

/** A link to another page of the site, under its base path. */
export function href(config: SiteConfig, path: string): string {
  const clean = path.replace(/^\//, '');
  return `${config.base}${clean}`;
}

/** A link into the app, at one of its hash routes. */
export function appHref(config: SiteConfig, hash = ''): string {
  return `${config.appUrl}${hash}`;
}

const PRIMARY: [string, string][] = [
  ['Product', '/product/'],
  ['Students', '/students/'],
  ['Institutions', '/institutions/'],
  ['Pricing', '/pricing/'],
  ['Tools', '/tools/'],
  ['Resources', '/resources/'],
];

const FOOTER: [string, [string, string][]][] = [
  ['Product', [['Product', '/product/'], ['Demo', '/demo/'], ['Pricing', '/pricing/'], ['How pricing works', '/pricing/how-it-works/'], ['K–12 edition', '/k-12/'], ['Alumni and advancement', '/solutions/advancement/'], ['For graduates', '/alumni/'], ['Tools', '/tools/'], ['Help', '/help/']]],
  ['Platform', [['What is available', '/platform/availability/'], ['Service map', '/platform/service-map/'], ['System boundaries', '/platform/system-boundaries/'], ['Integrations and standards', '/platform/integrations/'], ['The words we use', '/platform/vocabulary/'], ['One operating system', '/platform/one-operating-system/'], ['Why not another tool?', '/platform/why-not-another-tool/'], ['After you start', '/start/'], ['Launch sites', '/launch/']]],
  ['Company', [['About', '/about/'], ['Careers', '/careers/'], ['Contact', '/contact/'], ['Resources', '/resources/'], ['Campus launch kit', '/resources/campus-launch-kit/'], ['AI governance canvas', '/resources/ai-governance-canvas/'], ['Research and community', '/research/']]],
  ['Community', [['The Semester Community', '/community/'], ['Campus ambassadors', '/community/ambassadors/'], ['Student stories', '/community/stories/'], ['Partner directory', '/community/partners/'], ['Events and sessions', '/community/events/']]],
  ['Trust', [['The Semester Standard', '/semester-standard/'], ['Data & AI Transparency', '/trust/data-and-ai-transparency/'], ['Security', '/security/'], ['Privacy', '/privacy/'], ['Accessibility', '/accessibility/'], ['Are we ready?', '/launch-readiness/'], ['Known limitations', '/known-limitations/'], ['Product quality', '/trust/product-quality/'], ['How we show proof', '/proof/'], ['Legal', '/legal/']]],
];

/**
 * Every page's frame: skip link, header, one `<main>`, footer.
 *
 * The phone menu is a `<details>` element, so it opens by keyboard, touch or
 * screen reader with no script at all — the static pages ship none.
 */
export function Layout({ config, path, children }: { config: SiteConfig; path: string; children: ReactNode }) {
  const current = (p: string) => (p === path ? 'page' : undefined);
  const nav = (
    <ul className="site-nav-list">
      {PRIMARY.map(([label, p]) => (
        <li key={p}>
          <a href={href(config, p)} aria-current={current(p)}>{label}</a>
        </li>
      ))}
    </ul>
  );
  return (
    <>
      <a className="site-skip" href="#main">Skip to content</a>
      <header className="site-header">
        <a className="site-brand" href={href(config, '/')} aria-current={current('/')}>Semester</a>
        <nav className="site-nav site-nav-wide" aria-label="Main">{nav}</nav>
        <div className="site-cta">
          <a href={href(config, '/login/')}>Log in</a>
          <a className="site-button" href={href(config, '/signup/')}>Get started</a>
        </div>
        <details className="site-menu">
          <summary>Menu</summary>
          <nav aria-label="Main (menu)">
            {nav}
            <ul className="site-nav-list">
              <li><a href={href(config, '/login/')}>Log in</a></li>
              <li><a href={href(config, '/signup/')}>Get started</a></li>
            </ul>
          </nav>
        </details>
      </header>
      <main id="main" tabIndex={-1}>{children}</main>
      <footer className="site-footer">
        {FOOTER.map(([heading, links]) => (
          <nav key={heading} aria-label={heading}>
            <h2>{heading}</h2>
            <ul>
              {links.map(([label, p]) => (
                <li key={p}><a href={href(config, p)}>{label}</a></li>
              ))}
            </ul>
          </nav>
        ))}
        <p className="site-small">
          Semester is built at Vanderbilt first. It is not affiliated with or endorsed by any university unless that
          university says so.
        </p>
      </footer>
    </>
  );
}
