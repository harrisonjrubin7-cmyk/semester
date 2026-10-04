import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EVENT_TYPES } from '../../../packages/institution/src/index.ts';
import { LIMITS } from './contract.ts';
import { EVENT_ID, TASK_ID, createEvent, createTask, harness, person } from './fixtures.ts';

/**
 * The TypeScript and the SQL describe the same records and agree on them only
 * by convention, and a convention that two files keep by hand drifts. These
 * tests read the migration and hold the two together: a key the SQL reads that
 * the service does not produce would arrive as null, and a key the service
 * produces that the SQL does not read would be dropped on the way to the
 * table — silently, in both cases, until somebody noticed a missing field.
 */

const sql = readFileSync(new URL('../../../supabase/migrations/20261004123000_productivity_commands.sql', import.meta.url), 'utf8');
const commit = sql.slice(sql.indexOf('create or replace function private.productivity_commit'), sql.indexOf('create or replace function public.productivity_commit'));

const keysRead = (variable: string, from: string): Set<string> => {
  const out = new Set<string>();
  // The first key after the variable: `r->'source'->>'kind'` reads `source`.
  for (const m of from.matchAll(new RegExp(`\\b${variable}->>?'([A-Za-z]+)'`, 'g'))) out.add(m[1]!);
  return out;
};
const nested = (from: string, parent: string): Set<string> => {
  const out = new Set<string>();
  for (const m of from.matchAll(new RegExp(`${parent.replace(/[()]/g, '\\$&')}->>?'([A-Za-z]+)'`, 'g'))) out.add(m[1]!);
  return out;
};

async function produced() {
  const h = harness();
  await h.service.execute(person(), [createTask(), createEvent()], h.meta);
  // And one refusal, which carries the field an allowed row does not.
  await h.service.execute(person('11111111-1111-4111-8111-111111111111', 'school-a', { capabilities: [] }), [createTask()], h.meta);
  const scope = { tenantId: 'school-a', ownerId: person().actor.id };
  const [task, event] = await Promise.all([h.repo.get(scope, 'task', TASK_ID), h.repo.get(scope, 'calendar_event', EVENT_ID)]);
  return { h, task: task!, event: event!, audit: h.repo.auditRows[0]!, denied: h.repo.auditRows.find((r) => r.outcome === 'denied')!, outbox: h.repo.outbox.rows[0]!.event };
}

describe('the commit function reads exactly what the service writes', () => {
  it('for tasks and events: every key the SQL reads exists, and every key but the scope is read', async () => {
    const { task, event } = await produced();
    // The SQL takes tenant and owner from its own arguments, never from the row, and `seq` from its counter.
    const scopeKeys = new Set(['tenantId', 'ownerId', 'seq']);
    const taskSql = commit.slice(commit.indexOf("if kind = 'task' then\n      insert"), commit.indexOf('else\n      insert into public.productivity_event'));
    const eventSql = commit.slice(commit.indexOf('insert into public.productivity_event'), commit.indexOf('end loop;'));
    for (const [name, entity, part] of [['task', task, taskSql], ['event', event, eventSql]] as const) {
      const read = keysRead('r', part);
      for (const k of read) expect(Object.keys(entity), `${name}: the SQL reads r->>'${k}', which the service does not produce`).toContain(k);
      for (const k of Object.keys(entity)) {
        if (scopeKeys.has(k)) continue;
        expect(read.has(k), `${name}: the service produces ${k}, which the SQL drops`).toBe(true);
      }
      expect(nested(part, 'r->\'source\'')).toEqual(new Set(['kind', 'ref']));
    }
  });

  it('for the audit row, and the event', async () => {
    const { audit, denied, outbox } = await produced();
    const auditSql = commit.slice(commit.indexOf('insert into public.audit_event'), commit.indexOf('for ev in'));
    const given = new Set([...Object.keys(audit), ...Object.keys(denied)]);
    for (const k of keysRead('a', auditSql)) expect([...given], `audit: the SQL reads a->>'${k}'`).toContain(k);
    // What the audit envelope keeps: who (as a pseudonym), what, to what, with what outcome, tied to which request.
    for (const k of ['correlationId', 'action', 'objectKind', 'objectId', 'outcome', 'actorId', 'actorType', 'deviceId', 'commandId']) {
      expect(keysRead('a', auditSql), `audit: ${k} is not kept`).toContain(k);
    }
    const eventSql = commit.slice(commit.indexOf('insert into private.domain_outbox_events'), commit.indexOf('return jsonb_build_object'));
    for (const k of keysRead('ev', eventSql)) expect(Object.keys(outbox), `event: the SQL reads ev->>'${k}'`).toContain(k);
    expect(nested(eventSql, `ev->'subject'`)).toEqual(new Set(['type', 'id']));
  });
});

describe('the limits are the same in both places', () => {
  it('holds each text bound equal to its column constraint', () => {
    const has = (s: string) => expect(sql, s).toContain(s);
    has(`length(title) between 1 and ${LIMITS.titleMax}`);
    has(`length(notes) <= ${LIMITS.notesMax}`);
    has(`length(location) <= ${LIMITS.locationMax}`);
    has(`length(course_id) between 1 and ${LIMITS.courseIdMax}`);
    has(`length(source_ref) between 1 and ${LIMITS.sourceRefMax}`);
    has(`interval '${LIMITS.eventMaxDays} days'`);
  });

  it('keeps the ledger five days longer than a command can be replayed', () => {
    expect(LIMITS.ledgerRetentionDays - LIMITS.commandMaxAgeMs / 86_400_000).toBe(5);
    expect(sql).toContain(`interval '${LIMITS.ledgerRetentionDays} days'`);
  });

  it('names the same sets of values', () => {
    for (const set of ["'open', 'done'", "'low', 'normal', 'high'", "'event', 'focus_block'", "'student_entered', 'imported', 'institution_verified'"]) {
      expect(sql).toContain(`in (${set})`);
    }
  });

  it('writes audit actions the shared envelope accepts', () => {
    const accepted = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
    for (const type of Object.keys(EVENT_TYPES).filter((t) => /^(task|calendar_event|productivity)\./.test(t))) {
      expect(type).toMatch(accepted);
      expect(type.length).toBeLessThanOrEqual(80);
    }
    for (const action of ['task.write', 'calendar.event.write', 'productivity.shared_read']) expect(action).toMatch(accepted);
  });
});

describe('what the database promises is what the service relies on', () => {
  it('has a unique key on tenant, owner and command, so a concurrent duplicate collides', () => {
    expect(sql).toMatch(/primary key \(tenant_id, owner_id, command_id\)/);
  });
  it('refuses a stale writer with 40001 and takes the owner lock before it writes', () => {
    expect(commit).toMatch(/if coalesce\(current_seq, 0\) <> \(e->>'expectedSeq'\)::bigint then\s*raise exception 'entity changed since it was read' using errcode = '40001'/);
    expect(commit.indexOf('from private.productivity_owner_seq')).toBeLessThan(commit.indexOf('insert into private.productivity_command'));
    const lock = commit.indexOf('from private.productivity_owner_seq');
    expect(commit.slice(lock, commit.indexOf('end if;', lock))).toContain('for update');
  });
  it('lets no client role write the tables or call the commit', () => {
    expect(sql).toMatch(/grant select on table public\.productivity_task to authenticated;/);
    expect(sql).not.toMatch(/grant (insert|update|delete|all)[^;]* on table public\.productivity_(task|event) to (authenticated|anon)/);
    expect(sql).toMatch(/grant execute on function public\.productivity_commit\([^)]*\) to service_role;/);
  });
});
