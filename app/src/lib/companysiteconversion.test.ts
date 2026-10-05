import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '../../..');
const siteHtml = readFileSync(join(root, 'company-site/index.html'), 'utf8');
const siteScript = readFileSync(join(root, 'company-site/site.js'), 'utf8');
const site = `${siteHtml}\n${siteScript}`;
const home = siteHtml.slice(siteHtml.indexOf('data-page="home"'), siteHtml.indexOf('<!-- ================= PRODUCT'));

describe('the company-site conversion path', () => {
  it('leads with an immediate student outcome and a working app signup', () => {
    expect(home).toContain('Turn your semester into <em>one clear next step.</em>');
    expect(home).toContain('href="https://harrisonjrubin7-cmyk.github.io/semester/#/signup"');
    expect(home).toContain('Start planning free');
  });

  it('keeps the first audience choice to the three conversion paths', () => {
    const persona = home.slice(home.indexOf('id="persona"'), home.indexOf('id="reco"'));
    expect(persona.match(/data-p=/g)).toHaveLength(3);
    expect(persona).toContain('Student · Start planning free');
    expect(persona).toContain('Institution · Run a readiness pilot');
    expect(persona).toContain('Faculty or advisor · See the workflow');
  });

  it('shows product proof, capability status, and honest pilot evidence', () => {
    expect(home).toContain('id="proof-walkthrough"');
    expect(home).toContain('id="product-status-map"');
    expect(home).toContain('Available now');
    expect(home).toContain('Controlled pilot');
    expect(home).toContain('Semester has no customer outcome claims yet.');
  });

  it('routes the walkthrough CTA to the existing interactive demo', () => {
    expect(home).toContain('href="#experience">See the 90-second walkthrough</a>');
  });

  it('keeps generated signup guidance inside cards instead of creating grid items', () => {
    expect(site).toContain('const card=a.closest(".aud,.box,article,.card")');
    expect(site).toContain('if(card&&!ctas)card.appendChild(helper)');
    expect(site).not.toContain('const host=a.closest(".ctas")||a.parentElement');
  });

  it('marks published compliance evidence green without claiming certification', () => {
    const block = site.slice(site.indexOf('const EVIDENCE_ROOT='), site.indexOf('const SHORT='));
    const paths = [...block.matchAll(/"(docs\/[^"]+\.md)"/g)].map((match) => match[1]);

    expect(paths).toHaveLength(6);
    for (const path of paths) expect(existsSync(join(root, path)), path).toBe(true);
    expect(block.match(/class="status st-av"/g)).toHaveLength(1);
    expect(block).toContain('CLAIMS.map');
    expect(block).toContain('not certified');
    expect(block).toContain('no conformance claim');
    expect(block).toContain('independent audit report pending');
    expect(block).not.toMatch(/SOC 2 certified|ISO 27001 certified|FERPA certified|WCAG 2\.2 AA compliant/i);
  });

  it('keeps the site readiness claims aligned with the evidence that now exists', () => {
    const register = readFileSync(join(root, 'docs/SITE-READINESS-GREEN-REGISTER.md'), 'utf8');

    for (const path of [
      'docs/WCAG-UI-AUDIT-SCORECARD.md',
      'docs/compliance/VPAT-ACR-SELF-ASSESSMENT.md',
      'docs/evidence/restore/2026-09-30-logical-rehearsal.md',
      'docs/LOAD-AND-SOAK.md',
      'docs/market-readiness/HECVAT_DRAFT_RESPONSE.md',
      'docs/HIGHER-ED-RFP-RESPONSE-LIBRARY.md',
    ]) {
      expect(existsSync(join(root, path)), path).toBe(true);
      expect(register, path).toContain(path);
    }

    expect(site).toContain('Auth and RLS test baseline <span class="status st-av">Evidence published</span>');
    expect(site).toContain('Load and concurrency baseline <span class="status st-av">Runs in CI</span>');
    expect(site).toContain('VPAT-style self-assessment <span class="status st-av">Evidence published</span>');
    expect(site).toContain('Every third-party GitHub Action is pinned to an immutable full commit hash');
    expect(site).toContain('The Pages release creates a CycloneDX inventory');
    expect(site).toContain('full server-data export; one-step account deletion; and device erase in Settings');
    expect(site).not.toContain('Full self-serve export and one-step account deletion');
    expect(site).toContain('Repository preparation complete · activation gated');
    expect(site).toContain('Role-specific staff training guides and first-day checklists');
    expect(site).toContain('A pilot measures and baseline worksheet');
    expect(site).toContain('Training delivered to the named pilot staff');
    expect(site).toContain('a real baseline collected');
    expect(site).not.toContain('<li>Staff training material</li>');
    expect(site).toContain('Automated logical-dump restore, load and concurrency rehearsals in CI');
    expect(site).not.toContain('Load and disaster-recovery evidence');
    expect(site).not.toContain('Actions are pinned to version tags today');
    expect(site).not.toContain('<th scope="row">SBOM per release</th><td>A software bill of materials generated with every release artifact.</td>');
    expect(register).toContain('Still not green by repository work alone');
    expect(register).toContain('It is not a formal ACR');
  });

  it('describes the two status surfaces as separately hosted without calling them disaster recovery', () => {
    expect(site).toContain('this company-site view on Vercel and the product status page on GitHub Pages');
    expect(site).toContain('neither substitutes for a production restore');
    expect(site).not.toContain("This page isn't hosted separately from the site yet");
  });

  it('publishes the implemented maintenance workflow without implying email delivery', () => {
    expect(site).toContain('checked against registration and finals exclusions');
    expect(site).toContain('status page, in-app notices and Atom feed');
    expect(site).toContain('Email delivery remains pending.');
    expect(site).not.toContain('A maintenance workflow with subscriber notices is planned.');
  });

  it('records status-update requests without claiming an active subscription', () => {
    expect(site).toContain('Request incident updates by email');
    expect(site).toContain('The request is recorded for manual setup; you are not subscribed until Semester confirms it by email.');
    expect(site).toContain('Self-service preference management, confirmed delivery and a customer-contact drill remain pending.');
    expect(site).not.toContain('<p class="eyebrow">Get incident updates by email</p>');
  });
});
