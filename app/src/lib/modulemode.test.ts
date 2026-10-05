/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CORE_MODULES } from '@semester/contract';
import { MODULES } from '../site/modules';
import { readModeRows, resolveModuleMode, SOURCE_TEXT, type ModuleModeRow } from './modulemode';

const ROOT = join(__dirname, '..', '..', '..');
const SQL = readFileSync(join(ROOT, 'supabase', 'migrations', '20260930010000_module_mode.sql'), 'utf8');

const row = (module: string, mode: string, o: Partial<ModuleModeRow> = {}): ModuleModeRow => ({ module, mode, frozen: false, killed: false, ...o });

describe('resolving a module’s mode', () => {
  it('is Connect when nothing has been read, and says the setting was unavailable', () => {
    expect(resolveModuleMode('registration', null)).toEqual({ mode: 'connect', frozen: false, source: 'unavailable' });
  });

  it('is Connect by default for a module the database lists no change for', () => {
    expect(resolveModuleMode('registration', [row('records', 'core')])).toEqual({ mode: 'connect', frozen: false, source: 'default' });
  });

  it('is Core only for a Core row that is neither frozen nor killed', () => {
    expect(resolveModuleMode('registration', [row('registration', 'core')])).toEqual({ mode: 'core', frozen: false, source: 'school' });
  });

  it('is Connect and frozen when a module went back, with the school named as the source', () => {
    expect(resolveModuleMode('registration', [row('registration', 'connect', { frozen: true })])).toEqual({ mode: 'connect', frozen: true, source: 'school' });
  });

  it('is Connect under the kill switch even if the row says Core, and keeps the freeze', () => {
    const r = resolveModuleMode('registration', [row('registration', 'connect', { frozen: true, killed: true })]);
    expect(r).toEqual({ mode: 'connect', frozen: true, source: 'kill-switch' });
    expect(resolveModuleMode('registration', [row('registration', 'core', { killed: true })]).mode).toBe('connect');
  });

  // The control: a resolver that always said Connect would pass everything above except this.
  it('can say Core at all', () => {
    expect(CORE_MODULES.every((m) => resolveModuleMode(m, CORE_MODULES.map((x) => row(x, 'core'))).mode === 'core')).toBe(true);
  });

  it('has words for every source', () => {
    for (const s of ['school', 'default', 'kill-switch', 'unavailable'] as const) expect(SOURCE_TEXT[s].length).toBeGreaterThan(10);
  });

  it('reads only well-formed rows of known modules', () => {
    expect(readModeRows(null)).toEqual([]);
    expect(readModeRows([{ module: 'not_a_module', mode: 'core' }, { mode: 'core' }, 7, { module: 'records', mode: 'core', frozen: true, killed: false }]))
      .toEqual([{ module: 'records', mode: 'core', frozen: true, killed: false }]);
  });
});

describe('the list of modules is one list', () => {
  it('is the same fourteen in the contract, the database and the takeover map', () => {
    const fn = SQL.match(/create or replace function public\.core_modules\(\)[\s\S]*?array\[([\s\S]*?)\]::text\[\]/);
    expect(fn, 'public.core_modules() in the migration').not.toBeNull();
    const inSql = [...fn![1].matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]);
    expect(inSql).toEqual([...CORE_MODULES]);
    expect(MODULES.map((m) => m.id)).toEqual([...CORE_MODULES]);
  });

  it('is checked by supabase/module_mode.check.sql, which exists', () => {
    const check = readFileSync(join(ROOT, 'supabase', 'module_mode.check.sql'), 'utf8');
    expect(check).toContain('tenant_module_mode');
    expect(check).toContain('cannot approve their own');
  });
});
