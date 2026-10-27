// Guard: two migrations must never define the same table or function. On 26 Oct a new records-requests module was
// written over src/lib/prvMigration.ts, which already held the APP-013 records-rights module with its own prv_* tables;
// CREATE TABLE IF NOT EXISTS would have silently kept whichever schema ran first. This test fails on any such collision.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { test, eq } from './harness';

// Find the repository root from wherever the suite is run (repo root or apps/semester).
let base = resolve('.');
while (!existsSync(join(base, 'apps', 'semester', 'src', 'lib')) && dirname(base) !== base) base = dirname(base);
const roots = ['apps/semester/src/lib', 'apps/semester-company-os/src/lib', 'apps/semester-security-lab/src/lib'].map((d) => join(base, d)).filter((d) => existsSync(d));

function definitions(kind: 'TABLE' | 'FUNCTION') {
  const re = kind === 'TABLE' ? /CREATE TABLE IF NOT EXISTS\s+([a-z_][a-z0-9_]*)/gi : /CREATE OR REPLACE FUNCTION\s+([a-z_][a-z0-9_]*)\s*\(/gi;
  const where = new Map<string, Set<string>>();
  for (const dir of roots) for (const f of readdirSync(dir).filter((n) => /Migration\.ts$/.test(n))) {
    const src = readFileSync(join(dir, f), 'utf8');
    for (const m of src.matchAll(re)) {
      const name = m[1].toLowerCase();
      if (!where.has(name)) where.set(name, new Set());
      where.get(name)!.add(`${dir}/${f}`);
    }
  }
  return [...where.entries()].filter(([, files]) => files.size > 1).map(([n, files]) => `${n}: ${[...files].join(', ')}`);
}

test('the guard sees the migrations (control)', () => { eq(roots.length > 0 && readdirSync(roots[0]).some((n) => /Migration\.ts$/.test(n)), true); });
test('no table is created by two migrations', () => { eq(definitions('TABLE').join('\n'), ''); });
test('no function is defined by two migrations', () => { eq(definitions('FUNCTION').join('\n'), ''); });
