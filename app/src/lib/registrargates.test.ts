import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Task 10. `gradebook_release` and `registrar_decide` already refuse a write
 * without the capability, and a grade release also holds a draft the scheme
 * says must be moderated. The audit row is the operation (`gradebook_spend`)
 * or `registration_audit`, written only after those checks.
 *
 * Shown red by deleting the `grades:release` return in `ledger.ts` (the
 * capability test fails) and by deleting the moderation hold (the unapproved
 * draft is released). Both edits were restored.
 *
 * Co-requisites and registrar time-ticket issuance stay unspecified as
 * behaviour: this file fails if the engine grows a co-requisite rung or a
 * ticket issuer. No transcript function is added here.
 */

const root = join(import.meta.dirname, '../../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

function body(sql: string, signature: string): string {
  const start = sql.indexOf(`function public.${signature}`);
  if (start < 0) throw new Error(`missing ${signature}`);
  const next = sql.indexOf('create or replace function', start + signature.length);
  return sql.slice(start, next === -1 ? undefined : next);
}

const GRADEBOOK = 'supabase/migrations/20260929310000_gradebook.sql';
const REGISTRATION = 'supabase/migrations/20260929300000_registration_transaction.sql';

describe('gradebook_release and registrar_decide', () => {
  it('checks grades:release and moderation before any released row, then records the operation', () => {
    const fn = body(read(GRADEBOOK), 'gradebook_release');
    const gate = fn.indexOf("private.gradebook_require(school, it.course_code, it.term, 'grades:release', false)");
    const approval = fn.indexOf('moderation_required');
    const write = fn.indexOf('insert into public.grade_entries');
    expect(gate).toBeGreaterThan(0);
    expect(approval).toBeGreaterThan(gate);
    expect(write).toBeGreaterThan(approval);
    expect(fn.indexOf('private.gradebook_spend')).toBeGreaterThan(write);
  });

  it('asks for the registrar before it changes an enrollment, and audits the decision', () => {
    const fn = body(read(REGISTRATION), 'registrar_decide');
    const gate = fn.indexOf('private.registration_registrar()');
    const write = fn.indexOf('update public.registration_enrollments');
    expect(gate).toBeGreaterThan(0);
    expect(write).toBeGreaterThan(gate);
    expect(fn).toContain("'approved'");
    expect(fn.indexOf('private.registration_audit')).toBeGreaterThan(gate);
  });

  it('holds the same order in the pure ledger', () => {
    const release = read('app/src/lib/gradebook/ledger.ts');
    const start = release.indexOf('export function release(');
    const end = release.indexOf('// ── Regrade requests', start);
    const fn = release.slice(start, end);
    const gate = fn.indexOf("if (!holds(actor, 'grades:release'))");
    const approval = fn.indexOf("if (book.scheme.moderationRequired && prior.status !== 'moderated')");
    const write = fn.indexOf('keepOperation');
    expect(gate).toBeGreaterThan(0);
    expect(approval).toBeGreaterThan(gate);
    expect(write).toBeGreaterThan(approval);

    const service = read('app/src/lib/enrollment/service.ts');
    const decideAt = service.indexOf("function decide(");
    const nextFn = service.indexOf('// ── The entry points', decideAt);
    const decide = service.slice(decideAt, nextFn);
    const who = decide.indexOf('if (!ctx.registrars.includes(r.registrar))');
    expect(who).toBeGreaterThan(0);
    expect(decide.indexOf('audit(')).toBeGreaterThan(who);
  });

  it('does not add a co-requisite check, a ticket issuer, or a transcript function', () => {
    const service = read('app/src/lib/enrollment/service.ts');
    const model = read('app/src/lib/enrollment/model.ts');
    expect(service).not.toMatch(/coreq/i);
    expect(model).not.toMatch(/coreq/i);
    expect(service).not.toMatch(/issue_time_ticket|issueTicket/);
    const registration = read(REGISTRATION);
    expect(registration).toContain('It cannot decide when somebody may enroll');
    expect(registration).not.toMatch(/coreq/i);
    const names = [...read(GRADEBOOK).matchAll(/function public\.(\w+)/g), ...registration.matchAll(/function public\.(\w+)/g)].map((m) => m[1]);
    expect(names.filter((name) => /transcript/i.test(name))).toEqual([]);
  });
});
