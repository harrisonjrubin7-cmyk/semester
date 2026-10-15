/// <reference types="node" />
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { END, START, SOLUTIONS, advancement, block, k12 } from './companysolutions';
import { mayTakeDistrictData } from '../lib/k12/edition';

/**
 * The company site's K–12 and advancement pages: equal to the data they print,
 * true to what exists, and actually rendered by the site's own function.
 *
 * `REGISTERS=write npx vitest run src/site/companysolutions.test.ts` rewrites
 * the copy after the data changes; without it the test only compares.
 */

const root = join(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const SITE = 'company-site/site.js';
const SITE_HTML = 'company-site/index.html';
const cut = (html: string) => html.slice(html.indexOf(START), html.indexOf(END) + END.length);

describe('the copy in the company site', () => {
  // The control: a stale copy must read as stale, or "equal" proves nothing.
  it('can tell a stale copy from a current one', () => {
    expect(block().replace('No district', 'Every district')).not.toBe(cut(read(SITE)));
    expect(block().length).toBeGreaterThan(500);
  });

  it('carries exactly what the data prints', () => {
    let html = read(SITE);
    if (process.env.REGISTERS === 'write' && cut(html) !== block()) {
      html = html.replace(cut(html), () => block());
      writeFileSync(join(root, SITE), html);
    }
    expect(cut(html)).toBe(block());
  });
});

// ── What the pages say ─────────────────────────────────────────────────

const words = (s: { h: string; lede: string; list: string[]; qual: string[]; listTitle: string; listHead: string; qualHead: string }): string =>
  [s.h, s.lede, s.listTitle, s.listHead, s.qualHead, ...s.list, ...s.qual].join(' ');

/** What neither page may say: anything live, a price, a payment provider, a score. */
const FORBIDDEN: readonly RegExp[] = [
  /\bavailable now\b/i,
  /\b(is|are) live\b/i,
  /make a gift/i,
  /give today|donate (now|today)/i,
  /\$\s?\d/,
  /\b(stripe|paypal|square|braintree|venmo)\b/i,
  /wealth (screen|scor)\w* (is|are) (built|available)/i,
  /(start|begin) (your|a) (free )?trial/i,
];

describe('what the pages say', () => {
  it('has a probe that can see each forbidden thing', () => {
    for (const probe of ['Available now', 'It is live', 'Make a gift today', 'Donate today', 'Only $49', 'Pay with Stripe', 'Start your free trial']) {
      expect(FORBIDDEN.some((r) => r.test(probe)), probe).toBe(true);
    }
    expect(FORBIDDEN.some((r) => r.test('Planned. None of it is built.'))).toBe(false);
  });

  it('never says anything is live, priced or paid through a named provider', () => {
    for (const [name, page] of Object.entries(SOLUTIONS)) {
      const text = words(page());
      for (const r of FORBIDDEN) expect(text, `${name}: ${r}`).not.toMatch(r);
    }
  });

  it('says on its first lines that no district is served, and what a district’s data waits on', () => {
    const p = k12();
    expect(p.lede.startsWith('No district or school uses Semester today')).toBe(true);
    expect(p.lede).toContain('does not take a district’s student data');
    // The page prints the gate's answer rather than claiming one.
    expect(mayTakeDistrictData()).toBe(false);
    expect(p.qual.join(' ')).toMatch(/not accepted until a baseline of sixteen things is tested/);
    expect(p.qual.join(' ')).toMatch(/\d+ of them are short today/);
    expect(p.qual.join(' ')).toContain('does not replace the student information system');
    expect(p.qual.join(' ')).toContain('under 13');
  });

  it('says on its first lines that no school uses advancement, no gift has been taken, and no price is set', () => {
    const p = advancement();
    expect(p.lede.startsWith('No school uses Semester for alumni relations or fundraising.')).toBe(true);
    expect(p.lede).toContain('No gift has been taken and no receipt has been issued.');
    expect(p.lede).toContain('No price has been set for this module.');
    expect(p.h).toContain('none of it built');
  });

  it('refuses wealth screening and donor scoring, and lists what a graduate can do today', () => {
    const q = advancement().qual.join(' ');
    expect(q).toContain('Not planned: wealth screening');
    expect(q).toContain('Not planned: predictive donor scoring');
    expect(q).toContain('D-146');
    expect(q).toContain('A graduate can today: offer to mentor');
    expect(q).toContain('counsel’s review of charitable-solicitation registration');
  });

  it('is reachable: a route key, the dropdown, the footer, and the sitemap', () => {
    const html = read(SITE_HTML);
    expect(Object.keys(SOLUTIONS).sort()).toEqual(['advancement', 'k12']);
    expect(html).toContain('<a href="#k12"><b>K–12 (planned)</b>');
    expect(html).toContain('<a href="#advancement"><b>Advancement (planned)</b>');
    expect(html.match(/<a href="#k12">K–12 \(planned\)<\/a>/g)?.length).toBeGreaterThanOrEqual(1);
    const sitemap = read('company-site/sitemap.xml');
    expect(sitemap).toContain('https://www.semester.website/k12<');
    expect(sitemap).toContain('https://www.semester.website/advancement<');
    // A link in a breadcrumb is not the footer: the migration page’s crumb is untouched.
    expect(html).toContain('/ <a href="#enterprise">Enterprise</a> / Migration center');
  });
});

// ── The site’s own renderer prints it ──────────────────────────────────

describe('the site’s renderSolution', () => {
  const html = read(SITE);
  const fn = html.slice(html.indexOf('function renderSolution(key)'), html.indexOf('el.innerHTML=h;\n  }', html.indexOf('function renderSolution(key)')) + 'el.innerHTML=h;\n  }'.length);
  const escDef = html.slice(html.indexOf('const esc=s=>'), html.indexOf('\n', html.indexOf('const esc=s=>')));

  function render(key: string, sol: Record<string, unknown>): string {
    const out = { html: '' };
    const doc = { getElementById: () => ({ set innerHTML(v: string) { out.html = v; } }) };
    new Function('document', 'SOL', `${escDef}\n${fn}\nrenderSolution(${JSON.stringify(key)});`)(doc, { [key]: sol });
    return out.html;
  }

  it('found the function and the escaper, so the tests below are reading the real thing', () => {
    expect(fn.length).toBeGreaterThan(300);
    expect(escDef).toContain('&amp;');
  });

  it('prints each new page with its own headings, every list item and its honest first line', () => {
    for (const [key, make] of Object.entries(SOLUTIONS)) {
      const page = make();
      const out = render(key, page as unknown as Record<string, unknown>);
      expect(out, key).toContain(page.listHead);
      expect(out, key).toContain(page.qualHead);
      expect(out, key).toContain(page.listTitle);
      for (const item of [...page.list, ...page.qual]) expect(out, `${key}: ${item.slice(0, 40)}`).toContain(item.replace(/&/g, '&amp;'));
      expect(out, key).not.toContain('What you get');
      expect(out, key).not.toContain('Scoped to your workflow');
    }
  });

  it('gives the hero button a real link, not the word undefined', () => {
    for (const [key, make] of Object.entries(SOLUTIONS)) {
      const page = make();
      expect(page.cta[1], key).toBe('#contact');
      const out = render(key, page as unknown as Record<string, unknown>);
      expect(out, key).not.toContain('undefined');
      expect(out, key).toContain(`<a class="btn btn-primary" href="#contact">${page.cta[0]}</a>`);
    }
    // control: the probe does see the fault when a page has the one-element shape
    const bad = render('k12', { crumb: 'c', eye: 'e', h: 'h', lede: 'l', cta: ['c'], list: ['a'], qual: ['b'] });
    expect(bad).toContain('href="undefined"');
  });

  it('still prints the original headings for a page that sets none (nothing else changed)', () => {
    const out = render('departments', { crumb: 'Departments', eye: 'e', h: 'h', lede: 'l', cta: ['c'], list: ['one'], qual: ['two'] });
    expect(out).toContain('What you get');
    expect(out).toContain('Scoped to your workflow.');
    expect(out).toContain('A good fit when you have');
  });
});
