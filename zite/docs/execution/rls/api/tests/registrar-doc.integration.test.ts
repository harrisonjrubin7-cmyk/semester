// §9 registrar acceptance checks against the document's migration (migration_008_registrar_doc.sql),
// run as the real runtime login. Synthetic fixtures are created and removed here.
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ForbiddenError, withTenant } from "../src/database";

const { Pool } = pg;
const conn = { host: process.env.TEST_PG_SOCKET!, port: Number(process.env.TEST_PG_PORT), database: "semester_rls_test" };
const runtime = new Pool({ ...conn, user: "semester_runtime_login", max: 30 });
const admin = new Pool({ ...conn, user: "postgres", max: 30 });

const TA = "a0000000-0000-0000-0000-00000000000a", TB = "b0000000-0000-0000-0000-00000000000b";
const ALICE = "00000000-0000-0000-0000-000000000001", ALEX = "00000000-0000-0000-0000-000000000002", BOB = "00000000-0000-0000-0000-000000000003";
const id = (n: number) => `00000000-0000-0000-0003-${n.toString(16).padStart(12, "0")}`;
const S = { alice: id(1), alex: id(2), bob: id(3), termA: id(10), termB: id(11), course: id(20), courseB: id(21), cv: id(30), cvB: id(31),
  secA: id(40), secLast: id(41), secB: id(42), enAlice: id(50), enAlex: id(51), enBob: id(52), g1: id(60), g2: id(61), gAlex: id(62), gBob: id(63) };
const q = (sql: string, args: unknown[] = []) => admin.query(sql, args);

beforeAll(async () => {
  await q("insert into registrar.students (id, tenant_id, user_id, student_number, status) values ($1,$4,$5,'A-001','active'),($2,$4,$6,'A-002','active'),($3,$7,$8,'B-001','active')", [S.alice, S.alex, S.bob, TA, ALICE, ALEX, TB, BOB]);
  await q("insert into registrar.terms (id, tenant_id, code, name, starts_on, ends_on, timezone, state) values ($1,$3,'F26','Fall 2026','2026-08-20','2026-12-15','America/Chicago','published'),($2,$4,'F26','Fall 2026','2026-08-20','2026-12-15','America/New_York','published')", [S.termA, S.termB, TA, TB]);
  await q("insert into registrar.courses (id, tenant_id, code) values ($1,$3,'ECON 1010'),($2,$4,'HIST 100')", [S.course, S.courseB, TA, TB]);
  await q("insert into registrar.course_versions (id, tenant_id, course_id, version, title, credits_min, credits_max, state) values ($1,$3,$5,1,'Principles of Microeconomics',3,3,'approved'),($2,$4,$6,1,'World History',3,3,'approved')", [S.cv, S.cvB, TA, TB, S.course, S.courseB]);
  await q("insert into registrar.sections (id, tenant_id, term_id, course_version_id, section_code, capacity, enrolled_count, state) values ($1,$4,$6,$8,'01',30,2,'open'),($2,$4,$6,$8,'02',1,0,'open'),($3,$5,$7,$9,'01',30,1,'open')", [S.secA, S.secLast, S.secB, TA, TB, S.termA, S.termB, S.cv, S.cvB]);
  await q("insert into registrar.enrollments (id, tenant_id, student_id, section_id, state, credits) values ($1,$4,$6,$9,'enrolled',3),($2,$4,$7,$9,'enrolled',3),($3,$5,$8,$10,'enrolled',3)", [S.enAlice, S.enAlex, S.enBob, TA, TB, S.alice, S.alex, S.bob, S.secA, S.secB]);
  await q("insert into registrar.released_grades (id, tenant_id, enrollment_id, revision, grade_code, grade_scale_version, released_at, supersedes_grade_id) values ($1,$5,$6,1,'B','v1',now(),null),($2,$5,$6,2,'A-','v1',now(),$1),($3,$5,$7,1,'C','v1',now(),null),($4,$8,$9,1,'A','v1',now(),null)", [S.g1, S.g2, S.gAlex, S.gBob, TA, S.enAlice, S.enAlex, TB, S.enBob]);
});
afterAll(async () => {
  for (const t of ["released_grades", "enrollment_events", "enrollments", "registration_requests", "sections", "student_programs", "program_versions", "programs", "course_versions", "courses", "terms", "students"]) await q(`delete from registrar.${t}`);
  await runtime.end(); await admin.end();
});
const asAlice = <T>(fn: (db: pg.PoolClient) => Promise<T>) => withTenant(runtime, { userId: ALICE, tenantId: TA }, fn);

