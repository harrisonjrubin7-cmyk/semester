// Append-only, hash-chained audit and transactional outbox (migration 010), via the real runtime login.
import pg from "pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { withTenant } from "../src/database";

const { Pool } = pg;
const conn = { host: process.env.TEST_PG_SOCKET!, port: Number(process.env.TEST_PG_PORT), database: "semester_rls_test" };
const runtime = new Pool({ ...conn, user: "semester_runtime_login", max: 50 });
const admin = new Pool({ ...conn, user: "postgres", max: 3 });
const TA = "a0000000-0000-0000-0000-00000000000a";
const SEC10 = "00000000-0000-0000-0002-000000000001";
const student = (n: number) => `00000000-0000-0000-0001-${n.toString(16).padStart(12, "0")}`;
const submit = (n: number, key: string) => withTenant(runtime, { userId: student(n), tenantId: TA }, async (db) =>
  (await db.query("select * from app.submit_registration($1, $2)", [SEC10, key])).rows[0]);
const count = async (sql: string, args: unknown[] = []) => Number((await admin.query(sql, args)).rows[0].n);
const reset = async () => {
  await admin.query("delete from app.enrollment_records");
  await admin.query("delete from app.registration_requests");
  await admin.query("update app.course_sections set enrolled_count = case when capacity = 1 then 1 else 0 end");
};
const verify = async () => (await admin.query("select platform.verify_audit_chain() as broken")).rows[0].broken;

beforeEach(reset);
afterAll(async () => { await reset(); await runtime.end(); await admin.end(); });

describe("audit and outbox", () => {
  it("a registration writes request, enrollment, audit and outbox together", async () => {
    const a0 = await count("select count(*) as n from platform.audit_events");
    const o0 = await count("select count(*) as n from platform.outbox_events");
    expect((await submit(1, "k-audit-1")).result).toBe("enrolled");
    expect(await count("select count(*) as n from platform.audit_events")).toBe(a0 + 1);
    expect(await count("select count(*) as n from platform.outbox_events")).toBe(o0 + 1);
  });

  it("audit write failure: nothing commits (no request, no enrollment, no seat)", async () => {
    await admin.query("alter table platform.audit_events add constraint inject_fail check (action <> 'registration.submitted') not valid");
    try {
      await expect(submit(2, "k-audit-fail")).rejects.toMatchObject({ code: "23514" });
    } finally {
      await admin.query("alter table platform.audit_events drop constraint inject_fail");
    }
    expect(await count("select count(*) as n from app.registration_requests where idempotency_key = 'k-audit-fail'")).toBe(0);
    expect(await count("select enrolled_count as n from app.course_sections where id = $1", [SEC10])).toBe(0);
  });

  it("outbox write failure: nothing commits", async () => {
    await admin.query("alter table platform.outbox_events add constraint inject_fail check (event_type <> 'enrollment.created') not valid");
    try {
      await expect(submit(3, "k-outbox-fail")).rejects.toMatchObject({ code: "23514" });
    } finally {
      await admin.query("alter table platform.outbox_events drop constraint inject_fail");
    }
    expect(await count("select count(*) as n from app.registration_requests where idempotency_key = 'k-outbox-fail'")).toBe(0);
    expect(await count("select count(*) as n from app.enrollment_records")).toBe(0);
  });

  it("a duplicate retry writes no second audit or outbox row", async () => {
    await submit(4, "k-dup-audit");
    const a = await count("select count(*) as n from platform.audit_events");
    await submit(4, "k-dup-audit");
    expect(await count("select count(*) as n from platform.audit_events")).toBe(a);
  });

  it("runtime has no access to audit or outbox at all", async () => {
    const as = (sql: string) => withTenant(runtime, { userId: student(1), tenantId: TA }, (db) => db.query(sql));
    for (const sql of ["select 1 from platform.audit_events", "update platform.audit_events set action = 'x.y'", "delete from platform.audit_events", "insert into platform.outbox_events (tenant_id, event_type, aggregate_id) values (gen_random_uuid(), 'x', gen_random_uuid())"])
      await expect(as(sql)).rejects.toMatchObject({ code: "42501" });
  });

  it("append-only even for the table owner: update, delete and truncate are refused", async () => {
    for (const sql of ["update platform.audit_events set target = 'edited' where seq = (select min(seq) from platform.audit_events)",
                       "delete from platform.audit_events where seq = (select min(seq) from platform.audit_events)",
                       "truncate platform.audit_events"]) {
      await expect(admin.query(`begin; set local role semester_owner; ${sql}; commit;`)).rejects.toMatchObject({ code: "42501" });
      await admin.query("rollback");
    }
  });

  it("40 concurrent registrations leave one unbroken chain (no forks)", async () => {
    await Promise.all(Array.from({ length: 40 }, (_, i) => submit(i + 1, `k-chain-${i + 1}`)));
    expect(await verify()).toBeNull();
    expect(await count("select count(*) - count(distinct prev_hash) as n from platform.audit_events where prev_hash is not null")).toBe(0);
  });

  it("the audit primitive alone stays linear under 40 concurrent writers (no other lock involved)", async () => {
    const writers = new Pool({ ...conn, user: "postgres", max: 40 });
    try {
      await Promise.all(Array.from({ length: 40 }, async (_, i) => {
        const c = await writers.connect();
        try {
          await c.query("begin");
          await c.query("set local role semester_cmd");
          await c.query("select platform.append_audit($1, null, 'probe.concurrent', $2)", [TA, `probe:${i}`]);
          await c.query("select pg_sleep(0.01)");
          await c.query("commit");
        } finally { c.release(); }
      }));
    } finally { await writers.end(); }
    expect(await count("select count(*) - count(distinct prev_hash) as n from platform.audit_events where prev_hash is not null")).toBe(0);
    expect(await verify()).toBeNull();
  });

  it("tampering by someone who can bypass the trigger is detected at the edited row", async () => {
    const seq = Number((await admin.query("select max(seq) - 3 as s from platform.audit_events")).rows[0].s);
    const original = (await admin.query("select target from platform.audit_events where seq = $1", [seq])).rows[0].target;
    await admin.query("alter table platform.audit_events disable trigger audit_no_update");
    try {
      await admin.query("update platform.audit_events set target = 'request:forged' where seq = $1", [seq]);
      expect(Number(await verify())).toBe(seq);
      await admin.query("update platform.audit_events set target = $2 where seq = $1", [seq, original]);
    } finally {
      await admin.query("alter table platform.audit_events enable trigger audit_no_update");
    }
    expect(await verify()).toBeNull();
  });
});
