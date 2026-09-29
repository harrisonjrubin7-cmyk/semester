/// <reference types="node" />
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CLAIM_STATUSES } from '../lib/ops/claims';
import { MODULES } from './modules';
import { ROUTES, renderPage } from './render';
import { DEFAULT_SITE } from './config';

const ROOT = join(__dirname, '..', '..', '..');
const MIGRATIONS = join(ROOT, 'supabase', 'migrations');
const SQL = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).map((f) => readFileSync(join(MIGRATIONS, f), 'utf8')).join('\n');
const created = (t: string) => new RegExp(`create table (if not exists )?public\\.${t}\\b`, 'i').test(SQL);
const RANK = ['planned', 'in-preparation', 'built-tested', 'institution-configured', 'limited-beta', 'available'];

describe('the takeover map', () => {
  it('names fourteen modules, each once, in the register’s status words', () => {
    expect(MODULES).toHaveLength(14);
    expect(new Set(MODULES.map((m) => m.id)).size).toBe(14);
    for (const m of MODULES) {
      expect(CLAIM_STATUSES, m.id).toContain(m.status);
      expect(m.replaces.length, m.id).toBeGreaterThan(5);
      expect(m.tables.length, m.id).toBeGreaterThan(0);
    }
  });

  // The control: the probe must be able to see a table that exists.
  it('can tell a table that exists from one that does not', () => {
    expect(created('family_grants')).toBe(true);
    expect(created('no_such_table_zz')).toBe(false);
  });

  it('never states a module above what the tree holds (DO-NOT-BUILD rule 13)', () => {
    for (const m of MODULES) {
      const built = m.tables.every(created);
      if (RANK.indexOf(m.status) > 0) {
        expect(built, `${m.id} is "${m.status}" but a table is missing`).toBe(true);
        expect(existsSync(join(ROOT, 'supabase', `${m.id}.check.sql`)), `${m.id} needs supabase/${m.id}.check.sql`).toBe(true);
      }
    }
  });

  it('never understates a module whose tables have landed', () => {
    for (const m of MODULES) {
      if (m.status === 'planned') expect(m.tables.some(created), `${m.id} has tables but still says planned`).toBe(false);
    }
  });

  it('prints every module, its status word and no present-tense takeover on the boundaries page', () => {
    const route = ROUTES.find((r) => r.path === '/platform/system-boundaries/')!;
    const html = renderPage(route, DEFAULT_SITE);
    for (const m of MODULES) expect(html, m.id).toContain(m.name);
    expect(html).toContain('Planned');
    expect(html).not.toMatch(/replaces (your |the )?(SIS|LMS|registrar)/i);
  });
});

describe('rule 13', () => {
  it('is on the page that lists the rules', () => {
    const page = readFileSync(join(ROOT, 'docs', 'DO-NOT-BUILD.md'), 'utf8');
    expect(page).toMatch(/\| 13 \| \*\*No Core module without/);
  });
});
