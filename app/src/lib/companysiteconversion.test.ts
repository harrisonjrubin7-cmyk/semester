import { readFileSync } from 'node:fs';
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
});
