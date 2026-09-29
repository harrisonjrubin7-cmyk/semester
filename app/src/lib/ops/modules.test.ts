import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SITE } from '../../site/config';
import { ROUTES, renderPage } from '../../site/render';
import { REGISTER } from '../masterregister';
import { CLAIMS, STATUS_LABEL, claim, problems, type Facts } from './claims';
import { CALENDAR } from './proofcalendar';
import { CORE_MODULES, coreClaimId } from './modules';

/**
 * Semester Core's replacement map, held to the register and to the company site.
 *
 * The rule that matters: a module is never shown as available in Core while its
 * claim is not. The page reads the word from the claim, so the risk is the
 * other places that state it — the company site's own copy — and a claim that
 * someone raises without the evidence. Both are checked, and each is shown a
 * case that breaks it before it is trusted to pass the real one.
 *
 * The company site's table is a copy of `modules.ts` between two markers;
 * `npm run registers` rewrites it, and the last test fails while it is stale.
 */

const root = join(import.meta.dirname, '../../../..');
const at = (p: string) => join(root, p);
const SITE = 'company-site/index.html';
const START = '/*core-modules:start*/';
const END = '/*core-modules:end*/';

const expectedBlock = () => `${START}const CORE_MODULES=${JSON.stringify(CORE_MODULES.map(({ name, replaces, connect, core, gap }) => ({ name, replaces, connect, core, gap })))};${END}`;
const blockOf = (html: string) => html.slice(html.indexOf(START), html.indexOf(END) + END.length);

const pages = new Map(ROUTES.map((r) => [r.path, renderPage(r, DEFAULT_SITE)]));
const FACTS: Facts = {
  rowStatus: (id) => REGISTER.find((r) => r.id === id)?.status,
  exists: (p) => existsSync(at(p)),
  proofExists: (id) => CALENDAR.some((c) => c.id === id),
  routes: ROUTES.map((r) => r.path),
  page: (route) => pages.get(route),
};

describe('the modules', () => {
  it('are fourteen, each once, each with a claim, products named and a reason nothing is built', () => {
    expect(CORE_MODULES).toHaveLength(14);
    expect(new Set(CORE_MODULES.map((m) => m.id)).size).toBe(14);
    for (const m of CORE_MODULES) {
      expect(claim(coreClaimId(m.id)).id, m.id).toBe(`core-${m.id}`);
      expect(m.replaces.length, `${m.id} names no product`).toBeGreaterThan(0);
      expect(m.gap.trim(), `${m.id} says nothing about what is missing`).toBeTruthy();
      expect(m.rows.length, `${m.id} names no register row`).toBeGreaterThan(0);
    }
  });

  it('carry no status of their own: the word is the claim’s', () => {
    for (const m of CORE_MODULES) {
      expect(Object.keys(m).sort(), m.id).toEqual(['connect', 'core', 'gap', 'id', 'name', 'replaces', 'rows']);
      expect(`${m.connect} ${m.core} ${m.gap}`, `${m.id} states availability in its own words`).not.toMatch(/\b(now available|is available|available now|live today|generally available)\b/i);
    }
  });

  it('are all planned today, because no Core mode, table or switch exists', () => {
    for (const m of CORE_MODULES) expect(claim(coreClaimId(m.id)).status, m.id).toBe('planned');
  });

  it('are printed on the map with the register’s word beside each, and only that word', () => {
    const html = pages.get('/platform/system-boundaries/')!;
    for (const m of CORE_MODULES) {
      const c = claim(coreClaimId(m.id));
      expect(html, m.id).toContain(`data-claim="${c.id}"`);
      expect(html, m.id).toContain(m.gap);
    }
    const rows = [...html.matchAll(/<tr data-claim="core-[^"]*">.*?<\/tr>/gs)].map((m) => m[0]);
    expect(rows).toHaveLength(CORE_MODULES.length);
    for (const r of rows) {
      expect(r).toContain(`site-status-planned">${STATUS_LABEL.planned}</span>`);
      expect(r).not.toMatch(/site-status-(available|built-tested|limited-beta|institution-configured)/);
    }
    expect(problems(CLAIMS, FACTS)).toEqual([]);
  });

  it('cannot be raised to available on a row that has not earned it', () => {
    // The control: the same claim, raised, is refused. LMS-004 (assignments) is designed.
    const raised = CLAIMS.map((c) => (c.id === 'core-assignments' ? { ...c, status: 'available' as const, evidence: [{ path: 'app/src/lib/ops/modules.test.ts', shows: 'x' }] } : c));
    const found = problems(raised, { ...FACTS, page: () => undefined });
    expect(found.some((p) => /core-assignments claims available, but LMS-004 is designed/.test(p))).toBe(true);
  });
});

describe('the decision', () => {
  it('is recorded as D-141 with the two modes named', () => {
    const log = readFileSync(at('docs/DECISION-LOG.md'), 'utf8');
    const entry = log.slice(log.indexOf('## D-141')).replace(/\s+/g, ' ');
    expect(entry.startsWith('## D-141')).toBe(true);
    expect(entry).toContain('Semester Connect');
    expect(entry).toContain('Semester Core');
  });
});

describe('the company site', () => {
  it('can tell a stale copy of the map from a current one', () => {
    expect(expectedBlock().replace('Canvas', 'Zanvas')).not.toBe(blockOf(readFileSync(at(SITE), 'utf8')));
  });

  it('prints no sentence that says it does not replace the systems', () => {
    const html = readFileSync(at(SITE), 'utf8');
    expect(html).not.toMatch(/does not replace your SIS/i);
    expect(html).toContain('replacement map');
  });

  it('carries the map as modules.ts has it', () => {
    let html = readFileSync(at(SITE), 'utf8');
    if (process.env.REGISTERS === 'write' && blockOf(html) !== expectedBlock()) {
      html = html.replace(blockOf(html), expectedBlock());
      writeFileSync(at(SITE), html);
    }
    expect(blockOf(html)).toBe(expectedBlock());
    // The words on the company site are the register's, not its own.
    expect(html).toContain(`<span class="cs cs-pl">${STATUS_LABEL.planned}</span></td><td>\${m.replaces`);
  });
});
