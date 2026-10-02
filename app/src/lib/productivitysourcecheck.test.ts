/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(process.cwd(), '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('productivity source-check abuse controls', () => {
  const edge = read('supabase/functions/productivity-sourcecheck/index.ts');
  const migration = read('supabase/migrations/20261002100000_productivity_source_rate_limit.sql');

  it('spends a shared allowance after validating the request and before any DNS or fetch work', () => {
    const input = edge.indexOf("typeof input.url!=='string'");
    const limit = edge.indexOf("client.rpc('take_productivity_source_rate_limit')");
    const dns = edge.indexOf('approvedUrl(input.url)');
    const fetch = edge.indexOf('fetch(url');
    expect(input).toBeGreaterThan(0);
    expect(limit).toBeGreaterThan(input);
    expect(dns).toBeGreaterThan(limit);
    expect(fetch).toBeGreaterThan(dns);
  });

  it('returns a bounded 429 and retry guidance without exposing database errors', () => {
    expect(edge).toContain("limitError.code==='54000'");
    expect(edge).toContain("status:429");
    expect(edge).toContain("'Retry-After':'60'");
    expect(edge).not.toMatch(/response\([^\n]*limitError\.message/);
  });

  it('fails closed when the shared limiter is unavailable', () => {
    const limiter = edge.slice(edge.indexOf("client.rpc('take_productivity_source_rate_limit')"), edge.indexOf('let url='));
    expect(limiter).toContain("return response(503");
    expect(limiter).not.toContain('approvedUrl(');
    expect(limiter).not.toContain('fetch(');
  });

  it('returns only intentional validation messages and redacts runtime failures', () => {
    expect(edge).toContain('class PublicSourceError extends Error');
    expect(edge).toContain('if(e instanceof PublicSourceError)return response(400,{error:e.message})');
    expect(edge).toContain("return response(400,{error:'Source check failed.'})");
    expect(edge).not.toMatch(/e instanceof Error\?e\.message/);
  });

  it('derives the subject and policy server-side and grants only authenticated execution', () => {
    expect(migration).toContain('me uuid := auth.uid()');
    expect(migration).toContain("'productivity_source'");
    expect(migration).toMatch(/'productivity_source',\s*10,\s*60/s);
    expect(migration).toContain('from public, anon, authenticated');
    expect(migration).toContain('to authenticated');
    expect(migration).not.toMatch(/take_productivity_source_rate_limit\([^)]*(uuid|text|integer)/);
  });
});
