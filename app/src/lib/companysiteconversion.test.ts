import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '../../..');
const site = readFileSync(join(root, 'company-site/index.html'), 'utf8');
const home = site.slice(site.indexOf('data-page="home"'), site.indexOf('<!-- ================= PRODUCT'));

describe('the company-site conversion path', () => {
  it('leads with an immediate student outcome and a working app signup', () => {
    expect(home).toContain('Make your next academic decision <em>with confidence.</em>');
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
    expect(site).toContain('Automated logical-dump restore, load and concurrency rehearsals in CI');
    expect(site).not.toContain('Load and disaster-recovery evidence');
    expect(site).not.toContain('Actions are pinned to version tags today');
    expect(site).not.toContain('<th scope="row">SBOM per release</th><td>A software bill of materials generated with every release artifact.</td>');
    expect(register).toContain('Still not green by repository work alone');
    expect(register).toContain('It is not a formal ACR');
  });
});
