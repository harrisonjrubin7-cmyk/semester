/// <reference types="node" />
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(process.cwd(), '..');
const manifest = JSON.parse(readFileSync(join(root, 'endpoint-manifest.json'), 'utf8')) as {
  counts: { http_entry_points: number; authenticated_rpc_operations: number; explicit_service_role_operations: number };
  http_entry_points: Array<{ id: string; source: string; authentication: string; authorization_and_tenant_resolution: string; tests: string[] }>;
  authenticated_rpc_operations: Array<{ signature: string }>;
};

describe('endpoint manifest coverage', () => {
  it('covers every deployed Edge Function and the Vercel route', () => {
    const functions = readdirSync(join(root, 'supabase/functions'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
      .filter((entry) => readdirSync(join(root, 'supabase/functions', entry.name)).includes('index.ts'))
      .map((entry) => `edge:${entry.name}`)
      .sort();
    const recorded = manifest.http_entry_points.filter((entry) => entry.id.startsWith('edge:')).map((entry) => entry.id).sort();
    expect(recorded).toEqual(functions);
    expect(manifest.http_entry_points.some((entry) => entry.id === 'vercel:institution')).toBe(true);
  });

  it('gives every HTTP boundary an authentication decision, authorization decision and test record', () => {
    for (const entry of manifest.http_entry_points) {
      expect(entry.authentication, entry.id).toBeTruthy();
      expect(entry.authorization_and_tenant_resolution, entry.id).toBeTruthy();
      expect(entry.tests.length, entry.id).toBeGreaterThan(0);
      expect(readFileSync(join(root, entry.source), 'utf8').length, entry.id).toBeGreaterThan(0);
    }
  });

  it('matches the authenticated RPC allowlist that the database grant test enforces', () => {
    const grants = readFileSync(join(root, 'supabase/grants.check.sql'), 'utf8');
    const block = grants.match(/allowed constant text\[\] := array\[([\s\S]*?)\n\s*\];/);
    expect(block).not.toBeNull();
    const clean = block![1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/--.*$/gm, '');
    const allowed = [...clean.matchAll(/'((?:''|[^'])+)'/g)]
      .map((match) => match[1].replace(/''/g, "'"));
    expect(manifest.authenticated_rpc_operations.map((entry) => entry.signature).sort())
      .toEqual([...new Set(allowed)].sort());
  });

  it('keeps its declared counts honest', () => {
    expect(manifest.counts.http_entry_points).toBe(manifest.http_entry_points.length);
    expect(manifest.counts.authenticated_rpc_operations).toBe(manifest.authenticated_rpc_operations.length);
  });
});
