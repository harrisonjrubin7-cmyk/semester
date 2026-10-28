import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EDGE_GUARDS } from './edgeguards';

const ROOT = join(__dirname, '../../..');
const FUNCTIONS = join(ROOT, 'supabase/functions');
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');
const manifest = (fn: string): { imports?: Record<string, string> } =>
  JSON.parse(read(`supabase/functions/${fn}/deno.json`)) as { imports?: Record<string, string> };

function typescriptFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? typescriptFiles(path) : entry.name.endsWith('.ts') ? [path] : [];
  });
}

function configurationProblems(dependabot: string, manifests: readonly string[], locks: readonly string[]): string[] {
  const problems: string[] = [];
  if (!/package-ecosystem: deno/.test(dependabot)) problems.push('Deno ecosystem is not enabled');
  if (!/- \/supabase\/functions\/\*/.test(dependabot)) problems.push('function manifests are not included');
  if (!/group-by: dependency-name/.test(dependabot)) problems.push('cross-function updates are not grouped');
  for (const fn of EDGE_GUARDS.map((guard) => guard.fn)) {
    if (!manifests.includes(fn)) problems.push(`no manifest for ${fn}`);
    if (!locks.includes(fn)) problems.push(`no lock for ${fn}`);
  }
  return problems;
}

function importMapProblems(
  functions: readonly string[],
  loadManifest: (fn: string) => { imports?: Record<string, string> } = manifest,
): string[] {
  const problems: string[] = [];
  for (const path of typescriptFiles(FUNCTIONS)) {
    const relative = path.slice(FUNCTIONS.length + 1);
    const owner = relative.split('/')[0];
    const owners = owner === '_shared' ? functions : [owner];
    const specs = [...readFileSync(path, 'utf8').matchAll(/(?:from\s+|import\s*\(\s*)['"]([^'"]+)['"]/g)]
      .map((match) => match[1])
      .filter((spec) => !spec.startsWith('.') && !/^(jsr|npm|node):/.test(spec));
    for (const spec of specs) {
      for (const fn of owners) {
        if (!loadManifest(fn).imports?.[spec]) problems.push(`${relative}: ${spec} is not mapped by ${fn}`);
      }
    }
  }
  return problems;
}

describe('Edge Function dependency updates', () => {
  const functions = EDGE_GUARDS.map((guard) => guard.fn).sort();
  const manifests = readdirSync(FUNCTIONS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && functions.includes(entry.name))
    .filter((entry) => readdirSync(join(FUNCTIONS, entry.name)).includes('deno.json'))
    .map((entry) => entry.name)
    .sort();
  const locks = readdirSync(FUNCTIONS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && functions.includes(entry.name))
    .filter((entry) => readdirSync(join(FUNCTIONS, entry.name)).includes('deno.lock'))
    .map((entry) => entry.name)
    .sort();

  it('gives every deployed function an isolated Deno manifest and integrity lock', () => {
    expect(manifests).toEqual(functions);
    expect(locks).toEqual(functions);
    for (const fn of functions) {
      expect(manifest(fn).imports?.['@supabase/supabase-js'], fn).toBe('jsr:@supabase/supabase-js@2');
      const lock = JSON.parse(read(`supabase/functions/${fn}/deno.lock`)) as { version?: string; specifiers?: Record<string, string> };
      expect(lock.version, fn).toBe('5');
      expect(lock.specifiers?.['jsr:@supabase/supabase-js@2'], fn).toMatch(/^2\./);
    }
    expect(manifest('lti').imports?.jose).toBe('npm:jose@5');
    expect(manifest('push').imports?.['web-push']).toBe('npm:web-push@3.6.7');
  });

  it('keeps registry versions in manifests rather than untracked source imports', () => {
    const direct = typescriptFiles(FUNCTIONS)
      .flatMap((path) => [...readFileSync(path, 'utf8').matchAll(/(?:from\s+|import\s*)['"]((?:jsr|npm):[^'"]+)['"]/g)].map((match) => `${path}: ${match[1]}`));
    expect(direct).toEqual([]);
    expect(importMapProblems(functions)).toEqual([]);
  });

  it('enables grouped Dependabot updates across the complete function set', () => {
    const dependabot = read('.github/dependabot.yml');
    expect(configurationProblems(dependabot, manifests, locks)).toEqual([]);
  });

  it('has negative controls for a missing updater and a missing function manifest', () => {
    const dependabot = read('.github/dependabot.yml');
    expect(configurationProblems(dependabot.replace('package-ecosystem: deno', 'package-ecosystem: disabled'), manifests, locks)).toContain('Deno ecosystem is not enabled');
    expect(configurationProblems(dependabot, manifests.filter((fn) => fn !== 'claude'), locks)).toContain('no manifest for claude');
    expect(configurationProblems(dependabot, manifests, locks.filter((fn) => fn !== 'claude'))).toContain('no lock for claude');
    expect(importMapProblems(functions, (fn) => {
      const configured = manifest(fn);
      return fn === 'lti'
        ? { imports: Object.fromEntries(Object.entries(configured.imports ?? {}).filter(([key]) => key !== 'jose')) }
        : configured;
    })).toContain('lti/index.ts: jose is not mapped by lti');
  });
});
