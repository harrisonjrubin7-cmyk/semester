/**
 * Real Postgres (PGlite, WASM) with a minimal Supabase shim: the anon and
 * authenticated roles, auth.users, and auth.uid() driven by a session setting.
 * Migrations and seed.sql are applied exactly as committed, so the RLS tests
 * exercise the production SQL rather than a copy of it.
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..", "..");

export const USERS = {
  alice: "00000000-0000-4000-8000-00000000a001",
  bob: "00000000-0000-4000-8000-00000000b002",
  carol: "00000000-0000-4000-8000-00000000c003",
  dave: "00000000-0000-4000-8000-00000000d004",
  erin: "00000000-0000-4000-8000-00000000e005",
} as const;
export type UserName = keyof typeof USERS;

const SHIM = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant usage on schema public to anon, authenticated;
`;

export async function createDb(opts: { seed?: boolean } = {}) {
  const db = new PGlite();
  await db.exec(SHIM);
  const dir = join(root, "supabase", "migrations");
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(dir, f), "utf8"));
  }
  for (const [name, id] of Object.entries(USERS)) {
    await db.query("insert into auth.users (id, email) values ($1, $2)", [id, `${name}@example.test`]);
  }
  if (opts.seed !== false) await db.exec(readFileSync(join(root, "supabase", "seed.sql"), "utf8"));
  return db;
}

export type Db = Awaited<ReturnType<typeof createDb>>;

/** Run `fn` as the given signed-in user (RLS applies), then restore the owner role. */
export async function as<T>(db: Db, user: UserName | "anon", fn: () => Promise<T>): Promise<T> {
  await db.exec("reset role");
  if (user === "anon") {
    await db.exec("set role anon; select set_config('request.jwt.claim.sub', '', false)");
  } else {
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${USERS[user]}', false)`);
  }
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}

export async function rows<T = Record<string, unknown>>(db: Db, sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows;
}

/** Resolves to the Postgres error message, or null if the statement succeeded. */
export async function failure(db: Db, sql: string, params: unknown[] = []): Promise<string | null> {
  try {
    await db.query(sql, params);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}