describe("§9 registrar acceptance (document schema, runtime login)", () => {
  it("student sees only their own enrollments", async () => {
    const rows = await asAlice(async (db) => (await db.query("select id from registrar.enrollments")).rows.map((r) => r.id));
    expect(rows).toEqual([S.enAlice]);
  });
  it("student cannot view another student's grades (same tenant or other tenant)", async () => {
    const rows = await asAlice(async (db) => (await db.query("select id from registrar.released_grades order by revision")).rows.map((r) => r.id));
    expect(rows).toEqual([S.g1, S.g2]);
  });
  it("grade correction preserves revision history (both revisions kept, revision unique)", async () => {
    await expect(q("insert into registrar.released_grades (tenant_id, enrollment_id, revision, grade_code, grade_scale_version, released_at) values ($1,$2,2,'F','v1',now())", [TA, S.enAlice])).rejects.toMatchObject({ code: "23505" });
  });
  it("spoofed tenant without membership is denied", async () => {
    await expect(withTenant(runtime, { userId: ALICE, tenantId: TB }, async () => 1)).rejects.toBeInstanceOf(ForbiddenError);
  });
  it("cross-tenant student/section references fail (composite foreign keys)", async () => {
    await expect(q("insert into registrar.enrollments (tenant_id, student_id, section_id, state, credits) values ($1,$2,$3,'enrolled',3)", [TA, S.alice, S.secB])).rejects.toMatchObject({ code: "23503" });
  });
  it("runtime cannot write registrar records (no write grants, as the document intends)", async () => {
    await expect(asAlice((db) => db.query("insert into registrar.enrollments (tenant_id, student_id, section_id, state, credits) values ($1,$2,$3,'enrolled',3)", [TA, S.alice, S.secLast]))).rejects.toMatchObject({ code: "42501" });
    await expect(asAlice((db) => db.query("update registrar.released_grades set grade_code = 'A+' where id = $1", [S.g2]))).rejects.toMatchObject({ code: "42501" });
  });
  it("§4 capacity claim: 20 concurrent claims on the last seat, exactly one succeeds", async () => {
    const claims = await Promise.all(Array.from({ length: 20 }, () => q(
      "update registrar.sections set enrolled_count = enrolled_count + 1, version = version + 1 where tenant_id = $1 and id = $2 and state = 'open' and enrolled_count < capacity returning id", [TA, S.secLast])));
    expect(claims.filter((r) => r.rowCount === 1).length).toBe(1);
    expect((await q("select enrolled_count from registrar.sections where id = $1", [S.secLast])).rows[0].enrolled_count).toBe(1);
  });

  // Findings: these assert the schema's current behaviour so the gap is visible and tracked.
  it("FINDING: students cannot read the catalog (terms, sections) — the catalog.read route has no policy", async () => {
    await expect(asAlice((db) => db.query("select id from registrar.sections"))).rejects.toMatchObject({ code: "42501" });
    await expect(asAlice((db) => db.query("select id from registrar.terms"))).rejects.toMatchObject({ code: "42501" });
  });
  it("FINDING: unique (tenant, student, section) means a dropped student cannot get a new enrollment row", async () => {
    await q("update registrar.enrollments set state = 'dropped' where id = $1", [S.enAlex]);
    await expect(q("insert into registrar.enrollments (tenant_id, student_id, section_id, state, credits) values ($1,$2,$3,'enrolled',3)", [TA, S.alex, S.secA])).rejects.toMatchObject({ code: "23505" });
  });
  it("FINDING: a correction can supersede another enrollment's grade — the chain is not enforced", async () => {
    const r = await q("insert into registrar.released_grades (tenant_id, enrollment_id, revision, grade_code, grade_scale_version, released_at, supersedes_grade_id) values ($1,$2,2,'B','v1',now(),$3) returning id", [TA, S.enAlex, S.g1]);
    expect(r.rowCount).toBe(1);
  });
});
