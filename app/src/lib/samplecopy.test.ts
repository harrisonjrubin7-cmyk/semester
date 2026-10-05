import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A made-up figure on the company site is labelled made-up where it stands.
 *
 * The customer-portal preview showed "99.9% tenant uptime, 30 days" and "last
 * restore test passed" as if they were readings. Semester has no customer, no
 * uptime figure and has never restored the production database, so a reader who
 * took them literally was told something false. They stay, because the preview
 * shows what the portal will hold, but each says it is a sample and the panel
 * says none of it was measured. Held here so a later edit cannot drop the label.
 */

const root = join(import.meta.dirname, '../../..');
const siteHtml = readFileSync(join(root, 'company-site/index.html'), 'utf8');
const site = `${siteHtml}\n${readFileSync(join(root, 'company-site/site.js'), 'utf8')}`;

/** The health panel of the portal preview, as the page carries it. */
const health = () => {
  const i = site.indexOf('health:`');
  return site.slice(i, site.indexOf('`,', i));
};

/** Whether every uptime figure is captioned, in its own caption, as a sample. */
const labelled = (text: string) => [...text.matchAll(/99\.9%/g)].every((m) => /^<\/b><span>[^<]*sample/i.test(text.slice(m.index + 5)));

describe('the portal preview’s figures', () => {
  it('can tell a bare uptime figure from a labelled one', () => {
    expect(labelled('<b>99.9%</b><span>tenant uptime, 30 days</span>')).toBe(false);
    expect(labelled('<b>99.9%</b><span>sample tenant uptime, 30 days</span>')).toBe(true);
    // The trap: a nearby "sample" in another caption must not count for this one.
    expect(labelled('<b>99.9%</b><span>tenant uptime</span></div><div><b>100%</b><span>sample support</span>')).toBe(false);
  });

  it('says in the health panel that nothing was measured, and labels every uptime figure a sample', () => {
    const panel = health();
    expect(panel).toContain('Sample figures, not measurements.');
    expect(panel).toContain('no production restore test yet');
    expect(labelled(panel)).toBe(true);
    expect(panel).not.toMatch(/last restore test passed/i);
  });

  it('labels every section of the portal preview as sample data', () => {
    expect(site).toContain('Sample data · not measured');
  });

  it('claims a measured uptime nowhere else on the site', () => {
    const outside = site.replace(health(), '');
    expect(outside).not.toMatch(/99\.9\s?%/);
  });
});

describe('the way into the sample university', () => {
  it('is offered by that name on the company site’s product, institutions and home pages', () => {
    const at = (page: string) => {
      const i = siteHtml.indexOf(`data-page="${page}"`);
      return siteHtml.slice(i, siteHtml.indexOf('<!-- =====', i));
    };
    for (const page of ['home', 'institutions']) expect(at(page), page).toContain('Explore a sample university');
    expect(site).not.toContain('See Semester in action');
  });
});
