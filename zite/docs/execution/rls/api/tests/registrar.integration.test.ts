// Registrar registration command (migration 007) under the real runtime login. Synthetic data only.
import pg from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { withTenant } from "../src/database";

const { Pool } = pg;
const host = process.env.TEST_PG_SOCKET!;
const port = Number(process.env.TEST_PG_PORT);
const database = "semester_rls_test";
const runtime = new Pool({ host, port, database, user: "semester_runtime_login", max: 60 });
const admin = new Pool({ host, port, database, user: "postgres", max: 2 });

const TA = "a0000000-0000-0000-0000-00000000000a";
const TB = "b0000000-0000-0000-0000-00000000000b";
const ALICE = "00000000-0000-0000-0000-000000000001";
const BOB = "00000000-0000-0000-0000-000000000003";
const SEC10 = "00000000-0000-0000-0002-000000000001";
const FULL = "00000000-0000-0000-0002-000000000002";
const CLOSED = "00000000-0000-0000-0002-000000000003";
const SEC_B = "00000000-0000-0000-0002-0000000000b1";
const student = (n: number) => `00000000-0000-0000-0001-${n.toString(16).padStart(12, "0")}`;

type Row = { request_id: string; state: string; result: string };
const submit = (userId: string, tenantId: string, section: string, key: string) =>
  withTenant(runtime, { userId, tenantId }, async (db) =>
    (await db.query<Row>("select * from app.submit_registration($1, $2)", [section, key])).rows[0]);

afterAll(async () => {
  await admin.query("delete from app.enrollment_records; delete from app.registration_requests; update app.course_sections set enrolled_count = case when capacity = 1 then 1 else 0 end");
  await runtime.end(); await admin.end();
});

describe("registrar: registration command", () => {
  it("40 concurrent students for a 10-seat section: exactly 10 enrolled, 30 capacity_unavailable", async () => {
    const results = await Promise.all(Array.from({ length: 40 }, (_, i) => submit(student(i + 1), TA, SEC10, `k-conc-${i + 1}`)));
    const tally = results.reduce<Record<string, number>>((t, r) => ({ ...t, [r.result]: (t[r.result] ?? 0) + 1 }), {});
    expect(tally).toEqual({ enrolled: 10, capacity_unavailable: 30 });
    const db = (await admin.query("select enrolled_count, (select count(*)::int from app.enrollment_records where section_id = $1 and state = 'enrolled') as live from app.course_sections where id = $1", [SEC10])).rows[0];
    expect(db).toEqual({ enrolled_count: 10, live: 10 });
  });

  it("duplicate submit (same key, 10 concurrent retries) creates one request and one enrollment", async () => {
    await admin.query("delete from app.enrollment_records where section_id = $1", [SEC10]);
    await admin.query("delete from app.registration_requests where section_id = $1", [SEC10]);
    await admin.query("update app.course_sections set enrolled_count = 0 where id = $1", [SEC10]);
    const results = await Promise.all(Array.from({ length: 10 }, () => submit(ALICE, TA, SEC10, "k-alice-retry-1")));
    expect(new Set(results.map((r) => r.request_id)).size).toBe(1);
    expect(results.every((r) => r.result === "enrolled")).toBe(true);
    const n = (await admin.query("select count(*)::int as n from app.enrollment_records where student_user_id = $1 and section_id = $2", [ALICE, SEC10])).rows[0].n;
    expect(n).toBe(1);
  });

  it("a new key for a section already held returns already_enrolled, no second seat", async () => {
    const r = await submit(ALICE, TA, SEC10, "k-alice-retry-2");
    expect(r.result).toBe("already_enrolled");
    expect((await admin.query("select enrolled_count from app.course_sections where id = $1", [SEC10])).rows[0].enrolled_count).toBe(1);
  });

  it("reusing a key for a different section is refused", async () => {
    await expect(submit(ALICE, TA, CLOSED, "k-alice-retry-1")).rejects.toMatchObject({ code: "22023" });
  });

  it("full and closed sections reject without changing counts", async () => {
    expect((await submit(ALICE, TA, FULL, "k-alice-full")).result).toBe("capacity_unavailable");
    expect((await submit(ALICE, TA, CLOSED, "k-alice-closed")).result).toBe("section_closed");
    const rows = (await admin.query("select id, enrolled_count from app.course_sections where id in ($1, $2) order by id", [FULL, CLOSED])).rows;
    expect(rows.map((r) => r.enrolled_count)).toEqual([1, 0]);
  });

  it("cross-tenant: Bob cannot register for Tenant A's section, and Alice cannot reach Tenant B's", async () => {
    await expect(submit(BOB, TA, SEC10, "k-bob-1")).rejects.toThrow(); // membership denial in withTenant
    await expect(submit(ALICE, TA, SEC_B, "k-alice-b")).rejects.toMatchObject({ code: "42501" });
  });

  it("runtime cannot change seat counts or write enrollments directly", async () => {
    await expect(withTenant(runtime, { userId: ALICE, tenantId: TA }, (db) => db.query("update app.course_sections set enrolled_count = 0 where id = $1", [SEC10]))).rejects.toMatchObject({ code: "42501" });
    await expect(withTenant(runtime, { userId: ALICE, tenantId: TA }, (db) => db.query(
      "insert into app.enrollment_records (tenant_id, student_user_id, section_id, request_id) select tenant_id, $1, section_id, id from app.registration_requests limit 1", [ALICE]))).rejects.toMatchObject({ code: "42501" });
  });

  it("a student sees only their own enrollments and requests", async () => {
    await submit(student(1), TA, SEC10, "k-s1-later");
    const mine = await withTenant(runtime, { userId: ALICE, tenantId: TA }, async (db) =>
      (await db.query("select student_user_id from app.enrollment_records")).rows.map((r) => r.student_user_id));
    expect(mine).toEqual([ALICE]);
  });

  it("revoked membership cannot submit", async () => {
    await admin.query("update iam.memberships set status = 'revoked' where user_id = $1", [student(2)]);
    try {
      await expect(submit(student(2), TA, SEC10, "k-s2-revoked")).rejects.toThrow();
    } finally {
      await admin.query("update iam.memberships set status = 'active' where user_id = $1", [student(2)]);
    }
  });

  it("runtime login cannot assume the command role", async () => {
    await expect(withTenant(runtime, { userId: ALICE, tenantId: TA }, (db) => db.query("set local role semester_cmd"))).rejects.toMatchObject({ code: "42501" });
  });
});
