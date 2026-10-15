/// <reference types="node" />
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Answering a rights request, held in the text of the migration.
 *
 * `supabase/answer-rights-requests.check.sql` is the guard that runs the
 * mechanism. This one stops the shape of it being edited away unnoticed, and
 * the legal boundary being crossed by a convenient change: the response clock
 * and who may answer are counsel's (privacy queue P-03, [COUNSEL REQUIRED]).
 */
const SUPABASE = join(__dirname, '..', '..', '..', 'supabase');
const FILE = '20261004200000_answer_data_subject_requests.sql';
const sql = readFileSync(join(SUPABASE, 'migrations', FILE), 'utf8');

const body = (name: string): string =>
  new RegExp(`create or replace function ${name}[\\s\\S]*?\\nend \\$\\$;`).exec(sql)?.[0] ?? '';

describe('answering a data-subject request', () => {
  it('both functions are gated by the existing capability and refuse the requester', () => {
    for (const name of ['public\\.answer_data_subject_request', 'public\\.verify_data_subject_request']) {
      const fn = body(name);
      expect(fn.length, `${name} found`).toBeGreaterThan(300);
      expect(fn).toContain("private.has_capability('data_request:handle')");
      expect(fn).toContain('req.subject = me');
      expect(fn).toContain('security definer');
      expect(fn).toContain("set search_path = ''");
    }
    expect(sql).toMatch(/revoke all on function public\.answer_data_subject_request\(uuid, text, text\) from public, anon;/);
    expect(sql).toMatch(/revoke all on function public\.verify_data_subject_request\(uuid, text\) from public, anon;/);
  });

  it('adds no role, no capability, and no client write on the table', () => {
    expect(sql).not.toMatch(/insert into public\.role_capabilities/i);
    expect(sql).not.toMatch(/insert into public\.role_grants/i);
    expect(sql).not.toMatch(/grant (update|delete|all)[^;]*on (table )?public\.data_subject_request/i);
    // The capability it uses is one a migration already gave the data steward.
    const earlier = readdirSync(join(SUPABASE, 'migrations'))
      .filter((f) => f < FILE)
      .some((f) => /\('data_steward',\s+'data_request:handle'\)/.test(readFileSync(join(SUPABASE, 'migrations', f), 'utf8')));
    expect(earlier).toBe(true);
  });

  it('puts no response time in the mechanism, and leaves the 30-day default alone', () => {
    const code = sql.replace(/--.*$/gm, '');
    expect(code).not.toMatch(/due_at/);
    expect(code).not.toMatch(/interval\s+'/i);
    expect(sql).toContain('[COUNSEL REQUIRED');
  });

  it('the audit event is written by the table and carries structure only', () => {
    const fn = body('private\\.audit_subject_request_change');
    expect(fn.length).toBeGreaterThan(300);
    expect(fn).toContain("'privacy.request_status_changed'");
    expect(fn).toContain("'privacy.request_verified'");
    expect(sql).toMatch(/after update on public\.data_subject_request/);
    const detail = [...fn.matchAll(/jsonb_build_object\(([^;]*?)\)\s*\n?\s*\);/g)].map((m) => m[1]).join(' ');
    // Keys that carry a person's words or identity must never appear in the detail.
    expect(detail).not.toMatch(/resolution|detail|note|subject|email|name|text/i);
    expect(detail).toContain("'from'");
    expect(detail).toContain("'rung'");
  });
});
