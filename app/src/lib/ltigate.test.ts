/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { passbackVerdict } from '../../../supabase/functions/_shared/ltigate';

describe('reading the passback gate', () => {
  it('lets through the two allowing words, and says which', () => {
    expect(passbackVerdict('allowed', null)).toEqual({ ok: true, bound: true });
    expect(passbackVerdict('allowed-unbound', null)).toEqual({ ok: true, bound: false });
  });

  it('refuses every other word and carries it as the detail', () => {
    for (const word of ['kill-switch', 'flag-off', 'module-off', 'scope-not-approved', 'connection-paused']) {
      expect(passbackVerdict(word, null)).toEqual({ ok: false, reason: 'passback-off', detail: word });
    }
  });

  it('never echoes something that is not a gate word', () => {
    expect(passbackVerdict({ a: 1 }, null)).toMatchObject({ ok: false, detail: 'gate-unreadable' });
    expect(passbackVerdict('<script>', null)).toMatchObject({ ok: false, detail: 'gate-unreadable' });
    expect(passbackVerdict(null, null)).toMatchObject({ ok: false });
  });

  it('keeps the old behaviour only while the function is not deployed yet', () => {
    expect(passbackVerdict(null, { message: 'Could not find the function public.lti_passback_decision in the schema cache' }))
      .toEqual({ ok: true, bound: false });
    expect(passbackVerdict(null, { message: 'function public.lti_passback_decision(text, text) does not exist' }))
      .toEqual({ ok: true, bound: false });
  });

  it('closes on any other error', () => {
    expect(passbackVerdict(null, { message: 'permission denied' })).toMatchObject({ ok: false, reason: 'gate-failed' });
    expect(passbackVerdict(null, { message: '' })).toMatchObject({ ok: false, reason: 'gate-failed' });
  });

  it('knows every word the database can answer', () => {
    const sql = readFileSync(
      new URL('../../../supabase/migrations/20260927180000_lti_integration_binding.sql', import.meta.url), 'utf8');
    const decision = sql.slice(sql.indexOf('function public.lti_passback_decision'), sql.indexOf('function public.lti_record_context'));
    const words = [...decision.matchAll(/return '([a-z-]+)'/g)].map((m) => m[1]);
    expect(words).toContain('allowed');
    expect(words).toContain('allowed-unbound');
    for (const w of words) {
      const v = passbackVerdict(w, null);
      if (w.startsWith('allowed')) expect(v.ok, w).toBe(true);
      else expect(v, w).toEqual({ ok: false, reason: 'passback-off', detail: w });
    }
  });
});

describe('the score route asks the gate', () => {
  const fn = readFileSync(new URL('../../../supabase/functions/lti/index.ts', import.meta.url), 'utf8');
  const score = fn.slice(fn.indexOf("path.endsWith('/score')"), fn.indexOf("path.endsWith('/jwks')"));

  it('before it signs or sends anything', () => {
    const gate = score.indexOf("rpc('lti_passback_decision'");
    expect(gate).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(score.indexOf('clientAssertion('));
    expect(gate).toBeLessThan(score.indexOf('fetch('));
  });

  it('and a launch records its course context', () => {
    expect(fn).toContain("rpc('lti_record_context'");
  });
});
