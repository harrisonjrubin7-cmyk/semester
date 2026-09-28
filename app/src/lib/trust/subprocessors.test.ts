import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PARTIES, renderRegister, unregisteredHosts } from './subprocessors';

/**
 * The subprocessor register, held to the two places the tree itself says
 * where data can go.
 *
 * **The browser's list.** `app/index.html` carries a content-security policy,
 * and `connect-src` and `img-src` are the complete set of hosts the app may
 * send a request to. A host there that nobody listed here is a destination a
 * procurement reviewer was not told about; a host here that is no longer
 * there is a register describing an app that no longer exists. Both fail.
 *
 * **The server's list.** Anything that calls a third party server-side does it
 * from a Supabase Edge Function. Every function directory must be accounted
 * for, so adding one that reaches somewhere new fails here until it is named.
 *
 * Each has a control: the parser must find hosts and functions known to be
 * there, or a regex that matches nothing would report the register complete.
 */

const root = join(import.meta.dirname, '../../../..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

/** Hosts named by one CSP directive, without schemes or keyword sources. */
function cspHosts(directive: string): string[] {
  const csp = /http-equiv="Content-Security-Policy"\s+content="([^"]+)"/.exec(read('app/index.html'))?.[1] ?? '';
  const body = new RegExp(`${directive}\\s+([^;]+)`).exec(csp)?.[1] ?? '';
  return body.split(/\s+/)
    .filter((t) => /^(https|wss):\/\//.test(t))
    .map((t) => t.replace(/^(https|wss):\/\//, ''));
}

const browser = [...new Set([...cspHosts('connect-src'), ...cspHosts('img-src')])];
const listed = PARTIES.flatMap((p) => p.hosts);

describe('the subprocessor register', () => {
  it('reads the content-security policy, and finds hosts known to be in it', () => {
    expect(browser).toContain('*.supabase.co');
    expect(browser).toContain('api.anthropic.com');
    expect(browser).toContain('*.tile.openstreetmap.org');
    expect(browser.length).toBeGreaterThanOrEqual(15);
  });

  it('names every host the browser may send data to', () => {
    expect(browser.filter((h) => !listed.includes(h))).toEqual([]);
  });

  it('names no host the browser can no longer reach', () => {
    expect(listed.filter((h) => !browser.includes(h))).toEqual([]);
  });

  it('accounts for every Edge Function, and names none that is gone', () => {
    const dirs = readdirSync(join(root, 'supabase/functions'), { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
      .map((d) => d.name);
    expect(dirs).toContain('claude');
    expect(dirs.length).toBeGreaterThanOrEqual(5);
    const named = PARTIES.flatMap((p) => p.functions ?? []);
    expect(dirs.filter((d) => !named.includes(d)), 'functions nobody accounted for').toEqual([]);
    expect(named.filter((n) => !dirs.includes(n)), 'functions that no longer exist').toEqual([]);
  });

  it('accounts for every gateway AI provider', () => {
    const providers = readdirSync(join(root, 'app/server/institution/providers'))
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && f !== 'types.ts');
    expect(providers).toContain('openai.ts');
    for (const f of providers) {
      expect(PARTIES.some((p) => p.evidence.includes(`app/server/institution/providers/${f}`)), f).toBe(true);
    }
  });

  it('cites only files that exist, with a control that a missing one is seen', () => {
    expect(existsSync(join(root, 'docs/no-such-subprocessor.md'))).toBe(false);
    for (const p of PARTIES) {
      expect(p.evidence.length, p.name).toBeGreaterThan(0);
      for (const e of p.evidence) expect(existsSync(join(root, e)), `${p.name} cites ${e}`).toBe(true);
    }
  });

  it('never calls a student-chosen service Semester’s subprocessor, or hides one that is', () => {
    // Semester's own key, server-side: its subprocessor. The student's key, in the browser: not.
    expect(PARTIES.find((p) => p.functions?.includes('claude'))?.kind).toBe('subprocessor');
    expect(PARTIES.find((p) => p.hosts.includes('api.anthropic.com'))?.kind).toBe('student-directed');
    expect(PARTIES.find((p) => p.hosts.includes('*.supabase.co'))?.kind).toBe('subprocessor');
  });

  it('explains every host a deployment can add to the policy', () => {
    const fn = /function cspExtraConnect[\s\S]*?for \(const name of \[([\s\S]*?)\]\)/.exec(read('app/vite.config.ts'))?.[1] ?? '';
    const settings = [...fn.matchAll(/'(VITE_[A-Z_]+)'/g)].map((m) => m[1]);
    // `supabase` is a variable holding 'VITE_SUPABASE_URL', declared above the list.
    settings.push('VITE_SUPABASE_URL');
    expect(settings).toContain('VITE_UNIVERSITY_GATEWAY_URL');
    const doc = read('docs/SUBPROCESSORS.md');
    for (const name of settings) expect(doc, name).toContain(`| \`${name}\` |`);
  });

  it('covers every proxy origin committed for the deployed build', () => {
    const env = read('app/.env.production');
    const origins = ['VITE_CLAUDE_PROXY', 'VITE_ICS_PROXY', 'VITE_OAUTH_PROXY', 'VITE_UNIVERSITY_GATEWAY_URL', 'VITE_SUPABASE_URL']
      .map((name) => new RegExp(`^${name}=(\\S+)`, 'm').exec(env)?.[1] ?? '')
      .filter((v) => /^https:\/\//.test(v));
    // The control: the deployed Supabase project is committed there, so the parse found something.
    expect(origins.some((o) => o.includes('.supabase.co'))).toBe(true);
    expect(unregisteredHosts(origins.join(' '))).toEqual([]);
  });

  it('names an unregistered host, and passes registered and wildcard ones (controls)', () => {
    expect(unregisteredHosts('https://abc.supabase.co wss://abc.supabase.co https://api.anthropic.com')).toEqual([]);
    expect(unregisteredHosts('https://proxy.example.net https://abc.supabase.co')).toEqual(['proxy.example.net']);
    expect(unregisteredHosts('https://supabase.co')).toEqual(['supabase.co']);
    expect(unregisteredHosts(undefined)).toEqual([]);
  });

  it('is published verbatim in the register document', () => {
    expect(read('docs/SUBPROCESSORS.md'), 'paste renderRegister() output into docs/SUBPROCESSORS.md').toContain(renderRegister());
  });
});
