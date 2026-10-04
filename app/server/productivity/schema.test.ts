import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EVENT_TYPES } from '../../../packages/institution/src/index.ts';
import { LIMITS, REPEAT_EVERY } from './contract.ts';
import { EVENT_ID, TASK_ID, createEvent, createTask, harness, person } from './fixtures.ts';

/**
 * The TypeScript and the SQL describe the same records and agree on them only
 * by convention, and a convention that two files keep by hand drifts. These
 * tests read the migration and hold the two together: a key the SQL reads that
 * the service does not produce would arrive as null, and a key the service
 * produces that the SQL does not read would be dropped on the way to the
 * table — silently, in both cases, until somebody noticed a missing field.
 */

const migrations = new URL('../../../supabase/migrations/', import.meta.url);
const migration = (name: string) => readFileSync(new URL(name, migrations), 'utf8');

/** The tables and the grants, as the first migration made them. */
const sql = migration('20261004123000_productivity_commands.sql');

/**
 * The commit function as it *currently* stands: the latest migration that defines it. A later one
 * replaces the first (the read-side migration adds the held prediction), so reading the first
 * would be reading a function that is no longer there.
 */
const latestCommit = readdirSync(migrations).filter((f) => f.endsWith('.sql')).sort()
  .filter((f) => migration(f).includes('create or replace function private.productivity_commit(')).at(-1)!;
const commitSource = migration(latestCommit);
const commit = commitSource.slice(
  commitSource.indexOf('create or replace function private.productivity_commit'),
  commitSource.includes('create or replace function public.productivity_commit') ? commitSource.indexOf('create or replace function public.productivity_commit') : undefined,
);
const reads = migration('20261004180000_productivity_reads.sql');
/** The migration that adds the app's task fields, which holds their column constraints. */
const fieldsSql = migration('20261004190000_productivity_task_carries_the_apps_task.sql');

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

  it('holds the new task fields to the bounds the validators enforce', () => {
    const has = (s: string) => expect(fieldsSql, s).toContain(s);
    has(`length(when_text) between 1 and ${LIMITS.whenTextMax}`);
    has(`length(planned_from) between 1 and ${LIMITS.plannedFromMax}`);
    has(`jsonb_array_length(steps) <= ${LIMITS.stepsMax}`);
    has(`in (${REPEAT_EVERY.map((e) => `'${e}'`).join(', ')})`);
    // `coalesce(…, false)`: a check passes on null, so without it a rule with no `until` would be stored.
    expect(fieldsSql).toMatch(/coalesce\([\s\S]*?false\s*\)/);
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
  it('keeps the held-prediction guard in the commit function that applies last, so a later copy of an older definition cannot drop it', () => {
    expect(commit).toMatch(/if e \? 'seq' and \(e->>'seq'\)::bigint <> next_seq then\s*raise exception 'sequence moved since it was predicted' using errcode = '40001'/);
  });
  it('lets no client role write the tables or call the commit', () => {
    expect(sql).toMatch(/grant select on table public\.productivity_task to authenticated;/);
    expect(sql).not.toMatch(/grant (insert|update|delete|all)[^;]* on table public\.productivity_(task|event) to (authenticated|anon)/);
    expect(sql).toMatch(/grant execute on function public\.productivity_commit\([^)]*\) to service_role;/);
  });
});

describe('the read functions return the entity the service holds, so the adapter maps nothing', () => {
  // A later migration may redefine a read function (this one's task fields do), so read the definition that applies last.
  const latestSourceOf = (name: string): string => {
    const files = readdirSync(migrations).filter((f) => f.endsWith('.sql') && migration(f).includes(`create or replace function ${name}`)).sort();
    return migration(files.at(-1)!);
  };
  const body = (name: string) => {
    const source = latestSourceOf(name);
    return source.slice(source.indexOf(`create or replace function ${name}`), source.indexOf('$$;', source.indexOf(`create or replace function ${name}`)));
  };
  const literals = (fn: string) => new Set([...fn.matchAll(/'([A-Za-z]+)',\s/g)].map((m) => m[1]!));

  it.each([['task', 'private.productivity_task_json'], ['event', 'private.productivity_event_json']] as const)('builds a %s with exactly the keys of the entity', async (kind, fn) => {
    const { task, event } = await produced();
    const entity = kind === 'task' ? task : event;
    const built = literals(body(fn));
    for (const k of Object.keys(entity)) expect(built.has(k), `${fn} does not build ${k}`).toBe(true);
    // The only literals that are not keys of the entity are the two inside `source`.
    for (const k of built) if (!(k in entity)) expect(['kind', 'ref'], `${fn} builds ${k}, which the entity has not`).toContain(k);
  });

  it('is callable by the service role and nobody else', () => {
    const names = [...reads.matchAll(/create or replace function public\.(productivity_\w+)\(/g)].map((m) => m[1]!);
    expect(names.sort()).toEqual(['productivity_changes', 'productivity_get', 'productivity_list_events', 'productivity_list_tasks', 'productivity_outbox_stats', 'productivity_tx_state']);
    for (const n of names) {
      expect(reads, n).toMatch(new RegExp(`revoke all on function public\\.${n}\\([^)]*\\) from public, anon, authenticated;`));
      expect(reads, n).toMatch(new RegExp(`grant execute on function public\\.${n}\\([^)]*\\) to service_role;`));
    }
    expect(reads).not.toMatch(/grant execute[^;]*to[^;]*(authenticated|anon)\b/);
    expect(reads.match(/security definer/g)!.length).toBeGreaterThanOrEqual(names.length);
    expect(reads).not.toMatch(/set search_path\s*=\s*public/);
  });
});

describe('the adapter calls functions that exist, with parameters they have', () => {
  const adapter = readFileSync(new URL('./postgres.ts', import.meta.url), 'utf8');
  const all = readdirSync(migrations).filter((f) => f.endsWith('.sql')).map(migration).join('\n');
  const declared = (name: string): Set<string> => {
    const at = all.lastIndexOf(`create or replace function public.${name}(`);
    const sig = all.slice(at, all.indexOf(')\nreturns', at));
    return new Set([...sig.matchAll(/\b(p_[a-z_]+)\b/g)].map((m) => m[1]!));
  };

  it('names only functions a migration defines', () => {
    const called = new Set([...adapter.matchAll(/'(productivity_[a-z_]+)'/g)].map((m) => m[1]!));
    expect(called.size).toBeGreaterThanOrEqual(7);
    for (const fn of called) expect(all, `${fn} is called and not defined`).toContain(`function public.${fn}(`);
  });

  it('passes only parameters that some function it calls declares', () => {
    const called = [...new Set([...adapter.matchAll(/'(productivity_[a-z_]+)'/g)].map((m) => m[1]!))];
    const known = new Set(called.flatMap((fn) => [...declared(fn)]));
    for (const m of adapter.matchAll(/\b(p_[a-z_]+)\b/g)) expect(known.has(m[1]!), `${m[1]} is passed and no function declares it`).toBe(true);
  });

  it('gives the commit exactly the arguments it declares', () => {
    expect([...declared('productivity_commit')].sort()).toEqual(['p_audit', 'p_command', 'p_entities', 'p_events', 'p_owner', 'p_tenant']);
  });
});
