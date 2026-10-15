import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { RpcClient } from './postgres.ts';

const run = promisify(execFile);

/**
 * An `RpcClient` that calls the real SQL functions through `psql`, as `service_role`,
 * each call on its own connection and in its own transaction.
 *
 * That is what a PostgREST call is, minus the HTTP: named arguments in, one function
 * run, JSON out, and a SQLSTATE if it raised. It exists so the repository adapter can
 * be run against the migrated database that `supabase/check.sh` builds — the only
 * honest test of the half of a conversation that the SQL suites cannot see. What it
 * does *not* reproduce is PostgREST itself: HTTP status mapping, row limits, the way
 * it renders types. The adapter is built so that none of that is in play (every read
 * returns finished JSON; every error is read by SQLSTATE), and the first run against
 * a real PostgREST should confirm that the SQLSTATE arrives in `error.code`.
 *
 * Test support only: it shells out, and it is never imported by the service.
 */

const literal = (value: unknown): string => {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'string') return `'${value.replaceAll("'", "''")}'`;
  return `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
};

export interface PsqlTarget {
  host: string;
  port: string;
}

const base = (t: PsqlTarget) => ['-X', '-q', '-At', '-h', t.host, '-p', t.port, '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose'];

export class PsqlRpcClient implements RpcClient {
  /** Every call made, in order, for tests that assert on the conversation. */
  readonly calls: { fn: string; args: Record<string, unknown> }[] = [];
  private readonly target: PsqlTarget;
  /** Runs before a named function's call goes out; lets a test make somebody else get there first. */
  beforeCall: ((fn: string, args: Record<string, unknown>) => Promise<void> | void) | null = null;

  constructor(target: PsqlTarget) {
    this.target = target;
  }

  async rpc(fn: string, args: Record<string, unknown> = {}): Promise<{ data: unknown; error: { code?: string; message?: string } | null }> {
    this.calls.push({ fn, args });
    if (this.beforeCall) await this.beforeCall(fn, args);
    const named = Object.entries(args).map(([k, v]) => `${k} => ${literal(v)}`).join(', ');
    const sql = `set role service_role; select coalesce(to_jsonb(public.${fn}(${named}))::text, 'null');`;
    try {
      const { stdout } = await run('psql', [...base(this.target), '-c', sql]);
      return { data: JSON.parse(stdout.trim().split('\n').at(-1)!), error: null };
    } catch (e) {
      const text = String((e as { stderr?: string }).stderr ?? e);
      const m = /ERROR:\s+([0-9A-Z]{5}):\s*(.*)/.exec(text);
      return { data: null, error: { code: m?.[1] ?? 'XX000', message: m?.[2] ?? text.slice(0, 200) } };
    }
  }
}

/** Plain SQL as the superuser, for fixtures and for looking at what the database holds. */
export async function psql(target: PsqlTarget, sql: string): Promise<string> {
  const { stdout } = await run('psql', [...base(target), '-c', sql]);
  return stdout.trim();
}

export async function psqlJson<T>(target: PsqlTarget, sql: string): Promise<T> {
  return JSON.parse(await psql(target, `select coalesce(jsonb_agg(t), '[]') from (${sql}) t`)) as T;
}
