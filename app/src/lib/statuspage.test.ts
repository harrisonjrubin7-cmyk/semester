/// <reference types="node" />
// Reads real files on purpose, like handout.test.ts: the fault this guards is
// two files drifting apart, and a fixture would drift with them.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * `public/status.html` sits outside the bundle so it still renders when the
 * app does not, which means Vite never gives it the build's Supabase values.
 * It carries its own copy. If the project moves and only `.env.production` is
 * updated, the status page goes on probing the old project and reports
 * whatever that one is doing — a status page that is confidently wrong.
 */
const root = process.cwd();
const page = readFileSync(join(root, 'public', 'status.html'), 'utf8');
const env = readFileSync(join(root, '.env.production'), 'utf8');

const envValue = (name: string): string => {
  const line = env.split('\n').find((l) => l.startsWith(`${name}=`));
  if (!line) throw new Error(`${name} missing from .env.production`);
  return line.slice(name.length + 1).trim();
};
const pageValue = (name: string): string => {
  const match = page.match(new RegExp(`var ${name} = '([^']+)'`));
  if (!match) throw new Error(`${name} missing from status.html`);
  return match[1];
};

describe('the status page', () => {
  it('probes the same Supabase project the app is built against', () => {
    expect(pageValue('SUPABASE_URL')).toBe(envValue('VITE_SUPABASE_URL'));
  });

  it('uses the publishable key the app already ships, never a secret one', () => {
    const key = pageValue('SUPABASE_KEY');
    expect(key).toBe(envValue('VITE_SUPABASE_KEY'));
    expect(key.startsWith('sb_publishable_')).toBe(true);
  });

  it('has an incident list that parses', () => {
    const data = JSON.parse(readFileSync(join(root, 'public', 'status-incidents.json'), 'utf8'));
    expect(Array.isArray(data.incidents)).toBe(true);
    for (const x of data.incidents) {
      expect(typeof x.date).toBe('string');
      expect(typeof x.status).toBe('string');
      expect(typeof x.title).toBe('string');
      expect(typeof x.detail).toBe('string');
    }
  });
});
