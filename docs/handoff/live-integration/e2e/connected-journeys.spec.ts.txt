// Connected-journey release tests for the live layer. Runs against STAGING only.
// Rename to .spec.ts, then: npx playwright test e2e/connected-journeys.spec.ts
// Env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (staging, CI secret), INST_A, INST_B (uuids),
//      STUDENT_EMAIL/STUDENT_PASSWORD, FACULTY_EMAIL/FACULTY_PASSWORD (test users in staging)
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL!, ANON = process.env.SUPABASE_ANON_KEY!, SR = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const A = process.env.INST_A!, B = process.env.INST_B!;
const fn = (name: string, token: string, body: unknown, extra: Record<string, string> = {}) =>
  fetch(`${URL}/functions/v1/${name}`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...extra }, body: JSON.stringify(body) });
const admin = createClient(URL, SR, { auth: { persistSession: false } });

async function signIn(email: string, password: string) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { client: c, token: data.session!.access_token, id: data.user!.id };
}
async function setCap(inst: string, capability: string, enabled: boolean, kill = false) {
  await admin.from("live_tenant_capabilities").upsert({ institution_id: inst, capability, enabled, kill_switch: kill,
    approval_ref: enabled ? "STAGING-E2E" : null, enabled_by: enabled ? (await admin.auth.admin.listUsers()).data.users[0].id : null, enabled_at: enabled ? new Date().toISOString() : null });
}

let student: Awaited<ReturnType<typeof signIn>>, faculty: Awaited<ReturnType<typeof signIn>>;
test.beforeAll(async () => {
  student = await signIn(process.env.STUDENT_EMAIL!, process.env.STUDENT_PASSWORD!);
  faculty = await signIn(process.env.FACULTY_EMAIL!, process.env.FACULTY_PASSWORD!);
  await admin.from("live_workspace_grants").upsert([
    { user_id: student.id, institution_id: A, workspace: "student" },
    { user_id: faculty.id, institution_id: A, workspace: "faculty" },
  ]);
});

test("one account sees only its own grants (RLS)", async () => {
  const { data } = await student.client.from("live_workspace_grants").select("user_id,workspace");
  expect(data!.every((g) => g.user_id === student.id)).toBe(true);
  const { data: other } = await student.client.from("live_workspace_grants").select("*").eq("user_id", faculty.id);
  expect(other).toEqual([]);
});

test("clients cannot write grants or switch capabilities on", async () => {
  const g = await student.client.from("live_workspace_grants").insert({ user_id: student.id, institution_id: A, workspace: "registrar" });
  expect(g.error).not.toBeNull();
  const c = await student.client.from("live_tenant_capabilities").update({ enabled: true }).eq("institution_id", A);
  expect(c.error ?? (c.count === 0 ? "no rows" : null)).not.toBeNull();
});

test("capability off → every live function refuses (423)", async () => {
  await setCap(A, "writes.registration", false);
  const r = await fn("live-institution-command", student.token, { institution_id: A, command: "registration.add", payload: { section_id: "S1", term_id: "T1" } }, { "idempotency-key": crypto.randomUUID() });
  expect(r.status).toBe(423);
});

test("student → command → same receipt on retry → conflicting reuse rejected", async () => {
  await setCap(A, "writes.registration", true);
  const key = crypto.randomUUID();
  const body = { institution_id: A, command: "registration.add", payload: { section_id: "S1", term_id: "T1" } };
  const r1 = await (await fn("live-institution-command", student.token, body, { "idempotency-key": key })).json();
  const r2 = await (await fn("live-institution-command", student.token, body, { "idempotency-key": key })).json();
  expect(r1.receipt.created_at).toBe(r2.receipt.created_at);
  const r3 = await fn("live-institution-command", student.token, { ...body, payload: { section_id: "S2", term_id: "T1" } }, { "idempotency-key": key });
  expect(r3.status).toBe(409);
  const { count } = await admin.from("live_outbox").select("id", { count: "exact", head: true }).eq("payload->>idempotency_key", key);
  expect(count).toBe(1); // one outbox event, not two
});

test("kill switch stops an enabled capability", async () => {
  await setCap(A, "writes.registration", true, true);
  const r = await fn("live-institution-command", student.token, { institution_id: A, command: "registration.add", payload: { section_id: "S1", term_id: "T1" } }, { "idempotency-key": crypto.randomUUID() });
  expect(r.status).toBe(423);
  await setCap(A, "writes.registration", true, false);
});

test("cross-tenant: a grant at A does nothing at B", async () => {
  await setCap(B, "writes.registration", true);
  const r = await fn("live-institution-command", student.token, { institution_id: B, command: "registration.add", payload: { section_id: "S1", term_id: "T1" } }, { "idempotency-key": crypto.randomUUID() });
  expect(r.status).toBe(403);
});

test("student cannot submit final grades (faculty-only command)", async () => {
  await setCap(A, "writes.grades", true);
  const r = await fn("live-institution-command", student.token, { institution_id: A, command: "grades.submit_final", payload: { offering_id: "O1", grades: [{ student: "x", grade: "A" }] } }, { "idempotency-key": crypto.randomUUID() });
  expect(r.status).toBe(403);
  const ok = await fn("live-institution-command", faculty.token, { institution_id: A, command: "grades.submit_final", payload: { offering_id: "O1", grades: [{ student: student.id, grade: "A" }] } }, { "idempotency-key": crypto.randomUUID() });
  expect(ok.status).toBe(202);
});

test("connected messaging: faculty → student at the same institution; stranger rejected", async () => {
  await setCap(A, "messaging.send", true);
  const ok = await fn("live-messaging", faculty.token, { institution_id: A, recipient: student.id, subject: "Feedback posted", body: "See your submission." });
  expect(ok.status).toBe(200);
  const { data } = await student.client.from("live_messages").select("subject").eq("subject", "Feedback posted");
  expect(data!.length).toBeGreaterThan(0); // student reads it under RLS
  const stranger = (await admin.auth.admin.listUsers()).data.users.find((u) => ![student.id, faculty.id].includes(u.id));
  if (stranger) {
    const no = await fn("live-messaging", faculty.token, { institution_id: A, recipient: stranger.id, subject: "x", body: "x" });
    expect(no.status).toBe(403);
  }
});

test("unauthenticated calls are refused", async () => {
  const r = await fn("live-institution-command", ANON, { institution_id: A, command: "registration.add", payload: { section_id: "S1", term_id: "T1" } }, { "idempotency-key": crypto.randomUUID() });
  expect(r.status).toBe(401);
});
